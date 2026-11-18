import { blockedCreator, expect, test } from "../fixtures/extension.fixture";
import { shortsRendererQueue, shortsRendererTags } from "../fixtures/shorts-renderers";
import { YouTubeSurfacePage } from "../pages/youtube-surface.page";

for (const tag of shortsRendererTags) {
  test.describe(`Shorts renderer ${tag}`, () => {
    test("keeps a localized action in the native stack across pause and resume", async ({ extensionPage, extensionStorage }) => {
      await extensionStorage.set({ cfLanguage: "ru", cfHideHomeShorts: true });
      const youtube = new YouTubeSurfacePage(extensionPage);
      await youtube.open(shortsRendererQueue(tag), "/shorts/first");
      const reel = youtube.card("first-reel");
      const action = reel.locator("reel-action-bar-view-model > .cf-shorts-action");
      await expect(action).toBeVisible();
      await expect(action.locator(".cf-shorts-action__label")).toHaveText("Заблокировать");
      await expect(action).toHaveAttribute("data-cf-identity", "handle:@firstcreator");
      await expect(reel.locator(".cf-block-button")).toHaveCount(0);
      await extensionStorage.set({ cfEnabled: false });
      await expect(extensionPage.locator(".cf-shorts-action")).toHaveCount(0);
      await extensionStorage.set({ cfEnabled: true });
      await expect(action).toHaveCount(1);
      await expect(action).toBeVisible();
      await expect(extensionPage.locator("#cf-hard-block-overlay")).toHaveCount(0);
    });

    test("blocks only the current creator and skips the next blocked preloaded reel", async ({ extensionPage, extensionStorage }) => {
      await extensionStorage.set({ cfBlockedChannels: [blockedCreator("@secondcreator", "second creator")] });
      const youtube = new YouTubeSurfacePage(extensionPage);
      await youtube.open(shortsRendererQueue(tag), "/shorts/first");
      await expect(youtube.card("first-reel").locator(".cf-shorts-action")).toBeVisible();
      await expect(extensionPage).toHaveURL("https://www.youtube.com/shorts/first");
      await youtube.card("first-reel").getByRole("button", { name: "Block first creator with ChannelFence" }).click();
      await expect(extensionPage).toHaveURL("https://www.youtube.com/shorts/third");
      await expect(youtube.card("third-reel").getByRole("button", { name: "Block third creator with ChannelFence" })).toBeVisible();
      const stored = await extensionStorage.get<{ cfBlockedChannels: Array<{ aliases: string[] }> }>("cfBlockedChannels");
      expect(stored.cfBlockedChannels.flatMap((entry) => entry.aliases).sort()).toEqual([
        "handle:@firstcreator", "handle:@secondcreator"
      ]);
      await expect(extensionPage.locator("#cf-hard-block-overlay")).toHaveCount(0);
      await expect(extensionPage.locator("html")).not.toHaveClass(/cf-watch-pending/);
    });

    test("uses the new owner when YouTube reuses a renderer", async ({ extensionPage, extensionStorage }) => {
      const youtube = new YouTubeSurfacePage(extensionPage);
      await youtube.open(shortsRendererQueue(tag), "/shorts/first");
      const reel = youtube.card("first-reel");
      await expect(reel.locator(".cf-shorts-action")).toBeVisible();
      await extensionPage.evaluate(() => {
        document.dispatchEvent(new Event("yt-navigate-start", { bubbles: true }));
        history.pushState({}, "", "/shorts/reused");
        const reel = document.querySelector('[data-testid="first-reel"]')!;
        reel.querySelector('a[href^="/shorts/"]')!.setAttribute("href", "/shorts/reused");
        const oldOwner = reel.querySelector("yt-reel-channel-bar-view-model a")!;
        const newOwner = oldOwner.cloneNode(true) as HTMLAnchorElement;
        newOwner.href = "/@replacementcreator/shorts";
        newOwner.textContent = "replacement creator";
        oldOwner.replaceWith(newOwner);
        document.dispatchEvent(new Event("yt-navigate-finish", { bubbles: true }));
      });
      await expect(reel.locator(".cf-shorts-action")).toHaveAttribute("data-cf-identity", "handle:@replacementcreator");
      await expect(reel.locator(".cf-shorts-action")).toHaveCount(1);
      const menu = await youtube.openCreatorMenu("first-menu");
      await menu.click();
      await expect(extensionPage).toHaveURL("https://www.youtube.com/shorts/second");
      const stored = await extensionStorage.get<{ cfBlockedChannels: Array<{ aliases: string[] }> }>("cfBlockedChannels");
      expect(stored.cfBlockedChannels.map((entry) => entry.aliases)).toEqual([["handle:@replacementcreator"]]);
      await expect(extensionPage.locator("#cf-hard-block-overlay")).toHaveCount(0);
    });

    test("settles consecutive Shorts from the same creator after the owner rerenders", async ({ extensionPage, extensionStorage }) => {
      await extensionStorage.set({ cfBlockedChannels: [blockedCreator("@unrelated", "unrelated")] });
      const youtube = new YouTubeSurfacePage(extensionPage);
      await youtube.open(shortsRendererQueue(tag), "/shorts/first");
      await expect(youtube.card("first-reel").locator(".cf-shorts-action")).toBeVisible();
      await extensionPage.evaluate(() => {
        document.dispatchEvent(new Event("yt-navigate-start", { bubbles: true }));
        history.pushState({}, "", "/shorts/same-creator");
        document.querySelector('[data-testid="first-reel"] a[href^="/shorts/"]')!
          .setAttribute("href", "/shorts/same-creator");
        document.dispatchEvent(new Event("yt-navigate-finish", { bubbles: true }));
      });
      await expect(extensionPage.locator("html")).toHaveClass(/cf-watch-pending/);
      await extensionPage.evaluate(() => {
        const owner = document.querySelector('[data-testid="first-reel"] yt-reel-channel-bar-view-model a')!;
        owner.replaceWith(owner.cloneNode(true));
      });
      // Resolve from the owner mutation, before the 4.5-second fail-open deadline.
      await expect(extensionPage.locator("html")).not.toHaveClass(/cf-watch-pending/, { timeout: 2_000 });
      await expect(extensionPage).toHaveURL("https://www.youtube.com/shorts/same-creator");
      await youtube.card("first-reel").getByRole("button", { name: "Block first creator with ChannelFence" }).click();
      await expect(extensionPage).toHaveURL("https://www.youtube.com/shorts/second");
      const stored = await extensionStorage.get<{ cfBlockedChannels: Array<{ aliases: string[] }> }>("cfBlockedChannels");
      expect(stored.cfBlockedChannels.flatMap((entry) => entry.aliases).sort()).toEqual([
        "handle:@firstcreator", "handle:@unrelated"
      ]);
    });

    test("hides the blocked player while waiting for scroll fallback", async ({ extensionPage, extensionStorage }) => {
      const youtube = new YouTubeSurfacePage(extensionPage);
      await youtube.open(shortsRendererQueue(tag), "/shorts/first");
      await expect(youtube.card("first-reel").locator(".cf-shorts-action")).toBeVisible();
      await extensionPage.locator("#navigation-button-down").evaluate((element) => element.remove());
      await extensionStorage.set({ cfBlockedChannels: [blockedCreator("@firstcreator", "first creator")] });
      await expect(extensionPage.locator("html")).toHaveClass(/cf-watch-pending/);
      await expect(youtube.card("first-reel").locator("#player")).toHaveCSS("visibility", "hidden");
      await expect(extensionPage).toHaveURL("https://www.youtube.com/shorts/second");
      await expect(youtube.card("second-reel").locator(".cf-shorts-action")).toBeVisible();
      await expect(extensionPage.locator("html")).not.toHaveClass(/cf-watch-pending/);
    });
  });
}
