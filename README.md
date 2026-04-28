# Lingua — Offline Page Translator

A browser extension that translates web pages to English using a local LibreTranslate server via Docker. No cloud, no API keys, fully offline after initial model download.

---

## Quick Start

```bash
# 1. Start LibreTranslate + proxy
docker compose up -d

# 2. Load extension in Chrome
#    Go to chrome://extensions/ → Enable Developer Mode → Load unpacked
#    Select the browser-extension/ folder

# 3. Click the Lingua icon in the toolbar → select language → Translate Page
```

---

## Architecture

```
┌──────────────────────┐
│  Browser Extension    │  configurable SERVER_URL (default http://127.0.0.1:5000)
└──────────┬───────────┘
           │ HTTP
           ▼
┌──────────────────────┐
│  Hono Proxy :5000    │  thin Node.js adapter — fans out batch requests
└──────────┬───────────┘
           │ Docker network
           ▼
┌──────────────────────┐
│  LibreTranslate       │  translation engine (Argos Translate under the hood)
│  (Docker container)   │  auto-downloads language models on first use
└──────────────────────┘
```

- **Hono proxy** translates the extension's batched API into individual LibreTranslate calls and handles CORS.
- **LibreTranslate** handles the actual translation. Language models are cached in `./lt-data/` so they persist across container restarts.

---

## Browser Extension

### Load in Chrome / Edge / Brave

1. Go to `chrome://extensions/` (or `edge://extensions/`)
2. Enable **Developer Mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `browser-extension/` folder

### Load in Firefox

1. Go to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on...**
3. Navigate into `browser-extension/` and select `manifest.json`

### Configure Server URL

Click the gear icon (⚙) in the extension popup to open settings. The default is `http://127.0.0.1:5000`. Change this if:
- You're running the proxy on a different port
- You're tunneling the service and need an external URL

---

## Docker Compose

```yaml
services:
  libretranslate:
    image: libretranslate/libretranslate:latest
    volumes:
      - ./lt-data:/home/libretranslate/.local   # persist downloaded models
    restart: unless-stopped

  proxy:
    build: ./node-server
    ports:
      - "5000:5000"                              # expose to host
    environment:
      LT_URL: "http://libretranslate:5000"
    restart: unless-stopped
```

### Commands

```bash
docker compose up -d      # start both services
docker compose down       # stop
docker compose logs -f    # follow logs
```

### Adding Languages

LibreTranslate auto-downloads language models on first use. To pre-load specific languages at startup, add to `docker-compose.yml`:

```yaml
environment:
  LT_LOAD_ONLY: "en,pt,ja,es,fr,de,zh"   # under libretranslate service
```

Supported codes: `en, pt, ja, es, fr, de, zh, ko, ar, ru, it, nl, tr, pl, ...`

---

## Node Proxy (standalone)

You can also run the proxy outside Docker:

```bash
cd node-server
npm install
LT_URL=http://127.0.0.1:5001 npm start     # if LT is running separately
```

### Proxy Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Returns `{status, installed_pairs}` — used by extension to discover language pairs |
| `POST` | `/translate` | `{texts:[...], from:"pt", to:"en"}` → `{translations:[...]}` — fan-out to LT |
| `GET` | `/languages` | Pass-through to LibreTranslate `/languages` |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Status dot is red | Run `docker compose up -d`, check `docker compose logs` |
| "Server offline" in popup | Check server URL in extension settings (gear icon) |
| Translation slow on first use | LibreTranslate is downloading the language model — wait and retry |
| Extension not loading | Ensure `icons/icon48.png` and `icons/icon128.png` exist |
| Port 5000 already in use | Change `ports:` in docker-compose.yml and update extension settings |
