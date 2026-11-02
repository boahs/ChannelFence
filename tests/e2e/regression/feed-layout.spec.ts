import { type Page } from "@playwright/test";
import { blockedCreator, expect, test } from "../fixtures/extension.fixture";
import { creatorCard, promotedHomeCard, rightRailLockup } from "../fixtures/youtube-fixtures";
import { YouTubeSurfacePage } from "../pages/youtube-surface.page";

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
  await page.getByTestId("collaboration-byline").evaluate(async (element, value) => {
    element.textContent = value;
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  }, label);
}

test.describe("Home feed layout after creator blocking", () => {
  test("packs recommendations across a hidden sponsored cell and restores its original slot", async ({
    extensionPage,
    extensionStorage
  }) => {
    const sponsoredOrder = ["a", "home-ad", "c", "d", "e", "f"];
    const firstRow = `<ytd-rich-grid-row><div id="contents">${[
      creatorCard({ id: "a", displayName: "Allowed a", handle: "@allowed-a" }),
      promotedHomeCard("Fixture Advertiser", "home-ad"),
      creatorCard({ id: "c", displayName: "Allowed c", handle: "@allowed-c" })
    ].join("")}</div></ytd-rich-grid-row>`;
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(`<ytd-browse page-subtype="home">${feedMarkup(firstRow + row(["d", "e", "f"]))}</ytd-browse>`, "/");
    await expectPackedCards(extensionPage, sponsoredOrder);

    await extensionStorage.set({ cfHideHomeAds: true });
    await expect(youtube.card("home-ad")).toBeHidden();
    await expectPackedCards(extensionPage, sponsoredOrder.filter((id) => id !== "home-ad"));
    await expect(youtube.blockButton("a")).toBeVisible();
    await expect(youtube.blockButton("c")).toBeVisible();

    await extensionStorage.set({ cfHideHomeAds: false });
    await expect(youtube.card("home-ad")).toBeVisible();
    await expectPackedCards(extensionPage, sponsoredOrder);
  });

  test("removes the full ordinary linkless feed cell and restores its original slot with Undo", async ({
    extensionPage,
    extensionStorage
  }) => {
    await extensionStorage.set({ cfBlockedChannels: [] });
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(directFeed(), "/");
    await expectPackedCards(extensionPage, directOrder);
    for (const id of directOrder) {
      await expect(youtube.blockButton(id)).toHaveCount(1);
    }

    await youtube.card("direct-blocked").getByRole("button", { name: "Block Ordinary Creator", exact: true }).click();
    await expect(youtube.card("direct-blocked-lockup")).toBeHidden();
    await expect(youtube.card("direct-blocked")).toBeHidden();
    await expectPackedCards(extensionPage, directBlockedOrder);

    await extensionPage.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(youtube.card("direct-blocked")).toBeVisible();
    await expectPackedCards(extensionPage, directOrder);
    await expect(youtube.blockButton("direct-blocked")).toHaveCount(1);
  });

  test("updates the outer feed cell when YouTube recycles an ordinary linkless lockup", async ({
    extensionPage,
    extensionStorage
  }) => {
    await extensionStorage.set({ cfBlockedChannels: [blockedCreator("@ordinary", "Ordinary Creator")] });
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(directFeed(), "/");
    await expect(youtube.card("direct-blocked")).toBeHidden();
    await expectPackedCards(extensionPage, directBlockedOrder);

    const replaceOrdinaryOwner = (name: string) => youtube.card("direct-blocked-lockup").evaluate(async (lockup, value) => {
      lockup.querySelector(".ytContentMetadataViewModelMetadataText")!.textContent = value;
      lockup.querySelector(".ytLockupMetadataViewModelAvatar [aria-label]")!
        .setAttribute("aria-label", `Go to channel ${value}`);
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    }, name);

    await replaceOrdinaryOwner("Recycled Allowed Creator");
    await expect(youtube.card("direct-blocked")).toBeVisible();
    await expectPackedCards(extensionPage, directOrder);
    await expect(youtube.card("direct-blocked").getByRole("button", {
      name: "Block Recycled Allowed Creator", exact: true
    })).toHaveCount(1);

    await replaceOrdinaryOwner("Ordinary Creator");
    await expect(youtube.card("direct-blocked")).toBeHidden();
    await expectPackedCards(extensionPage, directBlockedOrder);
  });

  test("fills a blocked collaboration's slot across rows and restores exact order with Undo", async ({
    extensionPage,
    extensionStorage
  }) => {
    await extensionStorage.set({ cfBlockedChannels: [] });
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(feed(), "/");
    await expectPackedCards(extensionPage, originalOrder);
    for (const name of ["Business Insider", "Insider Food", "Insider"]) {
      await expect(youtube.card("collaboration").getByRole("button", { name: `Block ${name}`, exact: true }))
        .toHaveCount(1);
    }
    await expect(youtube.blockButton("a")).toHaveCount(1);

    await youtube.card("collaboration").getByRole("button", { name: "Block Insider Food", exact: true }).click();
    await expect(youtube.card("collaboration")).toBeHidden();
    await expectPackedCards(extensionPage, blockedOrder);

    await extensionPage.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(youtube.card("collaboration")).toBeVisible();
    await expectPackedCards(extensionPage, originalOrder);
    await expect(youtube.blockButton("collaboration")).toHaveCount(3);
  });

  test("restores and compacts row positions when filtering is paused and resumed", async ({
    extensionPage,
    extensionStorage
  }) => {
    await extensionStorage.set({ cfBlockedChannels: [blockedCreator("@businessinsider", "Business Insider")] });
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(feed(), "/");
    await expect(youtube.card("collaboration")).toBeHidden();
    await expectPackedCards(extensionPage, blockedOrder);

    await extensionStorage.set({ cfEnabled: false });
    await expect(youtube.card("collaboration")).toBeVisible();
    await expectPackedCards(extensionPage, originalOrder);

    await extensionStorage.set({ cfEnabled: true });
    await expect(youtube.card("collaboration")).toBeHidden();
    await expectPackedCards(extensionPage, blockedOrder);
  });

  test("keeps positions current through collaboration hydration and renderer reuse", async ({
    extensionPage,
    extensionStorage
  }) => {
    await extensionStorage.set({ cfBlockedChannels: [blockedCreator("@businessinsider", "Business Insider")] });
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(feed(), "/");
    await expect(youtube.card("collaboration")).toBeHidden();
    await expectPackedCards(extensionPage, blockedOrder);

    for (const label of [collapsedByline, expandedByline, collapsedByline]) {
      await replaceByline(extensionPage, label);
      await expect(youtube.card("collaboration")).toBeHidden();
      await expectPackedCards(extensionPage, blockedOrder);
    }

    await replaceByline(extensionPage, "Allowed Lead and Allowed Guest");
    await expect(youtube.card("collaboration")).toBeVisible();
    await expectPackedCards(extensionPage, originalOrder);
    await expect(youtube.blockButton("collaboration")).toHaveCount(2);

    await replaceByline(extensionPage, expandedByline);
    await expect(youtube.card("collaboration")).toBeHidden();
    await expectPackedCards(extensionPage, blockedOrder);
  });

  test("compacts video rows while preserving a full-width shelf and its content boundary", async ({
    extensionPage,
    extensionStorage
  }) => {
    await extensionStorage.set({ cfBlockedChannels: [blockedCreator("@businessinsider", "Business Insider")] });
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(feed(true), "/");
    await expect(youtube.card("collaboration")).toBeHidden();
    await expectPackedCards(extensionPage, ["a", "c", "d", "e", "f"]);
    await expectPackedCards(extensionPage, ["g", "h", "i"], rowStep * 2 + 120);

    const gridBox = await youtube.card("feed-grid").boundingBox();
    const shelfBox = await youtube.card("wide-section").boundingBox();
    expect(gridBox).not.toBeNull();
    expect(shelfBox).not.toBeNull();
    expect(shelfBox!.x).toBeCloseTo(gridBox!.x, 0);
    expect(shelfBox!.width).toBeCloseTo(gridWidth, 0);
    expect(shelfBox!.y - gridBox!.y).toBeCloseTo(rowStep * 2, 0);
  });
});
