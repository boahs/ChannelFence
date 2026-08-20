"use strict";

const Shared = globalThis.ChannelFenceShared;
const elements = {
  version: document.getElementById("version"),
  enabled: document.getElementById("enabledToggle"),
  comments: document.getElementById("commentsToggle"),
  blockedCount: document.getElementById("blockedCount"),
  search: document.getElementById("searchInput"),
  list: document.getElementById("blockList"),
  empty: document.getElementById("emptyState"),
  exportButton: document.getElementById("exportButton"),
  importButton: document.getElementById("importButton"),
  clearButton: document.getElementById("clearButton"),
  importFile: document.getElementById("importFile"),
  toast: document.getElementById("toast")
};

let blockedEntries = [];
let toastTimer;

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("toast--visible");
  toastTimer = setTimeout(() => elements.toast.classList.remove("toast--visible"), 2800);
}

function avatarLetter(entry) {
  return Shared.labelForEntry(entry).replace(/^@/, "").slice(0, 1) || "×";
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "" : date.toLocaleDateString();
}

async function persistBlocked(entries, message) {
  blockedEntries = Shared.sanitizeBlockedEntries(entries);
  await chrome.storage.local.set({ [Shared.STORAGE.blocked]: blockedEntries });
  renderList();
  if (message) {
    showToast(message);
  }
}

function renderList() {
  const query = elements.search.value.trim().toLowerCase();
  const filtered = blockedEntries.filter((entry) => {
    return `${Shared.labelForEntry(entry)} ${entry.key}`.toLowerCase().includes(query);
  });

  elements.list.replaceChildren();
  elements.blockedCount.textContent = String(blockedEntries.length);
  elements.empty.hidden = filtered.length > 0;
  elements.empty.textContent = blockedEntries.length === 0
    ? "Your block list is empty."
    : "No blocked creators match this search.";

  for (const entry of filtered) {
    const item = document.createElement("li");
    item.className = "block-list__item";

    const avatar = document.createElement("span");
    avatar.className = "avatar-dot";
    avatar.textContent = avatarLetter(entry);

    const details = document.createElement("div");
    const name = document.createElement("div");
    name.className = "block-list__name";
    name.textContent = Shared.labelForEntry(entry);
    const meta = document.createElement("div");
    meta.className = "block-list__meta";
    meta.textContent = `${entry.key}${entry.blockedAt ? ` · Blocked ${formatDate(entry.blockedAt)}` : ""}`;
    details.append(name, meta);

    const unblock = document.createElement("button");
    unblock.className = "button button--danger button--small";
    unblock.type = "button";
    unblock.textContent = "Unblock";
    unblock.addEventListener("click", () => {
      persistBlocked(
        Shared.removeEntriesMatchingRefs(blockedEntries, entry.aliases),
        `Unblocked ${Shared.labelForEntry(entry)}`
      );
    });

    item.append(avatar, details, unblock);
    elements.list.append(item);
  }
}

elements.enabled.addEventListener("change", async () => {
  await chrome.storage.local.set({ [Shared.STORAGE.enabled]: elements.enabled.checked });
  showToast(elements.enabled.checked ? "ChannelFence enabled" : "ChannelFence paused");
});

elements.comments.addEventListener("change", async () => {
  await chrome.storage.local.set({ [Shared.STORAGE.hideComments]: elements.comments.checked });
  showToast(elements.comments.checked ? "Blocked comments will be hidden" : "Comments will remain visible");
});

elements.search.addEventListener("input", renderList);

elements.exportButton.addEventListener("click", () => {
  const payload = {
    product: "ChannelFence",
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    blockedChannels: blockedEntries
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `channelfence-block-list-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  showToast("Block list exported");
});

elements.importButton.addEventListener("click", () => elements.importFile.click());

elements.importFile.addEventListener("change", async () => {
  const [file] = elements.importFile.files;
  elements.importFile.value = "";
  if (!file) {
    return;
  }

  try {
    const payload = JSON.parse(await file.text());
    const incoming = Shared.sanitizeBlockedEntries(
      Array.isArray(payload) ? payload : payload.blockedChannels
    );
    if (incoming.length === 0) {
      throw new Error("No valid channels");
    }
    let merged = blockedEntries;
    for (const entry of incoming) {
      merged = Shared.mergeBlockedEntry(merged, entry);
    }
    await persistBlocked(merged, `Imported ${incoming.length} creator${incoming.length === 1 ? "" : "s"}`);
  } catch {
    showToast("That file is not a valid ChannelFence export");
  }
});

elements.clearButton.addEventListener("click", async () => {
  if (blockedEntries.length === 0) {
    return;
  }
  if (confirm(`Unblock all ${blockedEntries.length} creators?`)) {
    await persistBlocked([], "Block list cleared");
  }
});

async function initialize() {
  const values = await chrome.storage.local.get(Object.keys(Shared.DEFAULTS));
  blockedEntries = Shared.sanitizeBlockedEntries(values[Shared.STORAGE.blocked]);
  elements.enabled.checked = values[Shared.STORAGE.enabled] !== false;
  elements.comments.checked = values[Shared.STORAGE.hideComments] !== false;
  elements.version.textContent = `Version ${chrome.runtime.getManifest().version}`;
  renderList();
}

initialize().catch(() => showToast("Settings could not be loaded"));
