import fs from "node:fs";

const [webSocketUrl, outputPath, navigationUrl, widthValue, heightValue] = process.argv.slice(2);
if (!webSocketUrl || !outputPath) {
  throw new Error("Usage: node capture-page.mjs <websocket-url> <output.png> [url] [width] [height]");
}

const width = Number(widthValue || 1280);
const height = Number(heightValue || 800);
const socket = new WebSocket(webSocketUrl);
const pending = new Map();
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
    if (message.error) {
      handler.reject(new Error(message.error.message));
    } else {
      handler.resolve(message.result);
    }
  } else if (message.method === "Page.loadEventFired" && loadResolver) {
    loadResolver();
    loadResolver = undefined;
  }
});

await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

await command("Page.enable");
await command("Runtime.enable");
await command("Emulation.setDeviceMetricsOverride", {
  width,
  height,
  deviceScaleFactor: 1,
  mobile: false
});

if (navigationUrl) {
  const loaded = new Promise((resolve) => {
    loadResolver = resolve;
  });
  await command("Page.navigate", { url: navigationUrl });
  await Promise.race([loaded, new Promise((resolve) => setTimeout(resolve, 10000))]);
}

await command("Runtime.evaluate", {
  expression: "document.fonts && document.fonts.ready",
  awaitPromise: true,
  returnByValue: true
});
await new Promise((resolve) => setTimeout(resolve, 500));

const screenshot = await command("Page.captureScreenshot", {
  format: "png",
  fromSurface: true,
  captureBeyondViewport: false
});
fs.writeFileSync(outputPath, Buffer.from(screenshot.data, "base64"));
socket.close();
console.log(outputPath);
