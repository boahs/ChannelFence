import { expect, test, expectVisible, expectCount, openFixture } from "../extension.fixture";
import { courseLockup, creatorCard, promotedHomeCard, shortsShelf } from "../../e2e/fixtures/youtube-fixtures";

const byTestId = (id: string): string => `[data-testid="${id}"]`;

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

test("leaves Home advertisements and optional YouTube features visible by default", async ({ addon }) => {
  const page = addon.page;
  await openFixture(page, home(promotedHomeCard("Fixture Advertiser", "home-ad") + promotions() + ordinaryContent()), "/");
  await expectVisible(page, byTestId("home-ad"));
  await expectCount(page, byTestId("home-ad") + " .cf-block-button", 0);
  for (const id of featureIds) {
    await expectVisible(page, byTestId(id));
    await expectCount(page, byTestId(id) + " .cf-block-button", 0);
  }
  await expectVisible(page, byTestId("normal-video") + " .cf-block-button");
  await expectVisible(page, byTestId("course-lockup"));
  await expectVisible(page, byTestId("ordinary-shelf"));
  const values = await addon.getStorage<{ cfHideHomeAds?: boolean; cfHideHomePromotions?: boolean }>(
    ["cfHideHomeAds", "cfHideHomePromotions"]
  );
  expect(values.cfHideHomeAds).not.toBe(true);
  expect(values.cfHideHomePromotions).not.toBe(true);
});

test("filters sponsored cards and YouTube features independently without matching translated titles", async ({ addon }, testInfo) => {
  const page = addon.page;
  await openFixture(page, home(promotedHomeCard("Fixture Advertiser", "home-ad") + promotions() + ordinaryContent()), "/");
  await expectVisible(page, byTestId("normal-video") + " .cf-block-button");
  await testInfo.attach("fixture-home-cleanup-before", {
    body: Buffer.from(await page.screenshot({ fullPage: true })), contentType: "image/png"
  });

  await addon.setStorage({ cfHideHomeAds: true });
  await expectVisible(page, byTestId("home-ad"), false);
  for (const id of featureIds) {
    await expectVisible(page, byTestId(id));
  }
  await testInfo.attach("fixture-home-cleanup-sponsored-hidden", {
    body: Buffer.from(await page.screenshot({ fullPage: true })), contentType: "image/png"
  });
  await addon.setStorage({ cfHideHomeAds: false, cfHideHomePromotions: true });
  await expectVisible(page, byTestId("home-ad"));
  for (const id of featureIds) {
    await expectVisible(page, byTestId(id), false);
  }
  await testInfo.attach("fixture-home-cleanup-promotions-hidden", {
    body: Buffer.from(await page.screenshot({ fullPage: true })), contentType: "image/png"
  });
  await addon.setStorage({ cfHideHomeAds: true });
  await expectVisible(page, byTestId("home-ad"), false);
  for (const id of ["normal-video", "course-lockup", "ordinary-shelf", "shelf-video", "ordinary-mix", "category-chipbar"]) {
    await expectVisible(page, byTestId(id));
  }
  await expectVisible(page, byTestId("normal-video") + " .cf-block-button");
  expect((await addon.getStorage<{ cfBlockedChannels: unknown[] }>("cfBlockedChannels")).cfBlockedChannels).toEqual([]);
});

test("hides only the promotion inside mixed sections containing normal recommendations", async ({ addon }) => {
  const page = addon.page;
  await addon.setStorage({ cfHideHomeAds: true, cfHideHomePromotions: true });
  await openFixture(page, home(`<ytd-rich-section-renderer data-testid="mixed-banner-section">
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
  await expectVisible(page, byTestId("mixed-banner"), false);
  await expectVisible(page, byTestId("mixed-ad"), false);
  await expectVisible(page, byTestId("nested-banner"), false);
  for (const id of ["mixed-banner-section", "mixed-ad-section", "mixed-outer-section", "beside-banner", "beside-ad", "outside-content"]) {
    await expectVisible(page, byTestId(id));
  }
  await expectVisible(page, byTestId("beside-banner") + " .cf-block-button");
  await expectVisible(page, byTestId("beside-ad") + " .cf-block-button");
  await expectVisible(page, byTestId("outside-content") + " .cf-block-button");
});

test("filters late promotions and releases a recycled advertisement slot when it becomes a normal card", async ({ addon }) => {
  const page = addon.page;
  await addon.setStorage({ cfHideHomeAds: true, cfHideHomePromotions: true });
  await openFixture(page, home(ordinaryContent()), "/");
  await page.$eval("#home-contents", (element, markup) => {
    element.insertAdjacentHTML("beforeend", markup);
  }, promotedHomeCard("Late Advertiser", "late-ad") + promotions());
  await expectVisible(page, byTestId("late-ad"), false);
  for (const id of featureIds) {
    await expectVisible(page, byTestId(id), false);
  }

  await page.$eval(byTestId("late-ad"), (slot) => {
    slot.innerHTML = `<a href="/watch?v=recycled">Normal recommendation</a>
      <ytd-channel-name><a href="/@recycledcreator">Recycled Creator</a></ytd-channel-name>`;
  });
  await expectVisible(page, byTestId("late-ad"));
  await expectVisible(page, byTestId("late-ad") + " .cf-block-button");
  await page.$eval(byTestId("late-ad"), (slot) => {
    slot.innerHTML = "<ytd-display-ad-renderer>Another advertisement</ytd-display-ad-renderer>";
  });
  await expectVisible(page, byTestId("late-ad"), false);
  await expectVisible(page, byTestId("normal-video"));
});

test("restores an Explore section when YouTube recycles it into ordinary recommendations", async ({ addon }) => {
  const page = addon.page;
  await addon.setStorage({ cfHideHomePromotions: true });
  await openFixture(page, home(promotions()), "/");
  const section = byTestId("explore-topics");
  await expectVisible(page, section, false);
  const original = await page.$eval(section, element => element.innerHTML);
  await page.$eval(section, (element, markup) => { element.innerHTML = markup; }, creatorCard({
    id: "recycled-video", handle: "@recycledtopics", displayName: "Ordinary Creator"
  }));
  await expectVisible(page, section);
  await expectVisible(page, byTestId("recycled-video") + " .cf-block-button");
  await page.$eval(section, (element, markup) => { element.innerHTML = markup; }, original);
  await expectVisible(page, section, false);
  await expectVisible(page, byTestId("category-chipbar"));
});

test("hides attached feedback surveys without hiding the video or its creator controls", async ({ addon }) => {
  const page = addon.page;
  await addon.setStorage({ cfHideHomePromotions: true });
  const card = creatorCard({ id: "survey-video", handle: "@surveycreator", displayName: "Survey Creator" })
    .replace("</ytd-rich-item-renderer>", `<div id="attached-survey" data-testid="attached-survey">
      <ytd-inline-survey-renderer>How was this recommendation?</ytd-inline-survey-renderer>
    </div></ytd-rich-item-renderer>`);
  await openFixture(page, home(card), "/");
  await expectVisible(page, byTestId("attached-survey"), false);
  await expectVisible(page, byTestId("survey-video"));
  await expectVisible(page, byTestId("survey-video") + " .cf-block-button");
  await page.locator(byTestId("survey-video") + " .cf-block-button").click();
  await expectVisible(page, byTestId("survey-video"), false);
  await page.locator("#cf-toast button").click();
  await expectVisible(page, byTestId("survey-video"));
  await expectVisible(page, byTestId("attached-survey"), false);
  await addon.setStorage({ cfHideHomePromotions: false });
  await expectVisible(page, byTestId("attached-survey"));
});

test("restores promotions when paused or leaving Home and reapplies saved preferences on return", async ({ addon }) => {
  const page = addon.page;
  await addon.setStorage({ cfHideHomeAds: true, cfHideHomePromotions: true });
  await openFixture(page, home(promotedHomeCard("Fixture Advertiser", "home-ad") + promotions()), "/");
  await expectVisible(page, byTestId("home-ad"), false);
  await expectVisible(page, byTestId("promotion-0"), false);
  await expectVisible(page, byTestId("explore-topics"), false);
  await expectVisible(page, byTestId("playables-modern"), false);
  await addon.setStorage({ cfEnabled: false });
  await expectVisible(page, byTestId("home-ad"));
  await expectVisible(page, byTestId("promotion-0"));
  await expectVisible(page, byTestId("explore-topics"));
  await expectVisible(page, byTestId("playables-modern"));
  await addon.setStorage({ cfEnabled: true });
  await expectVisible(page, byTestId("home-ad"), false);

  for (const route of ["/results?search_query=fixture", "/watch?v=fixture", "/@example/videos", "/"]) {
    await page.evaluate((nextRoute) => {
      history.pushState({}, "", nextRoute);
      document.dispatchEvent(new Event("yt-navigate-finish"));
    }, route);
    if (route === "/") {
      await expectVisible(page, byTestId("home-ad"), false);
      await expectVisible(page, byTestId("promotion-0"), false);
      await expectVisible(page, byTestId("explore-topics"), false);
      await expectVisible(page, byTestId("playables-modern"), false);
    } else {
      await expectVisible(page, byTestId("home-ad"));
      await expectVisible(page, byTestId("promotion-0"));
      await expectVisible(page, byTestId("explore-topics"));
      await expectVisible(page, byTestId("playables-modern"));
    }
  }
});

test("keeps Home cleanup separate from the existing Hide Shorts preference", async ({ addon }) => {
  const page = addon.page;
  await openFixture(page, home(promotedHomeCard("Fixture Advertiser", "home-ad") + promotions() + shortsShelf()), "/");
  await addon.setStorage({ cfHideHomeAds: true, cfHideHomePromotions: true });
  await expectVisible(page, byTestId("home-ad"), false);
  await expectVisible(page, byTestId("promotion-0"), false);
  await expectVisible(page, byTestId("shorts-section"));
  await expectVisible(page, byTestId("standalone-short"));
  await addon.setStorage({ cfHideHomeAds: false, cfHideHomePromotions: false, cfHideHomeShorts: true });
  await expectVisible(page, byTestId("home-ad"));
  await expectVisible(page, byTestId("promotion-0"));
  await expectVisible(page, byTestId("shorts-section"), false);
  await expectVisible(page, byTestId("standalone-short"), false);
  await expectVisible(page, byTestId("shorts-guide"));
  await expectVisible(page, byTestId("regular-video"));
});
