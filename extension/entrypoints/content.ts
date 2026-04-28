import { browser } from "wxt/browser";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_end",
  main() {
    browser.runtime.onMessage.addListener((msg: unknown) => {
      const m = msg as { type: string; translations?: string[] };
      if (m.type === "PING") {
        return Promise.resolve(true);
      }
      if (m.type === "COLLECT_TEXTS") {
        return Promise.resolve(collectTexts());
      }
      if (m.type === "APPLY_TRANSLATIONS" && m.translations) {
        applyTranslations(m.translations);
        return Promise.resolve(true);
      }
      if (m.type === "RESTORE_ORIGINAL") {
        contentRestore();
        return Promise.resolve(true);
      }
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

  const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
  const texts: string[] = [];
  const nodes: Text[] = [];

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (!node.nodeValue?.trim()) continue;
    if (isSkipped(node.parentElement)) continue;

    nodes.push(node);
    texts.push(node.nodeValue);
  }

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
