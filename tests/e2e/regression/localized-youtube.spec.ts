import { blockedCreator, expect, test } from "../fixtures/extension.fixture";
import {
  channelHeader,
  channelTabLockup,
  rightRailLockup
} from "../fixtures/youtube-fixtures";
import { YouTubeSurfacePage } from "../pages/youtube-surface.page";

test.describe("Localized YouTube creator detection", () => {
  // The structure and Korean labels came from the Korean CI DOM capture.
  // Other labels exercise the same structure without language-specific parsing.
  for (const locale of [
    { language: "ko", views: "조회수 1회", age: "23시간 전" },
    { language: "ja", views: "1回視聴", age: "23時間前" },
    { language: "ar", views: "مشاهدة واحدة", age: "قبل 23 ساعة" }
  ]) {
    test(`does not turn ${locale.language} channel statistics into creators`, async ({ extensionPage }) => {
      const youtube = new YouTubeSurfacePage(extensionPage);
      const card = channelTabLockup({
        compactStatistics: { views: "1", age: locale.age, ageLabel: locale.age },
        displayName: "테스트 채널",
        id: "localized-statistics",
        includeAvatar: false
      }).replace('aria-label="1 views"', `aria-label="${locale.views}"`);
      await youtube.open(
        channelHeader("테스트 채널", "@테스트채널") + card +
          rightRailLockup({ displayName: "Known Guest", id: "known-guest" }),
        "/@테스트채널/videos",
        locale.language
      );

      await expect(youtube.blockButton("channel-header")).toHaveCount(1);
      await expect(youtube.card("localized-statistics")).toBeVisible();
      await expect(youtube.blockButton("localized-statistics")).toHaveCount(0);

      // Reusing YouTube's popup must not retain a different card's creator or
      // replace it with a guessed "creator" identity for statistics-only cards.
      await youtube.openCreatorMenu("known-guest-menu");
      const trigger = extensionPage.getByTestId("localized-statistics-menu");
      await trigger.dispatchEvent("pointerdown");
      await trigger.click();
      await expect(extensionPage.locator(".cf-menu-item")).toHaveCount(0);
    });
  }

  test("blocks a Korean linkless creator through the structural overflow menu", async ({
    extensionPage,
    extensionStorage
  }) => {
    const youtube = new YouTubeSurfacePage(extensionPage);
    const card = rightRailLockup({ displayName: "한국 요리", id: "korean-rail" })
      .replace("Go to channel 한국 요리", "한국 요리 채널로 이동")
      .replace("ytLockupViewModelMenuButton", "ytLockupMetadataViewModelMenuButton")
      .replace('aria-label="More actions"', 'aria-label="추가 작업"');
    await youtube.open(card, "/watch?v=korean-menu", "ko");

    await expect(youtube.blockButton("korean-rail"))
      .toHaveAttribute("data-cf-identity", "name:한국 요리");
    const item = await youtube.openCreatorMenu("korean-rail-menu");
    await expect(item).toHaveAttribute("aria-label", "Block 한국 요리 with ChannelFence");
    await item.click();
    await expect(youtube.card("korean-rail")).toBeHidden();
    const stored = await extensionStorage.get<{
      cfBlockedChannels: Array<{ aliases: string[]; displayName: string }>;
    }>("cfBlockedChannels");
    expect(stored.cfBlockedChannels).toEqual([
      expect.objectContaining({ aliases: ["name:한국 요리"], displayName: "한국 요리" })
    ]);
  });

  test("keeps Korean collaborators separate by their links", async ({
    extensionPage,
    extensionStorage
  }) => {
    await extensionStorage.set({
      cfBlockedChannels: [blockedCreator("@unrelated", "같은 이름")]
    });
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(`
      <yt-lockup-view-model data-testid="korean-collaboration">
        <a href="/watch?v=korean-collaboration">공동 제작 동영상</a>
        <yt-avatar-stack-view-model aria-label="공동작업 채널"></yt-avatar-stack-view-model>
        <div class="ytContentMetadataViewModelMetadataRow">
          <a href="/@첫번째채널">같은 이름</a> 및
          <a href="/@두번째채널">같은 이름</a>
        </div>
      </yt-lockup-view-model>`, "/results?search_query=collaboration", "ko");

    const card = youtube.card("korean-collaboration");
    await expect(card).toBeVisible();
    await expect(youtube.blockButton("korean-collaboration")).toHaveCount(2);
    await card.locator('[data-cf-identity="handle:@두번째채널"]').click();
    await expect(card).toBeHidden();
    const stored = await extensionStorage.get<{
      cfBlockedChannels: Array<{ aliases: string[] }>;
    }>("cfBlockedChannels");
    expect(stored.cfBlockedChannels.map((entry) => entry.aliases)).toEqual([
      ["handle:@두번째채널"],
      ["handle:@unrelated"]
    ]);
  });
});
