const [webSocketUrl, expressionBase64, contextName] = process.argv.slice(2);
if (!webSocketUrl || !expressionBase64) {
  throw new Error("Usage: node devtools-eval.mjs <websocket-url> <base64-expression>");
}

const expression = Buffer.from(expressionBase64, "base64").toString("utf8");
const socket = new WebSocket(webSocketUrl);
let nextId = 1;
const pending = new Map();
let selectedContextId;

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.method === "Runtime.executionContextCreated" &&
      message.params.context.name === contextName) {
    selectedContextId = message.params.context.id;
  }
  if (!message.id || !pending.has(message.id)) {
    return;
  }
  const handler = pending.get(message.id);
  pending.delete(message.id);
  return message.error
    ? handler.reject(new Error(message.error.message))
    : handler.resolve(message.result);
});

await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

function command(method, params = {}) {
  const id = nextId++;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

await command("Runtime.enable");
const result = await command("Runtime.evaluate", {
  expression,
  returnByValue: true,
  awaitPromise: true,
  ...(selectedContextId ? { contextId: selectedContextId } : {})
});
socket.close();
console.log(JSON.stringify(result.result.value ?? result.result.description ?? null, null, 2));
