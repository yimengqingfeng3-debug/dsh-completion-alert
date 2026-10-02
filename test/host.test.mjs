// Host-half tests: the settings schema the browser half writes through, and the
// diagnostics route the browser half reports to.
import test from "node:test";
import assert from "node:assert/strict";
import z from "@deepseek-ai/schemastery";

import plugin, {
  COMPLETION_ALERT_FIELDS,
  CompletionAlertSettings,
  Config,
  DIAG_PATH,
  apply,
  applyDiagnostics,
  inject,
  name
} from "../lib/index.js";

/** A minimal cordis-like context that records what the plugin registers. */
function fakeContext({ withConnection = true, withSettings = true } = {}) {
  const effects = [];
  const provided = [];
  const warnings = [];
  const injected = [];
  const routes = [];
  const registrations = [];
  const ctx = {
    logger: { warn: (message) => warnings.push(String(message)), info: () => {} },
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
  return { ctx, effects, provided, warnings, injected, routes, registrations };
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
  assert.equal(COMPLETION_ALERT_FIELDS.soundSource.meta.default, "builtin");
  assert.equal(COMPLETION_ALERT_FIELDS.volume.meta.default, 0.9);
  assert.equal(COMPLETION_ALERT_FIELDS.soundData.meta.default, "");
  assert.equal(COMPLETION_ALERT_FIELDS.soundName.meta.default, "");
});

test("every declared field validates on its own", () => {
  // Each field is what a single `settingsScope.set(field, value)` write carries,
  // so each must accept its own shape without coercion surprises.
  const cases = {
    enabled: [true, false],
    soundEnabled: [true, false],
    alertScope: ["all", "background"],
    soundSource: ["builtin", "custom"],
    volume: [0, 0.5, 1],
    soundData: ["", "data:audio/ogg;base64,AAAA"],
    soundName: ["", "my-tone.ogg"]
  };
  for (const [field, values] of Object.entries(cases)) {
    const schema = COMPLETION_ALERT_FIELDS[field];
    for (const value of values) {
      assert.equal(schema(value), value, `${field} rejected ${JSON.stringify(value)}`);
    }
  }
});

test("apply registers the diagnostics route and tolerates a settings service", () => {
  const { ctx, routes, registrations, warnings } = fakeContext();
  apply(ctx);
  assert.equal(routes.length, 1, "the diagnostics route is the host half's one surface");
  assert.equal(routes[0].path, DIAG_PATH);
  assert.deepEqual(routes[0].methods, ["GET", "POST"]);
  assert.equal(registrations.length + warnings.length >= 1, true);
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
