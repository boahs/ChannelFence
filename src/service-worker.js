"use strict";

importScripts("shared.js");

const Shared = globalThis.ChannelFenceShared;

async function ensureDefaults() {
  const current = await chrome.storage.local.get(Object.keys(Shared.DEFAULTS));
  const patch = {};

  for (const [key, value] of Object.entries(Shared.DEFAULTS)) {
    if (typeof current[key] === "undefined") {
      patch[key] = value;
    }
  }

  if (Object.keys(patch).length > 0) {
    await chrome.storage.local.set(patch);
  }
}

async function badgeState() {
  const values = await chrome.storage.local.get([
    Shared.STORAGE.enabled,
    Shared.STORAGE.blocked
  ]);
  const enabled = values[Shared.STORAGE.enabled] !== false;
  const count = Shared.sanitizeBlockedEntries(values[Shared.STORAGE.blocked]).length;
  const badgeText = enabled && count > 0 ? (count > 999 ? "999+" : String(count)) : "";

  return { enabled, count, badgeText };
}

async function clearGlobalActionState() {
  await chrome.action.setBadgeBackgroundColor({ color: "#ff5f46" });
  await chrome.action.setBadgeText({ text: "" });
  await chrome.action.setTitle({ title: "ChannelFence" });
}

async function updateBadgeForTab(tabId) {
  if (!Number.isInteger(tabId)) {
    return;
  }
  const { enabled, count, badgeText } = await badgeState();

  await chrome.action.setBadgeBackgroundColor({ color: "#ff5f46", tabId });
  await chrome.action.setBadgeText({ text: badgeText, tabId });
  await chrome.action.setTitle({
    title: enabled ? `ChannelFence — ${count} blocked` : "ChannelFence — paused",
    tabId
  });
}

clearGlobalActionState().catch(() => undefined);

chrome.runtime.onInstalled.addListener(async (details) => {
  await ensureDefaults();
  await clearGlobalActionState();

  if (details.reason === "install") {
    await chrome.tabs.create({ url: chrome.runtime.getURL("ui/welcome.html") });
  }
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureDefaults();
  await clearGlobalActionState();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) {
    return false;
  }
  if (message.type === "CF_SYNC_ACTION" && Number.isInteger(sender.tab?.id)) {
    updateBadgeForTab(sender.tab.id).catch(() => undefined);
    return false;
  }
  return false;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status !== "loading") {
    return;
  }
  chrome.action.setBadgeText({ text: "", tabId }).catch(() => undefined);
  chrome.action.setTitle({ title: "ChannelFence", tabId }).catch(() => undefined);
});
