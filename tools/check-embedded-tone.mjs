// Cross-platform drift check: does the block embedded in lib/client.js still
// match the assets in assets/?
//
// `tools/embed-tones.ps1 -Check` does the same thing on Windows; this node
// variant is what CI runs, so the guarantee holds on every platform. The same
// comparison is asserted by test/client.test.mjs; this entry point exists so a
// single CI step can report it without running the whole suite.
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

// id -> asset file name, in the order the settings list them.
const TONES = {
  bingbingbing: "bingbingbing.ogg",
  "crisp-a": "crisp-a.ogg",
  "crisp-b": "crisp-b.ogg"
};

const bundle = readFileSync(join(root, "lib", "client.js"), "utf8");
const block = /\/\/#region embedded-tones([\s\S]*?)\/\/#endregion embedded-tones/.exec(bundle);
if (block === null) {
  console.error("check-embedded-tone: the embedded-tones marker block is missing from lib/client.js");
  process.exit(1);
}

let failed = false;
for (const [id, asset] of Object.entries(TONES)) {
  if (!block[1].includes(`'${id}':`)) {
    console.error(`check-embedded-tone: ${id} has no entry in the embedded block`);
    failed = true;
    continue;
  }
  const bytes = readFileSync(join(root, "assets", asset));
  const magic = bytes.subarray(0, 4).toString("ascii");
  if (magic !== "OggS") {
    console.error(`check-embedded-tone: assets/${asset} is not an Ogg stream (magic '${magic}')`);
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
    console.error(`check-embedded-tone: ${id} drifted from assets/${asset} (${missing.length}/${chunks.length} chunks missing)`);
    console.error("                   run: powershell -File tools/embed-tones.ps1");
    failed = true;
    continue;
  }
  console.log(`check-embedded-tone: ok — ${id}: ${bytes.length} bytes, ${chunks.length} chunks from assets/${asset}`);
}

if (failed) process.exit(1);
console.log(`check-embedded-tone: ${Object.keys(TONES).length} tones match their packaged assets`);
