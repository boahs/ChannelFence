import { blockedCreator, expect, test } from "../fixtures/extension.fixture";
import es from "../../../_locales/es/messages.json";
import { allLocales } from "../fixtures/locales";
import { creatorCard, shortsViewer } from "../fixtures/youtube-fixtures";
import { OptionsPage, PopupPage } from "../pages/extension-ui.page";
import { YouTubeSurfacePage } from "../pages/youtube-surface.page";

for (const locale of allLocales) {
  const messages = locale.messages;

  test.describe(`${locale.name} extension UI`, () => {
    test.use({ locale: locale.browserLocale });

    test.beforeEach(async ({ serviceWorker }) => {
      expect(await serviceWorker.evaluate<string>("chrome.i18n.getUILanguage()"))
        .toMatch(locale.uiLanguage);
    });

    test("translates settings and popup while preserving a Unicode handle", async ({
      extensionId, extensionPage, extensionStorage
    }, testInfo) => {
      const options = new OptionsPage(extensionPage, extensionId);
      await options.open();
      await expect(extensionPage.locator("html")).toHaveAttribute("lang", messages.languageCode.message);
      await expect(extensionPage).toHaveTitle(messages.settingsPageTitle.message);
      for (const [label, help] of [
        [messages.hideHomeAds, messages.hideHomeAdsHelp],
        [messages.hideHomePromotions, messages.hideHomePromotionsHelp],
        [messages.compactHomeGrid, messages.compactHomeGridHelp]
      ]) {
        const toggle = extensionPage.getByRole("checkbox", { name: label.message, exact: true });
        await expect(toggle).not.toBeChecked();
        await expect(toggle).toHaveAccessibleDescription(help.message);
      }
      const optionsSize = extensionPage.getByRole("combobox", { name: messages.compactHomeSize.message });
      await expect(optionsSize).toBeDisabled();
      await expect(optionsSize).toHaveValue("medium");
      await expect(optionsSize.locator("option")).toHaveText([
        messages.compactHomeSizeSmall.message,
        messages.compactHomeSizeMedium.message,
        messages.compactHomeSizeLarge.message
      ]);
      await extensionPage.getByRole("textbox", { name: messages.manualBlockLabel.message })
        .fill(`@${locale.creator}`);
      await extensionPage.getByRole("button", { name: messages.blockCreator.message, exact: true }).click();
      await expect(extensionPage.locator("#blockedCount")).toHaveText("1");
      await expect(extensionPage.locator("#blockList")).toContainText(locale.creator);
      expect((await extensionStorage.get<{ cfBlockedChannels: Array<{ key: string }> }>(
        "cfBlockedChannels"
      )).cfBlockedChannels[0].key).toBe(`handle:@${locale.creator}`);
      await expect(extensionPage.locator("#toast")).not.toHaveClass(/toast--visible/);
      await testInfo.attach(`${locale.catalogCode}-ui-settings`, {
        body: await extensionPage.screenshot({ fullPage: true }), contentType: "image/png"
      });

      const popup = new PopupPage(extensionPage, extensionId);
      await extensionPage.setViewportSize({ width: 360, height: 600 });
      await popup.open();
      await expect(extensionPage.locator("#statusText"))
        .toHaveText(messages.blockedCount.message.replace("$COUNT$", "1"));
      await expect(extensionPage.getByRole("checkbox", { name: messages.hideShortsAccessible.message }))
        .toBeAttached();
      for (const [label, help] of [
        [messages.hideHomeAds, messages.hideHomeAdsHelp],
        [messages.hideHomePromotions, messages.hideHomePromotionsHelp],
        [messages.compactHomeGrid, messages.compactHomeGridHelp]
      ]) {
        const toggle = extensionPage.getByRole("checkbox", { name: label.message, exact: true });
        await expect(toggle).not.toBeChecked();
        await expect(toggle).toHaveAccessibleDescription(help.message);
      }
      const popupSize = extensionPage.getByRole("combobox", { name: messages.compactHomeSize.message });
      await expect(popupSize).toBeDisabled();
      await expect(popupSize).toHaveValue("medium");
      await expect(popupSize.locator("option")).toHaveText([
        messages.compactHomeSizeSmall.message,
        messages.compactHomeSizeMedium.message,
        messages.compactHomeSizeLarge.message
      ]);
      await expect(extensionPage.getByRole("button", { name: messages.manageBlockList.message }))
        .toBeInViewport({ ratio: 1 });
      await expect(extensionPage.locator(".popup__header")).toBeInViewport({ ratio: 1 });
      await expect(extensionPage.locator(".popup__footer")).toBeInViewport({ ratio: 1 });
      expect(await extensionPage.locator("body").evaluate((body) => body.scrollWidth - body.clientWidth))
        .toBeLessThanOrEqual(1);
      expect(await extensionPage.locator(".popup__main").evaluate((main) => main.scrollWidth - main.clientWidth))
        .toBeLessThanOrEqual(1);
      await testInfo.attach(`${locale.catalogCode}-ui-popup`, {
        body: await extensionPage.locator("body").screenshot(), contentType: "image/png"
      });
      await popupSize.scrollIntoViewIfNeeded();
      await expect(popupSize).toBeInViewport({ ratio: 1 });
      await expect(extensionPage.locator(".popup__header")).toBeInViewport({ ratio: 1 });
      await expect(extensionPage.locator(".popup__footer")).toBeInViewport({ ratio: 1 });
      await expect(extensionPage.getByRole("button", { name: messages.manageBlockList.message }))
        .toBeInViewport({ ratio: 1 });
      await testInfo.attach(`${locale.catalogCode}-ui-popup-home-controls`, {
        body: await extensionPage.locator("body").screenshot(), contentType: "image/png"
      });
      await extensionPage.getByRole("button", {
        name: messages.unblockNamed.message.replace("$CREATOR$", locale.creator), exact: true
      }).click();
      await expect(extensionPage.locator("#blockedCount")).toHaveText("0");
      expect((await extensionStorage.get<{ cfBlockedChannels: unknown[] }>("cfBlockedChannels"))
        .cfBlockedChannels).toEqual([]);
    });

    test("translates block and Undo without changing YouTube's language or creator names", async ({
      extensionPage, extensionStorage
    }, testInfo) => {
      const youtube = new YouTubeSurfacePage(extensionPage);
      await youtube.open(creatorCard({
        id: "localized-creator", handle: `@${locale.creator}`, displayName: locale.creator
      }));
      await expect(extensionPage.locator("html")).toHaveAttribute("lang", "en");
      const blockButton = extensionPage.getByRole("button", {
        name: messages.contentBlockNamed.message.replace("$CREATOR$", locale.creator), exact: true
      });
      await expect(blockButton).toBeVisible();
      await testInfo.attach(`${locale.catalogCode}-fixture-block-button`, {
        body: await youtube.card("localized-creator").screenshot(), contentType: "image/png"
      });
      await blockButton.click();
      await expect(youtube.card("localized-creator")).toBeHidden();
      await expect(extensionPage.locator("#cf-toast"))
        .toContainText(messages.contentBlocked.message.replace("$CREATOR$", locale.creator));
      await testInfo.attach(`${locale.catalogCode}-fixture-block-confirmation`, {
        body: await extensionPage.locator("#cf-toast").screenshot(), contentType: "image/png"
      });
      await extensionPage.getByRole("button", { name: messages.contentUndo.message, exact: true }).click();
      await expect(youtube.card("localized-creator")).toBeVisible();
      expect((await extensionStorage.get<{ cfBlockedChannels: unknown[] }>("cfBlockedChannels"))
        .cfBlockedChannels).toEqual([]);
    });

    test("translates onboarding and privacy while keeping long text and links usable", async ({
      extensionId, extensionPage
    }, testInfo) => {
      await extensionPage.setViewportSize({ width: 390, height: 844 });
      for (const [pageName, heading] of [
        ["welcome", messages.welcomeHeadline.message],
        ["privacy", messages.privacyTitle.message]
      ]) {
        await extensionPage.goto(`chrome-extension://${extensionId}/ui/${pageName}.html`);
        await expect(extensionPage.locator("html")).toHaveAttribute("lang", messages.languageCode.message);
        await expect(extensionPage.locator("h1")).toHaveText(heading);
        await expect(extensionPage.locator("body")).not.toContainText("undefined");
        expect(await extensionPage.evaluate(() => document.documentElement.scrollWidth - innerWidth))
          .toBeLessThanOrEqual(1);
        await testInfo.attach(`${locale.catalogCode}-ui-${pageName}`, {
          body: await extensionPage.screenshot({ fullPage: true }), contentType: "image/png"
        });
      }
      await expect(extensionPage.locator('[data-i18n="privacyInformation"]'))
        .toHaveText(messages.privacyInformation.message);
      await expect(extensionPage.locator('[data-i18n="privacyStorage"]'))
        .toHaveText(messages.privacyStorage.message);
      await expect(extensionPage.getByRole("link", { name: messages.issueTracker.message }))
        .toHaveAttribute("href", "https://github.com/boahs/ChannelFence/issues");
      await expect(extensionPage.locator('[data-i18n="privacyContact"]'))
        .toHaveText(messages.privacyContact.message.replace("$LINK$", messages.issueTracker.message));
    });

    test("translates the Shorts viewer action and menu in a fixture", async ({
      extensionPage, extensionStorage
    }, testInfo) => {
      const youtube = new YouTubeSurfacePage(extensionPage);
      await youtube.open(
        shortsViewer(locale.creator, `@${locale.creator}`),
        "/shorts/localized-actions",
        locale.youtubeLanguage
      );
      const action = youtube.card("shorts-action-bar").locator(":scope > .cf-shorts-action");
      const blockButton = action.getByRole("button", {
        name: messages.contentBlockWithBrand.message.replace("$CREATOR$", locale.creator), exact: true
      });
      await expect(blockButton).toBeVisible();
      await expect(blockButton).toHaveCSS("width", "48px");
      await expect(blockButton).toHaveCSS("height", "48px");
      await expect(action.locator(".cf-shorts-action__label")).toHaveText(messages.contentBlock.message);
      await expect(action).toBeInViewport({ ratio: 1 });
      const layout = await action.evaluate((element) => {
        const label = element.querySelector<HTMLElement>(".cf-shorts-action__label")!;
        const labelBounds = label.getBoundingClientRect();
        const actionBounds = element.getBoundingClientRect();
        const buttonBounds = element.querySelector("button")!.getBoundingClientRect();
        const nextActionBounds = element.nextElementSibling!.getBoundingClientRect();
        return {
          captionOverflow: Math.max(label.scrollWidth - label.clientWidth, label.scrollHeight - label.clientHeight),
          captionWithinAction: labelBounds.left >= actionBounds.left && labelBounds.right <= actionBounds.right &&
            labelBounds.top >= actionBounds.top && labelBounds.bottom <= actionBounds.bottom,
          captionAfterButton: labelBounds.top >= buttonBounds.bottom,
          gapToNextAction: nextActionBounds.top - actionBounds.bottom
        };
      });
      expect(layout.captionOverflow).toBeLessThanOrEqual(1);
      expect(layout.captionWithinAction).toBe(true);
      expect(layout.captionAfterButton).toBe(true);
      expect(layout.gapToNextAction).toBeGreaterThanOrEqual(0);
      await testInfo.attach(`${locale.catalogCode}-fixture-shorts-action`, {
        body: await youtube.card("shorts-viewer").screenshot(), contentType: "image/png"
      });

      const menuItem = await youtube.openCreatorMenu("shorts-menu");
      await expect(menuItem).toHaveAttribute(
        "aria-label", messages.contentBlockWithBrand.message.replace("$CREATOR$", locale.creator)
      );
      await expect(menuItem.locator(".cf-menu-item__label")).toHaveText(messages.contentMenuBlock.message);
      await testInfo.attach(`${locale.catalogCode}-fixture-shorts-menu`, {
        body: await extensionPage.locator("ytd-menu-popup-renderer").screenshot(), contentType: "image/png"
      });
      expect((await extensionStorage.get<{ cfBlockedChannels: unknown[] }>("cfBlockedChannels"))
        .cfBlockedChannels).toEqual([]);
    });

    test("translates import feedback and counts for one, two and five creators", async ({
      extensionId, extensionPage, extensionStorage
    }) => {
      const options = new OptionsPage(extensionPage, extensionId);
      await options.open();
      for (const count of [1, 2, 5]) {
        const entries = Array.from({ length: count }, (_, index) =>
          blockedCreator(`@${locale.creator}${index}`, `${locale.creator}${index}`));
        await extensionPage.locator("#importFile").setInputFiles({
          name: "localized-creators.json", mimeType: "application/json",
          buffer: Buffer.from(JSON.stringify({ blockedChannels: entries }))
        });
        const message = count === 1 ? messages.importedCreatorOne : messages.importedCreatorOther;
        await expect(extensionPage.locator("#toast"))
          .toHaveText(message.message.replace("$COUNT$", String(count)));
        await expect(extensionPage.locator("#blockedCount")).toHaveText(String(count));
        expect((await extensionStorage.get<{ cfBlockedChannels: unknown[] }>("cfBlockedChannels"))
          .cfBlockedChannels).toHaveLength(count);
      }
      const popup = new PopupPage(extensionPage, extensionId);
      await popup.open();
      await expect(extensionPage.locator("#statusText"))
        .toHaveText(messages.blockedCount.message.replace("$COUNT$", "5"));
    });
  });
}

test.describe("Latin American Spanish browser locale", () => {
  test.use({ locale: "es-419" });

  test("automatically uses the base Spanish catalog for static and dynamic messages", async ({
    extensionId, extensionPage, extensionStorage, serviceWorker
  }) => {
    // Chromium reports its Latin American Spanish UI as es-MX for an es-419 profile.
    expect(await serviceWorker.evaluate<string>("chrome.i18n.getUILanguage()"))
      .toBe("es-MX");
    await extensionStorage.set({ cfBlockedChannels: [blockedCreator("@example", "Example")] });
    const options = new OptionsPage(extensionPage, extensionId);
    await options.open();
    await expect(extensionPage.locator("#languageSelect")).toHaveValue("auto");
    await expect(extensionPage).toHaveTitle(es.settingsPageTitle.message);
    const popup = new PopupPage(extensionPage, extensionId);
    await popup.open();
    await expect(extensionPage.locator("html")).toHaveAttribute("lang", "es");
    await expect(extensionPage.getByRole("button", { name: es.manageBlockList.message })).toBeVisible();
    await expect(extensionPage.locator("#statusText"))
      .toHaveText(es.blockedCount.message.replace("$COUNT$", "1"));
    await expect(extensionPage.getByRole("button", {
      name: es.unblockNamed.message.replace("$CREATOR$", "example"), exact: true
    })).toBeVisible();
  });
});

test.describe("untranslated browser locale", () => {
  test.use({ locale: "pl-PL" });

  test("falls back to English for both static and dynamic messages", async ({
    extensionId, extensionPage, extensionStorage, serviceWorker
  }) => {
    expect(await serviceWorker.evaluate<string>("chrome.i18n.getUILanguage()"))
      .toMatch(/^pl(?:-|$)/);
    await extensionStorage.set({ cfBlockedChannels: [blockedCreator("@example", "Example")] });
    const popup = new PopupPage(extensionPage, extensionId);
    await popup.open();
    await expect(extensionPage.locator("html")).toHaveAttribute("lang", "en");
    await expect(extensionPage.getByRole("button", { name: "Manage block list" })).toBeVisible();
    await expect(extensionPage.locator("#statusText")).toHaveText("1 blocked");
    await expect(extensionPage.getByRole("button", { name: "Unblock example" })).toBeVisible();
  });
});
