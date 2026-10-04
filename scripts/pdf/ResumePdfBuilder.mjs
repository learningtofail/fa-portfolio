import PDFDocument from "pdfkit";
import { createWriteStream } from "node:fs";

/**
 * @typedef {import("../../src/data/resume.js").experience[number]} Role
 */

const INK = "#1a1a1a";
const MUTED = "#5a5a5a";
const ACCENT = "#3a5a9b";
const RULE = "#dddddd";
const MARGIN = 54;

/**
 * Lays the resume out as a Letter-size PDF from the same data object the web page renders, so the two
 * cannot drift. The PDFKit document is a private field: callers only see `build`.
 */
export class ResumePdfBuilder {
  /** @type {InstanceType<typeof PDFDocument>} */
  #doc;

  /**
   * @param {{
   *   contact: Record<string, string>,
   *   summary: { headline: string, body: string[], stats: string[] },
   *   experience: Array<Record<string, any>>,
   *   skills: Array<{ category: string, items: string }>,
   *   toolsNote: string,
   * }} content
   */
  constructor(content) {
    this.content = content;
    this.#doc = new PDFDocument({
      size: "LETTER",
      margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
    });
  }

  /**
   * Writes the PDF to disk.
   * @param {string} outPath
   * @returns {Promise<string>} Resolves with `outPath` once the file is flushed.
   */
  build(outPath) {
    const stream = createWriteStream(outPath);
    this.#doc.pipe(stream);
    this.#header();
    this.#summary();
    this.#experience();
    this.#skills();
    this.#toolsNote();
    this.#doc.end();
    return new Promise((resolve, reject) => {
      stream.on("finish", () => resolve(outPath));
      stream.on("error", reject);
    });
  }

  /** Starts a new page when fewer than `minHeight` points remain. */
  #ensureSpace(minHeight) {
    const bottom = this.#doc.page.height - this.#doc.page.margins.bottom;
    if (this.#doc.y + minHeight > bottom) this.#doc.addPage();
  }

  #header() {
    const { contact, summary } = this.content;
    const doc = this.#doc;
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(20).text(contact.name);
    doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(12).text(summary.headline);
    doc.moveDown(0.3);
    doc
      .fillColor(MUTED)
      .font("Helvetica")
      .fontSize(9.5)
      .text(`${contact.email}  |  ${contact.linkedin}  |  ${contact.phone}  |  ${contact.location}`);
    doc.moveDown(1);
  }

  #summary() {
    const { summary } = this.content;
    const doc = this.#doc;
    doc.fillColor(INK).font("Helvetica").fontSize(10);
    summary.body.forEach((p) => {
      doc.text(p, { align: "left" });
      doc.moveDown(0.5);
    });
    doc.fillColor(MUTED).fontSize(9).text(summary.stats.join("   ·   "));
    doc.moveDown(1);
  }

  /** @param {string} title */
  #sectionHeader(title) {
    const doc = this.#doc;
    this.#ensureSpace(30);
    doc.moveDown(0.3);
    doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(13).text(title.toUpperCase(), { characterSpacing: 0.5 });
    const y = doc.y + 2;
    doc
      .moveTo(doc.page.margins.left, y)
      .lineTo(doc.page.width - doc.page.margins.right, y)
      .strokeColor(RULE)
      .stroke();
    doc.moveDown(0.6);
  }

  /** @param {string | undefined} text @param {number} size */
  #paragraph(text, size) {
    if (!text) return;
    this.#ensureSpace(20);
    this.#doc.fillColor(INK).font("Helvetica").fontSize(size).text(text);
    this.#doc.moveDown(0.3);
  }

  /** @param {Role} role */
  #role(role) {
    const doc = this.#doc;
    this.#ensureSpace(60);
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(11).text(role.company);
    if (role.role) doc.fillColor(MUTED).font("Helvetica-Oblique").fontSize(9.5).text(role.role);
    doc.fillColor(MUTED).font("Helvetica").fontSize(9).text([role.dates, role.location].filter(Boolean).join("  ·  "));
    doc.moveDown(0.3);

    this.#paragraph(role.intro, 9.5);
    this.#paragraph(role.prose, 9.5);

    (role.bulletGroups || []).forEach((/** @type {{ label?: string, bullets: string[] }} */ group) => {
      if (group.label) {
        this.#ensureSpace(15);
        doc.fillColor(INK).font("Helvetica-Bold").fontSize(9.5).text(group.label);
        doc.moveDown(0.15);
      }
      group.bullets.forEach((b) => {
        this.#ensureSpace(14);
        doc.fillColor(INK).font("Helvetica").fontSize(9.3).text(`•  ${b}`, { indent: 8 });
        doc.moveDown(0.15);
      });
      doc.moveDown(0.2);
    });

    if (role.closing) {
      this.#ensureSpace(20);
      doc.fillColor(MUTED).font("Helvetica-Oblique").fontSize(8.8).text(role.closing);
    }
  }

  #experience() {
    const { experience } = this.content;
    this.#sectionHeader("Experience");
    experience.forEach((role, i) => {
      this.#role(role);
      if (i < experience.length - 1) this.#doc.moveDown(0.8);
    });
  }

  #skills() {
    const doc = this.#doc;
    this.#sectionHeader("Skills");
    this.content.skills.forEach((s) => {
      this.#ensureSpace(20);
      doc.fillColor(INK).font("Helvetica-Bold").fontSize(9.5).text(`${s.category}: `, { continued: true });
      doc.fillColor(MUTED).font("Helvetica").fontSize(9.3).text(s.items);
      doc.moveDown(0.35);
    });
  }

  #toolsNote() {
    this.#sectionHeader("Tools");
    this.#doc.fillColor(INK).font("Helvetica").fontSize(9.5).text(this.content.toolsNote);
  }
}
