"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));

test("uses Manifest V3 with a narrow permission set", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ["storage"]);
  assert.equal(manifest.host_permissions, undefined);
  assert.deepEqual(manifest.content_scripts[0].matches, [
    "https://www.youtube.com/*",
    "https://m.youtube.com/*"
  ]);
});

test("manifest runtime files exist", () => {
  const paths = [
    manifest.background.service_worker,
    manifest.action.default_popup,
    manifest.options_ui.page,
    ...manifest.content_scripts[0].css,
    ...manifest.content_scripts[0].js,
    ...Object.values(manifest.icons),
    ...Object.values(manifest.action.default_icon)
  ];
  for (const relative of paths) {
    assert.ok(fs.existsSync(path.join(root, relative)), `Missing ${relative}`);
  }
});

test("extension pages do not use inline scripts or remote scripts", () => {
  const htmlFiles = fs.readdirSync(path.join(root, "ui"))
    .filter((file) => file.endsWith(".html"));

  for (const file of htmlFiles) {
    const html = fs.readFileSync(path.join(root, "ui", file), "utf8");
    assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/i, `${file} contains inline JavaScript`);
    assert.doesNotMatch(html, /<script[^>]+src=["']https?:/i, `${file} loads remote JavaScript`);
    assert.doesNotMatch(html, /\son[a-z]+\s*=/i, `${file} contains an inline event handler`);
  }
});

test("extension pages reference existing packaged assets", () => {
  const htmlFiles = fs.readdirSync(path.join(root, "ui"))
    .filter((file) => file.endsWith(".html"));

  for (const file of htmlFiles) {
    const html = fs.readFileSync(path.join(root, "ui", file), "utf8");
    for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/gi)) {
      const reference = match[1];
      if (/^(?:https?:|#)/i.test(reference)) {
        continue;
      }
      const resolved = path.resolve(root, "ui", reference);
      assert.ok(fs.existsSync(resolved), `${file} references missing asset ${reference}`);
    }
  }
});

test("manifest description fits the store summary limit", () => {
  assert.ok(manifest.description.length <= 132);
});

test("recognizes class-based YouTube lockups used by membership shelves", () => {
  const contentScript = fs.readFileSync(path.join(root, "src", "content.js"), "utf8");
  assert.match(contentScript, /"\.yt-lockup-view-model"/);
  assert.match(contentScript, /"\.yt-lockup-view-model--wrapper"/);
});
