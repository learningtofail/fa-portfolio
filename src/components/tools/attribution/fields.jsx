import { useId } from "react";

/**
 * Labelled select. `options` are `{ value, label }`.
 * @param {{ label: string, value: string, options: Array<{ value: string, label: string }>, onChange: (value: string) => void }} props
 */
export function SelectField({ label, value, options, onChange }) {
  const id = useId();
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <select id={id} className="field__select" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Labelled text or number input. The caller owns the text and parses it.
 * @param {{ label: string, value: string, onChange: (value: string) => void, inputMode?: "text" | "decimal", hint?: string }} props
 */
export function TextField({ label, value, onChange, inputMode = "text", hint }) {
  const id = useId();
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="field__input"
        type="text"
        inputMode={inputMode}
        value={value}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && (
        <p id={`${id}-hint`} className="hint">
          {hint}
        </p>
      )}
    </div>
  );
}

/** @param {{ label: string, checked: boolean, onChange: (checked: boolean) => void }} props */
export function CheckField({ label, checked, onChange }) {
  return (
    <label className="attribution__check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
