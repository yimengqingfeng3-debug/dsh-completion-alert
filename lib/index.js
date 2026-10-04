// dsh-completion-alert — host half.
//
// This plugin is a browser-side feature: the alert tone is embedded in the
// client bundle and every fact it needs (session running state, session titles,
// navigation, preferences) comes from client services it already finds. So the
// host half does exactly two things:
//
//   1. it declares the settings schema the browser half writes through
//      `settingsScope` — the settings service validates every write against the
//      loader row's Config, so a field that is not declared here cannot be saved;
//   2. it serves one diagnostics route, `/api/completion-alert.diag`, so the
//      browser half can hand its own activation report to ordinary HTTP. The
//      desktop renderer cannot be inspected from outside, and a plugin whose
//      service or slot is missing renders nothing and says nothing; this route
//      is how "it is mounted, and here is what it found" becomes observable.
//
// Nothing here is required: `inject` is deliberately empty, so a composition
// that lacks the connection service still boots with the browser half intact.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import z from "@deepseek-ai/schemastery";

/** Authenticated exact Fetch route owned by this plugin (browser -> host report). */
const DIAG_PATH = "/api/completion-alert.diag";

/**
/**
 * Authenticated exact Fetch route: this plugin's own preferences document.
 *
 *   GET  /api/completion-alert.settings  -> { settings, at }
 *   POST /api/completion-alert.settings  -> stores one settings document
 *
 * Why a plugin keeps its own copy: the client's settings transport
 * (`ctx.configForms`) falls back to `persistence: "memory"` whenever the page is
 * not a loopback one, and a memory form answers every write with `false` - so a
 * choice looks saved and is gone after a restart. Measured in the desktop app:
 * every field write reported `accepted: false`. This route is what the browser
 * half falls back to, so the preferences survive regardless of that decision.
 *
 * Stored as JSON beside the profile's own files rather than inside them: the
 * profile manifest and its lockfile are rewritten by pnpm and the plugin manager,
 * and a preference has no business in that fight.
 */
const SETTINGS_PATH = "/api/completion-alert.settings";

/** The file the document is kept in, beside the profile's other plugin data. */
const SETTINGS_FILE = "completion-alert.settings.json";

/**
 * Read and write the preferences document.
 * @param ctx - host plugin context.
 */
function applySettingsStore(ctx) {
  let filePath = "";
  try {
    const dir = ctx.profileContext?.dir;
    if (typeof dir === "string" && dir !== "") filePath = join(dir, SETTINGS_FILE);
  } catch {
    filePath = "";
  }

  /** The stored document, or null when nothing usable is stored. */
  const read = () => {
    if (filePath === "") return { settings: null, at: null, stored: false };
    try {
      const parsed = JSON.parse(readFileSync(filePath, "utf8"));
      const settings = typeof parsed?.settings === "object" && parsed.settings !== null ? parsed.settings : null;
      return { settings, at: parsed?.at ?? null, stored: settings !== null };
    } catch {
      // Missing or unreadable reads as "nothing stored yet".
      return { settings: null, at: null, stored: false };
    }
  };

  ctx.inject(["connection"], (scope) => {
    scope.effect(() => scope.connection.fetch.register({
      path: SETTINGS_PATH,
      methods: ["GET", "POST"],
      requestBody: "buffered",
      fetch: async (request) => {
        const headers = { "cache-control": "no-store" };
        if (request.method === "GET") return Response.json(read(), { headers });
        let document = null;
        try {
          const payload = JSON.parse(await request.text());
          if (typeof payload?.settings === "object" && payload.settings !== null) document = payload.settings;
        } catch {
          return Response.json({ ok: false, error: "the document was not JSON" }, { status: 400, headers });
        }
        if (document === null) {
          return Response.json({ ok: false, error: "no settings in the body" }, { status: 400, headers });
        }
        if (filePath === "") {
          return Response.json({ ok: false, error: "this Host has nowhere to store settings" }, { headers });
        }
        try {
          writeFileSync(filePath, JSON.stringify({ at: Date.now(), settings: document }, null, 2));
        } catch (error) {
          return Response.json({ ok: false, error: String(error?.message ?? error) }, { headers });
        }
        return Response.json({ ok: true, at: Date.now() }, { headers });
      }
    }), "completion-alert: settings store");
  });
}

/**
 * Authenticated exact Fetch route: how each session's newest turn ended.
 *
 *   GET /api/completion-alert.outcome?sessionId=<id>
 *     -> { kind, turn, at }   the newest recorded turn end for that session
 *     -> { kind: null }       nothing recorded (the turn predates this row)
 *
 * Why the host has to answer this: the browser half detects "a round finished"
 * from `uiSession.sessionStatus`, whose only facts are running /
 * pendingInteraction / completionUnread. A turn the user stopped by hand flips
 * `running` exactly like a finished one, so that projection cannot tell them
 * apart — and the plugin would fire its tone at a stop button. The agent's own
 * `turn/end` event carries the reason, and only the host sees session events.
 */
const OUTCOME_PATH = "/api/completion-alert.outcome";

/** How long a recorded turn end stays answerable (a stale read never matters). */
const OUTCOME_TTL_MS = 120000;

/**
 * Flatten a `turn/end` reason into a small serializable shape.
 *
 * The app's own vocabulary (validated by its session format):
 *   completed | blocked | max-tokens | interrupted | aborted
 * An `aborted` reason carries a cause describing who withdrew the turn, which is
 * what separates "the user pressed Stop" from "the run failed".
 * @param reason - the event's `data.reason`.
 * @returns `{ kind, cause }`, both strings (cause may be empty).
 */
function describeTurnEnd(reason) {
  const kind = typeof reason?.kind === "string" ? reason.kind : "unknown";
  const cause = typeof reason?.reason?.kind === "string" ? reason.reason.kind : "";
  return { kind, cause };
}

/**
 * Fields the browser half may write. Every one is marked volatile: the settings
 * controller refuses a live write to a namespace whose schema has no volatile
 * node (`Plugin entry "…" has no volatile fields`), so the marker is what makes
 * the settings page actually persist.
 */
const COMPLETION_ALERT_FIELDS = {
  /** Master switch for the whole feature. */
  enabled: z.boolean().default(true),
  /** "all" = every session; "background" = only sessions not on screen. */
  alertScope: z.string().default("all"),
  /** Whether a round the user stopped by hand is announced (default: no). */
  alertOnStop: z.boolean().default(false),
  /** While the app is backgrounded, announce every round regardless of scope. */
  alertInBackground: z.boolean().default(true),
  /** How many times one alert repeats (1-4). */
  repeat: z.number().default(1),
  /** Whether the alert tone plays at all. */
  soundEnabled: z.boolean().default(true),
  /** Playback volume, 0..1. */
  volume: z.number().default(0.9),
  /** Built-in tone id ("bingbingbing", "crisp-a", "crisp-b") or "custom". */
  toneId: z.string().default("bingbingbing"),
  /** Uploaded tone as a WAV data URL ("" = none). */
  customData: z.string().default(""),
  /** Uploaded tone's file name, for the settings row. */
  customName: z.string().default(""),
  /**
   * The trim range the user saved inside the uploaded payload, as seconds, or
   * null. Stored so the re-trim dialog opens on the range actually in use.
   */
  customRange: z.union([z.object({ start: z.number(), end: z.number() }), z.const(null)]).default(null),
  /**
   * Tones the user added from their own files, newest last.
   *
   * Each entry carries its own payload, so it needs no import step and survives a
   * reload on its own; `customData`/`customName`/`customRange` above remain for
   * documents written before the library could hold more than one.
   */
  tones: z.array(z.object({
    id: z.string(),
    label: z.string(),
    data: z.string(),
    range: z.union([z.object({ start: z.number(), end: z.number() }), z.const(null)]).default(null)
  })).default([])
};

/**
 * Mark one schema node volatile in whichever way the installed schemastery
 * supports. Never throws: a core that cannot express the flag still gets a
 * working plugin, its settings page falling back to browser defaults.
 * @param schema - the schemastery schema to mark as live-editable.
 * @returns the same schema, or a volatile twin when `.volatile()` exists.
 */
function markVolatile(schema) {
  try {
    const marked = schema.volatile();
    if (marked !== undefined && marked !== null) return marked;
  } catch {
    // No such method, or a core that refuses this node: the meta flag is next.
  }
  try {
    if (schema !== null && schema !== undefined) {
      if (schema.meta === null || typeof schema.meta !== "object") schema.meta = {};
      schema.meta.volatile = true;
    }
  } catch {
    // A frozen schema: the browser half still carries its own defaults.
  }
  return schema;
}

/**
 * The live-editable preferences node.
 *
 * `markVolatile` must wrap the object AFTER `.default({})`, exactly as the
 * shipped web plugins do it. Marking first and defaulting second produced a
 * schema that parsed every input down to `{}` — schemastery's own default/parse
 * path does not survive a volatile clone as the inner schema — which silently
 * discarded whatever the settings document contained.
 */
const CompletionAlertSettings = markVolatile(z.object(COMPLETION_ALERT_FIELDS).default({}));

/**
 * The loader row's schema, and therefore also the namespace schema the settings
 * service validates against: the app's settings controller reads
 * `entry.fiber.runtime.Config` off this row, so a field missing here would be
 * rejected on write.
 */
const Config = z.object({
  /** Live-editable preferences owned by the browser half. */
  completionAlert: CompletionAlertSettings
});

/**
 * Serve the browser half's activation report.
 *
 *   GET  /api/completion-alert.diag   -> { report: <last report> }
 *   POST /api/completion-alert.diag   -> stores one report
 *
 * The report carries activation facts (which services and slots were found) and
 * whether the notice layer is in the DOM — no session content, no preferences,
 * no credentials.
 * @param ctx - host plugin context.
 */
function applyDiagnostics(ctx) {
  ctx.inject(["connection"], (scope) => {
    let last = null;
    scope.effect(() => scope.connection.fetch.register({
      path: DIAG_PATH,
      methods: ["GET", "POST"],
      requestBody: "buffered",
      fetch: async (request) => {
        if (request.method === "POST") {
          try {
            last = JSON.parse(await request.text());
          } catch {
            last = { error: "the report was not JSON" };
          }
          last.receivedAt = Date.now();
          return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
        }
        return Response.json({ report: last }, { headers: { "cache-control": "no-store" } });
      }
    }), "completion-alert: diagnostics route");
  });
}

/**
 * Record how each session's newest turn ended, and serve that back.
 *
 * The listener is registered on the plugin context (not inside a `connection`
 * scope) because it needs no service: `session/event` is emitted by the agent
 * runtime itself, and a composition without it simply never records anything,
 * leaving the browser half on its conservative fallback.
 * @param ctx - host plugin context.
 */
function applyTurnOutcomes(ctx) {
  /** sessionId -> { kind, cause, turn, at } */
  const outcomes = new Map();
  /** Keep the map from growing without bound in a long-lived host. */
  const MAX_SESSIONS = 200;


  try {
    ctx.on("session/event", (session, event) => {
      // Only the end of a turn carries an outcome; every other event would
      // overwrite a recorded one with a placeholder.
      if (event?.type !== "turn/end") return;
      const sessionId = session?.header?.id ?? session?.id;
      if (typeof sessionId !== "string" || sessionId === "") return;
      const { kind, cause } = describeTurnEnd(event.data?.reason);
      outcomes.set(sessionId, {
        kind,
        cause,
        turn: typeof event.data?.turn === "number" ? event.data.turn : null,
        at: Date.now()
      });
      if (outcomes.size > MAX_SESSIONS) {
        // Map preserves insertion order, so the oldest key is the first one.
        const oldest = outcomes.keys().next();
        if (!oldest.done) outcomes.delete(oldest.value);
      }
    });
  } catch (error) {
    ctx.logger?.warn?.(`completion-alert: session/event listener refused (${error?.message ?? error})`);
  }

  try {
    // Exposed for diagnosis only: the authenticated route below is the feature,
    // and this hook lets a test or a tool read the same map without a session.
    if (typeof globalThis === "object" && globalThis !== null) {
      globalThis.__dshCompletionAlertOutcomes = () => {
        const out = {};
        for (const [id, value] of outcomes) out[id] = { ...value };
        return out;
      };
    }
  } catch {
    // A frozen global is not worth failing over.
  }

  ctx.inject(["connection"], (scope) => {
    scope.effect(() => scope.connection.fetch.register({
      path: OUTCOME_PATH,
      methods: ["GET"],
      // Required by the registration contract: without it the runtime refuses
      // every request with a bare 400 before this handler is reached, which is
      // exactly how the browser's question was answered "unknown" for a round
      // the Host had recorded as completed.
      requestBody: "buffered",
      fetch: async (request) => {
        const url = new URL(request.url);
        const sessionId = url.searchParams.get("sessionId") ?? "";
        const record = outcomes.get(sessionId);
        const fresh = record !== undefined && Date.now() - record.at <= OUTCOME_TTL_MS;
        return Response.json({
          kind: fresh ? record.kind : null,
          cause: fresh ? record.cause : "",
          turn: fresh ? record.turn : null,
          at: fresh ? record.at : null
        }, { headers: { "cache-control": "no-store" } });
      }
    }), "completion-alert: turn outcome route");
  });
}

/**
 * Host plugin body: nothing to mount beyond the diagnostics route, because the
 * feature lives entirely in the browser half.
 * @param ctx - host plugin context.
 */
function apply(ctx) {
  // The settings namespace needs no host registration on current cores (the row
  // Config above is the schema), but older cores discover namespaces through
  // `settings.register`; call it when it exists and stay silent when it does not.
  ctx.inject(["settings"], (scope) => {
    try {
      if (typeof scope.settings?.register === "function") {
        scope.settings.register("completion-alert", Config, { applies: "live" });
      }
    } catch (error) {
      scope.logger?.warn?.(`completion-alert: settings.register refused (${error?.message ?? error})`);
    }
  });
  applyDiagnostics(ctx);
  applyTurnOutcomes(ctx);
  applySettingsStore(ctx);
}

const name = "completion-alert";
const inject = [];

const plugin = { apply, inject, name, Config };

export {
  COMPLETION_ALERT_FIELDS,
  CompletionAlertSettings,
  Config,
  DIAG_PATH,
  OUTCOME_PATH,
  SETTINGS_FILE,
  SETTINGS_PATH,
  apply,
  applyDiagnostics,
  applySettingsStore,
  applyTurnOutcomes,
  describeTurnEnd,
  inject,
  markVolatile,
  name,
  plugin,
  plugin as default
};
