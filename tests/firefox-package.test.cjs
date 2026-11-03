"use strict";

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");

test("builds a separate validated Firefox package without changing Chrome sources", () => {
  const sourceManifest = fs.readFileSync(path.join(root, "manifest.json"), "utf8");
  const chromeManifest = JSON.parse(sourceManifest);
  execFileSync(process.execPath, ["scripts/build-firefox.mjs"], { cwd: root, stdio: "pipe" });
  const directory = path.join(root, "dist", `ChannelFence-${chromeManifest.version}-firefox`);
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, "manifest.json"), "utf8"));

  assert.equal(fs.readFileSync(path.join(root, "manifest.json"), "utf8"), sourceManifest);
  assert.equal(chromeManifest.background.service_worker, "src/service-worker.js");
  assert.equal(manifest.background.service_worker, undefined);
  assert.deepEqual(manifest.background.scripts, ["src/shared.js", "src/i18n.js", "src/service-worker.js"]);
  assert.equal(manifest.browser_specific_settings.gecko.id, "channelfence@channelfence.app");
  assert.deepEqual(manifest.browser_specific_settings.gecko.data_collection_permissions.required, ["websiteContent"]);
  assert.equal(manifest.browser_specific_settings.gecko_android, undefined);
  for (const key of ["version", "permissions", "content_scripts", "web_accessible_resources"]) {
    assert.deepEqual(manifest[key], chromeManifest[key], key);
  }
  assert.equal(manifest.host_permissions, undefined);
  assert.deepEqual(fs.readdirSync(directory).sort(), ["LICENSE", "_locales", "assets", "manifest.json", "src", "ui"]);
  for (const script of manifest.background.scripts) {
    assert.equal(fs.readFileSync(path.join(directory, script), "utf8"),
      fs.readFileSync(path.join(root, script), "utf8"));
  }
  const sourceLocales = fs.readdirSync(path.join(root, "_locales")).sort();
  assert.deepEqual(fs.readdirSync(path.join(directory, "_locales")).sort(), sourceLocales);
  for (const locale of sourceLocales) {
    const filename = path.join("_locales", locale, "messages.json");
    const source = JSON.parse(fs.readFileSync(path.join(root, filename), "utf8"));
    const packaged = JSON.parse(fs.readFileSync(path.join(directory, filename), "utf8"));
    assert.deepEqual(Object.keys(packaged).sort(), Object.keys(source).sort(), locale);
    assert.doesNotMatch(JSON.stringify(packaged), /Chrome/, locale);
    assert.match(source.welcomePrivacy.message, /Chrome/, locale);
  }
  for (const file of ["options.html", "welcome.html", "privacy.html"]) {
    const html = fs.readFileSync(path.join(directory, "ui", file), "utf8");
    assert.doesNotMatch(html, /Chrome|chromewebstore\.google\.com/, file);
  }
  const privacy = fs.readFileSync(path.join(directory, "ui", "privacy.html"), "utf8");
  assert.match(privacy, /href="https:\/\/github\.com\/boahs\/ChannelFence\/issues"/);
  assert.doesNotMatch(privacy, /\$LINK\$/);
  assert.ok(fs.statSync(`${directory}.zip`).size > 0);
});
