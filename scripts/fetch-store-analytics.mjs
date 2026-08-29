import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { parseArgs } from "node:util";
import analyticsData from "@google-analytics/data";
import {
  createReportDefinitions,
  normalizeDateValue,
  normalizePropertyId,
  reportResponseToRows,
  rowsToCsv,
  safeTimestamp,
  sumMetric
} from "./store-analytics-lib.mjs";

const { BetaAnalyticsDataClient } = analyticsData;

const { values } = parseArgs({
  options: {
    "start-date": { type: "string", default: "60daysAgo" },
    "end-date": { type: "string", default: "2daysAgo" },
    output: { type: "string", default: ".analytics" },
    help: { type: "boolean", short: "h", default: false }
  }
});

if (values.help) {
  console.log(`Usage: npm run analytics:store -- [options]

Options:
  --start-date <date>  today, yesterday, NdaysAgo, or YYYY-MM-DD
  --end-date <date>    today, yesterday, NdaysAgo, or YYYY-MM-DD
  --output <path>      Local output directory (default: .analytics)
  -h, --help           Show this help`);
  process.exit(0);
}

const propertyId = normalizePropertyId(process.env.GA4_PROPERTY_ID);
const startDate = normalizeDateValue(values["start-date"], "--start-date");
const endDate = normalizeDateValue(values["end-date"], "--end-date");
const outputRoot = path.resolve(values.output);
const generatedAt = new Date();
const snapshotDirectory = path.join(outputRoot, safeTimestamp(generatedAt));
const client = new BetaAnalyticsDataClient({
  scopes: ["https://www.googleapis.com/auth/analytics.readonly"]
});
const reports = {};
const errors = [];

try {
  await client.auth.getClient();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  throw new Error(
    "Google OAuth is not configured on this computer. Install Google Cloud CLI, " +
    "enable the Google Analytics Data API, and run the Application Default Credentials login. " +
    `Original error: ${message}`
  );
}

for (const definition of createReportDefinitions(startDate, endDate)) {
  try {
    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
      ...definition.request
    });
    const rows = reportResponseToRows(response);
    reports[definition.key] = {
      label: definition.label,
      rowCount: response.rowCount || rows.length,
      metadata: {
        dataLossFromOtherRow: Boolean(response.metadata?.dataLossFromOtherRow),
        subjectToThresholding: Boolean(response.metadata?.subjectToThresholding)
      },
      rows
    };
  } catch (error) {
    errors.push({
      report: definition.key,
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

if (!Object.keys(reports).length) {
  const detail = errors.map((error) => `${error.report}: ${error.message}`).join("\n");
  throw new Error(`No Analytics reports could be downloaded.\n${detail}`);
}

const snapshot = {
  schemaVersion: 2,
  generatedAt: generatedAt.toISOString(),
  property: `properties/${propertyId}`,
  dateRange: { startDate, endDate },
  reports,
  errors
};

await fs.mkdir(snapshotDirectory, { recursive: true });
await fs.writeFile(
  path.join(snapshotDirectory, "snapshot.json"),
  `${JSON.stringify(snapshot, null, 2)}\n`,
  "utf8"
);
await fs.mkdir(outputRoot, { recursive: true });
await fs.writeFile(
  path.join(outputRoot, "latest.json"),
  `${JSON.stringify(snapshot, null, 2)}\n`,
  "utf8"
);

for (const [key, report] of Object.entries(reports)) {
  await fs.writeFile(path.join(snapshotDirectory, `${key}.csv`), rowsToCsv(report.rows), "utf8");
}

const dailyRows = reports.daily?.rows || [];
const eventRows = reports.events?.rows || [];
const installRows = eventRows.filter((row) => row.eventName === "install");
console.log(`Saved Chrome Web Store analytics to ${snapshotDirectory}`);
console.log(`Date range: ${startDate} through ${endDate}`);
console.log(`Page views: ${sumMetric(dailyRows, "screenPageViews")}`);
console.log(`Install events: ${sumMetric(installRows, "eventCount")}`);
console.log("Treat the newest 48 hours as provisional and backfill them on the next run.");
if (errors.length) {
  console.warn(`Completed with ${errors.length} unavailable report(s):`);
  for (const error of errors) {
    console.warn(`- ${error.report}: ${error.message}`);
  }
}
