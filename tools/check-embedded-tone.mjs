// Cross-platform drift check: does the tone embedded in lib/client.js still
// match assets/bingbingbing.ogg?
//
// `tools/embed-audio.ps1 -Check` does the same thing on Windows; this node
// variant is what CI runs, so the guarantee holds on every platform. The same
// comparison is asserted by test/client.test.mjs; this entry point exists so a
// single CI step can report it without running the whole suite.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const clientPath = join(root, "lib", "client.js");
const assetPath = join(root, "assets", "bingbingbing.ogg");

const bundle = readFileSync(clientPath, "utf8");
const chunk = /\/\/#region embedded-tone([\s\S]*?)\/\/#endregion embedded-tone/.exec(bundle);
if (chunk === null) {
  console.error("check-embedded-tone: the embedded-tone marker chunk is missing from lib/client.js");
  process.exit(1);
}

const payload = [...chunk[1].matchAll(/'([A-Za-z0-9+/=]+)'/g)].map((match) => match[1]).join("");
const expected = readFileSync(assetPath).toString("base64");

if (payload.length === 0) {
  console.error("check-embedded-tone: the bundle carries no tone payload; run tools/embed-audio.ps1");
  process.exit(1);
}

if (payload !== expected) {
  console.error(`check-embedded-tone: lib/client.js and assets/bingbingbing.ogg differ (${payload.length} vs ${expected.length} base64 chars)`);
  console.error("                   run: powershell -File tools/embed-audio.ps1");
  process.exit(1);
}

// The first four decoded bytes must be an Ogg page header, or the asset is not
// the format the Web Audio decoder accepts.
const bytes = Buffer.from(payload, "base64");
const magic = bytes.subarray(0, 4).toString("ascii");
if (magic !== "OggS") {
  console.error(`check-embedded-tone: the embedded payload is not an Ogg stream (magic '${magic}')`);
  process.exit(1);
}

console.log(`check-embedded-tone: ok — ${bytes.length} bytes, one ${payload.length}-char base64 payload, matches assets/bingbingbing.ogg`);
