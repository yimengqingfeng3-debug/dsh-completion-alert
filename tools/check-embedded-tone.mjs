// Cross-platform drift check: does lib/tones-data.js still match the assets in
// assets/?
//
// `tools/embed-tones.ps1 -Check` does the same thing on Windows; this node
// variant is what CI runs, so the guarantee holds on every platform. The same
// comparison is asserted by test/client.test.mjs; this entry point exists so a
// single CI step can report it without running the whole suite.
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const tonesPath = join(root, "lib", "tones-data.js");

// A cache-busting query keeps a stale module registry from hiding drift.
const module = await import(`${pathToFileURL(tonesPath).href}?drift=${String(Date.now())}`);
const { TONE_SOURCES, TONE_BASE64 } = module;

const ids = Object.keys(TONE_SOURCES);
if (ids.length === 0) {
  console.error("check-embedded-tone: lib/tones-data.js lists no tones");
  process.exit(1);
}

let failed = false;
for (const id of ids) {
  const payload = TONE_BASE64[id];
  if (typeof payload !== "string" || payload.length === 0) {
    console.error(`check-embedded-tone: ${id} carries no payload`);
    failed = true;
    continue;
  }
  const bytes = Buffer.from(payload, "base64");
  const magic = bytes.subarray(0, 4).toString("ascii");
  if (magic !== "OggS") {
    console.error(`check-embedded-tone: ${id} is not an Ogg stream (magic '${magic}')`);
    failed = true;
    continue;
  }
  const asset = readFileSync(join(root, "assets", TONE_SOURCES[id]));
  const expected = asset.toString("base64");
  if (expected !== payload) {
    console.error(`check-embedded-tone: ${id} drifted from assets/${TONE_SOURCES[id]} (${payload.length} vs ${expected.length} base64 chars)`);
    console.error("                   run: powershell -File tools/embed-tones.ps1");
    failed = true;
    continue;
  }
  console.log(`check-embedded-tone: ok — ${id}: ${bytes.length} bytes from assets/${TONE_SOURCES[id]}`);
}

if (failed) process.exit(1);
console.log(`check-embedded-tone: ${ids.length} tones match their packaged assets`);
