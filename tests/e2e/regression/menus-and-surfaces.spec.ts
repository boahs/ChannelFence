import { blockedCreator, expect, test } from "../fixtures/extension.fixture";
import { comment, creatorCard, rightRailLockup, watchOwner } from "../fixtures/youtube-fixtures";
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

  test("blocks linkless right-rail recommendations with the inline button", async ({
    extensionPage,
    extensionStorage
  }) => {
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open([
      rightRailLockup({ displayName: "Right Rail Creator", id: "rail-one" }),
      rightRailLockup({ displayName: "Right Rail Creator", id: "rail-two" })
    ].join(""), "/watch?v=fixture-video");

    await expect(youtube.blockButton("rail-one")).toBeVisible();
    await youtube.blockButton("rail-one").click();
    await expect(youtube.card("rail-one")).toBeHidden();
    await expect(youtube.card("rail-two")).toBeHidden();

    const stored = await extensionStorage.get<{
      cfBlockedChannels: Array<{ aliases: string[]; displayName: string }>;
    }>("cfBlockedChannels");
    expect(stored.cfBlockedChannels[0]).toMatchObject({
      aliases: ["name:right rail creator"],
      displayName: "Right Rail Creator"
    });
  });

  test("adds the ChannelFence action to a linkless right-rail three-dot menu", async ({
    extensionPage,
    extensionStorage
  }) => {
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(rightRailLockup({
      displayName: "Rail Menu Creator",
      id: "rail-menu"
    }), "/watch?v=fixture-video");

    const menuItem = await youtube.openCreatorMenu("rail-menu-menu");
    await expect(menuItem).toContainText("ChannelFence: Block");
    await menuItem.click();
    await expect(youtube.card("rail-menu")).toBeHidden();

    const stored = await extensionStorage.get<{
      cfBlockedChannels: Array<{ key: string }>;
    }>("cfBlockedChannels");
    expect(stored.cfBlockedChannels[0].key).toBe("name:rail menu creator");
  });

  test("matches a stable handle block against a linkless right-rail display name", async ({
    extensionPage,
    extensionStorage
  }) => {
    await extensionStorage.set({
      cfBlockedChannels: [blockedCreator("@right-rail", "Right Rail Creator")]
    });
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(rightRailLockup({
      displayName: "Right Rail Creator",
      id: "known-rail"
    }), "/watch?v=fixture-video");

    await expect(youtube.card("known-rail")).toBeHidden();
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
