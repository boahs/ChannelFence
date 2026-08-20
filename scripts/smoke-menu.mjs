const [webSocketUrl] = process.argv.slice(2);
if (!webSocketUrl) {
  throw new Error("Usage: node smoke-menu.mjs <websocket-url>");
}

const socket = new WebSocket(webSocketUrl);
const pending = new Map();
const exceptions = [];
let nextId = 1;

function command(method, params = {}) {
  const id = nextId++;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const handler = pending.get(message.id);
    pending.delete(message.id);
    return message.error
      ? handler.reject(new Error(message.error.message))
      : handler.resolve(message.result);
  }
  if (message.method === "Runtime.exceptionThrown") {
    const details = message.params.exceptionDetails;
    exceptions.push(details.exception?.description || details.text || "Unknown page exception");
  }
});

await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

await command("Page.enable");
await command("Page.bringToFront");
await command("Runtime.enable");

const expression = `
(async () => {
  const testId = "cf-menu-smoke-test";
  document.getElementById(testId)?.remove();
  document.querySelectorAll("[data-cf-menu-smoke-popup]").forEach((popup) => popup.remove());

  const card = document.createElement("div");
  card.id = testId;
  card.className = "yt-lockup-view-model yt-lockup-view-model--compact";

  const channel = document.createElement("a");
  channel.href = "/@ChannelFenceMenuSmoke";
  channel.textContent = "ChannelFence Menu Smoke";

  const menu = document.createElement("div");
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.setAttribute("aria-label", "More actions");
  menu.append(trigger);
  card.append(channel, menu);

  function openPopup() {
    const popup = document.createElement("ytd-menu-popup-renderer");
    popup.dataset.cfMenuSmokePopup = "true";
    const items = document.createElement("div");
    items.id = "items";
    items.setAttribute("role", "menu");
    popup.append(items);
    document.body.append(popup);
    return popup;
  }

  let latestPopup;
  trigger.addEventListener("click", () => {
    latestPopup = openPopup();
  });
  document.body.append(card);

  await new Promise((resolve) => setTimeout(resolve, 500));
  trigger.click();
  await new Promise((resolve) => setTimeout(resolve, 800));
  const blockItem = latestPopup?.querySelector(".cf-menu-item");
  const blockLabel = blockItem?.querySelector(".cf-menu-item__label")?.textContent || "";
  blockItem?.click();
  await new Promise((resolve) => setTimeout(resolve, 800));
  const blockToast = document.getElementById("cf-toast")?.innerText || "";
  const hiddenAfterBlock = card.classList.contains("cf-hidden-by-channelfence");

  trigger.click();
  await new Promise((resolve) => setTimeout(resolve, 800));
  const unblockItem = latestPopup?.querySelector(".cf-menu-item");
  const unblockLabel = unblockItem?.querySelector(".cf-menu-item__label")?.textContent || "";
  unblockItem?.click();
  await new Promise((resolve) => setTimeout(resolve, 800));
  const unblockToast = document.getElementById("cf-toast")?.innerText || "";
  const hiddenAfterUnblock = card.classList.contains("cf-hidden-by-channelfence");

  card.remove();
  document.querySelectorAll("[data-cf-menu-smoke-popup]").forEach((popup) => popup.remove());

  return {
    blockLabel,
    blockToast,
    hiddenAfterBlock,
    unblockLabel,
    unblockToast,
    hiddenAfterUnblock
  };
})()
`;

const evaluation = await command("Runtime.evaluate", {
  expression,
  returnByValue: true,
  awaitPromise: true
});
socket.close();

if (evaluation.exceptionDetails) {
  throw new Error(evaluation.exceptionDetails.exception?.description || evaluation.exceptionDetails.text);
}

const result = evaluation.result.value;
const passed = result.blockLabel === "ChannelFence: Block" &&
  result.blockToast.includes("Blocked ChannelFence Menu Smoke") &&
  result.hiddenAfterBlock === true &&
  result.unblockLabel === "ChannelFence: Unblock" &&
  result.unblockToast.includes("Unblocked ChannelFence Menu Smoke") &&
  result.hiddenAfterUnblock === false &&
  exceptions.length === 0;

if (!passed) {
  throw new Error(`Menu smoke test failed: ${JSON.stringify({ result, exceptions })}`);
}

console.log(JSON.stringify({ passed, result, pageExceptions: exceptions }));
