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

// YouTube reuses one renderer inside numbered sequence cells. The first Next
// can be consumed by sizing, before a later scroll actually loads its target.
export function installShortsSequenceStartup(firstNext: "zero" | "tiny" | "sizing" | "moved"): void {
  const shorts = document.querySelector("ytd-shorts");
  const scroller = shorts?.querySelector<HTMLElement>("#shorts-container");
  const inner = scroller?.querySelector<HTMLElement>("#shorts-inner-container");
  const renderer = inner?.querySelector<HTMLElement>("ytd-reel-video-renderer");
  let owner = renderer?.querySelector<HTMLAnchorElement>("yt-reel-channel-bar-view-model a[href]");
  if (!shorts || !scroller || !inner || !renderer || !owner) {
    throw new Error("Shorts sequence fixture is missing its viewer");
  }
  const cells = [0, 1, 2].map(index => {
    const cell = document.createElement("div");
    cell.id = String(index);
    cell.className = "reel-video-in-sequence-new";
    cell.style.height = "500px";
    cell.textContent = index ? "Preloaded thumbnail" : "";
    return cell;
  });
  cells[0].append(renderer);
  inner.replaceChildren(...cells);
  renderer.setAttribute("is-active", "");
  const permalink = document.createElement("a");
  permalink.href = location.pathname;
  permalink.hidden = true;
  renderer.append(permalink);

  const navigation = document.createElement("div");
  navigation.id = "navigation-button-down";
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", "Next video");
  button.dataset.clickCount = "0";
  navigation.append(button);
  shorts.append(navigation);
  scroller.dataset.resetCount = "0";
  scroller.dataset.paths = JSON.stringify([location.pathname]);
  const positions = [scroller.scrollTop];
  scroller.dataset.scrollPositions = JSON.stringify(positions);

  let currentIndex = 0;
  let resetting = false;
  let routeHeld = false;
  let sizingPhase = firstNext === "sizing" ? "measure" : "ready";
  scroller.dataset.sizingPhase = sizingPhase;
  const finishRoute = () => {
    const sentinel = currentIndex === 2;
    const handle = sentinel ? "@sequencesentinel" : "@sequenceallowed";
    const name = sentinel ? "Sequence Sentinel Creator" : "Sequence Allowed Creator";
    const path = sentinel ? "/shorts/sequence-sentinel" : "/shorts/sequence-allowed";
    document.dispatchEvent(new Event("yt-navigate-start", { bubbles: true }));
    permalink.href = path;
    const nextOwner = owner!.cloneNode(true) as HTMLAnchorElement;
    nextOwner.href = `/${handle}/shorts`;
    nextOwner.textContent = name;
    nextOwner.setAttribute("aria-label", name);
    owner!.replaceWith(nextOwner);
    owner = nextOwner;
    history.pushState({}, "", path);
    const paths = JSON.parse(scroller.dataset.paths!) as string[];
    paths.push(path);
    scroller.dataset.paths = JSON.stringify(paths);
    document.dispatchEvent(new Event("yt-page-data-updated", { bubbles: true }));
    document.dispatchEvent(new Event("yt-navigate-finish", { bubbles: true }));
  };
  document.addEventListener("fixture-finish-shorts-route", () => {
    routeHeld = false;
    scroller.scrollTop = currentIndex * 500;
    finishRoute();
  }, { once: true });
  scroller.addEventListener("scroll", () => {
    positions.push(scroller.scrollTop);
    scroller.dataset.scrollPositions = JSON.stringify(positions);
    if (firstNext === "sizing" && scroller.scrollTop === 0 && positions.some(top => top > 2)) {
      scroller.dataset.resetCount = "1";
    }
    if (sizingPhase === "measure") {
      sizingPhase = scroller.dataset.sizingPhase = "reset";
      requestAnimationFrame(() => { scroller.scrollTop = 16; });
      return;
    }
    if (sizingPhase === "reset") {
      sizingPhase = scroller.dataset.sizingPhase = "settling";
      requestAnimationFrame(() => { scroller.scrollTop = 0; });
      // Native sizing clears shouldUpdateItemHeight after its 100ms reset task.
      setTimeout(() => { sizingPhase = scroller.dataset.sizingPhase = "ready"; }, 100);
      return;
    }
    if (sizingPhase === "settling") return;
    if (resetting) {
      if (scroller.scrollTop > 0) {
        requestAnimationFrame(() => { scroller.scrollTop = 0; });
      } else {
        resetting = false;
        scroller.dataset.resetCount = "1";
      }
      return;
    }
    const index = Math.min(2, Math.round(scroller.scrollTop / 500));
    if (index <= currentIndex) return;
    currentIndex = index;
    cells[index].append(renderer);
    if (!routeHeld) finishRoute();
  });
  button.addEventListener("click", () => {
    const clicks = Number(button.dataset.clickCount) + 1;
    button.dataset.clickCount = String(clicks);
    if (clicks === 1) {
      if (firstNext === "sizing") {
        scroller.scrollTop = 8;
      } else if (firstNext === "tiny") {
        resetting = true;
        scroller.scrollTop = 1;
      } else if (firstNext === "moved") {
        // Native loadVideo reparents the shared renderer before its URL update.
        currentIndex = 1;
        routeHeld = true;
        cells[1].append(renderer);
        // A concurrent sizing reset must not restore the old renderer's target.
        scroller.addEventListener("scroll", () => {
          requestAnimationFrame(() => { scroller.scrollTop = 0; });
        }, { once: true });
        scroller.scrollTop = 500;
      }
      return;
    }
    cells[Math.min(2, currentIndex + 1)].scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
}
