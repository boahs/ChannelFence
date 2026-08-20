"use strict";

const Shared = globalThis.ChannelFenceShared;
const elements = {
  enabled: document.getElementById("enabledToggle"),
  status: document.getElementById("statusText"),
  pageTitle: document.getElementById("pageTitle"),
  pageCopy: document.getElementById("pageCopy"),
  pageAction: document.getElementById("pageAction"),
  blockedCount: document.getElementById("blockedCount"),
  recentList: document.getElementById("recentList"),
  emptyState: document.getElementById("emptyState"),
  openOptions: document.getElementById("openOptions")
};

let blockedEntries = [];
let pageContext = null;

function avatarLetter(entry) {
  return Shared.labelForEntry(entry).replace(/^@/, "").slice(0, 1) || "×";
}

async function saveBlocked(entries) {
  blockedEntries = Shared.sanitizeBlockedEntries(entries);
  await chrome.storage.local.set({ [Shared.STORAGE.blocked]: blockedEntries });
  renderBlockedList();
  renderPageContext();
}

function renderBlockedList() {
  elements.recentList.replaceChildren();
  elements.blockedCount.textContent = String(blockedEntries.length);
  elements.emptyState.hidden = blockedEntries.length > 0;

  for (const entry of blockedEntries.slice(0, 4)) {
    const item = document.createElement("li");
    item.className = "mini-list__item";

    const avatar = document.createElement("span");
    avatar.className = "avatar-dot";
    avatar.textContent = avatarLetter(entry);

    const name = document.createElement("span");
    name.className = "mini-list__name";
    name.textContent = Shared.labelForEntry(entry);

    const unblock = document.createElement("button");
    unblock.className = "icon-button";
    unblock.type = "button";
    unblock.textContent = "Unblock";
    unblock.setAttribute("aria-label", `Unblock ${Shared.labelForEntry(entry)}`);
    unblock.addEventListener("click", () => {
      saveBlocked(Shared.removeEntriesMatchingRefs(blockedEntries, entry.aliases));
    });

    item.append(avatar, name, unblock);
    elements.recentList.append(item);
  }
}

function renderPageContext() {
  if (!pageContext || !pageContext.ok || pageContext.refs.length === 0) {
    elements.pageTitle.textContent = "No creator detected";
    elements.pageCopy.textContent = "Open a creator, video, or Short to block its creator.";
    elements.pageAction.textContent = "Block creator";
    elements.pageAction.disabled = true;
    return;
  }

  const match = Shared.findMatchingEntry(blockedEntries, pageContext.refs);
  const name = pageContext.displayName || pageContext.refs[0].value || "This creator";
  elements.pageTitle.textContent = name;
  elements.pageAction.disabled = false;

  if (match) {
    elements.pageCopy.textContent = "This creator is currently blocked everywhere ChannelFence can identify them.";
    elements.pageAction.textContent = "Unblock creator";
    elements.pageAction.classList.remove("button--primary");
    elements.pageAction.classList.add("button--secondary");
  } else {
    elements.pageCopy.textContent = "Hide this creator from feeds, search, recommendations, Shorts, and direct visits.";
    elements.pageAction.textContent = "Block creator";
    elements.pageAction.classList.add("button--primary");
    elements.pageAction.classList.remove("button--secondary");
  }
}

async function loadPageContext() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      throw new Error("No active tab");
    }
    pageContext = await chrome.tabs.sendMessage(tab.id, { type: "CF_GET_PAGE_CONTEXT" });
  } catch {
    pageContext = null;
  }
  renderPageContext();
}

elements.enabled.addEventListener("change", async () => {
  await chrome.storage.local.set({ [Shared.STORAGE.enabled]: elements.enabled.checked });
  elements.status.textContent = elements.enabled.checked ? `${blockedEntries.length} blocked` : "Paused";
});

elements.pageAction.addEventListener("click", async () => {
  if (!pageContext?.refs?.length) {
    return;
  }
  const match = Shared.findMatchingEntry(blockedEntries, pageContext.refs);
  if (match) {
    await saveBlocked(Shared.removeEntriesMatchingRefs(blockedEntries, pageContext.refs));
  } else {
    const entry = Shared.createBlockedEntry(pageContext.refs, pageContext.displayName);
    await saveBlocked(Shared.mergeBlockedEntry(blockedEntries, entry));
  }
});

elements.openOptions.addEventListener("click", () => chrome.runtime.openOptionsPage());

async function initialize() {
  const values = await chrome.storage.local.get(Object.keys(Shared.DEFAULTS));
  blockedEntries = Shared.sanitizeBlockedEntries(values[Shared.STORAGE.blocked]);
  elements.enabled.checked = values[Shared.STORAGE.enabled] !== false;
  elements.status.textContent = elements.enabled.checked ? `${blockedEntries.length} blocked` : "Paused";
  renderBlockedList();
  await loadPageContext();
}

initialize().catch(() => {
  elements.status.textContent = "Unavailable";
  renderPageContext();
});
