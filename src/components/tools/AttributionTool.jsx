import { parseCsvFile } from "../../lib/csv.js";
import {
  computeAttribution,
  creditFor,
  groupJourneys,
  HALF_LIFE_DAYS,
  MODELS,
  revenueWarnings,
} from "../../lib/attribution/compute.js";
import GroupedBarChart from "../charts/GroupedBarChart.jsx";
import DataTable from "../kit/DataTable.jsx";
import ErrorNotice from "../kit/ErrorNotice.jsx";
import FileDropzone from "../kit/FileDropzone.jsx";
import StatCard from "../kit/StatCard.jsx";
import StatRow from "../kit/StatRow.jsx";
import ToolShell from "../kit/ToolShell.jsx";
import { useFileAnalysis } from "../kit/useFileAnalysis.js";

/** Parses the file, groups touchpoints into journeys and scores them under every model. */
async function analyze(/** @type {File} */ file) {
  const { rows, warning } = await parseCsvFile(file);
  const { journeys, anyRevenue, anyFallbackTime } = groupJourneys(rows);
  if (journeys.size === 0) throw new Error('No usable rows — check for a "journey_id" column.');
  return { result: { ...computeAttribution(journeys), anyRevenue, anyFallbackTime }, warning };
}

const HINT = (
  <>
    Columns: <code>journey_id</code>, <code>channel</code>, <code>timestamp</code>, optional <code>revenue</code>. One
    row per touchpoint. Nothing you upload leaves this browser tab.
  </>
);

export default function AttributionTool() {
  const { fileName, result, error, analyzeFile } = useFileAnalysis(analyze);
  const warnings = result ? revenueWarnings(result.revenueIssues) : [];

  /** @type {import("../kit/DataTable.jsx").Column<string>[]} */
  const columns = [
    { key: "channel", header: "Channel", render: (channel) => channel },
    ...MODELS.map((model) => ({
      key: model,
      header: model,
      render: (/** @type {string} */ channel) => creditFor(result, model, channel).toFixed(2),
    })),
  ];

  return (
    <ToolShell wide>
      <FileDropzone
        title="Drop a touchpoint CSV here, or click to choose a file."
        hint={HINT}
        accept=".csv,text/csv"
        onFile={analyzeFile}
      />
      <ErrorNotice message={error} />
      {result && (
        <>
          <StatRow tight>
            <StatCard label="File" value={fileName} />
            <StatCard label="Journeys" value={result.journeyCount} />
            <StatCard label="Touchpoints" value={result.touchpointCount} />
            <StatCard label="Channels" value={result.channels.length} />
          </StatRow>

          <p className="hint">
            {result.anyRevenue
              ? "Weighted by the revenue column where present (count-weighted as a fallback for journeys with no revenue value)."
              : "No revenue column found — every journey is weighted as 1 conversion."}
            {result.anyFallbackTime &&
              " Some rows had no parseable timestamp — those journeys are ordered by row order in the file instead."}{" "}
            Time-decay uses a {HALF_LIFE_DAYS}-day half-life.
          </p>

          {warnings.length > 0 && (
            <div role="status" aria-label="Revenue data warnings">
              {warnings.map((w) => (
                <p key={w}>
                  <strong>Warning:</strong> {w}
                </p>
              ))}
            </div>
          )}

          <h2>Credit by channel, across models</h2>
          <GroupedBarChart
            data={result.channels.map((channel) => ({
              group: channel,
              series: MODELS.map((m) => ({ key: m, value: Math.round(creditFor(result, m, channel) * 100) / 100 })),
            }))}
            seriesKeys={[...MODELS]}
          />

          <h2 className="heading--spaced">Full matrix</h2>
          <DataTable columns={columns} rows={result.channels} rowKey={(channel) => channel} scroll />
        </>
      )}
    </ToolShell>
  );
}
