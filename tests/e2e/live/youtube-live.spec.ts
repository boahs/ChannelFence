import { expect, test } from "../fixtures/extension.fixture";

test("injects ChannelFence on the live YouTube origin", async ({ extensionPage }) => {
  await extensionPage.goto("https://www.youtube.com/@YouTube", {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });

  await expect.poll(() => extensionPage.evaluate(() => {
    const probe = document.createElement("div");
    probe.className = "cf-hidden-by-channelfence";
    document.body.append(probe);
    const display = getComputedStyle(probe).display;
    probe.remove();
    return display;
  })).toBe("none");
});

test("adds block controls to a live watch-page right-rail lockup", async ({ extensionPage }) => {
  await extensionPage.goto("https://www.youtube.com/watch?v=dQw4w9WgXcQ", {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });

  const recommendation = extensionPage.locator(
    "ytd-watch-next-secondary-results-renderer yt-lockup-view-model"
  ).filter({
    has: extensionPage.locator("[aria-label^='Go to channel ']")
  }).first();
  await expect(recommendation).toBeVisible({ timeout: 30_000 });
  await expect(recommendation.locator(".cf-block-button").first()).toBeVisible({ timeout: 15_000 });

  await recommendation.getByRole("button", { name: "More actions" }).click();
  await expect(extensionPage.locator(".cf-menu-item")).toContainText("ChannelFence: Block", {
    timeout: 15_000
  });
});

test("adds a block control to live YouTube search results", async ({ extensionPage }) => {
  await extensionPage.goto("https://www.youtube.com/results?search_query=CustomGrow420", {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });

  const result = extensionPage.locator("ytd-video-renderer").filter({
    has: extensionPage.locator("ytd-channel-name a[href]")
  }).first();
  await expect(result).toBeVisible({ timeout: 30_000 });
  await expect(result.locator(".cf-block-button")).toBeVisible({ timeout: 15_000 });
});

test("blocks a live video from its three-dot menu", async ({
  extensionPage,
  extensionStorage
}) => {
  await extensionPage.goto("https://www.youtube.com/results?search_query=cat+videos", {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });

  const result = extensionPage.locator("ytd-video-renderer").filter({
    has: extensionPage.locator("ytd-channel-name a[href]")
  }).first();
  await expect(result).toBeVisible({ timeout: 30_000 });
  await result.locator("ytd-menu-renderer button[aria-label='Action menu']").click();
  const action = extensionPage.locator("ytd-menu-popup-renderer:visible .cf-menu-item").last();
  await expect(action).toBeVisible({ timeout: 15_000 });
  await action.click();

  await expect(result).toBeHidden({ timeout: 15_000 });
  await expect.poll(async () => {
    const values = await extensionStorage.get<{ cfBlockedChannels: unknown[] }>(
      "cfBlockedChannels"
    );
    return values.cfBlockedChannels.length;
  }).toBe(1);
});

test("blocks a compact live Short from its three-dot menu without leaving search", async ({
  extensionPage,
  extensionStorage
}) => {
  await extensionPage.goto("https://www.youtube.com/results?search_query=cat+videos", {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });

  const card = extensionPage.locator(
    "ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2"
  ).filter({
    has: extensionPage.locator("a[href^='/shorts/']")
  }).first();
  await expect(card).toBeVisible({ timeout: 30_000 });
  const menuButton = card.getByRole("button", { name: "More actions" });
  await expect(menuButton).toHaveCount(1, { timeout: 15_000 });
  const shortHref = await card.locator("a[href^='/shorts/']").first().getAttribute("href");
  const selectedCard = extensionPage.locator(
    "ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2"
  ).filter({
    has: extensionPage.locator("a[href='" + shortHref + "']")
  }).first();
  const layoutItem = selectedCard.locator(
    "xpath=ancestor::div[contains(@class, 'ytGridShelfViewModelGridShelfItem')][1]"
  );
  const shelf = selectedCard.locator("xpath=ancestor::grid-shelf-view-model[1]");

  const feedUrl = extensionPage.url();
  await menuButton.click();
  const menuAction = extensionPage.getByRole("menuitem", {
    name: "Block this Short's creator with ChannelFence"
  }).last();
  await expect(menuAction).toBeVisible({ timeout: 15_000 });
  await menuAction.click();
  await expect(layoutItem).toBeHidden({ timeout: 15_000 });
  const firstRow = shelf.locator(".ytGridShelfViewModelGridShelfRow").first();
  await expect(firstRow).toHaveClass(/cf-compact-short-row-reflow/);
  await expect.poll(async () => firstRow.evaluate((row) => {
    const visibleItems = [...row.children].filter((child) => {
      const style = getComputedStyle(child);
      return style.display !== "none" && style.visibility !== "hidden";
    }).map((child) => child.getBoundingClientRect()).sort((left, right) => left.left - right.left);
    return visibleItems.slice(1).reduce((largestGap, item, index) =>
      Math.max(largestGap, item.left - visibleItems[index].right), 0);
  })).toBeLessThan(80);
  await expect(extensionPage).toHaveURL(feedUrl);
  await expect.poll(async () => {
    const values = await extensionStorage.get<{
      cfBlockedChannels: Array<{ shortPaths?: string[] }>;
    }>(
      "cfBlockedChannels"
    );
    return values.cfBlockedChannels[0]?.shortPaths || [];
  }).toContain(shortHref);

  await extensionPage.reload({ waitUntil: "domcontentloaded" });
  const repeatedCard = extensionPage.locator(
    "ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2"
  ).filter({
    has: extensionPage.locator(`a[href='${shortHref}']`)
  }).first();
  await expect(repeatedCard).toBeAttached({ timeout: 30_000 });
  await expect(repeatedCard.locator(
    "xpath=ancestor::div[contains(@class, 'ytGridShelfViewModelGridShelfItem')][1]"
  )).toHaveClass(/cf-hidden-by-channelfence/, { timeout: 15_000 });
});

test("advances after blocking the current live Shorts creator", async ({
  extensionPage,
  extensionStorage
}) => {
  await extensionStorage.set({ cfHideHomeShorts: true });
  await extensionPage.goto("https://www.youtube.com/shorts/E4PB_V8yZso", {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });

  const channelBar = extensionPage.locator(
    "ytd-shorts yt-reel-channel-bar-view-model"
  ).filter({
    has: extensionPage.locator("a[href*='/@']")
  }).first();
  await expect(channelBar).toBeVisible({ timeout: 30_000 });
  await expect(channelBar.locator(".cf-block-button")).toHaveCount(0);
  const currentReel = channelBar.locator("xpath=ancestor::ytd-reel-video-renderer[1]");
  const blockButton = currentReel.locator(".cf-shorts-action__button");
  await expect(blockButton).toBeVisible({ timeout: 15_000 });
  const blockedUrl = extensionPage.url();
  await blockButton.click();
  await expect(extensionPage).not.toHaveURL(blockedUrl, { timeout: 10_000 });
  await expect(extensionPage.locator("#cf-hard-block-overlay")).toHaveCount(0);
  // YouTube keeps many preloaded Shorts renderers in the DOM and no longer
  // consistently marks the current one with `is-active`. Anchor the assertion
  // on ChannelFence's visible control, then inspect its owning reel.
  const nextBlockButton = extensionPage.locator(
    ".cf-shorts-action__button:visible"
  ).first();
  await expect(nextBlockButton).toBeVisible({ timeout: 15_000 });
  const nextReel = nextBlockButton.locator(
    "xpath=ancestor::ytd-reel-video-renderer[1]"
  );
  await expect.poll(async () => nextReel.locator("video").evaluate((video) =>
    !(video as HTMLVideoElement).paused
  ), { timeout: 15_000 }).toBe(true);
});
