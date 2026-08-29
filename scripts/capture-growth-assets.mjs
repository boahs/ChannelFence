import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspace = path.resolve(scriptDirectory, "..");
const outputDirectory = path.join(workspace, "site", "assets", "source");
const userDataDirectory = await mkdtemp(path.join(tmpdir(), "channelfence-growth-assets-"));
const manifest = JSON.parse(await readFile(path.join(workspace, "manifest.json"), "utf8"));
const version = manifest.version;

await mkdir(outputDirectory, { recursive: true });

const context = await chromium.launchPersistentContext(userDataDirectory, {
  channel: "chromium",
  headless: true,
  viewport: { width: 1280, height: 800 },
  args: [
    `--disable-extensions-except=${workspace}`,
    `--load-extension=${workspace}`
  ]
});

try {
  let [serviceWorker] = context.serviceWorkers();
  serviceWorker ??= await context.waitForEvent("serviceworker");
  const extensionId = new URL(serviceWorker.url()).host;

  await serviceWorker.evaluate(async () => {
    await chrome.storage.local.clear();
    await chrome.storage.local.set({
      cfEnabled: true,
      cfHideComments: true,
      cfHideHomeShorts: true,
      cfBlockedChannels: [
        {
          key: "handle:@noisydaily",
          aliases: ["handle:@noisydaily"],
          displayName: "Noisy Daily",
          url: "https://www.youtube.com/@noisydaily",
          blockedAt: "2026-08-28T14:15:00.000Z"
        },
        {
          key: "handle:@spoilerchannel",
          aliases: ["handle:@spoilerchannel"],
          displayName: "Spoiler Channel",
          url: "https://www.youtube.com/@spoilerchannel",
          blockedAt: "2026-08-27T18:30:00.000Z"
        }
      ]
    });
  });

  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/ui/options.html`);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction((expectedVersion) => {
    return document.querySelector("#blockedCount")?.textContent?.trim() === "2" &&
      document.querySelector("#version")?.textContent?.trim() === `Version ${expectedVersion}` &&
      document.querySelector("#shortsToggle")?.checked === true &&
      document.body.textContent?.includes("noisydaily") &&
      document.body.textContent?.includes("spoilerchannel");
  }, version);
  await page.evaluate(async () => document.fonts?.ready);
  await page.screenshot({
    path: path.join(outputDirectory, `options-${version}-1280x800.png`),
    animations: "disabled"
  });

  await page.setViewportSize({ width: 430, height: 620 });
  await page.goto(`chrome-extension://${extensionId}/ui/popup.html`);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(() => {
    return document.querySelector("#blockedCount")?.textContent?.trim() === "2" &&
      document.querySelector("#shortsToggle")?.checked === true &&
      document.body.textContent?.includes("noisydaily") &&
      document.body.textContent?.includes("spoilerchannel");
  });
  await page.evaluate(async () => document.fonts?.ready);
  await page.screenshot({
    path: path.join(outputDirectory, `popup-hide-shorts-${version}.png`),
    animations: "disabled",
    fullPage: true
  });
} finally {
  await context.close().catch(() => undefined);
  await rm(userDataDirectory, { recursive: true, force: true }).catch(() => undefined);
}
