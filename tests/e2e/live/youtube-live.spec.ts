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
  await expect(recommendation.locator(".cf-block-button")).toBeVisible({ timeout: 15_000 });

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
