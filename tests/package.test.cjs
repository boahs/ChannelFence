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
    ...Object.values(manifest.action.default_icon),
    ...manifest.web_accessible_resources.flatMap((entry) => entry.resources)
  ];
  for (const relative of paths) {
    assert.ok(fs.existsSync(path.join(root, relative)), `Missing ${relative}`);
  }
});

test("exposes only the branded Shorts action icon to YouTube pages", () => {
  assert.deepEqual(manifest.web_accessible_resources, [{
    resources: ["assets/icons/channelfence-48.png"],
    matches: [
      "https://www.youtube.com/*",
      "https://m.youtube.com/*"
    ]
  }]);
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

test("localized manifest descriptions fit the store summary limit", () => {
  assert.equal(manifest.default_locale, "en");
  assert.equal(manifest.name, "__MSG_extensionName__");
  assert.equal(manifest.description, "__MSG_extensionDescription__");
  for (const locale of fs.readdirSync(path.join(root, "_locales"))) {
    const messages = JSON.parse(fs.readFileSync(
      path.join(root, "_locales", locale, "messages.json"), "utf8"
    ));
    assert.ok(messages.extensionName.message.length > 0, `${locale} has no extension name`);
    assert.ok(messages.extensionDescription.message.length <= 132, `${locale} summary is too long`);
  }
});

test("localization is loaded before runtime UI and included in release packages", () => {
  const contentScripts = manifest.content_scripts[0].js;
  assert.ok(contentScripts.includes("src/i18n.js"));
  assert.ok(contentScripts.indexOf("src/i18n.js") < contentScripts.indexOf("src/content.js"));
  for (const file of fs.readdirSync(path.join(root, "ui")).filter((name) => name.endsWith(".html"))) {
    const html = fs.readFileSync(path.join(root, "ui", file), "utf8");
    assert.match(html, /<script src="\.\.\/src\/i18n\.js" defer><\/script>/, file);
    const pageScript = `<script src="${file.replace(".html", ".js")}"`;
    if (html.includes(pageScript)) {
      assert.ok(html.indexOf("../src/i18n.js") < html.indexOf(pageScript), file);
    }
  }
  const packageScript = fs.readFileSync(path.join(root, "scripts", "package.ps1"), "utf8");
  assert.match(packageScript, /Copy-Item -LiteralPath \(Join-Path \$workspace "_locales"\) -Destination \$stage -Recurse/);
});

test("publishes the project homepage and keeps package versions aligned", () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  assert.equal(manifest.homepage_url, "https://channelfence.app/");
  assert.equal(packageJson.version, manifest.version);
});

test("growth asset captures follow the manifest version", () => {
  const captureScript = fs.readFileSync(
    path.join(root, "scripts", "capture-growth-assets.mjs"),
    "utf8"
  );
  const assetScript = fs.readFileSync(
    path.join(root, "scripts", "create-growth-assets.ps1"),
    "utf8"
  );

  assert.match(captureScript, /const version = manifest\.version/);
  assert.match(captureScript, /`Version \$\{expectedVersion\}`/);
  assert.match(captureScript, /`options-\$\{version\}-1280x800\.png`/);
  assert.match(captureScript, /`popup-hide-shorts-\$\{version\}\.png`/);
  assert.match(assetScript, /\$packageVersion = \$manifest\.version/);
  assert.match(assetScript, /"options-\$packageVersion-1280x800\.png"/);
  assert.match(assetScript, /"popup-hide-shorts-\$packageVersion\.png"/);
  assert.doesNotMatch(captureScript, /0\.2\.1/);
  assert.doesNotMatch(assetScript, /0\.2\.1/);
});

test("recognizes membership lockups and watch-page creator menus", () => {
  const contentScript = fs.readFileSync(path.join(root, "src", "content.js"), "utf8");
  assert.match(contentScript, /"\.yt-lockup-view-model"/);
  assert.match(contentScript, /"\.yt-lockup-view-model--wrapper"/);
  assert.match(contentScript, /control\.closest\("ytd-watch-metadata, ytd-video-primary-info-renderer"\)/);
  assert.match(contentScript, /LINKLESS_LOCKUP_CREATOR_ROW_SELECTOR/);
  assert.match(contentScript, /LINKLESS_LOCKUP_AVATAR_SELECTOR/);
});

test("creator menu item inherits YouTube's light or dark theme color", () => {
  const contentStyles = fs.readFileSync(path.join(root, "src", "content.css"), "utf8");
  const contentScript = fs.readFileSync(path.join(root, "src", "content.js"), "utf8");
  const menuRule = contentStyles.match(/\.cf-menu-item\s*\{([^}]*)\}/)?.[1] || "";
  assert.match(menuRule, /color:\s*var\(--cf-menu-text-color, inherit\)\s*!important/);
  assert.doesNotMatch(menuRule, /#0f0f0f/);
  assert.match(contentScript, /function nativeMenuTextColor\(host\)/);
  assert.match(contentScript, /button\.style\.setProperty\("--cf-menu-text-color", menuTextColor\)/);
});

test("compact Shorts metadata stays on YouTube and excludes account credentials", () => {
  const contentScript = fs.readFileSync(path.join(root, "src", "content.js"), "utf8");
  const privacyPolicy = fs.readFileSync(path.join(root, "PRIVACY.md"), "utf8");
  assert.match(contentScript, /new URL\("\/oembed", location\.origin\)/);
  assert.match(contentScript, /credentials: "omit"/);
  assert.match(contentScript, /cache: "force-cache"/);
  assert.match(privacyPolicy, /YouTube's oEmbed endpoint/);
});

test("scopes the blocked-count badge to YouTube tabs", () => {
  const worker = fs.readFileSync(path.join(root, "src", "service-worker.js"), "utf8");
  const contentScript = fs.readFileSync(path.join(root, "src", "content.js"), "utf8");
  assert.match(worker, /setBadgeText\(\{ text: "" \}\)/);
  assert.match(worker, /setBadgeText\(\{ text: badgeText, tabId \}\)/);
  assert.match(worker, /clearGlobalActionState\(\)\.catch/);
  assert.match(worker, /chrome\.tabs\.onUpdated\.addListener/);
  assert.match(worker, /changeInfo\.status !== "loading"/);
  assert.match(contentScript, /sendMessage\(\{ type: "CF_SYNC_ACTION" \}\)/);
});

test("processes YouTube renderer churn incrementally", () => {
  const contentScript = fs.readFileSync(path.join(root, "src", "content.js"), "utf8");
  const observerBody = contentScript.match(
    /const observer = new MutationObserver\(\(mutations\) => \{([\s\S]*?)\n  \}\);/
  )?.[1] || "";
  const menuContextBody = contentScript.match(
    /function rememberMenuContext\(event\) \{([\s\S]*?)function closeCreatorMenu/
  )?.[1] || "";

  assert.match(contentScript, /function flushMutationScan\(\)/);
  assert.match(observerBody, /scheduleMutationElement\(target\)/);
  assert.doesNotMatch(observerBody, /scheduleScan\(\)/);
  assert.match(menuContextBody, /scheduleMenuScan\(\)/);
  assert.doesNotMatch(menuContextBody, /scheduleScan\(\)/);
  assert.doesNotMatch(contentScript, /addEventListener\("yt-rendererstamper-finished"/);
});
