import { type Page } from "@playwright/test";
import { blockedCreator, expect, test } from "../fixtures/extension.fixture";
import { appearanceFeed, creatorCard } from "../fixtures/youtube-fixtures";
import { OptionsPage } from "../pages/extension-ui.page";
import { YouTubeSurfacePage } from "../pages/youtube-surface.page";

async function expectPlacement(page: Page, position: "before" | "after", direction = "ltr"): Promise<void> {
  await page.bringToFront();
  await expect.poll(() => page.locator(".creator-link").evaluateAll((links, { position, direction }) => links.map((link) => {
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

test("defaults appearance settings and updates open tabs while preserving saved choices", async ({
  extensionContext, extensionId, extensionPage, extensionStorage, serviceWorker
}, testInfo) => {
  // Model an existing installation without either new preference.
  await serviceWorker.evaluate("chrome.storage.local.remove(['cfBlockButtonPosition', 'cfShowBlockCount'])");
  await extensionStorage.set({ cfBlockedChannels: [blockedCreator("@savedcreator", "Saved Creator")] });
  const options = new OptionsPage(extensionPage, extensionId);
  await options.open();
  await expect(extensionPage.locator("#blockButtonPositionSelect")).toHaveValue("before");
  await expect(extensionPage.locator("#showBlockCountToggle")).not.toBeChecked();

  const first = await extensionContext.newPage();
  const second = await extensionContext.newPage();
  await new YouTubeSurfacePage(first).open(appearanceFeed(), "/");
  await new YouTubeSurfacePage(second).open(appearanceFeed(), "/");
  await expectPlacement(first, "before");
  const firstTabId = await serviceWorker.evaluate<number>(
    "chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => tab.id)"
  );
  await expectPlacement(second, "before");
  const secondTabId = await serviceWorker.evaluate<number>(
    "chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => tab.id)"
  );
  const badges = () => serviceWorker.evaluate<string[]>(
    `Promise.all([${firstTabId}, ${secondTabId}].map(tabId => chrome.action.getBadgeText({ tabId })))`
  );
  await expect.poll(badges).toEqual(["", ""]);

  await extensionPage.locator("#blockButtonPositionSelect").selectOption("after");
  await expectPlacement(first, "after");
  await expectPlacement(second, "after");
  await extensionPage.locator("label:has(#showBlockCountToggle)").click();
  await expect(extensionPage.locator("#showBlockCountToggle")).toBeChecked();
  await expect.poll(badges).toEqual(["1", "1"]);
  await extensionStorage.set({ cfBlockedChannels: [
    blockedCreator("@savedcreator", "Saved Creator"), blockedCreator("@anothercreator", "Another Creator")
  ] });
  await expect.poll(badges).toEqual(["2", "2"]);

  await extensionPage.reload();
  await expect(extensionPage.locator("#blockButtonPositionSelect")).toHaveValue("after");
  await expect(extensionPage.locator("#showBlockCountToggle")).toBeChecked();
  await first.reload();
  await expectPlacement(first, "after");
  await expect.poll(badges).toEqual(["2", "2"]);
  await extensionPage.locator("label:has(#showBlockCountToggle)").click();
  await expect.poll(badges).toEqual(["", ""]);
  await extensionPage.reload();
  await expect(extensionPage.locator("#showBlockCountToggle")).not.toBeChecked();
  expect(await extensionStorage.get(["cfBlockButtonPosition", "cfShowBlockCount"]))
    .toEqual({ cfBlockButtonPosition: "after", cfShowBlockCount: false });
  await testInfo.attach("appearance-settings", {
    body: await extensionPage.locator("section:has(#appearanceHeading)").screenshot(), contentType: "image/png"
  });
  await extensionStorage.set({ cfBlockButtonPosition: "unknown-position" });
  await expect(extensionPage.locator("#blockButtonPositionSelect")).toHaveValue("before");
  await expectPlacement(first, "before");
  await expectPlacement(second, "before");
  await first.close();
  await second.close();
});

for (const size of ["small", "medium", "large"]) {
  test(`keeps long creator names, controls, and metadata inside ${size} compact Home cards`, async ({
    extensionPage, extensionStorage
  }, testInfo) => {
    await extensionStorage.set({ cfCompactHomeGrid: true, cfCompactHomeSize: size });
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(appearanceFeed(), "/");
    await expect(extensionPage.locator("html")).toHaveAttribute("data-cf-home-size", size);
    for (const width of [1440, 900, 390]) {
      await extensionPage.setViewportSize({ width, height: 900 });
      for (const position of ["before", "after"] as const) {
        await extensionStorage.set({ cfBlockButtonPosition: position });
        await expectPlacement(extensionPage, position);
        if (size === "small" && width === 1440) {
          await testInfo.attach(`compact-home-${position}-creator`, {
            body: await extensionPage.screenshot(), contentType: "image/png"
          });
        }
      }
    }
    if (size === "small") {
      await extensionStorage.set({ cfEnabled: false });
      await expect(extensionPage.locator(".cf-block-button")).toHaveCount(0);
      // The native inline-block is blockified because it is a flex item.
      await expect(extensionPage.locator("ytd-channel-name")).toHaveCSS("display", "block");
      await expect(extensionPage.locator(".ytAvatarStackViewModelAvatarStackText > span")).toHaveCSS("display", "inline");
      await extensionStorage.set({ cfEnabled: true });
      await expectPlacement(extensionPage, "after");
    }
    await youtube.blockButton("modern-creator").click();
    await expect(youtube.card("modern-creator")).toBeHidden();
    await expect(youtube.card("legacy-creator")).toBeVisible();
    expect((await extensionStorage.get<{ cfBlockedChannels: Array<{ key: string }> }>("cfBlockedChannels"))
      .cfBlockedChannels.map((entry) => entry.key)).toEqual(["handle:@moderncreator"]);
  });
}

for (const { direction, youtubeLanguage, extensionLanguage } of [
  { direction: "rtl", youtubeLanguage: "ar", extensionLanguage: "en" },
  { direction: "ltr", youtubeLanguage: "en", extensionLanguage: "ar" }
]) {
  test(`uses ${direction} YouTube placement independently of the extension language`, async ({
    extensionPage, extensionStorage
  }) => {
    await extensionStorage.set({ cfLanguage: extensionLanguage, cfCompactHomeGrid: true, cfCompactHomeSize: "small" });
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(appearanceFeed(direction), "/", youtubeLanguage);
    for (const position of ["before", "after"] as const) {
      await extensionStorage.set({ cfBlockButtonPosition: position });
      await expectPlacement(extensionPage, position, direction);
    }
    await expect(extensionPage.locator("html")).toHaveAttribute("lang", youtubeLanguage);
    await expect(extensionPage.locator("ytd-browse")).toHaveAttribute("dir", direction);
    await youtube.blockButton("legacy-creator").click();
    await expect(youtube.card("legacy-creator")).toBeHidden();
    await expect(youtube.card("modern-creator")).toBeVisible();
    expect((await extensionStorage.get<{ cfBlockedChannels: Array<{ key: string }> }>("cfBlockedChannels"))
      .cfBlockedChannels.map((entry) => entry.key)).toEqual(["handle:@legacycreator"]);
  });
}

test("preserves each collaborator's control and identity when position changes", async ({ extensionPage, extensionStorage }) => {
  const youtube = new YouTubeSurfacePage(extensionPage);
  await youtube.open(creatorCard({ id: "collaboration", handle: "@firstcollaborator", displayName: "First Collaborator" })
    .replace("</ytd-channel-name>", ' and <a href="/@secondcollaborator">Second Collaborator</a></ytd-channel-name>'));
  for (const position of ["before", "after", "before"] as const) {
    await extensionStorage.set({ cfBlockButtonPosition: position });
    await expect(youtube.blockButton("collaboration")).toHaveCount(2);
    for (const handle of ["firstcollaborator", "secondcollaborator"]) {
      await expect.poll(() => youtube.card("collaboration").locator(`a[href='/@${handle}']`).evaluate((anchor, position) => {
        const sibling = position === "before" ? anchor.previousElementSibling : anchor.nextElementSibling;
        return sibling?.getAttribute("data-cf-identity");
      }, position)).toBe(`handle:@${handle}`);
    }
  }
  await youtube.card("collaboration").locator("[data-cf-identity='handle:@secondcollaborator']").click();
  await expect(youtube.card("collaboration")).toBeHidden();
  expect((await extensionStorage.get<{ cfBlockedChannels: Array<{ key: string }> }>("cfBlockedChannels"))
    .cfBlockedChannels.map((entry) => entry.key)).toEqual(["handle:@secondcollaborator"]);
});
