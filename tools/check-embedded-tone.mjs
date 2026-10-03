// Cross-platform drift check: does the block embedded in lib/client.js still
// match the assets the registry names?
//
// `tools/embed-tones.ps1 -Check` does the same thing on Windows; this node
// variant is what CI runs, so the guarantee holds on every platform. The same
// comparison is asserted by test/client.test.mjs; this entry point exists so a
// single CI step can report it without running the whole suite.
//
// The tone list comes from tools/tones.json, the one place a tone is declared,
// so adding a tone cannot silently skip this check.
//
// Why the payloads live in the bundle rather than in a sibling module the bundle
// requires: the dsh client module loader resolves `require()` only for platform
// seed words (react) and registered package factories, so a relative specifier
// fails the whole web boot with
//   client-modules: require("./tones-data.js") missed the module table
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const registry = JSON.parse(readFileSync(join(root, "tools", "tones.json"), "utf8"));
const tones = registry.tones ?? [];
if (tones.length === 0) {
  console.error("check-embedded-tone: tools/tones.json declares no tones");
  process.exit(1);
}

const bundle = readFileSync(join(root, "lib", "client.js"), "utf8");
const block = /\/\/#region embedded-tones([\s\S]*?)\/\/#endregion embedded-tones/.exec(bundle);
if (block === null) {
  console.error("check-embedded-tone: the embedded-tones marker block is missing from lib/client.js");
  process.exit(1);
}

let failed = false;
for (const tone of tones) {
  const id = tone.id;
  if (typeof id !== "string" || id === "") {
    console.error("check-embedded-tone: a registry row has no id");
    failed = true;
    continue;
  }
  if (!block[1].includes(`'${id}':`)) {
    console.error(`check-embedded-tone: ${id} has no entry in the embedded block`);
    failed = true;
    continue;
  }
  if (!block[1].includes(`label: "${tone.label}"`)) {
    console.error(`check-embedded-tone: ${id}'s label is out of date in the embedded block`);
    failed = true;
    continue;
  }
  let bytes;
  try {
    bytes = readFileSync(join(root, "assets", tone.source));
  } catch {
    console.error(`check-embedded-tone: ${id} names a missing asset (assets/${tone.source})`);
    failed = true;
    continue;
  }
  const magic = bytes.subarray(0, 4).toString("ascii");
  if (magic !== "OggS") {
    console.error(`check-embedded-tone: assets/${tone.source} is not an Ogg stream (magic '${magic}')`);
    failed = true;
    continue;
  }
  // The generator wraps the base64 into 96-char chunks; every chunk must appear
  // verbatim, which is what proves the bundle carries those exact bytes.
  const base64 = bytes.toString("base64");
  const chunks = [];
  for (let index = 0; index < base64.length; index += 96) chunks.push(base64.slice(index, index + 96));
  const missing = chunks.filter((chunk) => !block[1].includes(`'${chunk}'`));
  if (missing.length > 0) {
    console.error(`check-embedded-tone: ${id} drifted from assets/${tone.source} (${missing.length}/${chunks.length} chunks missing)`);
    console.error("                   run: powershell -File tools/embed-tones.ps1");
    failed = true;
    continue;
  }
  console.log(`check-embedded-tone: ok — ${id} (${tone.kind}): ${bytes.length} bytes, ${chunks.length} chunks from assets/${tone.source}`);
}

if (failed) process.exit(1);
console.log(`check-embedded-tone: ${tones.length} tones match their packaged assets`);
