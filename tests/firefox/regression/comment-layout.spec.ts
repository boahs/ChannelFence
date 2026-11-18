import { commentLayoutChecks, commentLayoutFixture, expectedCommentLayout, nativeCommentLayout } from "../../e2e/fixtures/comment-layout";
import { expect, expectCount, expectVisible, openFixture, test } from "../extension.fixture";

for (const direction of ["ltr", "rtl"] as const) {
  test(`keeps ${direction} comment authors, owner replies and timestamps aligned`, async ({ addon }) => {
    await addon.page.setViewport({ width: 960, height: 900 });
    await addon.setStorage({ cfEnabled: false });
    await openFixture(addon.page, commentLayoutFixture(direction), "/watch?v=fixture-video");
    await expectCount(addon.page, ".cf-block-button", 0);
    const native = await addon.page.evaluate(nativeCommentLayout);

    await addon.setStorage({ cfEnabled: true });
    for (const width of [960, 390]) {
      await addon.page.setViewport({ width, height: 900 });
      for (const position of ["before", "after", "before"] as const) {
        await addon.setStorage({ cfBlockButtonPosition: position });
        await expect.poll(() => addon.page.evaluate(commentLayoutChecks, { position, direction }))
          .toEqual(expectedCommentLayout);
      }
    }

    await addon.page.setViewport({ width: 960, height: 900 });
    await addon.setStorage({ cfEnabled: false });
    await expectCount(addon.page, ".cf-block-button", 0);
    expect(await addon.page.evaluate(nativeCommentLayout)).toEqual(native);
    await addon.setStorage({ cfEnabled: true });
    await expect.poll(() => addon.page.evaluate(commentLayoutChecks, { position: "before" as const, direction }))
      .toEqual(expectedCommentLayout);
    await addon.page.locator('[data-testid="ownerreply"] .cf-block-button').click();
    await expectVisible(addon.page, '[data-testid="ownerreply"]', false);
    await expectVisible(addon.page, '[data-testid="regular"]');
    expect((await addon.getStorage<{ cfBlockedChannels: Array<{ key: string }> }>("cfBlockedChannels"))
      .cfBlockedChannels.map((entry) => entry.key)).toEqual(["handle:@ownerreply"]);
  });
}
