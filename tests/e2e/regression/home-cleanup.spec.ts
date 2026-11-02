import { expect, test } from "../fixtures/extension.fixture";
import { courseLockup, creatorCard, promotedHomeCard, shortsShelf } from "../fixtures/youtube-fixtures";
import { YouTubeSurfacePage } from "../pages/youtube-surface.page";

const promotionTags = [
  "ytd-statement-banner-renderer", "ytd-banner-promo-renderer",
  "ytd-brand-video-shelf-renderer", "ytd-brand-video-singleton-renderer",
  "ytd-primetime-promo-renderer", "ytd-inline-survey-renderer",
  "ytd-chips-shelf-with-video-shelf-renderer", "ytd-feed-nudge-renderer"
];
const featureIds = promotionTags.map((_, index) => `promotion-${index}`).concat([
  "explore-topics", "playables-modern", "playables-legacy", "playables-linked", "game-card-slot"
]);

function home(contents: string): string {
  return `<style>
    ytd-browse, ytd-rich-grid-renderer { display: block; }
    ${promotionTags.join(",")}, ytd-display-ad-renderer, ytd-ad-slot-renderer {
      display: block; padding: 12px;
    }
  </style><ytd-browse page-subtype="home">
    <ytd-feed-filter-chip-bar-renderer data-testid="category-chipbar">
      <yt-chip-cloud-renderer><yt-chip-cloud-chip-renderer>Explore more topics</yt-chip-cloud-chip-renderer></yt-chip-cloud-renderer>
    </ytd-feed-filter-chip-bar-renderer><ytd-rich-grid-renderer>
    <div id="home-contents">${contents}</div>
  </ytd-rich-grid-renderer></ytd-browse>`;
}

function promotions(): string {
  return promotionTags.map((tag, index) => `<ytd-rich-section-renderer data-testid="promotion-${index}">
    <div id="content"><${tag}>${index % 2 ? "더 많은 주제 탐색" : "YouTube featured announcement"} ${index}</${tag}></div>
  </ytd-rich-section-renderer>`).join("") + `
  <ytd-rich-section-renderer data-testid="explore-topics"><div id="content">
    <ytd-rich-shelf-renderer><h2>もっと見る</h2>
      <yt-chips-shelf-view-model class="ytChipsShelfViewModelHost"><a href="/results?search_query=music">Music</a></yt-chips-shelf-view-model>
    </ytd-rich-shelf-renderer>
  </div></ytd-rich-section-renderer>
  <ytd-rich-section-renderer data-testid="playables-modern">
    <mini-game-card-view-model>Play a game</mini-game-card-view-model>
  </ytd-rich-section-renderer>
  <ytd-rich-section-renderer data-testid="playables-legacy">
    <ytd-mini-game-card-view-model>게임</ytd-mini-game-card-view-model>
  </ytd-rich-section-renderer>
  <ytd-rich-section-renderer data-testid="playables-linked"><ytd-rich-shelf-renderer>
    <h2><a href="/playables">Jogos</a></h2><div>Game choices</div>
  </ytd-rich-shelf-renderer></ytd-rich-section-renderer>
  <ytd-rich-item-renderer data-testid="game-card-slot"><div id="content">
    <mini-game-card-view-model>Another game</mini-game-card-view-model>
  </div></ytd-rich-item-renderer>`;
}

function ordinaryContent(): string {
  return creatorCard({
    id: "normal-video", handle: "@ordinary", displayName: "Ordinary Creator",
    title: "Explore more topics · 더 많은 주제 탐색 · Playables · Premium"
  }) + courseLockup("Course Teacher") + `<ytd-rich-section-renderer data-testid="ordinary-shelf">
    <ytd-rich-shelf-renderer has-paygated-featured-badge><h2>Explore more topics</h2>${creatorCard({
      id: "shelf-video", handle: "@shelfcreator", displayName: "Shelf Creator"
    })}<a data-testid="ordinary-mix" href="/watch?v=mix&amp;list=RDmix">A recommended mix</a></ytd-rich-shelf-renderer>
  </ytd-rich-section-renderer>`;
}

test("leaves Home advertisements and optional YouTube features visible by default", async ({
  extensionPage, extensionStorage
}) => {
  const youtube = new YouTubeSurfacePage(extensionPage);
  await youtube.open(home(promotedHomeCard("Fixture Advertiser", "home-ad") + promotions() + ordinaryContent()), "/");
  await expect(youtube.card("home-ad")).toBeVisible();
  await expect(youtube.card("home-ad").locator(".cf-block-button")).toHaveCount(0);
  for (const id of featureIds) {
    await expect(youtube.card(id)).toBeVisible();
    await expect(youtube.card(id).locator(".cf-block-button")).toHaveCount(0);
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

test("filters sponsored cards and YouTube features independently without matching translated titles", async ({
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
  for (const id of featureIds) {
    await expect(youtube.card(id)).toBeVisible();
  }
  await testInfo.attach("fixture-home-cleanup-sponsored-hidden", {
    body: await extensionPage.screenshot({ fullPage: true }), contentType: "image/png"
  });
  await extensionStorage.set({ cfHideHomeAds: false, cfHideHomePromotions: true });
  await expect(youtube.card("home-ad")).toBeVisible();
  for (const id of featureIds) {
    await expect(youtube.card(id)).toBeHidden();
  }
  await testInfo.attach("fixture-home-cleanup-promotions-hidden", {
    body: await extensionPage.screenshot({ fullPage: true }), contentType: "image/png"
  });
  await extensionStorage.set({ cfHideHomeAds: true });
  await expect(youtube.card("home-ad")).toBeHidden();
  for (const id of ["normal-video", "course-lockup", "ordinary-shelf", "shelf-video", "ordinary-mix", "category-chipbar"]) {
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
  for (const id of featureIds) {
    await expect(youtube.card(id)).toBeHidden();
  }

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

test("restores an Explore section when YouTube recycles it into ordinary recommendations", async ({
  extensionPage, extensionStorage
}) => {
  await extensionStorage.set({ cfHideHomePromotions: true });
  const youtube = new YouTubeSurfacePage(extensionPage);
  await youtube.open(home(promotions()), "/");
  const section = youtube.card("explore-topics");
  await expect(section).toBeHidden();
  const original = await section.innerHTML();
  await section.evaluate((element, markup) => { element.innerHTML = markup; }, creatorCard({
    id: "recycled-video", handle: "@recycledtopics", displayName: "Ordinary Creator"
  }));
  await expect(section).toBeVisible();
  await expect(youtube.blockButton("recycled-video")).toBeVisible();
  await section.evaluate((element, markup) => { element.innerHTML = markup; }, original);
  await expect(section).toBeHidden();
  await expect(youtube.card("category-chipbar")).toBeVisible();
});

test("hides attached feedback surveys without hiding the video or its creator controls", async ({
  extensionPage, extensionStorage
}) => {
  await extensionStorage.set({ cfHideHomePromotions: true });
  const youtube = new YouTubeSurfacePage(extensionPage);
  const card = creatorCard({ id: "survey-video", handle: "@surveycreator", displayName: "Survey Creator" })
    .replace("</ytd-rich-item-renderer>", `<div id="attached-survey" data-testid="attached-survey">
      <ytd-inline-survey-renderer>How was this recommendation?</ytd-inline-survey-renderer>
    </div></ytd-rich-item-renderer>`);
  await youtube.open(home(card), "/");
  await expect(youtube.card("attached-survey")).toBeHidden();
  await expect(youtube.card("survey-video")).toBeVisible();
  await expect(youtube.blockButton("survey-video")).toBeVisible();
  await youtube.blockButton("survey-video").click();
  await expect(youtube.card("survey-video")).toBeHidden();
  await extensionPage.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(youtube.card("survey-video")).toBeVisible();
  await expect(youtube.card("attached-survey")).toBeHidden();
  await extensionStorage.set({ cfHideHomePromotions: false });
  await expect(youtube.card("attached-survey")).toBeVisible();
});

test("restores promotions when paused or leaving Home and reapplies saved preferences on return", async ({
  extensionPage, extensionStorage
}) => {
  await extensionStorage.set({ cfHideHomeAds: true, cfHideHomePromotions: true });
  const youtube = new YouTubeSurfacePage(extensionPage);
  await youtube.open(home(promotedHomeCard("Fixture Advertiser", "home-ad") + promotions()), "/");
  await expect(youtube.card("home-ad")).toBeHidden();
  await expect(youtube.card("promotion-0")).toBeHidden();
  await expect(youtube.card("explore-topics")).toBeHidden();
  await expect(youtube.card("playables-modern")).toBeHidden();
  await extensionStorage.set({ cfEnabled: false });
  await expect(youtube.card("home-ad")).toBeVisible();
  await expect(youtube.card("promotion-0")).toBeVisible();
  await expect(youtube.card("explore-topics")).toBeVisible();
  await expect(youtube.card("playables-modern")).toBeVisible();
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
      await expect(youtube.card("explore-topics")).toBeHidden();
      await expect(youtube.card("playables-modern")).toBeHidden();
    } else {
      await expect(youtube.card("home-ad")).toBeVisible();
      await expect(youtube.card("promotion-0")).toBeVisible();
      await expect(youtube.card("explore-topics")).toBeVisible();
      await expect(youtube.card("playables-modern")).toBeVisible();
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
