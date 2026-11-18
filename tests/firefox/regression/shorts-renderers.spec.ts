import { blockedCreator, expect, test, expectVisible, expectText, expectCount, expectAttribute, expectCSS, openFixture, openCreatorMenu } from "../extension.fixture";
import { shortsRendererQueue, shortsRendererTags } from "../../e2e/fixtures/shorts-renderers";

for (const tag of shortsRendererTags) {
  test.describe(`Shorts renderer ${tag}`, () => {
    test("keeps a localized action in the native stack across pause and resume", async ({ addon }) => {
      const page = addon.page;
      await addon.setStorage({ cfLanguage: "ru", cfHideHomeShorts: true });
      await openFixture(page, shortsRendererQueue(tag), "/shorts/first");
      const reel = '[data-testid="first-reel"]';
      const action = `${reel} reel-action-bar-view-model > .cf-shorts-action`;
      await expectVisible(page, action);
      await expectText(page, `${action} .cf-shorts-action__label`, "Заблокировать");
      await expectAttribute(page, action, "data-cf-identity", "handle:@firstcreator");
      await expectCount(page, `${reel} .cf-block-button`, 0);
      await addon.setStorage({ cfEnabled: false });
      await expectCount(page, ".cf-shorts-action", 0);
      await addon.setStorage({ cfEnabled: true });
      await expectCount(page, action, 1);
      await expectVisible(page, action);
      await expectCount(page, "#cf-hard-block-overlay", 0);
    });

    test("blocks only the current creator and skips the next blocked preloaded reel", async ({ addon }) => {
      const page = addon.page;
      await addon.setStorage({ cfBlockedChannels: [blockedCreator("@secondcreator", "second creator")] });
      await openFixture(page, shortsRendererQueue(tag), "/shorts/first");
      await expectVisible(page, '[data-testid="first-reel"] .cf-shorts-action');
      expect(page.url()).toBe("https://www.youtube.com/shorts/first");
      await page.click('[data-testid="first-reel"] button[aria-label="Block first creator with ChannelFence"]');
      await expect.poll(() => page.url()).toBe("https://www.youtube.com/shorts/third");
      await expectVisible(page, '[data-testid="third-reel"] button[aria-label="Block third creator with ChannelFence"]');
      const stored = await addon.getStorage<{ cfBlockedChannels: Array<{ aliases: string[] }> }>("cfBlockedChannels");
      expect(stored.cfBlockedChannels.flatMap((entry) => entry.aliases).sort()).toEqual([
        "handle:@firstcreator", "handle:@secondcreator"
      ]);
      await expectCount(page, "#cf-hard-block-overlay", 0);
      await expectCount(page, "html.cf-watch-pending", 0);
    });

    test("uses the new owner when YouTube reuses a renderer", async ({ addon }) => {
      const page = addon.page;
      await openFixture(page, shortsRendererQueue(tag), "/shorts/first");
      const reel = '[data-testid="first-reel"]';
      await expectVisible(page, `${reel} .cf-shorts-action`);
      await page.evaluate(() => {
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
      await expectAttribute(page, `${reel} .cf-shorts-action`, "data-cf-identity", "handle:@replacementcreator");
      await expectCount(page, `${reel} .cf-shorts-action`, 1);
      await openCreatorMenu(page, '[data-testid="first-menu"]');
      await page.click(".cf-menu-item");
      await expect.poll(() => page.url()).toBe("https://www.youtube.com/shorts/second");
      const stored = await addon.getStorage<{ cfBlockedChannels: Array<{ aliases: string[] }> }>("cfBlockedChannels");
      expect(stored.cfBlockedChannels.map((entry) => entry.aliases)).toEqual([["handle:@replacementcreator"]]);
      await expectCount(page, "#cf-hard-block-overlay", 0);
    });

    test("settles consecutive Shorts from the same creator after the owner rerenders", async ({ addon }) => {
      const page = addon.page;
      await addon.setStorage({ cfBlockedChannels: [blockedCreator("@unrelated", "unrelated")] });
      await openFixture(page, shortsRendererQueue(tag), "/shorts/first");
      await expectVisible(page, '[data-testid="first-reel"] .cf-shorts-action');
      await page.evaluate(async () => {
        document.dispatchEvent(new Event("yt-navigate-start", { bubbles: true }));
        history.pushState({}, "", "/shorts/same-creator");
        document.querySelector('[data-testid="first-reel"] a[href^="/shorts/"]')!
          .setAttribute("href", "/shorts/same-creator");
        document.dispatchEvent(new Event("yt-navigate-finish", { bubbles: true }));
        // Let the queued route scan capture the old owner before its later rerender.
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      });
      await expectCount(page, "html.cf-watch-pending", 1);
      await page.evaluate(() => {
        const owner = document.querySelector('[data-testid="first-reel"] yt-reel-channel-bar-view-model a')!;
        owner.replaceWith(owner.cloneNode(true));
      });
      // Resolve from the owner mutation, before the 4.5-second fail-open deadline.
      await expect.poll(() => page.$$eval("html.cf-watch-pending", (elements) => elements.length), {
        timeout: 2_000
      }).toBe(0);
      expect(page.url()).toBe("https://www.youtube.com/shorts/same-creator");
      await page.click('[data-testid="first-reel"] button[aria-label="Block first creator with ChannelFence"]');
      await expect.poll(() => page.url()).toBe("https://www.youtube.com/shorts/second");
      const stored = await addon.getStorage<{ cfBlockedChannels: Array<{ aliases: string[] }> }>("cfBlockedChannels");
      expect(stored.cfBlockedChannels.flatMap((entry) => entry.aliases).sort()).toEqual([
        "handle:@firstcreator", "handle:@unrelated"
      ]);
    });

    test("hides the blocked player while waiting for scroll fallback", async ({ addon }) => {
      const page = addon.page;
      await openFixture(page, shortsRendererQueue(tag), "/shorts/first");
      await expectVisible(page, '[data-testid="first-reel"] .cf-shorts-action');
      await page.$eval("#navigation-button-down", (element) => element.remove());
      await addon.setStorage({ cfBlockedChannels: [blockedCreator("@firstcreator", "first creator")] });
      await expectCount(page, "html.cf-watch-pending", 1);
      await expectCSS(page, '[data-testid="first-reel"] #player', "visibility", "hidden");
      await expect.poll(() => page.url()).toBe("https://www.youtube.com/shorts/second");
      await expectVisible(page, '[data-testid="second-reel"] .cf-shorts-action');
      await expectCount(page, "html.cf-watch-pending", 0);
    });
  });
}
