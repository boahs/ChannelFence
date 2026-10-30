import { blockedCreator, expect, test } from "../fixtures/extension.fixture";
import { creatorCard } from "../fixtures/youtube-fixtures";
import { OptionsPage, PopupPage } from "../pages/extension-ui.page";
import { YouTubeSurfacePage } from "../pages/youtube-surface.page";

test.describe("Korean extension UI", () => {
  test.use({ locale: "ko-KR" });

  test("translates settings and popup while preserving a Korean handle", async ({
    extensionId, extensionPage, extensionStorage, serviceWorker
  }, testInfo) => {
    expect(await serviceWorker.evaluate<string>("chrome.i18n.getUILanguage()"))
      .toMatch(/^ko(?:-|$)/);
    const options = new OptionsPage(extensionPage, extensionId);
    await options.open();
    await expect(extensionPage.locator("html")).toHaveAttribute("lang", "ko");
    await expect(extensionPage).toHaveTitle("ChannelFence 설정");
    await extensionPage.getByRole("textbox", { name: "핸들 또는 채널 URL로 차단" })
      .fill("@한국채널");
    await extensionPage.getByRole("button", { name: "크리에이터 차단", exact: true }).click();
    await expect(extensionPage.locator("#blockedCount")).toHaveText("1");
    await expect(extensionPage.locator("#blockList")).toContainText("한국채널");
    expect((await extensionStorage.get<{ cfBlockedChannels: Array<{ key: string }> }>(
      "cfBlockedChannels"
    )).cfBlockedChannels[0].key).toBe("handle:@한국채널");
    await testInfo.attach("korean-settings", {
      body: await extensionPage.screenshot({ fullPage: true }), contentType: "image/png"
    });

    const popup = new PopupPage(extensionPage, extensionId);
    await popup.open();
    await expect(extensionPage.locator("#statusText")).toHaveText("1명 차단됨");
    await expect(extensionPage.getByRole("checkbox", { name: "YouTube 피드에서 Shorts 숨기기" }))
      .toBeAttached();
    await testInfo.attach("korean-popup", {
      body: await extensionPage.locator("body").screenshot(), contentType: "image/png"
    });
    await extensionPage.getByRole("button", { name: "한국채널 차단 해제", exact: true }).click();
    await expect(extensionPage.locator("#blockedCount")).toHaveText("0");
    expect((await extensionStorage.get<{ cfBlockedChannels: unknown[] }>("cfBlockedChannels"))
      .cfBlockedChannels).toEqual([]);
  });

  test("translates block and Undo without changing YouTube's language or creator names", async ({
    extensionPage, extensionStorage
  }) => {
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(creatorCard({
      id: "korean-creator", handle: "@한국채널", displayName: "한국채널"
    }));
    await expect(extensionPage.locator("html")).toHaveAttribute("lang", "en");
    await extensionPage.getByRole("button", { name: "한국채널 차단", exact: true }).click();
    await expect(youtube.card("korean-creator")).toBeHidden();
    await expect(extensionPage.locator("#cf-toast"))
      .toContainText("한국채널 크리에이터를 차단했습니다");
    await extensionPage.getByRole("button", { name: "실행 취소", exact: true }).click();
    await expect(youtube.card("korean-creator")).toBeVisible();
    expect((await extensionStorage.get<{ cfBlockedChannels: unknown[] }>("cfBlockedChannels"))
      .cfBlockedChannels).toEqual([]);
  });

  test("translates onboarding and privacy while keeping their links usable", async ({
    extensionId, extensionPage
  }) => {
    for (const pageName of ["welcome", "privacy"]) {
      await extensionPage.goto(`chrome-extension://${extensionId}/ui/${pageName}.html`);
      await expect(extensionPage.locator("html")).toHaveAttribute("lang", "ko");
      await expect(extensionPage.locator("h1")).toContainText(/[가-힣]/);
      await expect(extensionPage.locator("body")).not.toContainText("undefined");
    }
    await expect(extensionPage.getByRole("link", { name: "ChannelFence 이슈 트래커" }))
      .toHaveAttribute("href", "https://github.com/boahs/ChannelFence/issues");
    await expect(extensionPage.locator('[data-i18n="privacyContact"]')).toHaveText(
      "개인정보 및 지원 관련 질문은 ChannelFence 이슈 트래커 또는 Chrome 웹 스토어 등록정보의 지원 링크를 통해 제출할 수 있습니다."
    );
  });
});

test.describe("untranslated browser locale", () => {
  test.use({ locale: "de-DE" });

  test("falls back to English for both static and dynamic messages", async ({
    extensionId, extensionPage, extensionStorage, serviceWorker
  }) => {
    expect(await serviceWorker.evaluate<string>("chrome.i18n.getUILanguage()"))
      .toMatch(/^de(?:-|$)/);
    await extensionStorage.set({ cfBlockedChannels: [blockedCreator("@example", "Example")] });
    const popup = new PopupPage(extensionPage, extensionId);
    await popup.open();
    await expect(extensionPage.locator("html")).toHaveAttribute("lang", "en");
    await expect(extensionPage.getByRole("button", { name: "Manage block list" })).toBeVisible();
    await expect(extensionPage.locator("#statusText")).toHaveText("1 blocked");
    await expect(extensionPage.getByRole("button", { name: "Unblock example" })).toBeVisible();
  });
});
