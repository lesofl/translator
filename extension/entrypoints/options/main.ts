import { browser } from "wxt/browser";

const input = document.getElementById("server-url") as HTMLInputElement;
const btn = document.getElementById("btn-save") as HTMLButtonElement;
const statusEl = document.getElementById("status") as HTMLDivElement;

browser.storage.local.get("serverUrl").then((data) => {
  input.value = (data.serverUrl as string) || "";
});

btn.addEventListener("click", () => {
  const url = input.value.trim();
  if (!url) {
    statusEl.className = "error";
    statusEl.textContent = "URL cannot be empty";
    return;
  }
  try {
    new URL(url);
  } catch {
    statusEl.className = "error";
    statusEl.textContent = "Invalid URL format";
    return;
  }
  browser.storage.local.set({ serverUrl: url }).then(() => {
    statusEl.className = "success";
    statusEl.textContent = "Saved.";
    setTimeout(() => {
      statusEl.textContent = "";
    }, 2000);
  });
});
