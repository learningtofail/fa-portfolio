import { useState, useRef, useCallback, useMemo } from "react";
import Papa from "papaparse";

const RULESETS = {
  affiliate: {
    label: "Affiliate / Sponsored Content (FTC-style)",
    patterns: [
      { label: "#ad", re: /#ad\b/i },
      { label: "#sponsored", re: /#sponsored/i },
      { label: '"affiliate link"', re: /affiliate link/i },
      { label: '"paid partnership"', re: /paid partnership/i },
      { label: '"sponsored by"', re: /sponsored by/i },
      { label: '"in partnership with"', re: /in partnership with/i },
    ],
  },
  regulatedHealth: {
    label: "Regulated Health / Pharma (generic)",
    patterns: [
      { label: '"full prescribing information"', re: /see (the )?full prescribing information/i },
      { label: '"important safety information"', re: /important safety information/i },
      { label: '"ask your doctor"', re: /ask your doctor/i },
      { label: '"talk to your doctor/healthcare provider"', re: /talk to your (doctor|healthcare provider)/i },
      { label: '"full risk information"', re: /full risk information/i },
      { label: '"consult your physician/doctor"', re: /consult your (physician|doctor)/i },
    ],
  },
  cannabis: {
    label: "Cannabis / Age-Restricted (generic)",
    patterns: [
      { label: "19+", re: /(?<!\w)19\+/ },
      { label: "21+", re: /(?<!\w)21\+/ },
      { label: '"legal age"', re: /legal age/i },
      { label: '"keep out of reach of children"', re: /keep out of reach of children/i },
      { label: '"for use only by adults"', re: /for use only by adults/i },
    ],
  },
  financial: {
    label: "Financial / Investment (generic)",
    patterns: [
      { label: '"past performance"', re: /past performance/i },
      { label: '"not financial/investment advice"', re: /not (financial|investment) advice/i },
      { label: '"results may vary"', re: /results may vary/i },
      { label: '"risk of loss"', re: /risk of loss/i },
      { label: '"capital at risk"', re: /capital at risk/i },
      { label: '"consult a financial advisor"', re: /consult a financial advisor/i },
    ],
  },
};

function checkText(text, rulesetKey) {
  const ruleset = RULESETS[rulesetKey];
  const matched = ruleset.patterns.filter((p) => p.re.test(text));
  return { pass: matched.length > 0, matched: matched.map((m) => m.label) };
}

export default function DisclosureChecker() {
  const [rulesetKey, setRulesetKey] = useState("affiliate");
  const [mode, setMode] = useState("paste"); // "paste" | "csv"
  const [pastedText, setPastedText] = useState("");
  const [csvRows, setCsvRows] = useState(null);
  // fileName is write-only today; the UI never shows it (Phase 4 either shows it or drops the state).
  const [, setFileName] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const handleFile = useCallback((file) => {
    setError("");
    setFileName(file.name);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const realErrors = (results.errors || []).filter((e) => e.type !== "Delimiter");
        if (realErrors.length > 0) {
          setError(`Parsed with warnings — results may be incomplete. First: ${realErrors[0].message}`);
        }
        const items = results.data
          .map((row) => {
            const keys = Object.keys(row).reduce((acc, k) => {
              acc[k.trim().toLowerCase()] = row[k];
              return acc;
            }, /** @type {Record<string, any>} */ ({}));
            return keys.copy || keys.text || keys.content || "";
          })
          .filter((t) => t && t.trim());
        if (items.length === 0) {
          setError('No usable rows — check for a "copy", "text", or "content" column.');
        }
        setCsvRows(items);
      },
      error: (err) => setError(`Could not parse this file: ${err.message}`),
    });
  }, []);

  const onInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const items = useMemo(() => {
    if (mode === "csv") return csvRows || [];
    return pastedText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  }, [mode, pastedText, csvRows]);

  const results = useMemo(() => items.map((text) => ({ text, ...checkText(text, rulesetKey) })), [items, rulesetKey]);
  const passCount = results.filter((r) => r.pass).length;

  return (
    <div className="tool">
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
        <div
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) handleFile(f);
          }}
          onDragOver={(e) => e.preventDefault()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          className="dropzone dropzone--flush"
          onClick={() => fileInputRef.current?.click()}
        >
          <p className="dropzone__title">Drop a CSV here, or click to choose a file.</p>
          <p className="dropzone__hint">
            Needs a <code>copy</code>, <code>text</code>, or <code>content</code> column.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={onInputChange}
            tabIndex={-1}
            aria-hidden="true"
            className="dropzone__input"
          />
        </div>
      )}

      {error && (
        <p role="alert" className="notice notice--error">
          {error}
        </p>
      )}

      {items.length > 0 && (
        <>
          <div aria-live="polite" aria-atomic="true" className="stat-row stat-row--padded">
            <StatCard label="Items checked" value={items.length} />
            <StatCard label="Passing" value={passCount} />
            <StatCard label="Missing disclosure" value={items.length - passCount} />
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Text</th>
                <th>Result</th>
                <th>Matched</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                // eslint-disable-next-line react/no-array-index-key -- rows have no stable id; Phase 4 keys by line
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td className="data-table__cell--wrap">{r.text}</td>
                  <td className={r.pass ? "data-table__cell--pass" : "data-table__cell--fail"}>
                    {r.pass ? "Pass" : "Missing disclosure"}
                  </td>
                  <td>{r.matched.join(", ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <p className="fineprint fineprint--narrow">
        This is a pattern-matching aid, not legal advice. A match means one of a small set of common disclosure phrases
        was found — it doesn&apos;t confirm regulatory compliance, and a miss doesn&apos;t necessarily mean copy is
        non-compliant (your required language may not be in this list). Have real campaigns reviewed by
        compliance/legal. Nothing you enter here leaves this browser tab.
      </p>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="stat-card">
      <div className="stat-card__label">{label}</div>
      <div className="stat-card__value">{value}</div>
    </div>
  );
}
