import { type Page } from "puppeteer-core";
import { blockedCreator } from "../../e2e/fixtures/extension.fixture";
import { appearanceFeed, creatorCard } from "../../e2e/fixtures/youtube-fixtures";
import {
  activateExtensionPage, expect, expectAttribute, expectCount, expectCSS, expectValue, expectVisible,
  openFixture, openOptions, test
} from "../extension.fixture";
import { captureExtensionDom } from "../locale-checks";

async function expectPlacement(page: Page, position: "before" | "after", direction = "ltr"): Promise<void> {
  await page.bringToFront();
  await expect.poll(() => page.$$eval(".creator-link", (links, { position, direction }) => links.map((link) => {
    const card = link.closest("ytd-rich-item-renderer")!;
    const button = card.querySelector<HTMLButtonElement>(".cf-block-button");
    if (!button) return { ready: false };
    const name = link.getBoundingClientRect();
    const bounds = button.getBoundingClientRect();
    const outer = card.getBoundingClientRect();
    const statistics = card.querySelector(".statistics")!.getBoundingClientRect();
    const buttonOnLeft = position === "before" ? direction === "ltr" : direction === "rtl";
    return {
      ready: true,
      singleButton: card.querySelectorAll(".cf-block-button").length === 1,
      correctSide: buttonOnLeft ? bounds.right <= name.left + 1 : bounds.left >= name.right - 1,
      nameVisible: name.width > 1 && name.left >= outer.left - 1 && name.right <= outer.right + 1,
      buttonVisible: bounds.width >= 20 && bounds.left >= outer.left - 1 && bounds.right <= outer.right + 1 &&
        button.contains(document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)),
      statisticsVisible: statistics.left >= outer.left - 1 && statistics.right <= outer.right + 1
    };
  }), { position, direction }), { message: `Both creator controls fit and appear ${position} the name on ${direction} YouTube` })
    .toEqual(Array.from({ length: 2 }, () => ({
      ready: true, singleButton: true, correctSide: true, nameVisible: true, buttonVisible: true, statisticsVisible: true
    })));
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
}

test("defaults appearance settings and updates open tabs while preserving saved choices", async ({ addon }, testInfo) => {
  // Model an existing installation without either new preference.
  await addon.ui.evaluate("browser.storage.local.remove(['cfBlockButtonPosition', 'cfShowBlockCount'])");
  await addon.setStorage({ cfBlockedChannels: [blockedCreator("@savedcreator", "Saved Creator")] });
  await openOptions(addon);
  await expectValue(addon.ui, "#blockButtonPositionSelect", "before");
  expect(await addon.ui.$eval("#showBlockCountToggle", (input) => (input as HTMLInputElement).checked)).toBe(false);

  const first = addon.page;
  const second = await addon.browser.newPage();
  await openFixture(first, appearanceFeed(), "/");
  await openFixture(second, appearanceFeed(), "/");
  await expectPlacement(first, "before");
  const firstTabId = await addon.ui.evaluate(
    "browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => tab.id)"
  );
  await expectPlacement(second, "before");
  const secondTabId = await addon.ui.evaluate(
    "browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => tab.id)"
  );
  const badges = () => addon.ui.evaluate<string[]>(
    `Promise.all([${firstTabId}, ${secondTabId}].map(tabId => browser.action.getBadgeText({ tabId })))`
  );
  await expect.poll(badges).toEqual(["", ""]);

  await addon.ui.select("#blockButtonPositionSelect", "after");
  await expectPlacement(first, "after");
  await expectPlacement(second, "after");
  await activateExtensionPage(addon.ui);
  await addon.ui.locator("label:has(#showBlockCountToggle)").click();
  await expect.poll(() => addon.ui.$eval("#showBlockCountToggle", (input) => (input as HTMLInputElement).checked)).toBe(true);
  await expect.poll(badges).toEqual(["1", "1"]);
  await addon.setStorage({ cfBlockedChannels: [
    blockedCreator("@savedcreator", "Saved Creator"), blockedCreator("@anothercreator", "Another Creator")
  ] });
  await expect.poll(badges).toEqual(["2", "2"]);

  await openOptions(addon);
  await expectValue(addon.ui, "#blockButtonPositionSelect", "after");
  expect(await addon.ui.$eval("#showBlockCountToggle", (input) => (input as HTMLInputElement).checked)).toBe(true);
  await first.reload();
  await expectPlacement(first, "after");
  await expect.poll(badges).toEqual(["2", "2"]);
  await activateExtensionPage(addon.ui);
  await addon.ui.locator("label:has(#showBlockCountToggle)").click();
  await expect.poll(badges).toEqual(["", ""]);
  await openOptions(addon);
  expect(await addon.ui.$eval("#showBlockCountToggle", (input) => (input as HTMLInputElement).checked)).toBe(false);
  expect(await addon.getStorage(["cfBlockButtonPosition", "cfShowBlockCount"]))
    .toEqual({ cfBlockButtonPosition: "after", cfShowBlockCount: false });
  await captureExtensionDom(addon.ui, testInfo, "appearance-settings");
  await addon.setStorage({ cfBlockButtonPosition: "unknown-position" });
  await expectValue(addon.ui, "#blockButtonPositionSelect", "before");
  await expectPlacement(first, "before");
  await expectPlacement(second, "before");
  await second.close();
});

for (const size of ["small", "medium", "large"]) {
  test(`keeps long creator names, controls, and metadata inside ${size} compact Home cards`, async ({ addon }, testInfo) => {
    await addon.setStorage({ cfCompactHomeGrid: true, cfCompactHomeSize: size });
    await openFixture(addon.page, appearanceFeed(), "/");
    await expectAttribute(addon.page, "html", "data-cf-home-size", size);
    for (const width of [1440, 900, 390]) {
      await addon.page.setViewport({ width, height: 900 });
      for (const position of ["before", "after"] as const) {
        await addon.setStorage({ cfBlockButtonPosition: position });
        await expectPlacement(addon.page, position);
        if (size === "small" && width === 1440) {
          await testInfo.attach(`compact-home-${position}-creator`, {
            body: Buffer.from(await addon.page.screenshot()), contentType: "image/png"
          });
        }
      }
    }
    if (size === "small") {
      await addon.setStorage({ cfEnabled: false });
      await expectCount(addon.page, ".cf-block-button", 0);
      // The native inline-block is blockified because it is a flex item.
      await expectCSS(addon.page, "ytd-channel-name", "display", "block");
      await expectCSS(addon.page, ".ytAvatarStackViewModelAvatarStackText > span", "display", "inline");
      await addon.setStorage({ cfEnabled: true });
      await expectPlacement(addon.page, "after");
    }
    await addon.page.locator('[data-testid="modern-creator"] .cf-block-button').click();
    await expectVisible(addon.page, '[data-testid="modern-creator"]', false);
    await expectVisible(addon.page, '[data-testid="legacy-creator"]');
    expect((await addon.getStorage<{ cfBlockedChannels: Array<{ key: string }> }>("cfBlockedChannels"))
      .cfBlockedChannels.map((entry) => entry.key)).toEqual(["handle:@moderncreator"]);
  });
}

for (const { direction, youtubeLanguage, extensionLanguage } of [
  { direction: "rtl", youtubeLanguage: "ar", extensionLanguage: "en" },
  { direction: "ltr", youtubeLanguage: "en", extensionLanguage: "ar" }
]) {
  test(`uses ${direction} YouTube placement independently of the extension language`, async ({ addon }) => {
    await addon.setStorage({ cfLanguage: extensionLanguage, cfCompactHomeGrid: true, cfCompactHomeSize: "small" });
    await openFixture(addon.page, appearanceFeed(direction), "/", youtubeLanguage);
    for (const position of ["before", "after"] as const) {
      await addon.setStorage({ cfBlockButtonPosition: position });
      await expectPlacement(addon.page, position, direction);
    }
    await expectAttribute(addon.page, "html", "lang", youtubeLanguage);
    await expectAttribute(addon.page, "ytd-browse", "dir", direction);
    await addon.page.locator('[data-testid="legacy-creator"] .cf-block-button').click();
    await expectVisible(addon.page, '[data-testid="legacy-creator"]', false);
    await expectVisible(addon.page, '[data-testid="modern-creator"]');
    expect((await addon.getStorage<{ cfBlockedChannels: Array<{ key: string }> }>("cfBlockedChannels"))
      .cfBlockedChannels.map((entry) => entry.key)).toEqual(["handle:@legacycreator"]);
  });
}

test("preserves each collaborator's control and identity when position changes", async ({ addon }) => {
  const card = '[data-testid="collaboration"]';
  await openFixture(addon.page, creatorCard({ id: "collaboration", handle: "@firstcollaborator", displayName: "First Collaborator" })
    .replace("</ytd-channel-name>", ' and <a href="/@secondcollaborator">Second Collaborator</a></ytd-channel-name>'));
  for (const position of ["before", "after", "before"] as const) {
    await addon.setStorage({ cfBlockButtonPosition: position });
    await expectCount(addon.page, `${card} .cf-block-button`, 2);
    for (const handle of ["firstcollaborator", "secondcollaborator"]) {
      await expect.poll(() => addon.page.$eval(`${card} a[href='/@${handle}']`, (anchor, position) => {
        const sibling = position === "before" ? anchor.previousElementSibling : anchor.nextElementSibling;
        return sibling?.getAttribute("data-cf-identity");
      }, position)).toBe(`handle:@${handle}`);
    }
  }
  await addon.page.locator(`${card} [data-cf-identity='handle:@secondcollaborator']`).click();
  await expectVisible(addon.page, card, false);
  expect((await addon.getStorage<{ cfBlockedChannels: Array<{ key: string }> }>("cfBlockedChannels"))
    .cfBlockedChannels.map((entry) => entry.key)).toEqual(["handle:@secondcollaborator"]);
});
