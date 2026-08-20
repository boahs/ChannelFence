import fs from "node:fs";

const [webSocketUrl, screenshotPath] = process.argv.slice(2);
if (!webSocketUrl) {
  throw new Error("Usage: node smoke-youtube.mjs <websocket-url> [screenshot.png]");
}

const socket = new WebSocket(webSocketUrl);
const pending = new Map();
const exceptions = [];
const executionContexts = [];
const logEntries = [];
let nextId = 1;
let loadResolver;

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
  if (message.method === "Page.loadEventFired" && loadResolver) {
    loadResolver();
    loadResolver = undefined;
  }
  if (message.method === "Runtime.exceptionThrown") {
    const details = message.params.exceptionDetails;
    exceptions.push(details.exception?.description || details.text || "Unknown page exception");
  }
  if (message.method === "Runtime.executionContextCreated") {
    executionContexts.push(message.params.context.name || "<default>");
  }
  if (message.method === "Log.entryAdded") {
    logEntries.push(message.params.entry.text || "Unknown log entry");
  }
});

await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

await command("Page.enable");
await command("Runtime.enable");
await command("Log.enable");
await command("Emulation.setDeviceMetricsOverride", {
  width: 1280,
  height: 800,
  deviceScaleFactor: 1,
  mobile: false
});

const loaded = new Promise((resolve) => {
  loadResolver = resolve;
});
await command("Page.navigate", { url: "https://www.youtube.com/@YouTube" });
await Promise.race([loaded, new Promise((resolve) => setTimeout(resolve, 15000))]);

let buttonFound = false;
for (let attempt = 0; attempt < 30; attempt += 1) {
  const result = await command("Runtime.evaluate", {
    expression: "Boolean(document.querySelector('.cf-block-button'))",
    returnByValue: true
  });
  if (result.result.value === true) {
    buttonFound = true;
    break;
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
}

if (!buttonFound) {
  const diagnostics = await command("Runtime.evaluate", {
    expression: "({ title: document.title, url: location.href, body: document.body?.innerText.slice(0, 300) })",
    returnByValue: true
  });
  throw new Error(`ChannelFence button was not found: ${JSON.stringify({
    ...diagnostics.result.value,
    pageExceptions: exceptions,
    executionContexts,
    logEntries
  })}`);
}

await command("Runtime.evaluate", {
  expression: "document.querySelector('.cf-block-button').click()"
});
await new Promise((resolve) => setTimeout(resolve, 1200));

const blocked = await command("Runtime.evaluate", {
  expression: "Boolean(document.querySelector('#cf-hard-block-overlay'))",
  returnByValue: true
});
if (blocked.result.value !== true) {
  throw new Error("Clicking the block button did not produce the direct-page block screen.");
}

if (screenshotPath) {
  const screenshot = await command("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false
  });
  fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, "base64"));
}

socket.close();
console.log(JSON.stringify({ buttonFound, overlayFound: true, pageExceptions: exceptions }));
