import { allLocales } from "../../e2e/fixtures/locales";
import { assertLiveYouTubeAccess } from "../../e2e/fixtures/live-youtube-access";
import { readNativeLockupCreator } from "../../e2e/fixtures/native-lockup-creator";
import { expect, expectAttribute, expectCount, expectText, expectVisible, test, type FirefoxAddon } from "../extension.fixture";
import { captureAction, expectInViewport, expectNativeLanguage, type Locale } from "../locale-checks";

async function openYouTube(addon: FirefoxAddon, pathname: string, locale: Locale): Promise<void> {
  await addon.page.goto(`https://www.youtube.com${pathname}${pathname.includes("?") ? "&" : "?"}hl=${locale.youtubeLanguage}`, {
    waitUntil: "domcontentloaded", timeout: 30_000
  });
  assertLiveYouTubeAccess(addon.page.url());
  await expect.poll(() => addon.page.$eval("html", (element) => element.lang)).toMatch(locale.documentLanguage);
}

for (const locale of allLocales) {
  test.describe(`${locale.name} live YouTube`, () => {
    test.use({ browserLocale: locale.browserLocale });
    test.setTimeout(60_000);
    test.beforeEach(async ({ addon }) => {
      await expectNativeLanguage(addon, locale.uiLanguage);
      // YouTube independently chooses its UI language. Set its normal cookie and
      // request preference, then assert its actual rendered language each time.
      await addon.page.setExtraHTTPHeaders({ "Accept-Language": locale.browserLocale });
      await addon.browser.defaultBrowserContext().setCookie({
        name: "PREF", value: `hl=${locale.youtubeLanguage}`, domain: ".youtube.com", path: "/", secure: true
      });
    });

    test("blocks the channel header without treating statistics as creators", async ({ addon }, testInfo) => {
      await openYouTube(addon, "/@BoahsLoL/videos", locale);
      const cards = "yt-lockup-view-model:has(a[href^='/watch'])";
      await addon.page.waitForSelector(cards, { visible: true, timeout: 30_000 });
      const header = "yt-page-header-renderer .cf-channel-header-block";
      await expectCount(addon.page, header, 1);
      await expectAttribute(addon.page, header, "data-cf-identity", "handle:@boahslol");
      await expectCount(addon.page, `${cards} .cf-block-button`, 0);
      await captureAction(addon.page, header, testInfo, `${locale.catalogCode}-live-channel-block-button`);
      await addon.page.locator(header).click();
      await expectVisible(addon.page, "#cf-hard-block-overlay");
      await captureAction(addon.page, "#cf-hard-block-overlay", testInfo, `${locale.catalogCode}-live-channel-blocked-overlay`);
      await expect.poll(async () => (await addon.getStorage<{ cfBlockedChannels: Array<{ key: string }> }>("cfBlockedChannels"))
        .cfBlockedChannels.map((entry) => entry.key)).toEqual(["handle:@boahslol"]);
    });

    test("blocks a search result through its overflow menu", async ({ addon }, testInfo) => {
      await openYouTube(addon, "/results?search_query=cat+videos", locale);
      const resultSelector = "ytd-video-renderer:has(ytd-channel-name a[href])";
      const result = await addon.page.waitForSelector(resultSelector, { visible: true, timeout: 30_000 });
      if (!result) throw new Error("No supported search result was rendered");
      await expect.poll(() => result.$$eval(".cf-block-button", (elements) => elements.length)).toBe(1);
      const identity = await result.$eval(".cf-block-button", (element) => element.getAttribute("data-cf-identity"));
      expect(identity).toMatch(/^(?:handle|channel):/);
      await captureAction(addon.page, `${resultSelector} .cf-block-button`, testInfo, `${locale.catalogCode}-live-search-block-button`);
      await result.hover();
      const menu = await result.waitForSelector("ytd-menu-renderer button", { visible: true, timeout: 30_000 });
      if (!menu) throw new Error("The supported search result has no overflow button");
      await menu.click();
      await expectCount(addon.page, "ytd-menu-popup-renderer .cf-menu-item", 1);
      await expectText(addon.page, ".cf-menu-item__label", locale.messages.contentMenuBlock.message);
      await captureAction(addon.page, ".cf-menu-item", testInfo, `${locale.catalogCode}-live-search-block-menu`);
      await addon.page.locator(".cf-menu-item").click();
      await expect.poll(() => result.evaluate((element) => element.checkVisibility())).toBe(false);
      await expect.poll(async () => (await addon.getStorage<{ cfBlockedChannels: Array<{ aliases: string[] }> }>("cfBlockedChannels"))
        .cfBlockedChannels.map((entry) => entry.aliases)).toEqual([expect.arrayContaining(identity!.split("|"))]);
    });

    test("blocks a right-rail creator through the modern overflow menu", async ({ addon }, testInfo) => {
      await openYouTube(addon, "/watch?v=dQw4w9WgXcQ", locale);
      const selector = "ytd-watch-next-secondary-results-renderer yt-lockup-view-model:has(.ytLockupMetadataViewModelAvatar)";
      const recommendation = await addon.page.waitForSelector(selector, { visible: true, timeout: 30_000 });
      if (!recommendation) throw new Error("No supported right-rail recommendation was rendered");
      const creatorLabel = { creator: locale.creator, goToChannel: locale.goToChannel };
      await expect.poll(() => recommendation.evaluate(readNativeLockupCreator, creatorLabel)).toMatch(/\S/);
      const creator = await recommendation.evaluate(readNativeLockupCreator, creatorLabel);
      await expect.poll(() => recommendation.$$eval(".cf-block-button", (elements) => elements.length)).toBe(1);
      expect(await recommendation.$eval(".cf-block-button", (element) => element.getAttribute("aria-label"))).toContain(creator);
      const identity = await recommendation.$eval(".cf-block-button", (element) => element.getAttribute("data-cf-identity"));
      expect(identity).toBeTruthy();
      await captureAction(addon.page, `${selector} .cf-block-button`, testInfo, `${locale.catalogCode}-live-recommendation-block-button`);
      const menu = await recommendation.waitForSelector(`button[aria-label=${JSON.stringify(locale.moreActions)}]`, { visible: true });
      if (!menu) throw new Error("No localized recommendation overflow button was rendered");
      await menu.click();
      await expectCount(addon.page, ".cf-menu-item", 1);
      await expectText(addon.page, ".cf-menu-item__label", locale.messages.contentMenuBlock.message);
      await captureAction(addon.page, ".cf-menu-item", testInfo, `${locale.catalogCode}-live-recommendation-block-menu`);
      await addon.page.locator(".cf-menu-item").click();
      await expect.poll(() => recommendation.evaluate((element) => element.checkVisibility())).toBe(false);
      await expect.poll(async () => (await addon.getStorage<{ cfBlockedChannels: Array<{ aliases: string[] }> }>("cfBlockedChannels"))
        .cfBlockedChannels.map((entry) => entry.aliases)).toEqual([expect.arrayContaining(identity!.split("|"))]);
    });

    test("keeps the localized Shorts viewer caption readable within the native action stack", async ({ addon }, testInfo) => {
      await openYouTube(addon, "/shorts/E4PB_V8yZso", locale);
      const reel = "ytd-shorts ytd-reel-video-renderer:has(yt-reel-channel-bar-view-model a[href*='/@'])";
      await addon.page.waitForSelector(`${reel} yt-reel-channel-bar-view-model`, { visible: true, timeout: 30_000 });
      const action = `${reel} .cf-shorts-action`;
      const caption = `${action} .cf-shorts-action__label`;
      await expectText(addon.page, caption, locale.messages.contentBlock.message);
      await expectAttribute(addon.page, action, "dir", locale.catalogCode === "ar" ? "rtl" : "ltr");
      const dark = await addon.page.$eval("html", (element) => element.hasAttribute("dark"));
      const color = await addon.page.$eval(caption, (element) => getComputedStyle(element).color);
      const channels = color.match(/[\d.]+/g)!.slice(0, 3).map(Number);
      expect(channels).toHaveLength(3);
      if (dark) expect(Math.min(...channels), `Caption ${color} must contrast with dark YouTube`).toBeGreaterThanOrEqual(192);
      else expect(Math.max(...channels), `Caption ${color} must contrast with light YouTube`).toBeLessThanOrEqual(96);
      await captureAction(addon.page, action, testInfo, `${locale.catalogCode}-live-shorts-viewer-button`);
      await expectInViewport(addon.page, action);
      const layout = await addon.page.$eval(action, (element) => {
        const caption = element.querySelector<HTMLElement>(".cf-shorts-action__label")!;
        const bounds = element.getBoundingClientRect();
        const next = element.nextElementSibling;
        return { overflowX: caption.scrollWidth - caption.clientWidth, overflowY: caption.scrollHeight - caption.clientHeight,
          captionBottom: caption.getBoundingClientRect().bottom, actionBottom: bounds.bottom,
          nextVisible: next?.checkVisibility(), nextTop: next?.getBoundingClientRect().top };
      });
      expect(layout.overflowX).toBeLessThanOrEqual(1);
      expect(layout.overflowY).toBeLessThanOrEqual(1);
      expect(layout.captionBottom).toBeLessThanOrEqual(layout.actionBottom);
      expect(layout.nextVisible).toBe(true);
      expect(layout.nextTop).toBeGreaterThanOrEqual(layout.actionBottom - 1);
    });

    test("blocks a compact Short from its menu without leaving search", async ({ addon }, testInfo) => {
      await openYouTube(addon, "/results?search_query=funny+cats", locale);
      const card = await addon.page.waitForSelector("ytm-shorts-lockup-view-model:has(a[href^='/shorts/'])", { visible: true, timeout: 30_000 });
      if (!card) throw new Error("No supported compact Short was rendered");
      const href = await card.$eval("a[href^='/shorts/']", (element) => element.getAttribute("href"));
      expect(href).toMatch(/^\/shorts\//);
      const selected = `ytm-shorts-lockup-view-model:has(a[href=${JSON.stringify(href)}])`;
      const item = await card.evaluateHandle((element) => element.closest("div.ytGridShelfViewModelGridShelfItem")!);
      expect(await item.evaluate((element) => element.checkVisibility())).toBe(true);
      const searchUrl = addon.page.url();
      await captureAction(addon.page, `${selected} .cf-compact-shorts-block`, testInfo, `${locale.catalogCode}-live-compact-short-block-button`);
      const menu = await card.waitForSelector(`button[aria-label=${JSON.stringify(locale.moreActions)}]`, { visible: true });
      if (!menu) throw new Error("No localized compact Shorts overflow button was rendered");
      await menu.click();
      await expectCount(addon.page, ".cf-menu-item", 1);
      await expectText(addon.page, ".cf-menu-item__label", locale.messages.contentMenuBlockCreator.message);
      await captureAction(addon.page, ".cf-menu-item", testInfo, `${locale.catalogCode}-live-compact-short-block-menu`);
      await addon.page.locator(".cf-menu-item").click();
      await expect.poll(() => item.evaluate((element) => element.checkVisibility()), { timeout: 15_000 }).toBe(false);
      expect(addon.page.url()).toBe(searchUrl);
      await expect.poll(async () => (await addon.getStorage<{ cfBlockedChannels: Array<{ shortPaths?: string[] }> }>("cfBlockedChannels"))
        .cfBlockedChannels[0]?.shortPaths || []).toContain(href);
    });
  });
}
