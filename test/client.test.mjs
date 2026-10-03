// Client-half tests.
//
// The bundle registers itself with `window.__ModuleLoader__`, so this harness
// provides the browser surface the factory touches (a tiny DOM, fetch, atob),
// a React implementation good enough to mount the plugin's components, and a
// fake client context whose services the tests drive directly. The result is a
// behavioural test of the parts that actually decide things: completion
// detection, the alert scope rules, persistence, navigation, and the notice
// queue.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const bundleSource = readFileSync(join(here, "..", "lib", "client.js"), "utf8");

/**
 * The base64 payload one built-in tone carries, read out of the harness's copy
 * of the generated tones module —?the same bytes the sandbox's bundle received.
 * The harness publishes it on `globalThis` because the sandbox's exports only
 * carry the library, not the payload map.
 */
function tonePayloadFromModule(module, toneId) {
  const tonesModule = globalThis.__tonesModuleForTest;
  assert.ok(tonesModule !== undefined, "the harness must expose the tones module");
  const payload = tonesModule.TONE_BASE64[toneId];
  assert.ok(typeof payload === "string" && payload.length > 0, `no payload for ${toneId}`);
  assert.ok(module.TONE_LIBRARY.some((tone) => tone.id === toneId), `${toneId} must be in the library`);
  return payload;
}

// ---------------------------------------------------------------------------
// Browser surface
// ---------------------------------------------------------------------------

/** A DOM node good enough for the bundle's small needs. */
function makeElement(tag) {
  const element = {
    tagName: String(tag).toUpperCase(),
    children: [],
    style: { cssText: "", setProperty() {}, removeProperty() {} },
    attributes: {},
    dataset: {},
    textContent: "",
    parent: null,
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
    getAttribute(name) {
      return this.attributes[name];
    },
    removeAttribute(name) {
      delete this.attributes[name];
    },
    appendChild(child) {
      child.parent = this;
      this.children.push(child);
      return child;
    },
    remove() {
      if (this.parent !== null) this.parent.children = this.parent.children.filter((child) => child !== this);
      this.parent = null;
    },
    querySelector() {
      return null;
    },
    addEventListener() {},
    removeEventListener() {},
    click() {},
    focus() {}
  };
  return element;
}

/**
 * A colour for any element the bundle probes, so the surface detection has
 * something plausible to parse.
 */
function makeDocument() {
  const head = makeElement("head");
  const body = makeElement("body");
  const doc = {
    head,
    body,
    createElement: (tag) => {
      const element = makeElement(tag);
      return element;
    },
    querySelector: (selector) => {
      if (String(selector).includes("completion-alert")) return null;
      return null;
    },
    querySelectorAll: () => [],
    addEventListener() {},
    removeEventListener() {}
  };
  return doc;
}

/** Install the globals the factory reads, and return a teardown. */
function installBrowser() {
  const previous = {};
  const keys = ["window", "document", "fetch", "atob", "getComputedStyle", "navigator", "AudioContext", "matchMedia", "FileReader", "requestAnimationFrame"];
  for (const key of keys) previous[key] = globalThis[key];

  // `navigator` and friends are accessor-only on modern Node, so a plain
  // assignment throws: define the value instead.
  const setGlobal = (key, value) => {
    try {
      Object.defineProperty(globalThis, key, { value, writable: true, configurable: true, enumerable: true });
    } catch {
      // An immovable global is skipped; the bundle tolerates every one of them.
    }
  };

  const document = makeDocument();
  setGlobal("window", globalThis);
  setGlobal("document", document);
  setGlobal("atob", (value) => Buffer.from(String(value), "base64").toString("binary"));
  setGlobal("navigator", { userAgent: "node-test" });
  setGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  setGlobal("getComputedStyle", () => ({
    backgroundColor: "rgba(255, 255, 255, 1)",
    color: "rgb(20, 20, 20)"
  }));
  const posts = [];
  setGlobal("fetch", (url, options) => {
    posts.push({ url: String(url), options });
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
  setGlobal("requestAnimationFrame", (callback) => setTimeout(callback, 0));
  setGlobal("AudioContext", undefined);

  return {
    document,
    posts,
    teardown() {
      for (const key of keys) {
        if (previous[key] === undefined) {
          try {
            delete globalThis[key];
          } catch {
            // Nothing to restore.
          }
        } else {
          setGlobal(key, previous[key]);
        }
      }
    }
  };
}

// ---------------------------------------------------------------------------
// React stand-in
// ---------------------------------------------------------------------------

/**
 * The smallest React stand-in the bundle needs to load. The tests drive the
 * plugin's stores and pure logic directly and never commit a component tree, so
 * `createElement` only has to build plain objects; the hooks exist so that a
 * call would not throw if a component were ever evaluated.
 */
function makeReact() {
  return {
    createElement(type, props, ...children) {
      return { kind: "element", type, props: props ?? {}, children: children.length <= 1 ? children[0] : children };
    },
    Fragment: "Fragment",
    memo: (component) => component,
    createPortal: (node) => node,
    useState: (initial) => [typeof initial === "function" ? initial() : initial, () => {}],
    useRef: (initial) => ({ current: initial }),
    useEffect: () => {},
    useLayoutEffect: () => {},
    useMemo: (factory) => factory(),
    useCallback: (callback) => callback,
    useSyncExternalStore: (subscribe, getSnapshot) => getSnapshot()
  };
}

// ---------------------------------------------------------------------------
// Bundle loading
// ---------------------------------------------------------------------------

/** Load the client bundle and return its exports plus the registration. */
function loadBundle({ react }) {
  const registrations = [];
  const browser = installBrowser();
  // The bundle's own copy of the generated tones module: a real ES module run in
  // the sandbox, so the test asserts on the same payloads the browser decodes.
  const tonesModule = { exports: {} };
  const tonesCode = readFileSync(join(here, "..", "lib", "tones-data.js"), "utf8")
    .replaceAll("export const ", "exports.");
  const sandboxWindow = {
    __ModuleLoader__: {
      load(definition) {
        registrations.push(definition);
      }
    },
    addEventListener() {},
    removeEventListener() {},
    setTimeout,
    clearTimeout
  };
  globalThis.window = sandboxWindow;
  const context = {
    window: sandboxWindow,
    document: globalThis.document,
    fetch: globalThis.fetch,
    atob: globalThis.atob,
    btoa: globalThis.btoa,
    navigator: globalThis.navigator,
    matchMedia: globalThis.matchMedia,
    getComputedStyle: globalThis.getComputedStyle,
    setTimeout,
    clearTimeout,
    console,
    // The plugin builds typed arrays and reads window.btoa when it encodes WAV.
    Uint8Array,
    Uint16Array,
    Int16Array,
    Float32Array,
    ArrayBuffer,
    DataView,
    Map,
    Set,
    Symbol,
    Object,
    String,
    Number,
    Math,
    Date,
    JSON,
    Promise,
    Error,
    TypeError,
    RangeError,
    RegExp,
    Array,
    isFinite,
    parseFloat,
    parseInt
  };
  context.globalThis = context;
  context.tonesModule = tonesModule;
  vm.createContext(context);
  vm.runInContext(`(function(exports){\n${tonesCode}\n})(tonesModule.exports)`, context, { filename: "tones-data.js" });
  // The payload map is not part of the sandbox's exports; publish it so the
  // drift assertions can compare the bundle's bytes with assets/.
  globalThis.__tonesModuleForTest = tonesModule.exports;
  const require = (specifier) => {
    // The harness owns these: react is the stub above (never the real package,
    // which would need a DOM), the tones module is the generated one, and the
    // primitives package is optional for the plugin —?requiring it must fail
    // exactly like a shell that does not ship it.
    if (specifier === "react") return react;
    if (specifier === "./tones-data.js") return tonesModule.exports;
    if (specifier === "@deepseek-ai/dsh-client-ui-primitives") throw new Error("not installed");
    throw new Error(`unexpected require: ${specifier}`);
  };
  vm.runInContext(bundleSource, context, { filename: "client.js" });
  assert.equal(registrations.length, 1, "the bundle registers exactly one module");
  const definition = registrations[0];
  assert.equal(definition.id, "dsh-completion-alert");
  return { module: definition.factory(require), definition, browser, context };
}

// ---------------------------------------------------------------------------
// Fake client context
// ---------------------------------------------------------------------------

/** A snapshot store, the shape every client service exposes. */
function makeStore(initial) {
  let state = initial;
  const listeners = new Set();
  return {
    getSnapshot: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set(next) {
      state = next;
      for (const listener of [...listeners]) listener();
    },
    listeners
  };
}

/**
 * Build a client context whose services can be driven from the test.
 * @param options.withSettingsScope - false to model a client without that service.
 */
function makeContext({ withSettingsScope = true } = {}) {
  const status = makeStore(new Map());
  const sessions = makeStore({ phase: "ready", ids: [], byId: {} });
  const settingsWrites = [];
  const settingsState = { value: {} };
  const settingsStore = makeStore(settingsState);
  const scope = {
    getSnapshot: () => settingsState,
    subscribe: settingsStore.subscribe,
    set: (field, value) => {
      settingsWrites.push({ field, value });
      settingsState.value = { ...settingsState.value, [field]: value };
      settingsStore.set(settingsState);
    }
  };
  const slots = [];
  const services = {
    uiSession: { sessionStatus: status },
    sessions: { list: sessions },
    uiWorkspace: {
      openSession: (id) => {
        services.opened.push(id);
      }
    },
    opened: [],
    settingsScope: withSettingsScope ? { bind: () => scope } : null
  };
  /**
   * `slots` is both the service the plugin waits for and the registry it writes
   * to. `register` runs the entry's `inject` face exactly like the real
   * renderer does, so tests can read the props a component would receive.
   */
  services.slots = {
    inject: (name, callback) => {
      // The real registry defers to the ledger; here the callback runs on the
      // spot and its return value is the entry's disposer.
      callback();
    },
    register: (options, component) => {
      const entry = { name: options?.name, id: options?.id, options, component, props: undefined };
      if (options !== null && options !== undefined && typeof options.inject === "function") {
        entry.props = options.inject();
      }
      slots.push(entry);
      return () => {};
    }
  };
  const effects = [];
  const warnings = [];
  const base = {
    logger: { warn: (message) => warnings.push(String(message)), info: () => {} },
    get: (name) => services[name] ?? null,
    effect: (factory, label) => {
      effects.push({ factory, label });
    },
    inject: (names, callback) => {
      const list = Array.isArray(names) ? names : [names];
      const missing = list.filter((name) => services[name] === null || services[name] === undefined);
      if (missing.length > 0) return;
      // A real sub-fiber resolves services as direct properties; the proxy below
      // reproduces that, so `scope.slots` / `scope.sessions` work as expected.
      callback(ctx);
    }
  };
  const ctx = new Proxy(base, {
    get(target, property) {
      if (property in target) return target[property];
      if (property in services) return services[property];
      return undefined;
    },
    has(target, property) {
      return property in target || property in services;
    }
  });
  return { ctx, status, sessions, slots, settingsWrites, settingsState, services, warnings, effects, scope };
}

/** Drive one session's running state, then let the watcher observe it. */
function setRunning(store, sessionId, running) {
  const next = new Map(store.getSnapshot());
  next.set(sessionId, { ...(next.get(sessionId) ?? {}), running });
  store.set(next);
}

/** Build the fake client context bundle the module needs. */
async function boot(options = {}) {
  const react = makeReact();
  const { module, browser } = loadBundle({ react });
  const world = makeContext(options);
  module.apply(world.ctx);
  return { module, react, browser, ...world };
}

// ---------------------------------------------------------------------------
// Exports and pure helpers
// ---------------------------------------------------------------------------

test("the bundle exports the module face the loader expects", async () => {
  const { module, browser } = await boot();
  try {
    assert.equal(typeof module.apply, "function");
    assert.equal(module.inject.length, 0, "no hard service requirement, so the row never stays pending");
    assert.equal(module.COMPLETION_ALERT_NS, "completion-alert");
  } finally {
    browser.teardown();
  }
});

test("every built-in tone is a real Ogg payload the bundle can reach", async () => {
  const { module, browser } = await boot();
  try {
    assert.ok(module.TONE_LIBRARY.length >= 3, "the library ships more than one tone");
    for (const tone of module.TONE_LIBRARY) {
      const payload = tonePayloadFromModule(module, tone.id);
      assert.ok(payload.length > 500, `${tone.id} must carry a payload`);
      const bytes = module.base64ToBytes(payload);
      // Ogg pages start with "OggS"; every tone must be one.
      assert.equal(String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]), "OggS", `${tone.id} is not an Ogg stream`);
      assert.equal(tone.source, `${tone.id}.ogg`, `${tone.id} must name the asset it came from`);
    }
  } finally {
    browser.teardown();
  }
});

test("every built-in tone matches its packaged asset (no drift)", async () => {
  const { module, browser } = await boot();
  try {
    for (const tone of module.TONE_LIBRARY) {
      const asset = readFileSync(join(here, "..", "assets", tone.source));
      assert.equal(tonePayloadFromModule(module, tone.id), asset.toString("base64"), `${tone.id} drifted from assets/${tone.source} —?run tools/embed-tones.ps1`);
    }
  } finally {
    browser.teardown();
  }
});

test("the tones module is the only file the bundle requires", async () => {
  const requires = [...bundleSource.matchAll(/require\((["'])([^"']+)\1\)/g)].map((match) => match[2]);
  assert.ok(requires.includes("react"), "the bundle requires react");
  for (const specifier of requires) {
    // Anything but react, the generated tones module and an optional primitives
    // package would make the client module graph resolve a file the loader does
    // not vouch for.
    assert.ok(
      specifier === "react" || specifier === "./tones-data.js" || specifier.startsWith("@deepseek-ai/"),
      `unexpected require: ${specifier}`
    );
  }
});

test("sanitizeSettings coerces every unusable value back to its default", async () => {
  const { module, browser } = await boot();
  try {
    assert.deepEqual(module.sanitizeSettings(null), module.DEFAULT_SETTINGS);
    const coerced = module.sanitizeSettings({
      enabled: "yes",
      alertScope: "everything",
      soundEnabled: 1,
      volume: 42,
      toneId: "not-a-tone",
      customData: "https://example.com/tone.mp3",
      customName: 7,
      customRange: { start: "a", end: "b" }
    });
    assert.equal(coerced.enabled, true);
    assert.equal(coerced.alertScope, "all");
    assert.equal(coerced.soundEnabled, true);
    assert.equal(coerced.volume, 1, "volume is clamped to 0..1");
    assert.equal(coerced.toneId, module.DEFAULT_TONE_ID, "an unknown tone id falls back to the default");
    assert.equal(coerced.customData, "", "only data: audio URLs are accepted");
    assert.equal(coerced.customName, "");
    assert.equal(coerced.customRange, null);
  } finally {
    browser.teardown();
  }
});

test("a stored custom tone survives, and 'custom' without a payload falls back", async () => {
  const { module, browser } = await boot();
  try {
    const withCustom = module.sanitizeSettings({ toneId: module.CUSTOM_TONE_ID, customData: "data:audio/wav;base64,AAAA" });
    assert.equal(withCustom.toneId, module.CUSTOM_TONE_ID);
    assert.equal(withCustom.customData, "data:audio/wav;base64,AAAA");
    const orphan = module.sanitizeSettings({ toneId: module.CUSTOM_TONE_ID, customData: "" });
    assert.equal(orphan.toneId, module.DEFAULT_TONE_ID, "a missing payload must not leave the plugin silent");
    const range = module.sanitizeSettings({ customRange: { start: 0.25, end: 1.75 } });
    // The value crosses the sandbox boundary, so compare fields rather than
    // object identity.
    assert.equal(range.customRange?.start, 0.25);
    assert.equal(range.customRange?.end, 1.75);
    const badRange = module.sanitizeSettings({ customRange: { start: 2, end: 1 } });
    assert.equal(badRange.customRange, null, "an inverted range is dropped");
  } finally {
    browser.teardown();
  }
});

test("a 1.0.x document migrates onto the tone fields", async () => {
  const { module, browser } = await boot();
  try {
    const legacyBuiltin = module.normalizeSettings({ soundSource: "builtin", soundData: "" });
    assert.equal(legacyBuiltin.toneId, module.DEFAULT_TONE_ID);
    const legacyCustom = module.normalizeSettings({ soundSource: "custom", soundData: "data:audio/wav;base64,AAAA", soundName: "old.wav" });
    assert.equal(legacyCustom.toneId, module.CUSTOM_TONE_ID);
    assert.equal(legacyCustom.customData, "data:audio/wav;base64,AAAA");
    assert.equal(legacyCustom.customName, "old.wav");
  } finally {
    browser.teardown();
  }
});

test("normalizeSettings merges a partial document onto the defaults", async () => {
  const { module, browser } = await boot();
  try {
    const fromValue = module.normalizeSettings({ value: { volume: 0.5 } });
    assert.equal(fromValue.volume, 0.5);
    assert.equal(fromValue.enabled, true, "a missing field keeps its default");
    const fromRaw = module.normalizeSettings({ alertScope: "background" });
    assert.equal(fromRaw.alertScope, "background");
    assert.equal(fromRaw.volume, module.DEFAULT_SETTINGS.volume);
  } finally {
    browser.teardown();
  }
});

test("effectiveSource picks the tone actually asked for", async () => {
  const { module, browser } = await boot();
  try {
    const base = module.DEFAULT_SETTINGS;
    assert.equal(module.effectiveSource(base), module.DEFAULT_TONE_ID);
    assert.equal(module.effectiveSource({ ...base, toneId: "crisp-a" }), "crisp-a");
    assert.equal(
      module.effectiveSource({ ...base, toneId: module.CUSTOM_TONE_ID, customData: "data:audio/wav;base64,AA" }),
      module.CUSTOM_TONE_ID
    );
    assert.equal(
      module.effectiveSource({ ...base, toneId: module.CUSTOM_TONE_ID, customData: "" }),
      module.DEFAULT_TONE_ID,
      "a missing upload falls back to a built-in tone"
    );
    assert.equal(module.effectiveSource({ ...base, toneId: "gone-in-2.0" }), module.DEFAULT_TONE_ID, "an unknown id falls back");
    assert.equal(module.effectiveSource({ ...base, soundEnabled: false }), "none");
  } finally {
    browser.teardown();
  }
});

test("the tone helpers drive the trim and the waveform", async () => {
  const { module, browser } = await boot();
  try {
    // trimRange clamps onto the buffer and always keeps a usable slice.
    const clamped = module.trimRange({ start: -1, end: 99 }, 3.5);
    assert.equal(clamped.start, 0);
    assert.equal(clamped.end, 3.5);
    assert.equal(clamped.duration, 3.5);
    const tiny = module.trimRange({ start: 1, end: 1.001 }, 3.5);
    assert.ok(tiny.duration >= 0.049, "a slice never collapses to nothing");
    assert.equal(module.formatSeconds(0.4567), "0.46s");

    // The library steps in order and exposes every tone.
    const ids = module.toneOptions().map((tone) => tone.id);
    assert.equal(ids.join(","), module.TONE_LIBRARY.map((tone) => tone.id).join(","));
    assert.ok(module.toneById("crisp-b").label.length > 0);
    assert.equal(module.toneById("nope"), undefined);

    // peaksOf reduces a decoded buffer to one min/max pair per column.
    const samples = new Float32Array(100);
    for (let index = 0; index < samples.length; index++) samples[index] = (index % 2 === 0 ? 1 : -1) * (index / 100);
    const fake = {
      numberOfChannels: 1,
      duration: 1,
      length: samples.length,
      sampleRate: 100,
      getChannelData: () => samples
    };
    const peaks = module.peaksOf(fake, 10);
    assert.equal(peaks.length, 10);
    assert.ok(peaks[9].max > peaks[0].max, "the envelope grows with the ramp");

    // encodeWav writes a real RIFF/WAVE header around the chosen slice.
    const wav = module.encodeWav(fake, { start: 0.2, duration: 0.3 });
    assert.ok(wav.startsWith("data:audio/wav;base64,"), "the slice is a WAV data URL");
    const bytes = Buffer.from(wav.slice("data:audio/wav;base64,".length), "base64");
    assert.equal(bytes.subarray(0, 4).toString("ascii"), "RIFF");
    assert.equal(bytes.subarray(8, 12).toString("ascii"), "WAVE");
    // 0.3 s at 100 Hz mono 16-bit plus the 44-byte header.
    assert.equal(bytes.length, 44 + 30 * 2);
  } finally {
    browser.teardown();
  }
});

test("duration and notice copy read the way a notice card should", async () => {
  const { module, browser } = await boot();
  try {
    assert.equal(module.formatDuration(18.4), "18 秒");
    assert.equal(module.formatDuration(72), "1 分 12 秒");
    assert.equal(module.formatDuration(undefined), "");
    assert.equal(
      module.completionText("写周报", 72),
      "「写周报」已完成 · 用时 1 分 12 秒"
    );
    assert.equal(module.completionText("写周报", undefined), "「写周报」已完成");
    assert.equal(module.sessionLabel({ displayTitle: "  压缩图标  " }), "压缩图标");
    assert.equal(module.sessionLabel({ displayTitle: "" }), "新会话");
    assert.equal(module.sessionLabel(null), "新会话");
  } finally {
    browser.teardown();
  }
});

test("the main session is the one retained for the main view", async () => {
  const { module, browser } = await boot();
  try {
    const list = { byId: {
      a: { id: "a", retainedBy: { mainView: 0 } },
      b: { id: "b", retainedBy: { mainView: 1 } },
      c: { id: "c", retainedBy: {} }
    } };
    assert.equal(module.resolveMainSessionId(list), "b");
    assert.equal(module.resolveMainSessionId({ byId: {} }), undefined);
    assert.equal(module.resolveMainSessionId(null), undefined);
  } finally {
    browser.teardown();
  }
});

// ---------------------------------------------------------------------------
// Completion detection
// ---------------------------------------------------------------------------

test("the first snapshot is a baseline, not a completion", async () => {
  const { module, browser } = await boot();
  try {
    const store = makeStore(new Map([["s1", { running: true }]]));
    const seen = [];
    const watcher = module.createCompletionWatcher({
      status: store,
      mainId: () => "s1",
      onComplete: (event) => seen.push(event)
    });
    watcher.start();
    assert.deepEqual(seen, [], "work already in flight at mount must not alert");
    store.set(new Map([["s1", { running: false }]]));
    assert.equal(seen.length, 1);
    watcher.stop();
  } finally {
    browser.teardown();
  }
});

test("a busy -> idle transition reports the session and its duration", async () => {
  const { module, browser } = await boot();
  try {
    const store = makeStore(new Map());
    const seen = [];
    const watcher = module.createCompletionWatcher({ status: store, mainId: () => undefined, onComplete: (event) => seen.push(event) });
    watcher.start();
    store.set(new Map([["s9", { running: true }]]));
    store.set(new Map([["s9", { running: false }]]));
    assert.equal(seen.length, 1);
    assert.equal(seen[0].sessionId, "s9");
    assert.equal(typeof seen[0].seconds, "number");
    assert.ok(seen[0].seconds >= 0);
    assert.equal(seen[0].isMain, false);
    watcher.stop();
  } finally {
    browser.teardown();
  }
});

test("an idle session that was already idle never reports", async () => {
  const { module, browser } = await boot();
  try {
    const store = makeStore(new Map([["s1", { running: false }]]));
    const seen = [];
    const watcher = module.createCompletionWatcher({ status: store, mainId: () => undefined, onComplete: (event) => seen.push(event) });
    watcher.start();
    store.set(new Map([["s1", { running: false, pendingInteraction: {} }]]));
    store.set(new Map([["s1", { running: false }]]));
    assert.deepEqual(seen, []);
    watcher.stop();
  } finally {
    browser.teardown();
  }
});

test("the main-view flag follows the session the main view shows", async () => {
  const { module, browser } = await boot();
  try {
    const store = makeStore(new Map());
    const seen = [];
    const watcher = module.createCompletionWatcher({ status: store, mainId: () => "viewed", onComplete: (event) => seen.push(event) });
    watcher.start();
    store.set(new Map([["viewed", { running: true }]]));
    store.set(new Map([["viewed", { running: false }]]));
    assert.equal(seen[0].isMain, true);
    store.set(new Map([["viewed", { running: false }], ["other", { running: true }]]));
    store.set(new Map([["viewed", { running: false }], ["other", { running: false }]]));
    assert.equal(seen[1].sessionId, "other");
    assert.equal(seen[1].isMain, false);
    watcher.stop();
  } finally {
    browser.teardown();
  }
});

test("a client without sessionStatus still loads", async () => {
  const { module, browser } = await boot();
  try {
    const watcher = module.createCompletionWatcher({ status: null, mainId: () => undefined, onComplete: () => {} });
    const stop = watcher.start();
    assert.equal(typeof stop, "function");
    stop();
  } finally {
    browser.teardown();
  }
});

// ---------------------------------------------------------------------------
// The live runtime (fake services, real stores)
// ---------------------------------------------------------------------------

/** Boot the plugin against the fake context and return its live stores. */
async function bootRuntime(options = {}) {
  const world = await boot(options);
  const overlay = world.slots.find((slot) => slot.name === "shell.overlay");
  const section = world.slots.find((slot) => slot.name === "settings.section");
  return { ...world, overlay, section, props: overlay?.props, sectionProps: section?.props };
}

test("the plugin mounts the notice layer and one settings page", async () => {
  const world = await bootRuntime();
  try {
    assert.ok(world.overlay, "shell.overlay must receive the notice layer");
    assert.equal(world.overlay.id, "completion-alert-toasts");
    assert.ok(world.section, "settings.section must receive the settings page");
    assert.equal(world.section.id, "completion-alert");
    assert.equal(world.sectionProps.runtime.settings.getSnapshot().enabled, true);
  } finally {
    world.browser.teardown();
  }
});

test("a finished round queues a notice titled by its session", async () => {
  const world = await bootRuntime();
  try {
    world.sessions.set({
      phase: "ready",
      ids: ["s1"],
      byId: { s1: { id: "s1", displayTitle: "压缩图标", retainedBy: { mainView: 1 } } }
    });
    setRunning(world.status, "s1", true);
    setRunning(world.status, "s1", false);
    const items = world.props.store.getSnapshot();
    assert.equal(items.length, 1);
    assert.equal(items[0].sessionId, "s1");
    assert.equal(items[0].title, "压缩图标");
    assert.match(items[0].detail, /\u5df2\u5b8c\u6210/);
  } finally {
    world.browser.teardown();
  }
});

test("the notice opens its session through uiWorkspace", async () => {
  const world = await bootRuntime();
  try {
    world.sessions.set({
      phase: "ready",
      ids: ["s1"],
      byId: { s1: { id: "s1", displayTitle: "压缩图标", retainedBy: { mainView: 1 } } }
    });
    setRunning(world.status, "s1", true);
    setRunning(world.status, "s1", false);
    world.props.openSession("s1");
    assert.deepEqual(world.services.opened, ["s1"]);
  } finally {
    world.browser.teardown();
  }
});

test("scope=background keeps the session on screen quiet but reports the others", async () => {
  const world = await bootRuntime();
  try {
    world.sessions.set({
      phase: "ready",
      ids: ["viewed", "other"],
      byId: {
        viewed: { id: "viewed", displayTitle: "正在看的", retainedBy: { mainView: 1 } },
        other: { id: "other", displayTitle: "后台的", retainedBy: {} }
      }
    });
    world.sectionProps.runtime.update({ alertScope: "background" });
    setRunning(world.status, "viewed", true);
    setRunning(world.status, "viewed", false);
    assert.equal(world.props.store.getSnapshot().length, 0, "the visible session must stay quiet");
    setRunning(world.status, "other", true);
    setRunning(world.status, "other", false);
    const items = world.props.store.getSnapshot();
    assert.equal(items.length, 1);
    assert.equal(items[0].sessionId, "other");
  } finally {
    world.browser.teardown();
  }
});

test("disabling the feature stops both the notice and the tone", async () => {
  const world = await bootRuntime();
  try {
    world.sectionProps.runtime.update({ enabled: false });
    setRunning(world.status, "s1", true);
    setRunning(world.status, "s1", false);
    assert.equal(world.props.store.getSnapshot().length, 0);
  } finally {
    world.browser.teardown();
  }
});

test("settings updates are pushed to the plugin's own namespace", async () => {
  const world = await bootRuntime();
  try {
    world.sectionProps.runtime.update({ volume: 0.4 });
    world.sectionProps.runtime.update({ alertScope: "background" });
    // Writes are debounced; wait for the timer.
    await new Promise((resolve) => setTimeout(resolve, 450));
    const fields = world.settingsWrites.map((write) => write.field);
    assert.ok(fields.includes("volume"), "volume must reach the host");
    assert.ok(fields.includes("alertScope"), "the scope choice must reach the host");
    assert.equal(world.settingsState.value.volume, 0.4);
  } finally {
    world.browser.teardown();
  }
});

test("the host document seeds the settings the page then follows", async () => {
  const world = await bootRuntime();
  try {
    world.scope.set("soundEnabled", false);
    const settings = world.sectionProps.runtime.settings.getSnapshot();
    assert.equal(settings.soundEnabled, false, "a host revision must reach the store");
  } finally {
    world.browser.teardown();
  }
});

test("a client without settingsScope still mounts everything", async () => {
  const world = await bootRuntime({ withSettingsScope: false });
  try {
    assert.ok(world.overlay, "the notice layer does not depend on settings");
    assert.ok(world.section, "the settings page still renders with local defaults");
    assert.equal(world.sectionProps.runtime.settings.getSnapshot().enabled, true);
  } finally {
    world.browser.teardown();
  }
});

test("the notice queue dismisses and clears", async () => {
  const world = await bootRuntime();
  try {
    const store = world.props.store;
    const first = store.push({ sessionId: "a", title: "A", detail: "d", at: 1 });
    store.push({ sessionId: "b", title: "B", detail: "d", at: 2 });
    assert.equal(store.getSnapshot().length, 2);
    store.remove(first);
    assert.equal(store.getSnapshot().map((item) => item.sessionId).join(","), "b");
    store.clear();
    assert.equal(store.getSnapshot().length, 0);
  } finally {
    world.browser.teardown();
  }
});

test("activation facts are reported to the diagnostics route", async () => {
  const world = await bootRuntime();
  try {
    await new Promise((resolve) => setTimeout(resolve, 20));
    const posts = world.browser.posts.filter((entry) => entry.url === "/api/completion-alert.diag");
    assert.ok(posts.length >= 1, "the browser half must report its activation");
    const reports = posts.map((entry) => JSON.parse(entry.options.body));
    const activation = reports.find((report) => "watcher" in report.facts);
    assert.ok(activation, "the runtime must report which surfaces it mounted");
    assert.equal(activation.facts.watcher, true);
    assert.equal(activation.facts.overlay, true);
    assert.equal(activation.facts.settings, true);
  } finally {
    world.browser.teardown();
  }
});
