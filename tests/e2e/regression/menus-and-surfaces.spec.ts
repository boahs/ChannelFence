import { blockedCreator, expect, test } from "../fixtures/extension.fixture";
import {
  comment,
  courseLockup,
  creatorCard,
  promotedHomeCard,
  rightRailLockup,
  watchOwner,
  watchOwners
} from "../fixtures/youtube-fixtures";
import { YouTubeSurfacePage } from "../pages/youtube-surface.page";

test.describe("YouTube surfaces and menus", () => {
  test("does not report a search result as the current page creator", async ({
    extensionPage,
    serviceWorker
  }) => {
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(creatorCard({
      displayName: "First Search Creator",
      handle: "@first-search-creator",
      id: "first-search-result",
      tag: "ytd-video-renderer"
    }), "/results?search_query=fixture");

    const response = await serviceWorker.evaluate(async () => {
      const extensionChrome = (globalThis as unknown as {
        chrome: {
          tabs: {
            query(query: Record<string, never>): Promise<Array<{ id?: number }>>;
            sendMessage(tabId: number, message: { type: string }): Promise<{
              ok: boolean;
              refs: unknown[];
            }>;
          };
        };
      }).chrome;
      const tabs = await extensionChrome.tabs.query({});
      for (const tab of tabs) {
        if (!tab.id) {
          continue;
        }
        try {
          return await extensionChrome.tabs.sendMessage(tab.id, {
            type: "CF_GET_PAGE_CONTEXT"
          });
        } catch {
          // Non-YouTube tabs do not have the ChannelFence content script.
        }
      }
      throw new Error("Could not find the YouTube fixture tab");
    });

    expect(response.ok).toBe(false);
    expect(response.refs).toEqual([]);
  });

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

  test("rebinds a reused YouTube menu to the newly selected card", async ({
    extensionPage,
    extensionStorage
  }) => {
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open([
      creatorCard({
        displayName: "First Menu Creator",
        handle: "@first-menu-creator",
        id: "first-reused-menu"
      }),
      creatorCard({
        displayName: "Second Menu Creator",
        handle: "@second-menu-creator",
        id: "second-reused-menu"
      })
    ].join(""));

    await youtube.openCreatorMenu("first-reused-menu-menu");
    await expect(extensionPage.locator(".cf-menu-item"))
      .toHaveAttribute("aria-label", "Block First Menu Creator with ChannelFence");

    const secondTrigger = extensionPage.getByTestId("second-reused-menu-menu");
    await secondTrigger.dispatchEvent("pointerdown");
    await secondTrigger.click();
    const reboundAction = extensionPage.locator(".cf-menu-item");
    await expect(reboundAction)
      .toHaveAttribute("aria-label", "Block Second Menu Creator with ChannelFence");
    await reboundAction.click();

    await expect(youtube.card("first-reused-menu")).toBeVisible();
    await expect(youtube.card("second-reused-menu")).toBeHidden();
    const stored = await extensionStorage.get<{
      cfBlockedChannels: Array<{ displayName: string }>;
    }>("cfBlockedChannels");
    expect(stored.cfBlockedChannels[0].displayName).toBe("Second Menu Creator");
  });

  test("ignores sponsored Home cells between creator recommendations", async ({
    extensionPage,
    extensionStorage
  }) => {
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open([
      creatorCard({
        displayName: "Creator Above Shorts",
        handle: "@creator-above-shorts",
        id: "creator-above-shorts"
      }),
      promotedHomeCard("Fixture Advertiser", "home-promotion"),
      creatorCard({
        displayName: "Creator Below Shorts",
        handle: "@creator-below-shorts",
        id: "creator-below-shorts"
      })
    ].join(""));

    await expect(youtube.blockButton("creator-above-shorts")).toBeVisible();
    await expect(youtube.blockButton("creator-below-shorts")).toBeVisible();
    const promotion = youtube.card("home-promotion");
    await expect(promotion).toBeVisible();
    await expect(promotion.locator(".cf-block-button")).toHaveCount(0);

    await youtube.openCreatorMenu("creator-above-shorts-menu");
    await expect(extensionPage.locator(".cf-menu-item")).toHaveCount(1);
    const promotionMenu = extensionPage.getByTestId("home-promotion-menu");
    await promotionMenu.dispatchEvent("pointerdown");
    await promotionMenu.click();
    await expect(extensionPage.locator(".cf-menu-item")).toHaveCount(0);

    await youtube.blockButton("creator-below-shorts").click();
    await expect(youtube.card("creator-below-shorts")).toBeHidden();
    await expect(promotion).toBeVisible();
    const stored = await extensionStorage.get<{
      cfBlockedChannels: Array<{ displayName: string }>;
    }>("cfBlockedChannels");
    expect(stored.cfBlockedChannels).toEqual([
      expect.objectContaining({ displayName: "Creator Below Shorts" })
    ]);
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

  test("adds a linkless block control when YouTube fills the creator label late", async ({
    extensionPage
  }) => {
    const youtube = new YouTubeSurfacePage(extensionPage);
    const delayedLockup = rightRailLockup({
      displayName: "Late Label Creator",
      id: "late-label"
    }).replace(
      'aria-label="Go to channel Late Label Creator"',
      'aria-label=""'
    ).replace(
      '>Late Label Creator</span>',
      '></span>'
    );
    await youtube.open(delayedLockup, "/watch?v=late-label-fixture");

    const card = youtube.card("late-label");
    await expect(card.locator(".cf-block-button")).toHaveCount(0);
    await card.locator("[role='button'][aria-label='']").evaluate((avatar) => {
      avatar.setAttribute("aria-label", "Go to channel Late Label Creator");
    });
    await expect(card.getByRole("button", { name: "Block Late Label Creator" }))
      .toBeVisible();
  });

  test("hides a live-style collaboration when a linkless collaborator is blocked", async ({
    extensionPage,
    extensionStorage
  }) => {
    await extensionStorage.set({
      cfBlockedChannels: [blockedCreator("@mrbeast", "MrBeast")]
    });
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(`
      <ytd-video-renderer data-testid="live-collaboration">
        <div id="channel-info">
          <a id="channel-thumbnail" href="/@MrBeast2" aria-label="Go to channel MrBeast 2"></a>
          <yt-avatar-stack-view-model aria-label="Collaboration channels"></yt-avatar-stack-view-model>
          <div id="attributed-channel-name">MrBeast 2 and MrBeast</div>
        </div>
      </ytd-video-renderer>
    `, "/results?search_query=mrbeast");

    await expect(youtube.card("live-collaboration")).toBeHidden();
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

  test("identifies and blocks the creator of a YouTube Course card", async ({
    extensionPage,
    extensionStorage
  }) => {
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open([
      courseLockup("Course Creator", "course-one"),
      courseLockup("Course Creator", "course-two")
    ].join(""));

    const firstCourse = youtube.card("course-one");
    const button = firstCourse.getByRole("button", { name: "Block Course Creator" });
    await expect(button).toBeVisible();
    await button.click();
    await expect(firstCourse).toBeHidden();
    await expect(youtube.card("course-two")).toBeHidden();

    const stored = await extensionStorage.get<{
      cfBlockedChannels: Array<{ aliases: string[]; displayName: string }>;
    }>("cfBlockedChannels");
    expect(stored.cfBlockedChannels[0]).toMatchObject({
      aliases: ["name:course creator"],
      displayName: "Course Creator"
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
