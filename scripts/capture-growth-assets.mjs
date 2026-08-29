import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspace = path.resolve(scriptDirectory, "..");
const outputDirectory = path.join(workspace, "site", "assets", "source");
const userDataDirectory = await mkdtemp(path.join(tmpdir(), "channelfence-growth-assets-"));

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
  await page.waitForFunction(() => {
    return document.querySelector("#blockedCount")?.textContent?.trim() === "2" &&
      document.querySelector("#version")?.textContent?.trim() === "Version 0.2.1" &&
      document.querySelector("#shortsToggle")?.checked === true &&
      document.body.textContent?.includes("Noisy Daily") &&
      document.body.textContent?.includes("Spoiler Channel");
  });
  await page.evaluate(async () => document.fonts?.ready);
  await page.screenshot({
    path: path.join(outputDirectory, "options-0.2.1-1280x800.png"),
    animations: "disabled"
  });

  await page.setViewportSize({ width: 430, height: 620 });
  await page.goto(`chrome-extension://${extensionId}/ui/popup.html`);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(() => {
    return document.querySelector("#blockedCount")?.textContent?.trim() === "2" &&
      document.querySelector("#shortsToggle")?.checked === true &&
      document.body.textContent?.includes("Noisy Daily") &&
      document.body.textContent?.includes("Spoiler Channel");
  });
  await page.evaluate(async () => document.fonts?.ready);
  await page.screenshot({
    path: path.join(outputDirectory, "popup-hide-shorts-0.2.1.png"),
    animations: "disabled",
    fullPage: true
  });
} finally {
  await context.close().catch(() => undefined);
  await rm(userDataDirectory, { recursive: true, force: true }).catch(() => undefined);
}
