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
        set: async (details) => {
          calls.push(["storage", details]);
          Object.assign(values, details);
        }
      }
    },
    tabs: {
      create: async (details) => calls.push(["tab", details]),
      onUpdated: events.tabUpdated
    }
  };
  const sandbox = {
    URL,
    ChannelFenceI18n: {
      get: (key) => key,
      loadCatalog: async (language) => ({ language })
    },
    chrome
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, "src", "shared.js"), "utf8"), sandbox);
  if (options.sanitizeBlockedEntries) {
    sandbox.ChannelFenceShared = {
      ...sandbox.ChannelFenceShared,
      sanitizeBlockedEntries: options.sanitizeBlockedEntries
    };
  }
  if (!options.eventPage) {
    sandbox.importScripts = (...scripts) => calls.push(["imports", scripts]);
  }

  vm.runInNewContext(
    fs.readFileSync(path.join(root, "src", "service-worker.js"), "utf8"),
    sandbox
  );
  return { calls, events, values };
}

async function syncAction(events, tabId) {
  events.message.listener({ type: "CF_SYNC_ACTION" }, { tab: { id: tabId } });
  await new Promise((resolve) => setImmediate(resolve));
}

function badgeText(calls, tabId) {
  return calls.filter(([type, details]) => type === "badge" && details.tabId === tabId).at(-1)?.[1].text;
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
    await syncAction(events, 42);
    assert.equal(badgeText(calls, 42), "");
  });
}

test("uses a blank global badge and a count only for a YouTube sender tab", async () => {
  const { calls, events, values } = loadWorker();
  values.cfShowBlockCount = true;

  await events.installed.listener({ reason: "update" });
  const globalBadge = calls.find(([type]) => type === "badge");
  assert.equal(globalBadge[0], "badge");
  assert.equal(globalBadge[1].text, "");
  assert.equal(globalBadge[1].tabId, undefined);

  await syncAction(events, 42);
  assert.equal(badgeText(calls, 42), "1");
  assert.equal(badgeText(calls, 99), undefined);

  events.tabUpdated.listener(42, { status: "loading" });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(badgeText(calls, 42), "");
});

test("defaults the badge off for fresh installs and existing lists without a preference", async () => {
  for (const values of [{}, { cfBlockedChannels: [{ aliases: ["handle:@example"] }] }]) {
    const worker = loadWorker({ values });
    await worker.events.installed.listener({ reason: "update" });
    assert.equal(values.cfShowBlockCount, false);
    await syncAction(worker.events, 42);
    assert.equal(badgeText(worker.calls, 42), "");
  }
});

test("keeps the explicit badge choice across updates and restarts", async () => {
  const worker = loadWorker();
  worker.values.cfShowBlockCount = true;
  await worker.events.installed.listener({ reason: "update" });
  await worker.events.startup.listener();
  assert.equal(worker.values.cfShowBlockCount, true);
  await syncAction(worker.events, 42);
  assert.equal(badgeText(worker.calls, 42), "1");

  worker.values.cfShowBlockCount = false;
  await worker.events.startup.listener();
  assert.equal(worker.values.cfShowBlockCount, false);
  await syncAction(worker.events, 42);
  assert.equal(badgeText(worker.calls, 42), "");
});

test("updates both YouTube tabs after badge, block-list, and pause changes", async () => {
  const { calls, events, values } = loadWorker();
  const changes = [
    [{ cfShowBlockCount: true }, "1"],
    [{ cfBlockedChannels: [{ aliases: ["handle:@one"] }, { aliases: ["handle:@two"] }] }, "2"],
    [{ cfBlockedChannels: [{ aliases: ["handle:@two"] }] }, "1"],
    [{ cfEnabled: false }, ""],
    [{ cfEnabled: true }, "1"],
    [{ cfShowBlockCount: false }, ""],
    [{ cfShowBlockCount: true }, "1"],
    [{ cfBlockedChannels: [] }, ""]
  ];
  for (const [patch, expected] of changes) {
    Object.assign(values, patch);
    // Each open YouTube content script requests its own action update on storage changes.
    for (const tabId of [42, 43]) {
      await syncAction(events, tabId);
      assert.equal(badgeText(calls, tabId), expected, JSON.stringify(patch));
    }
    assert.equal(badgeText(calls), "");
    assert.equal(badgeText(calls, 99), undefined);
  }
});

test("counts sanitized creator entries and caps the visible badge at 999+", async () => {
  const { calls, events, values } = loadWorker();
  values.cfShowBlockCount = true;
  values.cfBlockedChannels = [null, {}, { aliases: ["handle:@example"] }];
  await syncAction(events, 42);
  assert.equal(badgeText(calls, 42), "1");

  values.cfBlockedChannels = Array.from({ length: 1000 }, (_, index) => ({
    aliases: [`handle:@creator${index}`]
  }));
  await syncAction(events, 42);
  assert.equal(badgeText(calls, 42), "999+");
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
