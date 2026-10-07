/**
 * Hands a text file to the browser as a download. The browser objects are injected so the function is testable.
 * @param {string} fileName
 * @param {string} text
 * @param {string} [mime]
 * @param {{ document: Document, url: { createObjectURL: (blob: Blob) => string, revokeObjectURL: (url: string) => void } }} [env]
 */
export function downloadText(fileName, text, mime = "text/csv;charset=utf-8", env = { document, url: URL }) {
  const link = env.document.createElement("a");
  link.href = env.url.createObjectURL(new Blob([text], { type: mime }));
  link.download = fileName;
  env.document.body.append(link);
  link.click();
  link.remove();
  env.url.revokeObjectURL(link.href);
}
