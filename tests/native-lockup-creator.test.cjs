"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { readNativeLockupCreator } = require("./e2e/fixtures/native-lockup-creator.ts");
const { rightRailLockup } = require("./e2e/fixtures/youtube-fixtures.ts");

const english = { creator: "Sample", goToChannel: "Go to channel Sample" };
function cardWithAvatar(label) {
  return { querySelector(selector) {
    assert.equal(selector, ".ytLockupMetadataViewModelAvatar [aria-label]:not(.cf-block-button)");
    return label === null ? null : { getAttribute: () => label };
  } };
}

test("native movie creator is read independently of genre/year metadata", () => {
  assert.equal(readNativeLockupCreator(cardWithAvatar("Go to channel YouTube Movies"), english), "YouTube Movies");
});

test("ignores a ChannelFence control placed before the native avatar", () => {
  const root = { querySelector(selector) {
    if (selector === ".ytLockupMetadataViewModelAvatar [aria-label]") {
      return { getAttribute: () => "Block YouTube Movies" };
    }
    return cardWithAvatar("Go to channel YouTube Movies").querySelector(selector);
  } };
  assert.equal(readNativeLockupCreator(root, english), "YouTube Movies");
});

test("native creator labels use the localized wording captured from YouTube", () => {
  for (const [goToChannel, label, expected] of [
    ["Sample 채널로 이동", "영화 채널로 이동", "영화"],
    ["チャンネル「Sample」に移動します", "チャンネル「Rick Astley」に移動します", "Rick Astley"],
    ['Перейти на канал "Sample"', 'Перейти на канал "11Alive"', "11Alive"],
    ["Accéder à la chaîne Sample", "Accéder à la chaîne ZABREMO.", "ZABREMO."],
    ["Sample पर जाएं", "Rick Astley पर जाएं", "Rick Astley"],
    ["Buka channel Sample", "Buka channel a-ha", "a-ha"],
    ["Sample চ্যানেলে যান", "Yeamlak Abebayehu চ্যানেলে যান", "Yeamlak Abebayehu"],
    ["Kanala git: Sample", "Kanala git: Retro Pulse", "Retro Pulse"],
    ["Chuyển đến kênh Sample", "Chuyển đến kênh PHÒNG TRÀ VIP88", "PHÒNG TRÀ VIP88"],
    ['الانتقال إلى قناة "Sample"', 'الانتقال إلى قناة "Rick Astley"', "Rick Astley"],
    ["Naar kanaal Sample", "Naar kanaal Pure 80s Retro", "Pure 80s Retro"]
  ]) {
    const labels = { creator: "Sample", goToChannel };
    assert.equal(readNativeLockupCreator(cardWithAvatar(label), labels), expected);
    assert.equal(readNativeLockupCreator(cardWithAvatar("Go to channel YouTube Movies"), labels), "YouTube Movies");
  }
});

test("creator whitespace is normalized without changing meaningful punctuation", () => {
  assert.equal(readNativeLockupCreator(cardWithAvatar("前往頻道：Kenshi Yonezu  米津玄師"),
    { creator: "Sample", goToChannel: "前往頻道：Sample" }), "Kenshi Yonezu 米津玄師");
  assert.equal(readNativeLockupCreator(cardWithAvatar(" Go to channel  Creator\t&\nFriends. "), english), "Creator & Friends.");
});

test("only YouTube template quotes are removed, preserving quotes in creator names", () => {
  for (const [goToChannel, label, expected] of [
    ['Перейти на канал "Sample"', 'Перейти на канал ""Quoted Creator""', '"Quoted Creator"'],
    ['الانتقال إلى قناة "Sample"', 'الانتقال إلى قناة ""Quoted Creator""', '"Quoted Creator"'],
    ["チャンネル「Sample」に移動します", "チャンネル「「Quoted Creator」」に移動します", "「Quoted Creator」"],
    ["Go to channel Sample", 'Go to channel "Quoted Creator"', '"Quoted Creator"']
  ]) {
    assert.equal(readNativeLockupCreator(cardWithAvatar(label), { creator: "Sample", goToChannel }), expected);
  }
});

test("native avatar labels are escaped when rendered in a lockup fixture", () => {
  const card = rightRailLockup({ displayName: "Creator", id: "quoted-avatar", avatarLabel: 'الانتقال إلى قناة "Creator & Friends"' });
  assert.ok(card.includes('aria-label="الانتقال إلى قناة &quot;Creator &amp; Friends&quot;"'));
  assert.ok(rightRailLockup({ displayName: '"Creator"', id: "default-avatar" })
    .includes('aria-label="Go to channel &quot;Creator&quot;"'));
});

test("missing or unrecognized native identity does not become an inferred creator", () => {
  for (const label of [null, "", "Music 2024", "Block YouTube Movies", "Go to channel "]) {
    assert.equal(readNativeLockupCreator(cardWithAvatar(label), english), "");
  }
});
