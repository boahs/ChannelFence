"use strict";

const Shared = globalThis.ChannelFenceShared;
const I18n = globalThis.ChannelFenceI18n;
const elements = {
  version: document.getElementById("version"),
  enabled: document.getElementById("enabledToggle"),
  shorts: document.getElementById("shortsToggle"),
  comments: document.getElementById("commentsToggle"),
  blockedCount: document.getElementById("blockedCount"),
  manualForm: document.getElementById("manualBlockForm"),
  manualInput: document.getElementById("manualBlockInput"),
  manualButton: document.getElementById("manualBlockButton"),
  search: document.getElementById("searchInput"),
  list: document.getElementById("blockList"),
  empty: document.getElementById("emptyState"),
  pagination: document.getElementById("listPagination"),
  listStatus: document.getElementById("listStatus"),
  loadMoreButton: document.getElementById("loadMoreButton"),
  exportButton: document.getElementById("exportButton"),
  importButton: document.getElementById("importButton"),
  clearButton: document.getElementById("clearButton"),
  importFile: document.getElementById("importFile"),
  toast: document.getElementById("toast")
};

let blockedEntries = [];
let toastTimer;
let visibleLimit = 200;
let renderScheduled = false;
const LIST_PAGE_SIZE = 200;

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
  if (message) {
    showToast(message);
  }
}

function renderList() {
  const query = elements.search.value.trim().toLowerCase();
  const filtered = blockedEntries.filter((entry) => {
    const nameAliases = Array.isArray(entry.nameAliases) ? entry.nameAliases.join(" ") : "";
    return `${Shared.labelForEntry(entry)} ${entry.key} ${nameAliases}`
      .toLowerCase()
      .includes(query);
  });
  const visibleEntries = filtered.slice(0, visibleLimit);

  elements.list.replaceChildren();
  elements.blockedCount.textContent = String(blockedEntries.length);
  elements.empty.hidden = filtered.length > 0;
  elements.empty.textContent = blockedEntries.length === 0
    ? I18n.get("emptyBlockList")
    : I18n.get("noSearchMatches");
  elements.pagination.hidden = visibleEntries.length >= filtered.length;
  elements.listStatus.textContent = visibleEntries.length < filtered.length
    ? I18n.get("showingCreators", [String(visibleEntries.length), String(filtered.length)])
    : "";
  const fragment = document.createDocumentFragment();

  for (const entry of visibleEntries) {
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
    meta.textContent = entry.blockedAt
      ? I18n.get("blockedEntryDetails", [entry.key, formatDate(entry.blockedAt)])
      : entry.key;
    details.append(name, meta);

    const unblock = document.createElement("button");
    unblock.className = "button button--danger button--small";
    unblock.type = "button";
    unblock.textContent = I18n.get("unblock");
    unblock.addEventListener("click", () => {
      persistBlocked(
        Shared.removeEntriesMatchingRefs(blockedEntries, entry.aliases),
        I18n.get("unblockedNamed", Shared.labelForEntry(entry))
      );
    });

    item.append(avatar, details, unblock);
    fragment.append(item);
  }
  elements.list.append(fragment);
}

function scheduleRenderList() {
  if (renderScheduled) {
    return;
  }
  renderScheduled = true;
  requestAnimationFrame(() => {
    renderScheduled = false;
    renderList();
  });
}

elements.enabled.addEventListener("change", async () => {
  await chrome.storage.local.set({ [Shared.STORAGE.enabled]: elements.enabled.checked });
  showToast(I18n.get(elements.enabled.checked ? "enabledToast" : "pausedToast"));
});

elements.comments.addEventListener("change", async () => {
  await chrome.storage.local.set({ [Shared.STORAGE.hideComments]: elements.comments.checked });
  showToast(I18n.get(elements.comments.checked ? "hideCommentsToast" : "showCommentsToast"));
});

elements.shorts.addEventListener("change", async () => {
  await chrome.storage.local.set({ [Shared.STORAGE.hideHomeShorts]: elements.shorts.checked });
  showToast(I18n.get(elements.shorts.checked ? "hideShortsToast" : "showShortsToast"));
});

elements.search.addEventListener("input", () => {
  visibleLimit = LIST_PAGE_SIZE;
  scheduleRenderList();
});

elements.loadMoreButton.addEventListener("click", () => {
  visibleLimit += LIST_PAGE_SIZE;
  renderList();
});

elements.manualForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const ref = Shared.normalizeManualChannelInput(elements.manualInput.value);
  if (!ref) {
    showToast(I18n.get("invalidHandle"));
    elements.manualInput.focus();
    elements.manualInput.select();
    return;
  }

  const existing = Shared.findMatchingEntry(blockedEntries, [ref]);
  if (existing) {
    showToast(I18n.get("alreadyBlocked", Shared.labelForEntry(existing)));
    elements.manualInput.focus();
    return;
  }

  const entry = Shared.createBlockedEntry([ref], ref.value);
  if (!entry) {
    showToast(I18n.get("couldNotAddCreator"));
    return;
  }

  elements.manualButton.disabled = true;
  try {
    await persistBlocked(
      Shared.mergeBlockedEntry(blockedEntries, entry),
      I18n.get("blockedNamed", Shared.labelForEntry(entry))
    );
    elements.manualInput.value = "";
    elements.manualInput.focus();
  } finally {
    elements.manualButton.disabled = false;
  }
});

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
  showToast(I18n.get("exportedBlockList"));
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
    const merged = Shared.mergeBlockedEntries(blockedEntries, incoming);
    await persistBlocked(merged, I18n.get(
      incoming.length === 1 ? "importedCreatorOne" : "importedCreatorOther",
      String(incoming.length)
    ));
  } catch {
    showToast(I18n.get("invalidExport"));
  }
});

elements.clearButton.addEventListener("click", async () => {
  if (blockedEntries.length === 0) {
    return;
  }
  if (confirm(I18n.get("confirmClearAll", String(blockedEntries.length)))) {
    await persistBlocked([], I18n.get("clearedBlockList"));
  }
});

async function initialize() {
  const values = await chrome.storage.local.get(Object.keys(Shared.DEFAULTS));
  blockedEntries = Shared.sanitizeBlockedEntries(values[Shared.STORAGE.blocked]);
  elements.enabled.checked = values[Shared.STORAGE.enabled] !== false;
  elements.shorts.checked = values[Shared.STORAGE.hideHomeShorts] === true;
  elements.comments.checked = values[Shared.STORAGE.hideComments] !== false;
  elements.version.textContent = I18n.get("version", chrome.runtime.getManifest().version);
  renderList();
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") {
    return;
  }
  if (changes[Shared.STORAGE.enabled]) {
    elements.enabled.checked = changes[Shared.STORAGE.enabled].newValue !== false;
  }
  if (changes[Shared.STORAGE.hideHomeShorts]) {
    elements.shorts.checked = changes[Shared.STORAGE.hideHomeShorts].newValue === true;
  }
  if (changes[Shared.STORAGE.hideComments]) {
    elements.comments.checked = changes[Shared.STORAGE.hideComments].newValue !== false;
  }
  if (changes[Shared.STORAGE.blocked]) {
    blockedEntries = Shared.sanitizeBlockedEntries(
      changes[Shared.STORAGE.blocked].newValue
    );
    renderList();
  }
});

initialize().catch(() => showToast(I18n.get("settingsLoadError")));
