import { defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    name: "Lingua",
    version: "2.0.0",
    description: "Offline page translator powered by LibreTranslate.",
    permissions: ["activeTab", "scripting", "storage"],
    host_permissions: ["http://127.0.0.1:*/*", "http://localhost:*/*"],
    icons: {
      "48": "icons/icon48.png",
      "128": "icons/icon128.png",
    },
  },
});
