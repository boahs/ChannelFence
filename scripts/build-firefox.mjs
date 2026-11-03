import { cp, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cmd } from "web-ext";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async (file) => JSON.parse(await readFile(path.join(root, file), "utf8"));
const baseManifest = await readJson("manifest.json");
const firefoxManifest = { ...baseManifest, ...await readJson("manifest.firefox.json") };
const overrides = await readJson("scripts/firefox-locales.json");
if (!/^\d+(?:\.\d+){0,3}$/.test(firefoxManifest.version)) {
  throw new Error("Invalid package version");
}

const dist = path.join(root, "dist");
const name = `ChannelFence-${firefoxManifest.version}-firefox`;
const sourceDir = path.resolve(dist, name);
// Only this generated package directory may be replaced on a repeated build.
if (path.dirname(sourceDir) !== dist || !sourceDir.startsWith(`${root}${path.sep}`)) {
  throw new Error(`Unsafe package directory: ${sourceDir}`);
}
await rm(sourceDir, { recursive: true, force: true });
await mkdir(path.join(sourceDir, "assets", "icons"), { recursive: true });
for (const entry of ["LICENSE", "src", "ui", "_locales"]) {
  await cp(path.join(root, entry), path.join(sourceDir, entry), { recursive: true });
}
for (const size of [16, 32, 48, 128, 512]) {
  const icon = `assets/icons/channelfence-${size}.png`;
  await cp(path.join(root, icon), path.join(sourceDir, icon));
}
await writeFile(path.join(sourceDir, "manifest.json"), `${JSON.stringify(firefoxManifest, null, 2)}\n`);

for (const locale of await readdir(path.join(sourceDir, "_locales"))) {
  const messages = await readJson(`_locales/${locale}/messages.json`);
  if (!overrides[locale]) {
    throw new Error(`Missing Firefox copy for ${locale}`);
  }
  for (const [key, message] of Object.entries(overrides[locale])) {
    messages[key].message = message;
  }
  await writeFile(path.join(sourceDir, "_locales", locale, "messages.json"),
    `${JSON.stringify(messages, null, 2)}\n`);
}

// Match the English fallback markup to the Firefox catalogs. The Chrome review
// link is omitted until a published Firefox listing has a verified review URL.
for (const file of ["options.html", "welcome.html", "privacy.html"]) {
  const target = path.join(sourceDir, "ui", file);
  let html = await readFile(target, "utf8");
  if (file === "options.html") {
    const review = /\r?\n      <div class="review-note">[\s\S]*?<\/a>\r?\n      <\/div>/;
    if (!review.test(html)) {
      throw new Error("Could not find the Chrome review block");
    }
    html = html.replace(review, "");
  }
  for (const [key, message] of Object.entries(overrides.en)) {
    const element = new RegExp(`(<(?:p|span|div)\\b[^>]*data-i18n="${key}"[^>]*>)([\\s\\S]*?)(<\\/(?:p|span|div)>)`, "g");
    html = html.replace(element, (_match, opening, content, closing) => {
      const link = content.match(/<a\b[\s\S]*?<\/a>/)?.[0];
      return opening + (link ? message.replace(/\$link\$/i, () => link) : message) + closing;
    });
  }
  await writeFile(target, html);
}

const report = await cmd.lint({ sourceDir, artifactsDir: dist, warningsAsErrors: true },
  { shouldExitProgram: false });
if (report.errors.length || report.warnings.length) {
  throw new Error("Firefox package did not pass Mozilla validation");
}
const { extensionPath } = await cmd.build({
  sourceDir, artifactsDir: dist, filename: `${name}.zip`, overwriteDest: true
});
const zip = path.join(dist, `${name}.zip`);
// web-ext normalizes the filename to lowercase; use the existing release naming.
if (extensionPath !== zip) {
  await rename(extensionPath, zip);
}
console.log(`Firefox test folder: ${sourceDir}\nUnsigned Mozilla upload package: ${zip}`);
