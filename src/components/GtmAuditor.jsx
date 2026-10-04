import { useState, useRef, useCallback } from "react";
import BarChart from "./BarChart.jsx";

const GENERIC_NAME_RE = /^(tag|trigger|variable)\s*\d*$/i;
const UNTITLED_RE = /^(untitled|new (tag|trigger|variable))/i;

function isGenericName(name) {
  if (!name) return true;
  return GENERIC_NAME_RE.test(name.trim()) || UNTITLED_RE.test(name.trim());
}

function collectTemplateRefs(obj, refs) {
  if (obj == null) return;
  if (typeof obj === "string") {
    const re = /\{\{([^}]+)\}\}/g;
    let m;
    while ((m = re.exec(obj))) refs.add(m[1].trim());
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach((v) => collectTemplateRefs(v, refs));
    return;
  }
  if (typeof obj === "object") {
    Object.values(obj).forEach((v) => collectTemplateRefs(v, refs));
  }
}

function findDuplicates(items, nameKey = "name") {
  // Names come from user data, so group with a Map: a plain object breaks on "constructor" (D2).
  /** @type {Map<string, any[]>} */
  const groups = new Map();
  items.forEach((item) => {
    const name = item[nameKey] || "(unnamed)";
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(item);
  });
  return [...groups.entries()].filter(([, arr]) => arr.length > 1);
}

function auditContainer(json) {
  const cv = json.containerVersion;
  if (!cv) {
    throw new Error('No "containerVersion" found — this doesn\'t look like a standard GTM export.');
  }
  const tags = cv.tag || [];
  const triggers = cv.trigger || [];
  const variables = cv.variable || [];

  const allRefs = new Set();
  tags.forEach((t) => collectTemplateRefs(t, allRefs));
  triggers.forEach((t) => collectTemplateRefs(t, allRefs));
  variables.forEach((v) => collectTemplateRefs(v, allRefs));

  const referencedTriggerIds = new Set();
  tags.forEach((t) => {
    (t.firingTriggerId || []).forEach((id) => referencedTriggerIds.add(id));
    (t.blockingTriggerId || []).forEach((id) => referencedTriggerIds.add(id));
  });

  const pausedTags = tags.filter((t) => t.paused === true);
  const orphanTags = tags.filter((t) => !t.firingTriggerId || t.firingTriggerId.length === 0);
  const unusedVariables = variables.filter((v) => !allRefs.has(v.name));
  const unusedTriggers = triggers.filter((tr) => !referencedTriggerIds.has(tr.triggerId));

  const dupTags = findDuplicates(tags);
  const dupTriggers = findDuplicates(triggers);
  const dupVariables = findDuplicates(variables);

  const genericTags = tags.filter((t) => isGenericName(t.name));
  const genericTriggers = triggers.filter((t) => isGenericName(t.name));
  const genericVariables = variables.filter((t) => isGenericName(t.name));

  return {
    counts: { tags: tags.length, triggers: triggers.length, variables: variables.length },
    findings: [
      { key: "paused_tags", label: "Paused tags", items: pausedTags.map((t) => t.name), type: "tag" },
      { key: "orphan_tags", label: "Tags with no firing trigger", items: orphanTags.map((t) => t.name), type: "tag" },
      {
        key: "unused_variables",
        label: "Unused variables",
        items: unusedVariables.map((v) => v.name),
        type: "variable",
      },
      { key: "unused_triggers", label: "Unused triggers", items: unusedTriggers.map((t) => t.name), type: "trigger" },
      {
        key: "duplicate_names",
        label: "Duplicate names",
        items: [
          ...dupTags.map(([name, arr]) => `Tag "${name}" (${arr.length}x)`),
          ...dupTriggers.map(([name, arr]) => `Trigger "${name}" (${arr.length}x)`),
          ...dupVariables.map(([name, arr]) => `Variable "${name}" (${arr.length}x)`),
        ],
        type: "mixed",
      },
      {
        key: "generic_names",
        label: "Generic/default names",
        items: [
          ...genericTags.map((t) => `Tag "${t.name}"`),
          ...genericTriggers.map((t) => `Trigger "${t.name}"`),
          ...genericVariables.map((t) => `Variable "${t.name}"`),
        ],
        type: "mixed",
      },
    ],
  };
}

export default function GtmAuditor() {
  const [result, setResult] = useState(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const handleFile = useCallback((file) => {
    setError("");
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(String(reader.result));
        const audit = auditContainer(json);
        setResult(audit);
      } catch (err) {
        setError(err.message || "Could not parse this file as GTM export JSON.");
        setResult(null);
      }
    };
    reader.onerror = () => setError("Could not read this file.");
    reader.readAsText(file);
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

  const chartData = result ? result.findings.map((f) => ({ label: f.label, value: f.items.length })) : [];
  const totalIssues = result ? result.findings.reduce((sum, f) => sum + f.items.length, 0) : 0;

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
        <p style={{ margin: 0 }}>Drop a GTM container export (.json) here, or click to choose a file.</p>
        <p style={{ margin: "0.5rem 0 0", fontSize: "0.85rem", color: "#666" }}>
          Export from GTM: Admin &rarr; Export Container. Nothing you upload leaves this browser tab.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={onInputChange}
          tabIndex={-1}
          aria-hidden="true"
          style={{ display: "none" }}
        />
      </div>

      {error && (
        <p role="alert" style={{ color: "#b00020" }}>
          {error}
        </p>
      )}

      {result && (
        <>
          <div
            aria-live="polite"
            aria-atomic="true"
            style={{ display: "flex", gap: "1.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}
          >
            <StatCard label="File" value={fileName} />
            <StatCard label="Tags" value={result.counts.tags} />
            <StatCard label="Triggers" value={result.counts.triggers} />
            <StatCard label="Variables" value={result.counts.variables} />
            <StatCard label="Total findings" value={totalIssues} />
          </div>

          {totalIssues > 0 ? (
            <>
              <h2>Findings by category</h2>
              <BarChart data={chartData} />

              {result.findings
                .filter((f) => f.items.length > 0)
                .map((f) => (
                  <div key={f.key} style={{ marginTop: "1.5rem" }}>
                    <h3 style={{ marginBottom: "0.4rem" }}>
                      {f.label} ({f.items.length})
                    </h3>
                    <ul>
                      {f.items.map((item, i) => (
                        // eslint-disable-next-line react/no-array-index-key -- items are plain strings that can repeat; Phase 4
                        <li key={i}>{item}</li>
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
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: "0.75rem 1rem", minWidth: 100 }}>
      <div style={{ fontSize: "0.75rem", color: "#666", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: "1.25rem", fontWeight: 600 }}>{value}</div>
    </div>
  );
}
