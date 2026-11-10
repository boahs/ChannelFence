import { setTimeout as delay } from "node:timers/promises";
import type { Page, HTTPRequest } from "puppeteer-core";
import { expect, test, expectVisible, expectText, expectCount, expectAttribute, expectCSS, openFixture, openCreatorMenu } from "../extension.fixture";
import { blockedCreator } from "../../e2e/fixtures/extension.fixture";
import { channelHeader, shortsShelf, shortsViewer } from "../../e2e/fixtures/youtube-fixtures";
import { installConsumedShortsScroll } from "../../e2e/fixtures/shorts-scroll-reset";

const byTestId = (id: string): string => `[data-testid="${id}"]`;

function compactShortMetadata() {
  const requestedShorts: string[] = [];
  const refreshRequests: string[] = [];
  const metadata = { requestedShorts, refreshRequests, refreshing: false, handle };
  async function handle(request: HTTPRequest): Promise<void> {
    const url = new URL(request.url());
    if (url.protocol === "moz-extension:" || url.protocol === "data:") {
      await request.continue();
      return;
    }
    if (url.origin !== "https://www.youtube.com" || url.pathname !== "/oembed") {
      await request.abort();
      return;
    }
    const shortUrl = url.searchParams.get("url") || "";
    if (metadata.refreshing) {
      refreshRequests.push(shortUrl);
      await request.abort();
      return;
    }
    requestedShorts.push(shortUrl);
    const path = new URL(shortUrl).pathname;
    const blockedCreator = path === "/shorts/compact-one";
    await request.respond({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        author_name: blockedCreator ? "Compact Shorts Creator" : "Allowed Shorts Creator",
        author_url: blockedCreator
          ? "https://www.youtube.com/@compactshortscreator"
          : "https://www.youtube.com/@allowedshortscreator"
      })
    });
  }
  return metadata;
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

// Deliberate observation windows below match the Chromium regressions: they
// prove stale navigation timers never advance again after an allowed Short.
test.describe("YouTube Shorts controls", () => {
  test("hides Shorts in feeds while keeping regular videos and Shorts navigation available", async ({ addon }) => {
    const page = addon.page;
    await openFixture(page, shortsShelf(), "/");

    await expectVisible(page, byTestId("shorts-section"));
    await expectVisible(page, byTestId("standalone-short"));
    await expectVisible(page, byTestId("modern-shorts-shelf"));
    await expectVisible(page, byTestId("shorts-guide"));
    await expectVisible(page, byTestId("regular-video"));

    await addon.setStorage({ cfHideHomeShorts: true });
    await expectVisible(page, byTestId("shorts-section"), false);
    await expectVisible(page, byTestId("standalone-short"), false);
    await expectVisible(page, byTestId("modern-shorts-shelf"), false);
    await expectVisible(page, byTestId("shorts-guide"));
    await expectVisible(page, byTestId("shorts-mini-guide"));
    await expectVisible(page, byTestId("regular-video"));

    await addon.setStorage({ cfEnabled: false });
    await expectVisible(page, byTestId("shorts-section"));
    await expectVisible(page, byTestId("standalone-short"));
    await expectVisible(page, byTestId("modern-shorts-shelf"));

    await addon.setStorage({ cfEnabled: true });
    await expectVisible(page, byTestId("shorts-section"), false);

    await addon.setStorage({ cfHideHomeShorts: false });
    await expectVisible(page, byTestId("shorts-section"));
    await expectVisible(page, byTestId("standalone-short"));
    await expectVisible(page, byTestId("modern-shorts-shelf"));
    await expectVisible(page, byTestId("shorts-guide"));
  });

  test("keeps channel Shorts tabs available for supported channel URL formats", async ({ addon }) => {
    const page = addon.page;
    await addon.setStorage({ cfHideHomeShorts: true });
    for (const path of [
      "/@shortscreator/shorts",
      "/@shortscreator/shorts/?view=latest",
      "/channel/UCshortscreator0001/shorts",
      "/c/ShortsCreator/shorts",
      "/user/ShortsCreator/shorts"
    ]) {
      await openFixture(page, shortsShelf(), path);
      await expectVisible(page, byTestId("regular-video") + " .cf-block-button");
      for (const card of ["shorts-section", "standalone-short", "modern-shorts-shelf", "compact-short"]) {
        await expectVisible(page, byTestId(card));
      }
      await expectCount(page, "#cf-hard-block-overlay", 0);
    }
  });

  test("restores channel Shorts during navigation while continuing to hide feed shelves", async ({ addon }) => {
    const page = addon.page;
    await addon.setStorage({ cfHideHomeShorts: true });
    await openFixture(page, shortsShelf(), "/");
    await expectVisible(page, byTestId("standalone-short"), false);

    // Reuse the same elements, as YouTube does when switching channel tabs.
    // A channel called @shorts must still have its Home shelf hidden.
    for (const [path, visible] of [
      ["/@shorts/shorts", true],
      ["/@shorts", false],
      ["/@shorts/shorts/?view=latest", true]
    ] as const) {
      await page.evaluate((nextPath) => {
        document.dispatchEvent(new Event("yt-navigate-start", { bubbles: true }));
        history.pushState({}, "", nextPath);
        document.dispatchEvent(new Event("yt-navigate-finish", { bubbles: true }));
      }, path);
      for (const card of ["shorts-section", "standalone-short", "modern-shorts-shelf", "compact-short"]) {
        await expectVisible(page, byTestId(card), visible);
      }
      await expectVisible(page, byTestId("regular-video"));
      if (!visible) {
        await addon.setStorage({ cfHideHomeShorts: false });
        await expectVisible(page, byTestId("standalone-short"));
        await addon.setStorage({ cfHideHomeShorts: true });
        await expectVisible(page, byTestId("standalone-short"), false);
      }
    }
  });

  test("still blocks a blocked creator's channel Shorts tab while feed hiding is enabled", async ({ addon }) => {
    const page = addon.page;
    await addon.setStorage({
      cfHideHomeShorts: true,
      cfBlockedChannels: [blockedCreator("@shortscreator", "Shorts Creator")]
    });
    await openFixture(page,
      channelHeader("Shorts Creator", "@shortscreator") + shortsShelf(),
      "/@shortscreator/shorts"
    );
    await expectVisible(page, "#cf-hard-block-overlay");
    await expectText(page, "#cf-hard-block-overlay p", "shortscreator is on your ChannelFence block list.");
    await page.locator("#cf-hard-block-overlay .cf-hard-block-actions button:last-child").click();
    await expectCount(page, "#cf-hard-block-overlay", 0);
    await expectVisible(page, byTestId("standalone-short"));
    await expectVisible(page, byTestId("compact-short"));
    expect((await addon.getStorage("cfBlockedChannels")).cfBlockedChannels).toEqual([]);
  });

  test("keeps direct Shorts pages available when feed Shorts are hidden", async ({ addon }) => {
    const page = addon.page;
    await addon.setStorage({ cfHideHomeShorts: true });
    await openFixture(page, shortsViewer("Shorts Creator", "@shortscreator"), "/shorts/fixture-short");

    await expectCount(page, "#cf-hard-block-overlay", 0);
    const viewer = byTestId("shorts-viewer");
    const actionBar = byTestId("shorts-action-bar");
    const action = actionBar + " > .cf-shorts-action";
    const blockButton = action + ` button[aria-label="Block Shorts Creator with ChannelFence"]`;
    await expectVisible(page, blockButton);
    await expectCount(page, byTestId("shorts-channel-bar") + " .cf-block-button", 0);
    await expectCSS(page, action, "height", "78px");
    await expectCSS(page, action, "width", "48px");
    await expectCSS(page, blockButton, "height", "48px");
    await expectCSS(page, blockButton, "width", "48px");
    await expectText(page, action + " .cf-shorts-action__label", "Block");
    await expectAttribute(page, action + " .cf-shorts-action__icon", "src", `${addon.origin}/assets/icons/channelfence-48.png`);
    expect(await page.$eval(actionBar + " > :first-child", (element, name) => element.getAttribute(name), "class"))
      .toContain("cf-shorts-action");
    await expectCount(page, viewer + " .cf-shorts-action", 1);

    const stored = await addon.getStorage<{ cfHideHomeShorts: boolean }>("cfHideHomeShorts");
    expect(stored.cfHideHomeShorts).toBe(true);
  });

  test("keeps the Shorts action readable across themes without legacy YouTube variables", async ({ addon }) => {
    const page = addon.page;
    await openFixture(page, shortsViewer("Shorts Creator", "@shortscreator"), "/shorts/fixture-short");
    const action = byTestId("shorts-action-bar") + " > .cf-shorts-action";
    const caption = action + " .cf-shorts-action__label";
    const button = action + ` button[aria-label="Block Shorts Creator with ChannelFence"]`;
    await expectVisible(page, button);
    expect(await page.$eval(action, (element) => {
      const style = getComputedStyle(element);
      return ["--yt-spec-text-primary", "--yt-spec-badge-chip-background", "--yt-spec-10-percent-layer"]
        .map((property) => style.getPropertyValue(property).trim());
    })).toEqual(["", "", ""]);

    for (const theme of [
      { dark: false, text: "rgb(15, 15, 15)", background: "rgba(0, 0, 0, 0.05)", hover: "rgba(0, 0, 0, 0.1)" },
      { dark: true, text: "rgb(241, 241, 241)", background: "rgba(255, 255, 255, 0.1)", hover: "rgba(255, 255, 255, 0.2)" }
    ]) {
      await page.evaluate((dark) => document.documentElement.toggleAttribute("dark", dark), theme.dark);
      await page.mouse.move(0, 0);
      await expectCSS(page, caption, "color", theme.text);
      await expectCSS(page, button, "background-color", theme.background);
      await page.locator(button).hover();
      await expectCSS(page, button, "background-color", theme.hover);
    }

    // Native variables take precedence when YouTube supplies them.
    await page.evaluate(() => {
      const style = document.documentElement.style;
      style.setProperty("--yt-spec-text-primary", "#dedede");
      style.setProperty("--yt-spec-badge-chip-background", "#333333");
      style.setProperty("--yt-spec-10-percent-layer", "#444444");
    });
    await page.mouse.move(0, 0);
    await expectCSS(page, caption, "color", "rgb(222, 222, 222)");
    await expectCSS(page, button, "background-color", "rgb(51, 51, 51)");
    await page.locator(button).hover();
    await expectCSS(page, button, "background-color", "rgb(68, 68, 68)");
  });

  test("hides Shorts shelves and modern cards in search results", async ({ addon }) => {
    const page = addon.page;
    await addon.setStorage({ cfHideHomeShorts: true });
    await openFixture(page, shortsShelf(), "/results?search_query=shorts");

    await expectVisible(page, byTestId("shorts-section"), false);
    await expectVisible(page, byTestId("standalone-short"), false);
    await expectVisible(page, byTestId("modern-shorts-shelf"), false);
    await expectVisible(page, byTestId("shorts-guide"));
    await expectVisible(page, byTestId("regular-video"));
  });

  test("blocks a compact Shorts creator without leaving the feed", async ({ addon }) => {
    const page = addon.page;
    const metadata = compactShortMetadata();
    const { requestedShorts, refreshRequests } = metadata;
    await openFixture(page, shortsShelf(), "/results?search_query=shorts", "en", metadata.handle);

    const card = byTestId("compact-short");
    const button = card + ` button[aria-label="Block this Short's creator with ChannelFence"]`;
    await expectVisible(page, button);
    await expectCount(page, button, 1);
    const feedUrl = page.url();
    await page.locator(button).click();
    await expect.poll(() => page.url()).toBe(feedUrl);
    await expect.poll(async () => {
      const stored = await addon.getStorage<{
        cfBlockedChannels: Array<{ aliases: string[]; shortPaths: string[] }>;
      }>("cfBlockedChannels");
      return stored.cfBlockedChannels[0];
    }).toMatchObject({
      aliases: ["handle:@compactshortscreator"],
      shortPaths: ["/shorts/compact-one"]
    });
    await expect.poll(() => requestedShorts.length).toBe(3);
    expect(requestedShorts).toContain("https://www.youtube.com/shorts/compact-one");
    await expectVisible(page, card, false);
    await expectVisible(page, byTestId("compact-short-two"));
    await expectVisible(page, byTestId("compact-short-three"));
    await expectCount(page, byTestId("compact-row-one") + " > .ytGridShelfViewModelGridShelfItem:not(.cf-hidden-by-channelfence)", 2);
    await expectCount(page, "#cf-hard-block-overlay", 0);

    metadata.refreshing = true;
    await page.reload({ waitUntil: "domcontentloaded" });
    await expectVisible(page, byTestId("compact-short"), false);
    await expect.poll(() => page.url()).toBe(feedUrl);
    await expect.poll(() => refreshRequests.length).toBe(2);
    expect(refreshRequests).not.toContain("https://www.youtube.com/shorts/compact-one");
  });

  test("keeps compact Shorts visible while creator metadata is still loading", async ({ addon }) => {
    const page = addon.page;
    let releaseLookup!: () => void;
    const lookupGate = new Promise<void>((resolve) => {
      releaseLookup = resolve;
    });
    let lookupCount = 0;
    await openFixture(page, shortsShelf(), "/results?search_query=shorts", "en", async (request) => {
      const url = new URL(request.url());
      if (url.protocol === "moz-extension:" || url.protocol === "data:") {
        await request.continue();
        return;
      }
      if (url.origin !== "https://www.youtube.com" || url.pathname !== "/oembed") {
        await request.abort();
        return;
      }
      lookupCount += 1;
      await lookupGate;
      await request.respond({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          author_name: "Allowed Shorts Creator",
          author_url: "https://www.youtube.com/@allowedshortscreator"
        })
      });
    });
    const pendingCard = byTestId("compact-slot-one");
    try {
      await addon.setStorage({
        cfBlockedChannels: [blockedCreator("@unrelated", "Unrelated Creator")]
      });
      await expect.poll(() => lookupCount).toBeGreaterThan(0);
      await expectVisible(page, pendingCard);
      await expectVisible(page, byTestId("compact-short-two"));
    } finally {
      releaseLookup();
    }
    await expect.poll(() => page.$eval(pendingCard, (element, name) => element.getAttribute(name), "class"))
      .not.toContain("cf-compact-short-pending");
  });

  test("adds a safe block action to compact Shorts menus", async ({ addon }) => {
    const page = addon.page;
    const metadata = compactShortMetadata();
    await openFixture(page, shortsShelf(), "/results?search_query=shorts", "en", metadata.handle);

    await openCreatorMenu(page, byTestId("compact-short-menu"));
    const menuItem = ".cf-menu-item";
    await expectCount(page, ".cf-menu-item", 1);
    await expectText(page, menuItem + " .cf-menu-item__label", "ChannelFence: Block creator");
    const feedUrl = page.url();
    await page.locator(menuItem).click();
    await expect.poll(() => page.url()).toBe(feedUrl);
    await expect.poll(async () => {
      const stored = await addon.getStorage<{
        cfBlockedChannels: Array<{ displayName: string; shortPaths: string[] }>;
      }>("cfBlockedChannels");
      return stored.cfBlockedChannels[0];
    }).toMatchObject({
      displayName: "compactshortscreator",
      shortPaths: ["/shorts/compact-one"]
    });
    await expectVisible(page, byTestId("compact-short"), false);
  });

  test("blocks the visible creator from the current Shorts viewer", async ({ addon }) => {
    const page = addon.page;
    await openFixture(page,
      shortsViewer("Shorts Creator", "@shortscreator"),
      "/shorts/fixture-short"
    );

    const blockButton = byTestId("shorts-action-bar") + ` button[aria-label="Block Shorts Creator with ChannelFence"]`;
    await expectVisible(page, blockButton);
    const video = byTestId("shorts-video");
    await page.$eval(video, (element) => {
      const media = element as HTMLVideoElement;
      media.dataset.pauseCalls = "0";
      media.pause = () => {
        media.dataset.pauseCalls = String(Number(media.dataset.pauseCalls || 0) + 1);
      };
    });
    await routeToNextShortOnAdvance(page, "/shorts/fixture-next");
    await page.locator(blockButton).click();

    const stored = await addon.getStorage<{
      cfBlockedChannels: Array<{ aliases: string[]; displayName: string }>;
    }>("cfBlockedChannels");
    expect(stored.cfBlockedChannels).toEqual([
      expect.objectContaining({
        aliases: ["handle:@shortscreator"],
        displayName: "shortscreator"
      })
    ]);
    await expect.poll(() => page.url()).toBe("https://www.youtube.com/shorts/fixture-next");
    await expectAttribute(page, video, "data-pause-calls", "0");
    await expectVisible(page, byTestId("shorts-action-bar"));
    await expectVisible(page, byTestId("shorts-like"));
    await expectCount(page, "#cf-hard-block-overlay", 0);
  });

  test("waits for late Shorts controls instead of prematurely returning Home", async ({ addon }) => {
    const page = addon.page;
    await addon.setStorage({
      cfBlockedChannels: [blockedCreator("@shortscreator", "Shorts Creator")]
    });
    await openFixture(page,
      shortsViewer("Shorts Creator", "@shortscreator"),
      "/shorts/"
    );
    await page.evaluate(() => {
      const scroller = document.querySelector("ytd-shorts #shorts-container");
      if (!scroller) {
        throw new Error("Shorts fixture scroller is missing");
      }
      scroller.id = "shorts-container-unavailable";
    });

    // With no usable scroll container, ChannelFence must keep waiting for
    // YouTube to hydrate its native control instead of returning Home.
    await delay(3_500);
    await expect.poll(() => page.url()).toBe("https://www.youtube.com/shorts/");
    await installShortsAdvanceQueue(page, [{
      path: "/shorts/late-allowed",
      displayName: "Late Allowed Creator",
      handle: "@lateallowed"
    }]);

    await expect.poll(() => page.url(), { timeout: 6_000 }).toBe("https://www.youtube.com/shorts/late-allowed");
    await expectVisible(page, byTestId("shorts-action-bar") + ` button[aria-label="Block Late Allowed Creator with ChannelFence"]`);
    expect((await shortsAdvanceState(page)).clickCount).toBe(1);
    await expectCount(page, "#cf-hard-block-overlay", 0);
  });

  test("fails open on the current Short when YouTube provides no next route", async ({ addon }) => {
    const page = addon.page;
    await addon.setStorage({
      cfBlockedChannels: [blockedCreator("@strandedblocked", "Stranded Blocked Creator")]
    });
    const strandedUrl = "https://www.youtube.com/shorts/stranded-blocked?si=fixture";
    await openFixture(page,
      shortsViewer("Stranded Blocked Creator", "@strandedblocked"),
      "/shorts/stranded-blocked?si=fixture"
    );

    await expect.poll(() => page.$eval("html", element => element.className)).toMatch(/cf-watch-pending/);
    await delay(10_500);
    await expect.poll(() => page.url()).toBe(strandedUrl);
    await expect.poll(() => page.$eval("html", element => element.className)).not.toMatch(/cf-watch-pending/);
    await expectCount(page, "#cf-hard-block-overlay", 0);

    // Later YouTube route/owner notifications must not restart the same failed
    // skip and hide the Short for another ten seconds. This includes YouTube
    // removing a share/tracking parameter from the same canonical Short.
    await page.evaluate(() => {
      history.replaceState({}, "", "/shorts/stranded-blocked");
      document.dispatchEvent(new Event("yt-page-data-updated", { bubbles: true }));
    });
    await delay(750);
    await expect.poll(() => page.url()).toBe("https://www.youtube.com/shorts/stranded-blocked");
    await expect.poll(() => page.$eval("html", element => element.className)).not.toMatch(/cf-watch-pending/);
    await expectCount(page, "#cf-hard-block-overlay", 0);
  });

  test("does not double-advance when scroll navigation commits after controls appear", async ({ addon }) => {
    const page = addon.page;
    await addon.setStorage({
      cfBlockedChannels: [blockedCreator("@scrollblocked", "Scroll Blocked Creator")]
    });
    await page.evaluateOnNewDocument(() => {
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
    await openFixture(page,
      shortsViewer("Scroll Blocked Creator", "@scrollblocked"),
      "/shorts/scroll-blocked"
    );

    await expect.poll(() => page.evaluate(() => (
      window as typeof window & {
        __cfDelayedScrollState?: { scrollCount: number };
      }
    ).__cfDelayedScrollState?.scrollCount ?? -1), { timeout: 5_000 }).toBe(1);
    await expect.poll(() => page.url(), { timeout: 6_000 }).toBe("https://www.youtube.com/shorts/scroll-allowed");
    await expectVisible(page, byTestId("shorts-action-bar") + ` button[aria-label="Block Scroll Allowed Creator with ChannelFence"]`);
    const advanceState = await page.evaluate(() => {
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
    await expect.poll(() => page.$eval("#navigation-button-down button", element => !(element as HTMLButtonElement).disabled)).toBe(true);
    await expect.poll(() => page.$eval("html", element => element.className)).not.toMatch(/cf-watch-pending/);
    await expectCount(page, "#cf-hard-block-overlay", 0);
  });

  test("recovers once when YouTube resets the first native next scroll", async ({ addon }) => {
    const page = addon.page;
    await openFixture(page, shortsViewer("Reset Blocked Creator", "@resetblocked"), "/shorts/reset-blocked");
    await page.evaluate(installConsumedShortsScroll, false);
    await addon.setStorage({
      cfBlockedChannels: [blockedCreator("@resetblocked", "Reset Blocked Creator")]
    });

    await expect.poll(() => page.url(), { timeout: 6_000 }).toBe("https://www.youtube.com/shorts/reset-allowed");
    const nextButton = "#navigation-button-down button";
    await expectAttribute(page, nextButton, "data-click-count", "2");
    await expectVisible(page, byTestId("shorts-action-bar") + ' button[aria-label="Block Reset Allowed Creator with ChannelFence"]');
    const positions = await page.$eval("#shorts-container", (element) =>
      JSON.parse((element as HTMLElement).dataset.scrollPositions!) as number[]);
    expect(positions[0]).toBe(0);
    expect(Math.max(...positions)).toBeGreaterThan(2);
    expect(positions.at(-1)).toBe(0);
    await expect.poll(() => page.$eval("html", element => element.className)).not.toMatch(/cf-watch-pending/);
    await expectCount(page, "#cf-hard-block-overlay", 0);

    // Observe several existing retry ticks after success. A stale recovery must
    // not click again and skip the allowed creator to the sentinel route.
    await delay(750);
    await expect.poll(() => page.$eval(nextButton, element => !(element as HTMLButtonElement).disabled)).toBe(true);
    await expectAttribute(page, nextButton, "data-click-count", "2");
    await expectAttribute(page, nextButton, "data-paths", JSON.stringify([
      "/shorts/reset-blocked", "/shorts/reset-allowed"
    ]));
    await expect.poll(() => page.url()).toBe("https://www.youtube.com/shorts/reset-allowed");
  });

  test("fails open without repeated clicks when YouTube resets native next scrolling again", async ({ addon }) => {
    const page = addon.page;
    await openFixture(page, shortsViewer("Reset Blocked Creator", "@resetblocked"), "/shorts/reset-blocked");
    await page.evaluate(installConsumedShortsScroll, true);
    await addon.setStorage({
      cfBlockedChannels: [blockedCreator("@resetblocked", "Reset Blocked Creator")]
    });
    const nextButton = "#navigation-button-down button";
    await expectAttribute(page, nextButton, "data-click-count", "2");
    await expectAttribute(page, "#shorts-container", "data-reset-count", "2");
    await expect.poll(() => page.$eval("html", element => element.className)).toMatch(/cf-watch-pending/);

    // The original ten-second deadline must still release the player even when
    // YouTube consumes the recovery click too. Later updates cannot rearm it.
    await expect.poll(() => page.$eval("html", element => element.className), { timeout: 10_500 }).not.toMatch(/cf-watch-pending/);
    await expect.poll(() => page.url()).toBe("https://www.youtube.com/shorts/reset-blocked");
    await expect.poll(() => page.$eval(nextButton, element => !(element as HTMLButtonElement).disabled)).toBe(true);
    await expectAttribute(page, nextButton, "data-click-count", "2");
    await expectCount(page, "#cf-hard-block-overlay", 0);
    await expectVisible(page, byTestId("shorts-action-bar"));
    await page.evaluate(() => {
      document.dispatchEvent(new Event("yt-page-data-updated", { bubbles: true }));
    });
    await delay(750);
    await expectAttribute(page, nextButton, "data-click-count", "2");
    await expectAttribute(page, nextButton, "data-paths", JSON.stringify(["/shorts/reset-blocked"]));
    await expect.poll(() => page.$eval("html", element => element.className)).not.toMatch(/cf-watch-pending/);
  });

  test("does not retry a reset native scroll after trusted keyboard input", async ({ addon }) => {
    const page = addon.page;
    await openFixture(page, shortsViewer("Reset Blocked Creator", "@resetblocked"), "/shorts/reset-blocked");
    await page.evaluate(installConsumedShortsScroll, false);
    const nextButton = "#navigation-button-down button";
    // Keep the recovery unavailable until trusted input arrives, so automation
    // latency cannot race the product's next retry tick.
    await page.$eval(nextButton, (element) => {
      element.addEventListener("click", () => {
        (element as HTMLButtonElement).disabled = true;
      }, { once: true });
    });
    await addon.setStorage({
      cfBlockedChannels: [blockedCreator("@resetblocked", "Reset Blocked Creator")]
    });
    await expectAttribute(page, "#shorts-container", "data-reset-count", "1");
    await expect.poll(() => page.$eval(nextButton, element => (element as HTMLButtonElement).disabled)).toBe(true);
    await page.keyboard.press("Escape");
    await page.$eval(nextButton, (element) => { (element as HTMLButtonElement).disabled = false; });

    // Several retry ticks must not replay an advance after the user's input.
    await delay(750);
    await expect.poll(() => page.$eval(nextButton, element => !(element as HTMLButtonElement).disabled)).toBe(true);
    await expectAttribute(page, nextButton, "data-click-count", "1");
    await expectAttribute(page, nextButton, "data-paths", JSON.stringify(["/shorts/reset-blocked"]));
    await expect.poll(() => page.url()).toBe("https://www.youtube.com/shorts/reset-blocked");
    await expectCount(page, "#cf-hard-block-overlay", 0);
  });

  test("waits for slow creator hydration without skipping an allowed Short", async ({ addon }) => {
    const page = addon.page;
    const initialBlock = blockedCreator("@slowblocked", "Slow Blocked Creator");
    initialBlock.aliases.push("channel:UCaaaaaaaaaaaaaaaaaaaaaa");
    await addon.setStorage({ cfBlockedChannels: [initialBlock] });
    await openFixture(page,
      shortsViewer("Slow Blocked Creator", "@slowblocked"),
      "/shorts/slow-blocked"
    );
    await page.evaluate(() => {
      const meta = document.createElement("meta");
      meta.setAttribute("itemprop", "channelId");
      meta.setAttribute("content", "UCaaaaaaaaaaaaaaaaaaaaaa");
      document.head.append(meta);
    });
    await installShortsAdvanceQueue(page, [
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

    await expect.poll(() => page.url(), { timeout: 6_000 }).toBe("https://www.youtube.com/shorts/slow-allowed");
    await page.evaluate(() => {
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
    await delay(1_200);
    await expect.poll(() => page.url()).toBe("https://www.youtube.com/shorts/slow-allowed");
    await expectVisible(page, byTestId("shorts-action-bar") + ` button[aria-label="Block Slow Allowed Creator with ChannelFence"]`);
    expect((await shortsAdvanceState(page)).clickCount).toBe(1);
    await expectCount(page, "#cf-hard-block-overlay", 0);
  });

  test("clicks the native next control only once while its route transition is slow", async ({ addon }) => {
    const page = addon.page;
    await openFixture(page,
      shortsViewer("Slow Route Creator A", "@slowroutea"),
      "/shorts/slow-route-a"
    );
    await installShortsAdvanceQueue(page, [
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
    await page.evaluate(() => {
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

    const blockButton = byTestId("shorts-action-bar") + ` button[aria-label="Block Slow Route Creator A with ChannelFence"]`;
    await page.locator(blockButton).click();
    await delay(3_300);
    await expect.poll(() => page.url()).toBe("https://www.youtube.com/shorts/slow-route-a");
    expect((await shortsAdvanceState(page)).clickCount).toBe(1);
    await expectAttribute(page, "ytd-shorts #shorts-container", "data-scroll-events", "0");

    await expect.poll(() => page.url(), { timeout: 3_000 }).toBe("https://www.youtube.com/shorts/slow-route-b");
    await expectVisible(page, byTestId("shorts-action-bar") + ` button[aria-label="Block Slow Route Creator B with ChannelFence"]`);
    expect((await shortsAdvanceState(page)).clickCount).toBe(1);
    const stored = await addon.getStorage<{
      cfBlockedChannels: Array<{ aliases: string[] }>;
    }>("cfBlockedChannels");
    expect(stored.cfBlockedChannels).toHaveLength(1);
    await expectCount(page, "#cf-hard-block-overlay", 0);
  });

  test("does not hide ordinary Shorts navigation when the block list is empty", async ({ addon }) => {
    const page = addon.page;
    await openFixture(page,
      shortsViewer("Pass Through Creator A", "@passthrougha"),
      "/shorts/pass-through-a"
    );
    await installShortsAdvanceQueue(page, [{
      path: "/shorts/pass-through-b",
      displayName: "Pass Through Creator B",
      handle: "@passthroughb"
    }]);
    await page.evaluate(() => {
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

    await page.locator("#navigation-button-down button").click();
    await expect.poll(() => page.url()).toBe("https://www.youtube.com/shorts/pass-through-b");
    await expectVisible(page, byTestId("shorts-action-bar") + ` button[aria-label="Block Pass Through Creator B with ChannelFence"]`);
    const pendingSeen = await page.evaluate(() =>
      (window as typeof window & { __cfPendingRecord?: { pendingSeen: boolean } })
        .__cfPendingRecord?.pendingSeen
    );
    expect(pendingSeen).toBe(false);
    expect((await shortsAdvanceState(page)).clickCount).toBe(1);
  });

  test("settles immediately when consecutive Shorts have the same creator", async ({ addon }) => {
    const page = addon.page;
    await addon.setStorage({
      cfBlockedChannels: [blockedCreator("@unrelatedblocked", "Unrelated Blocked Creator")]
    });
    await openFixture(page,
      shortsViewer("Same Creator", "@samecreator"),
      "/shorts/same-owner-a"
    );
    await installShortsAdvanceQueue(page, [{
      path: "/shorts/same-owner-b",
      displayName: "Same Creator",
      handle: "@samecreator"
    }], { ownerDelayMs: 200 });

    await page.locator("#navigation-button-down button").click();
    await expect.poll(() => page.url()).toBe("https://www.youtube.com/shorts/same-owner-b");
    await expect.poll(() => page.$eval("html", element => element.className), { timeout: 1_000 }).not.toMatch(/cf-watch-pending/);
    await expectVisible(page, byTestId("shorts-action-bar") + ` button[aria-label="Block Same Creator with ChannelFence"]`);
    expect((await shortsAdvanceState(page)).clickCount).toBe(1);
  });

  test("accepts a prehydrated next renderer from the same creator", async ({ addon }) => {
    const page = addon.page;
    await addon.setStorage({
      cfBlockedChannels: [blockedCreator("@unrelatedblocked", "Unrelated Blocked Creator")]
    });
    await openFixture(page,
      shortsViewer("Preloaded Creator", "@preloadedcreator"),
      "/shorts/preloaded-a"
    );
    await page.evaluate(() => {
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

    await page.locator("#navigation-button-down button").click();
    await expect.poll(() => page.url()).toBe("https://www.youtube.com/shorts/preloaded-b");
    await expect.poll(() => page.$eval("html", element => element.className), { timeout: 1_000 }).not.toMatch(/cf-watch-pending/);
    await expectAttribute(page, "ytd-reel-video-renderer[is-active] .cf-shorts-action__button", "aria-label", "Block Preloaded Creator with ChannelFence");
  });

  test("fails open when a new Shorts renderer never hydrates its creator", async ({ addon }) => {
    const page = addon.page;
    const unrelatedBlock = blockedCreator(
      "@unrelatedblocked",
      "Unrelated Blocked Creator"
    );
    unrelatedBlock.aliases.push("channel:UCunresolvedstale0001");
    await addon.setStorage({ cfBlockedChannels: [unrelatedBlock] });
    await openFixture(page,
      shortsViewer("Initial Creator", "@initialcreator"),
      "/shorts/unhydrated-a"
    );
    await page.evaluate(() => {
      const metadata = document.createElement("meta");
      metadata.setAttribute("itemprop", "channelId");
      metadata.content = "UCunresolvedstale0001";
      document.head.append(metadata);
    });
    await installShortsAdvanceQueue(page, [{
      path: "/shorts/unhydrated-b?si=fixture",
      displayName: "Never Hydrated Creator",
      handle: "@neverhydrated"
    }], {
      ownerNeverHydrates: true
    });

    await page.locator("#navigation-button-down button").click();
    await expect.poll(() => page.url()).toBe("https://www.youtube.com/shorts/unhydrated-b?si=fixture");
    await expect.poll(() => page.$eval("html", element => element.className), { timeout: 6_000 }).not.toMatch(/cf-watch-pending/);
    await page.evaluate(() => {
      history.replaceState({}, "", "/shorts/unhydrated-b");
      document.dispatchEvent(new Event("yt-page-data-updated", { bubbles: true }));
    });
    await delay(750);
    await expect.poll(() => page.url()).toBe("https://www.youtube.com/shorts/unhydrated-b");
    await expect.poll(() => page.$eval("html", element => element.className)).not.toMatch(/cf-watch-pending/);
    expect((await shortsAdvanceState(page)).clickCount).toBe(1);
    await expectCount(page, "#cf-hard-block-overlay", 0);
  });

  test("does not reuse a stale blocked owner after the identity deadline", async ({ addon }) => {
    const page = addon.page;
    await addon.setStorage({
      cfBlockedChannels: [blockedCreator("@deadlineblocked", "Deadline Blocked Creator")]
    });
    await openFixture(page,
      shortsViewer("Deadline Blocked Creator", "@deadlineblocked"),
      "/shorts/deadline-blocked"
    );
    await installShortsAdvanceQueue(page, [
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

    await expect.poll(() => page.url(), { timeout: 6_000 }).toBe("https://www.youtube.com/shorts/deadline-allowed");
    await expect.poll(() => page.$eval("html", element => element.className)).toMatch(/cf-watch-pending/);
    await page.evaluate(() => {
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
    await delay(4_900);
    await expect.poll(() => page.url()).toBe("https://www.youtube.com/shorts/deadline-allowed");
    await expect.poll(() => page.$eval("html", element => element.className)).not.toMatch(/cf-watch-pending/);
    await delay(900);
    await expectVisible(page, byTestId("shorts-action-bar") + ` button[aria-label="Block Deadline Allowed Creator with ChannelFence"]`);
    expect((await shortsAdvanceState(page)).clickCount).toBe(1);
  });

  test("ignores an offscreen stale active Shorts renderer", async ({ addon }) => {
    const page = addon.page;
    await addon.setStorage({
      cfBlockedChannels: [blockedCreator("@staleactive", "Stale Active Creator")]
    });
    await openFixture(page,
      shortsViewer("Visible Creator", "@visiblecreator"),
      "/shorts/visible-current"
    );
    await page.evaluate(() => {
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

    const currentAction = "ytd-reel-video-renderer[data-current-renderer] .cf-shorts-action__button";
    await expectAttribute(page, currentAction, "aria-label", "Block Visible Creator with ChannelFence");
    await expect.poll(() => page.$eval("html", element => element.className)).not.toMatch(/cf-watch-pending/);
    await delay(1_000);
    await expect.poll(() => page.url()).toBe("https://www.youtube.com/shorts/visible-current");
    await expectCount(page, "#cf-hard-block-overlay", 0);
  });

  test("skips a blocked creator encountered while scrolling without double-advancing", async ({ addon }) => {
    const page = addon.page;
    await addon.setStorage({
      cfBlockedChannels: [blockedCreator("@blockedmiddle", "Blocked Middle Creator")]
    });
    await openFixture(page,
      shortsViewer("Allowed First Creator", "@allowedfirst"),
      "/shorts/allowed-first"
    );
    await installShortsAdvanceQueue(page, [
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

    await page.locator("#navigation-button-down button").click();
    await expect.poll(() => page.url(), { timeout: 6_000 }).toBe("https://www.youtube.com/shorts/allowed-last");
    await expectVisible(page, byTestId("shorts-action-bar") + ` button[aria-label="Block Allowed Last Creator with ChannelFence"]`);
    const advance = await shortsAdvanceState(page);
    expect(advance.clickCount).toBe(2);
    expect(advance.paths).toEqual([
      "/shorts/allowed-first",
      "/shorts/blocked-middle",
      "/shorts/allowed-last"
    ]);
    await delay(2_800);
    await expect.poll(() => page.url()).toBe("https://www.youtube.com/shorts/allowed-last");
    await expectCount(page, "#cf-hard-block-overlay", 0);
  });

  test("blocks several Shorts creators sequentially without duplicates or Home fallbacks", async ({ addon }) => {
    const page = addon.page;
    await openFixture(page,
      shortsViewer("Sequence Creator A", "@sequencea"),
      "/shorts/sequence-a"
    );
    await installShortsAdvanceQueue(page, [
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

    const currentBlockButton = () => byTestId("shorts-action-bar") + " .cf-shorts-action__button";
    const expected = [
      ["Sequence Creator A", "/shorts/sequence-b", "Sequence Creator B"],
      ["Sequence Creator B", "/shorts/sequence-c", "Sequence Creator C"],
      ["Sequence Creator C", "/shorts/sequence-d", "Sequence Creator D"]
    ];

    for (let index = 0; index < expected.length; index += 1) {
      const [currentName, nextPath, nextName] = expected[index];
      await expectAttribute(page, currentBlockButton(), "aria-label", `Block ${currentName} with ChannelFence`);
      await page.locator(currentBlockButton()).click();
      await expect.poll(() => page.url()).toBe(`https://www.youtube.com${nextPath}`);
      await expectAttribute(page, currentBlockButton(), "aria-label", `Block ${nextName} with ChannelFence`);
      await expect.poll(async () => {
        const stored = await addon.getStorage<{
          cfBlockedChannels: Array<{ aliases: string[] }>;
        }>("cfBlockedChannels");
        return stored.cfBlockedChannels.length;
      }).toBe(index + 1);
      await expectCount(page, "#cf-hard-block-overlay", 0);
    }

    const stored = await addon.getStorage<{
      cfBlockedChannels: Array<{ aliases: string[] }>;
    }>("cfBlockedChannels");
    expect(stored.cfBlockedChannels.flatMap((entry) => entry.aliases).sort()).toEqual([
      "handle:@sequencea",
      "handle:@sequenceb",
      "handle:@sequencec"
    ]);
    expect((await shortsAdvanceState(page)).clickCount).toBe(3);
    await delay(2_800);
    await expect.poll(() => page.url()).toBe("https://www.youtube.com/shorts/sequence-d");
  });

  test("skips 50 previously blocked Shorts creators without freezing or falling Home", async ({ addon }) => {
    const page = addon.page;
    const blockedCount = 50;
    const blockedCreators = Array.from({ length: blockedCount }, (_, index) => {
      const number = String(index + 1).padStart(2, "0");
      return blockedCreator(`@stressblocked${number}`, `Stress Blocked Creator ${number}`);
    });
    await addon.setStorage({ cfBlockedChannels: blockedCreators });
    await openFixture(page,
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
    await installShortsAdvanceQueue(page, [
      ...blockedQueue,
      {
        path: "/shorts/stress-allowed-final",
        displayName: "Stress Allowed Final Creator",
        handle: "@stressallowedfinal"
      }
    ], { ownerDelayMs: 10 });

    const startedAt = Date.now();
    await page.locator("#navigation-button-down button").click();
    await expect.poll(() => page.url(), { timeout: 15_000 }).toBe("https://www.youtube.com/shorts/stress-allowed-final");
    const elapsedMs = Date.now() - startedAt;

    const advance = await shortsAdvanceState(page);
    expect(advance.clickCount).toBe(blockedCount + 1);
    expect(advance.paths).toEqual([
      "/shorts/stress-bootstrap",
      ...blockedQueue.map((item) => item.path),
      "/shorts/stress-allowed-final"
    ]);
    expect(advance.paths).not.toContain("/");
    expect(elapsedMs).toBeLessThan(10_000);
    await expectCount(page, "#cf-hard-block-overlay", 0);
    await expect.poll(() => page.$eval("html", element => element.className)).not.toMatch(/cf-watch-pending/);
    await expectVisible(page, byTestId("shorts-action-bar") + ` button[aria-label="Block Stress Allowed Final Creator with ChannelFence"]`);

    const stored = await addon.getStorage<{
      cfBlockedChannels: Array<{ aliases: string[] }>;
    }>("cfBlockedChannels");
    expect(stored.cfBlockedChannels).toHaveLength(blockedCount);
    expect(new Set(stored.cfBlockedChannels.flatMap((entry) => entry.aliases)).size)
      .toBe(blockedCount);

    // Hold beyond the 10-second blocked-Short retry window so a stale timer
    // cannot late-advance, reveal the blocked route, or eject the user Home.
    await delay(10_500);
    await expect.poll(() => page.url()).toBe("https://www.youtube.com/shorts/stress-allowed-final");
    await expectCount(page, "#cf-hard-block-overlay", 0);
    await expect.poll(() => page.$eval("html", element => element.className)).not.toMatch(/cf-watch-pending/);
    await expectVisible(page, byTestId("shorts-action-bar") + ` button[aria-label="Block Stress Allowed Final Creator with ChannelFence"]`);
  });

  test("adds a ChannelFence action to the current Shorts menu", async ({ addon }) => {
    const page = addon.page;
    await openFixture(page,
      shortsViewer("Shorts Menu Creator", "@shortsmenucreator"),
      "/shorts/fixture-menu"
    );

    await openCreatorMenu(page, byTestId("shorts-menu"));
    const menuItem = ".cf-menu-item";
    await expect.poll(() => page.$eval(menuItem, element => element.textContent)).toContain("ChannelFence: Block");
    await routeToNextShortOnAdvance(page, "/shorts/fixture-menu-next");
    await page.locator(menuItem).click();

    const stored = await addon.getStorage<{
      cfBlockedChannels: Array<{ aliases: string[] }>;
    }>("cfBlockedChannels");
    expect(stored.cfBlockedChannels[0].aliases).toEqual(["handle:@shortsmenucreator"]);
    await expect.poll(() => page.url()).toBe("https://www.youtube.com/shorts/fixture-menu-next");
    await expectCount(page, "#cf-hard-block-overlay", 0);
  });
});
