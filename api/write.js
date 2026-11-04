// Vercel serverless function: schrijf een meting naar Brewfather.
// POST /api/write  body: { batchId?, sg?, ph?, temp?, field?, deviceName?, patch?, stream? }
//  - sg  -> gravity (en optioneel measured OG/FG via API)
//  - ph  -> alleen via Custom Stream (veld ph)

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "alleen POST" });

  const USERID = (process.env.BREWFATHER_USERID || "").trim();
  const APIKEY = (process.env.BREWFATHER_APIKEY || "").trim();
  const STREAM_ID = (process.env.BREWFATHER_STREAM_ID || "").trim().replace(/^.*[?&]id=/, "").replace(/[?&].*$/, "");

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body || "{}"); } catch { body = {}; } }
  const {
    batchId, sg = null, ph = null, temp = null,
    field = "measuredFg", deviceName = "EasyDens",
    patch = false, stream = true,
  } = body || {};

  if (sg == null && ph == null) return res.status(400).json({ error: "sg of ph vereist" });
  const sgNum = sg == null ? null : Number(Number(sg).toFixed(4));
  const phNum = ph == null ? null : Number(Number(ph).toFixed(2));
  const results = {};

  // measured veld op de gekozen batch (gravity-velden met SG, Mash pH met pH)
  const GRAV = new Set(["measuredOg", "measuredFg", "measuredFirstWortGravity", "measuredPreBoilGravity", "measuredPostBoilGravity"]);
  if (patch && batchId) {
    let f = null, val = null;
    if (GRAV.has(field) && sgNum != null) { f = field; val = sgNum; }
    else if (field === "measuredMashPh" && phNum != null) { f = field; val = phNum; }
    if (!f) {
      results.patch = { ok: false, error: `veld '${field}' of waarde ontbreekt` };
    } else if (!USERID || !APIKEY) {
      results.patch = { ok: false, error: "credentials niet ingesteld" };
    } else {
      const auth = Buffer.from(`${USERID}:${APIKEY}`).toString("base64");
      try {
        const r = await fetch(`https://api.brewfather.app/v2/batches/${encodeURIComponent(batchId)}`, {
          method: "PATCH",
          headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
          body: JSON.stringify({ [f]: val }),
        });
        const t = await r.text();
        results.patch = { ok: r.ok, status: r.status, field: f, detail: t.slice(0, 200) };
      } catch (e) { results.patch = { ok: false, error: String(e) }; }
    }
  }

  // Custom Stream reading (SG en/of pH)
  if (stream) {
    if (!STREAM_ID) {
      results.stream = { ok: false, error: "BREWFATHER_STREAM_ID niet ingesteld" };
    } else {
      const payload = { name: deviceName };
      if (sgNum != null) { payload.gravity = sgNum; payload.gravity_unit = "G"; }
      if (phNum != null) { payload.ph = phNum; }
      if (temp != null && !Number.isNaN(Number(temp))) { payload.temp = Number(Number(temp).toFixed(2)); payload.temp_unit = "C"; }
      try {
        const r = await fetch(`https://log.brewfather.net/stream?id=${encodeURIComponent(STREAM_ID)}`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
        const t = await r.text();
        results.stream = { ok: r.ok, status: r.status, detail: t.slice(0, 200) };
      } catch (e) { results.stream = { ok: false, error: String(e) }; }
    }
  }

  res.status(200).json({ ok: true, sg: sgNum, ph: phNum, results });
}
