import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * Uploads a text file through the tool's hidden file input, the same path a click on the dropzone takes.
 * @param {HTMLElement} container Render container holding the tool.
 * @param {string} name File name.
 * @param {string} text File contents.
 * @param {string} [type] MIME type.
 */
export async function uploadFile(container, name, text, type = "text/csv") {
  const input = /** @type {HTMLInputElement} */ (container.querySelector('input[type="file"]'));
  await userEvent.setup({ applyAccept: false }).upload(input, new File([text], name, { type }));
}

/** Resolves once a stat card with the given label is on screen, then returns its value text. */
export async function statValue(label) {
  const labelEl = await waitFor(() => screen.getByText(label, { selector: "div" }));
  return labelEl.nextElementSibling?.textContent;
}
