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
      getURL: (value) => `${options.eventPage ? "moz-extension" : "chrome-extension"}://test/${value}`,
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
      create: async (details) => calls.push(["tab", details]),
      onUpdated: events.tabUpdated
    }
  };
  const sandbox = {
    ChannelFenceI18n: {
      get: (key) => key,
      loadCatalog: async (language) => ({ language })
    },
    ChannelFenceShared: {
      DEFAULTS: values,
      STORAGE: {
        enabled: "cfEnabled",
        blocked: "cfBlockedChannels"
      },
      sanitizeBlockedEntries: options.sanitizeBlockedEntries || ((entries) => entries || [])
    },
    chrome
  };
  if (!options.eventPage) {
    sandbox.importScripts = (...scripts) => calls.push(["imports", scripts]);
  }

  vm.runInNewContext(
    fs.readFileSync(path.join(root, "src", "service-worker.js"), "utf8"),
    sandbox
  );
  return { calls, events };
}

for (const eventPage of [false, true]) {
  test(`${eventPage ? "event page" : "service worker"} starts and serves extension messages`, async () => {
    const { calls, events } = loadWorker({ eventPage });
    const imports = calls.filter(([type]) => type === "imports");
    assert.deepEqual(imports, eventPage ? [] : [["imports", ["shared.js", "i18n.js"]]]);

    await events.startup.listener();
    assert.ok(calls.some(([type, details]) => type === "badge" && details.text === ""));
    await events.installed.listener({ reason: "install" });
    assert.equal(calls.find(([type]) => type === "tab")[1].url,
      `${eventPage ? "moz-extension" : "chrome-extension"}://test/ui/welcome.html`);

    const catalog = await new Promise((resolve) => {
      assert.equal(events.message.listener({ type: "CF_GET_MESSAGES", language: "ar" }, {}, resolve), true);
    });
    assert.deepEqual(catalog, { language: "ar" });
    events.message.listener({ type: "CF_SYNC_ACTION" }, { tab: { id: 42 } });
    await new Promise((resolve) => setImmediate(resolve));
    assert.ok(calls.some(([type, details]) =>
      type === "badge" && details.text === "1" && details.tabId === 42));
  });
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
