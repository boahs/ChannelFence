import {
  expect, expectText, expectVisible, openCreatorMenu, openExtensionTab, openFixture, openOptions, test,
  type MetadataRequest
} from "./extension.fixture";
import { blockedCreator } from "../e2e/fixtures/extension.fixture";
import { channelHeader, creatorCard, promotedHomeCard, shortsShelf, shortsViewer } from "../e2e/fixtures/youtube-fixtures";

test("installs the real package, initializes defaults, and serves background messages", async ({ addon }) => {
  expect(await addon.getStorage()).toMatchObject({
    cfEnabled: true, cfBlockedChannels: [], cfHideComments: true,
    cfHideHomeShorts: false, cfHideHomeAds: false, cfHideHomePromotions: false,
    cfCompactHomeGrid: false, cfCompactHomeSize: "medium", cfLanguage: "auto"
  });
  const messages = await addon.ui.evaluate(() =>
    (globalThis as unknown as { browser: { runtime: {
      sendMessage(message: unknown): Promise<{ languageCode: { message: string } }>;
    } } }).browser.runtime.sendMessage({ type: "CF_GET_MESSAGES", language: "ko" }));
  expect(messages.languageCode.message).toBe("ko");
  await expectVisible(addon.ui, "h1");
});

test("saves manual blocks, imports a backup, and synchronizes popup and settings", async ({ addon }) => {
  await openOptions(addon);
  await addon.ui.locator("#manualBlockInput").fill("https://www.youtube.com/@FirefoxCreator");
  await addon.ui.locator("#manualBlockButton").click();
  await expectText(addon.ui, "#blockedCount", "1");
  await expect.poll(() => addon.getStorage("cfBlockedChannels")).toMatchObject({
    cfBlockedChannels: [{ key: "handle:@firefoxcreator" }]
  });
  await openOptions(addon);
  await expectText(addon.ui, "#blockedCount", "1");

  const popup = await openExtensionTab(addon, "/ui/popup.html");
  await expectText(popup, "#blockedCount", "1");
  for (const id of ["shortsToggle", "homeAdsToggle", "homePromotionsToggle", "compactHomeGridToggle"]) {
    await popup.locator(`label:has(#${id})`).click();
    await expect.poll(() => addon.ui.$eval(`#${id}`, (element) => (element as HTMLInputElement).checked)).toBe(true);
  }
  await popup.select("#compactHomeSizeSelect", "small");
  await expect.poll(() => addon.getStorage()).toMatchObject({
    cfHideHomeShorts: true, cfHideHomeAds: true, cfHideHomePromotions: true,
    cfCompactHomeGrid: true, cfCompactHomeSize: "small"
  });
  await popup.locator("label:has(#enabledToggle)").click();
  await expect.poll(() => addon.getStorage("cfEnabled")).toMatchObject({ cfEnabled: false });
  await expectText(addon.ui, "#blockedCount", "1");
  await popup.locator("#recentList button").click();
  await expectText(addon.ui, "#blockedCount", "0");

  // BiDi cannot setFiles on privileged extension pages. Supply a real File to
  // the native input and exercise the extension's unchanged import handler.
  await addon.ui.$eval("input#importFile", (input, backup) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([backup], "import.json", { type: "application/json" }));
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, JSON.stringify({
    product: "ChannelFence", formatVersion: 1,
    blockedChannels: [blockedCreator("@imported", "Imported Creator")]
  }));
  await expectText(addon.ui, "#blockedCount", "1");
  await expectText(popup, "#blockedCount", "1");
  await expect.poll(() => addon.getStorage("cfBlockedChannels")).toMatchObject({
    cfBlockedChannels: [{ key: "handle:@imported" }]
  });
});

test("blocks feed creators, offers Undo, and blocks direct visits after a reload", async ({ addon }) => {
  const card = '[data-testid="creator"]';
  await openFixture(addon.page, creatorCard({ id: "creator", handle: "@firefoxcreator", displayName: "Firefox Creator" }));
  await expectVisible(addon.page, `${card} .cf-block-button`);
  await addon.page.locator(`${card} .cf-block-button`).click();
  await expectVisible(addon.page, card, false);
  await expect.poll(() => addon.getStorage("cfBlockedChannels")).toMatchObject({
    cfBlockedChannels: [{ key: "handle:@firefoxcreator" }]
  });
  await addon.page.locator("#cf-toast button").click();
  await expectVisible(addon.page, card);
  await expect.poll(() => addon.getStorage("cfBlockedChannels")).toEqual({ cfBlockedChannels: [] });

  await openCreatorMenu(addon.page, '[data-testid="creator-menu"]');
  await expectText(addon.page, ".cf-menu-item__label", "ChannelFence: Block");
  await addon.page.locator(".cf-menu-item").click();
  await expectVisible(addon.page, card, false);
  await openFixture(addon.page, channelHeader("Firefox Creator", "@firefoxcreator"), "/@firefoxcreator");
  await expectVisible(addon.page, "#cf-hard-block-overlay");
  await addon.page.reload();
  await expectVisible(addon.page, "#cf-hard-block-overlay");
  await addon.setStorage({ cfEnabled: false });
  await expectVisible(addon.page, "#cf-hard-block-overlay", false);
  await expect.poll(() => addon.getStorage("cfBlockedChannels")).toMatchObject({
    cfBlockedChannels: [{ key: "handle:@firefoxcreator" }]
  });
});

test("Home cleanup controls act independently and restore content when paused", async ({ addon }) => {
  const body = `<ytd-browse page-subtype="home"><ytd-rich-grid-renderer>
    ${promotedHomeCard("Advertiser", "home-ad")}
    <ytd-rich-section-renderer data-testid="featured"><ytd-statement-banner-renderer>Featured banner</ytd-statement-banner-renderer></ytd-rich-section-renderer>
    <ytd-rich-section-renderer data-testid="topics"><ytd-rich-shelf-renderer><yt-chips-shelf-view-model class="ytChipsShelfViewModelHost">もっと見る</yt-chips-shelf-view-model></ytd-rich-shelf-renderer></ytd-rich-section-renderer>
    <ytd-rich-section-renderer data-testid="playables"><mini-game-card-view-model>Play</mini-game-card-view-model></ytd-rich-section-renderer>
    ${shortsShelf()}
  </ytd-rich-grid-renderer></ytd-browse>`;
  await openFixture(addon.page, body);
  for (const id of ["home-ad", "featured", "topics", "playables", "shorts-shelf", "regular-video"]) {
    await expectVisible(addon.page, `[data-testid="${id}"]`);
  }
  await addon.setStorage({ cfHideHomeAds: true });
  await expectVisible(addon.page, '[data-testid="home-ad"]', false);
  await expectVisible(addon.page, '[data-testid="featured"]');
  await addon.setStorage({ cfHideHomePromotions: true });
  for (const id of ["featured", "topics", "playables"]) {
    await expectVisible(addon.page, `[data-testid="${id}"]`, false);
  }
  await expectVisible(addon.page, '[data-testid="shorts-shelf"]');
  await addon.setStorage({ cfHideHomeShorts: true });
  await expectVisible(addon.page, '[data-testid="shorts-shelf"]', false);
  await expectVisible(addon.page, '[data-testid="regular-video"]');
  await expectVisible(addon.page, '[data-testid="shorts-guide"]');
  await addon.setStorage({ cfEnabled: false });
  for (const id of ["home-ad", "featured", "topics", "playables", "shorts-shelf", "regular-video"]) {
    await expectVisible(addon.page, `[data-testid="${id}"]`);
  }
});

test("compact Home sizes change real card layout and adapt to a narrow window", async ({ addon }) => {
  const cards = Array.from({ length: 12 }, (_, index) => creatorCard({
    id: `grid-${index}`, handle: `@creator${index}`, displayName: `Creator ${index}`
  })).join("");
  await addon.page.setViewport({ width: 2000, height: 900 });
  await openFixture(addon.page, `<style>
    ytd-browse, ytd-rich-grid-renderer { display: block; width: 100%; }
    ytd-rich-grid-renderer > #contents { display: flex; flex-wrap: wrap; gap: 16px; }
    ytd-rich-item-renderer { box-sizing: border-box; width: calc((100% - 32px)/3); margin: 0; height: 160px; }
  </style><ytd-browse page-subtype="home"><ytd-rich-grid-renderer><div id="contents">${cards}</div></ytd-rich-grid-renderer></ytd-browse>`);
  const firstRowCount = () => addon.page.evaluate(() => {
    const cards = [...document.querySelectorAll<HTMLElement>("ytd-rich-item-renderer")];
    const firstTop = cards[0].getBoundingClientRect().top;
    return cards.filter((card) => Math.abs(card.getBoundingClientRect().top - firstTop) < 1).length;
  });
  await expect.poll(firstRowCount).toBe(3);
  await addon.setStorage({ cfCompactHomeGrid: true });
  for (const [size, columns] of [["small", 6], ["medium", 5], ["large", 4]] as const) {
    await addon.setStorage({ cfCompactHomeSize: size });
    await expect.poll(firstRowCount).toBe(columns);
  }
  await addon.page.setViewport({ width: 390, height: 844 });
  await expect.poll(firstRowCount).toBe(1);
  expect(await addon.page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await addon.setStorage({ cfCompactHomeGrid: false });
  await expect.poll(firstRowCount).toBe(3);
});

test("compact Shorts metadata omits cookies and referrers and filters the matching creator", async ({ addon }) => {
  const requests: MetadataRequest[] = [];
  await openFixture(addon.page, shortsShelf(), "/", "en", { requests, creator: "compactshortscreator" });
  await addon.page.evaluate(() => { document.cookie = "cf_fixture_private=secret; path=/; SameSite=Lax"; });
  expect(await addon.page.evaluate(() => document.cookie)).toContain("cf_fixture_private=secret");
  expect(requests).toHaveLength(0);
  await addon.setStorage({ cfBlockedChannels: [blockedCreator("@compactshortscreator", "Compact Shorts Creator")] });
  await expectVisible(addon.page, '[data-testid="compact-short"]', false);
  await expectVisible(addon.page, '[data-testid="compact-short-two"]');
  expect(requests.length).toBeGreaterThan(0);
  for (const request of requests) {
    expect(request.headers.cookie).toBeUndefined();
    expect(request.headers.referer).toBeUndefined();
    expect(new URL(request.url).origin).toBe("https://www.youtube.com");
  }
});

test("blocks the current Shorts creator and advances to the next Short", async ({ addon }) => {
  await openFixture(addon.page, shortsViewer("First Creator", "@firstcreator"), "/shorts/first");
  await addon.page.evaluate(() => {
    const next = document.createElement("div");
    next.id = "navigation-button-down";
    next.innerHTML = '<button type="button">Next video</button>';
    next.querySelector("button")!.addEventListener("click", () => {
      const owner = document.querySelector<HTMLAnchorElement>("yt-reel-channel-bar-view-model a")!;
      owner.href = "/@nextcreator/shorts";
      owner.textContent = "Next Creator";
      owner.setAttribute("aria-label", "Next Creator");
      history.pushState({}, "", "/shorts/next");
      document.dispatchEvent(new Event("yt-navigate-finish", { bubbles: true }));
    });
    document.querySelector("ytd-shorts")!.append(next);
  });
  await expectVisible(addon.page, ".cf-shorts-action__button");
  await addon.page.locator(".cf-shorts-action__button").click();
  await expect.poll(() => addon.page.url()).toBe("https://www.youtube.com/shorts/next");
  await expect.poll(() => addon.getStorage("cfBlockedChannels")).toMatchObject({
    cfBlockedChannels: [{ key: "handle:@firstcreator" }]
  });
  await expectVisible(addon.page, '[data-testid="shorts-viewer"]');
});
