import { useMemo, useState } from "react";
import { copyFromRows, checkItems, splitLines } from "../../lib/disclosure/check.js";
import { RULESETS } from "../../lib/disclosure/rulesets.js";
import { parseCsvFile } from "../../lib/csv.js";
import DataTable from "../kit/DataTable.jsx";
import ErrorNotice from "../kit/ErrorNotice.jsx";
import FileDropzone from "../kit/FileDropzone.jsx";
import StatCard from "../kit/StatCard.jsx";
import StatRow from "../kit/StatRow.jsx";
import ToolShell from "../kit/ToolShell.jsx";
import { useFileAnalysis } from "../kit/useFileAnalysis.js";

/** Parses the CSV and pulls out the copy column. */
async function analyze(/** @type {File} */ file) {
  const { rows, warning } = await parseCsvFile(file);
  const items = copyFromRows(rows);
  if (items.length === 0) throw new Error('No usable rows — check for a "copy", "text", or "content" column.');
  return { result: items, warning };
}

/** @type {import("../kit/DataTable.jsx").Column<import("../../lib/disclosure/check.js").CheckResult>[]} */
const COLUMNS = [
  { key: "n", header: "#", render: (_r, i) => i + 1 },
  { key: "text", header: "Text", render: (r) => r.text, cellClassName: () => "data-table__cell--wrap" },
  {
    key: "result",
    header: "Result",
    render: (r) => (r.pass ? "Pass" : "Missing disclosure"),
    cellClassName: (r) => (r.pass ? "data-table__cell--pass" : "data-table__cell--fail"),
  },
  { key: "matched", header: "Matched", render: (r) => r.matched.join(", ") || "—" },
];

export default function DisclosureChecker() {
  const [rulesetKey, setRulesetKey] = useState("affiliate");
  const [mode, setMode] = useState("paste"); // "paste" | "csv"
  const [pastedText, setPastedText] = useState("");
  const { result: csvItems, error, analyzeFile } = useFileAnalysis(analyze);

  const items = useMemo(() => (mode === "csv" ? csvItems || [] : splitLines(pastedText)), [mode, pastedText, csvItems]);
  const results = useMemo(() => checkItems(items, rulesetKey), [items, rulesetKey]);
  const passCount = results.filter((r) => r.pass).length;

  return (
    <ToolShell>
      <div className="field">
        <label htmlFor="ruleset-select" className="field__label">
          Ruleset
        </label>
        <select
          id="ruleset-select"
          value={rulesetKey}
          onChange={(e) => setRulesetKey(e.target.value)}
          className="field__select"
        >
          {Object.entries(RULESETS).map(([key, r]) => (
            <option key={key} value={key}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      <div role="radiogroup" aria-label="Input mode" className="choice-group">
        <label>
          <input type="radio" name="input-mode" checked={mode === "paste"} onChange={() => setMode("paste")} /> Paste
          text (one item per line)
        </label>
        <label>
          <input type="radio" name="input-mode" checked={mode === "csv"} onChange={() => setMode("csv")} /> Upload CSV
        </label>
      </div>

      {mode === "paste" ? (
        <textarea
          value={pastedText}
          onChange={(e) => setPastedText(e.target.value)}
          placeholder="One piece of copy per line..."
          rows={6}
          className="field__textarea"
        />
      ) : (
        <FileDropzone
          flush
          title="Drop a CSV here, or click to choose a file."
          hint={
            <>
              Needs a <code>copy</code>, <code>text</code>, or <code>content</code> column.
            </>
          }
          accept=".csv,text/csv"
          onFile={analyzeFile}
        />
      )}

      <ErrorNotice message={error} />

      {items.length > 0 && (
        <>
          <StatRow padded>
            <StatCard label="Items checked" value={items.length} />
            <StatCard label="Passing" value={passCount} />
            <StatCard label="Missing disclosure" value={items.length - passCount} />
          </StatRow>
          <DataTable columns={COLUMNS} rows={results} rowKey={(r) => r.id} />
        </>
      )}

      <p className="fineprint fineprint--narrow">
        This is a pattern-matching aid, not legal advice. A match means one of a small set of common disclosure phrases
        was found — it doesn&apos;t confirm regulatory compliance, and a miss doesn&apos;t necessarily mean copy is
        non-compliant (your required language may not be in this list). Have real campaigns reviewed by
        compliance/legal. Nothing you enter here leaves this browser tab.
      </p>
    </ToolShell>
  );
}
