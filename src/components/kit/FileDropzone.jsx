import { useFileInput } from "./useFileInput.js";

/**
 * Keyboard-operable file dropzone (role="button", Enter/Space opens the picker).
 * @param {{
 *   title: string,
 *   hint: import("react").ReactNode,
 *   accept: string,
 *   onFile: (file: File) => void,
 *   flush?: boolean,
 * }} props `flush` drops the bottom margin, for a dropzone that is the last thing in its container.
 */
export default function FileDropzone({ title, hint, accept, onFile, flush = false }) {
  const { inputRef, open, onInputChange, onDrop, onDragOver, onKeyDown } = useFileInput(onFile);
  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      role="button"
      tabIndex={0}
      onKeyDown={onKeyDown}
      className={flush ? "dropzone dropzone--flush" : "dropzone"}
      onClick={open}
    >
      <p className="dropzone__title">{title}</p>
      <p className="dropzone__hint">{hint}</p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={onInputChange}
        tabIndex={-1}
        aria-hidden="true"
        className="dropzone__input"
      />
    </div>
  );
}
