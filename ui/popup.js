"use strict";

const Shared = globalThis.ChannelFenceShared;
const elements = {
  enabled: document.getElementById("enabledToggle"),
  status: document.getElementById("statusText"),
  pageTitle: document.getElementById("pageTitle"),
  pageCopy: document.getElementById("pageCopy"),
  pageActions: document.getElementById("pageActions"),
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
  elements.pageActions.replaceChildren();
  if (!pageContext || !pageContext.ok || pageContext.refs.length === 0) {
    elements.pageTitle.textContent = "No creator detected";
    elements.pageCopy.textContent = "Open a creator, video, or Short to block its creator.";
    const action = document.createElement("button");
    action.className = "button button--primary";
    action.type = "button";
    action.textContent = "Block creator";
    action.disabled = true;
    elements.pageActions.append(action);
    return;
  }

  const owners = Array.isArray(pageContext.owners) && pageContext.owners.length > 0
    ? pageContext.owners
    : [{ refs: pageContext.refs, displayName: pageContext.displayName }];
  if (owners.length > 1) {
    elements.pageTitle.textContent = "Multiple creators detected";
    elements.pageCopy.textContent = "Choose which creator to block or unblock.";
  } else {
    const owner = owners[0];
    const match = Shared.findMatchingEntry(blockedEntries, owner.refs);
    elements.pageTitle.textContent = owner.displayName || owner.refs[0]?.value || "This creator";
    elements.pageCopy.textContent = match
      ? "This creator is currently blocked everywhere ChannelFence can identify them."
      : "Hide this creator from feeds, search, recommendations, Shorts, and direct visits.";
  }

  for (const owner of owners) {
    const match = Shared.findMatchingEntry(blockedEntries, owner.refs);
    const name = owner.displayName || owner.refs[0]?.value || "creator";
    const action = document.createElement("button");
    action.type = "button";
    action.className = `button ${match ? "button--secondary" : "button--primary"}`;
    action.textContent = owners.length > 1
      ? `${match ? "Unblock" : "Block"} ${name}`
      : `${match ? "Unblock" : "Block"} creator`;
    action.setAttribute("aria-label", `${match ? "Unblock" : "Block"} ${name}`);
    action.addEventListener("click", async () => {
      if (match) {
        await saveBlocked(Shared.removeEntriesMatchingRefs(blockedEntries, owner.refs));
        return;
      }
      const entry = Shared.createBlockedEntry(owner.refs, owner.displayName);
      await saveBlocked(Shared.mergeBlockedEntry(blockedEntries, entry));
    });
    elements.pageActions.append(action);
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
