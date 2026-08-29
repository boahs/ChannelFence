import type { Page } from "@playwright/test";
import { blockedCreator, expect, test } from "../fixtures/extension.fixture";
import { shortsShelf, shortsViewer } from "../fixtures/youtube-fixtures";
import { YouTubeSurfacePage } from "../pages/youtube-surface.page";

async function mockCompactShortMetadata(page: Page): Promise<string[]> {
  const requestedShorts: string[] = [];
  await page.route("https://www.youtube.com/oembed?**", async (route) => {
    const shortUrl = new URL(route.request().url()).searchParams.get("url") || "";
    requestedShorts.push(shortUrl);
    const path = new URL(shortUrl).pathname;
    const blockedCreator = path === "/shorts/compact-one";
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        author_name: blockedCreator ? "Compact Shorts Creator" : "Allowed Shorts Creator",
        author_url: blockedCreator
          ? "https://www.youtube.com/@compactshortscreator"
          : "https://www.youtube.com/@allowedshortscreator"
      })
    });
  });
  return requestedShorts;
}

type QueuedShort = {
  path: string;
  displayName: string;
  handle: string;
};

type ShortsAdvanceOptions = {
  ownerDelayMs?: number;
  ownerNeverHydrates?: boolean;
  navigationStartDelayMs?: number;
  routeDelayMs?: number;
};

async function installShortsAdvanceQueue(
  page: Page,
  queuedShorts: QueuedShort[],
  options: ShortsAdvanceOptions = {}
): Promise<void> {
  await page.evaluate(({
    queue,
    ownerDelay,
    ownerNeverHydrates,
    navigationStartDelay,
    routeDelay
  }) => {
    const shorts = document.querySelector("ytd-shorts");
    const renderer = document.querySelector("ytd-shorts ytd-reel-video-renderer");
    const initialAnchor = renderer?.querySelector(
      "yt-reel-channel-bar-view-model a[href*='/@']"
    ) as HTMLAnchorElement | null;
    if (!shorts || !renderer || !initialAnchor) {
      throw new Error("Shorts fixture is missing its viewer identity");
    }
    let anchor: HTMLAnchorElement = initialAnchor;

    const navigation = document.createElement("div");
    navigation.id = "navigation-button-down";
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-label", "Next video");
    navigation.append(button);
    shorts.append(navigation);

    const state = {
      clickCount: 0,
      paths: [location.pathname]
    };
    (window as typeof window & { __cfShortsAdvanceState?: typeof state })
      .__cfShortsAdvanceState = state;
    const remaining = [...queue];
    const shortPermalink = document.createElement("a");
    shortPermalink.dataset.cfFixtureShortPermalink = "true";
    shortPermalink.href = location.pathname;
    shortPermalink.hidden = true;
    renderer.append(shortPermalink);

    button.addEventListener("click", () => {
      const next = remaining.shift();
      if (!next) {
        button.disabled = true;
        return;
      }
      state.clickCount += 1;
      if (navigationStartDelay > 0) {
        window.setTimeout(() => {
          document.dispatchEvent(new Event("yt-navigate-start", { bubbles: true }));
        }, navigationStartDelay);
      } else {
        document.dispatchEvent(new Event("yt-navigate-start", { bubbles: true }));
      }
      window.setTimeout(() => {
        shortPermalink.href = next.path;
        history.pushState({}, "", next.path);
        state.paths.push(next.path);
        document.dispatchEvent(new Event("yt-page-data-updated", { bubbles: true }));
        document.dispatchEvent(new Event("yt-navigate-finish", { bubbles: true }));

        if (ownerNeverHydrates) {
          anchor.remove();
          button.disabled = remaining.length === 0;
        } else {
          window.setTimeout(() => {
            const nextAnchor = anchor.cloneNode(true) as HTMLAnchorElement;
            nextAnchor.href = `/${next.handle}/shorts`;
            nextAnchor.textContent = next.displayName;
            nextAnchor.setAttribute("aria-label", next.displayName);
            anchor.replaceWith(nextAnchor);
            anchor = nextAnchor;
            renderer.setAttribute("is-active", "");
            button.disabled = remaining.length === 0;
            document.dispatchEvent(new Event("yt-page-data-updated", { bubbles: true }));
          }, ownerDelay);
        }
      }, routeDelay);
    });
  }, {
    queue: queuedShorts,
    ownerDelay: options.ownerDelayMs ?? 120,
    ownerNeverHydrates: options.ownerNeverHydrates === true,
    navigationStartDelay: options.navigationStartDelayMs ?? 0,
    routeDelay: options.routeDelayMs ?? 0
  });
}

async function routeToNextShortOnAdvance(page: Page, path: string): Promise<void> {
  await installShortsAdvanceQueue(page, [{
    path,
    displayName: "Next Shorts Creator",
    handle: "@nextshortcreator"
  }]);
}

async function shortsAdvanceState(page: Page): Promise<{
  clickCount: number;
  paths: string[];
}> {
  return page.evaluate(() => {
    const state = (window as typeof window & {
      __cfShortsAdvanceState?: { clickCount: number; paths: string[] };
    }).__cfShortsAdvanceState;
    if (!state) {
      throw new Error("Shorts advance state was not installed");
    }
    return state;
  });
}

test.describe("YouTube Shorts controls", () => {
  test("hides Shorts in feeds while keeping regular videos and Shorts navigation available", async ({
    extensionPage,
    extensionStorage
  }) => {
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(shortsShelf(), "/");

    await expect(youtube.card("shorts-section")).toBeVisible();
    await expect(youtube.card("standalone-short")).toBeVisible();
    await expect(youtube.card("modern-shorts-shelf")).toBeVisible();
    await expect(youtube.card("shorts-guide")).toBeVisible();
    await expect(youtube.card("regular-video")).toBeVisible();

    await extensionStorage.set({ cfHideHomeShorts: true });
    await expect(youtube.card("shorts-section")).toBeHidden();
    await expect(youtube.card("standalone-short")).toBeHidden();
    await expect(youtube.card("modern-shorts-shelf")).toBeHidden();
    await expect(youtube.card("shorts-guide")).toBeVisible();
    await expect(youtube.card("shorts-mini-guide")).toBeVisible();
    await expect(youtube.card("regular-video")).toBeVisible();

    await extensionStorage.set({ cfEnabled: false });
    await expect(youtube.card("shorts-section")).toBeVisible();
    await expect(youtube.card("standalone-short")).toBeVisible();
    await expect(youtube.card("modern-shorts-shelf")).toBeVisible();

    await extensionStorage.set({ cfEnabled: true });
    await expect(youtube.card("shorts-section")).toBeHidden();

    await extensionStorage.set({ cfHideHomeShorts: false });
    await expect(youtube.card("shorts-section")).toBeVisible();
    await expect(youtube.card("standalone-short")).toBeVisible();
    await expect(youtube.card("modern-shorts-shelf")).toBeVisible();
    await expect(youtube.card("shorts-guide")).toBeVisible();
  });

  test("keeps direct Shorts pages available when feed Shorts are hidden", async ({
    extensionPage,
    extensionId,
    extensionStorage
  }) => {
    await extensionStorage.set({ cfHideHomeShorts: true });
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(shortsViewer("Shorts Creator", "@shortscreator"), "/shorts/fixture-short");

    await expect(extensionPage.locator("#cf-hard-block-overlay")).toHaveCount(0);
    const viewer = youtube.card("shorts-viewer");
    const actionBar = youtube.card("shorts-action-bar");
    const action = actionBar.locator(":scope > .cf-shorts-action");
    const blockButton = action.getByRole("button", {
      name: "Block Shorts Creator with ChannelFence"
    });
    await expect(blockButton).toBeVisible();
    await expect(youtube.card("shorts-channel-bar").locator(".cf-block-button")).toHaveCount(0);
    await expect(action).toHaveCSS("height", "78px");
    await expect(action).toHaveCSS("width", "48px");
    await expect(blockButton).toHaveCSS("height", "48px");
    await expect(blockButton).toHaveCSS("width", "48px");
    await expect(action.locator(".cf-shorts-action__label")).toHaveText("Block");
    await expect(action.locator(".cf-shorts-action__icon")).toHaveAttribute(
      "src",
      `chrome-extension://${extensionId}/assets/icons/channelfence-48.png`
    );
    expect(await actionBar.locator(":scope > *").first().getAttribute("class"))
      .toContain("cf-shorts-action");
    await expect(viewer.locator(".cf-shorts-action")).toHaveCount(1);

    const stored = await extensionStorage.get<{ cfHideHomeShorts: boolean }>("cfHideHomeShorts");
    expect(stored.cfHideHomeShorts).toBe(true);
  });

  test("hides Shorts shelves and modern cards in search results", async ({
    extensionPage,
    extensionStorage
  }) => {
    await extensionStorage.set({ cfHideHomeShorts: true });
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(shortsShelf(), "/results?search_query=shorts");

    await expect(youtube.card("shorts-section")).toBeHidden();
    await expect(youtube.card("standalone-short")).toBeHidden();
    await expect(youtube.card("modern-shorts-shelf")).toBeHidden();
    await expect(youtube.card("shorts-guide")).toBeVisible();
    await expect(youtube.card("regular-video")).toBeVisible();
  });

  test("blocks a compact Shorts creator without leaving the feed", async ({
    extensionPage,
    extensionStorage
  }) => {
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(shortsShelf(), "/results?search_query=shorts");
    const requestedShorts = await mockCompactShortMetadata(extensionPage);

    const card = youtube.card("compact-short");
    const button = card.getByRole("button", {
      name: "Block this Short's creator with ChannelFence"
    });
    await expect(button).toBeVisible();
    await expect(button).toHaveCount(1);
    const feedUrl = extensionPage.url();
    await button.click();
    await expect(extensionPage).toHaveURL(feedUrl);
    await expect.poll(async () => {
      const stored = await extensionStorage.get<{
        cfBlockedChannels: Array<{ aliases: string[]; shortPaths: string[] }>;
      }>("cfBlockedChannels");
      return stored.cfBlockedChannels[0];
    }).toMatchObject({
      aliases: ["handle:@compactshortscreator"],
      shortPaths: ["/shorts/compact-one"]
    });
    await expect.poll(() => requestedShorts.length).toBe(3);
    expect(requestedShorts).toContain("https://www.youtube.com/shorts/compact-one");
    await expect(card).toBeHidden();
    await expect(youtube.card("compact-short-two")).toBeVisible();
    await expect(youtube.card("compact-short-three")).toBeVisible();
    await expect(youtube.card("compact-row-one").locator(
      ":scope > .ytGridShelfViewModelGridShelfItem:not(.cf-hidden-by-channelfence)"
    )).toHaveCount(2);
    await expect(extensionPage.locator("#cf-hard-block-overlay")).toHaveCount(0);

    const refreshRequests: string[] = [];
    await extensionPage.route("https://www.youtube.com/oembed?**", async (route) => {
      refreshRequests.push(new URL(route.request().url()).searchParams.get("url") || "");
      await route.abort();
    });
    await extensionPage.reload({ waitUntil: "domcontentloaded" });
    await expect(youtube.card("compact-short")).toBeHidden();
    await expect(extensionPage).toHaveURL(feedUrl);
    await expect.poll(() => refreshRequests.length).toBe(2);
    expect(refreshRequests).not.toContain("https://www.youtube.com/shorts/compact-one");
  });

  test("keeps compact Shorts visible while creator metadata is still loading", async ({
    extensionPage,
    extensionStorage
  }) => {
    let releaseLookup!: () => void;
    const lookupGate = new Promise<void>((resolve) => {
      releaseLookup = resolve;
    });
    let markLookupStarted!: () => void;
    const lookupStarted = new Promise<void>((resolve) => {
      markLookupStarted = resolve;
    });
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(shortsShelf(), "/results?search_query=shorts");
    await extensionPage.route("https://www.youtube.com/oembed?**", async (route) => {
      markLookupStarted();
      await lookupGate;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          author_name: "Allowed Shorts Creator",
          author_url: "https://www.youtube.com/@allowedshortscreator"
        })
      });
    });
    await extensionStorage.set({
      cfBlockedChannels: [blockedCreator("@unrelated", "Unrelated Creator")]
    });
    await lookupStarted;
    const pendingCard = youtube.card("compact-slot-one");
    await expect(pendingCard).toBeVisible();
    await expect(youtube.card("compact-short-two")).toBeVisible();

    releaseLookup();
    await expect.poll(async () => pendingCard.getAttribute("class"))
      .not.toContain("cf-compact-short-pending");
  });

  test("adds a safe block action to compact Shorts menus", async ({
    extensionPage,
    extensionStorage
  }) => {
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(shortsShelf(), "/results?search_query=shorts");
    await mockCompactShortMetadata(extensionPage);

    const menuItem = await youtube.openCreatorMenu("compact-short-menu");
    await expect(extensionPage.locator(".cf-menu-item")).toHaveCount(1);
    await expect(menuItem.locator(".cf-menu-item__label"))
      .toHaveText("ChannelFence: Block creator");
    const feedUrl = extensionPage.url();
    await menuItem.click();
    await expect(extensionPage).toHaveURL(feedUrl);
    await expect.poll(async () => {
      const stored = await extensionStorage.get<{
        cfBlockedChannels: Array<{ displayName: string; shortPaths: string[] }>;
      }>("cfBlockedChannels");
      return stored.cfBlockedChannels[0];
    }).toMatchObject({
      displayName: "compactshortscreator",
      shortPaths: ["/shorts/compact-one"]
    });
    await expect(youtube.card("compact-short")).toBeHidden();
  });

  test("blocks the visible creator from the current Shorts viewer", async ({
    extensionPage,
    extensionStorage
  }) => {
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(
      shortsViewer("Shorts Creator", "@shortscreator"),
      "/shorts/fixture-short"
    );

    const blockButton = youtube.card("shorts-action-bar").getByRole("button", {
      name: "Block Shorts Creator with ChannelFence"
    });
    await expect(blockButton).toBeVisible();
    const video = youtube.card("shorts-video");
    await video.evaluate((element) => {
      const media = element as HTMLVideoElement;
      media.dataset.pauseCalls = "0";
      media.pause = () => {
        media.dataset.pauseCalls = String(Number(media.dataset.pauseCalls || 0) + 1);
      };
    });
    await routeToNextShortOnAdvance(extensionPage, "/shorts/fixture-next");
    await blockButton.click();

    const stored = await extensionStorage.get<{
      cfBlockedChannels: Array<{ aliases: string[]; displayName: string }>;
    }>("cfBlockedChannels");
    expect(stored.cfBlockedChannels).toEqual([
      expect.objectContaining({
        aliases: ["handle:@shortscreator"],
        displayName: "shortscreator"
      })
    ]);
    await expect(extensionPage).toHaveURL("https://www.youtube.com/shorts/fixture-next");
    await expect(video).toHaveAttribute("data-pause-calls", "0");
    await expect(youtube.card("shorts-action-bar")).toBeVisible();
    await expect(youtube.card("shorts-like")).toBeVisible();
    await expect(extensionPage.locator("#cf-hard-block-overlay")).toHaveCount(0);
  });

  test("waits for late Shorts controls instead of prematurely returning Home", async ({
    extensionPage,
    extensionStorage
  }) => {
    await extensionStorage.set({
      cfBlockedChannels: [blockedCreator("@shortscreator", "Shorts Creator")]
    });
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(
      shortsViewer("Shorts Creator", "@shortscreator"),
      "/shorts/"
    );
    await extensionPage.evaluate(() => {
      const scroller = document.querySelector("ytd-shorts #shorts-container");
      if (!scroller) {
        throw new Error("Shorts fixture scroller is missing");
      }
      scroller.id = "shorts-container-unavailable";
    });

    // With no usable scroll container, ChannelFence must keep waiting for
    // YouTube to hydrate its native control instead of returning Home.
    await extensionPage.waitForTimeout(3_500);
    await expect(extensionPage).toHaveURL("https://www.youtube.com/shorts/");
    await installShortsAdvanceQueue(extensionPage, [{
      path: "/shorts/late-allowed",
      displayName: "Late Allowed Creator",
      handle: "@lateallowed"
    }]);

    await expect(extensionPage).toHaveURL(
      "https://www.youtube.com/shorts/late-allowed",
      { timeout: 6_000 }
    );
    await expect(youtube.card("shorts-action-bar").getByRole("button", {
      name: "Block Late Allowed Creator with ChannelFence"
    })).toBeVisible();
    expect((await shortsAdvanceState(extensionPage)).clickCount).toBe(1);
    await expect(extensionPage.locator("#cf-hard-block-overlay")).toHaveCount(0);
  });

  test("fails open on the current Short when YouTube provides no next route", async ({
    extensionPage,
    extensionStorage
  }) => {
    await extensionStorage.set({
      cfBlockedChannels: [blockedCreator("@strandedblocked", "Stranded Blocked Creator")]
    });
    const youtube = new YouTubeSurfacePage(extensionPage);
    const strandedUrl = "https://www.youtube.com/shorts/stranded-blocked?si=fixture";
    await youtube.open(
      shortsViewer("Stranded Blocked Creator", "@strandedblocked"),
      "/shorts/stranded-blocked?si=fixture"
    );

    await expect(extensionPage.locator("html")).toHaveClass(/cf-watch-pending/);
    await extensionPage.waitForTimeout(10_500);
    await expect(extensionPage).toHaveURL(strandedUrl);
    await expect(extensionPage.locator("html")).not.toHaveClass(/cf-watch-pending/);
    await expect(extensionPage.locator("#cf-hard-block-overlay")).toHaveCount(0);

    // Later YouTube route/owner notifications must not restart the same failed
    // skip and hide the Short for another ten seconds. This includes YouTube
    // removing a share/tracking parameter from the same canonical Short.
    await extensionPage.evaluate(() => {
      history.replaceState({}, "", "/shorts/stranded-blocked");
      document.dispatchEvent(new Event("yt-page-data-updated", { bubbles: true }));
    });
    await extensionPage.waitForTimeout(750);
    await expect(extensionPage).toHaveURL(
      "https://www.youtube.com/shorts/stranded-blocked"
    );
    await expect(extensionPage.locator("html")).not.toHaveClass(/cf-watch-pending/);
    await expect(extensionPage.locator("#cf-hard-block-overlay")).toHaveCount(0);
  });

  test("does not double-advance when scroll navigation commits after controls appear", async ({
    extensionPage,
    extensionStorage
  }) => {
    await extensionStorage.set({
      cfBlockedChannels: [blockedCreator("@scrollblocked", "Scroll Blocked Creator")]
    });
    await extensionPage.addInitScript(() => {
      document.addEventListener("DOMContentLoaded", () => {
        const shorts = document.querySelector("ytd-shorts");
        const scroller = shorts?.querySelector("#shorts-container") as HTMLElement | null;
        const renderer = shorts?.querySelector(
          "ytd-reel-video-renderer"
        ) as HTMLElement | null;
        let owner = renderer?.querySelector(
          "yt-reel-channel-bar-view-model a[href*='/@']"
        ) as HTMLAnchorElement | null;
        if (!shorts || !scroller || !renderer || !owner) {
          return;
        }

        const permalink = document.createElement("a");
        permalink.href = location.pathname;
        permalink.hidden = true;
        renderer.append(permalink);

        const state = {
          scrollCount: 0,
          nativeClickCount: 0,
          paths: [location.pathname]
        };
        (window as typeof window & { __cfDelayedScrollState?: typeof state })
          .__cfDelayedScrollState = state;

        scroller.addEventListener("scroll", () => {
            state.scrollCount += 1;

            window.setTimeout(() => {
              const navigation = document.createElement("div");
              navigation.id = "navigation-button-down";
              const button = document.createElement("button");
              button.type = "button";
              button.setAttribute("aria-label", "Next video");
              button.addEventListener("click", () => {
                state.nativeClickCount += 1;
                history.pushState({}, "", "/shorts/double-skipped");
                state.paths.push(location.pathname);
              });
              navigation.append(button);
              shorts.append(navigation);
            }, 100);

            // YouTube can begin changing the viewport before announcing its
            // SPA navigation. A late native button must not become a second
            // advance mechanism during this window.
            window.setTimeout(() => {
              document.dispatchEvent(new Event("yt-navigate-start", { bubbles: true }));
            }, 600);

            window.setTimeout(() => {
              permalink.href = "/shorts/scroll-allowed";
              const nextOwner = owner!.cloneNode(true) as HTMLAnchorElement;
              nextOwner.href = "/@scrollallowed/shorts";
              nextOwner.textContent = "Scroll Allowed Creator";
              nextOwner.setAttribute("aria-label", "Scroll Allowed Creator");
              owner!.replaceWith(nextOwner);
              owner = nextOwner;
              renderer.setAttribute("is-active", "");
              history.pushState({}, "", "/shorts/scroll-allowed");
              state.paths.push(location.pathname);
              document.dispatchEvent(new Event("yt-page-data-updated", { bubbles: true }));
              document.dispatchEvent(new Event("yt-navigate-finish", { bubbles: true }));
            }, 900);
        }, { once: true });
      }, { once: true });
    });

    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(
      shortsViewer("Scroll Blocked Creator", "@scrollblocked"),
      "/shorts/scroll-blocked"
    );

    await expect.poll(() => extensionPage.evaluate(() => (
      window as typeof window & {
        __cfDelayedScrollState?: { scrollCount: number };
      }
    ).__cfDelayedScrollState?.scrollCount ?? -1), { timeout: 5_000 }).toBe(1);
    await expect(extensionPage).toHaveURL(
      "https://www.youtube.com/shorts/scroll-allowed",
      { timeout: 6_000 }
    );
    await expect(youtube.card("shorts-action-bar").getByRole("button", {
      name: "Block Scroll Allowed Creator with ChannelFence"
    })).toBeVisible();
    const advanceState = await extensionPage.evaluate(() => {
      const current = (window as typeof window & {
        __cfDelayedScrollState?: {
          scrollCount: number;
          nativeClickCount: number;
          paths: string[];
        };
      }).__cfDelayedScrollState;
      if (!current) {
        throw new Error("Delayed scroll state was not installed");
      }
      return current;
    });
    expect(advanceState).toEqual({
      scrollCount: 1,
      nativeClickCount: 0,
      paths: ["/shorts/scroll-blocked", "/shorts/scroll-allowed"]
    });
    await expect(extensionPage.locator("#navigation-button-down button")).toBeEnabled();
    await expect(extensionPage.locator("html")).not.toHaveClass(/cf-watch-pending/);
    await expect(extensionPage.locator("#cf-hard-block-overlay")).toHaveCount(0);
  });

  test("waits for slow creator hydration without skipping an allowed Short", async ({
    extensionPage,
    extensionStorage
  }) => {
    const initialBlock = blockedCreator("@slowblocked", "Slow Blocked Creator");
    initialBlock.aliases.push("channel:UCaaaaaaaaaaaaaaaaaaaaaa");
    await extensionStorage.set({ cfBlockedChannels: [initialBlock] });
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(
      shortsViewer("Slow Blocked Creator", "@slowblocked"),
      "/shorts/slow-blocked"
    );
    await extensionPage.evaluate(() => {
      const meta = document.createElement("meta");
      meta.setAttribute("itemprop", "channelId");
      meta.setAttribute("content", "UCaaaaaaaaaaaaaaaaaaaaaa");
      document.head.append(meta);
    });
    await installShortsAdvanceQueue(extensionPage, [
      {
        path: "/shorts/slow-allowed",
        displayName: "Slow Allowed Creator",
        handle: "@slowallowed"
      },
      {
        path: "/shorts/slow-sentinel",
        displayName: "Slow Sentinel Creator",
        handle: "@slowsentinel"
      }
    ], { ownerDelayMs: 900 });

    await expect(extensionPage).toHaveURL(
      "https://www.youtube.com/shorts/slow-allowed",
      { timeout: 6_000 }
    );
    await extensionPage.evaluate(() => {
      const current = document.querySelector("ytd-shorts ytd-reel-video-renderer");
      const offscreen = current?.cloneNode(true) as HTMLElement | undefined;
      if (!current || !offscreen) {
        throw new Error("Shorts fixture renderer is missing");
      }
      offscreen.querySelectorAll("[data-testid]").forEach((element) => {
        element.removeAttribute("data-testid");
      });
      offscreen.style.cssText = "position:fixed;top:-2500px;height:480px;width:300px";
      const owner = offscreen.querySelector(
        "yt-reel-channel-bar-view-model a[href]"
      ) as HTMLAnchorElement | null;
      if (!owner) {
        throw new Error("Shorts fixture offscreen owner is missing");
      }
      owner.href = "/@offscreenmutation/shorts";
      owner.textContent = "Offscreen Mutation Creator";
      current.parentElement?.prepend(offscreen);
    });
    await extensionPage.waitForTimeout(1_200);
    await expect(extensionPage).toHaveURL("https://www.youtube.com/shorts/slow-allowed");
    await expect(youtube.card("shorts-action-bar").getByRole("button", {
      name: "Block Slow Allowed Creator with ChannelFence"
    })).toBeVisible();
    expect((await shortsAdvanceState(extensionPage)).clickCount).toBe(1);
    await expect(extensionPage.locator("#cf-hard-block-overlay")).toHaveCount(0);
  });

  test("clicks the native next control only once while its route transition is slow", async ({
    extensionPage,
    extensionStorage
  }) => {
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(
      shortsViewer("Slow Route Creator A", "@slowroutea"),
      "/shorts/slow-route-a"
    );
    await installShortsAdvanceQueue(extensionPage, [
      {
        path: "/shorts/slow-route-b",
        displayName: "Slow Route Creator B",
        handle: "@slowrouteb"
      },
      {
        path: "/shorts/slow-route-sentinel",
        displayName: "Slow Route Sentinel",
        handle: "@slowroutesentinel"
      }
    ], {
      navigationStartDelayMs: 3_500,
      routeDelayMs: 4_200
    });
    await extensionPage.evaluate(() => {
      const scroller = document.querySelector("ytd-shorts #shorts-container");
      if (!scroller) {
        throw new Error("Shorts fixture scroller is missing");
      }
      scroller.setAttribute("data-scroll-events", "0");
      scroller.addEventListener("scroll", () => {
        scroller.setAttribute(
          "data-scroll-events",
          String(Number(scroller.getAttribute("data-scroll-events") || "0") + 1)
        );
      });
    });

    const blockButton = youtube.card("shorts-action-bar").getByRole("button", {
      name: "Block Slow Route Creator A with ChannelFence"
    });
    await blockButton.click();
    await extensionPage.waitForTimeout(3_300);
    await expect(extensionPage).toHaveURL("https://www.youtube.com/shorts/slow-route-a");
    expect((await shortsAdvanceState(extensionPage)).clickCount).toBe(1);
    await expect(extensionPage.locator("ytd-shorts #shorts-container"))
      .toHaveAttribute("data-scroll-events", "0");

    await expect(extensionPage).toHaveURL(
      "https://www.youtube.com/shorts/slow-route-b",
      { timeout: 3_000 }
    );
    await expect(youtube.card("shorts-action-bar").getByRole("button", {
      name: "Block Slow Route Creator B with ChannelFence"
    })).toBeVisible();
    expect((await shortsAdvanceState(extensionPage)).clickCount).toBe(1);
    const stored = await extensionStorage.get<{
      cfBlockedChannels: Array<{ aliases: string[] }>;
    }>("cfBlockedChannels");
    expect(stored.cfBlockedChannels).toHaveLength(1);
    await expect(extensionPage.locator("#cf-hard-block-overlay")).toHaveCount(0);
  });

  test("does not hide ordinary Shorts navigation when the block list is empty", async ({
    extensionPage
  }) => {
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(
      shortsViewer("Pass Through Creator A", "@passthrougha"),
      "/shorts/pass-through-a"
    );
    await installShortsAdvanceQueue(extensionPage, [{
      path: "/shorts/pass-through-b",
      displayName: "Pass Through Creator B",
      handle: "@passthroughb"
    }]);
    await extensionPage.evaluate(() => {
      const html = document.documentElement;
      const record = { pendingSeen: html.classList.contains("cf-watch-pending") };
      (window as typeof window & { __cfPendingRecord?: typeof record })
        .__cfPendingRecord = record;
      new MutationObserver(() => {
        if (html.classList.contains("cf-watch-pending")) {
          record.pendingSeen = true;
        }
      }).observe(html, { attributes: true, attributeFilter: ["class"] });
    });

    await extensionPage.locator("#navigation-button-down button").click();
    await expect(extensionPage).toHaveURL("https://www.youtube.com/shorts/pass-through-b");
    await expect(youtube.card("shorts-action-bar").getByRole("button", {
      name: "Block Pass Through Creator B with ChannelFence"
    })).toBeVisible();
    const pendingSeen = await extensionPage.evaluate(() =>
      (window as typeof window & { __cfPendingRecord?: { pendingSeen: boolean } })
        .__cfPendingRecord?.pendingSeen
    );
    expect(pendingSeen).toBe(false);
    expect((await shortsAdvanceState(extensionPage)).clickCount).toBe(1);
  });

  test("settles immediately when consecutive Shorts have the same creator", async ({
    extensionPage,
    extensionStorage
  }) => {
    await extensionStorage.set({
      cfBlockedChannels: [blockedCreator("@unrelatedblocked", "Unrelated Blocked Creator")]
    });
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(
      shortsViewer("Same Creator", "@samecreator"),
      "/shorts/same-owner-a"
    );
    await installShortsAdvanceQueue(extensionPage, [{
      path: "/shorts/same-owner-b",
      displayName: "Same Creator",
      handle: "@samecreator"
    }], { ownerDelayMs: 200 });

    await extensionPage.locator("#navigation-button-down button").click();
    await expect(extensionPage).toHaveURL("https://www.youtube.com/shorts/same-owner-b");
    await expect(extensionPage.locator("html")).not.toHaveClass(
      /cf-watch-pending/,
      { timeout: 1_000 }
    );
    await expect(youtube.card("shorts-action-bar").getByRole("button", {
      name: "Block Same Creator with ChannelFence"
    })).toBeVisible();
    expect((await shortsAdvanceState(extensionPage)).clickCount).toBe(1);
  });

  test("accepts a prehydrated next renderer from the same creator", async ({
    extensionPage,
    extensionStorage
  }) => {
    await extensionStorage.set({
      cfBlockedChannels: [blockedCreator("@unrelatedblocked", "Unrelated Blocked Creator")]
    });
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(
      shortsViewer("Preloaded Creator", "@preloadedcreator"),
      "/shorts/preloaded-a"
    );
    await extensionPage.evaluate(() => {
      const shorts = document.querySelector("ytd-shorts");
      const current = document.querySelector("ytd-shorts ytd-reel-video-renderer");
      if (!shorts || !current || !current.parentElement) {
        throw new Error("Shorts fixture renderer is missing");
      }
      const addPermalink = (renderer: Element, path: string) => {
        const link = document.createElement("a");
        link.dataset.cfFixtureShortPermalink = "true";
        link.href = path;
        link.hidden = true;
        renderer.append(link);
      };
      addPermalink(current, "/shorts/preloaded-a");
      const next = current.cloneNode(true) as HTMLElement;
      next.querySelectorAll(".cf-block-button, .cf-shorts-action").forEach((node) => {
        node.remove();
      });
      const nextPermalink = next.querySelector(
        "[data-cf-fixture-short-permalink]"
      ) as HTMLAnchorElement | null;
      if (!nextPermalink) {
        throw new Error("Shorts fixture permalink is missing");
      }
      nextPermalink.href = "/shorts/preloaded-b";
      current.parentElement.append(next);

      const navigation = document.createElement("div");
      navigation.id = "navigation-button-down";
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-label", "Next video");
      navigation.append(button);
      shorts.append(navigation);
      button.addEventListener("click", () => {
        document.dispatchEvent(new Event("yt-navigate-start", { bubbles: true }));
        current.removeAttribute("is-active");
        next.setAttribute("is-active", "");
        next.scrollIntoView({ behavior: "auto", block: "center" });
        history.pushState({}, "", "/shorts/preloaded-b");
        document.dispatchEvent(new Event("yt-page-data-updated", { bubbles: true }));
        document.dispatchEvent(new Event("yt-navigate-finish", { bubbles: true }));
      });
    });

    await extensionPage.locator("#navigation-button-down button").click();
    await expect(extensionPage).toHaveURL("https://www.youtube.com/shorts/preloaded-b");
    await expect(extensionPage.locator("html")).not.toHaveClass(
      /cf-watch-pending/,
      { timeout: 1_000 }
    );
    await expect(extensionPage.locator(
      "ytd-reel-video-renderer[is-active] .cf-shorts-action__button"
    )).toHaveAttribute(
      "aria-label",
      "Block Preloaded Creator with ChannelFence"
    );
  });

  test("fails open when a new Shorts renderer never hydrates its creator", async ({
    extensionPage,
    extensionStorage
  }) => {
    const unrelatedBlock = blockedCreator(
      "@unrelatedblocked",
      "Unrelated Blocked Creator"
    );
    unrelatedBlock.aliases.push("channel:UCunresolvedstale0001");
    await extensionStorage.set({ cfBlockedChannels: [unrelatedBlock] });
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(
      shortsViewer("Initial Creator", "@initialcreator"),
      "/shorts/unhydrated-a"
    );
    await extensionPage.evaluate(() => {
      const metadata = document.createElement("meta");
      metadata.setAttribute("itemprop", "channelId");
      metadata.content = "UCunresolvedstale0001";
      document.head.append(metadata);
    });
    await installShortsAdvanceQueue(extensionPage, [{
      path: "/shorts/unhydrated-b?si=fixture",
      displayName: "Never Hydrated Creator",
      handle: "@neverhydrated"
    }], {
      ownerNeverHydrates: true
    });

    await extensionPage.locator("#navigation-button-down button").click();
    await expect(extensionPage).toHaveURL(
      "https://www.youtube.com/shorts/unhydrated-b?si=fixture"
    );
    await expect(extensionPage.locator("html")).not.toHaveClass(
      /cf-watch-pending/,
      { timeout: 6_000 }
    );
    await extensionPage.evaluate(() => {
      history.replaceState({}, "", "/shorts/unhydrated-b");
      document.dispatchEvent(new Event("yt-page-data-updated", { bubbles: true }));
    });
    await extensionPage.waitForTimeout(750);
    await expect(extensionPage).toHaveURL("https://www.youtube.com/shorts/unhydrated-b");
    await expect(extensionPage.locator("html")).not.toHaveClass(/cf-watch-pending/);
    expect((await shortsAdvanceState(extensionPage)).clickCount).toBe(1);
    await expect(extensionPage.locator("#cf-hard-block-overlay")).toHaveCount(0);
  });

  test("does not reuse a stale blocked owner after the identity deadline", async ({
    extensionPage,
    extensionStorage
  }) => {
    await extensionStorage.set({
      cfBlockedChannels: [blockedCreator("@deadlineblocked", "Deadline Blocked Creator")]
    });
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(
      shortsViewer("Deadline Blocked Creator", "@deadlineblocked"),
      "/shorts/deadline-blocked"
    );
    await installShortsAdvanceQueue(extensionPage, [
      {
        path: "/shorts/deadline-allowed",
        displayName: "Deadline Allowed Creator",
        handle: "@deadlineallowed"
      },
      {
        path: "/shorts/deadline-sentinel",
        displayName: "Deadline Sentinel Creator",
        handle: "@deadlinesentinel"
      }
    ], {
      ownerDelayMs: 5_500
    });

    await expect(extensionPage).toHaveURL(
      "https://www.youtube.com/shorts/deadline-allowed",
      { timeout: 6_000 }
    );
    await expect(extensionPage.locator("html")).toHaveClass(/cf-watch-pending/);
    await extensionPage.evaluate(() => {
      const channelBar = document.querySelector(
        "ytd-shorts yt-reel-channel-bar-view-model"
      );
      if (!channelBar) {
        throw new Error("Shorts fixture channel bar is missing");
      }
      const subscriptionState = document.createElement("button");
      subscriptionState.dataset.cfFixtureSubscriptionState = "true";
      subscriptionState.setAttribute("aria-label", "Subscribed");
      subscriptionState.textContent = "Subscribed";
      channelBar.append(subscriptionState);
    });
    await extensionPage.waitForTimeout(4_900);
    await expect(extensionPage).toHaveURL("https://www.youtube.com/shorts/deadline-allowed");
    await expect(extensionPage.locator("html")).not.toHaveClass(/cf-watch-pending/);
    await extensionPage.waitForTimeout(900);
    await expect(youtube.card("shorts-action-bar").getByRole("button", {
      name: "Block Deadline Allowed Creator with ChannelFence"
    })).toBeVisible();
    expect((await shortsAdvanceState(extensionPage)).clickCount).toBe(1);
  });

  test("ignores an offscreen stale active Shorts renderer", async ({
    extensionPage,
    extensionStorage
  }) => {
    await extensionStorage.set({
      cfBlockedChannels: [blockedCreator("@staleactive", "Stale Active Creator")]
    });
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(
      shortsViewer("Visible Creator", "@visiblecreator"),
      "/shorts/visible-current"
    );
    await extensionPage.evaluate(() => {
      const current = document.querySelector("ytd-shorts ytd-reel-video-renderer");
      const currentPermalink = document.createElement("a");
      currentPermalink.dataset.cfFixtureShortPermalink = "true";
      currentPermalink.href = "/shorts/stale-visible-route";
      currentPermalink.hidden = true;
      current?.append(currentPermalink);
      const stale = current?.cloneNode(true) as HTMLElement | undefined;
      if (!current || !stale) {
        throw new Error("Shorts fixture renderer is missing");
      }
      current.setAttribute("data-current-renderer", "true");
      stale.removeAttribute("data-current-renderer");
      stale.setAttribute("is-active", "");
      stale.style.cssText = "position:fixed;top:-2000px;height:480px;width:300px";
      const staleOwner = stale.querySelector(
        "yt-reel-channel-bar-view-model a[href]"
      ) as HTMLAnchorElement | null;
      if (!staleOwner) {
        throw new Error("Shorts fixture owner is missing");
      }
      staleOwner.href = "/@staleactive/shorts";
      staleOwner.textContent = "Stale Active Creator";
      const stalePermalink = stale.querySelector(
        "[data-cf-fixture-short-permalink]"
      ) as HTMLAnchorElement | null;
      if (!stalePermalink) {
        throw new Error("Shorts fixture permalink is missing");
      }
      stalePermalink.href = location.pathname;
      current.parentElement?.prepend(stale);
      document.dispatchEvent(new Event("yt-page-data-updated", { bubbles: true }));
    });

    const currentAction = extensionPage.locator(
      "ytd-reel-video-renderer[data-current-renderer] .cf-shorts-action__button"
    );
    await expect(currentAction).toHaveAttribute(
      "aria-label",
      "Block Visible Creator with ChannelFence"
    );
    await expect(extensionPage.locator("html")).not.toHaveClass(/cf-watch-pending/);
    await extensionPage.waitForTimeout(1_000);
    await expect(extensionPage).toHaveURL("https://www.youtube.com/shorts/visible-current");
    await expect(extensionPage.locator("#cf-hard-block-overlay")).toHaveCount(0);
  });

  test("skips a blocked creator encountered while scrolling without double-advancing", async ({
    extensionPage,
    extensionStorage
  }) => {
    await extensionStorage.set({
      cfBlockedChannels: [blockedCreator("@blockedmiddle", "Blocked Middle Creator")]
    });
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(
      shortsViewer("Allowed First Creator", "@allowedfirst"),
      "/shorts/allowed-first"
    );
    await installShortsAdvanceQueue(extensionPage, [
      {
        path: "/shorts/blocked-middle",
        displayName: "Blocked Middle Creator",
        handle: "@blockedmiddle"
      },
      {
        path: "/shorts/allowed-last",
        displayName: "Allowed Last Creator",
        handle: "@allowedlast"
      }
    ]);

    await extensionPage.locator("#navigation-button-down button").click();
    await expect(extensionPage).toHaveURL(
      "https://www.youtube.com/shorts/allowed-last",
      { timeout: 6_000 }
    );
    await expect(youtube.card("shorts-action-bar").getByRole("button", {
      name: "Block Allowed Last Creator with ChannelFence"
    })).toBeVisible();
    const advance = await shortsAdvanceState(extensionPage);
    expect(advance.clickCount).toBe(2);
    expect(advance.paths).toEqual([
      "/shorts/allowed-first",
      "/shorts/blocked-middle",
      "/shorts/allowed-last"
    ]);
    await extensionPage.waitForTimeout(2_800);
    await expect(extensionPage).toHaveURL("https://www.youtube.com/shorts/allowed-last");
    await expect(extensionPage.locator("#cf-hard-block-overlay")).toHaveCount(0);
  });

  test("blocks several Shorts creators sequentially without duplicates or Home fallbacks", async ({
    extensionPage,
    extensionStorage
  }) => {
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(
      shortsViewer("Sequence Creator A", "@sequencea"),
      "/shorts/sequence-a"
    );
    await installShortsAdvanceQueue(extensionPage, [
      {
        path: "/shorts/sequence-b",
        displayName: "Sequence Creator B",
        handle: "@sequenceb"
      },
      {
        path: "/shorts/sequence-c",
        displayName: "Sequence Creator C",
        handle: "@sequencec"
      },
      {
        path: "/shorts/sequence-d",
        displayName: "Sequence Creator D",
        handle: "@sequenced"
      }
    ]);

    const currentBlockButton = () => youtube.card("shorts-action-bar").getByRole(
      "button",
      { name: /Block Sequence Creator [A-D] with ChannelFence/ }
    );
    const expected = [
      ["Sequence Creator A", "/shorts/sequence-b", "Sequence Creator B"],
      ["Sequence Creator B", "/shorts/sequence-c", "Sequence Creator C"],
      ["Sequence Creator C", "/shorts/sequence-d", "Sequence Creator D"]
    ];

    for (let index = 0; index < expected.length; index += 1) {
      const [currentName, nextPath, nextName] = expected[index];
      await expect(currentBlockButton()).toHaveAttribute(
        "aria-label",
        `Block ${currentName} with ChannelFence`
      );
      await currentBlockButton().click();
      await expect(extensionPage).toHaveURL(`https://www.youtube.com${nextPath}`);
      await expect(currentBlockButton()).toHaveAttribute(
        "aria-label",
        `Block ${nextName} with ChannelFence`
      );
      await expect.poll(async () => {
        const stored = await extensionStorage.get<{
          cfBlockedChannels: Array<{ aliases: string[] }>;
        }>("cfBlockedChannels");
        return stored.cfBlockedChannels.length;
      }).toBe(index + 1);
      await expect(extensionPage.locator("#cf-hard-block-overlay")).toHaveCount(0);
    }

    const stored = await extensionStorage.get<{
      cfBlockedChannels: Array<{ aliases: string[] }>;
    }>("cfBlockedChannels");
    expect(stored.cfBlockedChannels.flatMap((entry) => entry.aliases).sort()).toEqual([
      "handle:@sequencea",
      "handle:@sequenceb",
      "handle:@sequencec"
    ]);
    expect((await shortsAdvanceState(extensionPage)).clickCount).toBe(3);
    await extensionPage.waitForTimeout(2_800);
    await expect(extensionPage).toHaveURL("https://www.youtube.com/shorts/sequence-d");
  });

  test("skips 50 previously blocked Shorts creators without freezing or falling Home", async ({
    extensionPage,
    extensionStorage
  }) => {
    const blockedCount = 50;
    const blockedCreators = Array.from({ length: blockedCount }, (_, index) => {
      const number = String(index + 1).padStart(2, "0");
      return blockedCreator(`@stressblocked${number}`, `Stress Blocked Creator ${number}`);
    });
    await extensionStorage.set({ cfBlockedChannels: blockedCreators });

    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(
      shortsViewer("Stress Bootstrap Creator", "@stressbootstrap"),
      "/shorts/stress-bootstrap"
    );
    const blockedQueue = blockedCreators.map((_, index) => {
      const number = String(index + 1).padStart(2, "0");
      return {
        path: `/shorts/stress-blocked-${number}`,
        displayName: `Stress Blocked Creator ${number}`,
        handle: `@stressblocked${number}`
      };
    });
    await installShortsAdvanceQueue(extensionPage, [
      ...blockedQueue,
      {
        path: "/shorts/stress-allowed-final",
        displayName: "Stress Allowed Final Creator",
        handle: "@stressallowedfinal"
      }
    ], { ownerDelayMs: 10 });

    const startedAt = Date.now();
    await extensionPage.locator("#navigation-button-down button").click();
    await expect(extensionPage).toHaveURL(
      "https://www.youtube.com/shorts/stress-allowed-final",
      { timeout: 15_000 }
    );
    const elapsedMs = Date.now() - startedAt;

    const advance = await shortsAdvanceState(extensionPage);
    expect(advance.clickCount).toBe(blockedCount + 1);
    expect(advance.paths).toEqual([
      "/shorts/stress-bootstrap",
      ...blockedQueue.map((item) => item.path),
      "/shorts/stress-allowed-final"
    ]);
    expect(advance.paths).not.toContain("/");
    expect(elapsedMs).toBeLessThan(10_000);
    await expect(extensionPage.locator("#cf-hard-block-overlay")).toHaveCount(0);
    await expect(extensionPage.locator("html")).not.toHaveClass(/cf-watch-pending/);
    await expect(youtube.card("shorts-action-bar").getByRole("button", {
      name: "Block Stress Allowed Final Creator with ChannelFence"
    })).toBeVisible();

    const stored = await extensionStorage.get<{
      cfBlockedChannels: Array<{ aliases: string[] }>;
    }>("cfBlockedChannels");
    expect(stored.cfBlockedChannels).toHaveLength(blockedCount);
    expect(new Set(stored.cfBlockedChannels.flatMap((entry) => entry.aliases)).size)
      .toBe(blockedCount);

    // Hold beyond the 10-second blocked-Short retry window so a stale timer
    // cannot late-advance, reveal the blocked route, or eject the user Home.
    await extensionPage.waitForTimeout(10_500);
    await expect(extensionPage).toHaveURL(
      "https://www.youtube.com/shorts/stress-allowed-final"
    );
    await expect(extensionPage.locator("#cf-hard-block-overlay")).toHaveCount(0);
    await expect(extensionPage.locator("html")).not.toHaveClass(/cf-watch-pending/);
    await expect(youtube.card("shorts-action-bar").getByRole("button", {
      name: "Block Stress Allowed Final Creator with ChannelFence"
    })).toBeVisible();
  });

  test("adds a ChannelFence action to the current Shorts menu", async ({
    extensionPage,
    extensionStorage
  }) => {
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(
      shortsViewer("Shorts Menu Creator", "@shortsmenucreator"),
      "/shorts/fixture-menu"
    );

    const menuItem = await youtube.openCreatorMenu("shorts-menu");
    await expect(menuItem).toContainText("ChannelFence: Block");
    await routeToNextShortOnAdvance(extensionPage, "/shorts/fixture-menu-next");
    await menuItem.click();

    const stored = await extensionStorage.get<{
      cfBlockedChannels: Array<{ aliases: string[] }>;
    }>("cfBlockedChannels");
    expect(stored.cfBlockedChannels[0].aliases).toEqual(["handle:@shortsmenucreator"]);
    await expect(extensionPage).toHaveURL("https://www.youtube.com/shorts/fixture-menu-next");
    await expect(extensionPage.locator("#cf-hard-block-overlay")).toHaveCount(0);
  });
});
