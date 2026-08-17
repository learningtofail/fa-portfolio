// Generates the downloadable resume PDF directly from src/data/resume.js —
// the same file src/pages/index.astro reads from. Run before `astro build`
// (see package.json) so the output lands in public/ and gets copied into dist/.
import PDFDocument from "pdfkit";
import { createWriteStream, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { summary, experience, skills, contact } from "../src/data/resume.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "public");
mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "faysal-ahmed-resume.pdf");

const doc = new PDFDocument({ size: "LETTER", margins: { top: 54, bottom: 54, left: 54, right: 54 } });
const stream = createWriteStream(outPath);
doc.pipe(stream);

const INK = "#1a1a1a";
const MUTED = "#5a5a5a";
const ACCENT = "#3a5a9b";

function ensureSpace(minHeight) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + minHeight > bottom) doc.addPage();
}

// Header
doc.fillColor(INK).font("Helvetica-Bold").fontSize(20).text(contact.name);
doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(12).text(summary.headline);
doc.moveDown(0.3);
doc.fillColor(MUTED).font("Helvetica").fontSize(9.5).text(
  `${contact.email}  |  ${contact.linkedin}  |  ${contact.phone}  |  ${contact.location}`
);
doc.moveDown(1);

// Summary
doc.fillColor(INK).font("Helvetica").fontSize(10);
summary.body.forEach((p) => {
  doc.text(p, { align: "left" });
  doc.moveDown(0.5);
});
doc.fillColor(MUTED).fontSize(9).text(summary.stats.join("   ·   "));
doc.moveDown(1);

// Section helper
function sectionHeader(title) {
  ensureSpace(30);
  doc.moveDown(0.3);
  doc
    .fillColor(ACCENT)
    .font("Helvetica-Bold")
    .fontSize(13)
    .text(title.toUpperCase(), { characterSpacing: 0.5 });
  const y = doc.y + 2;
  doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.width - doc.page.margins.right, y).strokeColor("#dddddd").stroke();
  doc.moveDown(0.6);
}

// Experience
sectionHeader("Experience");
experience.forEach((role, i) => {
  ensureSpace(60);
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(11).text(role.company);
  if (role.role) {
    doc.fillColor(MUTED).font("Helvetica-Oblique").fontSize(9.5).text(role.role);
  }
  const metaLine = [role.dates, role.location].filter(Boolean).join("  ·  ");
  doc.fillColor(MUTED).font("Helvetica").fontSize(9).text(metaLine);
  doc.moveDown(0.3);

  if (role.intro) {
    ensureSpace(20);
    doc.fillColor(INK).font("Helvetica").fontSize(9.5).text(role.intro);
    doc.moveDown(0.3);
  }
  if (role.prose) {
    ensureSpace(20);
    doc.fillColor(INK).font("Helvetica").fontSize(9.5).text(role.prose);
    doc.moveDown(0.3);
  }

  (role.bulletGroups || []).forEach((group) => {
    if (group.label) {
      ensureSpace(15);
      doc.fillColor(INK).font("Helvetica-Bold").fontSize(9.5).text(group.label);
      doc.moveDown(0.15);
    }
    group.bullets.forEach((b) => {
      ensureSpace(14);
      doc.fillColor(INK).font("Helvetica").fontSize(9.3).text(`•  ${b}`, { indent: 8 });
      doc.moveDown(0.15);
    });
    doc.moveDown(0.2);
  });

  if (role.closing) {
    ensureSpace(20);
    doc.fillColor(MUTED).font("Helvetica-Oblique").fontSize(8.8).text(role.closing);
  }

  if (i < experience.length - 1) doc.moveDown(0.8);
});

// Skills
sectionHeader("Skills");
skills.forEach((s) => {
  ensureSpace(20);
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(9.5).text(`${s.category}: `, { continued: true });
  doc.fillColor(MUTED).font("Helvetica").fontSize(9.3).text(s.items);
  doc.moveDown(0.35);
});

// Tools note (interactive tools can't be replicated in a PDF)
sectionHeader("Tools");
doc
  .fillColor(INK)
  .font("Helvetica")
  .fontSize(9.5)
  .text("Interactive marketing tools (UTM auditor, GTM auditor, CAC/LTV calculator, attribution modeling, disclosure checker) are live at portfolio.faysalahmed.ca/tools/ — client-side, not reproducible in a static PDF.");

doc.end();

stream.on("finish", () => {
  console.log(`PDF generated: ${outPath}`);
});
stream.on("error", (err) => {
  console.error("PDF generation failed:", err);
  process.exit(1);
});
