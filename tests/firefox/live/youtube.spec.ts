import { allLocales } from "../../e2e/fixtures/locales";
import { expect, expectText, expectVisible, test } from "../extension.fixture";

// Run only on the explicit CI workflow input. These use a real, logged-out
// Firefox profile and unmodified YouTube responses, not deterministic fixtures.
for (const locale of allLocales.filter(({ catalogCode }) => ["en", "ko"].includes(catalogCode))) {
  test(`${locale.name}: blocks a real channel and displays its translated blocked page`, async ({ addon }, testInfo) => {
    await addon.setStorage({ cfLanguage: locale.catalogCode });
    await addon.page.goto(`https://www.youtube.com/@BoahsLoL/videos?hl=${locale.youtubeLanguage}`, {
      waitUntil: "domcontentloaded", timeout: 30_000
    });
    const selector = "yt-page-header-renderer .cf-channel-header-block";
    await addon.page.waitForSelector(selector, { visible: true, timeout: 30_000 });
    expect(await addon.page.$eval("html", (element) => element.getAttribute("lang"))).toMatch(locale.documentLanguage);
    expect(await addon.page.$eval(selector, (element) => element.getAttribute("data-cf-identity"))).toBe("handle:@boahslol");
    await addon.page.locator(selector).click();
    await expectVisible(addon.page, "#cf-hard-block-overlay");
    await expectText(addon.page, "#cf-hard-block-title", locale.messages.contentCreatorBlocked.message);
    await expect.poll(() => addon.getStorage("cfBlockedChannels")).toMatchObject({
      cfBlockedChannels: [{ key: "handle:@boahslol" }]
    });
    await testInfo.attach(`${locale.catalogCode}-live-firefox-blocked`, {
      body: Buffer.from(await addon.page.screenshot()), contentType: "image/png"
    });
  });

  test(`${locale.name}: blocks a real search result from its overflow menu`, async ({ addon }) => {
    await addon.setStorage({ cfLanguage: locale.catalogCode });
    await addon.page.goto(`https://www.youtube.com/results?search_query=cat+videos&hl=${locale.youtubeLanguage}`, {
      waitUntil: "domcontentloaded", timeout: 30_000
    });
    const resultSelector = "ytd-video-renderer:has(.cf-block-button)";
    await addon.page.waitForSelector(resultSelector, { visible: true, timeout: 30_000 });
    const result = await addon.page.$(resultSelector);
    if (!result) throw new Error("No supported search result was found");
    const identity = await result.$eval(".cf-block-button", (element) => element.getAttribute("data-cf-identity"));
    expect(identity).toMatch(/^(?:handle|channel):/);
    expect(await addon.page.$eval("html", (element) => element.getAttribute("lang"))).toMatch(locale.documentLanguage);
    const menuButton = await result.$("ytd-menu-renderer button");
    if (!menuButton) throw new Error("The supported search result has no overflow menu button");
    await menuButton.click();
    await expectVisible(addon.page, "ytd-menu-popup-renderer .cf-menu-item");
    await expectText(addon.page, ".cf-menu-item__label", locale.messages.contentMenuBlock.message);
    await addon.page.locator("ytd-menu-popup-renderer .cf-menu-item").click();
    await expect.poll(() => result.evaluate((element) => element.checkVisibility())).toBe(false);
    await expect.poll(() => addon.getStorage("cfBlockedChannels")).toMatchObject({
      cfBlockedChannels: [{ aliases: expect.arrayContaining(identity!.split("|")) }]
    });
  });
}
