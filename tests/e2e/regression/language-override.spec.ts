import en from "../../../_locales/en/messages.json";
import ja from "../../../_locales/ja/messages.json";
import ru from "../../../_locales/ru/messages.json";
import { blockedCreator, expect, test } from "../fixtures/extension.fixture";
import { translatedLocales } from "../fixtures/locales";
import { channelHeader, creatorCard } from "../fixtures/youtube-fixtures";
import { OptionsPage, PopupPage } from "../pages/extension-ui.page";
import { YouTubeSurfacePage } from "../pages/youtube-surface.page";

test.describe("extension language override", () => {
  test.use({ locale: "en-US" });

  test("updates open extension pages, persists the selection, and returns to Chrome's language", async ({
    extensionContext, extensionId, extensionPage, extensionStorage, serviceWorker
  }) => {
    await extensionStorage.set({ cfBlockedChannels: [blockedCreator("@example", "Example")] });
    const options = new OptionsPage(extensionPage, extensionId);
    await options.open();
    await expect(extensionPage.locator("#languageSelect")).toHaveValue("auto");
    await expect(extensionPage.locator("html")).toHaveAttribute("lang", "en");

    const popupPage = await extensionContext.newPage();
    const popup = new PopupPage(popupPage, extensionId);
    await popup.open();
    const welcomePage = await extensionContext.newPage();
    await welcomePage.goto(`chrome-extension://${extensionId}/ui/welcome.html`);
    const privacyPage = await extensionContext.newPage();
    await privacyPage.goto(`chrome-extension://${extensionId}/ui/privacy.html`);

    for (const { value, messages } of [
      { value: "en", messages: en },
      ...translatedLocales.map((locale) => ({
        value: locale.catalogCode, messages: locale.messages
      })),
      { value: "auto", messages: en }
    ]) {
      await extensionPage.locator("#languageSelect").selectOption(value);
      await expect(extensionPage).toHaveTitle(messages.settingsPageTitle.message);
      await expect(extensionPage.getByRole("textbox", { name: messages.manualBlockLabel.message }))
        .toBeVisible();
      await expect(popupPage.locator("html")).toHaveAttribute("lang", messages.languageCode.message);
      await expect(popupPage.locator("#statusText"))
        .toHaveText(messages.blockedCount.message.replace("$COUNT$", "1"));
      await expect(popupPage.getByRole("button", {
        name: messages.unblockNamed.message.replace("$CREATOR$", "example"), exact: true
      })).toBeVisible();
      await expect(welcomePage.locator("h1")).toHaveText(messages.welcomeHeadline.message);
      await expect(privacyPage.locator("h1")).toHaveText(messages.privacyTitle.message);
      await expect(privacyPage.locator('[data-i18n="privacyContact"]'))
        .toHaveText(messages.privacyContact.message.replace("$LINK$", messages.issueTracker.message));
      await expect(privacyPage.getByRole("link", { name: messages.issueTracker.message }))
        .toHaveAttribute("href", "https://github.com/boahs/ChannelFence/issues");
      expect((await extensionStorage.get<{ cfLanguage: string }>("cfLanguage")).cfLanguage).toBe(value);

      await extensionPage.reload();
      await expect(extensionPage.locator("#languageSelect")).toHaveValue(value);
      await expect(extensionPage.locator("html")).toHaveAttribute("lang", messages.languageCode.message);
      await expect(extensionPage).toHaveTitle(messages.settingsPageTitle.message);
    }

    expect(await serviceWorker.evaluate<string>("chrome.i18n.getUILanguage()"))
      .toMatch(/^en(?:-|$)/);
    expect((await extensionStorage.get<{ cfBlockedChannels: Array<{ key: string }> }>(
      "cfBlockedChannels"
    )).cfBlockedChannels.map((entry) => entry.key)).toEqual(["handle:@example"]);
    await popupPage.close();
    await welcomePage.close();
    await privacyPage.close();
  });

  test("relabels existing YouTube controls and an open blocked-channel overlay without changing identity", async ({
    extensionContext, extensionId, extensionPage, extensionStorage, serviceWorker
  }) => {
    const creator = "日本の料理";
    const options = new OptionsPage(extensionPage, extensionId);
    await options.open();
    const youtubePage = await extensionContext.newPage();
    const youtube = new YouTubeSurfacePage(youtubePage);
    await youtube.open(creatorCard({
      id: "language-creator", handle: `@${creator}`, displayName: creator
    }), "/__channelfence_fixture__/home", "ko");
    await expect(youtube.blockButton("language-creator"))
      .toHaveAttribute("aria-label", `Block ${creator}`);
    const menu = await youtube.openCreatorMenu("language-creator-menu");
    await expect(menu.locator(".cf-menu-item__label")).toHaveText("ChannelFence: Block");

    await extensionPage.locator("#languageSelect").selectOption("ja");
    await youtubePage.bringToFront();
    await expect(youtube.blockButton("language-creator"))
      .toHaveAttribute("aria-label", ja.contentBlockNamed.message.replace("$CREATOR$", creator));
    await expect(menu.locator(".cf-menu-item__label")).toHaveText(ja.contentMenuBlock.message);
    await expect(youtubePage.locator("html")).toHaveAttribute("lang", "ko");
    await expect(youtube.card("language-creator").locator("ytd-channel-name a"))
      .toHaveText(creator);
    await menu.click();
    await expect(youtube.card("language-creator")).toBeHidden();
    await expect(youtubePage.locator("#cf-toast"))
      .toContainText(ja.contentBlocked.message.replace("$CREATOR$", creator));
    await expect(youtubePage.getByRole("button", { name: ja.contentUndo.message, exact: true }))
      .toBeVisible();
    expect((await extensionStorage.get<{ cfBlockedChannels: Array<{ key: string }> }>(
      "cfBlockedChannels"
    )).cfBlockedChannels.map((entry) => entry.key)).toEqual([`handle:@${creator}`]);
    await expect.poll(() => serviceWorker.evaluate<string>(
      "chrome.tabs.query({ active: true, currentWindow: true })" +
      ".then(([tab]) => chrome.action.getTitle({ tabId: tab.id }))"
    )).toBe(ja.actionBlockedCount.message.replace("$COUNT$", "1"));

    const channelPage = await extensionContext.newPage();
    const channel = new YouTubeSurfacePage(channelPage);
    await channel.open(channelHeader(creator, `@${creator}`), `/@${creator}`, "ko");
    const overlay = channelPage.locator("#cf-hard-block-overlay");
    await expect(overlay.getByRole("heading")).toHaveText(ja.contentCreatorBlocked.message);

    await extensionPage.locator("#languageSelect").selectOption("ru");
    await channelPage.bringToFront();
    await expect(overlay.getByRole("heading")).toHaveText(ru.contentCreatorBlocked.message);
    await expect(overlay).toContainText(ru.contentBlockedDescription.message.replace("$CREATOR$", creator));
    await expect(overlay.getByRole("button", { name: ru.contentGoHome.message, exact: true }))
      .toBeVisible();
    await expect(channelPage.locator("html")).toHaveAttribute("lang", "ko");
    await expect(youtube.card("language-creator")).toBeHidden();
    await overlay.getByRole("button", { name: ru.contentUnblockContinue.message, exact: true }).click();
    await expect(overlay).toHaveCount(0);
    await youtubePage.bringToFront();
    await expect(youtube.card("language-creator")).toBeVisible();
    await expect(youtube.blockButton("language-creator"))
      .toHaveAttribute("aria-label", ru.contentBlockNamed.message.replace("$CREATOR$", creator));
    expect((await extensionStorage.get<{ cfBlockedChannels: unknown[] }>("cfBlockedChannels"))
      .cfBlockedChannels).toEqual([]);
    await youtubePage.close();
    await channelPage.close();
  });
});
