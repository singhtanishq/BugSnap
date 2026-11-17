#!/usr/bin/env node
/**
 * Screenshot validator:
 *  1. Every docs/screenshots/*.png file is non-empty and starts with a valid
 *     PNG signature (decodable header check).
 *  2. Every screenshot in docs/screenshots/ is embedded in the root README
 *     with an individual image reference.
 *  3. Every README image reference points to an existing file.
 * Run: pnpm validate:screenshots
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const SCREENSHOT_DIR = "docs/screenshots";
const README = "README.md";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function isPng(filePath) {
  const buffer = readFileSync(filePath);
  if (buffer.length < 24) return false;
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return false;
  // IHDR must be the first chunk; sanity-check dimensions are sane.
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return width > 0 && height > 0 && width <= 20000 && height <= 20000;
}

const failures = [];
const screenshots = readdirSync(SCREENSHOT_DIR)
  .filter((name) => name.endsWith(".png"))
  .sort();

if (screenshots.length === 0) {
  failures.push(`No screenshots found in ${SCREENSHOT_DIR}/`);
}

const readme = readFileSync(README, "utf8");

for (const name of screenshots) {
  const filePath = path.join(SCREENSHOT_DIR, name);
  const stat = statSync(filePath);
  if (stat.size === 0) {
    failures.push(`${filePath} is empty`);
    continue;
  }
  if (!isPng(filePath)) {
    failures.push(`${filePath} is not a decodable PNG`);
    continue;
  }
  const reference = `${SCREENSHOT_DIR}/${name}`;
  if (!readme.includes(`](${reference})`)) {
    failures.push(`${reference} exists but is not embedded in ${README} with ![](…) syntax`);
  }
}

// Every markdown image reference in the README must resolve.
const imageRefs = [...readme.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)].map((m) => m[1]);
for (const ref of imageRefs) {
  if (!ref.startsWith(SCREENSHOT_DIR)) continue; // other images (e.g. og) are checked separately
  if (!existsSafe(ref)) {
    failures.push(`README references missing file: ${ref}`);
  }
}

// The og image referenced at the top must exist too.
if (readme.includes("public/og/bugsnap-og.png") && !existsSafe("public/og/bugsnap-og.png")) {
  failures.push("README references public/og/bugsnap-og.png which does not exist");
}

function existsSafe(ref) {
  try {
    return statSync(ref).isFile();
  } catch {
    return false;
  }
}

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} screenshot validation error(s):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  `PASS: ${screenshots.length} screenshot(s) verified — all decodable, all embedded individually in README, all references resolve.`,
);
