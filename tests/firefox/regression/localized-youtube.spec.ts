import { blockedCreator } from "../../e2e/fixtures/extension.fixture";
import { translatedLocales } from "../../e2e/fixtures/locales";
import { channelHeader, channelTabLockup, rightRailLockup } from "../../e2e/fixtures/youtube-fixtures";
import { expect, expectAttribute, expectCount, expectVisible, openCreatorMenu, openFixture, test } from "../extension.fixture";

test.describe("Localized YouTube creator detection with English extension UI", () => {
  for (const locale of translatedLocales) {
    test(`does not turn ${locale.youtubeLanguage} channel statistics into creators`, async ({ addon }) => {
      const card = channelTabLockup({ compactStatistics: { views: "1", age: locale.age, ageLabel: locale.age },
        displayName: locale.creator, id: "localized-statistics", includeAvatar: false })
        .replace('aria-label="1 views"', `aria-label="${locale.views}"`);
      await openFixture(addon.page, channelHeader(locale.creator, `@${locale.creator}`) + card +
        rightRailLockup({ displayName: "Known Guest", id: "known-guest" }), `/@${locale.creator}/videos`, locale.youtubeLanguage);
      await expectCount(addon.page, '[data-testid="channel-header"] .cf-block-button', 1);
      await expectVisible(addon.page, '[data-testid="localized-statistics"]');
      await expectCount(addon.page, '[data-testid="localized-statistics"] .cf-block-button', 0);
      await openCreatorMenu(addon.page, '[data-testid="known-guest-menu"]');
      await addon.page.$eval('[data-testid="localized-statistics-menu"]', (element) => element.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })));
      await addon.page.locator('[data-testid="localized-statistics-menu"]').click();
      await expectCount(addon.page, ".cf-menu-item", 0);
    });

    test(`blocks a ${locale.name} linkless creator through the structural overflow menu`, async ({ addon }) => {
      const card = rightRailLockup({ displayName: locale.creator, id: "localized-rail" })
        .replace(`Go to channel ${locale.creator}`, locale.goToChannel)
        .replace("ytLockupViewModelMenuButton", "ytLockupMetadataViewModelMenuButton")
        .replace('aria-label="More actions"', `aria-label="${locale.moreActions}"`);
      await openFixture(addon.page, card, "/watch?v=localized-menu", locale.youtubeLanguage);
      await expectAttribute(addon.page, '[data-testid="localized-rail"] .cf-block-button', "data-cf-identity", `name:${locale.creator}`);
      await openCreatorMenu(addon.page, '[data-testid="localized-rail-menu"]');
      await expectAttribute(addon.page, ".cf-menu-item", "aria-label", `Block ${locale.creator} with ChannelFence`);
      await addon.page.locator(".cf-menu-item").click();
      await expectVisible(addon.page, '[data-testid="localized-rail"]', false);
      expect((await addon.getStorage("cfBlockedChannels")).cfBlockedChannels).toEqual([
        expect.objectContaining({ aliases: [`name:${locale.creator}`], displayName: locale.creator })
      ]);
    });

    test(`keeps ${locale.name} collaborators separate by their links`, async ({ addon }) => {
      await addon.setStorage({ cfBlockedChannels: [blockedCreator("@unrelated", locale.creator)] });
      await openFixture(addon.page, `<yt-lockup-view-model data-testid="localized-collaboration">
        <a href="/watch?v=localized-collaboration">${locale.creator}</a>
        <yt-avatar-stack-view-model></yt-avatar-stack-view-model>
        <div class="ytContentMetadataViewModelMetadataRow">
          <a href="/@${locale.collaborators[0]}">${locale.creator}</a> ${locale.conjunction}
          <a href="/@${locale.collaborators[1]}">${locale.creator}</a>
        </div></yt-lockup-view-model>`, "/results?search_query=collaboration", locale.youtubeLanguage);
      const card = '[data-testid="localized-collaboration"]';
      await expectVisible(addon.page, card);
      await expectCount(addon.page, `${card} .cf-block-button`, 2);
      await addon.page.locator(`${card} [data-cf-identity="handle:@${locale.collaborators[1]}"]`).click();
      await expectVisible(addon.page, card, false);
      expect(((await addon.getStorage("cfBlockedChannels")).cfBlockedChannels as Array<{ aliases: string[] }>).map((entry) => entry.aliases))
        .toEqual([[`handle:@${locale.collaborators[1]}`], ["handle:@unrelated"]]);
    });
  }
});
