"use strict";

const Shared = globalThis.ChannelFenceShared;
const I18n = globalThis.ChannelFenceI18n;
const elements = {
  enabled: document.getElementById("enabledToggle"),
  shorts: document.getElementById("shortsToggle"),
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
    unblock.textContent = I18n.get("unblock");
    unblock.setAttribute("aria-label", I18n.get("unblockNamed", Shared.labelForEntry(entry)));
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
    elements.pageTitle.textContent = I18n.get("noCreator");
    elements.pageCopy.textContent = I18n.get("openCreatorHelp");
    const action = document.createElement("button");
    action.className = "button button--primary";
    action.type = "button";
    action.textContent = I18n.get("blockCreator");
    action.disabled = true;
    elements.pageActions.append(action);
    return;
  }

  const owners = Array.isArray(pageContext.owners) && pageContext.owners.length > 0
    ? pageContext.owners
    : [{ refs: pageContext.refs, displayName: pageContext.displayName }];
  if (owners.length > 1) {
    elements.pageTitle.textContent = I18n.get("multipleCreators");
    elements.pageCopy.textContent = I18n.get("chooseCreator");
  } else {
    const owner = owners[0];
    const match = Shared.findMatchingEntry(blockedEntries, owner.refs);
    elements.pageTitle.textContent = owner.displayName || owner.refs[0]?.value || I18n.get("thisCreator");
    elements.pageCopy.textContent = match
      ? I18n.get("creatorIsBlocked")
      : I18n.get("creatorBlockHelp");
  }

  for (const owner of owners) {
    const match = Shared.findMatchingEntry(blockedEntries, owner.refs);
    const name = owner.displayName || owner.refs[0]?.value || I18n.get("creator");
    const action = document.createElement("button");
    action.type = "button";
    action.className = `button ${match ? "button--secondary" : "button--primary"}`;
    action.textContent = owners.length > 1
      ? I18n.get(match ? "unblockNamed" : "blockNamed", name)
      : I18n.get(match ? "unblockCreator" : "blockCreator");
    action.setAttribute("aria-label", I18n.get(match ? "unblockNamed" : "blockNamed", name));
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
  elements.status.textContent = elements.enabled.checked
    ? I18n.get("blockedCount", String(blockedEntries.length))
    : I18n.get("paused");
});

elements.shorts.addEventListener("change", async () => {
  await chrome.storage.local.set({ [Shared.STORAGE.hideHomeShorts]: elements.shorts.checked });
});

elements.openOptions.addEventListener("click", () => chrome.runtime.openOptionsPage());

async function initialize() {
  const values = await chrome.storage.local.get(Object.keys(Shared.DEFAULTS));
  blockedEntries = Shared.sanitizeBlockedEntries(values[Shared.STORAGE.blocked]);
  elements.enabled.checked = values[Shared.STORAGE.enabled] !== false;
  elements.shorts.checked = values[Shared.STORAGE.hideHomeShorts] === true;
  elements.status.textContent = elements.enabled.checked
    ? I18n.get("blockedCount", String(blockedEntries.length))
    : I18n.get("paused");
  renderBlockedList();
  await loadPageContext();
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
  if (changes[Shared.STORAGE.blocked]) {
    blockedEntries = Shared.sanitizeBlockedEntries(
      changes[Shared.STORAGE.blocked].newValue
    );
    elements.status.textContent = elements.enabled.checked
      ? I18n.get("blockedCount", String(blockedEntries.length))
      : I18n.get("paused");
    renderBlockedList();
    renderPageContext();
  }
});

initialize().catch(() => {
  elements.status.textContent = I18n.get("unavailable");
  renderPageContext();
});
