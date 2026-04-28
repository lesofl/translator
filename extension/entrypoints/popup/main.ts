import { browser } from "wxt/browser";

// ── State ──
let SERVER = "http://localhost:5000";

// ── Restricted URL patterns (cannot inject content scripts) ──
const RESTRICTED = /^(chrome|chrome-extension|about|edge|opera):|^https?:\/\/chrome\.google\.com\/webstore/;

async function ensureContentScript(tabId: number): Promise<boolean> {
  try {
    await browser.tabs.sendMessage(tabId, { type: "PING" });
    return true;
  } catch {
    try {
      await browser.scripting.executeScript({
        target: { tabId },
        files: ["/content-scripts/content.js"],
      });
      return true;
    } catch {
      return false;
    }
  }
}

// ── DOM refs ──
const btnTranslate = document.getElementById("btn-translate") as HTMLButtonElement;
const btnRestore = document.getElementById("btn-restore") as HTMLButtonElement;
const statusDot = document.getElementById("status-dot") as HTMLDivElement;
const statusText = document.getElementById("status-text") as HTMLSpanElement;
const progressWrap = document.getElementById("progress") as HTMLDivElement;
const progressBar = document.getElementById("progress-bar") as HTMLDivElement;
const progressLbl = document.getElementById("progress-label") as HTMLDivElement;
const messageEl = document.getElementById("message") as HTMLDivElement;
const langSelect = document.getElementById("lang-select") as HTMLSelectElement;

// ── Server check ──
async function checkServer(): Promise<boolean> {
  try {
    const res = await fetch(`${SERVER}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        status: string;
        installed_pairs?: { from: string; to: string }[];
      };
      statusDot.className = "online";
      statusText.textContent = "Server online — ready";
      btnTranslate.disabled = false;

      if (data.installed_pairs?.length) {
        const current = langSelect.value;
        langSelect.innerHTML = "";
        const NAMES: Record<string, string> = {
          pt: "Portuguese", ja: "Japanese", es: "Spanish", fr: "French",
          de: "German", zh: "Chinese", ko: "Korean", ar: "Arabic",
          ru: "Russian", it: "Italian",
        };
        data.installed_pairs
          .filter((p) => p.to === "en")
          .forEach((p) => {
            const opt = document.createElement("option");
            opt.value = p.from;
            opt.textContent = `${NAMES[p.from] ?? p.from} (${p.from})`;
            if (p.from === current) opt.selected = true;
            langSelect.appendChild(opt);
          });
      }
      return true;
    }
  } catch {
    // offline
  }
  statusDot.className = "offline";
  statusText.textContent = "Server offline — check settings";
  btnTranslate.disabled = true;
  return false;
}

// ── Progress ──
function setProgress(done: number, total: number): void {
  const pct = total ? Math.round((done / total) * 100) : 0;
  progressBar.style.width = `${pct}%`;
  progressLbl.textContent = `${done} / ${total} nodes`;
}

// ── Translate button ──
btnTranslate.addEventListener("click", async () => {
  messageEl.textContent = "";
  const alive = await checkServer();
  if (!alive) return;

  btnTranslate.disabled = true;
  btnRestore.style.display = "none";
  progressWrap.style.display = "flex";
  setProgress(0, 0);

  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  if (tab.url && RESTRICTED.test(tab.url)) {
    messageEl.textContent = "Cannot translate this type of page.";
    btnTranslate.disabled = false;
    return;
  }

  const connected = await ensureContentScript(tab.id);
  if (!connected) {
    messageEl.textContent =
      "Content script could not be loaded. Try refreshing the page.";
    btnTranslate.disabled = false;
    return;
  }

  const fromLang = langSelect.value;

  try {
    // Collect texts via content script
    const texts = (await browser.tabs.sendMessage(tab.id, {
      type: "COLLECT_TEXTS",
    })) as string[];

    if (!texts || texts.length === 0) {
      statusText.textContent = "No translatable text found.";
      btnTranslate.disabled = false;
      return;
    }

    setProgress(0, texts.length);

    // Batch translate
    const BATCH = 50;
    const allTranslations: string[] = [];

    for (let i = 0; i < texts.length; i += BATCH) {
      const batch = texts.slice(i, i + BATCH);
      const res = await fetch(`${SERVER}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts: batch, from: fromLang, to: "en" }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        messageEl.textContent =
          err.error ?? `Server error ${res.status}`;
        btnTranslate.disabled = false;
        return;
      }

      const data = (await res.json()) as { translations: string[] };
      allTranslations.push(...data.translations);
      setProgress(allTranslations.length, texts.length);
    }

    // Apply translations via content script
    await browser.tabs.sendMessage(tab.id, {
      type: "APPLY_TRANSLATIONS",
      translations: allTranslations,
    });

    statusText.textContent = `Translated ${allTranslations.length} text nodes`;
    btnRestore.style.display = "block";
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    messageEl.textContent = `Error: ${msg}`;
  }

  btnTranslate.disabled = false;
});

// ── Restore button ──
btnRestore.addEventListener("click", async () => {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  if (tab.url && RESTRICTED.test(tab.url)) {
    btnRestore.style.display = "none";
    return;
  }

  const connected = await ensureContentScript(tab.id);
  if (connected) {
    try {
      await browser.tabs.sendMessage(tab.id, { type: "RESTORE_ORIGINAL" });
    } catch {
      // content script may not be loaded yet
    }
  }
  btnRestore.style.display = "none";
  statusText.textContent = "Original text restored";
});

// ── Settings ──
document.getElementById("btn-settings")!.addEventListener("click", () => {
  browser.runtime.openOptionsPage();
});

// ── Init ──
(async () => {
  const stored = await browser.storage.local.get("serverUrl");
  if (stored.serverUrl) SERVER = stored.serverUrl as string;
  checkServer();
})();
