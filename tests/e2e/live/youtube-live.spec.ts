import { blockedCreator, expect, test } from "../fixtures/extension.fixture";

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

test("uses the live channel route as the canonical header identity", async ({
  extensionPage
}) => {
  await extensionPage.goto("https://www.youtube.com/@hiddentracktv2", {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });

  const header = extensionPage.locator(
    "yt-page-header-renderer, ytd-c4-tabbed-header-renderer #channel-header-container"
  ).filter({ has: extensionPage.locator("h1") }).first();
  await expect(header).toBeVisible({ timeout: 30_000 });
  const controls = header.locator(".cf-channel-header-block");
  await expect(controls).toHaveCount(1, { timeout: 15_000 });
  await expect(controls).toHaveAttribute(
    "data-cf-identity",
    "handle:@hiddentracktv2"
  );
  await expect(controls).not.toHaveAttribute("aria-label", /Community/i);
});

test("stores a live channel block with the canonical handle label", async ({
  extensionPage,
  extensionStorage
}) => {
  await extensionPage.goto("https://www.youtube.com/@rokujones", {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });

  const control = extensionPage.locator(
    "yt-page-header-renderer .cf-channel-header-block, " +
    "ytd-c4-tabbed-header-renderer #channel-header-container .cf-channel-header-block"
  ).first();
  await expect(control).toBeVisible({ timeout: 30_000 });
  await expect(control).toHaveAttribute("data-cf-identity", "handle:@rokujones");
  await control.click();

  await expect(extensionPage.locator("#cf-hard-block-overlay"))
    .toContainText("rokujones is on your ChannelFence block list.", { timeout: 15_000 });
  await expect.poll(async () => {
    const stored = await extensionStorage.get<{
      cfBlockedChannels: Array<{ displayName: string; key: string }>;
    }>("cfBlockedChannels");
    return stored.cfBlockedChannels[0];
  }, { timeout: 15_000 }).toMatchObject({
    displayName: "rokujones",
    key: "handle:@rokujones"
  });
});

test("keeps live channel-card controls singular and ignores video statistics", async ({
  extensionId,
  extensionPage
}) => {
  const assertNoDuplicateOrStatisticControls = async (url: string) => {
    await extensionPage.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30_000
    });
    const cards = extensionPage.locator("yt-lockup-view-model").filter({
      has: extensionPage.locator("a[href^='/watch']")
    });
    await expect(cards.first()).toBeVisible({ timeout: 30_000 });
    await expect.poll(async () => cards.evaluateAll((elements) => {
      const visibleCards = elements.filter((card) => {
        const style = getComputedStyle(card);
        return style.display !== "none" && style.visibility !== "hidden";
      }).slice(0, 12);
      if (visibleCards.length === 0) return false;
      return visibleCards.every((card) => {
        const buttons = [...card.querySelectorAll(".cf-block-button")];
        return buttons.length <= 1 && buttons.every((button) => {
          const label = button.getAttribute("aria-label") || "";
          return !/\b(?:views?|ago|streamed|premiered)\b/i.test(label);
        });
      });
    }), { timeout: 15_000 }).toBe(true);
    const headerButton = extensionPage.locator(
      "yt-page-header-renderer .cf-block-button, " +
      "ytd-c4-tabbed-header-renderer #channel-header-container .cf-block-button"
    ).first();
    await expect(headerButton).toBeVisible({ timeout: 15_000 });
    await expect(headerButton).toHaveClass(/\bcf-channel-header-block\b/);
    await expect(headerButton.locator(".cf-channel-header-block__icon")).toHaveAttribute(
      "src",
      `chrome-extension://${extensionId}/assets/icons/channelfence-48.png`
    );
    return cards;
  };

  await assertNoDuplicateOrStatisticControls("https://www.youtube.com/@BoahsLoL/videos");
  const homeCards = await assertNoDuplicateOrStatisticControls(
    "https://www.youtube.com/@fubgun"
  );
  const cardWithCreatorAvatar = homeCards.filter({
    has: extensionPage.locator("[aria-label^='Go to channel ']")
  }).first();
  await expect(cardWithCreatorAvatar).toBeVisible({ timeout: 30_000 });
  await expect(cardWithCreatorAvatar.locator(".cf-block-button")).toHaveCount(0, {
    timeout: 15_000
  });
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
  const refreshedShorts = extensionPage.locator(
    "ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2"
  ).filter({
    has: extensionPage.locator("a[href^='/shorts/']")
  });
  await expect(refreshedShorts.first()).toBeAttached({ timeout: 30_000 });
  const repeatedCard = extensionPage.locator(
    "ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2"
  ).filter({
    has: extensionPage.locator(`a[href='${shortHref}']`)
  }).first();
  // YouTube randomizes live search shelves between reloads. When it returns the
  // selected Short again, verify that the stored path hides it immediately.
  if (await repeatedCard.count()) {
    await expect(repeatedCard.locator(
      "xpath=ancestor::div[contains(@class, 'ytGridShelfViewModelGridShelfItem')][1]"
    )).toHaveClass(/cf-hidden-by-channelfence/, { timeout: 15_000 });
  }
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
  const blockedPath = new URL(blockedUrl).pathname;
  await blockButton.click();
  await expect(extensionPage).not.toHaveURL(blockedUrl, { timeout: 10_000 });
  await expect.poll(
    () => new URL(extensionPage.url()).pathname,
    { timeout: 10_000 }
  ).not.toBe(blockedPath);
  await expect.poll(
    () => new URL(extensionPage.url()).pathname,
    { timeout: 10_000 }
  ).toMatch(/^\/shorts\/[^/?#]+$/);
  await expect(extensionPage.locator("#cf-hard-block-overlay")).toHaveCount(0);
  // The URL transition, persisted block, and lack of an overlay are the
  // ChannelFence-controlled outcomes. YouTube's Linux/headless player does
  // not consistently render or autoplay the next visible <video> element.
  await expect.poll(async () => {
    const values = await extensionStorage.get<{
      cfBlockedChannels?: Array<{ aliases?: string[] }>;
    }>("cfBlockedChannels");
    return values.cfBlockedChannels?.length ?? 0;
  }).toBe(1);
});

test("advances instead of returning Home when a live Short opens pre-blocked", async ({
  extensionPage,
  extensionStorage
}) => {
  const blockedUrl = "https://www.youtube.com/shorts/E4PB_V8yZso";
  await extensionPage.goto(blockedUrl, {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });

  const ownerAnchor = extensionPage.locator(
    "ytd-shorts yt-reel-channel-bar-view-model a[href*='/@']"
  ).first();
  await expect(ownerAnchor).toBeVisible({ timeout: 30_000 });
  const ownerHref = await ownerAnchor.getAttribute("href");
  const displayName = (await ownerAnchor.textContent())?.trim() || "Blocked Shorts Creator";
  const ownerHandle = new URL(ownerHref || "", blockedUrl).pathname.split("/")[1];
  expect(ownerHandle).toMatch(/^@/);

  await extensionPage.goto("about:blank");
  await extensionStorage.set({
    cfBlockedChannels: [blockedCreator(ownerHandle, displayName)]
  });
  await extensionPage.goto(blockedUrl, {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });

  await expect(extensionPage).not.toHaveURL(blockedUrl, { timeout: 10_000 });
  await expect.poll(
    () => new URL(extensionPage.url()).pathname,
    { timeout: 10_000 }
  ).toMatch(/^\/shorts\/[^/?#]+$/);
  await expect.poll(
    () => new URL(extensionPage.url()).pathname,
    { timeout: 10_000 }
  ).not.toBe("/");
  await expect(extensionPage.locator("#cf-hard-block-overlay")).toHaveCount(0);
  await expect(extensionPage.locator("html")).not.toHaveClass(/cf-watch-pending/, {
    timeout: 10_000
  });
});
