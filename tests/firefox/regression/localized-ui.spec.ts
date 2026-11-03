import type { Page } from "puppeteer-core";
import { allLocales } from "../../e2e/fixtures/locales";
import { blockedCreator } from "../../e2e/fixtures/extension.fixture";
import { creatorCard, shortsViewer } from "../../e2e/fixtures/youtube-fixtures";
import {
  expect, expectContainsText, expectAttribute, expectValue, expectText, expectVisible, openCreatorMenu, openExtensionPage, openFixture, openOptions, test
} from "../extension.fixture";
import {
  captureAction, captureExtensionDom, expectInViewport, expectNativeLanguage,
  firefoxMessages, type Locale
} from "../locale-checks";

async function expectHomeControls(page: Page, messages: Locale["messages"]): Promise<void> {
  for (const [id, label, help] of [
    ["homeAdsToggle", messages.hideHomeAds.message, messages.hideHomeAdsHelp.message],
    ["homePromotionsToggle", messages.hideHomePromotions.message, messages.hideHomePromotionsHelp.message],
    ["compactHomeGridToggle", messages.compactHomeGrid.message, messages.compactHomeGridHelp.message]
  ]) {
    await expectAttribute(page, `#${id}`, "aria-label", label);
    expect(await page.$eval(`#${id}`, (element) => (element as HTMLInputElement).checked)).toBe(false);
    expect(await page.$eval(`#${id}`, (element) =>
      element.getAttribute("aria-describedby")?.split(/\s+/).map((id) => document.getElementById(id)?.textContent?.trim()).join(" ")))
      .toBe(help);
  }
  await expectText(page, 'label[for="compactHomeSizeSelect"]', messages.compactHomeSize.message);
  await expectValue(page, "#compactHomeSizeSelect", "medium");
  expect(await page.$eval("#compactHomeSizeSelect", (element) => (element as HTMLSelectElement).disabled)).toBe(true);
  expect(await page.$$eval("#compactHomeSizeSelect option", (elements) => elements.map((element) => element.textContent)))
    .toEqual([messages.compactHomeSizeSmall.message, messages.compactHomeSizeMedium.message, messages.compactHomeSizeLarge.message]);
}

async function expectPopupLayout(page: Page): Promise<void> {
  for (const selector of ["#openOptions", ".popup__header", ".popup__footer"]) await expectInViewport(page, selector);
  for (const selector of ["body", ".popup__main"]) {
    expect(await page.$eval(selector, (element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  }
}

for (const locale of allLocales) {
  const messages = firefoxMessages(locale);
  test.describe(`${locale.name} extension UI`, () => {
    test.use({ browserLocale: locale.browserLocale });
    test.beforeEach(async ({ addon }) => { await expectNativeLanguage(addon, locale.uiLanguage); });

    test("translates settings and popup while preserving a Unicode handle", async ({ addon }, testInfo) => {
      await openOptions(addon);
      await expectAttribute(addon.ui, "html", "lang", messages.languageCode.message);
      await expect.poll(() => addon.ui.title()).toBe(messages.settingsPageTitle.message);
      await expectHomeControls(addon.ui, messages);
      await expectText(addon.ui, 'label[for="manualBlockInput"]', messages.manualBlockLabel.message);
      await expectText(addon.ui, "#manualBlockButton", messages.blockCreator.message);
      await addon.ui.locator("#manualBlockInput").fill(`@${locale.creator}`);
      await addon.ui.locator("#manualBlockButton").click();
      await expectText(addon.ui, "#blockedCount", "1");
      expect(await addon.ui.$eval("#blockList", (element) => element.textContent)).toContain(locale.creator);
      await expect.poll(() => addon.getStorage("cfBlockedChannels")).toMatchObject({
        cfBlockedChannels: [{ key: `handle:@${locale.creator}` }]
      });
      await expect.poll(() => addon.ui.$eval("#toast", (element) => element.classList.contains("toast--visible"))).toBe(false);
      await captureExtensionDom(addon.ui, testInfo, `${locale.catalogCode}-ui-settings`);

      await addon.ui.setViewport({ width: 360, height: 600 });
      await openExtensionPage(addon.ui, `${addon.origin}/ui/popup.html`);
      await expectText(addon.ui, "#statusText", messages.blockedCount.message.replace("$COUNT$", "1"));
      await expectText(addon.ui, "#openOptions", messages.manageBlockList.message);
      await expectAttribute(addon.ui, "#shortsToggle", "aria-label", messages.hideShortsAccessible.message);
      await expectHomeControls(addon.ui, messages);
      await expectVisible(addon.ui, "#compactHomeSizeSelect", false);
      await expectPopupLayout(addon.ui);
      await captureExtensionDom(addon.ui, testInfo, `${locale.catalogCode}-ui-popup`);
      await addon.ui.locator("label:has(#compactHomeGridToggle)").click();
      await expectVisible(addon.ui, "#compactHomeSizeSelect");
      expect(await addon.ui.$eval("#compactHomeSizeSelect", (element) => (element as HTMLSelectElement).disabled)).toBe(false);
      await addon.ui.select("#compactHomeSizeSelect", "small");
      await expectValue(addon.ui, "#compactHomeSizeSelect", "small");
      await addon.ui.$eval(".popup-quick-setting--compact", (element) => element.scrollIntoView({ block: "center", inline: "nearest" }));
      await expectInViewport(addon.ui, "#compactHomeSizeSelect");
      await expectPopupLayout(addon.ui);
      await captureExtensionDom(addon.ui, testInfo, `${locale.catalogCode}-ui-popup-home-controls`);
      await addon.ui.locator("label:has(#compactHomeGridToggle)").click();
      await expectVisible(addon.ui, "#compactHomeSizeSelect", false);
      expect(await addon.ui.$eval("#compactHomeSizeSelect", (element) => (element as HTMLSelectElement).disabled)).toBe(true);
      await expectAttribute(addon.ui, "#recentList button", "aria-label", messages.unblockNamed.message.replace("$CREATOR$", locale.creator));
      await addon.ui.locator("#recentList button").click();
      await expectText(addon.ui, "#blockedCount", "0");
      expect(await addon.getStorage("cfBlockedChannels")).toEqual({ cfBlockedChannels: [] });
    });

    test("translates block and Undo without changing YouTube's language or creator names", async ({ addon }, testInfo) => {
      const card = '[data-testid="localized-creator"]';
      await openFixture(addon.page, creatorCard({ id: "localized-creator", handle: `@${locale.creator}`, displayName: locale.creator }));
      await expectAttribute(addon.page, "html", "lang", "en");
      await expectAttribute(addon.page, `${card} .cf-block-button`, "aria-label", messages.contentBlockNamed.message.replace("$CREATOR$", locale.creator));
      await captureAction(addon.page, `${card} .cf-block-button`, testInfo, `${locale.catalogCode}-fixture-block-button`);
      await addon.page.locator(`${card} .cf-block-button`).click();
      await expectVisible(addon.page, card, false);
      await expectContainsText(addon.page, "#cf-toast", messages.contentBlocked.message.replace("$CREATOR$", locale.creator));
      await captureAction(addon.page, "#cf-toast", testInfo, `${locale.catalogCode}-fixture-block-confirmation`);
      await expectText(addon.page, "#cf-toast button", messages.contentUndo.message);
      await addon.page.locator("#cf-toast button").click();
      await expectVisible(addon.page, card);
      expect(await addon.getStorage("cfBlockedChannels")).toEqual({ cfBlockedChannels: [] });
    });

    test("translates onboarding and privacy while keeping long text and links usable", async ({ addon }, testInfo) => {
      await addon.ui.setViewport({ width: 390, height: 844 });
      for (const [pageName, heading] of [["welcome", messages.welcomeHeadline.message], ["privacy", messages.privacyTitle.message]]) {
        await openExtensionPage(addon.ui, `${addon.origin}/ui/${pageName}.html`);
        await expectAttribute(addon.ui, "html", "lang", messages.languageCode.message);
        await expectText(addon.ui, "h1", heading);
        expect(await addon.ui.$eval("body", (element) => element.textContent)).not.toContain("undefined");
        expect(await addon.ui.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
        await captureExtensionDom(addon.ui, testInfo, `${locale.catalogCode}-ui-${pageName}`);
      }
      await expectText(addon.ui, '[data-i18n="privacyInformation"]', messages.privacyInformation.message);
      await expectText(addon.ui, '[data-i18n="privacyStorage"]', messages.privacyStorage.message);
      await expectAttribute(addon.ui, '[data-i18n="privacyContact"] a', "href", "https://github.com/boahs/ChannelFence/issues");
      await expectText(addon.ui, '[data-i18n="privacyContact"] a', messages.issueTracker.message);
      await expectText(addon.ui, '[data-i18n="privacyContact"]', messages.privacyContact.message.replace("$LINK$", messages.issueTracker.message));
    });

    test("translates the Shorts viewer action and menu in a fixture", async ({ addon }, testInfo) => {
      await openFixture(addon.page, shortsViewer(locale.creator, `@${locale.creator}`), "/shorts/localized-actions", locale.youtubeLanguage);
      const action = '[data-testid="shorts-action-bar"] > .cf-shorts-action';
      await expectVisible(addon.page, `${action} button`);
      await expectAttribute(addon.page, `${action} button`, "aria-label", messages.contentBlockWithBrand.message.replace("$CREATOR$", locale.creator));
      expect(await addon.page.$eval(`${action} button`, (element) => ({ width: getComputedStyle(element).width, height: getComputedStyle(element).height })))
        .toEqual({ width: "48px", height: "48px" });
      await expectText(addon.page, `${action} .cf-shorts-action__label`, messages.contentBlock.message);
      await expectInViewport(addon.page, action);
      const layout = await addon.page.$eval(action, (element) => {
        const label = element.querySelector<HTMLElement>(".cf-shorts-action__label")!;
        const labelBounds = label.getBoundingClientRect();
        const actionBounds = element.getBoundingClientRect();
        return {
          captionOverflow: Math.max(label.scrollWidth - label.clientWidth, label.scrollHeight - label.clientHeight),
          captionWithinAction: labelBounds.left >= actionBounds.left && labelBounds.right <= actionBounds.right && labelBounds.top >= actionBounds.top && labelBounds.bottom <= actionBounds.bottom,
          captionAfterButton: labelBounds.top >= element.querySelector("button")!.getBoundingClientRect().bottom,
          gapToNextAction: element.nextElementSibling!.getBoundingClientRect().top - actionBounds.bottom
        };
      });
      expect(layout.captionOverflow).toBeLessThanOrEqual(1);
      expect(layout.captionWithinAction).toBe(true);
      expect(layout.captionAfterButton).toBe(true);
      expect(layout.gapToNextAction).toBeGreaterThanOrEqual(0);
      await captureAction(addon.page, action, testInfo, `${locale.catalogCode}-fixture-shorts-action`);
      await openCreatorMenu(addon.page, '[data-testid="shorts-menu"]');
      await expectAttribute(addon.page, ".cf-menu-item", "aria-label", messages.contentBlockWithBrand.message.replace("$CREATOR$", locale.creator));
      await expectText(addon.page, ".cf-menu-item__label", messages.contentMenuBlock.message);
      await captureAction(addon.page, ".cf-menu-item", testInfo, `${locale.catalogCode}-fixture-shorts-menu`);
      expect(await addon.getStorage("cfBlockedChannels")).toEqual({ cfBlockedChannels: [] });
    });

    test("translates import feedback and counts for one, two and five creators", async ({ addon }) => {
      await openOptions(addon);
      for (const count of [1, 2, 5]) {
        const entries = Array.from({ length: count }, (_, index) => blockedCreator(`@${locale.creator}${index}`, `${locale.creator}${index}`));
        // BiDi cannot setFiles on privileged pages. Exercise the real file-input
        // change handler with a browser File, as the existing Firefox import test does.
        await addon.ui.$eval("#importFile", (input, data) => {
          const transfer = new DataTransfer();
          transfer.items.add(new File([data], "localized-creators.json", { type: "application/json" }));
          (input as HTMLInputElement).files = transfer.files;
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }, JSON.stringify({ blockedChannels: entries }));
        const message = count === 1 ? messages.importedCreatorOne : messages.importedCreatorOther;
        await expectText(addon.ui, "#toast", message.message.replace("$COUNT$", String(count)));
        await expectText(addon.ui, "#blockedCount", String(count));
        expect((await addon.getStorage("cfBlockedChannels")).cfBlockedChannels).toHaveLength(count);
      }
      await openExtensionPage(addon.ui, `${addon.origin}/ui/popup.html`);
      await expectText(addon.ui, "#statusText", messages.blockedCount.message.replace("$COUNT$", "5"));
    });
  });
}

for (const scenario of [
  { name: "Latin American Spanish browser locale", browserLocale: "es-MX", nativeLanguage: /^es-MX$/i, locale: allLocales.find((locale) => locale.catalogCode === "es")! },
  { name: "untranslated browser locale", browserLocale: "pl-PL", nativeLanguage: /^pl(?:-|$)/, locale: allLocales[0] }
]) {
  test.describe(scenario.name, () => {
    test.use({ browserLocale: scenario.browserLocale });
    test("automatically resolves the base catalog for static and dynamic messages", async ({ addon }) => {
      const messages = firefoxMessages(scenario.locale);
      await expectNativeLanguage(addon, scenario.nativeLanguage);
      await addon.setStorage({ cfBlockedChannels: [blockedCreator("@example", "Example")] });
      await openOptions(addon);
      await expectValue(addon.ui, "#languageSelect", "auto");
      await expect.poll(() => addon.ui.title()).toBe(messages.settingsPageTitle.message);
      await openExtensionPage(addon.ui, `${addon.origin}/ui/popup.html`);
      await expectAttribute(addon.ui, "html", "lang", messages.languageCode.message);
      await expectText(addon.ui, "#openOptions", messages.manageBlockList.message);
      await expectText(addon.ui, "#statusText", messages.blockedCount.message.replace("$COUNT$", "1"));
      await expectAttribute(addon.ui, "#recentList button", "aria-label", messages.unblockNamed.message.replace("$CREATOR$", "example"));
    });
  });
}
