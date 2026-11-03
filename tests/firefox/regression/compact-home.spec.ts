import type { Page } from "puppeteer-core";
import { expect, test, expectVisible, expectAttribute, expectCSS, openFixture } from "../extension.fixture";
import { blockedCreator } from "../../e2e/fixtures/extension.fixture";
import { creatorCard } from "../../e2e/fixtures/youtube-fixtures";

const byTestId = (id: string): string => `[data-testid="${id}"]`;

const ids = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"];
const cardHeight = 160;
const columnGap = 16;
const rowStep = 184;

function feed(legacyRows = false, withShelf = false, pageType = "home"): string {
  const cards = ids.map((id) => creatorCard({ id, handle: `@creator-${id}`, displayName: `Creator ${id}` }));
  const group = (start: number, end: number) => {
    const content = cards.slice(start, end).join("");
    return legacyRows ? `<ytd-rich-grid-row><div id="contents">${content}</div></ytd-rich-grid-row>` : content;
  };
  const shelf = withShelf ? `<ytd-rich-section-renderer data-testid="shorts-section">
    <ytd-rich-shelf-renderer is-shorts><h2>Shorts</h2>
      <ytd-rich-item-renderer data-testid="shelf-card"><a href="/shorts/fixture">A Short</a></ytd-rich-item-renderer>
    </ytd-rich-shelf-renderer>
  </ytd-rich-section-renderer>` : "";
  // Model native three-column cells, including old row wrappers. Assertions
  // below check positions and restoration, not just our CSS declarations.
  return `<style>
    body { margin: 16px; }
    ytd-browse, ytd-rich-grid-renderer { display: block; width: 100%; }
    ytd-rich-grid-renderer > #contents { display: flex; flex-wrap: wrap; gap: 24px 16px; }
    ytd-rich-grid-row { display: block; width: 100%; }
    ytd-rich-grid-row > #contents { display: flex; gap: 16px; }
    ytd-rich-item-renderer {
      box-sizing: border-box; flex: 0 0 auto; width: calc((100% - 32px) / 3);
      height: ${cardHeight}px; margin: 0; padding: 6px;
    }
    ytd-rich-item-renderer h3 { margin: 6px 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
    ytd-rich-section-renderer { box-sizing: border-box; flex: 0 0 100%; height: 96px; margin: 0; padding: 0; }
    [data-testid="shelf-card"] { width: 120px; height: 48px; }
    ytd-rich-shelf-renderer h2 { margin: 0; }
    ytd-continuation-item-renderer { display: block; height: 20px; }
  </style>
  <ytd-browse page-subtype="${pageType}"><ytd-rich-grid-renderer data-testid="feed-grid"><div id="contents">
    ${group(0, 3)}${group(3, 6)}${shelf}${group(6, 9)}${group(9, 12)}
    <ytd-continuation-item-renderer data-testid="continuation"></ytd-continuation-item-renderer>
  </div></ytd-rich-grid-renderer></ytd-browse>`;
}

async function expectPackedCards(page: Page, expectedIds: string[], columns: number, topOffset = 0): Promise<void> {
  await expect.poll(() => page.evaluate(({ expected, columnCount, top, height, gap, row }) => {
    const grid = document.querySelector('[data-testid="feed-grid"] > #contents')!.getBoundingClientRect();
    const cardWidth = (grid.width - (columnCount - 1) * gap) / columnCount;
    const near = (actual: number, wanted: number) => Math.abs(actual - wanted) < 1;
    return expected.every((id, index) => {
      const card = document.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect();
      return near(card.x - grid.x, (index % columnCount) * (cardWidth + gap)) &&
        near(card.y - grid.y, top + Math.floor(index / columnCount) * row) &&
        near(card.width, cardWidth) && near(card.height, height);
    });
  }, { expected: expectedIds, columnCount: columns, top: topOffset, height: cardHeight, gap: columnGap, row: rowStep }), {
    message: `Visible cards occupy consecutive ${columns}-column slots`
  }).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
}

for (const legacyRows of [false, true]) {
  test(`adapts all Home thumbnail sizes to available width${legacyRows ? " with legacy rows" : ""}`, async ({ addon }, testInfo) => {
    const page = addon.page;
    await addon.setStorage({ cfCompactHomeGrid: true });
    await openFixture(page, feed(legacyRows), "/");
    const sizes = [
      { size: "small", columns: [6, 6, 3, 1] },
      { size: "medium", columns: [5, 4, 2, 1] },
      { size: "large", columns: [4, 4, 2, 1] }
    ];
    for (const { size, columns } of sizes) {
      await addon.setStorage({ cfCompactHomeSize: size });
      await expectAttribute(page, "html", "data-cf-home-size", size);
      for (const [index, width] of [2000, 1440, 900, 390].entries()) {
        await page.setViewport({ width, height: 1000 });
        await expectPackedCards(page, ids, columns[index]);
        if (!legacyRows && width === 2000) {
          await testInfo.attach(`fixture-home-thumbnail-size-${size}`, {
            body: Buffer.from(await page.screenshot()), contentType: "image/png"
          });
        }
      }
    }
  });
}

test("packs blocked cards while keeping a Shorts shelf full-width and its cards unchanged", async ({ addon }) => {
  const page = addon.page;
  await page.setViewport({ width: 1920, height: 1000 });
  await addon.setStorage({ cfCompactHomeGrid: true, cfCompactHomeSize: "small" });
  await openFixture(page, feed(true, true), "/");
  await expectPackedCards(page, ids.slice(0, 6), 6);
  await expectCSS(page, byTestId("shelf-card"), "width", "120px");
  const grid = await page.$eval(byTestId("feed-grid"), element => { const { x, y, width, height } = element.getBoundingClientRect(); return { x, y, width, height }; });
  const shelf = await page.$eval(byTestId("shorts-section"), element => { const { x, y, width, height } = element.getBoundingClientRect(); return { x, y, width, height }; });
  expect(shelf.x).toBeCloseTo(grid.x, 0);
  expect(shelf.width).toBeCloseTo(grid.width, 0);
  expect(shelf.y - grid.y).toBeCloseTo(rowStep, 0);
  await expectPackedCards(page, ids.slice(6), 6, rowStep + 120);

  await addon.setStorage({ cfBlockedChannels: [blockedCreator("@creator-b", "Creator b")] });
  await expectVisible(page, byTestId("b"), false);
  await expectPackedCards(page, ["a", "c", "d", "e", "f"], 6);
  await expectPackedCards(page, ids.slice(6), 6, rowStep + 120);

  await addon.setStorage({ cfHideHomeShorts: true });
  await expectVisible(page, byTestId("shorts-section"), false);
  await expectPackedCards(page, ids.filter((id) => id !== "b"), 6);
  await addon.setStorage({ cfBlockedChannels: [], cfHideHomeShorts: false });
  await expectVisible(page, byTestId("shorts-section"));
  await expectPackedCards(page, ids.slice(0, 6), 6);
  await expectPackedCards(page, ids.slice(6), 6, rowStep + 120);
  const continuation = await page.$eval(byTestId("continuation"), element => { const { x, y, width, height } = element.getBoundingClientRect(); return { x, y, width, height }; });
  expect(continuation.width).toBeCloseTo(grid.width, 0);
});

test("restores native layout when disabled or paused and resumes the saved size", async ({ addon }) => {
  const page = addon.page;
  await page.setViewport({ width: 1920, height: 1000 });
  await openFixture(page, feed(true), "/");
  await expectPackedCards(page, ids, 3);
  await addon.setStorage({ cfCompactHomeGrid: true, cfCompactHomeSize: "small" });
  await expectPackedCards(page, ids, 6);
  await page.setViewport({ width: 390, height: 1000 });
  await expectPackedCards(page, ids, 1);
  await page.setViewport({ width: 1920, height: 1000 });
  await expectPackedCards(page, ids, 6);

  await addon.setStorage({ cfEnabled: false });
  await expect.poll(() => page.$eval("html", element => element.className)).not.toMatch(/cf-compact-home-grid/);
  await expectPackedCards(page, ids, 3);
  await addon.setStorage({ cfEnabled: true });
  await expectPackedCards(page, ids, 6);
  await addon.setStorage({ cfCompactHomeGrid: false });
  await expectPackedCards(page, ids, 3);
});

test("uses Medium for an unknown saved size", async ({ addon }) => {
  const page = addon.page;
  await page.setViewport({ width: 1920, height: 1000 });
  await addon.setStorage({ cfCompactHomeGrid: true, cfCompactHomeSize: "unknown-size" });
  await openFixture(page, feed(), "/");
  await expectAttribute(page, "html", "data-cf-home-size", "medium");
  await expectPackedCards(page, ids, 5);
});

for (const [route, pageType] of [["/watch?v=fixture", "watch"], ["/results?search_query=fixture", "search"], ["/@example/videos", "channel"]]) {
  test(`does not resize the ${pageType} layout`, async ({ addon }) => {
    const page = addon.page;
    await page.setViewport({ width: 1920, height: 1000 });
    await addon.setStorage({ cfCompactHomeGrid: true, cfCompactHomeSize: "small" });
    await openFixture(page, feed(false, false, pageType), route);
    await expect.poll(() => page.$eval("html", element => element.className)).not.toMatch(/cf-compact-home-grid/);
    await expectPackedCards(page, ids, 3);
  });
}

test("removes and reapplies the Home layout across in-page navigation", async ({ addon }) => {
  const page = addon.page;
  await page.setViewport({ width: 1920, height: 1000 });
  await addon.setStorage({ cfCompactHomeGrid: true, cfCompactHomeSize: "small" });
  await openFixture(page, feed(), "/");
  await expectPackedCards(page, ids, 6);
  for (const route of ["/results?search_query=fixture", "/"]) {
    await page.evaluate((nextRoute) => {
      history.pushState({}, "", nextRoute);
      document.dispatchEvent(new Event("yt-navigate-finish"));
    }, route);
    await expectPackedCards(page, ids, route === "/" ? 6 : 3);
  }
});
