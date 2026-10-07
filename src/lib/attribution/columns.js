/**
 * Column detection for touchpoint files. Headers are matched after dropping case, spaces and punctuation, so
 * "Journey ID", "journey_id" and "journey-id" are the same header. The user can override every choice.
 */

/** @typedef {"journey" | "channel" | "timestamp" | "revenue" | "converted" | "touchType"} FieldKey */
/** @typedef {Record<FieldKey, string>} ColumnMapping Header text per field, "" when there is no such column. */

/** @type {ReadonlyArray<{ key: FieldKey, label: string, required: boolean, aliases: string[] }>} */
export const FIELDS = [
  {
    key: "journey",
    label: "Journey ID",
    required: true,
    aliases: [
      "journeyid",
      "journey",
      "userid",
      "clientid",
      "sessionid",
      "visitorid",
      "customerid",
      "leadid",
      "contactid",
      "accountid",
      "pathid",
    ],
  },
  {
    key: "channel",
    label: "Channel",
    required: true,
    aliases: [
      "channel",
      "marketingchannel",
      "channelname",
      "touchpoint",
      "sourcemedium",
      "source",
      "utmsource",
      "medium",
    ],
  },
  {
    key: "timestamp",
    label: "Timestamp",
    required: false,
    aliases: [
      "timestamp",
      "date",
      "datetime",
      "eventtime",
      "eventdate",
      "touchtime",
      "touchdate",
      "createdat",
      "occurredat",
      "time",
    ],
  },
  {
    key: "revenue",
    label: "Revenue",
    required: false,
    aliases: [
      "revenue",
      "conversionrevenue",
      "conversionvalue",
      "value",
      "amount",
      "sales",
      "orderrevenue",
      "totalrevenue",
      "dealvalue",
    ],
  },
  {
    key: "converted",
    label: "Converted",
    required: false,
    aliases: ["converted", "isconverted", "conversion", "convertedflag", "didconvert", "purchased", "won", "iswon"],
  },
  {
    key: "touchType",
    label: "Touch type",
    required: false,
    aliases: ["touchtype", "touchpointtype", "interactiontype", "eventtype", "engagementtype", "adinteraction"],
  },
];

/** @param {string} header @returns {string} Header with case, spaces, punctuation and a BOM removed. */
export const squashHeader = (header) =>
  header
    .replace(/^\uFEFF/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/**
 * @param {string[]} headers Header text as it appears in the file.
 * @returns {ColumnMapping} The best header for each field. A header is never used for two fields.
 */
export function detectColumns(headers) {
  const squashed = headers.map(squashHeader);
  const taken = new Set();
  const mapping = /** @type {ColumnMapping} */ ({
    journey: "",
    channel: "",
    timestamp: "",
    revenue: "",
    converted: "",
    touchType: "",
  });
  FIELDS.forEach(({ key, aliases }) => {
    for (const alias of aliases) {
      const at = squashed.findIndex((h, i) => h === alias && !taken.has(i));
      if (at >= 0) {
        mapping[key] = headers[at];
        taken.add(at);
        return;
      }
    }
  });
  return mapping;
}

/**
 * @param {ColumnMapping} mapping
 * @returns {string[]} Labels of the required fields that have no column.
 */
export function missingRequired(mapping) {
  return FIELDS.filter((f) => f.required && !mapping[f.key]).map((f) => f.label);
}
