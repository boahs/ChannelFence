import { blockedCreator, expect, test } from "../fixtures/extension.fixture";
import { creatorCard } from "../fixtures/youtube-fixtures";
import { YouTubeSurfacePage } from "../pages/youtube-surface.page";

test.describe("feed blocking", () => {
  test("blocks a creator, hides every matching card, and supports Undo", async ({
    extensionPage,
    extensionStorage
  }) => {
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open([
      creatorCard({ displayName: "Alpha Creator", handle: "@alpha", id: "alpha-one" }),
      creatorCard({ displayName: "Alpha Creator", handle: "@alpha", id: "alpha-two" }),
      creatorCard({ displayName: "Beta Creator", handle: "@beta", id: "beta" })
    ].join(""));

    await expect(youtube.blockButton("alpha-one")).toBeVisible();
    await youtube.blockButton("alpha-one").click();

    await expect(youtube.card("alpha-one")).toBeHidden();
    await expect(youtube.card("alpha-two")).toBeHidden();
    await expect(youtube.card("beta")).toBeVisible();

    const values = await extensionStorage.get<{ cfBlockedChannels: Array<{
      aliases: string[];
      displayName: string;
    }> }>("cfBlockedChannels");
    expect(values.cfBlockedChannels).toHaveLength(1);
    expect(values.cfBlockedChannels[0]).toMatchObject({
      aliases: ["handle:@alpha"],
      displayName: "Alpha Creator"
    });
    expect(values.cfBlockedChannels[0].displayName).not.toBe("8:41");

    await extensionPage.getByRole("button", { name: "Undo" }).click();
    await expect(youtube.card("alpha-one")).toBeVisible();
    await expect(youtube.card("alpha-two")).toBeVisible();
    expect((await extensionStorage.get<{ cfBlockedChannels: unknown[] }>("cfBlockedChannels"))
      .cfBlockedChannels).toEqual([]);
  });

  test("processes cards added after the initial YouTube render", async ({ extensionPage }) => {
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(creatorCard({
      displayName: "Initial Creator",
      handle: "@initial",
      id: "initial"
    }));

    await youtube.append(creatorCard({
      displayName: "Late Creator",
      handle: "@late",
      id: "late"
    }));

    await expect(youtube.blockButton("late")).toBeVisible();
  });

  test("recognizes membership-style lockups", async ({ extensionPage }) => {
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(creatorCard({
      displayName: "Members Creator",
      handle: "@members",
      id: "membership",
      tag: "yt-lockup-view-model"
    }));

    await expect(youtube.blockButton("membership")).toBeVisible();
  });

  test("paused mode restores blocked cards and resumes without losing the list", async ({
    extensionPage,
    extensionStorage
  }) => {
    await extensionStorage.set({
      cfBlockedChannels: [blockedCreator("@alpha", "Alpha Creator")],
      cfEnabled: false
    });
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(creatorCard({
      displayName: "Alpha Creator",
      handle: "@alpha",
      id: "alpha"
    }));

    await expect(youtube.card("alpha")).toBeVisible();
    await expect(youtube.blockButton("alpha")).toHaveCount(0);

    await extensionStorage.set({ cfEnabled: true });
    await expect(youtube.card("alpha")).toBeHidden();
  });
});

