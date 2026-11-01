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

function loadI18n(options = {}) {
  const requests = [];
  let storageListener;
  const document = {
    documentElement: { lang: "ko" },
    querySelectorAll() { assert.fail("YouTube must not be localized as an extension page"); }
  };
  const sandbox = {
    document: options.worker ? undefined : document,
    location: { protocol: "https:" },
    fetch: async (url) => {
      requests.push(url);
      if (options.fetch) {
        return options.fetch(url);
      }
      const locale = url.split("/").at(-2);
      return { ok: true, json: async () => catalogs[locale] };
    },
    chrome: {
      i18n: { getMessage: (key) => catalogs[options.browserLanguage || "en"][key]?.message || "" },
      runtime: {
        getURL: (path) => `chrome-extension://test/${path}`,
        sendMessage: async (message) => {
          requests.push(message);
          return catalogs[message.language];
        }
      },
      storage: {
        local: { get: options.getStorage || (async () => ({ cfLanguage: options.language })) },
        onChanged: { addListener(listener) { storageListener = listener; } }
      }
    }
  };
  vm.runInNewContext(helper, sandbox);
  return {
    i18n: sandbox.ChannelFenceI18n,
    requests,
    document,
    change(language, area = "local") {
      storageListener({ cfLanguage: { newValue: language } }, area);
      return sandbox.ChannelFenceI18n.ready;
    }
  };
}

test("automatic language uses Chrome without loading catalogs or changing YouTube", async () => {
  const { i18n, document, requests } = loadI18n();
  await i18n.ready;
  assert.equal(document.documentElement.lang, "ko");
  assert.equal(i18n.get("contentUndo"), "Undo");
  assert.equal(i18n.language, "auto");
  assert.deepEqual(requests, []);
});

test("each override loads bundled text through the worker and preserves creator substitutions", async () => {
  for (const language of Object.keys(catalogs)) {
    const { i18n, requests, document } = loadI18n({ language });
    await i18n.ready;
    assert.equal(i18n.language, language);
    assert.equal(i18n.get("contentUndo"), catalogs[language].contentUndo.message);
    const creator = "作者 $& $1 $name$ <script>";
    const expected = catalogs[language].contentBlockNamed.message.replace(/\$creator\$/i, () => creator);
    assert.equal(i18n.get("contentBlockNamed", creator), expected);
    const expectedCounts = catalogs[language].showingCreators.message
      .replace(/\$visible\$/i, "2").replace(/\$total\$/i, "5");
    assert.equal(i18n.get("showingCreators", ["2", "5"]), expectedCounts);
    assert.equal(document.documentElement.lang, "ko");
    assert.equal(requests.length, 1);
    assert.equal(requests[0].type, "CF_GET_MESSAGES");
    assert.equal(requests[0].language, language);
  }
});

test("switching back to automatic restores Chrome's language and notifies open surfaces", async () => {
  const { i18n, change } = loadI18n({ browserLanguage: "ko", language: "ja" });
  await i18n.ready;
  const seen = [];
  i18n.onChange(() => seen.push(i18n.language));
  await change("ru", "sync");
  assert.equal(i18n.language, "ja");
  await change("ko");
  await change("auto");
  assert.equal(i18n.get("contentUndo"), catalogs.ko.contentUndo.message);
  assert.deepEqual(seen, ["ko", "auto"]);
});

test("only supported catalog paths can be read", async () => {
  const { i18n, requests } = loadI18n({ worker: true, language: "../private" });
  await i18n.ready;
  assert.equal(i18n.language, "auto");
  for (const invalid of ["auto", "../private", "https://example.com", "pl", null]) {
    assert.equal(await i18n.loadCatalog(invalid), null);
  }
  assert.equal(requests.length, 0);
  assert.equal(await i18n.loadCatalog("ja"), catalogs.ja);
  assert.deepEqual(requests, ["chrome-extension://test/_locales/ja/messages.json"]);
});

test("the latest preference wins when catalog reads finish out of order", async () => {
  const pending = {};
  const { i18n, change } = loadI18n({
    worker: true,
    fetch: (url) => new Promise((resolve) => { pending[url.split("/").at(-2)] = resolve; })
  });
  await i18n.ready;
  const japanese = change("ja");
  const russian = change("ru");
  pending.ru({ ok: true, json: async () => catalogs.ru });
  await russian;
  pending.ja({ ok: true, json: async () => catalogs.ja });
  await japanese;
  assert.equal(i18n.language, "ru");
  assert.equal(i18n.get("contentUndo"), catalogs.ru.contentUndo.message);
});

test("a startup storage result or failure cannot overwrite a newer preference", async () => {
  for (const fail of [false, true]) {
    let finishStorage;
    const { i18n, change } = loadI18n({
      getStorage: () => new Promise((resolve, reject) => {
        finishStorage = () => fail ? reject(new Error("Storage unavailable")) : resolve({ cfLanguage: "ja" });
      })
    });
    const initial = i18n.ready;
    await change("ru");
    finishStorage();
    await initial;
    assert.equal(i18n.language, "ru");
  }
});

test("unavailable storage or catalogs fall back to Chrome's messages", async () => {
  const storageFailure = loadI18n({ getStorage: async () => { throw new Error("Storage unavailable"); } });
  await storageFailure.i18n.ready;
  assert.equal(storageFailure.i18n.get("contentUndo"), "Undo");
  const catalogFailure = loadI18n({ worker: true, language: "ru", fetch: async () => ({ ok: false }) });
  await catalogFailure.i18n.ready;
  assert.equal(catalogFailure.i18n.language, "auto");
  assert.equal(catalogFailure.i18n.get("contentUndo"), "Undo");
});
