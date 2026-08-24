import { blockedCreator, expect, test } from "../fixtures/extension.fixture";
import { channelHeader, watchOwner } from "../fixtures/youtube-fixtures";
import { YouTubeSurfacePage } from "../pages/youtube-surface.page";

test.describe("direct navigation guard", () => {
  test("stops a direct visit to a blocked channel and can unblock it", async ({
    extensionPage,
    extensionStorage
  }) => {
    await extensionStorage.set({
      cfBlockedChannels: [blockedCreator("@alpha", "Alpha Creator")]
    });
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(channelHeader("Alpha Creator", "@alpha"), "/@alpha");

    const overlay = extensionPage.locator("#cf-hard-block-overlay");
    await expect(overlay).toBeVisible();
    await expect(overlay).toContainText("Alpha Creator is on your ChannelFence block list.");

    await overlay.getByRole("button", { name: "Unblock and continue" }).click();
    await expect(overlay).toHaveCount(0);
    expect((await extensionStorage.get<{ cfBlockedChannels: unknown[] }>("cfBlockedChannels"))
      .cfBlockedChannels).toEqual([]);
  });

  test("stops direct watch-page playback for a blocked creator", async ({
    extensionPage,
    extensionStorage
  }) => {
    await extensionStorage.set({
      cfBlockedChannels: [blockedCreator("@watchcreator", "Watch Creator")]
    });
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(watchOwner("Watch Creator", "@watchcreator"), "/watch?v=blocked-video");

    await expect(extensionPage.locator("#cf-hard-block-overlay")).toBeVisible();
    await expect(extensionPage.getByRole("heading", { name: "Creator blocked" })).toBeVisible();
  });
});

