"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const overrides = JSON.parse(fs.readFileSync(path.join(root, "scripts", "firefox-locales.json"), "utf8"));
const catalogs = Object.fromEntries(fs.readdirSync(path.join(root, "_locales")).map((locale) => [
  locale,
  JSON.parse(fs.readFileSync(path.join(root, "_locales", locale, "messages.json"), "utf8"))
]));

test("Firefox copy covers every Chrome-specific message in every supported language", () => {
  assert.deepEqual(Object.keys(overrides).sort(), Object.keys(catalogs).sort());
  for (const [locale, catalog] of Object.entries(catalogs)) {
    const chromeKeys = Object.keys(catalog).filter((key) => /chrome/i.test(catalog[key].message));
    assert.deepEqual(Object.keys(overrides[locale]).sort(), chromeKeys.sort(), locale);
    for (const [key, message] of Object.entries(overrides[locale])) {
      const context = `${locale}/${key}`;
      assert.equal(typeof message, "string", context);
      assert.ok(message.trim(), context);
      assert.doesNotMatch(message, /chrome|\uFFFD|\?{2,}/i, context);
      const placeholders = (text) => [...text.matchAll(/\$([a-z][a-z0-9_]*)\$/gi)]
        .map((match) => match[1].toLowerCase()).sort();
      assert.deepEqual(placeholders(message), placeholders(catalog[key].message), context);
    }
  }
});

test("Firefox copy preserves data handling disclosures and the existing support route", () => {
  for (const [locale, catalog] of Object.entries(catalogs)) {
    // Porting changes the browser name, not the behavior users consent to.
    for (const key of ["manualBlockHelp", "settingsPrivacy", "welcomePrivacy", "privacyStorage", "privacyControl"]) {
      assert.equal(overrides[locale][key], catalog[key].message.replaceAll("Chrome", "Firefox"), `${locale}/${key}`);
    }
    assert.match(overrides[locale].privacyContact, /\$LINK\$/);
    assert.doesNotMatch(overrides[locale].privacyContact, /https?:\/\/|Firefox Add-ons|addons\.mozilla\.org/i);
  }
});
