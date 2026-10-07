import { FIELDS } from "../../../lib/attribution/columns.js";
import { REVENUE_MODES } from "../../../lib/attribution/revenue.js";
import { CheckField, SelectField, TextField } from "./fields.jsx";

const DATE_ORDERS = [
  { value: "auto", label: "Detect from the file" },
  { value: "mdy", label: "Month first (MM/DD/YYYY)" },
  { value: "dmy", label: "Day first (DD/MM/YYYY)" },
];

/**
 * Column mapper and analysis options. All state lives in the parent; this only renders controls.
 * @param {{
 *   headers: string[],
 *   mapping: import("../../../lib/attribution/columns.js").ColumnMapping,
 *   options: import("../../../lib/attribution/prepare.js").AttributionOptions,
 *   onOption: (key: string, value: unknown) => void,
 *   onMapping: (key: string, header: string) => void,
 *   lookback: string,
 *   onLookback: (text: string) => void,
 *   halfLife: string,
 *   onHalfLife: (text: string) => void,
 *   currency: string,
 *   onCurrency: (text: string) => void,
 * }} props
 */
export default function OptionsPanel({
  headers,
  mapping,
  options,
  onOption,
  onMapping,
  lookback,
  onLookback,
  halfLife,
  onHalfLife,
  currency,
  onCurrency,
}) {
  const headerOptions = [{ value: "", label: "(none)" }, ...headers.map((h) => ({ value: h, label: h }))];
  return (
    <>
      <section className="attribution__panel" aria-labelledby="attribution-columns">
        <h2 id="attribution-columns" className="attribution__panel-title">
          Columns
        </h2>
        <div className="attribution__grid">
          {FIELDS.map((f) => (
            <SelectField
              key={f.key}
              label={f.required ? `${f.label} column (required)` : `${f.label} column`}
              value={mapping[f.key]}
              options={headerOptions}
              onChange={(value) => onMapping(f.key, value)}
            />
          ))}
        </div>
      </section>

      <section className="attribution__panel" aria-labelledby="attribution-options">
        <h2 id="attribution-options" className="attribution__panel-title">
          Options
        </h2>
        <div className="attribution__grid">
          {mapping.revenue && (
            <SelectField
              label="Revenue per journey"
              value={options.revenueMode}
              options={[...REVENUE_MODES]}
              onChange={(v) => onOption("revenueMode", v)}
            />
          )}
          {mapping.timestamp && (
            <SelectField
              label="Date order"
              value={options.dateOrder}
              options={DATE_ORDERS}
              onChange={(v) => onOption("dateOrder", v)}
            />
          )}
          <TextField
            label="Lookback window (days)"
            value={lookback}
            inputMode="decimal"
            hint="Blank means no limit. Counted back from each journey's last touch."
            onChange={onLookback}
          />
          <TextField
            label="Time-decay half-life (days)"
            value={halfLife}
            inputMode="decimal"
            hint="Default 7."
            onChange={onHalfLife}
          />
          {mapping.revenue && (
            <TextField
              label="Currency symbol or code"
              value={currency}
              hint="Used for labels only."
              onChange={onCurrency}
            />
          )}
        </div>
        <div className="attribution__grid">
          {mapping.revenue && !mapping.converted && (
            <CheckField
              label="Only journeys with revenue count as conversions"
              checked={options.onlyRevenueConverts}
              onChange={(v) => onOption("onlyRevenueConverts", v)}
            />
          )}
          <CheckField
            label="Remove exact duplicate rows"
            checked={options.dedupe}
            onChange={(v) => onOption("dedupe", v)}
          />
          <CheckField
            label="Merge channel names that differ only by case or spacing"
            checked={options.normalizeChannels}
            onChange={(v) => onOption("normalizeChannels", v)}
          />
          {mapping.touchType && (
            <CheckField
              label="Keep view-through touches (views and impressions)"
              checked={options.keepViews}
              onChange={(v) => onOption("keepViews", v)}
            />
          )}
        </div>
      </section>
    </>
  );
}
