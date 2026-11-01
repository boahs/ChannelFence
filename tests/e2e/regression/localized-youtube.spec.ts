import { blockedCreator, expect, test } from "../fixtures/extension.fixture";
import { translatedLocales } from "../fixtures/locales";
import {
  channelHeader,
  channelTabLockup,
  rightRailLockup
} from "../fixtures/youtube-fixtures";
import { YouTubeSurfacePage } from "../pages/youtube-surface.page";

test.describe("Localized YouTube creator detection with English extension UI", () => {
  // The structure and Korean labels came from the Korean CI DOM capture.
  // Other labels exercise the same structure without language-specific parsing.
  for (const locale of [
    ...translatedLocales,
    { youtubeLanguage: "ar", creator: "قناةعربية", views: "مشاهدة واحدة", age: "قبل 23 ساعة" }
  ]) {
    test(`does not turn ${locale.youtubeLanguage} channel statistics into creators`, async ({ extensionPage }) => {
      const youtube = new YouTubeSurfacePage(extensionPage);
      const card = channelTabLockup({
        compactStatistics: { views: "1", age: locale.age, ageLabel: locale.age },
        displayName: locale.creator,
        id: "localized-statistics",
        includeAvatar: false
      }).replace('aria-label="1 views"', `aria-label="${locale.views}"`);
      await youtube.open(
        channelHeader(locale.creator, `@${locale.creator}`) + card +
          rightRailLockup({ displayName: "Known Guest", id: "known-guest" }),
        `/@${locale.creator}/videos`,
        locale.youtubeLanguage
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

  for (const locale of translatedLocales) {
    test(`blocks a ${locale.name} linkless creator through the structural overflow menu`, async ({
      extensionPage,
      extensionStorage
    }) => {
      const youtube = new YouTubeSurfacePage(extensionPage);
      const card = rightRailLockup({ displayName: locale.creator, id: "localized-rail" })
        .replace(`Go to channel ${locale.creator}`, locale.goToChannel)
        .replace("ytLockupViewModelMenuButton", "ytLockupMetadataViewModelMenuButton")
        .replace('aria-label="More actions"', `aria-label="${locale.moreActions}"`);
      await youtube.open(card, "/watch?v=localized-menu", locale.youtubeLanguage);

      await expect(youtube.blockButton("localized-rail"))
        .toHaveAttribute("data-cf-identity", `name:${locale.creator}`);
      const item = await youtube.openCreatorMenu("localized-rail-menu");
      await expect(item).toHaveAttribute("aria-label", `Block ${locale.creator} with ChannelFence`);
      await item.click();
      await expect(youtube.card("localized-rail")).toBeHidden();
      const stored = await extensionStorage.get<{
        cfBlockedChannels: Array<{ aliases: string[]; displayName: string }>;
      }>("cfBlockedChannels");
      expect(stored.cfBlockedChannels).toEqual([
        expect.objectContaining({ aliases: [`name:${locale.creator}`], displayName: locale.creator })
      ]);
    });

    test(`keeps ${locale.name} collaborators separate by their links`, async ({
      extensionPage,
      extensionStorage
    }) => {
      await extensionStorage.set({
        cfBlockedChannels: [blockedCreator("@unrelated", locale.creator)]
      });
      const youtube = new YouTubeSurfacePage(extensionPage);
      await youtube.open(`
        <yt-lockup-view-model data-testid="localized-collaboration">
          <a href="/watch?v=localized-collaboration">${locale.creator}</a>
          <yt-avatar-stack-view-model></yt-avatar-stack-view-model>
          <div class="ytContentMetadataViewModelMetadataRow">
            <a href="/@${locale.collaborators[0]}">${locale.creator}</a> ${locale.conjunction}
            <a href="/@${locale.collaborators[1]}">${locale.creator}</a>
          </div>
        </yt-lockup-view-model>`, "/results?search_query=collaboration", locale.youtubeLanguage);

      const card = youtube.card("localized-collaboration");
      await expect(card).toBeVisible();
      await expect(youtube.blockButton("localized-collaboration")).toHaveCount(2);
      await card.locator(`[data-cf-identity="handle:@${locale.collaborators[1]}"]`).click();
      await expect(card).toBeHidden();
      const stored = await extensionStorage.get<{
        cfBlockedChannels: Array<{ aliases: string[] }>;
      }>("cfBlockedChannels");
      expect(stored.cfBlockedChannels.map((entry) => entry.aliases)).toEqual([
        [`handle:@${locale.collaborators[1]}`],
        ["handle:@unrelated"]
      ]);
    });
  }
});
