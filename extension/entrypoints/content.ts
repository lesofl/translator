import { browser } from "wxt/browser";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_end",
  main() {
    browser.runtime.onMessage.addListener((msg: unknown, _sender, sendResponse) => {
      const m = msg as { type: string; translations?: string[] };
      if (m.type === "PING") {
        sendResponse({ ok: true });
        return true;
      }
      if (m.type === "COLLECT_TEXTS") {
        sendResponse({ texts: collectTexts() });
        return true;
      }
      if (m.type === "APPLY_TRANSLATIONS" && m.translations) {
        applyTranslations(m.translations);
        sendResponse({ ok: true });
        return true;
      }
      if (m.type === "RESTORE_ORIGINAL") {
        contentRestore();
        sendResponse({ ok: true });
        return true;
      }
      return false;
    });
  },
});

function isSkipped(el: Element | null): boolean {
  while (el) {
    if (SKIP_TAGS.has(el.tagName)) return true;
    el = el.parentElement;
  }
  return false;
}

function collectTexts(): string[] {
  const body = document.body;
  if (!body) return [];

  const texts: string[] = [];
  const nodes: Text[] = [];
  const visited = new WeakSet<Node>();

  const collectFromRoot = (root: Document | DocumentFragment | Element): void => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      if (visited.has(node)) continue;
      visited.add(node);

      if (!node.nodeValue?.trim()) continue;
      if (isSkipped(node.parentElement)) continue;

      nodes.push(node);
      texts.push(node.nodeValue);
    }

    const hostWalker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    while (hostWalker.nextNode()) {
      const el = hostWalker.currentNode as Element;
      if (el.shadowRoot) collectFromRoot(el.shadowRoot);
    }
  };

  collectFromRoot(body);
  (window as unknown as Record<string, unknown>).__ptNodes = nodes;
  return texts;
}

function applyTranslations(translations: string[]): void {
  const nodes = ((window as unknown as Record<string, unknown>).__ptNodes as Text[]) ?? [];
  nodes.forEach((node, i) => {
    if (translations[i] !== undefined) {
      (node as unknown as Record<string, unknown>).__ptOriginal = node.nodeValue;
      (node as unknown as Record<string, unknown>).__ptDone = true;
      node.nodeValue = translations[i]!;
    }
  });
  (window as unknown as Record<string, unknown>).__ptNodes = [];
}

function contentRestore(): void {
  const body = document.body;
  if (!body) return;

  const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode as unknown as Record<string, unknown>;
    if (node.__ptOriginal !== undefined) {
      (walker.currentNode as Text).nodeValue = node.__ptOriginal as string;
      delete node.__ptOriginal;
      delete node.__ptDone;
    }
  }
}

const SKIP_TAGS = new Set([
  "SCRIPT", "STYLE", "NOSCRIPT", "IFRAME", "CANVAS", "SVG", "MATH", "CODE", "PRE",
]);
