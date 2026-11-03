// Run in the fixture page in either browser. Model YouTube consuming a native
// Next scroll to recalculate layout, using real scroll events and positions.
export function installConsumedShortsScroll(repeatReset: boolean): void {
  const shorts = document.querySelector("ytd-shorts");
  const scroller = shorts?.querySelector<HTMLElement>("#shorts-container");
  const renderer = shorts?.querySelector("ytd-reel-video-renderer");
  let owner = renderer?.querySelector<HTMLAnchorElement>("yt-reel-channel-bar-view-model a[href]");
  if (!shorts || !scroller || !renderer || !owner) {
    throw new Error("Shorts scroll-reset fixture is missing its viewer");
  }

  const permalink = document.createElement("a");
  permalink.href = location.pathname;
  permalink.hidden = true;
  renderer.append(permalink);
  const navigation = document.createElement("div");
  navigation.id = "navigation-button-down";
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", "Next video");
  const paths = [location.pathname];
  button.dataset.clickCount = "0";
  button.dataset.paths = JSON.stringify(paths);
  navigation.append(button);
  shorts.append(navigation);

  const positions = [scroller.scrollTop];
  let resetTop: number | null = null;
  scroller.dataset.resetCount = "0";
  scroller.dataset.scrollPositions = JSON.stringify(positions);
  scroller.addEventListener("scroll", () => {
    positions.push(scroller.scrollTop);
    scroller.dataset.scrollPositions = JSON.stringify(positions);
    if (resetTop !== null && Math.abs(scroller.scrollTop - resetTop) <= 2) {
      scroller.dataset.resetCount = String(Number(scroller.dataset.resetCount) + 1);
      resetTop = null;
    }
  });
  button.addEventListener("click", () => {
    const count = Number(button.dataset.clickCount) + 1;
    button.dataset.clickCount = String(count);
    if (repeatReset || count === 1) {
      const startingTop = scroller.scrollTop;
      resetTop = startingTop;
      const reset = () => {
        if (Math.abs(scroller.scrollTop - startingTop) <= 2) return;
        scroller.removeEventListener("scroll", reset);
        requestAnimationFrame(() => { scroller.scrollTop = startingTop; });
      };
      scroller.addEventListener("scroll", reset);
      // Layout can consume the first small frame of a smooth native scroll.
      scroller.scrollTop = startingTop + 8;
      return;
    }

    document.dispatchEvent(new Event("yt-navigate-start", { bubbles: true }));
    const name = count === 2 ? "Reset Allowed Creator" : "Reset Sentinel Creator";
    const handle = count === 2 ? "@resetallowed" : "@resetsentinel";
    const path = count === 2 ? "/shorts/reset-allowed" : "/shorts/reset-sentinel";
    permalink.href = path;
    const nextOwner = owner!.cloneNode(true) as HTMLAnchorElement;
    nextOwner.href = `/${handle}/shorts`;
    nextOwner.textContent = name;
    nextOwner.setAttribute("aria-label", name);
    owner!.replaceWith(nextOwner);
    owner = nextOwner;
    renderer.setAttribute("is-active", "");
    history.pushState({}, "", path);
    paths.push(path);
    button.dataset.paths = JSON.stringify(paths);
    document.dispatchEvent(new Event("yt-page-data-updated", { bubbles: true }));
    document.dispatchEvent(new Event("yt-navigate-finish", { bubbles: true }));
  });
}
