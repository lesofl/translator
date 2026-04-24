const SERVER = "http://127.0.0.1:5000";

const btnTranslate = document.getElementById("btn-translate");
const btnRestore   = document.getElementById("btn-restore");
const statusDot    = document.getElementById("status-dot");
const statusText   = document.getElementById("status-text");
const progressWrap = document.getElementById("progress");
const progressBar  = document.getElementById("progress-bar");
const progressLbl  = document.getElementById("progress-label");
const messageEl    = document.getElementById("message");
const langSelect   = document.getElementById("lang-select");

async function checkServer() {
  try {
    const res = await fetch(`${SERVER}/health`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      statusDot.className = "online";
      statusText.textContent = "Server online — ready";
      btnTranslate.disabled = false;

      if (data.installed_pairs?.length) {
        const current = langSelect.value;
        langSelect.innerHTML = "";
        const NAMES = { pt: "Portuguese", ja: "Japanese", es: "Spanish", fr: "French",
                        de: "German", zh: "Chinese", ko: "Korean", ar: "Arabic",
                        ru: "Russian", it: "Italian" };
        data.installed_pairs
          .filter(p => p.to === "en")
          .forEach(p => {
            const opt = document.createElement("option");
            opt.value = p.from;
            opt.textContent = `${NAMES[p.from] ?? p.from} (${p.from})`;
            if (p.from === current) opt.selected = true;
            langSelect.appendChild(opt);
          });
      }
      return true;
    }
  } catch (_) {}
  statusDot.className = "offline";
  statusText.textContent = "Server offline (run server.py)";
  btnTranslate.disabled = true;
  return false;
}

function setProgress(done, total) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  progressBar.style.width = pct + "%";
  progressLbl.textContent = `${done} / ${total} nodes`;
}

btnTranslate.addEventListener("click", async () => {
  messageEl.textContent = "";
  const alive = await checkServer();
  if (!alive) return;

  btnTranslate.disabled = true;
  btnRestore.style.display = "none";
  progressWrap.style.display = "flex";
  setProgress(0, 0);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const fromLang = langSelect.value;

  try {
    // ── Pass 1: collect text nodes from the page ────────────────────────────
    const collected = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: collectTexts,
    });

    const texts = collected[0]?.result;
    if (!texts || texts.length === 0) {
      statusText.textContent = "No translatable text found.";
      btnTranslate.disabled = false;
      return;
    }

    setProgress(0, texts.length);

    // ── Pass 2: fetch translations in popup context (no mixed-content block) ─
    const BATCH = 50;
    const allTranslations = [];

    for (let i = 0; i < texts.length; i += BATCH) {
      const batch = texts.slice(i, i + BATCH);
      const res = await fetch(`${SERVER}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts: batch, from: fromLang, to: "en" }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        messageEl.textContent = err.error ?? `Server error ${res.status}`;
        btnTranslate.disabled = false;
        return;
      }

      const data = await res.json();
      allTranslations.push(...data.translations);
      setProgress(allTranslations.length, texts.length);
    }

    // ── Pass 3: apply translations back into the page ───────────────────────
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: applyTranslations,
      args: [allTranslations],
    });

    statusText.textContent = `Translated ${allTranslations.length} text nodes`;
    btnRestore.style.display = "block";

  } catch (err) {
    messageEl.textContent = "Error: " + err.message;
  }

  btnTranslate.disabled = false;
});

btnRestore.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: contentRestore,
  });
  btnRestore.style.display = "none";
  statusText.textContent = "Original text restored";
});

// ── Functions injected into the page ────────────────────────────────────────

const SKIP_TAGS = new Set([
  "SCRIPT", "STYLE", "NOSCRIPT", "IFRAME", "CANVAS", "SVG", "MATH", "CODE", "PRE",
]);

function makeWalker() {
  return document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      let el = node.parentElement;
      while (el) {
        if (["SCRIPT","STYLE","NOSCRIPT","IFRAME","CANVAS","SVG","MATH","CODE","PRE"]
              .includes(el.tagName)) return NodeFilter.FILTER_REJECT;
        el = el.parentElement;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
}

function collectTexts() {
  // Marks each visited text node so applyTranslations can find them in order
  window.__ptNodes = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      if (node.__ptDone) return NodeFilter.FILTER_REJECT;
      let el = node.parentElement;
      while (el) {
        if (["SCRIPT","STYLE","NOSCRIPT","IFRAME","CANVAS","SVG","MATH","CODE","PRE"]
              .includes(el.tagName)) return NodeFilter.FILTER_REJECT;
        el = el.parentElement;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const texts = [];
  let n;
  while ((n = walker.nextNode())) {
    window.__ptNodes.push(n);
    texts.push(n.nodeValue);
  }
  return texts;
}

function applyTranslations(translations) {
  const nodes = window.__ptNodes ?? [];
  nodes.forEach((node, i) => {
    if (translations[i] !== undefined) {
      node.__ptOriginal = node.nodeValue;
      node.__ptDone = true;
      node.nodeValue = translations[i];
    }
  });
  window.__ptNodes = [];
}

function contentRestore() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return node.__ptOriginal !== undefined
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });
  let n;
  while ((n = walker.nextNode())) {
    n.nodeValue = n.__ptOriginal;
    delete n.__ptOriginal;
    delete n.__ptDone;
  }
}

checkServer();
