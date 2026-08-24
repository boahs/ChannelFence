import { blockedCreator, expect, test } from "../fixtures/extension.fixture";
import { comment, creatorCard, watchOwner } from "../fixtures/youtube-fixtures";
import { YouTubeSurfacePage } from "../pages/youtube-surface.page";

test.describe("YouTube surfaces and menus", () => {
  test("adds a themed ChannelFence action to a feed three-dot menu", async ({
    extensionPage,
    extensionStorage
  }) => {
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(creatorCard({
      displayName: "Menu Creator",
      handle: "@menucreator",
      id: "menu-card"
    }));

    const menuItem = await youtube.openCreatorMenu("menu-card-menu", "rgb(241, 241, 241)");
    await expect(menuItem).toContainText("ChannelFence: Block");
    await expect(menuItem).toHaveCSS("color", "rgb(241, 241, 241)");
    await menuItem.click();

    const stored = await extensionStorage.get<{ cfBlockedChannels: Array<{ displayName: string }> }>(
      "cfBlockedChannels"
    );
    expect(stored.cfBlockedChannels).toHaveLength(1);
    expect(stored.cfBlockedChannels[0].displayName).toBe("Menu Creator");
  });

  test("adds the ChannelFence action to the watch-page three-dot menu", async ({ extensionPage }) => {
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(watchOwner("Watch Creator", "@watchcreator"), "/watch?v=fixture-video");

    const menuItem = await youtube.openCreatorMenu("watch-menu");
    await expect(menuItem).toContainText("ChannelFence: Block");
  });

  test("hides blocked comments only while the comment preference is enabled", async ({
    extensionPage,
    extensionStorage
  }) => {
    await extensionStorage.set({
      cfBlockedChannels: [blockedCreator("@blockedcommenter", "Blocked Commenter")]
    });
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open([
      comment({ displayName: "Blocked Commenter", handle: "@blockedcommenter", id: "blocked-comment" }),
      comment({ displayName: "Visible Commenter", handle: "@visiblecommenter", id: "visible-comment" })
    ].join(""));

    await expect(youtube.card("blocked-comment")).toBeHidden();
    await expect(youtube.card("visible-comment")).toBeVisible();

    await extensionStorage.set({ cfHideComments: false });
    await expect(youtube.card("blocked-comment")).toBeVisible();
  });
});

