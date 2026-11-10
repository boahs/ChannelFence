// Match YouTube's native cards before checking ChannelFence's injected controls.
// Search can serve either renderer, including single-creator avatar stacks.
export const liveSearchResultSelector = "ytd-search :is(" +
  "ytd-video-renderer:has(ytd-channel-name a[href]), " +
  "yt-lockup-view-model:has(a[href^='/watch']):has(a[href^='/@'], a[href^='/channel/'])" +
  ")";

export const liveSearchMenuSelector = "ytd-menu-renderer button, .ytLockupMetadataViewModelMenuButton button";
