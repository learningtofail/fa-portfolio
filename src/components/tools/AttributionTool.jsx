import { parseCsvFile } from "../../lib/csv.js";
import ErrorNotice from "../kit/ErrorNotice.jsx";
import FileDropzone from "../kit/FileDropzone.jsx";
import ToolShell from "../kit/ToolShell.jsx";
import { useFileAnalysis } from "../kit/useFileAnalysis.js";
import AttributionWorkspace from "./attribution/AttributionWorkspace.jsx";

let uploadCount = 0;

/** Parses the file only. Columns, options and scoring are applied live in the workspace. */
async function readFile(/** @type {File} */ file) {
  const { rows, headers, warning } = await parseCsvFile(file);
  uploadCount += 1;
  return { result: { rows, headers, id: uploadCount }, warning };
}

const HINT = (
  <>
    One row per touchpoint. Needed: a journey ID and a channel (columns such as <code>journey_id</code>,{" "}
    <code>user_id</code>, <code>channel</code>, <code>source</code> are found automatically, and you can map others).
    Optional: <code>timestamp</code>, <code>revenue</code>, <code>converted</code>, <code>touch_type</code>. Nothing you
    upload leaves this browser tab.
  </>
);

export default function AttributionTool() {
  const { fileName, result, error, analyzeFile } = useFileAnalysis(readFile);
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
        <AttributionWorkspace key={result.id} fileName={fileName} rows={result.rows} headers={result.headers} />
      )}
    </ToolShell>
  );
}
