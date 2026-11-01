import { blockedCreator, expect, test } from "../fixtures/extension.fixture";
import es from "../../../_locales/es/messages.json";
import { translatedLocales } from "../fixtures/locales";
import { creatorCard } from "../fixtures/youtube-fixtures";
import { OptionsPage, PopupPage } from "../pages/extension-ui.page";
import { YouTubeSurfacePage } from "../pages/youtube-surface.page";

for (const locale of translatedLocales) {
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
      await extensionPage.getByRole("textbox", { name: messages.manualBlockLabel.message })
        .fill(`@${locale.creator}`);
      await extensionPage.getByRole("button", { name: messages.blockCreator.message, exact: true }).click();
      await expect(extensionPage.locator("#blockedCount")).toHaveText("1");
      await expect(extensionPage.locator("#blockList")).toContainText(locale.creator);
      expect((await extensionStorage.get<{ cfBlockedChannels: Array<{ key: string }> }>(
        "cfBlockedChannels"
      )).cfBlockedChannels[0].key).toBe(`handle:@${locale.creator}`);
      await testInfo.attach(`${locale.youtubeLanguage}-settings`, {
        body: await extensionPage.screenshot({ fullPage: true }), contentType: "image/png"
      });

      const popup = new PopupPage(extensionPage, extensionId);
      await extensionPage.setViewportSize({ width: 360, height: 800 });
      await popup.open();
      await expect(extensionPage.locator("#statusText"))
        .toHaveText(messages.blockedCount.message.replace("$COUNT$", "1"));
      await expect(extensionPage.getByRole("checkbox", { name: messages.hideShortsAccessible.message }))
        .toBeAttached();
      await expect(extensionPage.getByRole("button", { name: messages.manageBlockList.message }))
        .toBeVisible();
      expect(await extensionPage.locator("body").evaluate((body) => body.scrollWidth - body.clientWidth))
        .toBeLessThanOrEqual(1);
      await testInfo.attach(`${locale.youtubeLanguage}-popup`, {
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
    }) => {
      const youtube = new YouTubeSurfacePage(extensionPage);
      await youtube.open(creatorCard({
        id: "localized-creator", handle: `@${locale.creator}`, displayName: locale.creator
      }));
      await expect(extensionPage.locator("html")).toHaveAttribute("lang", "en");
      await extensionPage.getByRole("button", {
        name: messages.contentBlockNamed.message.replace("$CREATOR$", locale.creator), exact: true
      }).click();
      await expect(youtube.card("localized-creator")).toBeHidden();
      await expect(extensionPage.locator("#cf-toast"))
        .toContainText(messages.contentBlocked.message.replace("$CREATOR$", locale.creator));
      await extensionPage.getByRole("button", { name: messages.contentUndo.message, exact: true }).click();
      await expect(youtube.card("localized-creator")).toBeVisible();
      expect((await extensionStorage.get<{ cfBlockedChannels: unknown[] }>("cfBlockedChannels"))
        .cfBlockedChannels).toEqual([]);
    });

    test("translates onboarding and privacy while keeping long text and links usable", async ({
      extensionId, extensionPage
    }) => {
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
    expect(await serviceWorker.evaluate<string>("chrome.i18n.getUILanguage()"))
      .toBe("es-419");
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
