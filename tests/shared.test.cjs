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

test("normalizes manual handles and channel URLs without accepting video URLs", () => {
  assert.equal(Shared.normalizeManualChannelInput("@ExampleCreator").key, "handle:@examplecreator");
  assert.equal(Shared.normalizeManualChannelInput("ExampleCreator").key, "handle:@examplecreator");
  assert.equal(
    Shared.normalizeManualChannelInput("youtube.com/@ExampleCreator/videos").key,
    "handle:@examplecreator"
  );
  assert.equal(
    Shared.normalizeManualChannelInput("https://www.youtube.com/channel/UCabcDEF123").key,
    "channel:UCabcDEF123"
  );
  assert.equal(Shared.normalizeManualChannelInput("two words"), null);
  assert.equal(Shared.normalizeManualChannelInput("https:"), null);
  assert.equal(Shared.normalizeManualChannelInput("https://www.youtube.com/watch?v=abc"), null);
  assert.equal(Shared.normalizeManualChannelInput("https://example.com/@creator"), null);
});

test("creates and removes a display-name fallback entry for linkless lockups", () => {
  const ref = Shared.normalizeCreatorNameRef("Go to channel Right Rail Creator");
  const entry = Shared.createBlockedEntry([ref], "Right Rail Creator");

  assert.equal(entry.key, "name:right rail creator");
  assert.deepEqual([...entry.aliases], ["name:right rail creator"]);
  assert.equal(entry.url, "");
  assert.equal(
    Shared.findMatchingEntryByNames([entry], ["Right Rail Creator"]).key,
    "name:right rail creator"
  );
  assert.equal(Shared.removeEntriesMatchingRefs([entry], [ref]).length, 0);
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
  ], "Creator", undefined, ["/shorts/firstVideo"]);
  const second = Shared.createBlockedEntry([
    Shared.normalizeChannelRef("/@creator"),
    Shared.normalizeChannelRef("/channel/UCstable")
  ], "Creator", undefined, [
    "https://www.youtube.com/shorts/secondVideo?feature=share",
    "https://example.com/shorts/notYouTube"
  ]);

  const merged = Shared.mergeBlockedEntry([first], second);
  assert.equal(merged.length, 1);
  assert.deepEqual([...merged[0].aliases].sort(), ["channel:UCstable", "handle:@creator"]);
  assert.deepEqual(
    [...merged[0].shortPaths].sort(),
    ["/shorts/firstVideo", "/shorts/secondVideo"]
  );
});

test("keeps only valid user-selected Shorts paths", () => {
  assert.equal(
    Shared.normalizeShortPath("https://www.youtube.com/shorts/abc_DEF-123?feature=share"),
    "/shorts/abc_DEF-123"
  );
  assert.equal(Shared.normalizeShortPath("https://example.com/shorts/abc_DEF-123"), "");
  assert.equal(Shared.normalizeShortPath("/watch?v=abc_DEF-123"), "");
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

test("bulk-merges imported block lists with the same ordering and aliases", () => {
  const existing = [
    Shared.createBlockedEntry([Shared.normalizeChannelRef("/@alpha")], "Alpha"),
    Shared.createBlockedEntry([Shared.normalizeChannelRef("/@beta")], "Beta")
  ];
  const incoming = [
    Shared.createBlockedEntry([
      Shared.normalizeChannelRef("/@alpha"),
      Shared.normalizeChannelRef("/channel/UCalpha")
    ], "Alpha"),
    Shared.createBlockedEntry([Shared.normalizeChannelRef("/@gamma")], "Gamma")
  ];
  const legacy = incoming.reduce((entries, entry) => {
    return Shared.mergeBlockedEntry(entries, entry);
  }, existing);
  const bulk = Shared.mergeBlockedEntries(existing, incoming);

  assert.deepEqual(JSON.parse(JSON.stringify(bulk)), JSON.parse(JSON.stringify(legacy)));
  assert.deepEqual(
    [...bulk.find((entry) => entry.displayName === "Alpha").aliases].sort(),
    ["channel:UCalpha", "handle:@alpha"]
  );
});

test("bulk import preserves legacy behavior when aliases bridge old records", () => {
  const blockedAt = "2026-08-20T12:00:00.000Z";
  const entry = (paths, displayName, shortPath = "/shorts/abc123") => {
    return Shared.createBlockedEntry(
      paths.map((path) => Shared.normalizeChannelRef(path)),
      displayName,
      blockedAt,
      [shortPath]
    );
  };
  const existing = [
    entry(["/c/custom", "/@alpha"], "Blocked creator"),
    entry(["/user/legacy", "/@gamma", "/channel/UCalpha"], "Blocked creator"),
    entry(["/user/legacy"], "Alpha", "/shorts/def456")
  ];
  const incoming = [
    entry(["/channel/UCbeta", "/@beta"], "Beta", "/shorts/def456"),
    entry(["/@alpha", "/channel/UCalpha"], "Beta"),
    entry(["/@beta"], "Blocked creator"),
    entry(["/@alpha"], "Blocked creator"),
    null,
    entry(["/c/custom", "/user/legacy", "/@beta"], "Beta")
  ];
  const legacy = incoming.reduce((entries, candidate) => {
    return Shared.mergeBlockedEntry(entries, candidate);
  }, existing);

  assert.deepEqual(
    JSON.parse(JSON.stringify(Shared.mergeBlockedEntries(existing, incoming))),
    JSON.parse(JSON.stringify(legacy))
  );
});

test("indexes large block lists for constant-time feed matching", () => {
  const entries = Array.from({ length: 1_000 }, (_, index) => {
    return Shared.createBlockedEntry(
      [Shared.normalizeChannelRef(`/@creator-${index}`)],
      `Creator ${index}`,
      "2026-08-20T12:00:00.000Z",
      [`/shorts/clip_${String(index).padStart(4, "0")}`]
    );
  });
  const lookup = Shared.createBlockedLookup(entries);

  assert.equal(lookup.entries.length, 1_000);
  assert.equal(lookup.byAlias.size, 1_000);
  assert.equal(lookup.byName.size, 2_000);
  assert.equal(lookup.byShortPath.size, 1_000);
  assert.equal(
    Shared.findMatchingEntryInLookup(
      lookup,
      [Shared.normalizeChannelRef("/@creator-999")]
    ).displayName,
    "Creator 999"
  );
  assert.equal(
    Shared.findMatchingEntryInLookup(lookup, [], ["Creator 999"]).key,
    "handle:@creator-999"
  );
  assert.equal(
    lookup.byShortPath.get("/shorts/clip_0999").key,
    "handle:@creator-999"
  );

  let aliasProbes = 0;
  let nameProbes = 0;
  const trackedLookup = {
    ...lookup,
    byAlias: {
      get(key) {
        aliasProbes += 1;
        return lookup.byAlias.get(key);
      }
    },
    byName: {
      get(key) {
        nameProbes += 1;
        return lookup.byName.get(key);
      }
    }
  };
  assert.equal(
    Shared.findMatchingEntryInLookup(
      trackedLookup,
      [Shared.normalizeChannelRef("/@creator-999")]
    ).key,
    "handle:@creator-999"
  );
  assert.equal(aliasProbes, 1);
  assert.equal(nameProbes, 0);
});

test("indexed matching preserves block-list precedence for collaborations", () => {
  const alpha = Shared.createBlockedEntry(
    [Shared.normalizeChannelRef("/@alpha")],
    "Alpha"
  );
  const beta = Shared.createBlockedEntry(
    [Shared.normalizeChannelRef("/@beta")],
    "Beta"
  );
  const lookup = Shared.createBlockedLookup([alpha, beta]);

  assert.equal(
    Shared.findMatchingEntryInLookup(lookup, [
      Shared.normalizeChannelRef("/@beta"),
      Shared.normalizeChannelRef("/@alpha")
    ]).displayName,
    "Alpha"
  );
  assert.equal(
    Shared.findMatchingEntryInLookup(lookup, [], ["Beta", "Alpha"]).displayName,
    "Alpha"
  );
});

test("does not let a display name override a different stable creator identity", () => {
  const alpha = Shared.createBlockedEntry(
    [Shared.normalizeChannelRef("/@alpha")],
    "Same Name"
  );
  const lookup = Shared.createBlockedLookup([alpha]);

  assert.equal(
    Shared.findMatchingEntryInLookup(
      lookup,
      [Shared.normalizeChannelRef("/@beta")],
      ["Same Name"]
    ),
    null
  );
  assert.equal(
    Shared.findMatchingEntryInLookup(
      lookup,
      [
        Shared.normalizeChannelRef("/@beta"),
        Shared.normalizeCreatorNameRef("Same Name")
      ],
      ["Same Name"]
    ),
    null
  );
  assert.equal(
    Shared.findMatchingEntryInLookup(lookup, [], ["Same Name"]).key,
    "handle:@alpha"
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
