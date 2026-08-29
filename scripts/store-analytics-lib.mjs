const PROPERTY_ID_PATTERN = /^\d+$/;
const DATE_VALUE_PATTERN = /^(?:today|yesterday|\d+daysAgo|\d{4}-\d{2}-\d{2})$/;

export function normalizePropertyId(value) {
  const propertyId = String(value || "")
    .trim()
    .replace(/^properties\//, "");

  if (!PROPERTY_ID_PATTERN.test(propertyId)) {
    throw new Error(
      "GA4_PROPERTY_ID must be the numeric Analytics property ID, not a G- measurement ID."
    );
  }
  return propertyId;
}

export function normalizeDateValue(value, label) {
  const dateValue = String(value || "").trim();
  if (!DATE_VALUE_PATTERN.test(dateValue)) {
    throw new Error(`${label} must be today, yesterday, NdaysAgo, or YYYY-MM-DD.`);
  }
  return dateValue;
}

export function createReportDefinitions(startDate, endDate) {
  const dateRanges = [{ startDate, endDate }];
  const listingEventFilter = {
    filter: {
      fieldName: "eventName",
      inListFilter: {
        values: ["page_view", "install"],
        caseSensitive: true
      }
    }
  };

  return [
    {
      key: "daily",
      label: "Daily listing performance",
      request: {
        dateRanges,
        dimensions: [{ name: "date" }],
        metrics: [
          { name: "screenPageViews" },
          { name: "totalUsers" },
          { name: "activeUsers" },
          { name: "newUsers" },
          { name: "sessions" },
          { name: "engagedSessions" },
          { name: "eventCount" }
        ],
        orderBys: [{ dimension: { dimensionName: "date" } }]
      }
    },
    {
      key: "events",
      label: "Store listing and install events",
      request: {
        dateRanges,
        dimensions: [{ name: "date" }, { name: "eventName" }],
        metrics: [{ name: "eventCount" }, { name: "totalUsers" }],
        dimensionFilter: {
          filter: {
            fieldName: "eventName",
            inListFilter: {
              values: [
                "page_view",
                "session_start",
                "first_visit",
                "user_engagement",
                "install"
              ],
              caseSensitive: true
            }
          }
        },
        orderBys: [
          { dimension: { dimensionName: "date" } },
          { dimension: { dimensionName: "eventName" } }
        ]
      }
    },
    {
      key: "acquisition",
      label: "Traffic acquisition",
      request: {
        dateRanges,
        dimensions: [
          { name: "date" },
          { name: "eventName" },
          { name: "sessionSource" },
          { name: "sessionMedium" },
          { name: "sessionCampaignName" }
        ],
        metrics: [{ name: "eventCount" }],
        dimensionFilter: listingEventFilter,
        orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
        limit: 1000
      }
    },
    {
      key: "assetAcquisition",
      label: "Asset-level traffic acquisition (best effort)",
      request: {
        dateRanges,
        dimensions: [
          { name: "date" },
          { name: "eventName" },
          { name: "sessionSource" },
          { name: "sessionMedium" },
          { name: "sessionCampaignName" },
          { name: "sessionManualAdContent" }
        ],
        metrics: [{ name: "eventCount" }],
        dimensionFilter: listingEventFilter,
        orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
        limit: 1000
      }
    },
    {
      key: "audience",
      label: "Country and operating system",
      request: {
        dateRanges,
        dimensions: [{ name: "country" }, { name: "operatingSystem" }],
        metrics: [{ name: "totalUsers" }, { name: "screenPageViews" }],
        orderBys: [{ metric: { metricName: "totalUsers" }, desc: true }],
        limit: 100
      }
    }
  ];
}

function metricValue(value) {
  const text = String(value ?? "");
  return /^-?\d+(?:\.\d+)?$/.test(text) ? Number(text) : text;
}

export function reportResponseToRows(response) {
  const dimensionNames = (response.dimensionHeaders || []).map((header) => header.name);
  const metricNames = (response.metricHeaders || []).map((header) => header.name);

  return (response.rows || []).map((row) => {
    const record = {};
    dimensionNames.forEach((name, index) => {
      record[name] = row.dimensionValues?.[index]?.value || "";
    });
    metricNames.forEach((name, index) => {
      record[name] = metricValue(row.metricValues?.[index]?.value);
    });
    return record;
  });
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function rowsToCsv(rows) {
  if (!rows.length) {
    return "";
  }
  const headers = Object.keys(rows[0]);
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => csvCell(row[header])).join(","));
  }
  return `${lines.join("\n")}\n`;
}

export function safeTimestamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

export function sumMetric(rows, metricName) {
  return rows.reduce((total, row) => {
    const value = Number(row[metricName]);
    return total + (Number.isFinite(value) ? value : 0);
  }, 0);
}
