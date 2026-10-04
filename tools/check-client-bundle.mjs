// Refuse a client bundle that cannot be loaded the way the app loads it.
//
// The desktop renderer cannot be inspected, so a bundle that parses but fails to
// *activate* shows up as a whole-app boot failure with a crash log and a blank
// window. `node --check` does not catch every way that happens, and this runs the
// real load path instead: the bundle is evaluated with the module-loader shim the
// shipped web plugins use, and the factory is called for real.
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

const PATH = new URL("../lib/client.js", import.meta.url);
const source = readFileSync(PATH, "utf8");

const failures = [];

// 1. It must be a module in the loader format, with balanced structure.
for (const [what, needle] of [
  ["the module-loader call", "window.__ModuleLoader__.load("],
  ["the factory export", "return module.exports;"]
]) {
  if (!source.includes(needle)) failures.push(`the bundle is missing ${what}`);
}

// 2. It must evaluate, register itself, and run its factory.
const registered = [];
const sandbox = {
  window: {},
  globalThis: undefined,
  console,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  document: undefined,
  navigator: { userAgent: "bundle-gate" },
  fetch: () => Promise.resolve({ ok: false }),
  Promise,
  Date,
  Math,
  JSON,
  Object,
  Array,
  String,
  Number,
  Boolean,
  Symbol,
  Map,
  Set,
  WeakMap,
  Error,
  TypeError,
  RangeError,
  isFinite,
  parseFloat,
  parseInt
};
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
sandbox.window.__ModuleLoader__ = {
  load(entry) {
    registered.push(entry);
  }
};
sandbox.__ModuleLoader__ = sandbox.window.__ModuleLoader__;

try {
  runInContext(source, createContext(sandbox), { filename: "client.js" });
} catch (error) {
  failures.push(`evaluating the bundle threw: ${error?.message ?? error}`);
}

if (registered.length !== 1) {
  failures.push(`the bundle registered ${registered.length} entries, expected 1`);
} else {
  const entry = registered[0];
  if (entry.id !== "dsh-completion-alert") failures.push(`unexpected plugin id: ${entry.id}`);
  if (typeof entry.factory !== "function") {
    failures.push("the entry has no factory");
  } else {
    // The loader resolves only `react` and `@deepseek-ai/*`; a relative
    // specifier fails the whole web boot, so it is checked here too.
    const react = {
      createElement: () => ({}),
      Fragment: "Fragment",
      memo: (component) => component,
      createPortal: (node) => node,
      useState: (initial) => [initial, () => {}],
      useEffect: () => {},
      useRef: (initial) => ({ current: initial }),
      useMemo: (compute) => compute(),
      useCallback: (callback) => callback,
      useSyncExternalStore: (_subscribe, snapshot) => snapshot()
    };
    const require = (specifier) => {
      if (specifier === "react") return react;
      if (specifier.startsWith("@deepseek-ai/")) return {};
      throw new Error(`the loader cannot resolve '${specifier}'`);
    };
    try {
      const exported = entry.factory(require);
      if (exported === null || typeof exported !== "object") failures.push("the factory returned nothing");
      else if (typeof exported.apply !== "function") failures.push("the module exports no apply()");
    } catch (error) {
      failures.push(`the factory threw: ${error?.message ?? error}`);
    }
  }
}

if (failures.length > 0) {
  console.error("client-bundle gate: the bundle cannot be loaded");
  for (const line of failures) console.error(`  - ${line}`);
  process.exit(1);
}
console.log("client-bundle gate: the bundle registers and its factory runs");
