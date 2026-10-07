import { MODELS, creditFor } from "../../../lib/attribution/compute.js";
import { formatCredit, formatShare, modelTotal, rankByModel, shareFor } from "../../../lib/attribution/output.js";
import DataTable from "../../kit/DataTable.jsx";

/** @typedef {{ key: string, channel: string, isTotal: boolean }} MatrixRow */

const TOTAL_KEY = "\u0000total";
const numberCell = (/** @type {{ isTotal: boolean }} */ row) =>
  `data-table__cell--number${row.isTotal ? " data-table__cell--total" : ""}`;

/**
 * Credit matrix with a total row, the share of each model's credit, and rank by model.
 * @param {{ result: import("../../../lib/attribution/compute.js").AttributionResult, unit: "revenue" | "conversions" }} props
 */
export default function ResultTables({ result, unit }) {
  /** @type {MatrixRow[]} */
  const rows = [
    ...result.channels.map((channel) => ({ key: `c:${channel}`, channel, isTotal: false })),
    { key: TOTAL_KEY, channel: "Total", isTotal: true },
  ];
  const label = (/** @type {MatrixRow} */ row) => row.channel;
  const modelColumns = (/** @type {(row: (typeof rows)[number], model: string) => string} */ cell) =>
    MODELS.map((model) => ({
      key: model,
      header: model,
      render: (/** @type {(typeof rows)[number]} */ row) => cell(row, model),
      cellClassName: numberCell,
    }));
  const base = [{ key: "channel", header: "Channel", render: label }];

  const ranks = rankByModel(result);
  const rankRows = ranks.map((r) => ({ key: `r:${r.channel}`, ...r }));

  return (
    <>
      <h2 className="heading--spaced">Credit by model</h2>
      <DataTable
        scroll
        rows={rows}
        rowKey={(r) => r.key}
        columns={[
          ...base,
          ...modelColumns((row, model) =>
            formatCredit(row.isTotal ? modelTotal(result, model) : creditFor(result, model, row.channel), unit),
          ),
        ]}
      />

      <h2 className="heading--spaced">Share of each model&apos;s credit</h2>
      <DataTable
        scroll
        rows={rows}
        rowKey={(r) => r.key}
        columns={[
          ...base,
          ...modelColumns((row, model) => (row.isTotal ? "100.0%" : formatShare(shareFor(result, model, row.channel)))),
        ]}
      />

      <h2 className="heading--spaced">Rank by model</h2>
      <p className="hint">1 is the channel with the most credit. A spread above 0 means the models disagree.</p>
      <DataTable
        scroll
        rows={rankRows}
        rowKey={(r) => r.key}
        columns={[
          { key: "channel", header: "Channel", render: (r) => r.channel },
          ...MODELS.map((model) => ({
            key: model,
            header: model,
            render: (/** @type {(typeof rankRows)[number]} */ r) => r.ranks.get(model),
            cellClassName: () => "data-table__cell--number",
          })),
          { key: "spread", header: "Spread", render: (r) => r.spread, cellClassName: () => "data-table__cell--number" },
        ]}
      />
    </>
  );
}
