// `npm run tokens:sync [sha]` rewrites the vendored tokens and manifest from the DS repo.
// `npm run tokens:check` fails when the vendored file drifted from the pinned DS commit.
//
// Check order:
//   1. Offline: vendored file hash must match the manifest (catches hand edits).
//   2. Network: fetch each upstream file at the pinned SHA, compare its recorded hash, rebuild, diff.
// If the network is unreachable the check falls back to step 1 with a warning, unless
// TOKENS_CHECK_REQUIRE_NETWORK=1 (set in CI), in which case it fails.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SOURCE_FILES, SOURCE_REPO, buildVendored, sha256 } from "./build.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const VENDORED = `${root}src/styles/orchis.tokens.css`;
const MANIFEST = `${root}src/styles/orchis.tokens.manifest.json`;

/** @param {string} sha @param {string} path */
function fetchUpstream(sha, path) {
  const url = `https://raw.githubusercontent.com/${SOURCE_REPO}/${sha}/${path}`;
  // curl honours the proxy and CA settings of the environment, unlike Node's built-in fetch.
  return execFileSync("curl", ["-fsSL", "--max-time", "30", url], { encoding: "utf8" });
}

/** @param {string} sha */
function fetchAll(sha) {
  return Object.fromEntries(SOURCE_FILES.map((f) => [f.path, fetchUpstream(sha, f.path)]));
}

function sync(sha) {
  const contents = fetchAll(sha);
  const vendored = buildVendored(sha, contents);
  writeFileSync(VENDORED, vendored);
  const manifest = {
    source: SOURCE_REPO,
    sha,
    upstreamSha256: Object.fromEntries(Object.entries(contents).map(([p, t]) => [p, sha256(t)])),
    vendoredSha256: sha256(vendored),
  };
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Vendored ${SOURCE_FILES.length} files at ${sha}`);
}

function check() {
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const vendored = readFileSync(VENDORED, "utf8");
  if (sha256(vendored) !== manifest.vendoredSha256) {
    console.error(
      "tokens:check FAILED: orchis.tokens.css differs from the manifest. Do not hand-edit it; run tokens:sync.",
    );
    process.exit(1);
  }
  let contents;
  try {
    contents = fetchAll(manifest.sha);
  } catch (err) {
    if (process.env.TOKENS_CHECK_REQUIRE_NETWORK === "1") {
      console.error(`tokens:check FAILED: upstream unreachable and network is required here. ${err.message}`);
      process.exit(1);
    }
    console.warn(
      "tokens:check: upstream unreachable, verified the recorded hash only. CI repeats this with the network diff.",
    );
    return;
  }
  for (const [path, text] of Object.entries(contents)) {
    if (sha256(text) !== manifest.upstreamSha256[path]) {
      console.error(`tokens:check FAILED: ${path} at ${manifest.sha} no longer matches the recorded hash.`);
      process.exit(1);
    }
  }
  if (buildVendored(manifest.sha, contents) !== vendored) {
    console.error("tokens:check FAILED: vendored tokens differ from upstream at the pinned commit.");
    process.exit(1);
  }
  console.log(`tokens:check OK: matches ${SOURCE_REPO}@${manifest.sha.slice(0, 7)}`);
}

const [command, arg] = process.argv.slice(2);
if (command === "sync" && arg) sync(arg);
else if (command === "check") check();
else {
  console.error("usage: cli.mjs sync <design-system-commit-sha> | check");
  process.exit(2);
}
