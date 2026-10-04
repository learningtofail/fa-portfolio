// Generates the downloadable resume PDF from src/data/resume.js, the same file src/pages/index.astro reads.
// Run by `npm run build` before `astro build`, so the output lands in public/ and is copied into dist/.
// The layout lives in scripts/pdf/ResumePdfBuilder.mjs.
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { contact, experience, skills, summary } from "../src/data/resume.js";
import { ResumePdfBuilder } from "./pdf/ResumePdfBuilder.mjs";

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");
mkdirSync(outDir, { recursive: true });

const toolsNote =
  "Interactive marketing tools (UTM auditor, GTM auditor, CAC/LTV calculator, attribution modeling, disclosure checker) are live at portfolio.faysalahmed.ca/tools/ — client-side, not reproducible in a static PDF.";

try {
  const outPath = await new ResumePdfBuilder({ contact, summary, experience, skills, toolsNote }).build(
    path.join(outDir, "faysal-ahmed-resume.pdf"),
  );
  console.log(`PDF generated: ${outPath}`);
} catch (err) {
  console.error("PDF generation failed:", err);
  process.exit(1);
}
