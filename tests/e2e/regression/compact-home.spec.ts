import { type Page } from "@playwright/test";
import { blockedCreator, expect, test } from "../fixtures/extension.fixture";
import { creatorCard } from "../fixtures/youtube-fixtures";
import { YouTubeSurfacePage } from "../pages/youtube-surface.page";

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
  test(`adapts all Home thumbnail sizes to available width${legacyRows ? " with legacy rows" : ""}`, async ({
    extensionPage, extensionStorage
  }, testInfo) => {
    await extensionStorage.set({ cfCompactHomeGrid: true });
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(feed(legacyRows), "/");
    const sizes = [
      { size: "small", columns: [6, 6, 3, 1] },
      { size: "medium", columns: [5, 4, 2, 1] },
      { size: "large", columns: [4, 4, 2, 1] }
    ];
    for (const { size, columns } of sizes) {
      await extensionStorage.set({ cfCompactHomeSize: size });
      await expect(extensionPage.locator("html")).toHaveAttribute("data-cf-home-size", size);
      for (const [index, width] of [2000, 1440, 900, 390].entries()) {
        await extensionPage.setViewportSize({ width, height: 1000 });
        await expectPackedCards(extensionPage, ids, columns[index]);
        if (!legacyRows && width === 2000) {
          await testInfo.attach(`fixture-home-thumbnail-size-${size}`, {
            body: await extensionPage.screenshot(), contentType: "image/png"
          });
        }
      }
    }
  });
}

test("packs blocked cards while keeping a Shorts shelf full-width and its cards unchanged", async ({
  extensionPage, extensionStorage
}) => {
  await extensionPage.setViewportSize({ width: 1920, height: 1000 });
  await extensionStorage.set({ cfCompactHomeGrid: true, cfCompactHomeSize: "small" });
  const youtube = new YouTubeSurfacePage(extensionPage);
  await youtube.open(feed(true, true), "/");
  await expectPackedCards(extensionPage, ids.slice(0, 6), 6);
  await expect(youtube.card("shelf-card")).toHaveCSS("width", "120px");
  const grid = await youtube.card("feed-grid").boundingBox();
  const shelf = await youtube.card("shorts-section").boundingBox();
  expect(shelf!.x).toBeCloseTo(grid!.x, 0);
  expect(shelf!.width).toBeCloseTo(grid!.width, 0);
  expect(shelf!.y - grid!.y).toBeCloseTo(rowStep, 0);
  await expectPackedCards(extensionPage, ids.slice(6), 6, rowStep + 120);

  await extensionStorage.set({ cfBlockedChannels: [blockedCreator("@creator-b", "Creator b")] });
  await expect(youtube.card("b")).toBeHidden();
  await expectPackedCards(extensionPage, ["a", "c", "d", "e", "f"], 6);
  await expectPackedCards(extensionPage, ids.slice(6), 6, rowStep + 120);

  await extensionStorage.set({ cfHideHomeShorts: true });
  await expect(youtube.card("shorts-section")).toBeHidden();
  await expectPackedCards(extensionPage, ids.filter((id) => id !== "b"), 6);
  await extensionStorage.set({ cfBlockedChannels: [], cfHideHomeShorts: false });
  await expect(youtube.card("shorts-section")).toBeVisible();
  await expectPackedCards(extensionPage, ids.slice(0, 6), 6);
  await expectPackedCards(extensionPage, ids.slice(6), 6, rowStep + 120);
  const continuation = await youtube.card("continuation").boundingBox();
  expect(continuation!.width).toBeCloseTo(grid!.width, 0);
});

test("restores native layout when disabled or paused and resumes the saved size", async ({
  extensionPage, extensionStorage
}) => {
  await extensionPage.setViewportSize({ width: 1920, height: 1000 });
  const youtube = new YouTubeSurfacePage(extensionPage);
  await youtube.open(feed(true), "/");
  await expectPackedCards(extensionPage, ids, 3);
  await extensionStorage.set({ cfCompactHomeGrid: true, cfCompactHomeSize: "small" });
  await expectPackedCards(extensionPage, ids, 6);
  await extensionPage.setViewportSize({ width: 390, height: 1000 });
  await expectPackedCards(extensionPage, ids, 1);
  await extensionPage.setViewportSize({ width: 1920, height: 1000 });
  await expectPackedCards(extensionPage, ids, 6);

  await extensionStorage.set({ cfEnabled: false });
  await expect(extensionPage.locator("html")).not.toHaveClass(/cf-compact-home-grid/);
  await expectPackedCards(extensionPage, ids, 3);
  await extensionStorage.set({ cfEnabled: true });
  await expectPackedCards(extensionPage, ids, 6);
  await extensionStorage.set({ cfCompactHomeGrid: false });
  await expectPackedCards(extensionPage, ids, 3);
});

test("uses Medium for an unknown saved size", async ({ extensionPage, extensionStorage }) => {
  await extensionPage.setViewportSize({ width: 1920, height: 1000 });
  await extensionStorage.set({ cfCompactHomeGrid: true, cfCompactHomeSize: "unknown-size" });
  const youtube = new YouTubeSurfacePage(extensionPage);
  await youtube.open(feed(), "/");
  await expect(extensionPage.locator("html")).toHaveAttribute("data-cf-home-size", "medium");
  await expectPackedCards(extensionPage, ids, 5);
});

for (const [route, pageType] of [["/watch?v=fixture", "watch"], ["/results?search_query=fixture", "search"], ["/@example/videos", "channel"]]) {
  test(`does not resize the ${pageType} layout`, async ({ extensionPage, extensionStorage }) => {
    await extensionPage.setViewportSize({ width: 1920, height: 1000 });
    await extensionStorage.set({ cfCompactHomeGrid: true, cfCompactHomeSize: "small" });
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(feed(false, false, pageType), route);
    await expect(extensionPage.locator("html")).not.toHaveClass(/cf-compact-home-grid/);
    await expectPackedCards(extensionPage, ids, 3);
  });
}

test("removes and reapplies the Home layout across in-page navigation", async ({ extensionPage, extensionStorage }) => {
  await extensionPage.setViewportSize({ width: 1920, height: 1000 });
  await extensionStorage.set({ cfCompactHomeGrid: true, cfCompactHomeSize: "small" });
  const youtube = new YouTubeSurfacePage(extensionPage);
  await youtube.open(feed(), "/");
  await expectPackedCards(extensionPage, ids, 6);
  for (const route of ["/results?search_query=fixture", "/"]) {
    await extensionPage.evaluate((nextRoute) => {
      history.pushState({}, "", nextRoute);
      document.dispatchEvent(new Event("yt-navigate-finish"));
    }, route);
    await expectPackedCards(extensionPage, ids, route === "/" ? 6 : 3);
  }
});
