import { useCallback, useState } from "react";

/**
 * Runs an async analysis for a chosen file and keeps its outcome: the file name, the result, and a message.
 * `analyze` resolves to `{ result, warning? }` (a warning is shown next to the result) or throws an Error whose
 * message becomes the visible error and clears the result.
 * @template Result
 * @param {(file: File) => Promise<{ result: Result, warning?: string }>} analyze
 * @returns {{ fileName: string, result: Result | null, error: string, analyzeFile: (file: File) => Promise<void> }}
 */
export function useFileAnalysis(analyze) {
  const [state, setState] = useState(
    /** @type {{ fileName: string, result: Result | null, error: string }} */ ({
      fileName: "",
      result: null,
      error: "",
    }),
  );

  const analyzeFile = useCallback(
    async (/** @type {File} */ file) => {
      setState((prev) => ({ ...prev, fileName: file.name, error: "" }));
      try {
        const { result, warning = "" } = await analyze(file);
        setState({ fileName: file.name, result, error: warning });
      } catch (err) {
        const message = err instanceof Error && err.message ? err.message : "Could not read this file.";
        setState({ fileName: file.name, result: null, error: message });
      }
    },
    [analyze],
  );

  return { ...state, analyzeFile };
}
