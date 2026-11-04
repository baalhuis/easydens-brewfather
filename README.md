# EasyDens → Brewfather

Een kleine telefoon-app om met je Anton Paar EasyDens 2 een SG-meting te doen en die
naar een gekozen Brewfather-batch te schrijven — zonder de Brew Meister-app, en zonder
dat je Mac binnen Bluetooth-bereik hoeft te staan.

De telefoon doet de Bluetooth-meting lokaal; een kleine Vercel-backend praat met
Brewfather (zodat je API-sleutel niet in de pagina staat en CORS geen probleem is).

## Wat het doet
- Verbindt via BLE met de EasyDens, start een meting en ontsleutelt SG + temperatuur
  (AES-256-CBC; sleutel = serienummer ×4; IV = nul — afgeleid uit de Brew Meister-app).
- Rekent de ruwe dichtheid met de temperatuur om naar **SG bij 20 °C** (zoals de app).
- Laat je een **actieve batch** kiezen en schrijft de meting:
  - als **measured FG** (of OG) op die batch — via de Brewfather v2-API;
  - als **punt in de gravity-grafiek** — via Custom Stream.

## iPhone: open in Bluefy
Web Bluetooth werkt niet in Safari/Chrome op iOS. Installeer **Bluefy – Web BLE Browser**
(App Store, gratis) en open daarin de URL van je Vercel-deploy. Zet tijdens het meten
Bluetooth op je telefoon aan en sluit de Brew Meister-app af (die kaapt anders de verbinding).

## Brewfather klaarzetten
1. **API-key**: Brewfather → Settings → API → *Generate*, met scopes `batches.read` en
   `batches.write`. Noteer je **User ID** en de **API Key**.
2. **Custom Stream**: Brewfather → Settings → Power-ups → *Custom Stream* aanzetten.
   Kopieer de **id** uit de logging-URL (`…/stream?id=XXXX`).
   Koppel het EasyDens-"device" (verschijnt na de eerste meting, naam `EasyDens`) aan je
   lopende batch, zodat de grafiekpunten in de juiste batch landen.

## Deployen op Vercel
```bash
cd easydens-brewfather
vercel            # eerste keer: project aanmaken
vercel --prod     # productie-deploy
```
Zet daarna de environment variables (Project → Settings → Environment Variables):

| Variable | Waarde |
|---|---|
| `BREWFATHER_USERID` | je Brewfather User ID |
| `BREWFATHER_APIKEY` | je Brewfather API Key |
| `BREWFATHER_STREAM_ID` | de id uit de Custom Stream-URL |

Redeploy na het zetten van de variables. Eventueel een eigen subdomein hangen, bv.
`easydens.baalhuis.net`.

## Gebruik
1. Open de URL in Bluefy.
2. **Verbind met EasyDens** → doe de sample in de meetcel.
3. Wacht tot SG stabiel staat, kies de batch, kies FG of OG.
4. **Schrijf naar Brewfather.**

## Let op
- Custom Stream negeert readings vaker dan **1×/15 min** per device-naam; measured FG/OG
  via de API heeft die limiet niet.
- Measured FG/OG is één veld dat je overschrijft; de grafiek houdt de historie.
- De sleutel wordt per apparaat uit het serienummer afgeleid, dus dit werkt met elke
  EasyDens 2 — niets hard-coded.

## Bestanden
- `index.html` — de app (draait in Bluefy)
- `api/batches.js` — lijst actieve batches (Vercel serverless)
- `api/write.js` — schrijf measured-veld + stream-reading
