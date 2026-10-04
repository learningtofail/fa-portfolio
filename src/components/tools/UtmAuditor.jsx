import { parseCsvFile } from "../../lib/csv.js";
import { auditRows, ISSUE_LABELS, normalizeUtmRow, summarizeIssues } from "../../lib/utm/audit.js";
import BarChart from "../charts/BarChart.jsx";
import DataTable from "../kit/DataTable.jsx";
import ErrorNotice from "../kit/ErrorNotice.jsx";
import FileDropzone from "../kit/FileDropzone.jsx";
import StatCard from "../kit/StatCard.jsx";
import StatRow from "../kit/StatRow.jsx";
import ToolShell from "../kit/ToolShell.jsx";
import { useFileAnalysis } from "../kit/useFileAnalysis.js";

/** Parses the file and audits it. Pure logic lives in lib/utm/audit.js. */
async function analyze(/** @type {File} */ file) {
  const { rows, warning } = await parseCsvFile(file);
  const normalized = rows.map(normalizeUtmRow);
  return { result: { rows: normalized, issues: auditRows(normalized) }, warning };
}

const HINT = (
  <>
    Needs either a <code>url</code> column, or <code>utm_source</code> / <code>utm_medium</code> /{" "}
    <code>utm_campaign</code> columns (optionally <code>utm_term</code>, <code>utm_content</code>). Nothing you upload
    leaves this browser tab.
  </>
);

export default function UtmAuditor() {
  const { fileName, result, error, analyzeFile } = useFileAnalysis(analyze);
  const summary = result ? summarizeIssues(result.issues, result.rows.length) : null;

  /** @type {import("../kit/DataTable.jsx").Column<import("../../lib/utm/audit.js").UtmIssue>[]} */
  const columns = [
    { key: "row", header: "Row", render: (issue) => issue.rowIndex + 1 },
    { key: "source", header: "Source", render: (issue) => result.rows[issue.rowIndex].source },
    { key: "medium", header: "Medium", render: (issue) => result.rows[issue.rowIndex].medium },
    { key: "campaign", header: "Campaign", render: (issue) => result.rows[issue.rowIndex].campaign },
    { key: "issue", header: "Issue", render: (issue) => ISSUE_LABELS[issue.type] },
    { key: "detail", header: "Detail", render: (issue) => issue.detail },
  ];

  return (
    <ToolShell>
      <FileDropzone
        title="Drop a CSV here, or click to choose a file."
        hint={HINT}
        accept=".csv,text/csv"
        onFile={analyzeFile}
      />
      <ErrorNotice message={error} />
      {result && (
        <>
          <StatRow>
            <StatCard label="File" value={fileName} />
            <StatCard label="Rows" value={result.rows.length} />
            <StatCard label="Rows with issues" value={summary.rowsWithIssues} />
            <StatCard label="Issue rate" value={summary.issueRate} />
          </StatRow>
          {result.issues.length > 0 ? (
            <>
              <h2>Issues by category</h2>
              <BarChart data={summary.byCategory} />
              <h2 className="heading--spaced">Flagged rows</h2>
              <DataTable columns={columns} rows={result.issues} rowKey={(issue) => issue.id} scroll />
            </>
          ) : (
            <p>No governance issues found in {result.rows.length} rows.</p>
          )}
        </>
      )}
    </ToolShell>
  );
}
