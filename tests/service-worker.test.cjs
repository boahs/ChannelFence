"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");

function eventSlot() {
  return {
    listener: undefined,
    addListener(listener) {
      this.listener = listener;
    }
  };
}

function loadWorker(options = {}) {
  const calls = [];
  const events = {
    installed: eventSlot(),
    startup: eventSlot(),
    message: eventSlot(),
    tabUpdated: eventSlot()
  };
  const values = options.values || {
    cfEnabled: true,
    cfBlockedChannels: [{ aliases: ["handle:example"] }],
    cfHideComments: true
  };
  const chrome = {
    action: {
      setBadgeBackgroundColor: async (details) => calls.push(["background", details]),
      setBadgeText: async (details) => calls.push(["badge", details]),
      setTitle: async (details) => calls.push(["title", details])
    },
    runtime: {
      getURL: (value) => `chrome-extension://test/${value}`,
      onInstalled: events.installed,
      onMessage: events.message,
      onStartup: events.startup
    },
    storage: {
      local: {
        get: async () => values,
        set: async (details) => calls.push(["storage", details])
      }
    },
    tabs: {
      create: async () => undefined,
      onUpdated: events.tabUpdated
    }
  };
  const sandbox = {
    ChannelFenceShared: {
      DEFAULTS: values,
      STORAGE: {
        enabled: "cfEnabled",
        blocked: "cfBlockedChannels"
      },
      sanitizeBlockedEntries: options.sanitizeBlockedEntries || ((entries) => entries || [])
    },
    chrome,
    importScripts: () => undefined
  };

  vm.runInNewContext(
    fs.readFileSync(path.join(root, "src", "service-worker.js"), "utf8"),
    sandbox
  );
  return { calls, events };
}

test("uses a blank global badge and a count only for a YouTube sender tab", async () => {
  const { calls, events } = loadWorker();

  await events.installed.listener({ reason: "update" });
  const globalBadge = calls.find(([type]) => type === "badge");
  assert.equal(globalBadge[0], "badge");
  assert.equal(globalBadge[1].text, "");
  assert.equal(globalBadge[1].tabId, undefined);

  events.message.listener({ type: "CF_SYNC_ACTION" }, { tab: { id: 42 } });
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(calls.some(([type, details]) =>
    type === "badge" && details.text === "1" && details.tabId === 42));

  events.tabUpdated.listener(42, { status: "loading" });
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(calls.some(([type, details]) =>
    type === "badge" && details.text === "" && details.tabId === 42));
});

test("migrates canonical blocked-entry labels when the extension updates", async () => {
  const values = {
    cfEnabled: true,
    cfBlockedChannels: [{
      aliases: ["handle:@rokujones"],
      displayName: "Roku Jones",
      key: "handle:@rokujones"
    }],
    cfHideComments: true
  };
  const migrated = [{
    aliases: ["handle:@rokujones"],
    displayName: "rokujones",
    key: "handle:@rokujones",
    nameAliases: []
  }];
  const { calls, events } = loadWorker({
    values,
    sanitizeBlockedEntries: () => migrated
  });

  await events.installed.listener({ reason: "update" });

  assert.ok(calls.some(([type, details]) =>
    type === "storage" && details.cfBlockedChannels === migrated));
});
