export const shortsRendererTags = ["ytd-reel-video-renderer", "ytd-reel-video-renderer-cow"] as const;

export function shortsRendererQueue(tag: typeof shortsRendererTags[number]): string {
  // The cow overlay/metapanel/action-bar nesting comes from the November 2026
  // live failure. Keep several reels mounted, as the real Shorts viewer does.
  const reels = ["first", "second", "third"].map((name, index) => `
    <${tag} data-testid="${name}-reel" ${index === 0 ? "is-active" : ""}>
      <div id="short-video-container">
        <div class="ytdReelVideoRendererPlayerWrapper">
          <div id="player"><video muted></video></div>
        </div>
        <ytd-reel-player-overlay-renderer-cow>
          <yt-reel-player-overlay-view-model>
            <div>
              <div><yt-reel-metapanel-view-model><div>
                <yt-reel-channel-bar-view-model>
                  <span><a href="/@${name}creator/shorts">${name} creator</a></span>
                </yt-reel-channel-bar-view-model>
                <a href="/shorts/${name}">${name} video</a>
              </div></yt-reel-metapanel-view-model></div>
              <reel-action-bar-view-model>
                <button aria-label="Like this video">Like</button>
                <button data-testid="${name}-menu" aria-label="More">More</button>
              </reel-action-bar-view-model>
            </div>
          </yt-reel-player-overlay-view-model>
        </ytd-reel-player-overlay-renderer-cow>
      </div>
    </${tag}>`).join("");

  const viewer = `
    <style>
      ytd-shorts { width: 600px; }
      #shorts-container { height: 480px; overflow-y: auto; }
      #shorts-container > div > ${tag} {
        box-sizing: border-box; display: block; height: 480px; margin: 0; padding: 12px;
      }
      #shorts-container #player { height: 100px; }
    </style>
    <ytd-shorts>
      <div id="shorts-container"><div id="shorts-inner-container">${reels}</div></div>
      <div id="navigation-button-down"><button>Next video</button></div>
    </ytd-shorts>`;

  // YouTube creates its reels in page JavaScript, rather than parsing them from
  // the initial HTML response. Escape markup so it cannot terminate this script.
  return `
    <script>
      document.body.insertAdjacentHTML('beforeend', ${JSON.stringify(viewer).replaceAll("<", "\\u003c")});
      const reels = Array.from(document.querySelectorAll('${tag}'));
      const scroller = document.querySelector('#shorts-container');
      const nextButton = document.querySelector('#navigation-button-down button');
      let activeIndex = 0;
      function showReel(index) {
        if (index === activeIndex || !reels[index]) return;
        document.dispatchEvent(new Event('yt-navigate-start', { bubbles: true }));
        reels[activeIndex].removeAttribute('is-active');
        activeIndex = index;
        reels[index].setAttribute('is-active', '');
        history.pushState({}, '', reels[index].querySelector('a[href^="/shorts/"]').getAttribute('href'));
        nextButton.disabled = index === reels.length - 1;
        document.dispatchEvent(new Event('yt-navigate-finish', { bubbles: true }));
      }
      nextButton.addEventListener('click', () => {
        showReel(activeIndex + 1);
        scroller.scrollTop = activeIndex * 480;
      });
      scroller.addEventListener('scroll', () => showReel(Math.round(scroller.scrollTop / 480)));
    </script>`;
}
