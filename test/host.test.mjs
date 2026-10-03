// Host-half tests: the settings schema the browser half writes through, and the
// diagnostics route the browser half reports to.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import z from "@deepseek-ai/schemastery";

import plugin, {
  COMPLETION_ALERT_FIELDS,
  CompletionAlertSettings,
  Config,
  DIAG_PATH,
  OUTCOME_PATH,
  SETTINGS_PATH,
  apply,
  applyDiagnostics,
  applyTurnOutcomes,
  describeTurnEnd,
  inject,
  name
} from "../lib/index.js";

/** A minimal cordis-like context that records what the plugin registers. */
function fakeContext({ withConnection = true, withSettings = true, profileDir = mkdtempSync(join(tmpdir(), "dsh-ca-")) } = {}) {
  const effects = [];
  const provided = [];
  const warnings = [];
  const injected = [];
  const routes = [];
  const registrations = [];
  /** event name -> listeners, for the turn-outcome listener. */
  const listeners = new Map();
  const ctx = {
    profileContext: { dir: profileDir },
    logger: { warn: (message) => warnings.push(String(message)), info: () => {} },
    on: (event, listener) => {
      const bucket = listeners.get(event) ?? [];
      bucket.push(listener);
      listeners.set(event, bucket);
      return () => {};
    },
    effect: (factory, label) => {
      effects.push({ factory, label });
      // Like the real client, the factory runs immediately and its return value
      // is the disposer. Diagnostics are mounted inside one, so the test must
      // run it to reach the route registration.
      try {
        factory();
      } catch (error) {
        warnings.push(`effect failed: ${String(error?.message ?? error)}`);
      }
    },
    inject: (deps, callback) => {
      injected.push(deps);
      const list = Array.isArray(deps) ? deps : [deps];
      if (list.includes("connection") && !withConnection) return;
      if (list.includes("settings") && !withSettings) return;
      const scope = {
        logger: ctx.logger,
        effect: ctx.effect,
        provide: (key, value) => provided.push({ key, value }),
        connection: {
          fetch: {
            register: (route) => {
              routes.push(route);
              return () => {};
            }
          }
        },
        settings: {
          register: (...args) => registrations.push(args)
        }
      };
      callback(scope);
    }
  };
  return {
    ctx,
    effects,
    provided,
    warnings,
    injected,
    routes,
    registrations,
    profileDir,
    listeners,
    /** Fire one session event the way the app's agent runtime does. */
    emit(event, session, payload) {
      for (const listener of listeners.get(event) ?? []) listener(session, payload);
    }
  };
}

/** Decode one schema's defaults by validating an empty object. */
function defaultsOf(schema) {
  return schema({});
}

test("plugin row exports the shape the loader expects", () => {
  assert.equal(name, "completion-alert");
  assert.equal(plugin.name, "completion-alert");
  assert.equal(typeof plugin.apply, "function");
  assert.deepEqual(plugin.inject, []);
  assert.deepEqual(inject, []);
  assert.equal(plugin.Config, Config);
});

test("no host service is hard-required, so the row can never stay pending", () => {
  assert.deepEqual(inject, [], "a required service would gate the whole browser half");
});

test("the live-editable node carries the volatile marker the app reads", () => {
  // The app's profile boot projects each row's Config to JSON Schema and tags a
  // volatile node with `x-cordis.volatile`; the settings controller then allows
  // runtime writes at exactly that path. The marker must therefore sit on
  // `completionAlert` and nowhere inside it (the app rejects a volatile field
  // under another volatile field: "volatile fields require a fixed object path").
  const node = CompletionAlertSettings;
  assert.equal(node.meta?.volatile, true, "completionAlert must be the volatile node");
  for (const [name, field] of Object.entries(COMPLETION_ALERT_FIELDS)) {
    assert.notEqual(field.meta?.volatile, true, `${name} must not be volatile itself`);
  }
  assert.ok(Config({}).completionAlert !== undefined, "the row Config must expose the completionAlert key");
});

test("the row Config describes every field the browser half writes", () => {
  // A volatile node is opaque to schemastery's own parse (it is a write marker,
  // not a value the loader fills), so the declared surface is asserted on the
  // described schema — which is also what the app projects to JSON Schema for
  // its settings document.
  const described = JSON.stringify(Config.toJSON());
  for (const field of Object.keys(COMPLETION_ALERT_FIELDS)) {
    assert.ok(described.includes(field), `completionAlert.${field} must appear in the described schema`);
  }
  assert.ok(described.includes("completionAlert"), "the row Config must expose the completionAlert key");
});

test("the declared defaults match the browser half's shipped defaults", () => {
  assert.equal(COMPLETION_ALERT_FIELDS.enabled.meta.default, true);
  assert.equal(COMPLETION_ALERT_FIELDS.soundEnabled.meta.default, true);
  assert.equal(COMPLETION_ALERT_FIELDS.alertScope.meta.default, "all");
  assert.equal(COMPLETION_ALERT_FIELDS.toneId.meta.default, "bingbingbing");
  assert.equal(COMPLETION_ALERT_FIELDS.volume.meta.default, 0.9);
  assert.equal(COMPLETION_ALERT_FIELDS.customData.meta.default, "");
  assert.equal(COMPLETION_ALERT_FIELDS.customName.meta.default, "");
  assert.equal(COMPLETION_ALERT_FIELDS.customRange.meta.default, null);
});

test("every declared field validates on its own", () => {
  // Each field is what a single `settingsScope.set(field, value)` write carries,
  // so each must accept its own shape without coercion surprises.
  const cases = {
    enabled: [true, false],
    soundEnabled: [true, false],
    alertScope: ["all", "background"],
    toneId: ["bingbingbing", "crisp-a", "crisp-b", "custom"],
    volume: [0, 0.5, 1],
    customData: ["", "data:audio/wav;base64,AAAA"],
    customName: ["", "my-tone.ogg"],
    customRange: [{ start: 0, end: 1.2 }, null]
  };
  for (const [field, values] of Object.entries(cases)) {
    const schema = COMPLETION_ALERT_FIELDS[field];
    assert.equal(typeof schema, "function", `${field} must expose a schema`);
    for (const value of values) {
      assert.deepEqual(schema(value), value, `${field} rejected ${JSON.stringify(value)}`);
    }
  }
});

test("apply registers the diagnostics route and tolerates a settings service", () => {
  const { ctx, routes, registrations, warnings } = fakeContext();
  apply(ctx);
  assert.equal(routes.length, 3, "the host half serves the report, the turn outcome and its own settings store");
  const diag = routes.find((route) => route.path === DIAG_PATH);
  const outcome = routes.find((route) => route.path === OUTCOME_PATH);
  assert.ok(diag, "the diagnostics route is registered");
  assert.deepEqual(diag.methods, ["GET", "POST"]);
  assert.ok(outcome, "the turn-outcome route is registered");
  assert.deepEqual(outcome.methods, ["GET"]);
  const store = routes.find((route) => route.path === SETTINGS_PATH);
  assert.ok(store, "the plugin's own settings store is registered");
  assert.deepEqual(store.methods, ["GET", "POST"]);
  assert.equal(registrations.length + warnings.length >= 1, true);
});

test("the turn-outcome route reports how the newest turn ended", async () => {
  const { ctx, routes, emit } = fakeContext();
  apply(ctx);
  const route = routes.find((row) => row.path === OUTCOME_PATH);
  const ask = (sessionId) =>
    route.fetch({ method: "GET", url: `http://localhost${OUTCOME_PATH}?sessionId=${sessionId}` })
      .then((response) => response.json());

  // Nothing recorded yet: the browser half must get "unknown", not a guess.
  assert.deepEqual(await ask("s1"), { kind: null, cause: "", turn: null, at: null });

  emit("session/event", { header: { id: "s1" } }, { type: "turn/end", data: { turn: 3, reason: { kind: "completed" } } });
  assert.equal((await ask("s1")).kind, "completed");

  // A user hitting Stop: this is the case the plugin used to announce anyway.
  emit("session/event", { header: { id: "s1" } }, {
    type: "turn/end",
    data: { turn: 4, reason: { kind: "aborted", reason: { kind: "user" } } }
  });
  const stopped = await ask("s1");
  assert.equal(stopped.kind, "aborted");
  assert.equal(stopped.cause, "user");
  assert.equal(stopped.turn, 4);

  // Events that are not a turn end are ignored.
  emit("session/event", { header: { id: "s1" } }, { type: "assistant/message", data: {} });
  assert.equal((await ask("s1")).kind, "aborted");

  // Another session is unaffected.
  assert.equal((await ask("s2")).kind, null);

  // An unknown reason still records, so the browser half can decide.
  emit("session/event", { header: { id: "s3" } }, { type: "turn/end", data: { turn: 1, reason: { kind: "interrupted" } } });
  assert.equal((await ask("s3")).kind, "interrupted");
});

test("the settings store round-trips a document", async () => {
  const fake = fakeContext();
  const { ctx, routes } = fake;
  apply(ctx);
  const route = routes.find((row) => row.path === SETTINGS_PATH);
  const write = (settings) =>
    route.fetch({ method: "POST", url: `http://localhost${SETTINGS_PATH}`, text: async () => JSON.stringify({ settings }) })
      .then((response) => response.json());
  const read = () => route.fetch({ method: "GET", url: `http://localhost${SETTINGS_PATH}` }).then((response) => response.json());

  // Nothing stored yet reads as null rather than as a guess.
  assert.equal((await read()).settings, null);

  const document = { enabled: false, alertScope: "background", toneId: "crisp-b" };
  assert.equal((await write(document)).ok, true, "a document is accepted");
  const stored = await read();
  assert.equal(stored.stored, true);
  assert.equal(existsSync(join(fake.profileDir, "completion-alert.settings.json")), true, "the document is on disk");
  assert.deepEqual(stored.settings, document);

  // A malformed body is refused, not stored.
  const bad = await route.fetch({ method: "POST", url: `http://localhost${SETTINGS_PATH}`, text: async () => "not json" })
    .then((response) => response.json());
  assert.equal(bad.ok, false);
  assert.deepEqual((await read()).settings, document, "the stored document survives a bad write");
});

test("apply on a composition without settings or connection still succeeds", () => {
  const warnings = [];
  const ctx = {
    logger: { warn: (message) => warnings.push(String(message)) },
    effect: () => {},
    inject: (deps, callback) => {
      // Neither service exists: the callback must not be reached, and nothing throws.
      if (deps.includes("settings") || deps.includes("connection")) return;
      callback(ctx);
    }
  };
  assert.doesNotThrow(() => apply(ctx));
});

test("the diagnostics route stores one report and serves it back", async () => {
  const { ctx, routes } = fakeContext();
  applyDiagnostics(ctx);
  const route = routes[0];
  const post = await route.fetch(new Request(`http://127.0.0.1${DIAG_PATH}`, {
    method: "POST",
    body: JSON.stringify({ facts: { watcher: true }, overlayInDom: true })
  }));
  assert.equal(post.status, 200);
  const get = await route.fetch(new Request(`http://127.0.0.1${DIAG_PATH}`, { method: "GET" }));
  const payload = await get.json();
  assert.equal(payload.report.facts.watcher, true);
  assert.equal(payload.report.overlayInDom, true);
  assert.equal(typeof payload.report.receivedAt, "number");
});

test("a malformed report is stored as an error, not thrown", async () => {
  const { ctx, routes } = fakeContext();
  applyDiagnostics(ctx);
  const route = routes[0];
  await route.fetch(new Request(`http://127.0.0.1${DIAG_PATH}`, { method: "POST", body: "not json" }));
  const payload = await (await route.fetch(new Request(`http://127.0.0.1${DIAG_PATH}`, { method: "GET" }))).json();
  assert.equal(typeof payload.report.error, "string");
});

test("the diagnostics route answers an empty read before any report", async () => {
  const { ctx, routes } = fakeContext();
  applyDiagnostics(ctx);
  const payload = await (await routes[0].fetch(new Request(`http://127.0.0.1${DIAG_PATH}`, { method: "GET" }))).json();
  assert.deepEqual(payload, { report: null });
});
