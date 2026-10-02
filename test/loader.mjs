// Test-only module resolution.
//
// The host half imports `@deepseek-ai/schemastery`, a peer dependency the dsh
// runtime provides. `node --test` resolves it from this package's own
// node_modules when `npm install` has been run (CI does exactly that), and falls
// back to the copy the installed dsh runtime ships, so the suite also runs
// inside a checkout that has never been installed.
import { register } from "node:module";
import { existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/** Directories that may hold a copy of the runtime's node_modules. */
function candidateRoots() {
  const roots = [
    // The package's own node_modules first: that is what npm install provides.
    join(here, "..", "node_modules"),
    join(here, "..", "..", "node_modules")
  ];
  const dshHome = process.env.DSH_HOME;
  if (typeof dshHome === "string" && dshHome.length > 0) {
    roots.push(
      join(dshHome, "profiles", "desktop", "node_modules"),
      join(dshHome, "profiles", "web", "node_modules"),
      join(dshHome, "profiles", "node_modules"),
      join(dshHome, "node_modules")
    );
  }
  return roots;
}

/** The first existing entry point for one package name, or null. */
function findPackage(name) {
  for (const root of candidateRoots()) {
    const base = join(root, name);
    if (!existsSync(base)) continue;
    for (const candidate of [join(base, "lib", "index.mjs"), join(base, "lib", "index.cjs"), join(base, "index.mjs"), join(base, "index.js")]) {
      if (existsSync(candidate)) return pathToFileURL(candidate).href;
    }
    try {
      for (const file of readdirSync(base)) {
        if (file.endsWith(".mjs") || file.endsWith(".js")) return pathToFileURL(join(base, file)).href;
      }
    } catch {
      // Unreadable candidate: try the next root.
    }
  }
  return null;
}

const mapped = {
  "@deepseek-ai/schemastery": findPackage("@deepseek-ai/schemastery")
};

// Report once, so a silent fallback cannot hide behind a confusing failure.
if (Object.values(mapped).every((value) => value === null)) {
  process.emitWarning("dsh-completion-alert tests: no schemastery copy found (run npm install)");
}

register("./loader-hooks.mjs", import.meta.url, { data: { mapped } });
