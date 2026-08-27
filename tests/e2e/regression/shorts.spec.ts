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

async function routeToNextShortOnScroll(page: Page, path: string): Promise<void> {
  await page.locator("ytd-shorts #shorts-container").evaluate((element, nextPath) => {
    element.addEventListener("scroll", () => {
      const anchor = document.querySelector(
        "yt-reel-channel-bar-view-model a[href*='/@']"
      ) as HTMLAnchorElement | null;
      if (anchor) {
        anchor.href = "/@nextshortcreator/shorts";
        anchor.textContent = "Next Shorts Creator";
        anchor.setAttribute("aria-label", "Next Shorts Creator");
      }
      history.pushState({}, "", nextPath);
      document.dispatchEvent(new Event("yt-navigate-finish", { bubbles: true }));
    }, { once: true });
  }, path);
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
      displayName: "Compact Shorts Creator",
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
    await routeToNextShortOnScroll(extensionPage, "/shorts/fixture-next");
    await blockButton.click();

    const stored = await extensionStorage.get<{
      cfBlockedChannels: Array<{ aliases: string[]; displayName: string }>;
    }>("cfBlockedChannels");
    expect(stored.cfBlockedChannels).toEqual([
      expect.objectContaining({
        aliases: ["handle:@shortscreator"],
        displayName: "Shorts Creator"
      })
    ]);
    await expect(extensionPage).toHaveURL("https://www.youtube.com/shorts/fixture-next");
    await expect(video).toHaveAttribute("data-pause-calls", "0");
    await expect(youtube.card("shorts-action-bar")).toBeVisible();
    await expect(youtube.card("shorts-like")).toBeVisible();
    await expect(extensionPage.locator("#cf-hard-block-overlay")).toHaveCount(0);
  });

  test("returns Home instead of showing a dialog when no next Short is available", async ({
    extensionPage,
    extensionStorage
  }) => {
    await extensionStorage.set({
      cfBlockedChannels: [blockedCreator("@shortscreator", "Shorts Creator")]
    });
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(
      shortsViewer("Shorts Creator", "@shortscreator"),
      "/shorts/fixture-without-next"
    );

    await expect(extensionPage).toHaveURL("https://www.youtube.com/", { timeout: 6_000 });
    await expect(extensionPage.locator("#cf-hard-block-overlay")).toHaveCount(0);
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
    await routeToNextShortOnScroll(extensionPage, "/shorts/fixture-menu-next");
    await menuItem.click();

    const stored = await extensionStorage.get<{
      cfBlockedChannels: Array<{ aliases: string[] }>;
    }>("cfBlockedChannels");
    expect(stored.cfBlockedChannels[0].aliases).toEqual(["handle:@shortsmenucreator"]);
    await expect(extensionPage).toHaveURL("https://www.youtube.com/shorts/fixture-menu-next");
    await expect(extensionPage.locator("#cf-hard-block-overlay")).toHaveCount(0);
  });
});
