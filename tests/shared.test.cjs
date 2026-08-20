"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "src", "shared.js"), "utf8");
const sandbox = { URL };
sandbox.globalThis = sandbox;
vm.runInNewContext(source, sandbox, { filename: "shared.js" });
const Shared = sandbox.ChannelFenceShared;

test("normalizes supported YouTube channel paths", () => {
  assert.equal(
    Shared.normalizeChannelRef("https://www.youtube.com/@ExampleCreator/videos").key,
    "handle:@examplecreator"
  );
  assert.equal(
    Shared.normalizeChannelRef("/channel/UCabcDEF123", "https://www.youtube.com/watch?v=1").key,
    "channel:UCabcDEF123"
  );
  assert.equal(
    Shared.normalizeChannelRef("https://m.youtube.com/user/SomeName").key,
    "user:somename"
  );
  assert.equal(
    Shared.normalizeChannelRef("https://www.youtube.com/c/CustomName").key,
    "custom:customname"
  );
});

test("rejects unrelated and non-channel links", () => {
  assert.equal(Shared.normalizeChannelRef("https://example.com/@creator"), null);
  assert.equal(Shared.normalizeChannelRef("https://www.youtube.com/watch?v=abc"), null);
  assert.equal(Shared.normalizeChannelRef("javascript:alert(1)"), null);
});

test("creates one entry with stable channel id preferred over handle", () => {
  const entry = Shared.createBlockedEntry([
    Shared.normalizeChannelRef("https://www.youtube.com/@Creator"),
    Shared.normalizeChannelRef("https://www.youtube.com/channel/UC123")
  ], "  Example   Creator  ", "2026-08-20T00:00:00.000Z");

  assert.equal(entry.key, "channel:UC123");
  assert.equal(entry.displayName, "Example Creator");
  assert.deepEqual([...entry.aliases].sort(), ["channel:UC123", "handle:@creator"]);
});

test("merges aliases into an existing block without duplication", () => {
  const first = Shared.createBlockedEntry([
    Shared.normalizeChannelRef("/@creator")
  ], "Creator");
  const second = Shared.createBlockedEntry([
    Shared.normalizeChannelRef("/@creator"),
    Shared.normalizeChannelRef("/channel/UCstable")
  ], "Creator");

  const merged = Shared.mergeBlockedEntry([first], second);
  assert.equal(merged.length, 1);
  assert.deepEqual([...merged[0].aliases].sort(), ["channel:UCstable", "handle:@creator"]);
});

test("removes entries by any known alias", () => {
  const entry = Shared.createBlockedEntry([
    Shared.normalizeChannelRef("/@creator"),
    Shared.normalizeChannelRef("/channel/UCstable")
  ], "Creator");

  const result = Shared.removeEntriesMatchingRefs([entry], [
    Shared.normalizeChannelRef("/@creator")
  ]);
  assert.equal(result.length, 0);
});

test("sanitizes malformed imported records", () => {
  const entries = Shared.sanitizeBlockedEntries([
    { key: "handle:@valid", aliases: ["handle:@valid"], displayName: "Valid" },
    { key: "invalid" },
    null,
    { url: "https://example.com/@wrong" }
  ]);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].key, "handle:@valid");
});

test("normalizes owner labels and matches an entry by exact creator name", () => {
  assert.equal(
    Shared.normalizeCreatorName("  Go to channel @JacobFuckingJones  "),
    "jacobfuckingjones"
  );

  const stableIdOnly = Shared.createBlockedEntry([
    Shared.normalizeChannelRef("/channel/UCstable")
  ], "jacobfuckingjones");

  assert.equal(
    Shared.findMatchingEntryByNames([stableIdOnly], ["@jacobfuckingjones"]).key,
    "channel:UCstable"
  );
  assert.equal(
    Shared.findMatchingEntryByNames([stableIdOnly], ["A different creator"]),
    null
  );
});

test("rejects video durations as creator labels and recovers the channel handle", () => {
  assert.equal(Shared.cleanCreatorDisplayName("8:41"), "");
  assert.equal(Shared.cleanCreatorDisplayName("1:40:36"), "");
  assert.equal(Shared.cleanCreatorDisplayName("Channel 8:41"), "Channel 8:41");

  const entry = Shared.createBlockedEntry([
    Shared.normalizeChannelRef("/channel/UCstable"),
    Shared.normalizeChannelRef("/@SailorMoon4Life")
  ], "40:36");

  assert.equal(entry.displayName, "@sailormoon4life");
  assert.equal(Shared.labelForEntry({
    key: "channel:UCstable",
    aliases: ["channel:UCstable", "handle:@sailormoon4life"],
    displayName: "40:36"
  }), "@sailormoon4life");
});
