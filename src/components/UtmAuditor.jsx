import { useState, useRef, useCallback } from "react";
import Papa from "papaparse";
import BarChart from "./BarChart.jsx";

const UTM_FIELDS = ["source", "medium", "campaign", "term", "content"];
const REQUIRED_FIELDS = ["source", "medium", "campaign"];
const VALID_CHARS = /^[a-zA-Z0-9_-]*$/;

function extractUtmFromUrl(url) {
  try {
    const u = new URL(url);
    const params = u.searchParams;
    return {
      source: params.get("utm_source") || "",
      medium: params.get("utm_medium") || "",
      campaign: params.get("utm_campaign") || "",
      term: params.get("utm_term") || "",
      content: params.get("utm_content") || "",
    };
  } catch {
    return { source: "", medium: "", campaign: "", term: "", content: "" };
  }
}

function normalizeRow(row) {
  // Prefer an explicit "url" column; fall back to direct utm_* columns.
  const keys = Object.keys(row).reduce((acc, k) => {
    acc[k.trim().toLowerCase()] = row[k];
    return acc;
  }, {});

  if (keys.url) {
    return { url: keys.url, ...extractUtmFromUrl(keys.url) };
  }

  return {
    url: keys.url || "",
    source: keys.utm_source || keys.source || "",
    medium: keys.utm_medium || keys.medium || "",
    campaign: keys.utm_campaign || keys.campaign || "",
    term: keys.utm_term || keys.term || "",
    content: keys.utm_content || keys.content || "",
  };
}

function detectSeparatorStyle(value) {
  if (!value) return null;
  const hasHyphen = value.includes("-");
  const hasUnderscore = value.includes("_");
  const hasDot = value.includes(".");
  const styles = [hasHyphen && "hyphen", hasUnderscore && "underscore", hasDot && "dot"].filter(Boolean);
  if (styles.length === 0) return "none";
  if (styles.length > 1) return "mixed-within-value";
  return styles[0];
}

function auditRows(rows) {
  const issues = []; // { rowIndex, field, type, detail }
  const casingGroups = {}; // field -> lowercase value -> Set of original casings

  // Pass 1: build casing groups
  rows.forEach((row) => {
    ["source", "medium", "campaign"].forEach((field) => {
      const val = row[field];
      if (!val) return;
      const key = val.toLowerCase();
      casingGroups[field] = casingGroups[field] || {};
      casingGroups[field][key] = casingGroups[field][key] || new Set();
      casingGroups[field][key].add(val);
    });
  });

  // Pass 2: campaign separator majority style
  const separatorCounts = {};
  rows.forEach((row) => {
    const style = detectSeparatorStyle(row.campaign);
    if (style && style !== "none") {
      separatorCounts[style] = (separatorCounts[style] || 0) + 1;
    }
  });
  const majorityStyle = Object.entries(separatorCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

  // Pass 3: duplicate tuple detection (same source+medium+campaign, different url)
  const tupleToUrls = {};
  rows.forEach((row, i) => {
    if (!row.source || !row.medium || !row.campaign) return;
    const tuple = `${row.source.toLowerCase()}|${row.medium.toLowerCase()}|${row.campaign.toLowerCase()}`;
    tupleToUrls[tuple] = tupleToUrls[tuple] || new Set();
    if (row.url) tupleToUrls[tuple].add(row.url);
  });

  rows.forEach((row, rowIndex) => {
    // Missing required fields
    REQUIRED_FIELDS.forEach((field) => {
      if (!row[field]) {
        issues.push({ rowIndex, field, type: "missing_required", detail: `Missing utm_${field}` });
      }
    });

    // Whitespace and invalid characters
    UTM_FIELDS.forEach((field) => {
      const val = row[field];
      if (!val) return;
      if (/\s/.test(val)) {
        issues.push({ rowIndex, field, type: "whitespace", detail: `"${val}" contains whitespace` });
      }
      if (!VALID_CHARS.test(val)) {
        issues.push({ rowIndex, field, type: "invalid_chars", detail: `"${val}" has characters outside [a-zA-Z0-9_-]` });
      }
    });

    // Casing drift
    ["source", "medium", "campaign"].forEach((field) => {
      const val = row[field];
      if (!val) return;
      const key = val.toLowerCase();
      const variants = casingGroups[field]?.[key];
      if (variants && variants.size > 1) {
        issues.push({
          rowIndex,
          field,
          type: "casing_drift",
          detail: `"${val}" has ${variants.size} casing variants in this file: ${[...variants].join(", ")}`,
        });
      }
    });

    // Separator drift on campaign
    if (row.campaign && majorityStyle) {
      const style = detectSeparatorStyle(row.campaign);
      if (style && style !== "none" && style !== majorityStyle) {
        issues.push({
          rowIndex,
          field: "campaign",
          type: "separator_drift",
          detail: `"${row.campaign}" uses "${style}" separators; most campaigns in this file use "${majorityStyle}"`,
        });
      }
    }

    // Duplicate tuple, different destination
    if (row.source && row.medium && row.campaign) {
      const tuple = `${row.source.toLowerCase()}|${row.medium.toLowerCase()}|${row.campaign.toLowerCase()}`;
      const urls = tupleToUrls[tuple];
      if (urls && urls.size > 1) {
        issues.push({
          rowIndex,
          field: "campaign",
          type: "duplicate_tuple",
          detail: `Same source/medium/campaign combination points to ${urls.size} different URLs in this file`,
        });
      }
    }
  });

  return issues;
}

const ISSUE_LABELS = {
  missing_required: "Missing required field",
  whitespace: "Whitespace in value",
  invalid_chars: "Invalid characters",
  casing_drift: "Casing inconsistency",
  separator_drift: "Separator inconsistency",
  duplicate_tuple: "Duplicate campaign, different URL",
};

export default function UtmAuditor() {
  const [rows, setRows] = useState(null);
  const [issues, setIssues] = useState([]);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState("");
  const fileInputRef = useRef(null);

  const handleFile = useCallback((file) => {
    setParseError("");
    setFileName(file.name);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        // Papaparse's "Delimiter" type is an informational notice (e.g. single-column
        // files have nothing to auto-detect a delimiter from) — it still parses correctly,
        // so don't surface it as a warning. Only real errors get shown.
        const realErrors = (results.errors || []).filter((e) => e.type !== "Delimiter");
        if (realErrors.length > 0) {
          setParseError(`Parsed with ${realErrors.length} warning(s) — results may be incomplete. First: ${realErrors[0].message}`);
        }
        const normalized = results.data.map(normalizeRow);
        setRows(normalized);
        setIssues(auditRows(normalized));
      },
      error: (err) => {
        setParseError(`Could not parse this file: ${err.message}`);
        setRows(null);
        setIssues([]);
      },
    });
  }, []);

  const onInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const onDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const rowsWithIssues = rows ? new Set(issues.map((i) => i.rowIndex)).size : 0;
  const issueCounts = Object.keys(ISSUE_LABELS).map((type) => ({
    label: ISSUE_LABELS[type],
    value: issues.filter((i) => i.type === type).length,
  }));

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 900 }}>
      <div
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        style={{
          border: "2px dashed #999",
          borderRadius: 8,
          padding: "2rem",
          textAlign: "center",
          marginBottom: "1.5rem",
          cursor: "pointer",
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <p style={{ margin: 0 }}>
          Drop a CSV here, or click to choose a file.
        </p>
        <p style={{ margin: "0.5rem 0 0", fontSize: "0.85rem", color: "#666" }}>
          Needs either a <code>url</code> column, or <code>utm_source</code> / <code>utm_medium</code> / <code>utm_campaign</code> columns (optionally <code>utm_term</code>, <code>utm_content</code>). Nothing you upload leaves this browser tab.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={onInputChange}
          tabIndex={-1}
          aria-hidden="true"
          style={{ display: "none" }}
        />
      </div>

      {parseError && (
        <p role="alert" style={{ color: "#b00020" }}>{parseError}</p>
      )}

      {rows && (
        <>
          <div aria-live="polite" aria-atomic="true" style={{ display: "flex", gap: "1.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
            <StatCard label="File" value={fileName} />
            <StatCard label="Rows" value={rows.length} />
            <StatCard label="Rows with issues" value={rowsWithIssues} />
            <StatCard
              label="Issue rate"
              value={rows.length ? `${Math.round((rowsWithIssues / rows.length) * 100)}%` : "0%"}
            />
          </div>

          {issues.length > 0 ? (
            <>
              <h2>Issues by category</h2>
              <BarChart data={issueCounts} />

              <h2 style={{ marginTop: "2rem" }}>Flagged rows</h2>
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.85rem" }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Row</th>
                      <th style={thStyle}>Source</th>
                      <th style={thStyle}>Medium</th>
                      <th style={thStyle}>Campaign</th>
                      <th style={thStyle}>Issue</th>
                      <th style={thStyle}>Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {issues.map((issue, i) => {
                      const row = rows[issue.rowIndex];
                      return (
                        <tr key={i}>
                          <td style={tdStyle}>{issue.rowIndex + 1}</td>
                          <td style={tdStyle}>{row.source}</td>
                          <td style={tdStyle}>{row.medium}</td>
                          <td style={tdStyle}>{row.campaign}</td>
                          <td style={tdStyle}>{ISSUE_LABELS[issue.type]}</td>
                          <td style={tdStyle}>{issue.detail}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p>No governance issues found in {rows.length} rows.</p>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: "0.75rem 1rem", minWidth: 120 }}>
      <div style={{ fontSize: "0.75rem", color: "#666", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: "1.25rem", fontWeight: 600 }}>{value}</div>
    </div>
  );
}

const thStyle = { textAlign: "left", borderBottom: "2px solid #ccc", padding: "0.4rem 0.6rem" };
const tdStyle = { borderBottom: "1px solid #eee", padding: "0.4rem 0.6rem" };
