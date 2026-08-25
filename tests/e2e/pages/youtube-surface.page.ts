import { expect, type Locator, type Page } from "@playwright/test";
import { youtubeDocument } from "../fixtures/youtube-fixtures";

export class YouTubeSurfacePage {
  constructor(readonly page: Page) {}

  async open(body: string, path = "/__channelfence_fixture__/home"): Promise<void> {
    const html = youtubeDocument(body);
    await this.page.route("https://www.youtube.com/**", async (route) => {
      if (route.request().isNavigationRequest()) {
        await route.fulfill({
          body: html,
          contentType: "text/html",
          status: 200
        });
        return;
      }
      await route.abort();
    });
    await this.page.goto(`https://www.youtube.com${path}`, { waitUntil: "domcontentloaded" });
    await expect.poll(() => this.page.evaluate(() => {
      const probe = document.createElement("div");
      probe.className = "cf-hidden-by-channelfence";
      document.body.append(probe);
      const display = getComputedStyle(probe).display;
      probe.remove();
      return display;
    })).toBe("none");
  }

  card(testId: string): Locator {
    return this.page.getByTestId(testId);
  }

  blockButton(testId: string): Locator {
    return this.card(testId).locator(".cf-block-button");
  }

  async append(markup: string): Promise<void> {
    await this.page.evaluate((html) => document.body.insertAdjacentHTML("beforeend", html), markup);
  }

  async openCreatorMenu(triggerTestId: string, nativeColor = "rgb(238, 238, 238)"): Promise<Locator> {
    return (await this.openCreatorMenuItems(triggerTestId, nativeColor)).first();
  }

  async openCreatorMenuItems(
    triggerTestId: string,
    nativeColor = "rgb(238, 238, 238)"
  ): Promise<Locator> {
    const trigger = this.page.getByTestId(triggerTestId);
    await trigger.dispatchEvent("pointerdown");
    await trigger.click();
    await this.page.evaluate((color) => {
      document.querySelector("ytd-menu-popup-renderer")?.remove();
      const popup = document.createElement("ytd-menu-popup-renderer");
      const items = document.createElement("div");
      items.id = "items";
      items.setAttribute("role", "menu");
      const nativeItem = document.createElement("div");
      nativeItem.setAttribute("role", "menuitem");
      const label = document.createElement("span");
      label.className = "label";
      label.textContent = "Report";
      label.style.color = color;
      nativeItem.append(label);
      items.append(nativeItem);
      popup.append(items);
      document.body.append(popup);
    }, nativeColor);

    const channelFenceItems = this.page.locator(".cf-menu-item");
    await expect(channelFenceItems.first()).toBeVisible();
    return channelFenceItems;
  }
}
