"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const catalogs = Object.fromEntries(fs.readdirSync(path.join(root, "_locales")).map((locale) => [
  locale,
  JSON.parse(fs.readFileSync(path.join(root, "_locales", locale, "messages.json"), "utf8"))
]));
const helper = fs.readFileSync(path.join(root, "src", "i18n.js"), "utf8");

test("locales have complete messages and matching named substitutions", () => {
  assert.ok(catalogs.en);
  assert.ok(catalogs.ko);
  for (const [locale, messages] of Object.entries(catalogs)) {
    assert.deepEqual(Object.keys(messages).sort(), Object.keys(catalogs.en).sort(), locale);
    for (const [key, entry] of Object.entries(messages)) {
      const context = `${locale}/${key}`;
      assert.equal(typeof entry.message, "string", context);
      assert.ok(entry.message.trim(), context);
      assert.doesNotMatch(entry.message, /\$\d/, `${context} needs a named placeholder`);
      const references = [...entry.message.matchAll(/\$([a-z][a-z0-9_]*)\$/gi)]
        .map((match) => match[1].toLowerCase());
      const placeholders = entry.placeholders || {};
      assert.deepEqual([...new Set(references)].sort(), Object.keys(placeholders).sort(), context);
      assert.deepEqual(placeholders, catalogs.en[key].placeholders || {}, context);
      for (const placeholder of Object.values(placeholders)) {
        assert.match(placeholder.content, /^\$[1-9]$/, context);
      }
      if (placeholders.link) {
        assert.equal(references.filter((name) => name === "link").length, 1, context);
      }
    }
  }
});

test("runtime and page message references exist in the default catalog", () => {
  for (const directory of ["src", "ui"]) {
    for (const file of fs.readdirSync(path.join(root, directory)).filter((name) => /\.(js|html)$/.test(name))) {
      const source = fs.readFileSync(path.join(root, directory, file), "utf8");
      const keys = [...source.matchAll(/data-i18n(?:-(?:title|placeholder|aria-label|alt))?="([^"]+)"/g)]
        .map((match) => match[1]);
      for (const call of source.matchAll(/I18n\.get\(([^,)]*)/g)) {
        keys.push(...[...call[1].matchAll(/"([a-zA-Z0-9_]+)"/g)].map((match) => match[1]));
      }
      for (const key of keys) {
        assert.ok(catalogs.en[key], `${directory}/${file} references missing message ${key}`);
      }
    }
  }
});

test("content scripts leave YouTube language and DOM unchanged", () => {
  const document = {
    documentElement: { lang: "ko" },
    querySelectorAll() { assert.fail("YouTube must not be localized as an extension page"); }
  };
  const sandbox = {
    document,
    location: { protocol: "https:" },
    chrome: { i18n: { getMessage: (key) => catalogs.en[key].message } }
  };
  vm.runInNewContext(helper, sandbox);
  assert.equal(document.documentElement.lang, "ko");
  assert.equal(sandbox.ChannelFenceI18n.get("contentUndo"), "Undo");
});
