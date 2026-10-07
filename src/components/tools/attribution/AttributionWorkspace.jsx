import { useMemo, useState } from "react";
import { DEFAULT_HALF_LIFE_DAYS, MODELS, creditFor } from "../../../lib/attribution/compute.js";
import { parseHalfLifeDays, parseLookbackDays } from "../../../lib/attribution/inputs.js";
import { methodNote, revenueNote } from "../../../lib/attribution/notes.js";
import { matrixCsv, unitLabel } from "../../../lib/attribution/output.js";
import { analyzeRows, DEFAULT_OPTIONS } from "../../../lib/attribution/prepare.js";
import { downloadText } from "../../../lib/download.js";
import GroupedBarChart from "../../charts/GroupedBarChart.jsx";
import StatCard from "../../kit/StatCard.jsx";
import StatRow from "../../kit/StatRow.jsx";
import OptionsPanel from "./OptionsPanel.jsx";
import QualityPanel from "./QualityPanel.jsx";
import ResultTables from "./ResultTables.jsx";

/**
 * Everything below the dropzone for one uploaded file: options, analysis, data-quality notes and results.
 * Remounted for each upload, so options never carry over between files.
 * @param {{ fileName: string, rows: Array<Record<string, string>>, headers: string[] }} props
 */
export default function AttributionWorkspace({ fileName, rows, headers }) {
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  const [lookback, setLookback] = useState("");
  const [halfLife, setHalfLife] = useState(String(DEFAULT_HALF_LIFE_DAYS));
  const [currencyText, setCurrencyText] = useState(/** @type {string | null} */ (null));

  const halfLifeDays = parseHalfLifeDays(halfLife);
  const analysis = useMemo(
    () => analyzeRows(rows, headers, { ...options, lookbackDays: parseLookbackDays(lookback), halfLifeDays }),
    [rows, headers, options, lookback, halfLifeDays],
  );

  const onOption = (/** @type {string} */ key, /** @type {unknown} */ value) =>
    setOptions((prev) => ({ ...prev, [key]: value }));
  const onMapping = (/** @type {string} */ key, /** @type {string} */ header) =>
    setOptions((prev) => ({ ...prev, mapping: { ...prev.mapping, [key]: header } }));

  const detectedCurrency = analysis.status === "ok" ? analysis.report.revenue.currency : "";
  const currency = currencyText ?? detectedCurrency;
  const panel = (
    <OptionsPanel
      headers={headers}
      mapping={analysis.mapping}
      options={options}
      onOption={onOption}
      onMapping={onMapping}
      lookback={lookback}
      onLookback={setLookback}
      halfLife={halfLife}
      onHalfLife={setHalfLife}
      currency={currency}
      onCurrency={setCurrencyText}
    />
  );

  if (analysis.status === "missing") {
    return (
      <>
        <p role="alert" className="notice notice--error">
          Could not find a {analysis.missing.join(" or ").toLowerCase()} column. Headers seen:{" "}
          {headers.length > 0 ? headers.join(", ") : "none"}. Choose the columns below.
        </p>
        {panel}
      </>
    );
  }

  const { result, report, unit } = analysis;
  const label = unitLabel(unit, currency);
  return (
    <>
      <StatRow tight>
        <StatCard label="File" value={fileName} />
        <StatCard label="Journeys" value={report.journeyCount} />
        <StatCard label="Converting journeys" value={result.journeyCount} />
        <StatCard label="Touchpoints scored" value={result.touchpointCount} />
        <StatCard label="Channels" value={result.channels.length} />
      </StatRow>

      {panel}
      <QualityPanel report={report} />

      {report.totalsUnreliable.length > 0 && (
        <div role="status" aria-label="Totals warning" className="attribution__unreliable">
          <strong>Totals are unreliable.</strong> {report.totalsUnreliable.join(" ")}
        </div>
      )}

      {result.journeyCount === 0 ? (
        <p role="alert" className="notice notice--error">
          No journeys count as conversions with these settings, so there is nothing to score. Check the revenue or
          converted column above.
        </p>
      ) : (
        <>
          <p className="hint">
            Credit is measured in {label}; the total across channels is the same under every model.{" "}
            {methodNote(halfLifeDays)}
            {report.revenue.hasColumn && ` ${revenueNote(report.revenueMode)}`}
          </p>

          <h2>Credit by channel, across models</h2>
          <GroupedBarChart
            yAxisTitle={`Credit (${label})`}
            data={result.channels.map((channel) => ({
              group: channel,
              series: MODELS.map((m) => ({ key: m, value: Math.round(creditFor(result, m, channel) * 100) / 100 })),
            }))}
            seriesKeys={[...MODELS]}
          />

          <ResultTables result={result} unit={unit} />

          <p>
            <button
              type="button"
              className="attribution__button"
              onClick={() => downloadText("attribution-credit.csv", matrixCsv(result, unit, currency))}
            >
              Download credit and shares as CSV
            </button>
          </p>
        </>
      )}
    </>
  );
}
