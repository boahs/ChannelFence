import {
  blockedCreator, legacyBlockedCreator, expect, expectVisible, expectCount,
  expectAttribute, expectContainsText, expectCSS, openCreatorMenu, openFixture, test
} from "../extension.fixture";
import {
  channelHeader,
  channelTabLockup,
  comment,
  courseLockup,
  creatorCard,
  promotedHomeCard,
  modernChannelHeaderWithCommunityLink,
  rightRailLockup,
  shortsShelf,
  watchOwner,
  watchOwners
} from "../../e2e/fixtures/youtube-fixtures";

test.describe("YouTube surfaces and menus", () => {
  test("does not report a search result as the current page creator", async ({ addon }) => {
    const page = addon.page;

    await openFixture(page, creatorCard({
      displayName: "First Search Creator",
      handle: "@first-search-creator",
      id: "first-search-result",
      tag: "ytd-video-renderer"
    }), "/results?search_query=fixture");

    const response = await addon.ui.evaluate(async () => {
      const extensionApi = (globalThis as unknown as {
        browser: {
          tabs: {
            query(query: { url: string }): Promise<Array<{ id?: number }>>;
            sendMessage(tabId: number, message: { type: string }): Promise<{
              ok: boolean;
              refs: unknown[];
            }>;
          };
        };
      }).browser;
      const [tab] = await extensionApi.tabs.query({ url: "https://www.youtube.com/*" });
      if (!tab?.id) throw new Error("Could not find the YouTube fixture tab");
      return extensionApi.tabs.sendMessage(tab.id, { type: "CF_GET_PAGE_CONTEXT" });
    });

    expect(response.ok).toBe(false);
    expect(response.refs).toEqual([]);
  });

  test("adds a themed ChannelFence action to a feed three-dot menu", async ({ addon }) => {
    const page = addon.page;

    await openFixture(page, creatorCard({
      displayName: "Menu Creator",
      handle: "@menucreator",
      id: "menu-card"
    }));

    await openCreatorMenu(page, '[data-testid="menu-card-menu"]', "rgb(241, 241, 241)");
    const menuItem = ".cf-menu-item";
    await expectContainsText(page, menuItem, "ChannelFence: Block");
    await expectCSS(page, menuItem, "color", "rgb(241, 241, 241)");
    await page.locator(menuItem).click();

    const stored = await addon.getStorage<{ cfBlockedChannels: Array<{ displayName: string }> }>("cfBlockedChannels");
    expect(stored.cfBlockedChannels).toHaveLength(1);
    expect(stored.cfBlockedChannels[0].displayName).toBe("menucreator");
  });

  test("adds the ChannelFence action to the watch-page three-dot menu", async ({ addon }) => {
    const page = addon.page;

    await openFixture(page, watchOwner("Watch Creator", "@watchcreator"), "/watch?v=fixture-video");

    await openCreatorMenu(page, '[data-testid="watch-menu"]');
    const menuItem = ".cf-menu-item";
    await expectContainsText(page, menuItem, "ChannelFence: Block");
  });

  test("rebinds a reused YouTube menu to the newly selected card", async ({ addon }) => {
    const page = addon.page;

    await openFixture(page, [
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

    await openCreatorMenu(page, '[data-testid="first-reused-menu-menu"]');
    await expectAttribute(page, ".cf-menu-item", "aria-label", "Block First Menu Creator with ChannelFence");

    const secondTrigger = '[data-testid="second-reused-menu-menu"]';
    await page.$eval(secondTrigger, (element) => element.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })));
    await page.locator(secondTrigger).click();
    const reboundAction = ".cf-menu-item";
    await expectAttribute(page, reboundAction, "aria-label", "Block Second Menu Creator with ChannelFence");
    await page.locator(reboundAction).click();

    await expectVisible(page, '[data-testid="first-reused-menu"]');
    await expectVisible(page, '[data-testid="second-reused-menu"]', false);
    const stored = await addon.getStorage<{
      cfBlockedChannels: Array<{ displayName: string }>;
    }>("cfBlockedChannels");
    expect(stored.cfBlockedChannels[0].displayName).toBe("second-menu-creator");
  });

  test("ignores sponsored Home cells between creator recommendations", async ({ addon }) => {
    const page = addon.page;

    await openFixture(page, [
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

    await expectVisible(page, '[data-testid="creator-above-shorts"] .cf-block-button');
    await expectVisible(page, '[data-testid="creator-below-shorts"] .cf-block-button');
    const promotion = '[data-testid="home-promotion"]';
    await expectVisible(page, promotion);
    await expectCount(page, promotion + " .cf-block-button", 0);

    await openCreatorMenu(page, '[data-testid="creator-above-shorts-menu"]');
    await expectCount(page, ".cf-menu-item", 1);
    const promotionMenu = '[data-testid="home-promotion-menu"]';
    await page.$eval(promotionMenu, (element) => element.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })));
    await page.locator(promotionMenu).click();
    await expectCount(page, ".cf-menu-item", 0);

    await page.locator('[data-testid="creator-below-shorts"] .cf-block-button').click();
    await expectVisible(page, '[data-testid="creator-below-shorts"]', false);
    await expectVisible(page, promotion);
    const stored = await addon.getStorage<{
      cfBlockedChannels: Array<{ displayName: string }>;
    }>("cfBlockedChannels");
    expect(stored.cfBlockedChannels).toEqual([
      expect.objectContaining({ displayName: "creator-below-shorts" })
    ]);
  });

  test("adds a search-result block control when YouTube fills the owner link late", async ({ addon }) => {
    const page = addon.page;

    const delayedCard = creatorCard({
      displayName: "Late Search Creator",
      handle: "@late-search",
      id: "late-search",
      tag: "ytd-video-renderer"
    }).replace('href="/@late-search"', "");
    await openFixture(page, delayedCard, "/results?search_query=late");

    await expectCount(page, '[data-testid="late-search"] .cf-block-button', 0);
    await page.$eval('[data-testid="late-search"] ytd-channel-name a', (anchor) => anchor.setAttribute("href", "/@late-search"));
    await expectVisible(page, '[data-testid="late-search"] .cf-block-button');
    await page.locator('[data-testid="late-search"] .cf-block-button').click();

    const stored = await addon.getStorage<{
      cfBlockedChannels: Array<{ aliases: string[]; displayName: string }>;
    }>("cfBlockedChannels");
    expect(stored.cfBlockedChannels[0]).toMatchObject({
      aliases: ["handle:@late-search"],
      displayName: "late-search"
    });
  });

  test("does not treat a channel mentioned in a search description as the uploader", async ({ addon }) => {
    const page = addon.page;

    await openFixture(page, creatorCard({
      displayName: "Search Uploader",
      handle: "@search-uploader",
      id: "search-with-mention",
      mentionedHandle: "@description-guest",
      tag: "ytd-video-renderer"
    }), "/results?search_query=collaboration");

    await page.locator('[data-testid="search-with-mention"] .cf-block-button').click();
    const stored = await addon.getStorage<{
      cfBlockedChannels: Array<{ aliases: string[] }>;
    }>("cfBlockedChannels");
    expect(stored.cfBlockedChannels[0].aliases).toEqual(["handle:@search-uploader"]);
  });

  test("uses the visible search byline instead of YouTube's hidden legacy byline", async ({ addon }) => {
    const page = addon.page;

    await openFixture(page, `
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

    const result = '[data-testid="modern-search-result"]';
    await expectCount(page, result + " .cf-block-button", 1);
    await expectVisible(page, result + " .cf-block-button", false);
    await page.$eval(result + " #channel-info", (channelInfo) => {
      channelInfo.removeAttribute("style");
      document.dispatchEvent(new Event("yt-page-data-updated", { bubbles: true }));
    });
    await expectVisible(page, result + ' button[aria-label="Block Modern Search Creator"]');
  });

  test("keeps one header control and suppresses redundant channel Home controls", async ({ addon }) => {
    const page = addon.page;

    await openFixture(page, [
      channelHeader("Fixture Creator", "@fixturecreator"),
      channelTabLockup({
        displayName: "Fixture Creator",
        id: "channel-home-one",
        includeAvatar: true
      }),
      channelTabLockup({
        displayName: "Fixture Creator",
        id: "channel-home-two",
        includeAvatar: true
      }),
      channelTabLockup({
        avatarHidden: true,
        displayName: "Fixture Creator",
        id: "channel-home-hidden-avatar",
        includeAvatar: true
      }),
      channelTabLockup({
        displayName: "Guest Creator",
        id: "channel-home-guest",
        includeAvatar: true
      })
    ].join(""), "/@fixturecreator");

    const headerButton = '[data-testid="channel-header"] .cf-block-button';
    await expectCount(page, headerButton, 1);
    await expect.poll(() => page.$eval(headerButton, (element) => element.className)).toMatch(/\bcf-channel-header-block\b/);
    await expectAttribute(page, headerButton + " .cf-channel-header-block__icon", "src", `${addon.origin}/assets/icons/channelfence-48.png`);
    await expectCount(page, headerButton + " .cf-block-button__symbol", 0);
    for (const id of [
      "channel-home-one",
      "channel-home-two",
      "channel-home-hidden-avatar"
    ]) {
      await expectCount(page, `[data-testid="${id}"] .cf-block-button`, 0);
    }
    await expectCount(page, '[data-testid="channel-home-guest"] .cf-block-button', 1);
    await expectAttribute(page, '[data-testid="channel-home-guest"] .cf-block-button', "aria-label", "Block Guest Creator");
    const labels = await page.$$eval(".cf-block-button", (buttons) => buttons.map((button) => button.getAttribute("aria-label") || ""));
    expect(labels.filter((label) => /\b(?:views?|ago)\b/i.test(label))).toEqual([]);

    for (let iteration = 1; iteration <= 4; iteration += 1) {
      await page.evaluate((value) => {
        const card = document.querySelector('[data-testid="channel-home-one"]');
        const views = card?.querySelector('[data-testid="channel-home-one-views"]');
        const age = card?.querySelector('[data-testid="channel-home-one-age"]');
        if (views) views.textContent = `${value * 10}K views`;
        if (age) age.textContent = `${value} days ago`;
        document.dispatchEvent(new Event("yt-page-data-updated", { bubbles: true }));
      }, iteration);
      await expectCount(page, '[data-testid="channel-home-one"] .cf-block-button', 0);
      await expectCount(page, '[data-testid="channel-header"] .cf-block-button', 1);
    }
  });

  test("uses the route handle and channel title instead of unrelated header links", async ({ addon }) => {
    const page = addon.page;

    await openFixture(page, modernChannelHeaderWithCommunityLink("Mylo the Cat", "@hiddentracktv2"), "/@hiddentracktv2");

    const header = '[data-testid="modern-channel-header"]';
    const button = header + " .cf-channel-header-block";
    await expectCount(page, button, 1);
    await expectAttribute(page, button, "aria-label", "Block Mylo the Cat");
    await expectAttribute(page, button, "data-cf-identity", "handle:@hiddentracktv2");
    await expectCount(page, header + ' button[aria-label*="Community"]', 0);

    const response = await addon.ui.evaluate(async () => {
      const extensionApi = (globalThis as unknown as {
        browser: {
          tabs: {
            query(query: { url: string }): Promise<Array<{ id?: number }>>;
            sendMessage(tabId: number, message: { type: string }): Promise<{
              displayName: string;
              owners: Array<{ displayName: string; refs: Array<{ key: string }> }>;
              refs: Array<{ key: string }>;
            }>;
          };
        };
      }).browser;
      const [tab] = await extensionApi.tabs.query({ url: "https://www.youtube.com/*" });
      if (!tab?.id) throw new Error("Could not find the YouTube fixture tab");
      return extensionApi.tabs.sendMessage(tab.id, { type: "CF_GET_PAGE_CONTEXT" });
    });
    expect(response.displayName).toBe("Mylo the Cat");
    expect(response.refs.map((ref) => ref.key)).toEqual(["handle:@hiddentracktv2"]);
    expect(response.owners).toEqual([{
      displayName: "Mylo the Cat",
      refs: [{
        key: "handle:@hiddentracktv2",
        type: "handle",
        url: "https://www.youtube.com/@hiddentracktv2",
        value: "@hiddentracktv2"
      }]
    }]);

    await page.locator(button).click();
    await expectContainsText(page, "#cf-hard-block-overlay", "hiddentracktv2 is on your ChannelFence block list.");
    await expect.poll(() => page.$eval("#cf-hard-block-overlay", (element) => element.textContent || "")).not.toContain("Community is on your ChannelFence block list.");

    const stored = await addon.getStorage<{
      cfBlockedChannels: Array<{
        aliases: string[];
        displayName: string;
        key: string;
        url: string;
      }>;
    }>("cfBlockedChannels");
    expect(stored.cfBlockedChannels).toHaveLength(1);
    expect(stored.cfBlockedChannels[0]).toMatchObject({
      aliases: ["handle:@hiddentracktv2"],
      displayName: "hiddentracktv2",
      key: "handle:@hiddentracktv2",
      url: "https://www.youtube.com/@hiddentracktv2"
    });
  });

  test("synthesizes a channel identity when the header has no owner anchor", async ({ addon }) => {
    const page = addon.page;

    await openFixture(page, modernChannelHeaderWithCommunityLink("Mylo the Cat", "@hiddentracktv2", false), "/@hiddentracktv2");

    const header = '[data-testid="modern-channel-header"]';
    await expectCount(page, header + " .cf-channel-header-block", 1);
    await expectAttribute(page, header + " .cf-channel-header-block", "aria-label", "Block Mylo the Cat");
    await expectAttribute(page, header + " .cf-channel-header-block", "data-cf-identity", "handle:@hiddentracktv2");
  });

  test("stores and displays the route handle instead of the mutable channel title", async ({ addon }) => {
    const page = addon.page;

    await openFixture(page, modernChannelHeaderWithCommunityLink("Roku Jones", "@rokujones"), "/@rokujones");

    await page.locator('[data-testid="modern-channel-header"] .cf-channel-header-block').click();
    await expectContainsText(page, "#cf-hard-block-overlay", "rokujones is on your ChannelFence block list.");
    await expect.poll(() => page.$eval("#cf-hard-block-overlay", (element) => element.textContent || "")).not.toContain("Roku Jones is on your ChannelFence block list.");

    const stored = await addon.getStorage<{
      cfBlockedChannels: Array<{
        aliases: string[];
        displayName: string;
        key: string;
        nameAliases: string[];
      }>;
    }>("cfBlockedChannels");
    expect(stored.cfBlockedChannels).toEqual([
      expect.objectContaining({
        aliases: ["handle:@rokujones"],
        displayName: "rokujones",
        key: "handle:@rokujones",
        nameAliases: ["Roku Jones"]
      })
    ]);
  });

  test("repairs a legacy channel title to the canonical handle label", async ({ addon }) => {
    const page = addon.page;
    await addon.setStorage({
      cfBlockedChannels: [legacyBlockedCreator("@hiddentracktv2", "Community")]
    });

    await openFixture(page, modernChannelHeaderWithCommunityLink("Mylo the Cat", "@hiddentracktv2"), "/@hiddentracktv2");

    await expectContainsText(page, "#cf-hard-block-overlay", "hiddentracktv2 is on your ChannelFence block list.");
    await expect.poll(() => page.$eval("#cf-hard-block-overlay", (element) => element.textContent || "")).not.toContain("Community is on your ChannelFence block list.");
    await expect.poll(async () => {
      const stored = await addon.getStorage<{
        cfBlockedChannels: Array<{ displayName: string; key: string; nameAliases: string[] }>;
      }>("cfBlockedChannels");
      return stored.cfBlockedChannels[0];
    }).toMatchObject({
      displayName: "hiddentracktv2",
      nameAliases: ["Mylo the Cat"],
      key: "handle:@hiddentracktv2"
    });
  });

  test("retains a different stable creator even when its display name matches the page", async ({ addon }) => {
    const page = addon.page;

    await openFixture(page, [
      channelHeader("Fixture Creator", "@fixturecreator"),
      creatorCard({
        displayName: "Fixture Creator",
        handle: "@different-fixture-creator",
        id: "same-name-different-channel"
      })
    ].join(""), "/@fixturecreator");

    await expectCount(page, '[data-testid="channel-header"] .cf-block-button', 1);
    await expectCount(page, '[data-testid="same-name-different-channel"] .cf-block-button', 1);
    await expectAttribute(page, '[data-testid="same-name-different-channel"] .cf-block-button', "aria-label", "Block Fixture Creator");
  });

  test("reconciles a reused channel card when its creator changes", async ({ addon }) => {
    const page = addon.page;

    await openFixture(page, [
      channelHeader("Fixture Creator", "@fixturecreator"),
      creatorCard({
        displayName: "Guest Creator",
        handle: "@guestcreator",
        id: "reused-channel-card"
      })
    ].join(""), "/@fixturecreator");

    await expectCount(page, '[data-testid="reused-channel-card"] .cf-block-button', 1);
    await page.evaluate(() => {
      const anchor = document.querySelector(
        '[data-testid="reused-channel-card"] ytd-channel-name a'
      );
      anchor?.setAttribute("href", "/@fixturecreator");
      anchor?.setAttribute("aria-label", "Fixture Creator");
      if (anchor) anchor.textContent = "Fixture Creator";
      document.dispatchEvent(new Event("yt-page-data-updated", { bubbles: true }));
    });
    await expectCount(page, '[data-testid="reused-channel-card"] .cf-block-button', 0);

    await page.evaluate(() => {
      const anchor = document.querySelector(
        '[data-testid="reused-channel-card"] ytd-channel-name a'
      );
      anchor?.setAttribute("href", "/@guestcreator");
      anchor?.setAttribute("aria-label", "Guest Creator");
      if (anchor) anchor.textContent = "Guest Creator";
      document.dispatchEvent(new Event("yt-page-data-updated", { bubbles: true }));
    });
    await expectCount(page, '[data-testid="reused-channel-card"] .cf-block-button', 1);
    await expectAttribute(page, '[data-testid="reused-channel-card"] .cf-block-button', "aria-label", "Block Guest Creator");
  });

  test("keeps only the other creator control on a channel-page collaboration", async ({ addon }) => {
    const page = addon.page;

    await openFixture(page, [
      channelHeader("Fixture Creator", "@fixturecreator"),
      `<ytd-rich-item-renderer data-testid="channel-collaboration">
        <a href="/watch?v=channel-collaboration">Collaboration video</a>
        <ytd-channel-name id="channel-name">
          <a href="/@fixturecreator">Fixture Creator</a>
          <a href="/@guestcreator">Guest Creator</a>
        </ytd-channel-name>
      </ytd-rich-item-renderer>`,
      comment({
        displayName: "Fixture Creator",
        handle: "@fixturecreator",
        id: "same-channel-comment"
      })
    ].join(""), "/@fixturecreator");

    const collaboration = '[data-testid="channel-collaboration"]';
    await expectCount(page, collaboration + " .cf-block-button", 1);
    await expectVisible(page, collaboration + ' button[aria-label="Block Guest Creator"]');
    await expectCount(page, '[data-testid="same-channel-comment"] .cf-block-button', 1);
  });

  test("keeps own compact Shorts header-only while retaining guest controls", async ({ addon }) => {
    const page = addon.page;

    await openFixture(page, [
      channelHeader("Fixture Creator", "@fixturecreator"),
      shortsShelf(),
      `<ytm-shorts-lockup-view-model-v2 data-testid="guest-compact-short">
        <a id="avatar-link" href="/@guestcreator">Guest Creator</a>
        <a href="/shorts/guest-compact-one">Guest compact Short</a>
        <div class="shortsLockupViewModelHostOutsideMetadataMenu">
          <button aria-label="More actions">More</button>
        </div>
      </ytm-shorts-lockup-view-model-v2>`
    ].join(""), "/@fixturecreator/shorts");

    await expectCount(page, '[data-testid="channel-header"] .cf-block-button', 1);
    await expectCount(page, '[data-testid="compact-short"] .cf-block-button', 0);
    await expectCount(page, '[data-testid="guest-compact-short"] .cf-block-button', 1);
  });

  test("refreshes channel identity during client-side channel navigation", async ({ addon }) => {
    const page = addon.page;

    await openFixture(page, [
      channelHeader("Fixture Creator", "@fixturecreator"),
      creatorCard({
        displayName: "Fixture Creator",
        handle: "@fixturecreator",
        id: "previous-channel-card"
      })
    ].join(""), "/@fixturecreator");

    await expectCount(page, '[data-testid="previous-channel-card"] .cf-block-button', 0);
    await page.evaluate(() => {
      document.dispatchEvent(new Event("yt-navigate-start", { bubbles: true }));
      history.pushState({}, "", "/@guestcreator");
      const header = document.querySelector('[data-testid="channel-header"]');
      const title = header?.querySelector("h1");
      const anchor = header?.querySelector("a");
      if (title) title.textContent = "Guest Creator";
      anchor?.setAttribute("href", "/@guestcreator");
      if (anchor) anchor.textContent = "@guestcreator";
      document.dispatchEvent(new Event("yt-navigate-finish", { bubbles: true }));
    });

    await expectCount(page, '[data-testid="channel-header"] .cf-block-button', 1);
    await expectAttribute(page, '[data-testid="channel-header"] .cf-block-button', "data-cf-identity", "handle:@guestcreator");
    await expectCount(page, '[data-testid="previous-channel-card"] .cf-block-button', 1);
    await expectAttribute(page, '[data-testid="previous-channel-card"] .cf-block-button', "aria-label", "Block Fixture Creator");
  });

  test("does not mistake channel Videos statistics for creator identities", async ({ addon }) => {
    const page = addon.page;

    await openFixture(page, [
      channelHeader("Fixture Creator", "@fixturecreator"),
      channelTabLockup({
        displayName: "Fixture Creator",
        id: "channel-videos-card",
        includeAvatar: false
      })
    ].join(""), "/@fixturecreator/videos");

    await expectCount(page, '[data-testid="channel-header"] .cf-block-button', 1);
    await expectCount(page, '[data-testid="channel-videos-card"] .cf-block-button', 0);

    for (let iteration = 1; iteration <= 4; iteration += 1) {
      await page.evaluate((value) => {
        const card = document.querySelector('[data-testid="channel-videos-card"]');
        const views = card?.querySelector('[data-testid="channel-videos-card-views"]');
        const age = card?.querySelector('[data-testid="channel-videos-card-age"]');
        if (views) views.textContent = `${value},001 views`;
        if (age) age.textContent = `${value} hours ago`;
        document.dispatchEvent(new Event("yt-page-data-updated", { bubbles: true }));
      }, iteration);
      await expectCount(page, '[data-testid="channel-videos-card"] .cf-block-button', 0);
      await expectCount(page, '[data-testid="channel-header"] .cf-block-button', 1);
    }
  });

  test("does not mistake abbreviated channel Videos statistics for creator identities", async ({ addon }) => {
    const page = addon.page;

    const statistics = [
      { views: "8", age: "16h ago", ageLabel: "16 hours ago" },
      { views: "10", age: "5d ago", ageLabel: "5 days ago" },
      { views: "16", age: "2w ago", ageLabel: "2 weeks ago" },
      { views: "26", age: "3mo ago", ageLabel: "3 months ago" },
      { views: "1.2K", age: "4y ago", ageLabel: "4 years ago" },
      { views: "8", age: "30m ago", ageLabel: "30 minutes ago" },
      { views: "8", age: "45s ago", ageLabel: "45 seconds ago" }
    ];
    await openFixture(page, [
      channelHeader("Fixture Creator", "@fixturecreator"),
      ...statistics.map((compactStatistics, index) => channelTabLockup({
        compactStatistics,
        displayName: "Fixture Creator",
        id: `compact-statistics-${index}`,
        includeAvatar: false
      }))
    ].join(""), "/@fixturecreator/videos");

    await expectCount(page, '[data-testid="channel-header"] .cf-block-button', 1);
    await expectCount(page, "ytd-rich-item-renderer .cf-block-button", 0);
  });

  test("retains avatar and text creator controls beside abbreviated video statistics", async ({ addon }) => {
    const page = addon.page;

    await openFixture(page, [
      channelHeader("Fixture Creator", "@fixturecreator"),
      channelTabLockup({
        compactStatistics: { views: "8", age: "16h ago", ageLabel: "16 hours ago" },
        displayName: "Studio 8",
        id: "guest-avatar-with-compact-statistics",
        includeAvatar: true
      }),
      `<yt-lockup-view-model data-testid="text-creator-with-compact-statistics">
        <a href="/watch?v=text-creator">Guest video</a>
        <yt-content-metadata-view-model>
          <div class="ytContentMetadataViewModelMetadataRow">
            <span role="text">Studio 16h</span>
          </div>
          <div class="ytContentMetadataViewModelMetadataRow">
            <span role="text" aria-label="10 views">10</span>
            <span aria-hidden="true"> </span>
            <span role="text" aria-label="5 days ago">5d ago</span>
          </div>
        </yt-content-metadata-view-model>
      </yt-lockup-view-model>`
    ].join(""), "/@fixturecreator/videos");

    await expectAttribute(page, '[data-testid="guest-avatar-with-compact-statistics"] .cf-block-button', "aria-label", "Block Studio 8");
    const textCreatorButton = '[data-testid="text-creator-with-compact-statistics"] .cf-block-button';
    await expectAttribute(page, textCreatorButton, "aria-label", "Block Studio 16h");
    await page.locator(textCreatorButton).click();
    await expectVisible(page, '[data-testid="text-creator-with-compact-statistics"]', false);
    await expect.poll(async () => {
      const stored = await addon.getStorage<{
        cfBlockedChannels: Array<{ displayName: string; key: string }>;
      }>("cfBlockedChannels");
      return stored.cfBlockedChannels;
    }).toEqual([expect.objectContaining({ displayName: "Studio 16h", key: "name:studio 16h" })]);
    await expectVisible(page, '[data-testid="guest-avatar-with-compact-statistics"]');
  });

  test("offers independent block controls for every collaboration owner", async ({ addon }) => {
    const page = addon.page;

    await openFixture(page, watchOwners([
      { displayName: "Channel Five", handle: "@channel-five" },
      { displayName: "All Gas No Brakes", handle: "@all-gas-no-brakes" }
    ]), "/watch?v=collaboration");

    const owner = "ytd-watch-metadata #owner";
    await expectCount(page, owner + " .cf-block-button", 2);
    await expectVisible(page, owner + ' button[aria-label="Block Channel Five"]');
    await expectVisible(page, owner + ' button[aria-label="Block All Gas No Brakes"]');

    await openCreatorMenu(page, '[data-testid="watch-menu"]');
    const menuItems = ".cf-menu-item";
    await expectCount(page, menuItems, 2);
    await expect.poll(() => page.$$eval(menuItems, (items) => items.map((item) => item.textContent)))
      .toEqual([expect.stringContaining("ChannelFence: Block Channel Five"),
        expect.stringContaining("ChannelFence: Block All Gas No Brakes")]);
    await page.locator('.cf-menu-item[aria-label="Block Channel Five with ChannelFence"]').click();

    const stored = await addon.getStorage<{
      cfBlockedChannels: Array<{ aliases: string[]; displayName: string }>;
    }>("cfBlockedChannels");
    expect(stored.cfBlockedChannels).toEqual([
      expect.objectContaining({
        aliases: ["handle:@channel-five"],
        displayName: "channel-five"
      })
    ]);
  });

  test("adds a linkless block control when YouTube fills the creator label late", async ({ addon }) => {
    const page = addon.page;

    const delayedLockup = rightRailLockup({
      displayName: "Late Label Creator",
      id: "late-label"
    }).replace(
      'aria-label="Go to channel Late Label Creator"',
      'aria-label=""'
    ).replace(
      ">Late Label Creator</span>",
      "></span>"
    );
    await openFixture(page, delayedLockup, "/watch?v=late-label-fixture");

    const card = '[data-testid="late-label"]';
    await expectCount(page, card + " .cf-block-button", 0);
    await page.$eval(card + " [role='button'][aria-label='']", (avatar) => {
      avatar.setAttribute("aria-label", "Go to channel Late Label Creator");
    });
    await expectVisible(page, card + ' button[aria-label="Block Late Label Creator"]');
  });

  test("hides a live-style collaboration when a linkless collaborator is blocked", async ({ addon }) => {
    const page = addon.page;
    await addon.setStorage({
      cfBlockedChannels: [blockedCreator("@mrbeast", "MrBeast")]
    });

    await openFixture(page, `
      <ytd-video-renderer data-testid="live-collaboration">
        <div id="channel-info">
          <a id="channel-thumbnail" href="/@MrBeast2" aria-label="Go to channel MrBeast 2"></a>
          <yt-avatar-stack-view-model aria-label="Collaboration channels"></yt-avatar-stack-view-model>
          <div id="attributed-channel-name">MrBeast 2 and MrBeast</div>
        </div>
      </ytd-video-renderer>
    `, "/results?search_query=mrbeast");

    await expectVisible(page, '[data-testid="live-collaboration"]', false);
  });

  test("does not name-match a linked collaboration owner with a different handle", async ({ addon }) => {
    const page = addon.page;
    await addon.setStorage({
      cfBlockedChannels: [blockedCreator("@alpha", "Same Name")]
    });

    const collaborationCard = (id: string, handle: string) => `
      <ytd-video-renderer data-testid="${id}">
        <div id="channel-info">
          <a id="channel-thumbnail" href="/${handle}" aria-label="Go to channel Same Name">
            Same Name
          </a>
          <yt-avatar-stack-view-model aria-label="Collaboration channels">
          </yt-avatar-stack-view-model>
          <div id="attributed-channel-name">Same Name and Guest Creator</div>
        </div>
      </ytd-video-renderer>`;
    await openFixture(page, [
      collaborationCard("different-linked-collaborator", "@beta"),
      collaborationCard("blocked-linked-collaborator", "@alpha")
    ].join(""), "/results?search_query=collaborations");

    await expectVisible(page, '[data-testid="different-linked-collaborator"]');
    await expectVisible(page, '[data-testid="blocked-linked-collaborator"]', false);
  });

  test("blocks linkless right-rail recommendations with the inline button", async ({ addon }) => {
    const page = addon.page;

    await openFixture(page, [
      rightRailLockup({ displayName: "Right Rail Creator", id: "rail-one" }),
      rightRailLockup({ displayName: "Right Rail Creator", id: "rail-two" })
    ].join(""), "/watch?v=fixture-video");

    await expectCount(page, '[data-testid="rail-one"] .cf-block-button', 1);
    await expectCount(page, '[data-testid="rail-two"] .cf-block-button', 1);
    await expectVisible(page, '[data-testid="rail-one"] .cf-block-button');
    await page.locator('[data-testid="rail-one"] .cf-block-button').click();
    await expectVisible(page, '[data-testid="rail-one"]', false);
    await expectVisible(page, '[data-testid="rail-two"]', false);

    const stored = await addon.getStorage<{
      cfBlockedChannels: Array<{ aliases: string[]; displayName: string }>;
    }>("cfBlockedChannels");
    expect(stored.cfBlockedChannels[0]).toMatchObject({
      aliases: ["name:right rail creator"],
      displayName: "Right Rail Creator"
    });
  });

  test("identifies and blocks the creator of a YouTube Course card", async ({ addon }) => {
    const page = addon.page;

    await openFixture(page, [
      courseLockup("Course Creator", "course-one"),
      courseLockup("Course Creator", "course-two")
    ].join(""));

    const firstCourse = '[data-testid="course-one"]';
    const button = firstCourse + ' button[aria-label="Block Course Creator"]';
    await expectCount(page, firstCourse + " .cf-block-button", 1);
    await expectCount(page, '[data-testid="course-two"] .cf-block-button', 1);
    await expectVisible(page, button);
    await page.locator(button).click();
    await expectVisible(page, firstCourse, false);
    await expectVisible(page, '[data-testid="course-two"]', false);

    const stored = await addon.getStorage<{
      cfBlockedChannels: Array<{ aliases: string[]; displayName: string }>;
    }>("cfBlockedChannels");
    expect(stored.cfBlockedChannels[0]).toMatchObject({
      aliases: ["name:course creator"],
      displayName: "Course Creator"
    });
  });

  test("adds the ChannelFence action to a linkless right-rail three-dot menu", async ({ addon }) => {
    const page = addon.page;

    await openFixture(page, rightRailLockup({
      displayName: "Rail Menu Creator",
      id: "rail-menu"
    }), "/watch?v=fixture-video");

    await openCreatorMenu(page, '[data-testid="rail-menu-menu"]');
    const menuItem = ".cf-menu-item";
    await expectContainsText(page, menuItem, "ChannelFence: Block");
    await page.locator(menuItem).click();
    await expectVisible(page, '[data-testid="rail-menu"]', false);

    const stored = await addon.getStorage<{
      cfBlockedChannels: Array<{ key: string }>;
    }>("cfBlockedChannels");
    expect(stored.cfBlockedChannels[0].key).toBe("name:rail menu creator");
  });

  test("matches a stable handle block against a linkless right-rail display name", async ({ addon }) => {
    const page = addon.page;
    await addon.setStorage({
      cfBlockedChannels: [blockedCreator("@right-rail", "Right Rail Creator")]
    });

    await openFixture(page, rightRailLockup({
      displayName: "Right Rail Creator",
      id: "known-rail"
    }), "/watch?v=fixture-video");

    await expectVisible(page, '[data-testid="known-rail"]', false);
  });

  test("hides blocked comments only while the comment preference is enabled", async ({ addon }) => {
    const page = addon.page;
    await addon.setStorage({
      cfBlockedChannels: [blockedCreator("@blockedcommenter", "Blocked Commenter")]
    });

    await openFixture(page, [
      comment({ displayName: "Blocked Commenter", handle: "@blockedcommenter", id: "blocked-comment" }),
      comment({ displayName: "Visible Commenter", handle: "@visiblecommenter", id: "visible-comment" })
    ].join(""));

    await expectVisible(page, '[data-testid="blocked-comment"]', false);
    await expectVisible(page, '[data-testid="visible-comment"]');

    await addon.setStorage({ cfHideComments: false });
    await expectVisible(page, '[data-testid="blocked-comment"]');
  });
});
