import ja from "../../../_locales/ja/messages.json";
import ru from "../../../_locales/ru/messages.json";
import { allLocales } from "../../e2e/fixtures/locales";
import { blockedCreator } from "../../e2e/fixtures/extension.fixture";
import { channelHeader, creatorCard } from "../../e2e/fixtures/youtube-fixtures";
import {
  expect, expectContainsText, expectAttribute, expectCount, expectValue, expectText, expectVisible, openCreatorMenu, openExtensionPage, openExtensionTab,
  openFixture, openOptions, test
} from "../extension.fixture";
import { expectNativeLanguage, firefoxMessages } from "../locale-checks";

test.describe("extension language override", () => {
  test.use({ browserLocale: "en-US" });

  test("updates open extension pages, persists the selection, and returns to Firefox's language", async ({ addon }) => {
    await addon.setStorage({ cfBlockedChannels: [blockedCreator("@example", "Example")] });
    await openOptions(addon);
    await expectValue(addon.ui, "#languageSelect", "auto");
    await expectAttribute(addon.ui, "html", "lang", "en");
    const popup = await openExtensionTab(addon, "/ui/popup.html");
    const welcome = await openExtensionTab(addon, "/ui/welcome.html");
    const privacy = await openExtensionTab(addon, "/ui/privacy.html");
    for (const { value, messages } of [
      ...allLocales.map((locale) => ({ value: locale.catalogCode, messages: firefoxMessages(locale) })),
      { value: "auto", messages: firefoxMessages(allLocales[0]) }
    ]) {
      await addon.ui.select("#languageSelect", value);
      await expect.poll(() => addon.ui.title()).toBe(messages.settingsPageTitle.message);
      await expectText(addon.ui, 'label[for="manualBlockInput"]', messages.manualBlockLabel.message);
      await expectVisible(addon.ui, "#manualBlockInput");
      await expectAttribute(popup, "html", "lang", messages.languageCode.message);
      await expectText(popup, "#statusText", messages.blockedCount.message.replace("$COUNT$", "1"));
      await expectAttribute(popup, "#recentList button", "aria-label", messages.unblockNamed.message.replace("$CREATOR$", "example"));
      await expectVisible(popup, "#recentList button");
      await expectText(welcome, "h1", messages.welcomeHeadline.message);
      await expectText(privacy, "h1", messages.privacyTitle.message);
      await expectText(privacy, '[data-i18n="privacyContact"]', messages.privacyContact.message.replace("$LINK$", messages.issueTracker.message));
      await expectAttribute(privacy, '[data-i18n="privacyContact"] a', "href", "https://github.com/boahs/ChannelFence/issues");
      await expectVisible(privacy, '[data-i18n="privacyContact"] a');
      expect(await addon.getStorage("cfLanguage")).toEqual({ cfLanguage: value });
      await openExtensionPage(addon.ui, `${addon.origin}/ui/options.html`);
      await expectValue(addon.ui, "#languageSelect", value);
      await expectAttribute(addon.ui, "html", "lang", messages.languageCode.message);
      await expect.poll(() => addon.ui.title()).toBe(messages.settingsPageTitle.message);
    }
    await expectNativeLanguage(addon, /^en(?:-|$)/);
    expect(((await addon.getStorage("cfBlockedChannels")).cfBlockedChannels as Array<{ key: string }>).map((entry) => entry.key))
      .toEqual(["handle:@example"]);
    await popup.close();
    await welcome.close();
    await privacy.close();
  });

  test("relabels existing YouTube controls and an open blocked-channel overlay without changing identity", async ({ addon }) => {
    const creator = "日本の料理";
    await openOptions(addon);
    await openFixture(addon.page, creatorCard({ id: "language-creator", handle: `@${creator}`, displayName: creator }),
      "/__channelfence_fixture__/home", "ko");
    const card = '[data-testid="language-creator"]';
    await expectAttribute(addon.page, `${card} .cf-block-button`, "aria-label", `Block ${creator}`);
    await openCreatorMenu(addon.page, '[data-testid="language-creator-menu"]');
    await expectText(addon.page, ".cf-menu-item__label", "ChannelFence: Block");
    await addon.ui.select("#languageSelect", "ja");
    await addon.page.bringToFront();
    await expectAttribute(addon.page, `${card} .cf-block-button`, "aria-label", ja.contentBlockNamed.message.replace("$CREATOR$", creator));
    await expectText(addon.page, ".cf-menu-item__label", ja.contentMenuBlock.message);
    await expectAttribute(addon.page, "html", "lang", "ko");
    await expectText(addon.page, `${card} ytd-channel-name a`, creator);
    await addon.page.locator(".cf-menu-item").click();
    await expectVisible(addon.page, card, false);
    await expectContainsText(addon.page, "#cf-toast", ja.contentBlocked.message.replace("$CREATOR$", creator));
    await expectText(addon.page, "#cf-toast button", ja.contentUndo.message);
    await expectVisible(addon.page, "#cf-toast button");
    expect(((await addon.getStorage("cfBlockedChannels")).cfBlockedChannels as Array<{ key: string }>).map((entry) => entry.key)).toEqual([`handle:@${creator}`]);
    await expect.poll(() => addon.ui.evaluate(async () => {
      const api = (globalThis as unknown as { browser: {
        tabs: { query(query: { active: boolean; currentWindow: boolean }): Promise<Array<{ id: number }>> };
        action: { getTitle(options: { tabId: number }): Promise<string> };
      } }).browser;
      const [tab] = await api.tabs.query({ active: true, currentWindow: true });
      return api.action.getTitle({ tabId: tab.id });
    })).toBe(ja.actionBlockedCount.message.replace("$COUNT$", "1"));
    const channel = await addon.browser.newPage();
    await openFixture(channel, channelHeader(creator, `@${creator}`), `/@${creator}`, "ko");
    await expectText(channel, "#cf-hard-block-title", ja.contentCreatorBlocked.message);
    await addon.ui.select("#languageSelect", "ru");
    await channel.bringToFront();
    await expectText(channel, "#cf-hard-block-title", ru.contentCreatorBlocked.message);
    await expectContainsText(channel, "#cf-hard-block-overlay", ru.contentBlockedDescription.message.replace("$CREATOR$", creator));
    await expectText(channel, ".cf-hard-block-actions button:first-child", ru.contentGoHome.message);
    await expectVisible(channel, ".cf-hard-block-actions button:first-child");
    await expectAttribute(channel, "html", "lang", "ko");
    await expectVisible(addon.page, card, false);
    await expectText(channel, ".cf-hard-block-actions button:last-child", ru.contentUnblockContinue.message);
    await channel.locator(".cf-hard-block-actions button:last-child").click();
    await expectCount(channel, "#cf-hard-block-overlay", 0);
    await addon.page.bringToFront();
    await expectVisible(addon.page, card);
    await expectAttribute(addon.page, `${card} .cf-block-button`, "aria-label", ru.contentBlockNamed.message.replace("$CREATOR$", creator));
    expect(await addon.getStorage("cfBlockedChannels")).toEqual({ cfBlockedChannels: [] });
    await channel.close();
  });
});
