import { expect, test } from "../fixtures/extension.fixture";
import { allLocales } from "../fixtures/locales";
import type { Locator, TestInfo } from "@playwright/test";

async function captureAction(control: Locator, testInfo: TestInfo, name: string) {
  await control.scrollIntoViewIfNeeded();
  await expect(control).toBeInViewport();
  await testInfo.attach(name, {
    body: await control.page().screenshot(), contentType: "image/png"
  });
}

for (const locale of allLocales) {
  test.describe(`${locale.name} live YouTube`, () => {
    test.use({ locale: locale.browserLocale });
    // Live navigation and renderer hydration each have a 30-second allowance.
    test.setTimeout(60_000);

    test.beforeEach(async ({ serviceWorker }) => {
      const uiLanguage = await serviceWorker.evaluate(() =>
        (globalThis as unknown as {
          chrome: { i18n: { getUILanguage(): string } };
        }).chrome.i18n.getUILanguage());
      expect(uiLanguage).toMatch(locale.uiLanguage);
    });

    test.afterEach(async ({ extensionPage }, testInfo) => {
      if (testInfo.status === testInfo.expectedStatus) {
        return;
      }
      // Fresh profiles are logged out. Capture only public renderers relevant to
      // creator/menu detection, so a future YouTube change can become a fixture.
      const snapshot = await extensionPage.evaluate(() => ({
        url: location.href,
        documentLanguage: document.documentElement.lang,
        browserLanguage: navigator.language,
        elements: [...document.querySelectorAll(
          "yt-page-header-renderer, ytd-video-renderer, yt-lockup-view-model, " +
          "ytm-shorts-lockup-view-model"
        )].slice(0, 8).map((element) => {
          const copy = element.cloneNode(true) as Element;
          copy.querySelectorAll("script, style").forEach((node) => node.remove());
          return copy.outerHTML;
        }),
        menus: [...document.querySelectorAll("ytd-menu-popup-renderer")]
          .map((element) => element.outerHTML)
      }));
      await testInfo.attach(`${locale.youtubeLanguage}-youtube-dom.json`, {
        body: JSON.stringify(snapshot, null, 2),
        contentType: "application/json"
      });
    });

    test("blocks the channel header without treating statistics as creators", async ({
      extensionPage,
      extensionStorage
    }, testInfo) => {
      await extensionPage.goto(`https://www.youtube.com/@BoahsLoL/videos?hl=${locale.youtubeLanguage}`, {
        waitUntil: "domcontentloaded",
        timeout: 30_000
      });
      await expect(extensionPage.locator("html")).toHaveAttribute("lang", locale.documentLanguage);
      const cards = extensionPage.locator("yt-lockup-view-model").filter({
        has: extensionPage.locator("a[href^='/watch']")
      });
      await expect(cards.first()).toBeVisible({ timeout: 30_000 });
      const headerButton = extensionPage.locator(
        "yt-page-header-renderer .cf-channel-header-block"
      );
      await expect(headerButton).toHaveCount(1);
      await expect(headerButton).toHaveAttribute("data-cf-identity", "handle:@boahslol");
      // These are the channel's own videos. Their first metadata row holds views
      // and upload ages, and must never create extra creator controls.
      await expect(cards.locator(".cf-block-button")).toHaveCount(0);
      await captureAction(headerButton, testInfo, `${locale.catalogCode}-live-channel-block-button`);
      await headerButton.click();
      await expect(extensionPage.locator("#cf-hard-block-overlay")).toBeVisible();
      await captureAction(
        extensionPage.locator("#cf-hard-block-overlay"), testInfo,
        `${locale.catalogCode}-live-channel-blocked-overlay`
      );
      await expect.poll(async () => {
        const stored = await extensionStorage.get<{
          cfBlockedChannels: Array<{ key: string }>;
        }>("cfBlockedChannels");
        return stored.cfBlockedChannels.map((entry) => entry.key);
      }).toEqual(["handle:@boahslol"]);
    });

    test("blocks a search result through its overflow menu", async ({
      extensionPage,
      extensionStorage
    }, testInfo) => {
      await extensionPage.goto(`https://www.youtube.com/results?search_query=cat+videos&hl=${locale.youtubeLanguage}`, {
        waitUntil: "domcontentloaded",
        timeout: 30_000
      });
      await expect(extensionPage.locator("html")).toHaveAttribute("lang", locale.documentLanguage);
      const result = extensionPage.locator("ytd-video-renderer").filter({
        has: extensionPage.locator("ytd-channel-name a[href]")
      }).first();
      await expect(result).toBeVisible({ timeout: 30_000 });
      const blockButton = result.locator(".cf-block-button");
      await expect(blockButton).toHaveCount(1);
      const identity = await blockButton.getAttribute("data-cf-identity");
      expect(identity).toMatch(/^(?:handle|channel):/);
      await captureAction(blockButton, testInfo, `${locale.catalogCode}-live-search-block-button`);
      await result.locator("ytd-menu-renderer button").first().click();
      const action = extensionPage.locator("ytd-menu-popup-renderer:visible .cf-menu-item");
      await expect(action).toHaveCount(1);
      await expect(action.locator(".cf-menu-item__label"))
        .toHaveText(locale.messages.contentMenuBlock.message);
      await captureAction(action, testInfo, `${locale.catalogCode}-live-search-block-menu`);
      await action.click();
      await expect(result).toBeHidden();
      await expect.poll(async () => {
        const stored = await extensionStorage.get<{
          cfBlockedChannels: Array<{ aliases: string[] }>;
        }>("cfBlockedChannels");
        return stored.cfBlockedChannels.map((entry) => entry.aliases);
      }).toEqual([expect.arrayContaining(identity!.split("|"))]);
    });

    test("blocks a right-rail creator through the modern overflow menu", async ({
      extensionPage,
      extensionStorage
    }, testInfo) => {
      await extensionPage.goto(`https://www.youtube.com/watch?v=dQw4w9WgXcQ&hl=${locale.youtubeLanguage}`, {
        waitUntil: "domcontentloaded",
        timeout: 30_000
      });
      await expect(extensionPage.locator("html")).toHaveAttribute("lang", locale.documentLanguage);
      const recommendation = extensionPage.locator(
        "ytd-watch-next-secondary-results-renderer yt-lockup-view-model"
      ).filter({
        has: extensionPage.locator(".ytLockupMetadataViewModelAvatar")
      }).first();
      await expect(recommendation).toBeVisible({ timeout: 30_000 });
      const creator = recommendation.locator(
        ".ytContentMetadataViewModelMetadataRow:first-child .ytContentMetadataViewModelMetadataText"
      ).first();
      await expect(creator).toHaveText(/\S/);
      const creatorName = (await creator.innerText()).normalize("NFKC").trim();
      const blockButton = recommendation.locator(".cf-block-button");
      await expect(blockButton).toHaveCount(1);
      expect(await blockButton.getAttribute("aria-label")).toContain(creatorName);
      const identity = await blockButton.getAttribute("data-cf-identity");
      expect(identity).toBeTruthy();
      await captureAction(blockButton, testInfo, `${locale.catalogCode}-live-recommendation-block-button`);
      await recommendation.getByRole("button", { name: locale.moreActions, exact: true }).click();
      const action = extensionPage.locator(".cf-menu-item:visible");
      await expect(action).toHaveCount(1);
      await expect(action.locator(".cf-menu-item__label"))
        .toHaveText(locale.messages.contentMenuBlock.message);
      await captureAction(action, testInfo, `${locale.catalogCode}-live-recommendation-block-menu`);
      await action.click();
      await expect(recommendation).toBeHidden();
      await expect.poll(async () => {
        const stored = await extensionStorage.get<{
          cfBlockedChannels: Array<{ aliases: string[] }>;
        }>("cfBlockedChannels");
        return stored.cfBlockedChannels.map((entry) => entry.aliases);
      }).toEqual([expect.arrayContaining(identity!.split("|"))]);
    });

    test("keeps the localized Shorts viewer caption readable within the native action stack", async ({
      extensionPage
    }, testInfo) => {
      await extensionPage.goto(`https://www.youtube.com/shorts/E4PB_V8yZso?hl=${locale.youtubeLanguage}`, {
        waitUntil: "domcontentloaded", timeout: 30_000
      });
      await expect(extensionPage.locator("html")).toHaveAttribute("lang", locale.documentLanguage);
      const channelBar = extensionPage.locator("ytd-shorts yt-reel-channel-bar-view-model")
        .filter({ has: extensionPage.locator("a[href*='/@']") }).first();
      await expect(channelBar).toBeVisible({ timeout: 30_000 });
      const reel = channelBar.locator("xpath=ancestor::ytd-reel-video-renderer[1]");
      const action = reel.locator(".cf-shorts-action");
      const caption = action.locator(".cf-shorts-action__label");
      await expect(caption).toHaveText(locale.messages.contentBlock.message);
      await expect(action).toHaveAttribute("dir", locale.catalogCode === "ar" ? "rtl" : "ltr");
      await captureAction(action, testInfo, `${locale.catalogCode}-live-shorts-viewer-button`);
      await expect(action).toBeInViewport({ ratio: 1 });
      expect(await caption.evaluate((element) => element.scrollWidth - element.clientWidth))
        .toBeLessThanOrEqual(1);
      expect(await caption.evaluate((element) => element.scrollHeight - element.clientHeight))
        .toBeLessThanOrEqual(1);
      const bounds = await action.boundingBox();
      const captionBounds = await caption.boundingBox();
      expect(captionBounds!.y + captionBounds!.height).toBeLessThanOrEqual(bounds!.y + bounds!.height);
      const nextAction = action.locator("xpath=following-sibling::*[1]");
      await expect(nextAction).toBeVisible();
      const nextBounds = await nextAction.boundingBox();
      expect(nextBounds!.y).toBeGreaterThanOrEqual(bounds!.y + bounds!.height - 1);
    });

    test("blocks a compact Short from its menu without leaving search", async ({
      extensionPage,
      extensionStorage
    }, testInfo) => {
      // "cat videos" can return only full-length videos in some locales.
      await extensionPage.goto(`https://www.youtube.com/results?search_query=funny+cats&hl=${locale.youtubeLanguage}`, {
        waitUntil: "domcontentloaded",
        timeout: 30_000
      });
      await expect(extensionPage.locator("html")).toHaveAttribute("lang", locale.documentLanguage);
      const card = extensionPage.locator("ytm-shorts-lockup-view-model").filter({
        has: extensionPage.locator("a[href^='/shorts/']")
      }).first();
      await expect(card).toBeVisible({ timeout: 30_000 });
      const shortHref = await card.locator("a[href^='/shorts/']").first().getAttribute("href");
      expect(shortHref).toMatch(/^\/shorts\//);
      const selectedCard = extensionPage.locator("ytm-shorts-lockup-view-model").filter({
        has: extensionPage.locator(`a[href='${shortHref}']`)
      });
      const layoutItem = selectedCard.locator(
        "xpath=ancestor::div[contains(@class, 'ytGridShelfViewModelGridShelfItem')][1]"
      );
      await expect(layoutItem).toBeVisible();
      const searchUrl = extensionPage.url();
      await captureAction(
        selectedCard.locator(".cf-compact-shorts-block"), testInfo,
        `${locale.catalogCode}-live-compact-short-block-button`
      );
      await selectedCard.getByRole("button", { name: locale.moreActions, exact: true }).click();
      const action = extensionPage.locator(".cf-menu-item:visible");
      await expect(action).toHaveCount(1);
      await expect(action.locator(".cf-menu-item__label"))
        .toHaveText(locale.messages.contentMenuBlockCreator.message);
      await captureAction(action, testInfo, `${locale.catalogCode}-live-compact-short-block-menu`);
      await action.click();
      await expect(layoutItem).toBeHidden({ timeout: 15_000 });
      await expect(extensionPage).toHaveURL(searchUrl);
      await expect.poll(async () => {
        const stored = await extensionStorage.get<{
          cfBlockedChannels: Array<{ shortPaths?: string[] }>;
        }>("cfBlockedChannels");
        return stored.cfBlockedChannels[0]?.shortPaths || [];
      }).toContain(shortHref);
    });
  });
}
