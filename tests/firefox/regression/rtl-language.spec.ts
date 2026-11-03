import en from "../../../_locales/en/messages.json";
import ar from "../../../_locales/ar/messages.json";
import { blockedCreator } from "../../e2e/fixtures/extension.fixture";
import { channelHeader, creatorCard } from "../../e2e/fixtures/youtube-fixtures";
import { expect, expectContainsText, expectAttribute, expectValue, expectText, expectVisible, openCreatorMenu, openExtensionTab, openFixture, openOptions, test } from "../extension.fixture";
import { captureAction, expectNativeLanguage } from "../locale-checks";

for (const scenario of [
  { name: "Arabic override in an English browser and YouTube page", browserLocale: "en-US", browserLanguage: /^en(?:-|$)/,
    youtubeLanguage: "en", originalDirection: "ltr", originalMessages: en, selectedLanguage: "ar", direction: "rtl", messages: ar },
  { name: "English override in an Arabic browser and YouTube page", browserLocale: "ar", browserLanguage: /^ar(?:-|$)/,
    youtubeLanguage: "ar", originalDirection: "rtl", originalMessages: ar, selectedLanguage: "en", direction: "ltr", messages: en }
]) {
  test.describe(scenario.name, () => {
    test.use({ browserLocale: scenario.browserLocale });
    test("changes extension direction while preserving YouTube and mixed-script identities", async ({ addon }, testInfo) => {
      const creator = "Mixed123 مطبخ";
      const handleUrl = "https://www.youtube.com/@Mixed123";
      await addon.setStorage({ cfBlockedChannels: [blockedCreator("@Blocked456", "قناة Blocked456")] });
      await expectNativeLanguage(addon, scenario.browserLanguage);
      await openOptions(addon);
      await expectAttribute(addon.ui, "html", "dir", scenario.originalDirection);
      await expectAttribute(addon.ui, "#manualBlockInput", "dir", "auto");
      await expectAttribute(addon.ui, "#searchInput", "dir", "auto");
      await addon.ui.locator("#manualBlockInput").fill(handleUrl);
      const popup = await openExtensionTab(addon, "/ui/popup.html");
      await openFixture(addon.page, creatorCard({ id: "mixed-creator", handle: "@Mixed123", displayName: creator }),
        "/__channelfence_fixture__/rtl", scenario.youtubeLanguage);
      await addon.page.evaluate((direction) => { document.documentElement.dir = direction; }, scenario.originalDirection);
      await openCreatorMenu(addon.page, '[data-testid="mixed-creator-menu"]');
      await expectAttribute(addon.page, ".cf-menu-item", "dir", scenario.originalDirection);
      const channel = await addon.browser.newPage();
      await openFixture(channel, channelHeader("قناة Blocked456", "@Blocked456"), "/@Blocked456", scenario.youtubeLanguage);
      await channel.evaluate((direction) => { document.documentElement.dir = direction; }, scenario.originalDirection);
      await expectAttribute(channel, "#cf-hard-block-overlay", "dir", scenario.originalDirection);

      await addon.ui.select("#languageSelect", scenario.selectedLanguage);
      await expectAttribute(addon.ui, "html", "dir", scenario.direction);
      await expectAttribute(addon.ui, "html", "lang", scenario.messages.languageCode.message);
      await expectValue(addon.ui, "#manualBlockInput", handleUrl);
      expect(await addon.ui.$eval("#manualBlockInput", (element) => getComputedStyle(element).direction)).toBe("ltr");
      await expectAttribute(addon.ui, ".block-list__name", "dir", "auto");
      await expectAttribute(popup, "html", "dir", scenario.direction);
      expect(await popup.$eval("html", (element) => getComputedStyle(element).direction)).toBe(scenario.direction);
      await expectText(popup, "#statusText", scenario.messages.blockedCount.message.replace("$COUNT$", "1"));
      await expectText(popup, ".mini-list__name", "blocked456");
      await expectAttribute(popup, ".mini-list__name", "dir", "auto");
      await addon.page.bringToFront();
      await expectAttribute(addon.page, ".cf-menu-item", "dir", scenario.direction);
      expect(await addon.page.$eval(".cf-menu-item", (element) => getComputedStyle(element).direction)).toBe(scenario.direction);
      await expectText(addon.page, ".cf-menu-item__label", scenario.messages.contentMenuBlock.message);
      await expectAttribute(addon.page, ".cf-menu-item", "aria-label", scenario.messages.contentBlockWithBrand.message.replace("$CREATOR$", creator));
      const creatorLink = '[data-testid="mixed-creator"] ytd-channel-name a';
      await expectText(addon.page, creatorLink, creator);
      await expectAttribute(addon.page, creatorLink, "href", "/@Mixed123");
      await expectAttribute(addon.page, "html", "lang", scenario.youtubeLanguage);
      await expectAttribute(addon.page, "html", "dir", scenario.originalDirection);
      await addon.page.locator(".cf-menu-item").click();
      await expectVisible(addon.page, '[data-testid="mixed-creator"]', false);
      await expectAttribute(addon.page, "#cf-toast", "dir", scenario.direction);
      await expectContainsText(addon.page, "#cf-toast", scenario.messages.contentBlocked.message.replace("$CREATOR$", "mixed123"));
      expect(((await addon.getStorage("cfBlockedChannels")).cfBlockedChannels as Array<{ key: string }>).map((entry) => entry.key))
        .toEqual(["handle:@mixed123", "handle:@blocked456"]);
      await expectText(addon.page, "#cf-toast button", scenario.messages.contentUndo.message);
      await addon.page.locator("#cf-toast button").click();
      await expectVisible(addon.page, '[data-testid="mixed-creator"]');
      await openCreatorMenu(addon.page, '[data-testid="mixed-creator-menu"]');
      await channel.bringToFront();
      await expectAttribute(channel, "#cf-hard-block-overlay", "dir", scenario.direction);
      expect(await channel.$eval("#cf-hard-block-overlay", (element) => getComputedStyle(element).direction)).toBe(scenario.direction);
      await expectText(channel, "#cf-hard-block-title", scenario.messages.contentCreatorBlocked.message);
      await expectContainsText(channel, "#cf-hard-block-overlay", scenario.messages.contentBlockedDescription.message.replace("$CREATOR$", "blocked456"));
      await expectAttribute(channel, "html", "lang", scenario.youtubeLanguage);
      await expectAttribute(channel, "html", "dir", scenario.originalDirection);
      await captureAction(channel, "#cf-hard-block-overlay", testInfo, `${scenario.selectedLanguage}-extra-rtl-overlay`);
      await addon.ui.select("#languageSelect", "auto");
      await expectAttribute(addon.ui, "html", "dir", scenario.originalDirection);
      await expectAttribute(popup, "html", "dir", scenario.originalDirection);
      await channel.bringToFront();
      await expectAttribute(channel, "#cf-hard-block-overlay", "dir", scenario.originalDirection);
      await expectText(channel, "#cf-hard-block-title", scenario.originalMessages.contentCreatorBlocked.message);
      await addon.page.bringToFront();
      await expectAttribute(addon.page, ".cf-menu-item", "dir", scenario.originalDirection);
      await expectText(addon.page, ".cf-menu-item__label", scenario.originalMessages.contentMenuBlock.message);
      await expectText(addon.page, creatorLink, creator);
      await expectAttribute(addon.page, creatorLink, "href", "/@Mixed123");
      await expectAttribute(addon.page, "html", "dir", scenario.originalDirection);
      expect(((await addon.getStorage("cfBlockedChannels")).cfBlockedChannels as Array<{ key: string }>).map((entry) => entry.key)).toEqual(["handle:@blocked456"]);
      await popup.close();
      await channel.close();
    });
  });
}
