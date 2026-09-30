import { blockedCreator, expect, test } from "../fixtures/extension.fixture";
import { channelHeader, rightRailLockup } from "../fixtures/youtube-fixtures";
import { YouTubeSurfacePage } from "../pages/youtube-surface.page";

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
  stackLabel = "Collaboration channels"
}: {
  id?: string;
  label?: string;
  fullLabelAttribute?: "title" | "aria-label";
  linkedOwners?: Array<{ handle: string; displayName: string }>;
  stackLabel?: string | null;
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
              <div class="ytContentMetadataViewModelMetadataRow">
                <span class="ytContentMetadataViewModelMetadataText" data-testid="${escapeHtml(id)}-byline" role="text"${fullLabel}>${byline}</span>
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
    test(`hides a three-creator linkless card when ${creator.displayName} is blocked`, async ({
      extensionPage,
      extensionStorage
    }) => {
      await extensionStorage.set({
        cfBlockedChannels: [blockedCreator(creator.handle, creator.displayName)]
      });
      const youtube = new YouTubeSurfacePage(extensionPage);
      await youtube.open(collaborationLockup());

      await expect(youtube.card("collaboration")).toBeHidden();
    });
  }

  test("matches the visible lead creator in an and-2-more byline", async ({
    extensionPage,
    extensionStorage
  }) => {
    await extensionStorage.set({
      cfBlockedChannels: [blockedCreator("@businessinsider", "Business Insider")]
    });
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(collaborationLockup({ label: collapsedByline }));

    await expect(youtube.card("collaboration")).toBeHidden();
  });

  for (const [selectedIndex, creator] of creators.entries()) {
    if (selectedIndex === 0) {
      continue;
    }
    test(`the inline control blocks only collaborator ${selectedIndex + 1}: ${creator.displayName}`, async ({
      extensionPage,
      extensionStorage
    }) => {
      const youtube = new YouTubeSurfacePage(extensionPage);
      await youtube.open(collaborationLockup() + creators.map((owner, index) =>
        rightRailLockup({ id: `solo-${index}`, displayName: owner.displayName })
      ).join(""));

      await youtube.card("collaboration").getByRole("button", {
        name: `Block ${creator.displayName}`, exact: true
      }).click();
      await expect(youtube.card("collaboration")).toBeHidden();
      for (const index of creators.keys()) {
        if (index === selectedIndex) {
          await expect(youtube.card(`solo-${index}`)).toBeHidden();
        } else {
          await expect(youtube.card(`solo-${index}`)).toBeVisible();
        }
      }
      const stored = await extensionStorage.get<StoredBlockedCreators>("cfBlockedChannels");
      expect(stored.cfBlockedChannels).toEqual([
        expect.objectContaining({
          aliases: [`name:${creator.displayName.toLowerCase()}`],
          displayName: creator.displayName
        })
      ]);
    });
  }

  test("the three-dot menu blocks the selected collaborator independently", async ({
    extensionPage,
    extensionStorage
  }) => {
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(collaborationLockup() + creators.map((owner, index) =>
      rightRailLockup({ id: `solo-${index}`, displayName: owner.displayName })
    ).join(""));

    const menuItems = await youtube.openCreatorMenuItems("collaboration-menu");
    await expect(menuItems).toHaveCount(3);
    await extensionPage.getByRole("menuitem", {
      name: "Block Insider Food with ChannelFence", exact: true
    }).click();

    await expect(youtube.card("collaboration")).toBeHidden();
    await expect(youtube.card("solo-1")).toBeHidden();
    await expect(youtube.card("solo-0")).toBeVisible();
    await expect(youtube.card("solo-2")).toBeVisible();
    const stored = await extensionStorage.get<StoredBlockedCreators>("cfBlockedChannels");
    expect(stored.cfBlockedChannels).toEqual([
      expect.objectContaining({ aliases: ["name:insider food"], displayName: "Insider Food" })
    ]);
  });

  test("blocks the visible lead creator without saving an aggregate label or count", async ({
    extensionPage,
    extensionStorage
  }) => {
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(collaborationLockup({ label: collapsedByline }));

    await expect(youtube.blockButton("collaboration")).toHaveCount(1);
    await youtube.card("collaboration")
      .getByRole("button", { name: "Block Business Insider", exact: true }).click();
    await expect(youtube.card("collaboration")).toBeHidden();

    const stored = await extensionStorage.get<StoredBlockedCreators>("cfBlockedChannels");
    expect(stored.cfBlockedChannels).toEqual([
      expect.objectContaining({
        aliases: ["name:business insider"],
        displayName: "Business Insider"
      })
    ]);
    expect(JSON.stringify(stored.cfBlockedChannels)).not.toContain("2 more");
  });

  for (const fullLabelAttribute of ["title", "aria-label"] as const) {
    test(`uses a full ${fullLabelAttribute} to match collaborators behind collapsed text`, async ({
      extensionPage,
      extensionStorage
    }) => {
      await extensionStorage.set({
        cfBlockedChannels: [blockedCreator("@insider", "Insider")]
      });
      const youtube = new YouTubeSurfacePage(extensionPage);
      await youtube.open(collaborationLockup({
        label: collapsedByline,
        fullLabelAttribute
      }));

      await expect(youtube.card("collaboration")).toBeHidden();
    });
  }

  test("keeps controls and blocking stable when YouTube expands and collapses the byline", async ({
    extensionPage,
    extensionStorage
  }) => {
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(collaborationLockup());
    const card = youtube.card("collaboration");
    const byline = extensionPage.getByTestId("collaboration-byline");
    const replaceByline = (label: string) => byline.evaluate(async (element, value) => {
      element.textContent = value;
      // Let the content script process the mutation before checking that a
      // previously hidden card stayed hidden after its identity changed.
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
    }, label);

    await expect(youtube.blockButton("collaboration")).toHaveCount(3);
    for (const creator of creators) {
      await expect(card.getByRole("button", {
        name: `Block ${creator.displayName}`,
        exact: true
      })).toBeVisible();
    }

    await replaceByline(collapsedByline);
    await expect(youtube.blockButton("collaboration")).toHaveCount(1);
    await expect(card.getByRole("button", {
      name: "Block Business Insider", exact: true
    })).toBeVisible();

    await replaceByline(expandedByline);
    await expect(youtube.blockButton("collaboration")).toHaveCount(3);
    await card.getByRole("button", { name: "Block Business Insider", exact: true }).click();
    await expect(card).toBeHidden();

    for (const label of [collapsedByline, expandedByline, collapsedByline]) {
      await replaceByline(label);
      await expect(card).toBeHidden();
      await expect(youtube.blockButton("collaboration")).toHaveCount(0);
    }
    const stored = await extensionStorage.get<StoredBlockedCreators>("cfBlockedChannels");
    expect(stored.cfBlockedChannels).toHaveLength(1);
    expect(stored.cfBlockedChannels[0].aliases).toEqual(["name:business insider"]);
  });

  test("keeps same-named linked collaborators separate and respects their handles", async ({
    extensionPage,
    extensionStorage
  }) => {
    await extensionStorage.set({
      cfBlockedChannels: [blockedCreator("@other-same-name", "Same Name")]
    });
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(collaborationLockup({
      linkedOwners: [
        { handle: "@first-owner", displayName: "Same Name" },
        { handle: "@second-owner", displayName: "Same Name" }
      ]
    }));

    const card = youtube.card("collaboration");
    await expect(card).toBeVisible();
    const controls = card.getByRole("button", { name: "Block Same Name", exact: true });
    await expect(controls).toHaveCount(2);
    await controls.nth(1).click();
    await expect(card).toBeHidden();

    const stored = await extensionStorage.get<StoredBlockedCreators>("cfBlockedChannels");
    expect(stored.cfBlockedChannels).toHaveLength(2);
    expect(stored.cfBlockedChannels[0].aliases).toEqual(["handle:@second-owner"]);
    expect(stored.cfBlockedChannels[1].aliases).toEqual(["handle:@other-same-name"]);
  });

  test("matches a linkless guest beside multiple linked creators with the same display name", async ({
    extensionPage,
    extensionStorage
  }) => {
    await extensionStorage.set({
      cfBlockedChannels: [blockedCreator("@guest-creator", "Guest Creator")]
    });
    const youtube = new YouTubeSurfacePage(extensionPage);
    const markup = collaborationLockup({
      linkedOwners: [
        { handle: "@first-owner", displayName: "Same Name" },
        { handle: "@second-owner", displayName: "Same Name" }
      ]
    }).replace("Same Name</a></span>", "Same Name</a> and Guest Creator</span>");
    await youtube.open(markup);

    await expect(youtube.card("collaboration")).toBeHidden();
  });

  for (const stackLabel of ["", "Canales colaboradores"]) {
    test(`recognizes an avatar stack with ${stackLabel ? "a localized" : "no"} accessibility label`, async ({
      extensionPage,
      extensionStorage
    }) => {
      await extensionStorage.set({
        cfBlockedChannels: [blockedCreator("@insiderfood", "Insider Food")]
      });
      const youtube = new YouTubeSurfacePage(extensionPage);
      await youtube.open(collaborationLockup({ stackLabel }));

      await expect(youtube.card("collaboration")).toBeHidden();
    });
  }

  test("handles an and-2-more channel Videos byline without an avatar stack", async ({
    extensionPage,
    extensionStorage
  }) => {
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(
      channelHeader("Fixture Host", "@fixture-host") + collaborationLockup({
        label: collapsedByline,
        stackLabel: null
      }),
      "/@fixture-host/videos"
    );

    await expect(youtube.blockButton("collaboration")).toHaveCount(1);
    await expect(youtube.card("collaboration").getByRole("button", {
      name: "Block Business Insider", exact: true
    })).toBeVisible();

    await extensionStorage.set({
      cfBlockedChannels: [blockedCreator("@businessinsider", "Business Insider")]
    });
    await expect(youtube.card("collaboration")).toBeHidden();
  });

  test("preserves the known channel title containing and in a channel Videos collaboration", async ({
    extensionPage,
    extensionStorage
  }) => {
    await extensionStorage.set({
      cfBlockedChannels: [blockedCreator("@simon", "Simon")]
    });
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(
      channelHeader("Simon and Martina", "@simon-and-martina") + collaborationLockup({
        label: "Simon and Martina and Guest Creator",
        stackLabel: null
      }),
      "/@simon-and-martina/videos"
    );

    const card = youtube.card("collaboration");
    await expect(card).toBeVisible();
    await expect(youtube.blockButton("collaboration")).toHaveCount(1);
    await expect(card.getByRole("button", {
      name: "Block Guest Creator", exact: true
    })).toBeVisible();
    await expect(card.getByRole("button", {
      name: "Block Simon", exact: true
    })).toHaveCount(0);
    await expect(card.getByRole("button", {
      name: "Block Martina", exact: true
    })).toHaveCount(0);
  });

  test("keeps nested feed wrappers hidden through hydration and restores them with Undo", async ({
    extensionPage,
    extensionStorage
  }) => {
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(`<ytd-rich-item-renderer data-testid="outer-card">
      ${collaborationLockup()}
    </ytd-rich-item-renderer>`);
    const outer = youtube.card("outer-card");
    const inner = youtube.card("collaboration");
    const byline = extensionPage.getByTestId("collaboration-byline");
    const replaceByline = (label: string) => byline.evaluate(async (element, value) => {
      element.textContent = value;
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
    }, label);

    await expect(outer.locator(".cf-block-button")).toHaveCount(3);
    await expect(inner.locator(".cf-block-button")).toHaveCount(3);
    await inner.getByRole("button", { name: "Block Business Insider", exact: true }).click();
    await expect(outer).toHaveClass(/cf-hidden-by-channelfence/);
    await expect(inner).toHaveClass(/cf-hidden-by-channelfence/);

    for (const label of [collapsedByline, expandedByline, collapsedByline]) {
      await replaceByline(label);
      await expect(outer).toHaveClass(/cf-hidden-by-channelfence/);
      await expect(inner).toHaveClass(/cf-hidden-by-channelfence/);
      await expect(outer.locator(".cf-block-button")).toHaveCount(0);
    }

    // YouTube also recycles the same nested renderer for an allowed video.
    // Its inner metadata mutation must refresh the outer feed cell as well.
    await replaceByline("Allowed Lead and Allowed Guest");
    await expect(outer).toBeVisible();
    await expect(inner).toBeVisible();
    await expect(outer.locator(".cf-block-button")).toHaveCount(2);
    await expect(inner.getByRole("button", {
      name: "Block Allowed Lead", exact: true
    })).toBeVisible();
    await expect(inner.getByRole("button", {
      name: "Block Allowed Guest", exact: true
    })).toBeVisible();

    await replaceByline(collapsedByline);
    await expect(outer).toHaveClass(/cf-hidden-by-channelfence/);
    await expect(inner).toHaveClass(/cf-hidden-by-channelfence/);
    await expect(outer.locator(".cf-block-button")).toHaveCount(0);

    await extensionPage.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(outer).toBeVisible();
    await expect(inner).toBeVisible();
    await expect(outer.locator(".cf-block-button")).toHaveCount(1);
    await replaceByline(expandedByline);
    await expect(outer.locator(".cf-block-button")).toHaveCount(3);
    await expect(inner.locator(".cf-block-button")).toHaveCount(3);
    const stored = await extensionStorage.get<StoredBlockedCreators>("cfBlockedChannels");
    expect(stored.cfBlockedChannels).toEqual([]);
  });

  test("preserves and inside a real single creator name without a collaboration marker", async ({
    extensionPage,
    extensionStorage
  }) => {
    await extensionStorage.set({
      cfBlockedChannels: [blockedCreator("@simon", "Simon")]
    });
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(rightRailLockup({
      id: "single-creator",
      displayName: "Simon and Martina"
    }));

    await expect(youtube.card("single-creator")).toBeVisible();
    await expect(youtube.blockButton("single-creator")).toHaveCount(1);
    await youtube.card("single-creator")
      .getByRole("button", { name: "Block Simon and Martina", exact: true }).click();

    const stored = await extensionStorage.get<StoredBlockedCreators>("cfBlockedChannels");
    expect(stored.cfBlockedChannels[0]).toMatchObject({
      aliases: ["name:simon and martina"],
      displayName: "Simon and Martina"
    });
  });
});
