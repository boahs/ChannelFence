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

async function updateBadge() {
  const values = await chrome.storage.local.get([
    Shared.STORAGE.enabled,
    Shared.STORAGE.blocked
  ]);
  const enabled = values[Shared.STORAGE.enabled] !== false;
  const count = Shared.sanitizeBlockedEntries(values[Shared.STORAGE.blocked]).length;
  const badgeText = enabled && count > 0 ? (count > 999 ? "999+" : String(count)) : "";

  await chrome.action.setBadgeBackgroundColor({ color: "#ff5f46" });
  await chrome.action.setBadgeText({ text: badgeText });
  await chrome.action.setTitle({
    title: enabled ? `ChannelFence — ${count} blocked` : "ChannelFence — paused"
  });
}

chrome.runtime.onInstalled.addListener(async (details) => {
  await ensureDefaults();
  await updateBadge();

  if (details.reason === "install") {
    await chrome.tabs.create({ url: chrome.runtime.getURL("ui/welcome.html") });
  }
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureDefaults();
  await updateBadge();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") {
    return;
  }
  if (changes[Shared.STORAGE.enabled] || changes[Shared.STORAGE.blocked]) {
    updateBadge().catch(() => undefined);
  }
});
