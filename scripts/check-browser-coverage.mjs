import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "node_modules/playwright/cli.js");
const key = (kind, file, titles) => JSON.stringify([kind, file.replaceAll("\\", "/"), ...titles]);

// These are the same assertions against each browser's native language API.
// Keep exceptions exact so a newly added Chrome scenario cannot match by accident.
const equivalents = new Map([
  [key("fixture", "regression/language-override.spec.ts", ["extension language override",
    "updates open extension pages, persists the selection, and returns to Chrome's language"]),
  key("fixture", "regression/language-override.spec.ts", ["extension language override",
    "updates open extension pages, persists the selection, and returns to Firefox's language"])],
  [key("fixture", "regression/localized-ui.spec.ts", ["Latin American Spanish browser locale",
    "automatically uses the base Spanish catalog for static and dynamic messages"]),
  key("fixture", "regression/localized-ui.spec.ts", ["Latin American Spanish browser locale",
    "automatically resolves the base catalog for static and dynamic messages"])],
  [key("fixture", "regression/localized-ui.spec.ts", ["untranslated browser locale",
    "falls back to English for both static and dynamic messages"]),
  key("fixture", "regression/localized-ui.spec.ts", ["untranslated browser locale",
    "automatically resolves the base catalog for static and dynamic messages"])]
]);

function discover(config, fixtureProject, liveProject) {
  const report = JSON.parse(execFileSync(process.execPath, [cli, "test", `--config=${config}`,
    `--project=${fixtureProject}`, `--project=${liveProject}`, "--list", "--reporter=json"],
  { cwd: root, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }));
  if (report.errors?.length) throw new Error(JSON.stringify(report.errors));
  const cases = new Set();
  function visit(suite, titles) {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests) {
        const kind = test.projectName === fixtureProject ? "fixture" : "live";
        cases.add(key(kind, spec.file, [...titles, spec.title]));
      }
    }
    for (const child of suite.suites ?? []) visit(child, [...titles, child.title]);
  }
  // The top-level suites are filenames, already represented by spec.file.
  for (const suite of report.suites) visit(suite, []);
  if (!cases.size) throw new Error(`${config} discovered no tests`);
  return cases;
}

const chrome = discover("playwright.config.ts", "extension", "live-youtube");
const firefox = discover("playwright.firefox.config.ts", "firefox", "firefox-live");
const missing = [...chrome].filter((test) => !firefox.has(equivalents.get(test) ?? test));
if (missing.length) {
  console.error("Firefox coverage is missing these Chrome scenarios:");
  for (const test of missing) {
    const [kind, file, ...titles] = JSON.parse(test);
    console.error(`  [${kind}] ${file}: ${titles.join(" > ")}`);
  }
  process.exitCode = 1;
} else {
  console.log(`Firefox covers all ${chrome.size} Chrome fixture/live scenarios (${firefox.size} Firefox tests discovered).`);
}
