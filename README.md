# Lingua — Offline Page Translator

A browser extension that translates web pages to English using a local [LibreTranslate](https://libretranslate.com) server via Docker. No cloud, no API keys, fully offline after initial model download.

---

## Quick Start

```bash
# 1. Start LibreTranslate + Hono proxy
docker compose up -d

# 2. Load in Chrome
#    chrome://extensions → Developer Mode → Load unpacked
#    Select extension/app/
```

The extension connects to `http://127.0.0.1:5000` by default. Change it via the gear icon in the popup.

> **No build step needed.** `extension/app/` contains the pre-built extension ready to load. To rebuild from source: `cd extension && bun install && bun run build`.

---

## Architecture

```
┌──────────────────────┐
│  Browser Extension    │  WXT (TypeScript), configurable SERVER_URL
└──────────┬───────────┘
           │ HTTP
           ▼
┌──────────────────────┐
│  Hono Proxy :5000    │  bun + Hono, fans out batch requests to LT
└──────────┬───────────┘
           │ Docker network
           ▼
┌──────────────────────┐
│  LibreTranslate       │  translation engine (Argos Translate internally)
│  (Docker container)   │  auto-downloads models on first use
└──────────────────────┘
```

---

## Extension (WXT)

Built with [WXT](https://wxt.dev), TypeScript, and bun.

```bash
cd extension
bun install        # install deps + run wxt prepare
bun run dev        # dev mode with HMR
bun run build      # production build → .output/chrome-mv3/
bun run zip        # package for store submission
bun run dev:firefox
bun run build:firefox
```

### Configure Server URL

Click the gear (⚙) in the popup to open settings. Default is `http://127.0.0.1:5000`.

---

## Docker Compose

```yaml
services:
  libretranslate:
    image: libretranslate/libretranslate:latest
    volumes:
      - ./lt-data:/home/libretranslate/.local
    restart: unless-stopped

  proxy:
    build: ./server
    ports:
      - "5000:5000"
    environment:
      LT_URL: "http://libretranslate:5000"
    restart: unless-stopped
```

```bash
docker compose up -d      # start both services
docker compose down       # stop
docker compose logs -f    # follow logs
```

---

## Hono Proxy (standalone)

You can also run the proxy directly with bun:

```bash
cd server
bun install
LT_URL=http://127.0.0.1:5001 bun dev    # LT running separately
```

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | `{status, installed_pairs}` — extension uses this to discover languages |
| `POST` | `/translate` | `{texts:[...], from, to}` → `{translations:[...]}` — fan-out to LT |
| `GET` | `/languages` | Pass-through to LibreTranslate `/languages` |

---

## Tunnelling

To access from another machine or the internet:

```bash
# Cloudflare Tunnel
cloudflared tunnel --url http://127.0.0.1:5000

# ngrok
ngrok http 5000
```

Then update the server URL in the extension's settings.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Status dot red | Run `docker compose up -d`, check `docker compose logs` |
| Slow first translation | LibreTranslate is downloading the model — retry in a minute |
| Message-passing error | The page may not have fully loaded — refresh and retry |
| Port 5000 in use | Change `ports:` in docker-compose.yml and update extension settings |
