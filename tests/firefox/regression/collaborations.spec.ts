import {
  blockedCreator, expect, expectVisible, expectCount, openCreatorMenu, openFixture, test
} from "../extension.fixture";
import { channelHeader, rightRailLockup } from "../../e2e/fixtures/youtube-fixtures";

const creators = [
  { handle: "@businessinsider", displayName: "Business Insider" },
  { handle: "@insiderfood", displayName: "Insider Food" },
  { handle: "@insider", displayName: "Insider" }
];
const expandedByline = creators.map((creator) => creator.displayName).join(" and ");
const collapsedByline = "Business Insider and 2 more";

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function collaborationLockup({
  id = "collaboration",
  label = expandedByline,
  fullLabelAttribute,
  linkedOwners = [],
  stackLabel = "Collaboration channels",
  groupedFields
}: {
  id?: string;
  label?: string;
  fullLabelAttribute?: "title" | "aria-label";
  linkedOwners?: Array<{ handle: string; displayName: string }>;
  stackLabel?: string | null;
  groupedFields?: string[];
} = {}): string {
  const byline = linkedOwners.length > 0
    ? linkedOwners.map((owner) =>
      `<a href="/${escapeHtml(owner.handle)}" aria-label="Go to channel ${escapeHtml(owner.displayName)}">${escapeHtml(owner.displayName)}</a>`
    ).join(" and ")
    : escapeHtml(label);
  const fullLabel = fullLabelAttribute
    ? ` ${fullLabelAttribute}="${escapeHtml(expandedByline)}"`
    : "";
  const stack = stackLabel === null ? "" :
    `<yt-avatar-stack-view-model${stackLabel ? ` aria-label="${escapeHtml(stackLabel)}"` : ""}></yt-avatar-stack-view-model>`;

  // Modern feed lockups can expose collaborators only as byline text. The
  // avatar stack identifies a collaboration; no creator URL is required.
  return `
    <yt-lockup-view-model class="yt-lockup-view-model" data-testid="${escapeHtml(id)}">
      <a class="thumbnail" href="/watch?v=${escapeHtml(id)}">Collaboration video</a>
      <div class="ytLockupViewModelMetadata">
        <yt-lockup-metadata-view-model>
          <div class="ytLockupMetadataViewModelAvatar">
            ${stack}
          </div>
          <div class="ytLockupMetadataViewModelTextContainer">
            <h3>A video made by three creators</h3>
            <div class="ytLockupMetadataViewModelMetadata">
              <div class="ytContentMetadataViewModelMetadataRow"${groupedFields ? ' role="group"' : ""}>
                ${groupedFields ? groupedFields.map((field) =>
                  `<span class="ytContentMetadataViewModelMetadataText" role="text">${escapeHtml(field)}</span>`
                ).join('<span class="ytContentMetadataViewModelDelimiter" aria-hidden="true"></span>') :
                  `<span class="ytContentMetadataViewModelMetadataText" data-testid="${escapeHtml(id)}-byline" role="text"${fullLabel}>${byline}</span>`}
              </div>
              <div class="ytContentMetadataViewModelMetadataRow">
                <span role="text">125K views &middot; 2 days ago</span>
              </div>
            </div>
          </div>
          <div class="ytLockupViewModelMenuButton">
            <button-view-model>
              <button data-testid="${escapeHtml(id)}-menu" aria-label="More actions">More</button>
            </button-view-model>
          </div>
        </yt-lockup-metadata-view-model>
      </div>
    </yt-lockup-view-model>`;
}

type StoredBlockedCreators = {
  cfBlockedChannels: Array<{
    aliases: string[];
    displayName: string;
    nameAliases: string[];
  }>;
};

test.describe("Collaboration creator identities", () => {
  for (const creator of creators) {
    test(`hides a three-creator linkless card when ${creator.displayName} is blocked`, async ({ addon }) => {
      const page = addon.page;
      await addon.setStorage({
        cfBlockedChannels: [blockedCreator(creator.handle, creator.displayName)]
      });

      await openFixture(page, collaborationLockup());

      await expectVisible(page, '[data-testid="collaboration"]', false);
    });
  }

  test("matches the visible lead creator in an and-2-more byline", async ({ addon }) => {
    const page = addon.page;
    await addon.setStorage({
      cfBlockedChannels: [blockedCreator("@businessinsider", "Business Insider")]
    });

    await openFixture(page, collaborationLockup({ label: collapsedByline }));

    await expectVisible(page, '[data-testid="collaboration"]', false);
  });

  for (const [selectedIndex, creator] of creators.entries()) {
    if (selectedIndex === 0) {
      continue;
    }
    test(`the inline control blocks only collaborator ${selectedIndex + 1}: ${creator.displayName}`, async ({ addon }) => {
      const page = addon.page;

      await openFixture(page, collaborationLockup() + creators.map((owner, index) =>
        rightRailLockup({ id: `solo-${index}`, displayName: owner.displayName })
      ).join(""));

      await page.locator(`[data-testid="collaboration"] button[aria-label="Block ${creator.displayName}"]`).click();
      await expectVisible(page, '[data-testid="collaboration"]', false);
      for (const index of creators.keys()) {
        if (index === selectedIndex) {
          await expectVisible(page, `[data-testid="solo-${index}"]`, false);
        } else {
          await expectVisible(page, `[data-testid="solo-${index}"]`);
        }
      }
      const stored = await addon.getStorage<StoredBlockedCreators>("cfBlockedChannels");
      expect(stored.cfBlockedChannels).toEqual([
        expect.objectContaining({
          aliases: [`name:${creator.displayName.toLowerCase()}`],
          displayName: creator.displayName
        })
      ]);
    });
  }

  test("the three-dot menu blocks the selected collaborator independently", async ({ addon }) => {
    const page = addon.page;

    await openFixture(page, collaborationLockup() + creators.map((owner, index) =>
      rightRailLockup({ id: `solo-${index}`, displayName: owner.displayName })
    ).join(""));

    await openCreatorMenu(page, '[data-testid="collaboration-menu"]');
    const menuItems = ".cf-menu-item";
    await expectCount(page, menuItems, 3);
    await page.locator('[role="menuitem"][aria-label="Block Insider Food with ChannelFence"]').click();

    await expectVisible(page, '[data-testid="collaboration"]', false);
    await expectVisible(page, '[data-testid="solo-1"]', false);
    await expectVisible(page, '[data-testid="solo-0"]');
    await expectVisible(page, '[data-testid="solo-2"]');
    const stored = await addon.getStorage<StoredBlockedCreators>("cfBlockedChannels");
    expect(stored.cfBlockedChannels).toEqual([
      expect.objectContaining({ aliases: ["name:insider food"], displayName: "Insider Food" })
    ]);
  });

  test("blocks the visible lead creator without saving an aggregate label or count", async ({ addon }) => {
    const page = addon.page;

    await openFixture(page, collaborationLockup({ label: collapsedByline }));

    await expectCount(page, '[data-testid="collaboration"] .cf-block-button', 1);
    await page.locator('[data-testid="collaboration"] button[aria-label="Block Business Insider"]').click();
    await expectVisible(page, '[data-testid="collaboration"]', false);

    const stored = await addon.getStorage<StoredBlockedCreators>("cfBlockedChannels");
    expect(stored.cfBlockedChannels).toEqual([
      expect.objectContaining({
        aliases: ["name:business insider"],
        displayName: "Business Insider"
      })
    ]);
    expect(JSON.stringify(stored.cfBlockedChannels)).not.toContain("2 more");
  });

  for (const scenario of [
    { title: "the captured Chinese byline", names: ["Muetzel Aveni", "achenbach Showalte"] },
    { title: "Chinese names containing 和 and punctuation", names: ["Muetzel和Aveni, and Co.", "和achenbach和Showalte & Co."] }
  ]) {
    test(`keeps collaborators separate in ${scenario.title}`, async ({ addon }) => {
      const page = addon.page;
      const [lead, guest] = scenario.names;
      await openFixture(page, collaborationLockup({
        stackLabel: "合作拍片參與頻道", groupedFields: [lead, `和${guest}`]
      }) + rightRailLockup({ id: "solo-lead", displayName: lead }) +
        rightRailLockup({ id: "solo-guest", displayName: guest }), "/watch?v=fixture-video", "zh-TW");

      const card = '[data-testid="collaboration"]';
      const expectedLabels = scenario.names.map((name) => `Block ${name}`).sort();
      await expectCount(page, card + " .cf-block-button", 2);
      expect(await page.$$eval(card + " .cf-block-button", (buttons) =>
        buttons.map((button) => button.getAttribute("aria-label")).sort())).toEqual(expectedLabels);
      // Reprocess native text with existing controls nested inside its field.
      // Their icon/text must not turn a valid creator field into an unknown shape.
      await page.$eval(card, (root) => {
        const field = root.querySelector(".ytContentMetadataViewModelMetadataText")!;
        field.append(...root.querySelectorAll(".cf-block-button"), document.createTextNode(" "));
      });
      await expectCount(page, card + " .cf-block-button", 2);
      expect(await page.$$eval(card + " .cf-block-button", (buttons) =>
        buttons.map((button) => button.getAttribute("aria-label")).sort())).toEqual(expectedLabels);

      await openCreatorMenu(page, '[data-testid="collaboration-menu"]');
      await expectCount(page, ".cf-menu-item", 2);
      expect(await page.$$eval(".cf-menu-item", (items) => items.map((item) => item.getAttribute("aria-label")).sort()))
        .toEqual(scenario.names.map((name) => `Block ${name} with ChannelFence`).sort());
      await page.locator(`[role="menuitem"][aria-label="Block ${guest} with ChannelFence"]`).click();
      await expectVisible(page, card, false);
      await expectVisible(page, '[data-testid="solo-guest"]', false);
      await expectVisible(page, '[data-testid="solo-lead"]');
      const stored = await addon.getStorage<StoredBlockedCreators>("cfBlockedChannels");
      expect(stored.cfBlockedChannels).toEqual([expect.objectContaining({
        key: `name:${guest.toLowerCase()}`, aliases: [`name:${guest.toLowerCase()}`], displayName: guest
      })]);
    });
  }

  test("does not invent owners from unsupported Chinese groups and preserves linked identities", async ({ addon }) => {
    const page = addon.page;
    const nested = collaborationLockup({
      id: "nested-group", stackLabel: "合作拍片參與頻道", groupedFields: ["Lead", "和Guest"]
    }).replace(">和Guest</span>", '><span title="Verified">和Guest</span></span>');
    const linked = collaborationLockup({
      id: "linked-group", stackLabel: "合作拍片參與頻道", groupedFields: ["Lead", "和Guest"]
    }).replace(">Lead</span>", '><a href="/@linked-lead">Lead</a></span>')
      .replace(">和Guest</span>", '>和<a href="/@linked-guest">Guest</a></span>');
    await openFixture(page, collaborationLockup({
      id: "missing-connector", stackLabel: "合作拍片參與頻道", groupedFields: ["Lead", "Guest"]
    }) + collaborationLockup({
      id: "joined-field", stackLabel: "合作拍片參與頻道", groupedFields: ["甲和乙"]
    }) + collaborationLockup({
      id: "three-fields", stackLabel: "合作拍片參與頻道", groupedFields: ["Lead", "和Guest", "和Third"]
    }) + nested + linked, "/watch?v=fixture-video", "zh-TW");

    for (const id of ["missing-connector", "joined-field", "three-fields", "nested-group"]) {
      await expectVisible(page, `[data-testid="${id}"]`);
      await expectCount(page, `[data-testid="${id}"] .cf-block-button`, 0);
    }
    await expectCount(page, '[data-testid="linked-group"] .cf-block-button', 2);
    await page.locator('[data-testid="linked-group"] button[aria-label="Block Guest"]').click();
    await expectVisible(page, '[data-testid="linked-group"]', false);
    await expectVisible(page, '[data-testid="missing-connector"]');
    await expectVisible(page, '[data-testid="joined-field"]');
    await expectVisible(page, '[data-testid="three-fields"]');
    await expectVisible(page, '[data-testid="nested-group"]');
    const stored = await addon.getStorage<StoredBlockedCreators>("cfBlockedChannels");
    expect(stored.cfBlockedChannels).toEqual([expect.objectContaining({
      key: "handle:@linked-guest", aliases: ["handle:@linked-guest"], displayName: "linked-guest"
    })]);
  });

  for (const fullLabelAttribute of ["title", "aria-label"] as const) {
    test(`uses a full ${fullLabelAttribute} to match collaborators behind collapsed text`, async ({ addon }) => {
      const page = addon.page;
      await addon.setStorage({
        cfBlockedChannels: [blockedCreator("@insider", "Insider")]
      });

      await openFixture(page, collaborationLockup({
        label: collapsedByline,
        fullLabelAttribute
      }));

      await expectVisible(page, '[data-testid="collaboration"]', false);
    });
  }

  test("keeps controls and blocking stable when YouTube expands and collapses the byline", async ({ addon }) => {
    const page = addon.page;

    await openFixture(page, collaborationLockup());
    const card = '[data-testid="collaboration"]';
    const byline = '[data-testid="collaboration-byline"]';
    const replaceByline = (label: string) => page.$eval(byline, async (element, value) => {
      element.textContent = value;
      // Let the content script process the mutation before checking that a
      // previously hidden card stayed hidden after its identity changed.
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
    }, label);

    await expectCount(page, '[data-testid="collaboration"] .cf-block-button', 3);
    for (const creator of creators) {
      await expectVisible(page, card + " " + `button[aria-label="Block ${creator.displayName}"]`);
    }

    await replaceByline(collapsedByline);
    await expectCount(page, '[data-testid="collaboration"] .cf-block-button', 1);
    await expectVisible(page, card + ' button[aria-label="Block Business Insider"]');

    await replaceByline(expandedByline);
    await expectCount(page, '[data-testid="collaboration"] .cf-block-button', 3);
    await page.locator(card + ' button[aria-label="Block Business Insider"]').click();
    await expectVisible(page, card, false);

    for (const label of [collapsedByline, expandedByline, collapsedByline]) {
      await replaceByline(label);
      await expectVisible(page, card, false);
      await expectCount(page, '[data-testid="collaboration"] .cf-block-button', 0);
    }
    const stored = await addon.getStorage<StoredBlockedCreators>("cfBlockedChannels");
    expect(stored.cfBlockedChannels).toHaveLength(1);
    expect(stored.cfBlockedChannels[0].aliases).toEqual(["name:business insider"]);
  });

  test("keeps same-named linked collaborators separate and respects their handles", async ({ addon }) => {
    const page = addon.page;
    await addon.setStorage({
      cfBlockedChannels: [blockedCreator("@other-same-name", "Same Name")]
    });

    await openFixture(page, collaborationLockup({
      linkedOwners: [
        { handle: "@first-owner", displayName: "Same Name" },
        { handle: "@second-owner", displayName: "Same Name" }
      ]
    }));

    const card = '[data-testid="collaboration"]';
    await expectVisible(page, card);
    const controls = card + ' button[aria-label="Block Same Name"]';
    await expectCount(page, controls, 2);
    const sameNameControls = await page.$$(controls);
    await sameNameControls[1].click();
    await expectVisible(page, card, false);

    const stored = await addon.getStorage<StoredBlockedCreators>("cfBlockedChannels");
    expect(stored.cfBlockedChannels).toHaveLength(2);
    expect(stored.cfBlockedChannels[0].aliases).toEqual(["handle:@second-owner"]);
    expect(stored.cfBlockedChannels[1].aliases).toEqual(["handle:@other-same-name"]);
    await Promise.all(sameNameControls.map((control) => control.dispose()));
  });

  test("matches a linkless guest beside multiple linked creators with the same display name", async ({ addon }) => {
    const page = addon.page;
    await addon.setStorage({
      cfBlockedChannels: [blockedCreator("@guest-creator", "Guest Creator")]
    });

    const markup = collaborationLockup({
      linkedOwners: [
        { handle: "@first-owner", displayName: "Same Name" },
        { handle: "@second-owner", displayName: "Same Name" }
      ]
    }).replace("Same Name</a></span>", "Same Name</a> and Guest Creator</span>");
    await openFixture(page, markup);

    await expectVisible(page, '[data-testid="collaboration"]', false);
  });

  for (const stackLabel of ["", "Canales colaboradores"]) {
    test(`recognizes an avatar stack with ${stackLabel ? "a localized" : "no"} accessibility label`, async ({ addon }) => {
      const page = addon.page;
      await addon.setStorage({
        cfBlockedChannels: [blockedCreator("@insiderfood", "Insider Food")]
      });

      await openFixture(page, collaborationLockup({ stackLabel }));

      await expectVisible(page, '[data-testid="collaboration"]', false);
    });
  }

  test("handles an and-2-more channel Videos byline without an avatar stack", async ({ addon }) => {
    const page = addon.page;

    await openFixture(page,
      channelHeader("Fixture Host", "@fixture-host") + collaborationLockup({
        label: collapsedByline,
        stackLabel: null
      }),
      "/@fixture-host/videos"
    );

    await expectCount(page, '[data-testid="collaboration"] .cf-block-button', 1);
    await expectVisible(page, '[data-testid="collaboration"] button[aria-label="Block Business Insider"]');

    await addon.setStorage({
      cfBlockedChannels: [blockedCreator("@businessinsider", "Business Insider")]
    });
    await expectVisible(page, '[data-testid="collaboration"]', false);
  });

  test("preserves the known channel title containing and in a channel Videos collaboration", async ({ addon }) => {
    const page = addon.page;
    await addon.setStorage({
      cfBlockedChannels: [blockedCreator("@simon", "Simon")]
    });

    await openFixture(page,
      channelHeader("Simon and Martina", "@simon-and-martina") + collaborationLockup({
        label: "Simon and Martina and Guest Creator",
        stackLabel: null
      }),
      "/@simon-and-martina/videos"
    );

    const card = '[data-testid="collaboration"]';
    await expectVisible(page, card);
    await expectCount(page, '[data-testid="collaboration"] .cf-block-button', 1);
    await expectVisible(page, card + ' button[aria-label="Block Guest Creator"]');
    await expectCount(page, card + ' button[aria-label="Block Simon"]', 0);
    await expectCount(page, card + ' button[aria-label="Block Martina"]', 0);
  });

  test("keeps nested feed wrappers hidden through hydration and restores them with Undo", async ({ addon }) => {
    const page = addon.page;

    await openFixture(page, `<ytd-rich-item-renderer data-testid="outer-card">
      ${collaborationLockup()}
    </ytd-rich-item-renderer>`);
    const outer = '[data-testid="outer-card"]';
    const inner = '[data-testid="collaboration"]';
    const byline = '[data-testid="collaboration-byline"]';
    const replaceByline = (label: string) => page.$eval(byline, async (element, value) => {
      element.textContent = value;
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
    }, label);

    await expectCount(page, outer + " .cf-block-button", 3);
    await expectCount(page, inner + " .cf-block-button", 3);
    await page.locator(inner + ' button[aria-label="Block Business Insider"]').click();
    await expect.poll(() => page.$eval(outer, (element) => element.className)).toMatch(/cf-hidden-by-channelfence/);
    await expect.poll(() => page.$eval(inner, (element) => element.className)).toMatch(/cf-hidden-by-channelfence/);

    for (const label of [collapsedByline, expandedByline, collapsedByline]) {
      await replaceByline(label);
      await expect.poll(() => page.$eval(outer, (element) => element.className)).toMatch(/cf-hidden-by-channelfence/);
      await expect.poll(() => page.$eval(inner, (element) => element.className)).toMatch(/cf-hidden-by-channelfence/);
      await expectCount(page, outer + " .cf-block-button", 0);
    }

    // YouTube also recycles the same nested renderer for an allowed video.
    // Its inner metadata mutation must refresh the outer feed cell as well.
    await replaceByline("Allowed Lead and Allowed Guest");
    await expectVisible(page, outer);
    await expectVisible(page, inner);
    await expectCount(page, outer + " .cf-block-button", 2);
    await expectVisible(page, inner + ' button[aria-label="Block Allowed Lead"]');
    await expectVisible(page, inner + ' button[aria-label="Block Allowed Guest"]');

    await replaceByline(collapsedByline);
    await expect.poll(() => page.$eval(outer, (element) => element.className)).toMatch(/cf-hidden-by-channelfence/);
    await expect.poll(() => page.$eval(inner, (element) => element.className)).toMatch(/cf-hidden-by-channelfence/);
    await expectCount(page, outer + " .cf-block-button", 0);

    await page.locator("#cf-toast button").click();
    await expectVisible(page, outer);
    await expectVisible(page, inner);
    await expectCount(page, outer + " .cf-block-button", 1);
    await replaceByline(expandedByline);
    await expectCount(page, outer + " .cf-block-button", 3);
    await expectCount(page, inner + " .cf-block-button", 3);
    const stored = await addon.getStorage<StoredBlockedCreators>("cfBlockedChannels");
    expect(stored.cfBlockedChannels).toEqual([]);
  });

  test("preserves and inside a real single creator name without a collaboration marker", async ({ addon }) => {
    const page = addon.page;
    await addon.setStorage({
      cfBlockedChannels: [blockedCreator("@simon", "Simon")]
    });

    await openFixture(page, rightRailLockup({
      id: "single-creator",
      displayName: "Simon and Martina"
    }));

    await expectVisible(page, '[data-testid="single-creator"]');
    await expectCount(page, '[data-testid="single-creator"] .cf-block-button', 1);
    await page.locator('[data-testid="single-creator"] button[aria-label="Block Simon and Martina"]').click();

    const stored = await addon.getStorage<StoredBlockedCreators>("cfBlockedChannels");
    expect(stored.cfBlockedChannels[0]).toMatchObject({
      aliases: ["name:simon and martina"],
      displayName: "Simon and Martina"
    });
  });
});
