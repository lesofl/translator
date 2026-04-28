const input = document.getElementById("server-url");
const btn = document.getElementById("btn-save");
const statusEl = document.getElementById("status");

chrome.storage.local.get("serverUrl", (data) => {
  input.value = data.serverUrl || "";
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
  chrome.storage.local.set({ serverUrl: url }, () => {
    statusEl.className = "success";
    statusEl.textContent = "Saved.";
    setTimeout(() => { statusEl.textContent = ""; }, 2000);
  });
});
