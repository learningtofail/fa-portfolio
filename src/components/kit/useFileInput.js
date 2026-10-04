import { useCallback, useRef } from "react";

/**
 * Wiring for a click, keyboard or drag-and-drop file picker around a hidden `<input type="file">`.
 * @param {(file: File) => void} onFile Called with the first file chosen or dropped.
 */
export function useFileInput(onFile) {
  const inputRef = useRef(/** @type {HTMLInputElement | null} */ (null));

  const open = useCallback(() => inputRef.current?.click(), []);

  const onInputChange = useCallback(
    (/** @type {import("react").ChangeEvent<HTMLInputElement>} */ e) => {
      const file = e.target.files?.[0];
      if (file) onFile(file);
    },
    [onFile],
  );

  const onDrop = useCallback(
    (/** @type {import("react").DragEvent} */ e) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (file) onFile(file);
    },
    [onFile],
  );

  const onDragOver = useCallback((/** @type {import("react").DragEvent} */ e) => e.preventDefault(), []);

  const onKeyDown = useCallback(
    (/** @type {import("react").KeyboardEvent} */ e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    },
    [open],
  );

  return { inputRef, open, onInputChange, onDrop, onDragOver, onKeyDown };
}
