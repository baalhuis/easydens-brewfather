// Vercel serverless function: lijst Brewfather-batches (alle statuses behalve Archived).
// GET /api/batches  ->  { batches: [{id,name,batchNo,recipe,status,measuredOg,measuredFg}] }
// Optioneel: /api/batches?status=Fermenting
//
// Vereist env vars: BREWFATHER_USERID, BREWFATHER_APIKEY (scopes batches.read + batches.write)

export default async function handler(req, res) {
  const USERID = (process.env.BREWFATHER_USERID || "").trim();
  const APIKEY = (process.env.BREWFATHER_APIKEY || "").trim();
  if (!USERID || !APIKEY) {
    return res.status(500).json({ error: "Brewfather-credentials niet ingesteld (BREWFATHER_USERID / BREWFATHER_APIKEY)" });
  }
  const auth = Buffer.from(`${USERID}:${APIKEY}`).toString("base64");

  // Standaard geeft Brewfather alle statuses terug met _id, name, batchNo, status, recipe.name.
  // Geen order_by/include: die veroorzaakten lege/ongeldige antwoorden.
  const params = new URLSearchParams({ limit: "50" });
  if (req.query && req.query.status) params.set("status", req.query.status);

  try {
    const r = await fetch(`https://api.brewfather.app/v2/batches?${params}`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    const text = await r.text();
    if (!r.ok) return res.status(r.status).json({ error: `Brewfather ${r.status}`, detail: text.slice(0, 300) });

    let data;
    try { data = JSON.parse(text); } catch { data = null; }
    if (!Array.isArray(data)) {
      return res.status(502).json({ error: "Onverwacht antwoord van Brewfather", detail: text.slice(0, 300) });
    }

    const batches = data
      .filter((b) => b.status !== "Archived")
      .map((b) => ({
        id: b._id,
        name: b.name || (b.batchNo != null ? `Batch #${b.batchNo}` : b._id),
        batchNo: b.batchNo ?? null,
        recipe: (b.recipe && b.recipe.name) || "",
        status: b.status || "",
        measuredOg: b.measuredOg ?? null,
        measuredFg: b.measuredFg ?? null,
      }))
      .sort((a, b) => (b.batchNo || 0) - (a.batchNo || 0));

    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ batches });
  } catch (e) {
    res.status(502).json({ error: "Kan Brewfather niet bereiken", detail: String(e) });
  }
}
