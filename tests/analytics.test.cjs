"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const analyticsModule = import("../scripts/store-analytics-lib.mjs");

test("accepts only a numeric GA4 property ID", async () => {
  const { normalizePropertyId } = await analyticsModule;
  assert.equal(normalizePropertyId("123456789"), "123456789");
  assert.equal(normalizePropertyId("properties/123456789"), "123456789");
  assert.throws(() => normalizePropertyId("G-ABC123"), /numeric Analytics property ID/);
});

test("creates aggregate listing, event, acquisition, asset, and audience reports", async () => {
  const { createReportDefinitions } = await analyticsModule;
  const definitions = createReportDefinitions("7daysAgo", "today");
  assert.deepEqual(
    definitions.map((definition) => definition.key),
    ["daily", "events", "acquisition", "assetAcquisition", "audience"]
  );
  assert.deepEqual(definitions[0].request.dateRanges, [
    { startDate: "7daysAgo", endDate: "today" }
  ]);
  assert.deepEqual(
    definitions.find((definition) => definition.key === "acquisition")
      .request.dimensionFilter.filter.inListFilter.values,
    ["page_view", "install"]
  );
  assert.deepEqual(
    definitions.find((definition) => definition.key === "assetAcquisition")
      .request.dimensions.map((dimension) => dimension.name),
    [
      "date",
      "eventName",
      "sessionSource",
      "sessionMedium",
      "sessionCampaignName",
      "sessionManualAdContent"
    ]
  );
});

test("maps Analytics responses to records without retaining API wrappers", async () => {
  const { reportResponseToRows } = await analyticsModule;
  const rows = reportResponseToRows({
    dimensionHeaders: [{ name: "date" }, { name: "eventName" }],
    metricHeaders: [{ name: "eventCount" }],
    rows: [{
      dimensionValues: [{ value: "20260828" }, { value: "install" }],
      metricValues: [{ value: "7" }]
    }]
  });
  assert.deepEqual(rows, [{ date: "20260828", eventName: "install", eventCount: 7 }]);
});

test("writes deterministic CSV with escaped cells", async () => {
  const { rowsToCsv } = await analyticsModule;
  assert.equal(
    rowsToCsv([{ source: "site, campaign", sessions: 2 }]),
    'source,sessions\n"site, campaign",2\n'
  );
  assert.equal(rowsToCsv([]), "");
});

test("validates supported Analytics date values", async () => {
  const { normalizeDateValue } = await analyticsModule;
  assert.equal(normalizeDateValue("30daysAgo", "start"), "30daysAgo");
  assert.equal(normalizeDateValue("2026-08-28", "start"), "2026-08-28");
  assert.throws(() => normalizeDateValue("last month", "start"), /must be/);
});
