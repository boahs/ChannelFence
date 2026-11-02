import { expect, test } from "../fixtures/extension.fixture";
import { courseLockup, creatorCard, promotedHomeCard, shortsShelf } from "../fixtures/youtube-fixtures";
import { YouTubeSurfacePage } from "../pages/youtube-surface.page";

const promotionTags = [
  "ytd-statement-banner-renderer", "ytd-banner-promo-renderer",
  "ytd-brand-video-shelf-renderer", "ytd-brand-video-singleton-renderer"
];

function home(contents: string): string {
  return `<style>
    ytd-browse, ytd-rich-grid-renderer { display: block; }
    ${promotionTags.join(",")}, ytd-display-ad-renderer, ytd-ad-slot-renderer {
      display: block; padding: 12px;
    }
  </style><ytd-browse page-subtype="home"><ytd-rich-grid-renderer>
    <div id="home-contents">${contents}</div>
  </ytd-rich-grid-renderer></ytd-browse>`;
}

function promotions(): string {
  return promotionTags.map((tag, index) => `<ytd-rich-section-renderer data-testid="promotion-${index}">
    <div id="content"><${tag}>YouTube featured announcement ${index}</${tag}></div>
  </ytd-rich-section-renderer>`).join("");
}

function ordinaryContent(): string {
  return creatorCard({
    id: "normal-video", handle: "@ordinary", displayName: "Ordinary Creator",
    title: "Sponsored videos and Ready to vote banners explained"
  }) + courseLockup("Course Teacher") + `<ytd-rich-section-renderer data-testid="ordinary-shelf">
    <ytd-rich-shelf-renderer><h2>Recommended videos</h2>${creatorCard({
      id: "shelf-video", handle: "@shelfcreator", displayName: "Shelf Creator"
    })}</ytd-rich-shelf-renderer>
  </ytd-rich-section-renderer>`;
}

test("leaves Home advertisements and promotions visible by default without creator controls", async ({
  extensionPage, extensionStorage
}) => {
  const youtube = new YouTubeSurfacePage(extensionPage);
  await youtube.open(home(promotedHomeCard("Fixture Advertiser", "home-ad") + promotions() + ordinaryContent()), "/");
  await expect(youtube.card("home-ad")).toBeVisible();
  await expect(youtube.card("home-ad").locator(".cf-block-button")).toHaveCount(0);
  for (let index = 0; index < promotionTags.length; index++) {
    await expect(youtube.card(`promotion-${index}`)).toBeVisible();
    await expect(youtube.card(`promotion-${index}`).locator(".cf-block-button")).toHaveCount(0);
  }
  await expect(youtube.blockButton("normal-video")).toBeVisible();
  await expect(youtube.card("course-lockup")).toBeVisible();
  await expect(youtube.card("ordinary-shelf")).toBeVisible();
  const values = await extensionStorage.get<{ cfHideHomeAds?: boolean; cfHideHomePromotions?: boolean }>(
    ["cfHideHomeAds", "cfHideHomePromotions"]
  );
  expect(values.cfHideHomeAds).not.toBe(true);
  expect(values.cfHideHomePromotions).not.toBe(true);
});

test("filters sponsored cards and promotional banners independently while preserving ordinary content", async ({
  extensionPage, extensionStorage
}, testInfo) => {
  const youtube = new YouTubeSurfacePage(extensionPage);
  await youtube.open(home(promotedHomeCard("Fixture Advertiser", "home-ad") + promotions() + ordinaryContent()), "/");
  await expect(youtube.blockButton("normal-video")).toBeVisible();
  await testInfo.attach("fixture-home-cleanup-before", {
    body: await extensionPage.screenshot({ fullPage: true }), contentType: "image/png"
  });

  await extensionStorage.set({ cfHideHomeAds: true });
  await expect(youtube.card("home-ad")).toBeHidden();
  for (let index = 0; index < promotionTags.length; index++) {
    await expect(youtube.card(`promotion-${index}`)).toBeVisible();
  }
  await testInfo.attach("fixture-home-cleanup-sponsored-hidden", {
    body: await extensionPage.screenshot({ fullPage: true }), contentType: "image/png"
  });
  await extensionStorage.set({ cfHideHomeAds: false, cfHideHomePromotions: true });
  await expect(youtube.card("home-ad")).toBeVisible();
  for (let index = 0; index < promotionTags.length; index++) {
    await expect(youtube.card(`promotion-${index}`)).toBeHidden();
  }
  await testInfo.attach("fixture-home-cleanup-promotions-hidden", {
    body: await extensionPage.screenshot({ fullPage: true }), contentType: "image/png"
  });
  await extensionStorage.set({ cfHideHomeAds: true });
  await expect(youtube.card("home-ad")).toBeHidden();
  for (const id of ["normal-video", "course-lockup", "ordinary-shelf", "shelf-video"]) {
    await expect(youtube.card(id)).toBeVisible();
  }
  await expect(youtube.blockButton("normal-video")).toBeVisible();
  expect((await extensionStorage.get<{ cfBlockedChannels: unknown[] }>("cfBlockedChannels")).cfBlockedChannels).toEqual([]);
});

test("hides only the promotion inside mixed sections containing normal recommendations", async ({
  extensionPage, extensionStorage
}) => {
  await extensionStorage.set({ cfHideHomeAds: true, cfHideHomePromotions: true });
  const youtube = new YouTubeSurfacePage(extensionPage);
  await youtube.open(home(`<ytd-rich-section-renderer data-testid="mixed-banner-section">
    <ytd-statement-banner-renderer data-testid="mixed-banner">Featured announcement</ytd-statement-banner-renderer>
    ${creatorCard({ id: "beside-banner", handle: "@besidebanner", displayName: "Normal Creator" })}
  </ytd-rich-section-renderer>
  <ytd-rich-section-renderer data-testid="mixed-ad-section"><div id="content">
    <ytd-display-ad-renderer data-testid="mixed-ad">Sponsored</ytd-display-ad-renderer>
    ${creatorCard({ id: "beside-ad", handle: "@besidead", displayName: "Another Creator" })}
  </div></ytd-rich-section-renderer>
  <ytd-rich-section-renderer data-testid="mixed-outer-section">
    <div id="content"><ytd-banner-promo-renderer data-testid="nested-banner">A promotion</ytd-banner-promo-renderer></div>
    ${creatorCard({ id: "outside-content", handle: "@outsidecontent", displayName: "Outside Creator" })}
  </ytd-rich-section-renderer>`), "/");
  await expect(youtube.card("mixed-banner")).toBeHidden();
  await expect(youtube.card("mixed-ad")).toBeHidden();
  await expect(youtube.card("nested-banner")).toBeHidden();
  for (const id of ["mixed-banner-section", "mixed-ad-section", "mixed-outer-section", "beside-banner", "beside-ad", "outside-content"]) {
    await expect(youtube.card(id)).toBeVisible();
  }
  await expect(youtube.blockButton("beside-banner")).toBeVisible();
  await expect(youtube.blockButton("beside-ad")).toBeVisible();
  await expect(youtube.blockButton("outside-content")).toBeVisible();
});

test("filters late promotions and releases a recycled advertisement slot when it becomes a normal card", async ({
  extensionPage, extensionStorage
}) => {
  await extensionStorage.set({ cfHideHomeAds: true, cfHideHomePromotions: true });
  const youtube = new YouTubeSurfacePage(extensionPage);
  await youtube.open(home(ordinaryContent()), "/");
  await extensionPage.locator("#home-contents").evaluate((element, markup) => {
    element.insertAdjacentHTML("beforeend", markup);
  }, promotedHomeCard("Late Advertiser", "late-ad") + promotions());
  await expect(youtube.card("late-ad")).toBeHidden();
  await expect(youtube.card("promotion-0")).toBeHidden();

  await youtube.card("late-ad").evaluate((slot) => {
    slot.innerHTML = `<a href="/watch?v=recycled">Normal recommendation</a>
      <ytd-channel-name><a href="/@recycledcreator">Recycled Creator</a></ytd-channel-name>`;
  });
  await expect(youtube.card("late-ad")).toBeVisible();
  await expect(youtube.blockButton("late-ad")).toBeVisible();
  await youtube.card("late-ad").evaluate((slot) => {
    slot.innerHTML = "<ytd-display-ad-renderer>Another advertisement</ytd-display-ad-renderer>";
  });
  await expect(youtube.card("late-ad")).toBeHidden();
  await expect(youtube.card("normal-video")).toBeVisible();
});

test("restores promotions when paused or leaving Home and reapplies saved preferences on return", async ({
  extensionPage, extensionStorage
}) => {
  await extensionStorage.set({ cfHideHomeAds: true, cfHideHomePromotions: true });
  const youtube = new YouTubeSurfacePage(extensionPage);
  await youtube.open(home(promotedHomeCard("Fixture Advertiser", "home-ad") + promotions()), "/");
  await expect(youtube.card("home-ad")).toBeHidden();
  await expect(youtube.card("promotion-0")).toBeHidden();
  await extensionStorage.set({ cfEnabled: false });
  await expect(youtube.card("home-ad")).toBeVisible();
  await expect(youtube.card("promotion-0")).toBeVisible();
  await extensionStorage.set({ cfEnabled: true });
  await expect(youtube.card("home-ad")).toBeHidden();

  for (const route of ["/results?search_query=fixture", "/watch?v=fixture", "/@example/videos", "/"]) {
    await extensionPage.evaluate((nextRoute) => {
      history.pushState({}, "", nextRoute);
      document.dispatchEvent(new Event("yt-navigate-finish"));
    }, route);
    if (route === "/") {
      await expect(youtube.card("home-ad")).toBeHidden();
      await expect(youtube.card("promotion-0")).toBeHidden();
    } else {
      await expect(youtube.card("home-ad")).toBeVisible();
      await expect(youtube.card("promotion-0")).toBeVisible();
    }
  }
});

test("keeps Home cleanup separate from the existing Hide Shorts preference", async ({
  extensionPage, extensionStorage
}) => {
  const youtube = new YouTubeSurfacePage(extensionPage);
  await youtube.open(home(promotedHomeCard("Fixture Advertiser", "home-ad") + promotions() + shortsShelf()), "/");
  await extensionStorage.set({ cfHideHomeAds: true, cfHideHomePromotions: true });
  await expect(youtube.card("home-ad")).toBeHidden();
  await expect(youtube.card("promotion-0")).toBeHidden();
  await expect(youtube.card("shorts-section")).toBeVisible();
  await expect(youtube.card("standalone-short")).toBeVisible();
  await extensionStorage.set({ cfHideHomeAds: false, cfHideHomePromotions: false, cfHideHomeShorts: true });
  await expect(youtube.card("home-ad")).toBeVisible();
  await expect(youtube.card("promotion-0")).toBeVisible();
  await expect(youtube.card("shorts-section")).toBeHidden();
  await expect(youtube.card("standalone-short")).toBeHidden();
  await expect(youtube.card("shorts-guide")).toBeVisible();
  await expect(youtube.card("regular-video")).toBeVisible();
});
