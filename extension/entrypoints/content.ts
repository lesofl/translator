import { browser } from "wxt/browser";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_end",
  main() {
    browser.runtime.onMessage.addListener((msg: unknown) => {
      const m = msg as { type: string; translations?: string[] };
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
      return;
    });
  },
});

function collectTexts(): string[] {
  (window as unknown as Record<string, unknown>).__ptNodes = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue?.trim()) return NodeFilter.FILTER_REJECT;
      if ((node as Record<string, unknown>).__ptDone) return NodeFilter.FILTER_REJECT;
      let el: Element | null = node.parentElement;
      while (el) {
        if (SKIP_TAGS.has(el.tagName)) return NodeFilter.FILTER_REJECT;
        el = el.parentElement;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const texts: string[] = [];
  let n: Text | null;
  while ((n = walker.nextNode() as Text | null)) {
    ((window as unknown as Record<string, unknown>).__ptNodes as Text[]).push(n);
    texts.push(n.nodeValue!);
  }
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
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return (node as unknown as Record<string, unknown>).__ptOriginal !== undefined
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });
  let n: Text | null;
  while ((n = walker.nextNode() as Text | null)) {
    n.nodeValue = (n as unknown as Record<string, unknown>).__ptOriginal as string;
    delete (n as unknown as Record<string, unknown>).__ptOriginal;
    delete (n as unknown as Record<string, unknown>).__ptDone;
  }
}

const SKIP_TAGS = new Set([
  "SCRIPT", "STYLE", "NOSCRIPT", "IFRAME", "CANVAS", "SVG", "MATH", "CODE", "PRE",
]);
