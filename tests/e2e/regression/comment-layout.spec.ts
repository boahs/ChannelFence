import { expect, test } from "../fixtures/extension.fixture";
import { commentLayoutChecks, commentLayoutFixture, expectedCommentLayout, nativeCommentLayout } from "../fixtures/comment-layout";
import { YouTubeSurfacePage } from "../pages/youtube-surface.page";

for (const direction of ["ltr", "rtl"] as const) {
  test(`keeps ${direction} comment authors, owner replies and timestamps aligned`, async ({ extensionPage, extensionStorage }) => {
    await extensionPage.setViewportSize({ width: 960, height: 900 });
    await extensionStorage.set({ cfEnabled: false });
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(commentLayoutFixture(direction), "/watch?v=fixture-video");
    await expect(extensionPage.locator(".cf-block-button")).toHaveCount(0);
    const native = await extensionPage.evaluate(nativeCommentLayout);

    await extensionStorage.set({ cfEnabled: true });
    for (const width of [960, 390]) {
      await extensionPage.setViewportSize({ width, height: 900 });
      for (const position of ["before", "after", "before"] as const) {
        await extensionStorage.set({ cfBlockButtonPosition: position });
        await expect.poll(() => extensionPage.evaluate(commentLayoutChecks, { position, direction }))
          .toEqual(expectedCommentLayout);
      }
    }

    await extensionPage.setViewportSize({ width: 960, height: 900 });
    await extensionStorage.set({ cfEnabled: false });
    await expect(extensionPage.locator(".cf-block-button")).toHaveCount(0);
    expect(await extensionPage.evaluate(nativeCommentLayout)).toEqual(native);
    await extensionStorage.set({ cfEnabled: true });
    await expect.poll(() => extensionPage.evaluate(commentLayoutChecks, { position: "before" as const, direction }))
      .toEqual(expectedCommentLayout);
    await youtube.blockButton("ownerreply").click();
    await expect(youtube.card("ownerreply")).toBeHidden();
    await expect(youtube.card("regular")).toBeVisible();
    expect((await extensionStorage.get<{ cfBlockedChannels: Array<{ key: string }> }>("cfBlockedChannels"))
      .cfBlockedChannels.map((entry) => entry.key)).toEqual(["handle:@ownerreply"]);
  });
}
