import { readFileText } from "../../lib/csv.js";
import { auditContainer } from "../../lib/gtm/audit.js";
import BarChart from "../charts/BarChart.jsx";
import ErrorNotice from "../kit/ErrorNotice.jsx";
import FileDropzone from "../kit/FileDropzone.jsx";
import StatCard from "../kit/StatCard.jsx";
import StatRow from "../kit/StatRow.jsx";
import ToolShell from "../kit/ToolShell.jsx";
import { useFileAnalysis } from "../kit/useFileAnalysis.js";

/** Reads the export, parses the JSON and audits the container. Pure logic lives in lib/gtm/audit.js. */
async function analyze(/** @type {File} */ file) {
  return { result: auditContainer(JSON.parse(await readFileText(file))) };
}

export default function GtmAuditor() {
  const { fileName, result, error, analyzeFile } = useFileAnalysis(analyze);
  const totalIssues = result ? result.findings.reduce((sum, f) => sum + f.items.length, 0) : 0;

  return (
    <ToolShell>
      <FileDropzone
        title="Drop a GTM container export (.json) here, or click to choose a file."
        hint="Export from GTM: Admin → Export Container. Nothing you upload leaves this browser tab."
        accept=".json,application/json"
        onFile={analyzeFile}
      />
      <ErrorNotice message={error} />
      {result && (
        <>
          <StatRow>
            <StatCard label="File" value={fileName} size="narrow" />
            <StatCard label="Tags" value={result.counts.tags} size="narrow" />
            <StatCard label="Triggers" value={result.counts.triggers} size="narrow" />
            <StatCard label="Variables" value={result.counts.variables} size="narrow" />
            <StatCard label="Total findings" value={totalIssues} size="narrow" />
          </StatRow>
          {totalIssues > 0 ? (
            <>
              <h2>Findings by category</h2>
              <BarChart data={result.findings.map((f) => ({ label: f.label, value: f.items.length }))} />
              {result.findings
                .filter((f) => f.items.length > 0)
                .map((f) => (
                  <div key={f.key} className="finding">
                    <h3 className="finding__title">
                      {f.label} ({f.items.length})
                    </h3>
                    <ul>
                      {f.entries.map((entry) => (
                        <li key={entry.id}>{entry.text}</li>
                      ))}
                    </ul>
                  </div>
                ))}
            </>
          ) : (
            <p>
              No hygiene issues found across {result.counts.tags} tags, {result.counts.triggers} triggers, and{" "}
              {result.counts.variables} variables.
            </p>
          )}
        </>
      )}
    </ToolShell>
  );
}
