// Refuse to publish a bundle that carries a local-only tone.
//
// The working copy's lib/client.js is built with tools/tones.local.json merged in
// (see tools/use-local-tone.ps1), because this checkout is mounted in place and
// the plugin has to play those tones. That means the committed bundle can contain
// recordings that must never reach the registry — so `prepublishOnly` runs this,
// and CI runs it too.
//
// The rule is simple: the block embedded in lib/client.js may only describe tones
// that tools/tones.json declares. Anything else came from the local registry.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const shipped = JSON.parse(readFileSync(join(root, "tools", "tones.json"), "utf8"));
const shippedIds = new Set((shipped.tones ?? []).map((tone) => tone.id));

const bundle = readFileSync(join(root, "lib", "client.js"), "utf8");
const block = /\/\/#region embedded-tones([\s\S]*?)\/\/#endregion embedded-tones/.exec(bundle);
if (block === null) {
  console.error("check-no-local-tones: the embedded-tones block is missing from lib/client.js");
  process.exit(1);
}

const embedded = [...block[1].matchAll(/^        id: "([^"]+)"/gm)].map((match) => match[1]);
const strays = embedded.filter((id) => !shippedIds.has(id));

console.log(`check-no-local-tones: shipped registry = ${[...shippedIds].join(", ")}`);
console.log(`check-no-local-tones: embedded bundle  = ${embedded.join(", ")}`);

if (strays.length > 0) {
  console.error("");
  console.error(`check-no-local-tones: ${strays.length} tone(s) in the bundle are NOT in the shipped registry:`);
  for (const id of strays) console.error(`                     ${id}`);
  console.error("                     These came from tools/tones.local.json and must not be published.");
  console.error("                     To publish the shipped tones only, temporarily move the local registry aside");
  console.error("                     (rename tools/tones.local.json), re-run tools/embed-tones.ps1, then publish.");
  process.exit(1);
}

console.log("check-no-local-tones: nothing local in the bundle");
