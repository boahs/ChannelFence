"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const siteOrigin = "https://channelfence.app";
const channelFenceStoreId = "koeingndpmmgabfoihkcoikiopgkjenm";
const publicPages = [
  { file: "index.html", canonical: `${siteOrigin}/` },
  {
    file: "how-to-block-youtube-channels-in-chrome/index.html",
    canonical: `${siteOrigin}/how-to-block-youtube-channels-in-chrome/`
  },
  {
    file: "youtube-dont-recommend-channel-vs-block/index.html",
    canonical: `${siteOrigin}/youtube-dont-recommend-channel-vs-block/`
  },
  {
    file: "how-to-hide-youtube-shorts-in-chrome/index.html",
    canonical: `${siteOrigin}/how-to-hide-youtube-shorts-in-chrome/`
  },
  {
    file: "channelfence-vs-blocktube/index.html",
    canonical: `${siteOrigin}/channelfence-vs-blocktube/`
  },
  {
    file: "support/index.html",
    canonical: `${siteOrigin}/support/`
  }
];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "i"));
  return match?.[1] || "";
}

function canonicalUrl(html) {
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    if (attribute(match[0], "rel").toLowerCase() === "canonical") {
      return attribute(match[0], "href");
    }
  }
  return "";
}

function metaContent(html, attributeName, attributeValue) {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    if (attribute(match[0], attributeName).toLowerCase() === attributeValue.toLowerCase()) {
      return attribute(match[0], "content");
    }
  }
  return "";
}

function jsonLdDocuments(html) {
  const documents = [];
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (attribute(match[1], "type").toLowerCase() === "application/ld+json") {
      documents.push(JSON.parse(match[2]));
    }
  }
  return documents;
}

function schemaNodes(documents) {
  return documents.flatMap((document) => {
    if (Array.isArray(document)) {
      return document;
    }
    if (Array.isArray(document?.["@graph"])) {
      return document["@graph"];
    }
    return [document];
  });
}

function channelFenceStoreUrls(html) {
  return [...html.matchAll(/https:\/\/chromewebstore\.google\.com\/[^\s"'<>]+/gi)]
    .map((match) => match[0].replaceAll("&amp;", "&"))
    .map((value) => new URL(value))
    .filter((url) => url.pathname.includes(channelFenceStoreId));
}

test("publishes canonical URLs for every public HTML page", () => {
  for (const page of publicPages) {
    const absolutePath = path.join(root, page.file);
    assert.ok(fs.existsSync(absolutePath), `Missing public page ${page.file}`);
    assert.equal(canonicalUrl(read(page.file)), page.canonical, page.file);
  }
});

test("public pages expose a complete large social-card image", () => {
  const expectedImage = `${siteOrigin}/marketing/assets/youtube-thumbnail-1280x720-v2.png`;

  for (const page of publicPages) {
    const html = read(page.file);
    assert.equal(metaContent(html, "property", "og:image"), expectedImage, page.file);
    assert.equal(metaContent(html, "property", "og:image:width"), "1280", page.file);
    assert.equal(metaContent(html, "property", "og:image:height"), "720", page.file);
    assert.ok(metaContent(html, "property", "og:image:alt"), `${page.file} lacks og:image:alt`);
    assert.equal(metaContent(html, "name", "twitter:image"), expectedImage, page.file);
    assert.ok(metaContent(html, "name", "twitter:image:alt"), `${page.file} lacks twitter:image:alt`);
  }
});

test("homepage structured data identifies version 0.2.1 and includes FAQ schema", () => {
  const nodes = schemaNodes(jsonLdDocuments(read("index.html")));
  const software = nodes.find((node) => node?.["@type"] === "SoftwareApplication");
  const faq = nodes.find((node) => node?.["@type"] === "FAQPage");

  assert.ok(software, "Missing SoftwareApplication JSON-LD");
  assert.equal(software.softwareVersion, "0.2.1");
  assert.ok(faq, "Missing FAQPage JSON-LD");
  assert.ok(Array.isArray(faq.mainEntity) && faq.mainEntity.length > 0, "FAQPage has no questions");
});

test("support page publishes contact routes and current software schema", () => {
  const html = read("support/index.html");
  const nodes = schemaNodes(jsonLdDocuments(html));
  const software = nodes.find((node) => node?.["@type"] === "SoftwareApplication");

  assert.ok(software, "Support page is missing SoftwareApplication JSON-LD");
  assert.equal(software.softwareVersion, "0.2.1");
  assert.match(html, /mailto:support@channelfence\.app/i);
  assert.match(html, /https:\/\/github\.com\/boahs\/ChannelFence\/issues/i);
  assert.match(read("index.html"), /href=["']support\/["']/i);
});

test("every public ChannelFence Store link carries complete campaign attribution", () => {
  for (const page of publicPages) {
    const urls = channelFenceStoreUrls(read(page.file));
    assert.ok(urls.length > 0, `${page.file} has no ChannelFence Store link`);

    for (const url of urls) {
      assert.ok(url.searchParams.get("utm_source"), `${page.file} Store link lacks utm_source`);
      assert.ok(url.searchParams.get("utm_medium"), `${page.file} Store link lacks utm_medium`);
      assert.equal(url.searchParams.get("utm_campaign"), "30day_growth", page.file);
      assert.ok(url.searchParams.get("utm_content"), `${page.file} Store link lacks utm_content`);
    }
  }
});

test("sitemap includes the homepage, privacy policy, and all intent pages", () => {
  const sitemap = read("sitemap.xml");
  const expectedUrls = [
    `${siteOrigin}/`,
    `${siteOrigin}/PRIVACY.html`,
    ...publicPages.slice(1).map((page) => page.canonical)
  ];

  for (const url of expectedUrls) {
    assert.match(sitemap, new RegExp(`<loc>\\s*${url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*</loc>`), url);
  }
});

test("robots.txt points crawlers at the ChannelFence sitemap", () => {
  assert.match(read("robots.txt"), /^Sitemap:\s*https:\/\/channelfence\.app\/sitemap\.xml\s*$/im);
});

test("public website pages remain free of analytics and tag-manager references", () => {
  const trackerPattern = /(?:\bgtag\s*\(|googletagmanager|google-analytics)/i;
  for (const page of publicPages) {
    assert.doesNotMatch(read(page.file), trackerPattern, `${page.file} contains a tracker reference`);
  }
});

test("domain cutover publishes the verified ChannelFence hostname", () => {
  assert.equal(read("CNAME").trim(), "channelfence.app");
  const manifest = JSON.parse(read("manifest.json"));
  assert.equal(manifest.homepage_url, "https://channelfence.app/");
});
