"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { readNativeLockupCreator } = require("./e2e/fixtures/native-lockup-creator.ts");

const english = { creator: "Sample", goToChannel: "Go to channel Sample" };
function cardWithAvatar(label) {
  return { querySelector(selector) {
    assert.equal(selector, ".ytLockupMetadataViewModelAvatar [aria-label]");
    return label === null ? null : { getAttribute: () => label };
  } };
}

test("native movie creator is read independently of genre/year metadata", () => {
  assert.equal(readNativeLockupCreator(cardWithAvatar("Go to channel YouTube Movies"), english), "YouTube Movies");
});

test("native creator labels support localized prefixes, suffixes and both", () => {
  for (const [labels, label, expected] of [
    [{ creator: "مثال", goToChannel: "الانتقال إلى قناة مثال" }, "الانتقال إلى قناة قناة الأفلام", "قناة الأفلام"],
    [{ creator: "견본", goToChannel: "견본 채널로 이동" }, "영화 채널로 이동", "영화"],
    [{ creator: "mẫu", goToChannel: "Kênh mẫu. Chuyển đến kênh." }, "Kênh Phim. Chuyển đến kênh.", "Phim"]
  ]) {
    assert.equal(readNativeLockupCreator(cardWithAvatar(label), labels), expected);
    assert.equal(readNativeLockupCreator(cardWithAvatar("Go to channel YouTube Movies"), labels), "YouTube Movies");
  }
});

test("missing or unrecognized native identity does not become an inferred creator", () => {
  for (const label of [null, "", "Music 2024", "Block YouTube Movies", "Go to channel "]) {
    assert.equal(readNativeLockupCreator(cardWithAvatar(label), english), "");
  }
});
