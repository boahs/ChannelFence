import { blockedCreator, expect, test } from "../fixtures/extension.fixture";
import {
  comment,
  creatorCard,
  rightRailLockup,
  watchOwner,
  watchOwners
} from "../fixtures/youtube-fixtures";
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

  test("adds a search-result block control when YouTube fills the owner link late", async ({
    extensionPage,
    extensionStorage
  }) => {
    const youtube = new YouTubeSurfacePage(extensionPage);
    const delayedCard = creatorCard({
      displayName: "Late Search Creator",
      handle: "@late-search",
      id: "late-search",
      tag: "ytd-video-renderer"
    }).replace('href="/@late-search"', "");
    await youtube.open(delayedCard, "/results?search_query=late");

    await expect(youtube.blockButton("late-search")).toHaveCount(0);
    await extensionPage.getByTestId("late-search").locator("ytd-channel-name a")
      .evaluate((anchor) => anchor.setAttribute("href", "/@late-search"));
    await expect(youtube.blockButton("late-search")).toBeVisible();
    await youtube.blockButton("late-search").click();

    const stored = await extensionStorage.get<{
      cfBlockedChannels: Array<{ aliases: string[]; displayName: string }>;
    }>("cfBlockedChannels");
    expect(stored.cfBlockedChannels[0]).toMatchObject({
      aliases: ["handle:@late-search"],
      displayName: "Late Search Creator"
    });
  });

  test("does not treat a channel mentioned in a search description as the uploader", async ({
    extensionPage,
    extensionStorage
  }) => {
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(creatorCard({
      displayName: "Search Uploader",
      handle: "@search-uploader",
      id: "search-with-mention",
      mentionedHandle: "@description-guest",
      tag: "ytd-video-renderer"
    }), "/results?search_query=collaboration");

    await youtube.blockButton("search-with-mention").click();
    const stored = await extensionStorage.get<{
      cfBlockedChannels: Array<{ aliases: string[] }>;
    }>("cfBlockedChannels");
    expect(stored.cfBlockedChannels[0].aliases).toEqual(["handle:@search-uploader"]);
  });

  test("uses the visible search byline instead of YouTube's hidden legacy byline", async ({
    extensionPage
  }) => {
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(`
      <ytd-video-renderer data-testid="modern-search-result">
        <div style="display: none">
          <ytd-channel-name id="channel-name">
            <a href="/@modern-search">Modern Search Creator</a>
          </ytd-channel-name>
        </div>
        <div id="channel-info" style="display: none">
          <a id="channel-thumbnail" href="/@modern-search" aria-label="Go to channel Modern Search Creator"></a>
          <ytd-channel-name id="channel-name">
            <a href="/@modern-search">Modern Search Creator</a>
          </ytd-channel-name>
        </div>
      </ytd-video-renderer>
    `, "/results?search_query=modern");

    const result = youtube.card("modern-search-result");
    await expect(result.locator(".cf-block-button")).toHaveCount(1);
    await expect(result.locator(".cf-block-button")).toBeHidden();
    await result.locator("#channel-info").evaluate((channelInfo) => {
      channelInfo.removeAttribute("style");
      document.dispatchEvent(new Event("yt-page-data-updated", { bubbles: true }));
    });
    await expect(result.getByRole("button", { name: "Block Modern Search Creator" })).toBeVisible();
  });

  test("offers independent block controls for every collaboration owner", async ({
    extensionPage,
    extensionStorage
  }) => {
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(watchOwners([
      { displayName: "Channel Five", handle: "@channel-five" },
      { displayName: "All Gas No Brakes", handle: "@all-gas-no-brakes" }
    ]), "/watch?v=collaboration");

    const owner = extensionPage.locator("ytd-watch-metadata #owner");
    await expect(owner.locator(".cf-block-button")).toHaveCount(2);
    await expect(owner.getByRole("button", { name: "Block Channel Five" })).toBeVisible();
    await expect(owner.getByRole("button", { name: "Block All Gas No Brakes" })).toBeVisible();

    const menuItems = await youtube.openCreatorMenuItems("watch-menu");
    await expect(menuItems).toHaveCount(2);
    await expect(menuItems.nth(0)).toContainText("ChannelFence: Block Channel Five");
    await expect(menuItems.nth(1)).toContainText("ChannelFence: Block All Gas No Brakes");
    await menuItems.nth(0).click();

    const stored = await extensionStorage.get<{
      cfBlockedChannels: Array<{ aliases: string[]; displayName: string }>;
    }>("cfBlockedChannels");
    expect(stored.cfBlockedChannels).toEqual([
      expect.objectContaining({
        aliases: ["handle:@channel-five"],
        displayName: "Channel Five"
      })
    ]);
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
