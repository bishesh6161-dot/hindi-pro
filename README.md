# YumeZone Rudra-only scraper

Node.js API configured to request **Rudra only**. Other providers are never selected.

## Install (Windows CMD)

No `.env` file or environment-variable configuration is required. The API listens on port `3000` and uses `https://yumezone.live` as its upstream base URL.

```bat
npm install
npm run dev
```

Server: `http://localhost:3000`

## Endpoints

- `GET /api/home`
- `GET /api/search?keyword=naruto`
- `GET /api/info?id=20`
- `GET /api/episodes?id=20`
- `GET /api/watch?id=20&ep=2`
- `GET /api/servers?id=20&ep=2` — page availability check
- `POST /api/extract` — signed Rudra source request, decrypts `ct`, fetches HLS master, returns audio renditions and subtitles
- `POST /api/parse-hls` — parse a supplied HLS playlist

## Extract a Rudra episode

POST JSON to `http://localhost:3000/api/extract`:

```json
{
  "id": 20,
  "ep": 2,
  "language": "hindi"
}
```

`language` is the YumeZone source API language selector. The returned master playlist may contain multiple selectable audio renditions, even when the source request uses `hindi`.

Response includes `hls_url`, `audio_tracks`, `subtitles`, `variants`, intro/outro markers and the decrypted provider metadata. Audio/subtitle availability is determined from the live episode playlist, not a hard-coded catalogue.

## Notes

- Rudra request signing, cipher-token generation and `ct` decryption mirror the player module observed in the supplied HAR.
- The source API and playlist are live upstream services; signatures are generated fresh for each extraction.
- This is an extractor/API, not a media proxy. The returned playlist and its segment URLs are hosted by YumeZone and may require the supplied referer context.
- If YumeZone changes its player algorithm or source API, this implementation may need updating.
