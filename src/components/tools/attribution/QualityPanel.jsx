import { qualityNotes } from "../../../lib/attribution/notes.js";

/** Lists what the analysis did to the file: warnings first, then information. */
export default function QualityPanel({ report }) {
  const notes = qualityNotes(report);
  return (
    <section className="attribution__panel" aria-labelledby="attribution-quality">
      <h2 id="attribution-quality" className="attribution__panel-title">
        Data quality
      </h2>
      <ul className="attribution__notes">
        {notes.map((n) => (
          <li key={n.id} className={`attribution__note--${n.level}`}>
            {n.level === "warning" && <strong>Warning: </strong>}
            {n.text}
          </li>
        ))}
      </ul>
    </section>
  );
}
