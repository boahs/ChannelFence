import { mkdir, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { blockedCreator } from "../../e2e/fixtures/extension.fixture";
import {
  expect, expectAttribute, expectContainsText, expectCount, expectText, expectValue, expectVisible,
  openExtensionPage, openExtensionTab, openOptions, test
} from "../extension.fixture";

test.describe("extension UI", () => {
  test("popup shows the block list and unblocks a creator", async ({ addon }) => {
    await addon.setStorage({ cfBlockedChannels: [blockedCreator("@alpha", "Alpha Creator")] });
    await openExtensionPage(addon.ui, `${addon.origin}/ui/popup.html`);
    await expectText(addon.ui, "#blockedCount", "1");
    await expectContainsText(addon.ui, "#recentList", "alpha");
    await expectAttribute(addon.ui, 'a[data-i18n="reportBug"]', "href",
      "https://github.com/boahs/ChannelFence/issues/new?template=bug_report.yml");
    await addon.ui.locator('button[aria-label="Unblock alpha"]').click();
    await expectText(addon.ui, "#blockedCount", "0");
    expect((await addon.getStorage("cfBlockedChannels")).cfBlockedChannels).toEqual([]);
  });

  test("options searches and updates the local block list", async ({ addon }) => {
    await addon.setStorage({ cfBlockedChannels: [
      blockedCreator("@alpha", "Alpha Creator"), blockedCreator("@beta", "Beta Creator")
    ] });
    await openOptions(addon);
    await expectText(addon.ui, "#blockedCount", "2");
    // The Firefox package deliberately removes the Chrome Store review link.
    await expectCount(addon.ui, '.review-note, a[href*="chromewebstore.google.com"]', 0);
    await addon.ui.locator("#searchInput").fill("beta");
    await expectContainsText(addon.ui, "#blockList", "beta");
    await expect.poll(() => addon.ui.$eval("#blockList", (list) => list.textContent)).not.toContain("alpha");
    await addon.ui.locator("#blockList button").click();
    await expectText(addon.ui, "#blockedCount", "1");
    const stored = await addon.getStorage<{ cfBlockedChannels: Array<{ displayName: string }> }>("cfBlockedChannels");
    expect(stored.cfBlockedChannels.map((entry) => entry.displayName)).toEqual(["alpha"]);
  });

  test("options pages a 500-creator list while keeping every entry searchable", async ({ addon }) => {
    await addon.setStorage({ cfBlockedChannels: Array.from({ length: 500 }, (_, index) =>
      blockedCreator(`@creator-${index}`, `Creator ${index}`)) });
    await openOptions(addon);
    await expectText(addon.ui, "#blockedCount", "500");
    await expectCount(addon.ui, "#blockList > li", 200);
    await expectText(addon.ui, "#listStatus", "Showing 200 of 500 matching creators.");
    await addon.ui.locator("#loadMoreButton").click();
    await expectCount(addon.ui, "#blockList > li", 400);
    await addon.ui.locator("#searchInput").fill("Creator 499");
    await expectCount(addon.ui, "#blockList > li", 1);
    await expectContainsText(addon.ui, "#blockList", "creator-499");
    await expectVisible(addon.ui, "#listPagination", false);
  });

  test("options toggles settings and imports a ChannelFence backup", async ({ addon }) => {
    await openOptions(addon);
    for (const id of ["enabledToggle", "commentsToggle", "shortsToggle"]) {
      await addon.ui.locator(`label:has(#${id})`).click();
    }
    // Firefox BiDi cannot set files on privileged extension pages. Pass a real
    // File through the unchanged file input and the extension's import handler.
    await addon.ui.$eval("input#importFile", (input, contents) => {
      const transfer = new DataTransfer();
      transfer.items.add(new File([contents], "channelfence-backup.json", { type: "application/json" }));
      input.files = transfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, JSON.stringify({ product: "ChannelFence", formatVersion: 1,
      blockedChannels: [blockedCreator("@imported", "Imported Creator")] }));
    await expectContainsText(addon.ui, "#toast", "Imported 1 creator");
    const stored = await addon.getStorage<{
      cfBlockedChannels: Array<{ displayName: string }>;
      cfEnabled: boolean; cfHideComments: boolean; cfHideHomeShorts: boolean;
    }>(["cfBlockedChannels", "cfEnabled", "cfHideComments", "cfHideHomeShorts"]);
    expect(stored).toMatchObject({ cfEnabled: false, cfHideComments: false, cfHideHomeShorts: true });
    expect(stored.cfBlockedChannels[0].displayName).toBe("imported");
  });

  test("popup toggles the Hide Shorts in feeds preference", async ({ addon }) => {
    await openExtensionPage(addon.ui, `${addon.origin}/ui/popup.html`);
    await expect.poll(() => addon.ui.$eval("input#shortsToggle", (input) => input.checked)).toBe(false);
    await addon.ui.locator("label:has(#shortsToggle)").click();
    await expect.poll(() => addon.ui.$eval("input#shortsToggle", (input) => input.checked)).toBe(true);
    expect((await addon.getStorage("cfHideHomeShorts")).cfHideHomeShorts).toBe(true);
  });

  test("keeps an open options tab and popup synchronized", async ({ addon }) => {
    await openOptions(addon);
    await expect.poll(() => addon.ui.$eval("input#shortsToggle", (input) => input.checked)).toBe(false);
    const popup = await openExtensionTab(addon, "/ui/popup.html");
    await popup.locator("label:has(#shortsToggle)").click();
    await expect.poll(() => popup.$eval("input#shortsToggle", (input) => input.checked)).toBe(true);
    await expect.poll(() => addon.ui.$eval("input#shortsToggle", (input) => input.checked)).toBe(true);
    await addon.ui.locator("label:has(#shortsToggle)").click();
    await expect.poll(() => addon.ui.$eval("input#shortsToggle", (input) => input.checked)).toBe(false);
    await expect.poll(() => popup.$eval("input#shortsToggle", (input) => input.checked)).toBe(false);
    await popup.close();
  });

  test("Home cleanup is opt-in and synchronizes without changing existing preferences", async ({ addon }) => {
    const existingPreferences = {
      cfEnabled: false, cfHideComments: false, cfHideHomeShorts: true,
      cfBlockedChannels: [blockedCreator("@kept", "Kept Creator")]
    };
    await addon.setStorage(existingPreferences);
    await openOptions(addon);
    await expect.poll(() => addon.ui.$eval("input#shortsToggle", (input) => input.checked)).toBe(true);
    const popup = await openExtensionTab(addon, "/ui/popup.html");
    await expect.poll(() => popup.$eval("input#shortsToggle", (input) => input.checked)).toBe(true);
    await expect.poll(() => addon.ui.$eval("select#compactHomeSizeSelect", (select) => select.disabled)).toBe(true);
    await expectVisible(popup, "#compactHomeSizeSelect", false);
    await expect.poll(() => popup.$eval("select#compactHomeSizeSelect", (select) => select.disabled)).toBe(true);
    await expectValue(addon.ui, "#compactHomeSizeSelect", "medium");
    await expectValue(popup, "#compactHomeSizeSelect", "medium");

    const toggles = ["homeAdsToggle", "homePromotionsToggle", "compactHomeGridToggle"];
    for (const id of toggles) {
      await expect.poll(() => addon.ui.$eval(`input#${id}`, (input) => input.checked)).toBe(false);
      await expect.poll(() => popup.$eval(`input#${id}`, (input) => input.checked)).toBe(false);
      await popup.locator(`label:has(#${id})`).click();
      await expect.poll(() => addon.ui.$eval(`input#${id}`, (input) => input.checked)).toBe(true);
      await expect.poll(() => popup.$eval(`input#${id}`, (input) => input.checked)).toBe(true);
    }
    await expect.poll(() => addon.ui.$eval("select#compactHomeSizeSelect", (select) => select.disabled)).toBe(false);
    await expectVisible(popup, "#compactHomeSizeSelect");
    await expect.poll(() => popup.$eval("select#compactHomeSizeSelect", (select) => select.disabled)).toBe(false);
    await popup.select("#compactHomeSizeSelect", "small");
    await expectValue(addon.ui, "#compactHomeSizeSelect", "small");
    await addon.ui.select("#compactHomeSizeSelect", "medium");
    await expectValue(popup, "#compactHomeSizeSelect", "medium");
    await popup.select("#compactHomeSizeSelect", "large");
    await expectValue(addon.ui, "#compactHomeSizeSelect", "large");
    expect(await addon.getStorage()).toMatchObject({ ...existingPreferences,
      cfHideHomeAds: true, cfHideHomePromotions: true, cfCompactHomeGrid: true, cfCompactHomeSize: "large" });

    await openOptions(addon);
    await openExtensionPage(popup, `${addon.origin}/ui/popup.html`);
    await expectVisible(popup, "#compactHomeSizeSelect");
    await expectValue(addon.ui, "#compactHomeSizeSelect", "large");
    await expectValue(popup, "#compactHomeSizeSelect", "large");
    for (const id of toggles) {
      await expect.poll(() => addon.ui.$eval(`input#${id}`, (input) => input.checked)).toBe(true);
      await expect.poll(() => popup.$eval(`input#${id}`, (input) => input.checked)).toBe(true);
      await addon.ui.locator(`label:has(#${id})`).click();
      await expect.poll(() => addon.ui.$eval(`input#${id}`, (input) => input.checked)).toBe(false);
      await expect.poll(() => popup.$eval(`input#${id}`, (input) => input.checked)).toBe(false);
    }
    await expect.poll(() => addon.ui.$eval("select#compactHomeSizeSelect", (select) => select.disabled)).toBe(true);
    await expectVisible(popup, "#compactHomeSizeSelect", false);
    await expect.poll(() => popup.$eval("select#compactHomeSizeSelect", (select) => select.disabled)).toBe(true);
    expect(await addon.getStorage()).toMatchObject({ ...existingPreferences,
      cfHideHomeAds: false, cfHideHomePromotions: false, cfCompactHomeGrid: false, cfCompactHomeSize: "large" });
    await popup.close();
  });

  test("an unsupported thumbnail size falls back to medium in both controls", async ({ addon }) => {
    await addon.setStorage({ cfCompactHomeGrid: true, cfCompactHomeSize: "unsupported" });
    await openOptions(addon);
    const popup = await openExtensionTab(addon, "/ui/popup.html");
    await expect.poll(() => addon.ui.$eval("select#compactHomeSizeSelect", (select) => select.disabled)).toBe(false);
    await expect.poll(() => popup.$eval("select#compactHomeSizeSelect", (select) => select.disabled)).toBe(false);
    await expectValue(addon.ui, "#compactHomeSizeSelect", "medium");
    await expectValue(popup, "#compactHomeSizeSelect", "medium");
    await addon.ui.select("#compactHomeSizeSelect", "small");
    await expectValue(popup, "#compactHomeSizeSelect", "small");
    await addon.setStorage({ cfCompactHomeSize: "unsupported" });
    await expectValue(addon.ui, "#compactHomeSizeSelect", "medium");
    await expectValue(popup, "#compactHomeSizeSelect", "medium");
    await popup.close();
  });

  test("options validates and manually blocks a YouTube handle", async ({ addon }) => {
    await openOptions(addon);
    await addon.ui.locator("#manualBlockInput").fill("not a handle");
    await addon.ui.locator("#manualBlockButton").click();
    await expectContainsText(addon.ui, "#toast", "Enter a valid YouTube handle");
    await expectText(addon.ui, "#blockedCount", "0");
    await addon.ui.locator("#manualBlockInput").fill("youtube.com/@ManualCreator/videos");
    await addon.ui.locator("#manualBlockButton").click();
    await expectText(addon.ui, "#blockedCount", "1");
    await expectText(addon.ui, "#blockList .block-list__name", "manualcreator");
    expect((await addon.getStorage("cfBlockedChannels")).cfBlockedChannels).toEqual([
      expect.objectContaining({ key: "handle:@manualcreator", displayName: "manualcreator" })
    ]);
    await addon.ui.locator("#manualBlockInput").fill("@ManualCreator");
    await addon.ui.locator("#manualBlockButton").click();
    await expectContainsText(addon.ui, "#toast", "already blocked");
    await expectText(addon.ui, "#blockedCount", "1");
  });

  test("exports a valid private block-list backup", async ({ addon }) => {
    await addon.setStorage({ cfBlockedChannels: [blockedCreator("@alpha", "Alpha Creator")] });
    await openOptions(addon);
    await mkdir(addon.downloadsPath, { recursive: true });
    await addon.ui.locator("#exportButton").click();
    const files = async () => (await readdir(addon.downloadsPath))
      .filter((filename) => /^channelfence-block-list-\d{4}-\d{2}-\d{2}\.json$/.test(filename));
    await expect.poll(files, { message: "Firefox downloads the block-list JSON" }).toHaveLength(1);
    const [filename] = await files();
    expect(filename).toMatch(/^channelfence-block-list-\d{4}-\d{2}-\d{2}\.json$/);
    await expect.poll(async () => {
      try {
        return JSON.parse(await readFile(path.join(addon.downloadsPath, filename), "utf8"));
      } catch (error) {
        // Firefox can create the download before finishing the JSON write.
        if (error instanceof SyntaxError) return null;
        throw error;
      }
    }).toMatchObject({ product: "ChannelFence", formatVersion: 1,
      blockedChannels: [expect.objectContaining({ displayName: "alpha" })] });
  });
});
