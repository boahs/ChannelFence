import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

// CI installs signed language packs matching stock Firefox so automatic
// extension translations use real browser locales, not mocked locale APIs.
const executable = process.env.CHANNELFENCE_FIREFOX_PATH;
const version = process.env.CHANNELFENCE_FIREFOX_VERSION;
if (!executable || !version || !/^\d+(?:\.\d+){1,2}$/.test(version)) {
  throw new Error("Set CHANNELFENCE_FIREFOX_PATH and CHANNELFENCE_FIREFOX_VERSION from setup-firefox.");
}
if (process.platform !== "linux" || process.arch !== "x64") {
  throw new Error("This CI language-pack installer requires the Linux x64 Firefox build.");
}

const catalogs = await readdir("_locales");
const firefoxLocales = { es: "es-ES", hi: "hi-IN" };
const locales = catalogs.filter((locale) => locale !== "en")
  .map((locale) => firefoxLocales[locale] ?? locale.replaceAll("_", "-"));
// Exercise regional Spanish selection and an untranslated browser language.
locales.push("es-MX", "pl");
const destination = path.join(path.dirname(path.resolve(executable)), "distribution", "extensions");
await mkdir(destination, { recursive: true });
await Promise.all(locales.map(async (locale) => {
  const response = await fetch(`https://archive.mozilla.org/pub/firefox/releases/${version}/linux-x86_64/xpi/${locale}.xpi`);
  if (!response.ok) throw new Error(`Firefox ${locale} language pack: HTTP ${response.status}`);
  await writeFile(path.join(destination, `langpack-${locale}@firefox.mozilla.org.xpi`),
    Buffer.from(await response.arrayBuffer()));
}));
console.log(`Installed ${locales.length} signed Firefox ${version} language packs for CI.`);
