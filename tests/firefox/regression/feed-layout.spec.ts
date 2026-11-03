import { type Page } from "puppeteer-core";
import { blockedCreator, expect, expectVisible, expectCount, openFixture, test } from "../extension.fixture";
import { creatorCard, promotedHomeCard, rightRailLockup } from "../../e2e/fixtures/youtube-fixtures";

const cardWidth = 216;
const cardHeight = 160;
const columnStep = 228;
const rowStep = 184;
const gridWidth = columnStep * 3;
const expandedByline = "Business Insider and Insider Food and Insider";
const collapsedByline = "Business Insider and 2 more";
const originalOrder = ["a", "collaboration", "c", "d", "e", "f", "g", "h", "i"];
const blockedOrder = originalOrder.filter((id) => id !== "collaboration");

function collaborationCard(): string {
  return `<ytd-rich-item-renderer data-testid="collaboration">
    <yt-lockup-view-model class="yt-lockup-view-model" data-testid="collaboration-lockup">
      <a class="thumbnail" href="/watch?v=collaboration">Collaboration video</a>
      <div class="ytLockupViewModelMetadata">
        <yt-lockup-metadata-view-model>
          <div class="ytLockupMetadataViewModelAvatar">
            <yt-avatar-stack-view-model aria-label="Collaboration channels"></yt-avatar-stack-view-model>
          </div>
          <div class="ytLockupMetadataViewModelTextContainer">
            <h3>A collaboration video</h3>
            <div class="ytLockupMetadataViewModelMetadata">
              <div class="ytContentMetadataViewModelMetadataRow">
                <span class="ytContentMetadataViewModelMetadataText" role="text" data-testid="collaboration-byline">${expandedByline}</span>
              </div>
              <div class="ytContentMetadataViewModelMetadataRow"><span role="text">100K views</span></div>
            </div>
          </div>
        </yt-lockup-metadata-view-model>
      </div>
    </yt-lockup-view-model>
  </ytd-rich-item-renderer>`;
}

function row(ids: string[]): string {
  return `<ytd-rich-grid-row><div id="contents">${ids.map((id) => id === "collaboration"
    ? collaborationCard()
    : creatorCard({ id, displayName: `Allowed ${id}`, handle: `@allowed-${id}` })
  ).join("")}</div></ytd-rich-grid-row>`;
}

function feedMarkup(contents: string): string {
  // YouTube's legacy home layout partitions cards into row wrappers. Hiding a
  // card inside one row does not let cards in later rows fill its vacant slot.
  // Fixed geometry makes this regression observable instead of only checking
  // whether the blocked card itself is hidden.
  return `<style>
    ytd-rich-grid-renderer {
      display: block;
      width: ${gridWidth}px;
      --ytd-rich-grid-items-per-row: 3;
      --ytd-rich-grid-item-margin: 12px;
      --ytd-rich-grid-item-max-width: ${cardWidth}px;
    }
    ytd-rich-grid-renderer > #contents { display: flex; flex-wrap: wrap; }
    ytd-rich-grid-row { display: block; width: 100%; }
    ytd-rich-grid-row > #contents { display: flex; }
    ytd-rich-grid-renderer ytd-rich-item-renderer {
      box-sizing: border-box;
      flex: 0 0 auto;
      width: ${cardWidth}px;
      height: ${cardHeight}px;
      margin: 0 6px 24px;
      padding: 6px;
      overflow: hidden;
    }
    ytd-rich-grid-renderer yt-lockup-view-model { border: 0; padding: 0; margin: 0; }
    ytd-rich-grid-renderer h3 { margin: 6px 0; }
    ytd-rich-grid-renderer ytd-rich-section-renderer {
      box-sizing: border-box;
      flex: 0 0 100%;
      width: 100%;
      height: 96px;
      margin: 0 0 24px;
      padding: 0;
    }
  </style>
  <ytd-rich-grid-renderer data-testid="feed-grid"><div id="contents">${contents}</div></ytd-rich-grid-renderer>`;
}

function feed(withShelf = false): string {
  return feedMarkup([
    row(originalOrder.slice(0, 3)),
    row(originalOrder.slice(3, 6)),
    withShelf ? `<ytd-rich-section-renderer data-testid="wide-section"><h2>A full-width shelf</h2></ytd-rich-section-renderer>` : "",
    row(originalOrder.slice(6, 9))
  ].join(""));
}

const directOrder = ["direct-a", "direct-blocked", "direct-c", "direct-d", "direct-e", "direct-f"];
const directBlockedOrder = directOrder.filter((id) => id !== "direct-blocked");

function directFeed(): string {
  // Current Home cards use a fixed-width outer cell and a #content wrapper.
  // The inner lockup exposes its owner without any creator href. Hiding only
  // that inner lockup leaves the outer cell occupying a completely blank slot.
  return feedMarkup(directOrder.map((id) => `<ytd-rich-item-renderer data-testid="${id}">
    <div id="content">${rightRailLockup({
      id: `${id}-lockup`,
      displayName: id === "direct-blocked" ? "Ordinary Creator" : `Allowed ${id}`
    }).replace("ytd-item-section-renderer", "ytd-rich-grid-renderer")}</div>
  </ytd-rich-item-renderer>`).join(""));
}

async function expectPackedCards(page: Page, ids: string[], topOffset = 0): Promise<void> {
  await expect.poll(async () => page.evaluate(({ expectedIds, expectedTop, width, height, column, rowHeight }) => {
    const grid = document.querySelector('[data-testid="feed-grid"]')!.getBoundingClientRect();
    return expectedIds.every((id, index) => {
      const card = document.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect();
      const near = (actual: number, expected: number) => Math.abs(actual - expected) < 1;
      return near(card.x - grid.x, 6 + (index % 3) * column) &&
        near(card.y - grid.y, expectedTop + Math.floor(index / 3) * rowHeight) &&
        near(card.width, width) && near(card.height, height);
    });
  }, {
    expectedIds: ids,
    expectedTop: topOffset,
    width: cardWidth,
    height: cardHeight,
    column: columnStep,
    rowHeight: rowStep
  }), { message: `Cards should occupy consecutive three-column slots: ${ids.join(", ")}` }).toBe(true);
}

async function replaceByline(page: Page, label: string): Promise<void> {
  await page.$eval('[data-testid="collaboration-byline"]', async (element, value) => {
    element.textContent = value;
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  }, label);
}

test.describe("Home feed layout after creator blocking", () => {
  for (const insert of [
    { name: "sponsored card", setting: "cfHideHomeAds", markup: promotedHomeCard("Fixture Advertiser", "home-insert") },
    { name: "recommendation prompt", setting: "cfHideHomePromotions", markup: `<ytd-rich-item-renderer data-testid="home-insert">
      <ytd-feed-nudge-renderer>Looking for something different?</ytd-feed-nudge-renderer></ytd-rich-item-renderer>` },
    { name: "Playables card", setting: "cfHideHomePromotions", markup: `<ytd-rich-item-renderer data-testid="home-insert"><div id="content">
      <mini-game-card-view-model>Play a game</mini-game-card-view-model></div></ytd-rich-item-renderer>` }
  ]) {
    test(`packs recommendations across a hidden ${insert.name} and restores its original slot`, async ({ addon }) => {
      const page = addon.page;
      const unfilteredOrder = ["a", "home-insert", "c", "d", "e", "f"];
      const firstRow = `<ytd-rich-grid-row><div id="contents">${[
        creatorCard({ id: "a", displayName: "Allowed a", handle: "@allowed-a" }),
        insert.markup,
        creatorCard({ id: "c", displayName: "Allowed c", handle: "@allowed-c" })
      ].join("")}</div></ytd-rich-grid-row>`;

      await openFixture(page, `<ytd-browse page-subtype="home">${feedMarkup(firstRow + row(["d", "e", "f"]))}</ytd-browse>`, "/");
      await expectPackedCards(page, unfilteredOrder);

      await addon.setStorage({ [insert.setting]: true });
      await expectVisible(page, '[data-testid="home-insert"]', false);
      await expectPackedCards(page, unfilteredOrder.filter((id) => id !== "home-insert"));
      await expectVisible(page, '[data-testid="a"] .cf-block-button');
      await expectVisible(page, '[data-testid="c"] .cf-block-button');

      await addon.setStorage({ [insert.setting]: false });
      await expectVisible(page, '[data-testid="home-insert"]');
      await expectPackedCards(page, unfilteredOrder);
    });
  }

  test("collapses a modern Explore section while preserving an ordinary full-width shelf", async ({ addon }) => {
    const page = addon.page;
    const sections = `<ytd-rich-section-renderer data-testid="ordinary-section"><h2>Explore more topics</h2></ytd-rich-section-renderer>
      <ytd-rich-section-renderer data-testid="explore-section"><div id="content">
        <yt-chips-shelf-view-model class="ytChipsShelfViewModelHost">더 많은 주제 탐색</yt-chips-shelf-view-model>
      </div></ytd-rich-section-renderer>`;

    await openFixture(page, `<ytd-browse page-subtype="home">${feedMarkup(row(["a", "b", "c"]) + sections + row(["d", "e", "f"]))}</ytd-browse>`, "/");
    await expectPackedCards(page, ["a", "b", "c"]);
    await expectPackedCards(page, ["d", "e", "f"], rowStep + 240);
    await addon.setStorage({ cfHideHomePromotions: true });
    await expectVisible(page, '[data-testid="explore-section"]', false);
    await expectVisible(page, '[data-testid="ordinary-section"]');
    await expectPackedCards(page, ["d", "e", "f"], rowStep + 120);
    await addon.setStorage({ cfHideHomePromotions: false });
    await expectVisible(page, '[data-testid="explore-section"]');
    await expectPackedCards(page, ["d", "e", "f"], rowStep + 240);
  });

  test("removes the full ordinary linkless feed cell and restores its original slot with Undo", async ({ addon }) => {
    const page = addon.page;
    await addon.setStorage({ cfBlockedChannels: [] });

    await openFixture(page, directFeed(), "/");
    await expectPackedCards(page, directOrder);
    for (const id of directOrder) {
      await expectCount(page, `[data-testid="${id}"] .cf-block-button`, 1);
    }

    await page.locator('[data-testid="direct-blocked"] button[aria-label="Block Ordinary Creator"]').click();
    await expectVisible(page, '[data-testid="direct-blocked-lockup"]', false);
    await expectVisible(page, '[data-testid="direct-blocked"]', false);
    await expectPackedCards(page, directBlockedOrder);

    await page.locator("#cf-toast button").click();
    await expectVisible(page, '[data-testid="direct-blocked"]');
    await expectPackedCards(page, directOrder);
    await expectCount(page, '[data-testid="direct-blocked"] .cf-block-button', 1);
  });

  test("updates the outer feed cell when YouTube recycles an ordinary linkless lockup", async ({ addon }) => {
    const page = addon.page;
    await addon.setStorage({ cfBlockedChannels: [blockedCreator("@ordinary", "Ordinary Creator")] });

    await openFixture(page, directFeed(), "/");
    await expectVisible(page, '[data-testid="direct-blocked"]', false);
    await expectPackedCards(page, directBlockedOrder);

    const replaceOrdinaryOwner = (name: string) => page.$eval('[data-testid="direct-blocked-lockup"]', async (lockup, value) => {
      lockup.querySelector(".ytContentMetadataViewModelMetadataText")!.textContent = value;
      lockup.querySelector(".ytLockupMetadataViewModelAvatar [aria-label]")!
        .setAttribute("aria-label", `Go to channel ${value}`);
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    }, name);

    await replaceOrdinaryOwner("Recycled Allowed Creator");
    await expectVisible(page, '[data-testid="direct-blocked"]');
    await expectPackedCards(page, directOrder);
    await expectCount(page, '[data-testid="direct-blocked"] button[aria-label="Block Recycled Allowed Creator"]', 1);

    await replaceOrdinaryOwner("Ordinary Creator");
    await expectVisible(page, '[data-testid="direct-blocked"]', false);
    await expectPackedCards(page, directBlockedOrder);
  });

  test("fills a blocked collaboration's slot across rows and restores exact order with Undo", async ({ addon }) => {
    const page = addon.page;
    await addon.setStorage({ cfBlockedChannels: [] });

    await openFixture(page, feed(), "/");
    await expectPackedCards(page, originalOrder);
    for (const name of ["Business Insider", "Insider Food", "Insider"]) {
      await expectCount(page, '[data-testid="collaboration"] ' + `button[aria-label="Block ${name}"]`, 1);
    }
    await expectCount(page, '[data-testid="a"] .cf-block-button', 1);

    await page.locator('[data-testid="collaboration"] button[aria-label="Block Insider Food"]').click();
    await expectVisible(page, '[data-testid="collaboration"]', false);
    await expectPackedCards(page, blockedOrder);

    await page.locator("#cf-toast button").click();
    await expectVisible(page, '[data-testid="collaboration"]');
    await expectPackedCards(page, originalOrder);
    await expectCount(page, '[data-testid="collaboration"] .cf-block-button', 3);
  });

  test("restores and compacts row positions when filtering is paused and resumed", async ({ addon }) => {
    const page = addon.page;
    await addon.setStorage({ cfBlockedChannels: [blockedCreator("@businessinsider", "Business Insider")] });

    await openFixture(page, feed(), "/");
    await expectVisible(page, '[data-testid="collaboration"]', false);
    await expectPackedCards(page, blockedOrder);

    await addon.setStorage({ cfEnabled: false });
    await expectVisible(page, '[data-testid="collaboration"]');
    await expectPackedCards(page, originalOrder);

    await addon.setStorage({ cfEnabled: true });
    await expectVisible(page, '[data-testid="collaboration"]', false);
    await expectPackedCards(page, blockedOrder);
  });

  test("keeps positions current through collaboration hydration and renderer reuse", async ({ addon }) => {
    const page = addon.page;
    await addon.setStorage({ cfBlockedChannels: [blockedCreator("@businessinsider", "Business Insider")] });

    await openFixture(page, feed(), "/");
    await expectVisible(page, '[data-testid="collaboration"]', false);
    await expectPackedCards(page, blockedOrder);

    for (const label of [collapsedByline, expandedByline, collapsedByline]) {
      await replaceByline(page, label);
      await expectVisible(page, '[data-testid="collaboration"]', false);
      await expectPackedCards(page, blockedOrder);
    }

    await replaceByline(page, "Allowed Lead and Allowed Guest");
    await expectVisible(page, '[data-testid="collaboration"]');
    await expectPackedCards(page, originalOrder);
    await expectCount(page, '[data-testid="collaboration"] .cf-block-button', 2);

    await replaceByline(page, expandedByline);
    await expectVisible(page, '[data-testid="collaboration"]', false);
    await expectPackedCards(page, blockedOrder);
  });

  test("compacts video rows while preserving a full-width shelf and its content boundary", async ({ addon }) => {
    const page = addon.page;
    await addon.setStorage({ cfBlockedChannels: [blockedCreator("@businessinsider", "Business Insider")] });

    await openFixture(page, feed(true), "/");
    await expectVisible(page, '[data-testid="collaboration"]', false);
    await expectPackedCards(page, ["a", "c", "d", "e", "f"]);
    await expectPackedCards(page, ["g", "h", "i"], rowStep * 2 + 120);

    const gridBox = await page.$eval('[data-testid="feed-grid"]', (element) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    });
    const shelfBox = await page.$eval('[data-testid="wide-section"]', (element) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    });
    expect(gridBox).not.toBeNull();
    expect(shelfBox).not.toBeNull();
    expect(shelfBox!.x).toBeCloseTo(gridBox!.x, 0);
    expect(shelfBox!.width).toBeCloseTo(gridWidth, 0);
    expect(shelfBox!.y - gridBox!.y).toBeCloseTo(rowStep * 2, 0);
  });
});
