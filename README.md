# Lingua — Offline Page Translator

A browser extension that translates web pages to English using a local server. No cloud, no API keys, fully offline after setup.


---

## Python Server

### Requirements
- Python 3.8+
- `argostranslate` package

### Install

**With internet:**
```bash
cd python-server
pip install argostranslate
```

**Without internet (transfer from another machine):**
```bash
# On personal machine — download wheels
pip download argostranslate -d ./packages

# Copy the ./packages folder to company machine, then:
pip install --no-index --find-links ./packages argostranslate
```

### Install Language Packs

**With internet:**
```bash
# Install defaults (Portuguese + Japanese -> English)
python setup_lang.py

# Install specific language -> English
python setup_lang.py es
python setup_lang.py es fr de

# Install custom pair
python setup_lang.py es:fr

# List all available languages
python setup_lang.py --list

# List installed languages
python setup_lang.py --installed
```

**Without internet (offline install):**

1. On your personal machine, download `.argosmodel` files from:
   ```
   https://github.com/argosopentech/argos-translate/releases
   ```

2. Copy the `.argosmodel` files to the company machine

3. Install from file:
   ```bash
   python setup_lang.py --file translate-pt_en.argosmodel
   python setup_lang.py --file translate-pt_en.argosmodel translate-ja_en.argosmodel
   ```

**Alternatively — copy the model folder directly:**

After installing on your personal machine, copy this folder to the same path on the company machine:

| OS | Path |
|---|---|
| Windows | `C:\Users\<you>\AppData\Local\argos-translate\` |
| Mac / Linux | `~/.local/share/argos-translate/` |

### Start the Server
```bash
python server.py
# or double-click start.bat on Windows
```

Server runs at `http://127.0.0.1:5000`

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

> Firefox loads it temporarily — it disappears on browser restart.

### Generate Icons (first time only)

```bash
cd browser-extension
pip install pillow
python generate_icons.py
```

### Usage

1. Start the translation server (Python or Node.js)
2. Click the **LinguaAdsf** icon in the browser toolbar
3. The status dot turns **green** when the server is reachable
4. Select the source language from the dropdown
5. Click **Translate Page**
6. Click **Restore Original** to revert

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Status dot is red | Start the server first (`python server.py` or `node server.js`) |
| "Failed to fetch" error | Page is HTTPS blocking HTTP — this is handled automatically by the extension fetching via popup context |
| "Language pair not installed" | Run `setup_lang.py es` or `setup_lang.js es` for the missing language |
| Extension not loading | Check that `icons/icon48.png` and `icons/icon128.png` exist — run `generate_icons.py` if missing |
| No text translated | Page may be fully JavaScript-rendered — try waiting for the page to fully load before translating |
