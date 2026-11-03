import { allLocales } from "../e2e/fixtures/locales";
import { channelHeader, creatorCard, shortsViewer } from "../e2e/fixtures/youtube-fixtures";
import { expect, expectText, expectVisible, openCreatorMenu, openExtensionPage, openExtensionTab, openFixture, openOptions, test } from "./extension.fixture";

for (const locale of allLocales) {
  test(`${locale.name}: manual language selection, extension pages, blocking controls, and direction`, async ({ addon }, testInfo) => {
    const messages = locale.messages;
    const direction = locale.catalogCode === "ar" ? "rtl" : "ltr";
    await openOptions(addon);
    await addon.ui.select("#languageSelect", locale.catalogCode);
    await expectText(addon.ui, "#settingsHeading", messages.settings.message);
    await expect.poll(() => addon.getStorage("cfLanguage")).toEqual({ cfLanguage: locale.catalogCode });
    await openOptions(addon);
    await expect.poll(() => addon.ui.$eval("html", (element) => ({
      language: element.getAttribute("lang"), direction: element.getAttribute("dir")
    }))).toEqual({ language: messages.languageCode.message, direction });
    await expect.poll(() => addon.ui.$eval("#languageSelect", (element) => (element as HTMLSelectElement).value))
      .toBe(locale.catalogCode);
    await expect.poll(() => addon.ui.$eval("#homeAdsToggle", (element) => element.getAttribute("aria-label")))
      .toBe(messages.hideHomeAds.message);

    const popup = await openExtensionTab(addon, "/ui/popup.html");
    await expectText(popup, "#openOptions", messages.manageBlockList.message);
    await expectText(popup, "#homePromotionsSettingTitle", messages.hideHomePromotions.message);
    await expect.poll(() => popup.$eval("html", (element) => element.getAttribute("dir"))).toBe(direction);
    expect(await popup.evaluate(() => document.body.scrollWidth - document.body.clientWidth)).toBeLessThanOrEqual(1);
    await popup.close();

    for (const [pageName, heading] of [
      ["welcome", messages.welcomeHeadline.message], ["privacy", messages.privacyTitle.message]
    ]) {
      await openExtensionPage(addon.ui, `${addon.origin}/ui/${pageName}.html`);
      await expectText(addon.ui, "h1", heading);
      await expect.poll(() => addon.ui.$eval("html", (element) => element.getAttribute("dir"))).toBe(direction);
    }

    // Deliberately keep YouTube English while the extension uses another
    // language. The extension must not rewrite the host page's locale.
    await openFixture(addon.page, creatorCard({
      id: "localized", handle: `@${locale.creator}`, displayName: locale.creator
    }), "/", "en");
    await expectVisible(addon.page, ".cf-block-button");
    await expect.poll(() => addon.page.$eval(".cf-block-button", (element) => element.getAttribute("aria-label")))
      .toBe(messages.contentBlockNamed.message.replace("$CREATOR$", locale.creator));
    await openCreatorMenu(addon.page, '[data-testid="localized-menu"]');
    await expectText(addon.page, ".cf-menu-item__label", messages.contentMenuBlock.message);
    await expect.poll(() => addon.page.$eval(".cf-menu-item__label", (element) => getComputedStyle(element).color))
      .toBe("rgb(241, 241, 241)");
    await testInfo.attach(`${locale.catalogCode}-firefox-content-menu`, {
      body: Buffer.from(await addon.page.screenshot()), contentType: "image/png"
    });
    await expect.poll(() => addon.page.$eval(".cf-menu-item", (element) => element.getAttribute("dir"))).toBe(direction);
    await addon.page.locator(".cf-menu-item").click();
    await expectVisible(addon.page, '[data-testid="localized"]', false);
    await expectText(addon.page, "#cf-toast button", messages.contentUndo.message);
    await addon.page.locator("#cf-toast button").click();
    await expectVisible(addon.page, '[data-testid="localized"]');
    expect(await addon.page.$eval("html", (element) => element.getAttribute("lang"))).toBe("en");
    await expect.poll(() => addon.getStorage("cfBlockedChannels")).toEqual({ cfBlockedChannels: [] });

    await openFixture(addon.page, shortsViewer(locale.creator, `@${locale.creator}`), "/shorts/localized", locale.youtubeLanguage);
    await expectVisible(addon.page, ".cf-shorts-action__button");
    await expectText(addon.page, ".cf-shorts-action__label", messages.contentBlock.message);
    await expect.poll(() => addon.page.$eval(".cf-shorts-action__button", (element) => element.getAttribute("aria-label")))
      .toBe(messages.contentBlockWithBrand.message.replace("$CREATOR$", locale.creator));
    await openCreatorMenu(addon.page, '[data-testid="shorts-menu"]');
    await expectText(addon.page, ".cf-menu-item__label", messages.contentMenuBlock.message);

    await openOptions(addon);
    await addon.ui.locator("#manualBlockInput").fill(`@${locale.creator}`);
    await addon.ui.locator("#manualBlockButton").click();
    await expectText(addon.ui, "#blockedCount", "1");
    await openFixture(addon.page, channelHeader(locale.creator, `@${locale.creator}`), `/@${locale.creator}`, "en");
    await expectVisible(addon.page, "#cf-hard-block-overlay");
    await expectText(addon.page, "#cf-hard-block-title", messages.contentCreatorBlocked.message);
    await expect.poll(() => addon.page.$eval("#cf-hard-block-overlay", (element) => element.getAttribute("dir"))).toBe(direction);
    expect(await addon.page.$eval("html", (element) => element.getAttribute("lang"))).toBe("en");
  });
}

test("Automatic uses Firefox's actual UI language after removing a manual override", async ({ addon }) => {
  await openOptions(addon);
  const firefoxLocale = await addon.ui.evaluate(() => (globalThis as unknown as {
    browser: { i18n: { getUILanguage(): string } };
  }).browser.i18n.getUILanguage());
  expect(firefoxLocale).toMatch(/^en(?:-|$)/);
  await addon.ui.select("#languageSelect", "ko");
  await expectText(addon.ui, "#settingsHeading", allLocales.find((locale) => locale.catalogCode === "ko")!.messages.settings.message);
  await addon.ui.select("#languageSelect", "auto");
  await expectText(addon.ui, "#settingsHeading", allLocales[0].messages.settings.message);
  await expect.poll(() => addon.getStorage("cfLanguage")).toEqual({ cfLanguage: "auto" });
});
