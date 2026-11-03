import { setTimeout as delay } from "node:timers/promises";
import type { Frame, HTTPRequest } from "puppeteer-core";
import type { BidiConnection } from "puppeteer-core/internal/bidi/Connection.js";
import { blockedCreator } from "../../e2e/fixtures/extension.fixture";
import { expect, expectAttribute, expectCount, expectContainsText, expectVisible, test } from "../extension.fixture";

type ShortsEvent = { type: string; at: number; path: string; visibility: string };
type ShortsDiagnosticWindow = Window & { __cfFirefoxShortsEvents?: ShortsEvent[] };

test("injects ChannelFence on the live YouTube origin", async ({ addon }) => {
  await addon.page.goto("https://www.youtube.com/@YouTube", { waitUntil: "domcontentloaded", timeout: 30_000 });
  await expect.poll(() => addon.page.evaluate(() => {
    const probe = document.createElement("div");
    probe.className = "cf-hidden-by-channelfence";
    document.body.append(probe);
    const display = getComputedStyle(probe).display;
    probe.remove();
    return display;
  })).toBe("none");
});

test("uses the live channel route as the canonical header identity", async ({ addon }) => {
  await addon.page.goto("https://www.youtube.com/@hiddentracktv2", { waitUntil: "domcontentloaded", timeout: 30_000 });
  const header = "yt-page-header-renderer:has(h1), ytd-c4-tabbed-header-renderer #channel-header-container:has(h1)";
  await addon.page.waitForSelector(header, { visible: true, timeout: 30_000 });
  const controls = ":is(yt-page-header-renderer, ytd-c4-tabbed-header-renderer #channel-header-container):has(h1) .cf-channel-header-block";
  await expectCount(addon.page, controls, 1);
  await expectAttribute(addon.page, controls, "data-cf-identity", "handle:@hiddentracktv2");
  expect(await addon.page.$eval(controls, (element) => element.getAttribute("aria-label"))).not.toMatch(/Community/i);
});

test("stores a live channel block with the canonical handle label", async ({ addon }) => {
  await addon.page.goto("https://www.youtube.com/@rokujones", { waitUntil: "domcontentloaded", timeout: 30_000 });
  const selector = "yt-page-header-renderer .cf-channel-header-block, ytd-c4-tabbed-header-renderer #channel-header-container .cf-channel-header-block";
  await addon.page.waitForSelector(selector, { visible: true, timeout: 30_000 });
  await expectAttribute(addon.page, selector, "data-cf-identity", "handle:@rokujones");
  await addon.page.locator(selector).click();
  await expectContainsText(addon.page, "#cf-hard-block-overlay", "rokujones is on your ChannelFence block list.");
  await expect.poll(async () => (await addon.getStorage<{ cfBlockedChannels: Array<{ displayName: string; key: string }> }>("cfBlockedChannels"))
    .cfBlockedChannels[0]).toMatchObject({ displayName: "rokujones", key: "handle:@rokujones" });
});

test("keeps live channel-card controls singular and ignores video statistics", async ({ addon }) => {
  const cards = "yt-lockup-view-model:has(a[href^='/watch'])";
  for (const url of ["https://www.youtube.com/@BoahsLoL/videos", "https://www.youtube.com/@fubgun"]) {
    await addon.page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await addon.page.waitForSelector(cards, { visible: true, timeout: 30_000 });
    await expect.poll(() => addon.page.$$eval(cards, (elements) => {
      const visible = elements.filter((element) => element.checkVisibility()).slice(0, 12);
      return visible.length > 0 && visible.every((element) => {
        const buttons = [...element.querySelectorAll(".cf-block-button")];
        return buttons.length <= 1 && buttons.every((button) => !/\b(?:views?|ago|streamed|premiered)\b/i.test(button.getAttribute("aria-label") || ""));
      });
    }), { timeout: 15_000 }).toBe(true);
    const header = "yt-page-header-renderer .cf-block-button, ytd-c4-tabbed-header-renderer #channel-header-container .cf-block-button";
    await expectVisible(addon.page, header);
    await expectAttribute(addon.page, header, "class", /\bcf-channel-header-block\b/);
    await expectAttribute(addon.page, ".cf-channel-header-block__icon", "src", `${addon.origin}/assets/icons/channelfence-48.png`);
  }
  const withAvatar = `${cards}:has([aria-label^='Go to channel '])`;
  await addon.page.waitForSelector(withAvatar, { visible: true, timeout: 30_000 });
  await expectCount(addon.page, `${withAvatar} .cf-block-button`, 0);
});

test("adds block controls to a live watch-page right-rail lockup", async ({ addon }) => {
  await addon.page.goto("https://www.youtube.com/watch?v=dQw4w9WgXcQ", { waitUntil: "domcontentloaded", timeout: 30_000 });
  const recommendation = await addon.page.waitForSelector("ytd-watch-next-secondary-results-renderer yt-lockup-view-model:has([aria-label^='Go to channel '])", { visible: true, timeout: 30_000 });
  if (!recommendation) throw new Error("No supported recommendation was rendered");
  await recommendation.waitForSelector(".cf-block-button", { visible: true, timeout: 15_000 });
  const menu = await recommendation.waitForSelector("button[aria-label='More actions']", { visible: true });
  if (!menu) throw new Error("No recommendation overflow menu was rendered");
  await menu.click();
  await expectContainsText(addon.page, ".cf-menu-item", "ChannelFence: Block");
});

test("adds a block control to live YouTube search results", async ({ addon }) => {
  await addon.page.goto("https://www.youtube.com/results?search_query=CustomGrow420", { waitUntil: "domcontentloaded", timeout: 30_000 });
  const result = await addon.page.waitForSelector("ytd-video-renderer:has(ytd-channel-name a[href])", { visible: true, timeout: 30_000 });
  if (!result) throw new Error("No supported search result was rendered");
  await result.waitForSelector(".cf-block-button", { visible: true, timeout: 15_000 });
});

test("blocks a live video from its three-dot menu", async ({ addon }) => {
  await addon.page.goto("https://www.youtube.com/results?search_query=cat+videos", { waitUntil: "domcontentloaded", timeout: 30_000 });
  const result = await addon.page.waitForSelector("ytd-video-renderer:has(ytd-channel-name a[href])", { visible: true, timeout: 30_000 });
  if (!result) throw new Error("No supported search result was rendered");
  await result.hover();
  const menu = await result.waitForSelector("ytd-menu-renderer button[aria-label='Action menu']", { visible: true });
  if (!menu) throw new Error("No search result overflow menu was rendered");
  await menu.click();
  await expectVisible(addon.page, "ytd-menu-popup-renderer .cf-menu-item");
  await addon.page.locator("ytd-menu-popup-renderer .cf-menu-item").click();
  await expect.poll(() => result.evaluate((element) => element.checkVisibility()), { timeout: 15_000 }).toBe(false);
  await expect.poll(async () => (await addon.getStorage<{ cfBlockedChannels: unknown[] }>("cfBlockedChannels")).cfBlockedChannels.length).toBe(1);
});

test("blocks a compact live Short from its three-dot menu without leaving search", async ({ addon }) => {
  await addon.page.goto("https://www.youtube.com/results?search_query=cat+videos", { waitUntil: "domcontentloaded", timeout: 30_000 });
  const cards = ":is(ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2)";
  const card = await addon.page.waitForSelector(`${cards}:has(a[href^='/shorts/'])`, { visible: true, timeout: 30_000 });
  if (!card) throw new Error("No supported compact Short was rendered");
  await expect.poll(() => card.$$eval("button[aria-label='More actions']", (elements) => elements.length)).toBe(1);
  const href = await card.$eval("a[href^='/shorts/']", (element) => element.getAttribute("href"));
  const item = await card.evaluateHandle((element) => element.closest("div.ytGridShelfViewModelGridShelfItem")!);
  const row = await card.evaluateHandle((element) => element.closest("grid-shelf-view-model")!.querySelector(".ytGridShelfViewModelGridShelfRow")!);
  const feedUrl = addon.page.url();
  const menu = await card.waitForSelector("button[aria-label='More actions']", { visible: true });
  if (!menu) throw new Error("No compact Shorts overflow menu was rendered");
  await menu.click();
  const action = '[role="menuitem"][aria-label="Block this Short\'s creator with ChannelFence"]';
  await expectVisible(addon.page, action);
  await addon.page.locator(action).click();
  await expect.poll(() => item.evaluate((element) => element.checkVisibility()), { timeout: 15_000 }).toBe(false);
  await expect.poll(() => row.evaluate((element) => element.classList.contains("cf-compact-short-row-reflow"))).toBe(true);
  await expect.poll(() => row.evaluate((element) => {
    const items = [...element.children].filter((child) => child.checkVisibility()).map((child) => child.getBoundingClientRect()).sort((a, b) => a.left - b.left);
    return items.slice(1).reduce((gap, item, index) => Math.max(gap, item.left - items[index].right), 0);
  })).toBeLessThan(80);
  expect(addon.page.url()).toBe(feedUrl);
  await expect.poll(async () => (await addon.getStorage<{ cfBlockedChannels: Array<{ shortPaths?: string[] }> }>("cfBlockedChannels"))
    .cfBlockedChannels[0]?.shortPaths || []).toContain(href);
  await addon.page.reload({ waitUntil: "domcontentloaded" });
  await addon.page.waitForSelector(`${cards}:has(a[href^='/shorts/'])`, { timeout: 30_000 });
  const repeated = await addon.page.$(`${cards}:has(a[href=${JSON.stringify(href)}])`);
  // YouTube randomizes shelves. If this Short returns, its persisted path must hide it.
  if (repeated) {
    await expect.poll(() => repeated.evaluate((element) => element.closest("div.ytGridShelfViewModelGridShelfItem")?.classList.contains("cf-hidden-by-channelfence")), { timeout: 15_000 }).toBe(true);
  }
});

test("advances after blocking the current live Shorts creator", async ({ addon }) => {
  await addon.setStorage({ cfHideHomeShorts: true });
  await addon.page.goto("https://www.youtube.com/shorts/E4PB_V8yZso", { waitUntil: "domcontentloaded", timeout: 30_000 });
  const channel = await addon.page.waitForSelector("ytd-shorts yt-reel-channel-bar-view-model:has(a[href*='/@'])", { visible: true, timeout: 30_000 });
  if (!channel) throw new Error("The Shorts creator bar was not rendered");
  expect(await channel.$$eval(".cf-block-button", (elements) => elements.length)).toBe(0);
  const reel = await channel.evaluateHandle((element) => element.closest("ytd-reel-video-renderer")!);
  const button = await reel.asElement()!.waitForSelector(".cf-shorts-action__button", { visible: true, timeout: 15_000 });
  if (!button) throw new Error("ChannelFence's Shorts action was not rendered");
  const url = addon.page.url();
  const path = new URL(url).pathname;
  await button.click();
  await expect.poll(() => addon.page.url(), { timeout: 10_000 }).not.toBe(url);
  await expect.poll(() => new URL(addon.page.url()).pathname, { timeout: 10_000 }).not.toBe(path);
  await expect.poll(() => new URL(addon.page.url()).pathname, { timeout: 10_000 }).toMatch(/^\/shorts\/[^/?#]+$/);
  await expectCount(addon.page, "#cf-hard-block-overlay", 0);
  await expect.poll(async () => (await addon.getStorage<{ cfBlockedChannels: unknown[] }>("cfBlockedChannels")).cfBlockedChannels.length).toBe(1);
});

test("advances instead of returning Home when a live Short opens pre-blocked", async ({ addon }) => {
  const blockedUrl = "https://www.youtube.com/shorts/E4PB_V8yZso";
  await addon.page.goto(blockedUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
  const owner = await addon.page.waitForSelector("ytd-shorts yt-reel-channel-bar-view-model a[href*='/@']", { visible: true, timeout: 30_000 });
  if (!owner) throw new Error("The Shorts creator was not rendered");
  const href = await owner.evaluate((element) => element.getAttribute("href"));
  const name = await owner.evaluate((element) => element.textContent?.trim() || "Blocked Shorts Creator");
  const handle = new URL(href || "", blockedUrl).pathname.split("/")[1];
  expect(handle).toMatch(/^@/);
  await addon.page.goto("about:blank");
  await addon.setStorage({ cfBlockedChannels: [blockedCreator(handle, name)] });
  await addon.page.goto(blockedUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await expect.poll(() => addon.page.url(), { timeout: 10_000 }).not.toBe(blockedUrl);
  await expect.poll(() => new URL(addon.page.url()).pathname, { timeout: 10_000 }).toMatch(/^\/shorts\/[^/?#]+$/);
  expect(new URL(addon.page.url()).pathname).not.toBe("/");
  await expectCount(addon.page, "#cf-hard-block-overlay", 0);
  await expect.poll(() => addon.page.$eval("html", (element) => element.classList.contains("cf-watch-pending")), { timeout: 10_000 }).toBe(false);
});

test("quickly skips the requested live Short with a 50-entry block list after Home and reload", async ({ addon }, testInfo) => {
  test.slow();
  const page = addon.page;
  const blockedUrl = "https://www.youtube.com/shorts/bUam9LKFIv4";
  const blockedPath = new URL(blockedUrl).pathname;
  // Observe native navigation and the product's next-button click without
  // changing YouTube handlers. Retain the current document's events on failure.
  await page.evaluateOnNewDocument(() => {
    const events: ShortsEvent[] = [];
    (window as ShortsDiagnosticWindow).__cfFirefoxShortsEvents = events;
    const record = (type: string) => events.push({
      type, at: Date.now(), path: location.pathname, visibility: document.visibilityState
    });
    for (const type of ["yt-navigate-start", "yt-navigate-finish", "DOMContentLoaded"]) {
      document.addEventListener(type, () => record(type), true);
    }
    document.addEventListener("click", (event) => {
      if (event.target instanceof Element && event.target.closest("ytd-shorts #navigation-button-down button")) {
        record(`next-button-click:${event.isTrusted ? "trusted" : "synthetic"}`);
      }
    }, true);
  });
  await page.goto(blockedUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
  const owner = await page.waitForSelector("ytd-shorts yt-reel-channel-bar-view-model a[href*='/@']", { visible: true, timeout: 30_000 });
  if (!owner) throw new Error("The Shorts creator was not rendered");
  const href = await owner.evaluate((element) => element.getAttribute("href"));
  const name = await owner.evaluate((element) => element.textContent?.trim() || "Blocked Shorts Creator");
  const handle = new URL(href || "", blockedUrl).pathname.split("/")[1];
  expect(handle).toMatch(/^@/);
  const synthetic = Array.from({ length: 49 }, (_, index) => {
    const number = String(index + 1).padStart(2, "0");
    return blockedCreator(`@cfstress${number}`, `ChannelFence Stress ${number}`);
  });
  await page.goto("https://www.youtube.com/", { waitUntil: "domcontentloaded", timeout: 30_000 });
  expect(new URL(page.url()).pathname).toBe("/");
  await addon.setStorage({ cfBlockedChannels: [...synthetic, blockedCreator(handle, name)] });
  expect((await addon.getStorage<{ cfBlockedChannels: unknown[] }>("cfBlockedChannels")).cfBlockedChannels).toHaveLength(50);

  const skipBlockedShort = async (reloadBlockedUrl = false) => {
    const observedPaths: string[] = [];
    const navigationPaths: string[] = [];
    const connection = (addon.browser as unknown as { connection: BidiConnection }).connection;
    const context = (page.mainFrame() as unknown as { _id: string })._id;
    let targetSeen = false;
    const recordPath = (raw: string) => {
      if (!URL.canParse(raw)) return;
      const url = new URL(raw);
      if (url.hostname !== "www.youtube.com") return;
      if (url.pathname === blockedPath) targetSeen = true;
      if (targetSeen && observedPaths.at(-1) !== url.pathname) observedPaths.push(url.pathname);
    };
    const onNavigation = (event: { context: string; url: string }) => {
      if (event.context === context) recordPath(event.url);
    };
    const onRequest = (request: HTTPRequest) => {
      if (request.isNavigationRequest() && request.frame() === page.mainFrame()) navigationPaths.push(new URL(request.url()).pathname);
    };
    // Native commit/history events also catch transient Home routes. Puppeteer's
    // URL cache can still say Home after commit, until DOMContentLoaded arrives.
    connection.on("browsingContext.navigationCommitted", onNavigation);
    connection.on("browsingContext.historyUpdated", onNavigation);
    page.on("request", onRequest);
    const startedAt = Date.now();
    let loadedAt = startedAt;
    let completedAt = startedAt;
    let allowedPath = "";
    try {
      if (reloadBlockedUrl) {
        // Public Puppeteer navigation waits for interactive readiness; an empty
        // waitUntil can instead resolve before commit. Use Firefox's native
        // commit event to match Playwright's goto({ waitUntil: "commit" }).
        let timer: ReturnType<typeof setTimeout> | undefined;
        let onCommit: ((event: { context: string; url: string }) => void) | undefined;
        try {
          const committedUrl = await new Promise<string>((resolve, reject) => {
            onCommit = (event) => { if (event.context === context) resolve(event.url); };
            connection.on("browsingContext.navigationCommitted", onCommit);
            timer = setTimeout(() => reject(new Error("Blocked Short did not commit within 30000ms")), 30_000);
            void connection.send("browsingContext.navigate", {
              context, url: blockedUrl, wait: "none"
            }, 30_000).catch(reject);
          });
          // Puppeteer's cached page.url() updates at DOMContentLoaded, so check
          // the browser's committed URL before immediately reloading it.
          expect(new URL(committedUrl).pathname).toBe(blockedPath);
          // Await this reload's readiness, rather than Puppeteer's navigation
          // waiter which can resolve on the first document still finishing.
          await connection.send("browsingContext.reload", { context, wait: "interactive" }, 30_000);
        } finally {
          clearTimeout(timer);
          if (onCommit) connection.off("browsingContext.navigationCommitted", onCommit);
        }
      } else await page.goto(blockedUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
      loadedAt = Date.now();
      await expect.poll(() => {
        recordPath(page.url());
        const path = new URL(page.url()).pathname;
        return path !== blockedPath && /^\/shorts\/[^/?#]+$/.test(path) ? path : "";
      }, { timeout: 10_000 }).toMatch(/^\/shorts\/[^/?#]+$/);
      completedAt = Date.now();
      allowedPath = new URL(page.url()).pathname;
    } finally {
      connection.off("browsingContext.navigationCommitted", onNavigation);
      connection.off("browsingContext.historyUpdated", onNavigation);
      page.off("request", onRequest);
      const documentState = await page.evaluate(() => {
        const nextButton = document.querySelector<HTMLButtonElement>("ytd-shorts #navigation-button-down button");
        return {
          url: location.href, visibility: document.visibilityState, focused: document.hasFocus(),
          pending: document.documentElement.classList.contains("cf-watch-pending"),
          events: (window as ShortsDiagnosticWindow).__cfFirefoxShortsEvents,
          nextButton: nextButton && { disabled: nextButton.disabled, ariaDisabled: nextButton.getAttribute("aria-disabled") },
          owners: [...document.querySelectorAll("ytd-shorts yt-reel-channel-bar-view-model a[href]")]
            .map((element) => element.getAttribute("href"))
        };
      }).catch((error) => ({ captureError: String(error) }));
      await testInfo.attach(`firefox-shorts-skip-${reloadBlockedUrl ? "reload" : "initial"}`, {
        body: JSON.stringify({ blockedPath, handle, startedAt, loadedAt, completedAt, allowedPath,
          observedPaths, navigationPaths, documentState }, null, 2),
        contentType: "application/json"
      });
    }
    expect(observedPaths).not.toContain("/");
    if (reloadBlockedUrl) expect(navigationPaths.filter((path) => path === blockedPath)).toHaveLength(2);
    await expectCount(page, "#cf-hard-block-overlay", 0);
    await expect.poll(() => page.$eval("html", (element) => element.classList.contains("cf-watch-pending")), { timeout: 10_000 }).toBe(false);
    const timing = { afterDomContentLoadedMs: completedAt - loadedAt, totalNavigationMs: completedAt - startedAt, allowedPath, observedPaths, navigationPaths };
    expect(timing.afterDomContentLoadedMs).toBeLessThan(5_000);
    expect(timing.totalNavigationMs).toBeLessThan(20_000);
    return timing;
  };
  const first = await skipBlockedShort();
  await page.reload({ waitUntil: "domcontentloaded", timeout: 30_000 });
  await expect.poll(() => new URL(page.url()).pathname).toMatch(/^\/shorts\/[^/?#]+$/);
  await expectCount(page, "#cf-hard-block-overlay", 0);
  await expect.poll(() => page.$eval("html", (element) => element.classList.contains("cf-watch-pending")), { timeout: 10_000 }).toBe(false);
  await page.goto("https://www.youtube.com/", { waitUntil: "domcontentloaded", timeout: 30_000 });
  expect(new URL(page.url()).pathname).toBe("/");
  const reload = await skipBlockedShort(true);
  expect((await addon.getStorage<{ cfBlockedChannels: unknown[] }>("cfBlockedChannels")).cfBlockedChannels).toHaveLength(50);
  const stablePaths = [reload.allowedPath];
  const recordStable = (url: string) => {
    if (!URL.canParse(url)) return;
    const path = new URL(url).pathname;
    if (stablePaths.at(-1) !== path) stablePaths.push(path);
  };
  const onStableFrame = (frame: Frame) => { if (frame === page.mainFrame()) recordStable(frame.url()); };
  page.on("framenavigated", onStableFrame);
  const stableSampler = setInterval(() => recordStable(page.url()), 10);
  try {
    // Beyond the full product retry window, prove no delayed Home fallback,
    // duplicate advance, or pending-page reappearance after a successful skip.
    await delay(10_500);
  } finally {
    clearInterval(stableSampler);
    page.off("framenavigated", onStableFrame);
  }
  expect(stablePaths).toEqual([reload.allowedPath]);
  expect(page.url()).toBe(`https://www.youtube.com${reload.allowedPath}`);
  await expectCount(page, "#cf-hard-block-overlay", 0);
  expect(await page.$eval("html", (element) => element.classList.contains("cf-watch-pending"))).toBe(false);
  await testInfo.attach("firefox-shorts-skip-timing", { body: JSON.stringify({ blockedPath, handle, first, reload }, null, 2), contentType: "application/json" });
});
