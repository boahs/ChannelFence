import en from "../../../_locales/en/messages.json";
import ar from "../../../_locales/ar/messages.json";
import { blockedCreator, expect, test } from "../fixtures/extension.fixture";
import { channelHeader, creatorCard } from "../fixtures/youtube-fixtures";
import { OptionsPage, PopupPage } from "../pages/extension-ui.page";
import { YouTubeSurfacePage } from "../pages/youtube-surface.page";

for (const scenario of [
  {
    name: "Arabic override in an English browser and YouTube page",
    browserLocale: "en-US", browserLanguage: /^en(?:-|$)/,
    youtubeLanguage: "en", originalDirection: "ltr", originalMessages: en,
    selectedLanguage: "ar", direction: "rtl", messages: ar
  },
  {
    name: "English override in an Arabic browser and YouTube page",
    browserLocale: "ar", browserLanguage: /^ar(?:-|$)/,
    youtubeLanguage: "ar", originalDirection: "rtl", originalMessages: ar,
    selectedLanguage: "en", direction: "ltr", messages: en
  }
]) {
  test.describe(scenario.name, () => {
    test.use({ locale: scenario.browserLocale });

    test("changes extension direction while preserving YouTube and mixed-script identities", async ({
      extensionContext, extensionId, extensionPage, extensionStorage, serviceWorker
    }, testInfo) => {
      const creator = "Mixed123 مطبخ";
      const handleUrl = "https://www.youtube.com/@Mixed123";
      await extensionStorage.set({
        cfBlockedChannels: [blockedCreator("@Blocked456", "قناة Blocked456")]
      });
      expect(await serviceWorker.evaluate<string>("chrome.i18n.getUILanguage()"))
        .toMatch(scenario.browserLanguage);

      const options = new OptionsPage(extensionPage, extensionId);
      await options.open();
      await expect(extensionPage.locator("html")).toHaveAttribute("dir", scenario.originalDirection);
      await expect(extensionPage.locator("#manualBlockInput")).toHaveAttribute("dir", "auto");
      await expect(extensionPage.locator("#searchInput")).toHaveAttribute("dir", "auto");
      await extensionPage.locator("#manualBlockInput").fill(handleUrl);

      const popupPage = await extensionContext.newPage();
      await new PopupPage(popupPage, extensionId).open();
      const youtubePage = await extensionContext.newPage();
      const youtube = new YouTubeSurfacePage(youtubePage);
      await youtube.open(creatorCard({
        id: "mixed-creator", handle: "@Mixed123", displayName: creator
      }), "/__channelfence_fixture__/rtl", scenario.youtubeLanguage);
      await youtubePage.evaluate((direction) => {
        document.documentElement.dir = direction;
      }, scenario.originalDirection);
      const menu = await youtube.openCreatorMenu("mixed-creator-menu");
      await expect(menu).toHaveAttribute("dir", scenario.originalDirection);

      const channelPage = await extensionContext.newPage();
      const channel = new YouTubeSurfacePage(channelPage);
      await channel.open(channelHeader("قناة Blocked456", "@Blocked456"),
        "/@Blocked456", scenario.youtubeLanguage);
      await channelPage.evaluate((direction) => {
        document.documentElement.dir = direction;
      }, scenario.originalDirection);
      const overlay = channelPage.locator("#cf-hard-block-overlay");
      await expect(overlay).toHaveAttribute("dir", scenario.originalDirection);

      await extensionPage.locator("#languageSelect").selectOption(scenario.selectedLanguage);
      await expect(extensionPage.locator("html")).toHaveAttribute("dir", scenario.direction);
      await expect(extensionPage.locator("html"))
        .toHaveAttribute("lang", scenario.messages.languageCode.message);
      await expect(extensionPage.locator("#manualBlockInput")).toHaveValue(handleUrl);
      await expect(extensionPage.locator("#manualBlockInput")).toHaveCSS("direction", "ltr");
      await expect(extensionPage.locator(".block-list__name")).toHaveAttribute("dir", "auto");
      await expect(popupPage.locator("html")).toHaveAttribute("dir", scenario.direction);
      await expect(popupPage.locator("html")).toHaveCSS("direction", scenario.direction);
      await expect(popupPage.locator("#statusText"))
        .toHaveText(scenario.messages.blockedCount.message.replace("$COUNT$", "1"));
      await expect(popupPage.locator(".mini-list__name")).toHaveText("blocked456");
      await expect(popupPage.locator(".mini-list__name")).toHaveAttribute("dir", "auto");

      await youtubePage.bringToFront();
      await expect(menu).toHaveAttribute("dir", scenario.direction);
      await expect(menu).toHaveCSS("direction", scenario.direction);
      await expect(menu.locator(".cf-menu-item__label"))
        .toHaveText(scenario.messages.contentMenuBlock.message);
      await expect(menu).toHaveAttribute("aria-label",
        scenario.messages.contentBlockWithBrand.message.replace("$CREATOR$", creator));
      const creatorLink = youtube.card("mixed-creator").locator("ytd-channel-name a");
      await expect(creatorLink).toHaveText(creator);
      await expect(creatorLink).toHaveAttribute("href", "/@Mixed123");
      await expect(youtubePage.locator("html")).toHaveAttribute("lang", scenario.youtubeLanguage);
      await expect(youtubePage.locator("html")).toHaveAttribute("dir", scenario.originalDirection);
      await menu.click();
      await expect(youtube.card("mixed-creator")).toBeHidden();
      await expect(youtubePage.locator("#cf-toast")).toHaveAttribute("dir", scenario.direction);
      await expect(youtubePage.locator("#cf-toast"))
        .toContainText(scenario.messages.contentBlocked.message.replace("$CREATOR$", "mixed123"));
      expect((await extensionStorage.get<{ cfBlockedChannels: Array<{ key: string }> }>(
        "cfBlockedChannels"
      )).cfBlockedChannels.map((entry) => entry.key)).toEqual([
        "handle:@mixed123", "handle:@blocked456"
      ]);
      await youtubePage.getByRole("button", {
        name: scenario.messages.contentUndo.message, exact: true
      }).click();
      await expect(youtube.card("mixed-creator")).toBeVisible();
      const reopenedMenu = await youtube.openCreatorMenu("mixed-creator-menu");

      await channelPage.bringToFront();
      await expect(overlay).toHaveAttribute("dir", scenario.direction);
      await expect(overlay).toHaveCSS("direction", scenario.direction);
      await expect(overlay.getByRole("heading"))
        .toHaveText(scenario.messages.contentCreatorBlocked.message);
      await expect(overlay).toContainText(
        scenario.messages.contentBlockedDescription.message.replace("$CREATOR$", "blocked456")
      );
      await expect(channelPage.locator("html")).toHaveAttribute("lang", scenario.youtubeLanguage);
      await expect(channelPage.locator("html")).toHaveAttribute("dir", scenario.originalDirection);
      await testInfo.attach(`${scenario.selectedLanguage}-extra-rtl-overlay`, {
        body: await overlay.screenshot(), contentType: "image/png"
      });

      await extensionPage.locator("#languageSelect").selectOption("auto");
      await expect(extensionPage.locator("html")).toHaveAttribute("dir", scenario.originalDirection);
      await expect(popupPage.locator("html")).toHaveAttribute("dir", scenario.originalDirection);
      await channelPage.bringToFront();
      await expect(overlay).toHaveAttribute("dir", scenario.originalDirection);
      await expect(overlay.getByRole("heading"))
        .toHaveText(scenario.originalMessages.contentCreatorBlocked.message);
      await youtubePage.bringToFront();
      await expect(reopenedMenu).toHaveAttribute("dir", scenario.originalDirection);
      await expect(reopenedMenu.locator(".cf-menu-item__label"))
        .toHaveText(scenario.originalMessages.contentMenuBlock.message);
      await expect(creatorLink).toHaveText(creator);
      await expect(creatorLink).toHaveAttribute("href", "/@Mixed123");
      await expect(youtubePage.locator("html")).toHaveAttribute("dir", scenario.originalDirection);
      expect((await extensionStorage.get<{ cfBlockedChannels: Array<{ key: string }> }>(
        "cfBlockedChannels"
      )).cfBlockedChannels.map((entry) => entry.key)).toEqual(["handle:@blocked456"]);

      await popupPage.close();
      await youtubePage.close();
      await channelPage.close();
    });
  });
}
