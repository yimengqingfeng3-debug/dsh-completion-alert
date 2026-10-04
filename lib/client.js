// dsh-completion-alert — browser half.
//
// What it does, in one line: every time a DSH round of work finishes (a session
// goes busy -> idle), it plays the "bing bing bing" alert tone once and raises a
// system-style notice card in the bottom-right corner; clicking the card opens
// that session in the main view.
//
// Everything the browser half needs ships inside this bundle:
//   * the alert tone is an embedded base64 Ogg payload (lib/audio-data.js),
//     decoded once into an AudioBuffer — no host route, no on-disk asset;
//   * completion is read from the `uiSession.sessionStatus` store, the same
//     process-local projection the sidebar's status dots use, so the plugin
//     sees every session (main view, background, subagents) without polling;
//   * navigation uses `uiWorkspace.openSession(id)`, the same call the session
//     browser and the fork action use;
//   * preferences live in this plugin's own settings namespace through
//     `settingsScope.bind({ namespace: "completion-alert" })`, so every choice
//     survives a restart and reaches every open window.
//
// The bundle is hand-built in the ModuleLoader format the shipped dsh web
// plugins use; see dsh-cost-balance-indicator for the same shape.
window.__ModuleLoader__.load({
  id: "dsh-completion-alert",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    var __create = Object.create;
    var __defProp = Object.defineProperty;
    var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
    var __getOwnPropNames = Object.getOwnPropertyNames;
    var __getProtoOf = Object.getPrototypeOf;
    var __hasOwnProp = Object.prototype.hasOwnProperty;
    var __export = (target, all) => {
      for (var name in all)
        __defProp(target, name, { get: all[name], enumerable: true });
    };
    var __copyProps = (to, from, except, desc) => {
      if (from && typeof from === "object" || typeof from === "function") {
        for (let key of __getOwnPropNames(from))
          if (!__hasOwnProp.call(to, key) && key !== except)
            __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
      }
      return to;
    };
    var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
      isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
      mod
    ));
    var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

    //#region src/client.js
    var client_exports = {};
    __export(client_exports, {
      COMPLETION_ALERT_NS: () => COMPLETION_ALERT_NS,
      CUSTOM_TONE_ID: () => CUSTOM_TONE_ID,
      DEFAULT_SETTINGS: () => DEFAULT_SETTINGS,
      DEFAULT_TONE_ID: () => DEFAULT_TONE_ID,
      MAX_SOUND_DATA_URL: () => MAX_SOUND_DATA_URL,
      TOAST_HOLD_MS: () => TOAST_HOLD_MS,
      TONE_LIBRARY: () => TONE_LIBRARY,
      USER_TONE_PREFIX: () => USER_TONE_PREFIX,
      apply: () => apply,
      base64ToBytes: () => base64ToBytes,
      completionText: () => completionText,
      createAlert: () => createAlert,
      createCompletionWatcher: () => createCompletionWatcher,
      createToastStore: () => createToastStore,
      dataUrlToBytes: () => dataUrlToBytes,
      isUserToneId: () => isUserToneId,
      newUserToneId: () => newUserToneId,
      planAddedTone: () => planAddedTone,
      default: () => client_default,
      effectiveSource: () => effectiveSource,
      encodeWav: () => encodeWav,
      formatDuration: () => formatDuration,
      formatSeconds: () => formatSeconds,
      inject: () => inject,
      normalizeSettings: () => normalizeSettings,
      peaksOf: () => peaksOf,
      resolveMainSessionId: () => resolveMainSessionId,
      sanitizeSettings: () => sanitizeSettings,
      sessionLabel: () => sessionLabel,
      settingsSection: () => CompletionAlertSection,
      toastHost: () => ToastHost,
      toneById: () => toneById,
      toneOptions: () => toneOptions,
      trimRange: () => trimRange
    });
    module.exports = __toCommonJS(client_exports);

    // ---- dependencies -------------------------------------------------------
    // Every one of them is optional: a composition that does not offer a
    // service must cost this plugin its own surface, never the whole browser
    // half (and never a pending boot).
    var react = __toESM(require("react"), 1);
    var primitives = null;
    try {
      primitives = require("@deepseek-ai/dsh-client-ui-primitives");
    } catch {
      primitives = null;
    }

    // ---- the built-in tones -------------------------------------------------
    // Every payload is inlined in the marked block below by
    // tools/embed-tones.ps1, exactly like the shipped dsh web plugins inline
    // their generated data. The dsh client module loader resolves `require()`
    // only for platform seed words (react) and registered package factories, so
    // a relative specifier such as "./tones-data.js" fails the whole web boot:
    //   client-modules: require("./tones-data.js") missed the module table
    // That is an app-wide startup failure, not a degraded plugin.
    // Regenerate with:
    //   powershell -NoProfile -ExecutionPolicy Bypass -File tools/embed-tones.ps1
    //#region embedded-tones
    /** The tone registry (tools/tones.json), baked in at build time. */
    var TONE_DEFINITIONS = [
      {
        id: "bingbingbing",
        label: "冰冰冰",
        hint: "梗音效：三连音「冰·冰·冰」",
        source: "bingbingbing.ogg",
        kind: "recording"
      },
      {
        id: "crisp-a",
        label: "清脆提示",
        hint: "两音上行「叮—叮」，付款确认那种干脆感",
        source: "crisp-a.ogg",
        kind: "synth"
      },
      {
        id: "crisp-b",
        label: "清脆短音",
        hint: "三音上行马林巴「咚·哒·铃」，短信提示那种",
        source: "crisp-b.ogg",
        kind: "synth"
      },
      {
        id: "haqi",
        label: "哈气",
        hint: "猫哈气（本机录音）",
        source: "haqi.local.ogg",
        kind: "recording"
      },
      {
        id: "niulai",
        label: "牛来",
        hint: "牛来喊妈妈（本机录音）",
        source: "niulai.local.ogg",
        kind: "recording"
      },
      {
        id: "aiyo-1",
        label: "哎呀我去 1",
        hint: "本机录音 · 第 1 版",
        source: "aiyo-1.local.ogg",
        kind: "recording"
      },
      {
        id: "aiyo-2",
        label: "哎呀我去 2",
        hint: "本机录音 · 第 2 版",
        source: "aiyo-2.local.ogg",
        kind: "recording"
      },
      {
        id: "aiyo-3",
        label: "哎呀我去 3",
        hint: "本机录音 · 第 3 版",
        source: "aiyo-3.local.ogg",
        kind: "recording"
      },
    ];

    /** Tone id -> the asset file it was generated from (informational). */
    var TONE_SOURCES = {
      'bingbingbing': 'bingbingbing.ogg',
      'crisp-a': 'crisp-a.ogg',
      'crisp-b': 'crisp-b.ogg',
      'haqi': 'haqi.local.ogg',
      'niulai': 'niulai.local.ogg',
      'aiyo-1': 'aiyo-1.local.ogg',
      'aiyo-2': 'aiyo-2.local.ogg',
      'aiyo-3': 'aiyo-3.local.ogg',
    };

    /** Tone id -> base64 of its Ogg Vorbis payload. */
    var TONE_BASE64 = {
      'bingbingbing':
        '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' +
        'KeaQUsox5RxSSjmnnFPOOQgdhMoxBp2DECmlHFPOKccchMxB5ZyD0EEoAAAgwAEAIMBCKDRkRQAQJwDgcCTPkzRLFCVLE0XP' +
        'FGXXE03XlTTNNDVRVFXLE1XVVFXbFk1VtiVNE01N9FRVE0VVFVXTlk1VtW3PNGXZVFXdFlXVtmXbFn5XlnXfM01ZFlXV1k1V' +
        'tXXXln1f1m1dmDTNNDVRVFVNFFXVVFXbNlXXtjVRdFVRVWVZVFVZdmVZ91VX1n1LFFXVU03ZFVVVtlXZ9W1Vln3hdFVdV2XZ' +
        '91VZFn5b14Xh9n3hGFXV1k3X1XVVln1h1mVht3XfKGmaaWqiqKqaKKqqqaq2baqurVui6KqiqsqyZ6qurMqyr6uubOuaKKqu' +
        'qKqyLKqqLKuyrPuqLOu2qKq6rcqysJuuq+u27wvDLOu6cKqurquy7PuqLOu6revGceu6MHymKcumq+q6qbq6buu6ccy2bRyj' +
        'quq+KsvCsMqy7+u6L7R1IVFVdd2UXeNXZVn3bV93nlv3hbJtO7+t+8px67rS+DnPbxy5tm0cs24bv637xvMrP2E4jqVnmrZt' +
        'qqqtm6qr67JuK8Os60JRVX1dlWXfN11ZF27fN45b142iquq6Ksu+sMqyMdzGbxy7MBxd2zaOW9edsq0LfWPI9wnPa9vGcfs6' +
        '4/Z1o68MCcePAACAAQcAgAATykChISsCgDgBAAYh5xRTECrFIHQQUuogpFQxBiFzTkrFHJRQSmohlNQqxiBUjknInJMSSmgp' +
        'lNJSB6GlUEproZTWUmuxptRi7SCkFkppLZTSWmqpxtRajBFjEDLnpGTOSQmltBZKaS1zTkrnoKQOQkqlpBRLSi1WzEnJoKPS' +
        'QUippBJTSam1UEprpaQWS0oxthRbbjHWHEppLaQSW0kpxhRTbS3GmiPGIGTOScmckxJKaS2U0lrlmJQOQkqZg5JKSq2VklLM' +
        'nJPSQUipg45KSSm2kkpMoZTWSkqxhVJabDHWnFJsNZTSWkkpxpJKbC3GWltMtXUQWgultBZKaa21VmtqrcZQSmslpRhLSrG1' +
        'FmtuMeYaSmmtpBJbSanFFluOLcaaU2s1ptZqbjHmGlttPdaac0qt1tRSjS3GmmNtvdWae+8gpBZKaS2U0mJqLcbWYq2hlNZK' +
        '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',
      'crisp-a':
        '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' +
        'KeaQUsox5RxSSjmnnFPOOQgdhMoxBp2DECmlHFPOKccchMxB5ZyD0EEoAAAgwAEAIMBCKDRkRQAQJwDgcCTPkzRLFCVLE0XP' +
        'FGXXE03XlTTNNDVRVFXLE1XVVFXbFk1VtiVNE01N9FRVE0VVFVXTlk1VtW3PNGXZVFXdFlXVtmXbFn5XlnXfM01ZFlXV1k1V' +
        'tXXXln1f1m1dmDTNNDVRVFVNFFXVVFXbNlXXtjVRdFVRVWVZVFVZdmVZ91VX1n1LFFXVU03ZFVVVtlXZ9W1Vln3hdFVdV2XZ' +
        '91VZFn5b14Xh9n3hGFXV1k3X1XVVln1h1mVht3XfKGmaaWqiqKqaKKqqqaq2baqurVui6KqiqsqyZ6qurMqyr6uubOuaKKqu' +
        'qKqyLKqqLKuyrPuqLOu2qKq6rcqysJuuq+u27wvDLOu6cKqurquy7PuqLOu6revGceu6MHymKcumq+q6qbq6buu6ccy2bRyj' +
        'quq+KsvCsMqy7+u6L7R1IVFVdd2UXeNXZVn3bV93nlv3hbJtO7+t+8px67rS+DnPbxy5tm0cs24bv637xvMrP2E4jqVnmrZt' +
        'qqqtm6qr67JuK8Os60JRVX1dlWXfN11ZF27fN45b142iquq6Ksu+sMqyMdzGbxy7MBxd2zaOW9edsq0LfWPI9wnPa9vGcfs6' +
        '4/Z1o68MCcePAACAAQcAgAATykChISsCgDgBAAYh5xRTECrFIHQQUuogpFQxBiFzTkrFHJRQSmohlNQqxiBUjknInJMSSmgp' +
        'lNJSB6GlUEproZTWUmuxptRi7SCkFkppLZTSWmqpxtRajBFjEDLnpGTOSQmltBZKaS1zTkrnoKQOQkqlpBRLSi1WzEnJoKPS' +
        'QUippBJTSam1UEprpaQWS0oxthRbbjHWHEppLaQSW0kpxhRTbS3GmiPGIGTOScmckxJKaS2U0lrlmJQOQkqZg5JKSq2VklLM' +
        'nJPSQUipg45KSSm2kkpMoZTWSkqxhVJabDHWnFJsNZTSWkkpxpJKbC3GWltMtXUQWgultBZKaa21VmtqrcZQSmslpRhLSrG1' +
        'FmtuMeYaSmmtpBJbSanFFluOLcaaU2s1ptZqbjHmGlttPdaac0qt1tRSjS3GmmNtvdWae+8gpBZKaS2U0mJqLcbWYq2hlNZK' +
        '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',
      'crisp-b':
        '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' +
        'KeaQUsox5RxSSjmnnFPOOQgdhMoxBp2DECmlHFPOKccchMxB5ZyD0EEoAAAgwAEAIMBCKDRkRQAQJwDgcCTPkzRLFCVLE0XP' +
        'FGXXE03XlTTNNDVRVFXLE1XVVFXbFk1VtiVNE01N9FRVE0VVFVXTlk1VtW3PNGXZVFXdFlXVtmXbFn5XlnXfM01ZFlXV1k1V' +
        'tXXXln1f1m1dmDTNNDVRVFVNFFXVVFXbNlXXtjVRdFVRVWVZVFVZdmVZ91VX1n1LFFXVU03ZFVVVtlXZ9W1Vln3hdFVdV2XZ' +
        '91VZFn5b14Xh9n3hGFXV1k3X1XVVln1h1mVht3XfKGmaaWqiqKqaKKqqqaq2baqurVui6KqiqsqyZ6qurMqyr6uubOuaKKqu' +
        'qKqyLKqqLKuyrPuqLOu2qKq6rcqysJuuq+u27wvDLOu6cKqurquy7PuqLOu6revGceu6MHymKcumq+q6qbq6buu6ccy2bRyj' +
        'quq+KsvCsMqy7+u6L7R1IVFVdd2UXeNXZVn3bV93nlv3hbJtO7+t+8px67rS+DnPbxy5tm0cs24bv637xvMrP2E4jqVnmrZt' +
        'qqqtm6qr67JuK8Os60JRVX1dlWXfN11ZF27fN45b142iquq6Ksu+sMqyMdzGbxy7MBxd2zaOW9edsq0LfWPI9wnPa9vGcfs6' +
        '4/Z1o68MCcePAACAAQcAgAATykChISsCgDgBAAYh5xRTECrFIHQQUuogpFQxBiFzTkrFHJRQSmohlNQqxiBUjknInJMSSmgp' +
        'lNJSB6GlUEproZTWUmuxptRi7SCkFkppLZTSWmqpxtRajBFjEDLnpGTOSQmltBZKaS1zTkrnoKQOQkqlpBRLSi1WzEnJoKPS' +
        'QUippBJTSam1UEprpaQWS0oxthRbbjHWHEppLaQSW0kpxhRTbS3GmiPGIGTOScmckxJKaS2U0lrlmJQOQkqZg5JKSq2VklLM' +
        'nJPSQUipg45KSSm2kkpMoZTWSkqxhVJabDHWnFJsNZTSWkkpxpJKbC3GWltMtXUQWgultBZKaa21VmtqrcZQSmslpRhLSrG1' +
        'FmtuMeYaSmmtpBJbSanFFluOLcaaU2s1ptZqbjHmGlttPdaac0qt1tRSjS3GmmNtvdWae+8gpBZKaS2U0mJqLcbWYq2hlNZK' +
        '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' +
        'gf2RAA4ODg4ODg4O',
      'haqi':
        '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' +
        'KeaQUsox5RxSSjmnnFPOOQgdhMoxBp2DECmlHFPOKccchMxB5ZyD0EEoAAAgwAEAIMBCKDRkRQAQJwDgcCTPkzRLFCVLE0XP' +
        'FGXXE03XlTTNNDVRVFXLE1XVVFXbFk1VtiVNE01N9FRVE0VVFVXTlk1VtW3PNGXZVFXdFlXVtmXbFn5XlnXfM01ZFlXV1k1V' +
        'tXXXln1f1m1dmDTNNDVRVFVNFFXVVFXbNlXXtjVRdFVRVWVZVFVZdmVZ91VX1n1LFFXVU03ZFVVVtlXZ9W1Vln3hdFVdV2XZ' +
        '91VZFn5b14Xh9n3hGFXV1k3X1XVVln1h1mVht3XfKGmaaWqiqKqaKKqqqaq2baqurVui6KqiqsqyZ6qurMqyr6uubOuaKKqu' +
        'qKqyLKqqLKuyrPuqLOu2qKq6rcqysJuuq+u27wvDLOu6cKqurquy7PuqLOu6revGceu6MHymKcumq+q6qbq6buu6ccy2bRyj' +
        'quq+KsvCsMqy7+u6L7R1IVFVdd2UXeNXZVn3bV93nlv3hbJtO7+t+8px67rS+DnPbxy5tm0cs24bv637xvMrP2E4jqVnmrZt' +
        'qqqtm6qr67JuK8Os60JRVX1dlWXfN11ZF27fN45b142iquq6Ksu+sMqyMdzGbxy7MBxd2zaOW9edsq0LfWPI9wnPa9vGcfs6' +
        '4/Z1o68MCcePAACAAQcAgAATykChISsCgDgBAAYh5xRTECrFIHQQUuogpFQxBiFzTkrFHJRQSmohlNQqxiBUjknInJMSSmgp' +
        'lNJSB6GlUEproZTWUmuxptRi7SCkFkppLZTSWmqpxtRajBFjEDLnpGTOSQmltBZKaS1zTkrnoKQOQkqlpBRLSi1WzEnJoKPS' +
        'QUippBJTSam1UEprpaQWS0oxthRbbjHWHEppLaQSW0kpxhRTbS3GmiPGIGTOScmckxJKaS2U0lrlmJQOQkqZg5JKSq2VklLM' +
        'nJPSQUipg45KSSm2kkpMoZTWSkqxhVJabDHWnFJsNZTSWkkpxpJKbC3GWltMtXUQWgultBZKaa21VmtqrcZQSmslpRhLSrG1' +
        'FmtuMeYaSmmtpBJbSanFFluOLcaaU2s1ptZqbjHmGlttPdaac0qt1tRSjS3GmmNtvdWae+8gpBZKaS2U0mJqLcbWYq2hlNZK' +
        'KrGVklpsMebaWow5lNJiSanFklKMLcaaW2y5ppZqbDHmmlKLtebac2w19tRarC3GmlNLtdZac4+59VYAAMCAAwBAgAlloNCQ' +
        'lQBAFAAAQYhSzklpEHLMOSoJQsw5J6lyTEIpKVXMQQgltc45KSnF1jkIJaUWSyotxVZrKSm1FmstAACgwAEAIMAGTYnFAQoN' +
        'WQkARAEAIMYgxBiEBhmlGIPQGKQUYxAipRhzTkqlFGPOSckYcw5CKhljzkEoKYRQSiophRBKSSWlAgAAChwAAAJs0JRYHKDQ' +
        'kBUBQBQAAGAMYgwxhiB0VDIqEYRMSiepgRBaC6111lJrpcXMWmqttNhACK2F1jJLJcbUWmatxJhaKwAA7MABAOzAQig0ZCUA' +
        'kAcAQBijFGPOOWcQYsw56Bw0CDHmHIQOKsacgw5CCBVjzkEIIYTMOQghhBBC5hyEEEIIoYMQQgillNJBCCGEUkrpIIQQQiml' +
        'dBBCCKGUUgoAACpwAAAIsFFkc4KRoEJDVgIAeQAAgDFKOQehlEYpxiCUklKjFGMQSkmpcgxCKSnFVjkHoZSUWuwglNJabDV2' +
        'EEppLcZaQ0qtxVhrriGl1mKsNdfUWoy15pprSi3GWmvNuQAA3AUHALADG0U2JxgJKjRkJQCQBwCAIKQUY4wxhhRiijHnnEMI' +
        'KcWYc84pphhzzjnnlGKMOeecc4wx55xzzjnGmHPOOeccc84555xzjjnnnHPOOeecc84555xzzjnnnHPOCQAAKnAAAAiwUWRz' +
        'gpGgQkNWAgCpAAAAEVZijDHGGBsIMcYYY4wxRhJijDHGGGNsMcYYY4wxxphijDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wx' +
        'xhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYW2uttdZaa6211lprrbXWWmutAEC/CgcA/wcbVkc4KRoLLDRkJQAQDgAAGMOY' +
        'c445Bh2EhinopIQOQgihQ0o5KCWEUEopKXNOSkqlpJRaSplzUlIqJaWWUuogpNRaSi211loHJaXWUmqttdY6CKW01FprrbXY' +
        'QUgppdZaiy3GUEpKrbXYYow1hlJSaq3F2GKsMaTSUmwtxhhjrKGU1lprMcYYay0ptdZijLXGWmtJqbXWYos11loLAOBucACA' +
        'SLBxhpWks8LR4EJDVgIAIQEABEKMOeeccxBCCCFSijHnoIMQQgghREox5hx0EEIIIYSMMeeggxBCCCGEkDHmHHQQQgghhBA6' +
        '5xyEEEIIoYRSSuccdBBCCCGUUELpIIQQQgihhFJKKR2EEEIooYRSSiklhBBCCaWUUkoppYQQQgihhBJKKaWUEEIIpZRSSiml' +
        'lBJCCCGUUkoppZRSQgihlFBKKaWUUkoIIYRSSimllFJKCSGEUEoppZRSSikhhBJKKaWUUkoppQAAgAMHAIAAI+gko8oibDTh' +
        'wgNQaMhKAIAMAABx2GrrKdbIIMWchJZLhJByEGIuEVKKOUexZUgZxRjVlDGlFFNSa+icYoxRT51jSjHDrJRWSiiRgtJyrLV2' +
        'zAEAACAIADAQITOBQAEUGMgAgAOEBCkAoLDA0DFcBATkEjIKDArHhHPSaQMAEITIDJGIWAwSE6qBomI6AFhcYMgHgAyNjbSL' +
        'C+gywAVd3HUghCAEIYjFARSQgIMTbnjiDU+4wQk6RaUOAgAAAADgAAAeAACSDSAiIpo5jg6PD5AQkRGSEpMTlAAAAAAAsAGA' +
        'DwCAJAWIiIhmjqPD4wMkRGSEpMTkBCUAAAAAAAAAAAAICAgAAAAAAAQAAAAICE9nZ1MABMFOAAAAAAAAyOZyLAIAAAD3Z6wU' +
        'GjAyMt7o29/m9fPo59vN0s3g6vHmxcomLioq1DVF9GcGSDntkdyTcZp+BmCDE6Dq3dLaOpXPX08mAO769bTYRv7//+v3H87P' +
        'DqYJPEYLgt3QyN2aTDFbtf+dBlqgE5wAc28DHYbOyqlwgIcgTpXOpfLOrPtWO4AuUHvxNw1kYj3MU5GG7U7NhuSOcfx1AGIQ' +
        'nBqw+7GSYbLgWUcM+ZFn+vZbAKig6C7bCae/DWvwCZpIHUa4fuV/aJbuQ+Vg70nkBwEAgCVA7wB4sASYI0ERDwTLysJ3AABQ' +
        'v886EXMil8sXlsv1dVyWAzODDdRwY8zgHKdsAR/VDoDJ/jpGoO4dSanM25q3VgAgsqupPmT32Oq7d84zT/n2XuqirPMatbgx' +
        'n780ZfN8/rPpjdOWl8+e2Fhebk4LAOBuhMF33ibsdVu5rd881XHvDjR9a28B59RNGzmqd77mEAqBrsWSTTAAszfOHl1Fq4Fa' +
        'XQJvWGWB24Z5Bb9ZtDM8wIMpZVNmLwcb8ffKvaSbKwyqn6qcBR47FSWWV+OIoOs/Hb/cbNcXOYMBKzpw6JCAJcABsBlMNyZY' +
        'AgQdDaABAKCM51f3M1KObU2TmDa3f3V9YLZ8ff+StAu5C4uwnJfhUt9tEJ5Uxl4iWSyxuobYhJxpzYK+n15hJXRcM+YDAJOZ' +
        'fQuAJw9Of9vmxqPqW0wg+nLhAeNWDmdlVLV44p9v1dUk4V5itIzE4P4uWmdnd2N6yiu2v3+mtu/8H48bAgAQYEpJnebNulkZ' +
        'A3m1CNWmDCYhfv3jtIb1JgYA86d8CgAAgCvi9UiplgXd6YwAAMpTaLDjgTM5NTO9KtJuRD2eOc0AkzH/D6LspWykSnsfQR+f' +
        'lHogWBLQmwEMdDDjwAbQBgPcBKxYAwBAKN8udfo248T6WkOXmTqSYuRt3F7NfRKyK7PMgFt0AI8xhraKYS8ual1m27dYtjF6' +
        'Von42w9Dc4JbPFpWceaPzd4tD6ZldCN2XICgy9CbNXn224/5poNj1HnRVatLYz2/nbNcy8sCAByVj+bWGjwmqwXGttwSuTgn' +
        'QHAdTC1n5eSYQwAPvgXATp4D/AJI8a0TJ9SamhcZAAD4UHot1Wgd7F5u72mmBOeJUQxg/AVG8i6+auWYziD/A2rpsL1TbO+V' +
        '6KNPAbZt0oDxsKxBKXQGgEMjUcCiBNAG9aOf40gAAABs95VZmt07mm5em3pmpvZvPRD+7I1Zy6E9hTXuHqbHv1esGwDA2+c6' +
        'NCcHfn92ggvvy1VucWs6fTH+mn50CvDUxJeHlTFxCAB4OjoXhNEUv/tr5r4sk1t6KGWSjBj+/lA7/mABAACALKXkiRo0WWC0' +
        '3SFZkgISGEdF2QTsfhM0zXdrsi3HCJgA7Px4O28wJ66pc4cNHnOfIVSXQtHGHFP0dYuH7yaUH1cv242/KwAAXnq1QQryD6gX' +
        'dk5p75Xo4+kINuHgJ+h6B2qw9YYY1A6ABjYKOACA3g4gjXcAAAAACUfcKXTmjZ8kV9RsBQ+18eCdF7c+fpnZBZbwbHpaATh9' +
        'BAB2c2ynn34PN16bG9cfC9x4TPmk4DMASxR/2wAIGzx/NZmUfOaPlKlkm5c+BeA4APXRuZ/eM3dr47P6tJJYAcRdTMi6d69M' +
        'pZIDJ+OTxy8vAQAAkFEcqdQKPUgn6UYt5SVCC9Np7t9nJH9mfGhgnREiL9AJ3d6nm5VQT8B3lNG7GWAxkCzNzN93zz2YeHCq' +
        '/iNMi4feemVMZxg+Cmnpncrtjjvs/Uny2GkvAZ0ADgDgZugA+MHqrW4KlgBHAxgAS9DpHeA2fGgAACBXS/7hzSgqtmF4JJji' +
        'mJ5OD6ekp96rH2lsBJ9YPtpTciwhwCiwXpuEv5tO021nAjC8dj3MapU0Mw/mdWrUjrPW8qRby/O94+b//1Ke9IGBxNEop0QE' +
        'r+y4wWuj4VMC4YAle9hIZgwHs1gAYB33jhtZAGgqgiKIG0flfJFKPNnpeD5KpLLmKu2gt39tVpIEAOCUuAFchyMAyDNQOrLD' +
        'tf2N35G7i22kozZfNTu1I7Kj4AzwQNEdPBujjDOn371aAx5aDYALfOCvdfbtJw+7fxCfULHJzoCmd2SIhCObBuB2UAWzIWx0' +
        'EXBwFwBmODiADpjugMnfGgAAAMTtk54dUyPu1EvmGKslu50vnu3tjM3HDpagthI86LTOMQQFIDI88uSC9a77HXNKgbMDbb2y' +
        'BZY0d5NHHj3dqgCvAABY3yxGD7sV/bV3EAAAAD5caBfyDqUAfFRkGX2vqRrzAnUtOfCtOLWhQMQdYDdz79MNz4+ncUkmZOMy' +
        'HvqEjosHAPz035hdrJ+LGUI8AACAC0c5N/Y3yXFyvZxD9OZtLwCmgYJd7HYvhQE36aqNjDUh8e7z+li9Af5q5RxNZv8b+Bud' +
        'UZGX7N0lOVtX9ZTaNeiWbk7IAkQX9IIDEzTYDuAPAAdUahMAAHDdfuGVZdp+Kv2B8fzqf6/3m89/jd/v9q1PFWQZQu717P4r' +
        'ahlzml0iAD6vTyIazftLjKUQ6R1qQ9/W63i6oSlQ+l7YdcLRHeHPzLG9cT8M9wkwwRMJH7tUEuZJWDNMhka/C7H7VN7tu+cf' +
        '7Jat9tdNKwBAqwOC3xwR4OheOIr51c9RAhQB3PDSMhu3mE9MFVQ6aI//wZpQgb33cnJ2BAWiTXBUPSUlmftJwyaCFa7VDRTn' +
        'ywmCcwDeSsUSZBz+UbIYVgezcoft3QOeXv2/nEJAd0zABDMOHGAC5uIAPWkAB96rLgUAgGV9//Jr30/e3/1w+czm2WrO0Ofq' +
        '3ur4ejJJGn3RFXD+d87d1b2kqiICxJhGlxt2M4nzmQAYB35MT22qPVLD/FaCCct9XPkaf/sqAG0ugAK5TH318/XMNLlpo5MX' +
        'ggRDohEDS8aYGscthwPjj15VQDjw4Kb+Ljf1csDuwnQAAND9OYtIlR4oxCQ7fPuU9tEM5IN1EQJg0d943gzQArnY8CJuAp6X' +
        'wRMV5z7ZaQkd6ZAa2o6MeNgxvAGealWgC+YD8krWYNcXedY0QXZCKoe0Mkg4nAnAAYBGr3cAGgAAwG306rRwQtNbk5+FeO6K' +
        'bth9+r64Przx2tQOBQiPxsF3ic3kYCRED0OV7B9hsZPtsuuEEH51CAF4vBy7Wu1u8u1Pmbp/Z5xe5wMQCu5ZAXJOyuDfSU8m' +
        'w730Pkk5f/i98WhjvwkA4PtdfPTdDu7Dy+wp2iGKLIKM0T2H33/YVUQymwv4AwZeND7kOnbZgvL+KQAAALr/DZ9R5Mnv641E' +
        '62hfEtBx4xdLMg3LTZXJrDZAQ5CvqgReOlUwyCj/G9Bd5I/27gjPOrksBBiXHDh46ECNbR0E5MYCAADzx7flZmDeLuX13KPZ' +
        '3+ceWNtcHBTGeV9tahKMTk3BD8OriFF7gSqVRuqjORcAt6bVx1v7ITtzUGSMMcRcYpfUucPKbGNl/rxgc9X+1g8TAECdQ3AS' +
        'TNDMTmsiLIQZ6IB7MEBdPB9ZYYyvgnqpE4k3vL2WEnU4octpTpJCh2tTcNAXgJTwQOB7N9psBzAYEti+57sG495ZnolgPQsL' +
        'Egd4C66QEKhwxRcAXkoFQMmQ/0PnEVeHLqa2O86PHUpYUkhAeNKbrhLo+Qc8mxMAAKz6ZtM3/fNk3Qsqdcjd5IPTTO3eEqtu' +
        'h8qi5CzdmvjVTnmeVFESPZfbuSRd7PrnW/N//984pc6xrxwAwC3/ij8YhiWC/e9H4th0MkDWNDBkvxYBYwuwXQH4/qjVBNfV' +
        'foXRAIT3/lO/AeANe6SiYObGR2amAfG/GsomhSuBo4ncGNZd5mf+MXO96noq/TsLgElgBBmp1Bdec0jXOcGpbe95zch+eFeS' +
        'z2szLfUaPjtNIuybzX/DZYkPJ89tF4VjIZ4GcACVBKbhXvSDDkDWAQDAw5evfn5grSHf8u7j9lsyb6a9/OBq7+ISz9a4D1VD' +
        'zB/vPqwAVG3P989sYbyAR5CzlmWT17wn98KFPNuDP62pniY89HJ7WgUAAMisn91OQNV2enJCt2e5bcqhH6tsahaWSDac39hi' +
        '7hQEPXhksSDHpYDBx/9EY9wu2Q2ubdf7mN8PzyxBar4a5nxGdp8i5/0G7vd0JUMLFXeHLYSGyX/82mCpySdX6kYnTd5aFdQu' +
        'BvM/yDq9B/znV4kP2B4R5Gw1bavfiFlwFACwBNh1ABtzDK8Ac8Betl8zOgAAaL1295ZxcJ13bHxZb3+/TqzSbt8sMeMfPwRe' +
        'G1a/yr9zAeC09x1nb8s2gRVhieIR4DTevvKtmIkqWm7QOg0AADpjpQeHTdeX+60GYmeCZg4A8GmNnG09em9LlvP/7h48sMkV' +
        'ALANhqgSx/1p7RGoMhTH6q/lHl1WJIeeR+ivlrdAl62TW0bA9p7GyadxVk+PXrhlLqaD9laMCwExKgy7BjDJP6vtiz+x/vPz' +
        '6VdrXmst2B4p/WHxOovfRj0UTIjO9tNZxwQmGcDtNDCYjiLrHA6Y2cA2t9hQhQMAaA5gaxcAAKgnX226mcv49NVXniYyt75m' +
        'Hy49FIZd9vRiCrSwEsXjFKtwMlbr8Ylu/1wAAJxO6S1kTkaqZHojFhi9MAAAgHeTB79KyK3f2+9tGv6XsdWqH7oRC8ERoAnc' +
        'OptrGlc24ljHw3qyp9Vc0alybynJ2P67SZ2/uL/NqH8/CABAhJb6jgAYsJ2B6gr5+Oxx5E3gzct0vda8hqYSADK6Qzv/TOQB' +
        'OB8iOHtiIBrR1VSBIXJxZYGZ9fMaPoudhZLx6ofFYyzOPLtJ7H0Q3i9vuGW4xwHowAGAd3cJlqfFLcNwiCYBzDA1eukB2tcA' +
        'AEB/y8bpIzdb3v0/s2x58uPiVnNWHDfkz/Td1DfcxRqnVw3YsD40bwJ47vWsZbQKdrsk2hykhs/e7YywAZV9OQUwD/Q77ehr' +
        'vy+fbUkoAAAPXco3mTn8RRrr29QlAAB4YHL4ZpfKs4e2XRh2AH/Q3gLJlYsD7UbGDP7c2Cn0IOFwiUfH24UDOetqL3+e+coz' +
        'GwCAJXhFh18+SmcRgGgAQAXyL4Llf2odB56jK28wC2d2CYCpoVozGdR1TgDCBL46rZArL679IXuMy3koa7T3QuSMyr4jAUuA' +
        '6ZngEh1LgCXAABB0wI4DAABL3Hv7OaYfOR+UL+ZdXm+umf9eSVk0L3vhokogL53yDt0wUmb8/IMhFe2K6oSwROHRUF9u2+/d' +
        'Pw2ywigAY+5C7eUZjLE/+SCcvcsvd3LRAIDt+U6XWIVQExVlJUdLNJGL0CYkj45xeua/f5MXWgMAAIDPGJj06mcNzTTSco2L' +
        'SjEpW8O2C5081ZUQSGI8HUaw9fe+lJzPPo6hkHOjP4ptYsD+1wAAPsPC38MLzBjdDn9YBp9pVs0XBso1XittWkZuPyx6wTle' +
        'I7D3IXoGLGBSUgGTsORxEg7KCgDwdvDBfzJyzdg2SNKzl7b75T/Gt84ORp/k5hMbuVhvhQ4xdc53XOQC3/qdbumGPrmznax1' +
        'K45adW5lG8zWQt0HGKA8SWCz/taUmDvAz5dA/k0AMJ1nTg36qqS9zl146/DRmFNjNSMvrHpqAABq/3I0AADXPxRSaADRVzce' +
        '4MpLrraLs/xhjKR222fTPgOQsyn39Rrxze0x4vixcO49YnUAcJTzFQAWSgWmFJvNExDctjWjvTuR133+8jIyx1D3rh0gQDqp' +
        'mhwgQCMYoJ+dBADAXmCyNb8f9dR59fD5uSDn/9dVv5x77utFnpiSWlA5CAA6jINa5brezEqetA5Y8wanSqjOOofL36Ntld/s' +
        'cnR49OzdFzoqAGhjh9coq0YKelTgGIpIwS1oiGbTNAP2Q4+uwwOf99Mlrz2Zsn5mhM6PfLheszL1Y24CAFoH9Mu4rZxKHIOG' +
        'Icuatgwfp6F4G4DWBD+xKEgBQIeaSPeSGg0AbHZ1SsFP6RuhmC3s/nMDltDz1V6glqYa4hzOfJSuS+tMxRr4VQMsVkVsX9JS' +
        'fneKFQ+jfR8jBsEJ8Ak7u+k4xpX6taiaMQgAWMH4CX9CuzbrAvIZBDp1yYh9MGUKhKz9fwkgFRCfHjcxoTm9nWgOfSd7GNmF' +
        'ZzTxlDmVJzUA5DQLq+e0xRpKgQaL7FuFJRgP/5cvLpvkFtLczuZ0/d+tXor7X8k1GV8X',
      'niulai':
        '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' +
        'KeaQUsox5RxSSjmnnFPOOQgdhMoxBp2DECmlHFPOKccchMxB5ZyD0EEoAAAgwAEAIMBCKDRkRQAQJwDgcCTPkzRLFCVLE0XP' +
        'FGXXE03XlTTNNDVRVFXLE1XVVFXbFk1VtiVNE01N9FRVE0VVFVXTlk1VtW3PNGXZVFXdFlXVtmXbFn5XlnXfM01ZFlXV1k1V' +
        'tXXXln1f1m1dmDTNNDVRVFVNFFXVVFXbNlXXtjVRdFVRVWVZVFVZdmVZ91VX1n1LFFXVU03ZFVVVtlXZ9W1Vln3hdFVdV2XZ' +
        '91VZFn5b14Xh9n3hGFXV1k3X1XVVln1h1mVht3XfKGmaaWqiqKqaKKqqqaq2baqurVui6KqiqsqyZ6qurMqyr6uubOuaKKqu' +
        'qKqyLKqqLKuyrPuqLOu2qKq6rcqysJuuq+u27wvDLOu6cKqurquy7PuqLOu6revGceu6MHymKcumq+q6qbq6buu6ccy2bRyj' +
        'quq+KsvCsMqy7+u6L7R1IVFVdd2UXeNXZVn3bV93nlv3hbJtO7+t+8px67rS+DnPbxy5tm0cs24bv637xvMrP2E4jqVnmrZt' +
        'qqqtm6qr67JuK8Os60JRVX1dlWXfN11ZF27fN45b142iquq6Ksu+sMqyMdzGbxy7MBxd2zaOW9edsq0LfWPI9wnPa9vGcfs6' +
        '4/Z1o68MCcePAACAAQcAgAATykChISsCgDgBAAYh5xRTECrFIHQQUuogpFQxBiFzTkrFHJRQSmohlNQqxiBUjknInJMSSmgp' +
        'lNJSB6GlUEproZTWUmuxptRi7SCkFkppLZTSWmqpxtRajBFjEDLnpGTOSQmltBZKaS1zTkrnoKQOQkqlpBRLSi1WzEnJoKPS' +
        'QUippBJTSam1UEprpaQWS0oxthRbbjHWHEppLaQSW0kpxhRTbS3GmiPGIGTOScmckxJKaS2U0lrlmJQOQkqZg5JKSq2VklLM' +
        'nJPSQUipg45KSSm2kkpMoZTWSkqxhVJabDHWnFJsNZTSWkkpxpJKbC3GWltMtXUQWgultBZKaa21VmtqrcZQSmslpRhLSrG1' +
        'FmtuMeYaSmmtpBJbSanFFluOLcaaU2s1ptZqbjHmGlttPdaac0qt1tRSjS3GmmNtvdWae+8gpBZKaS2U0mJqLcbWYq2hlNZK' +
        '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' +
        'AA==',
      'aiyo-1':
        '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' +
        'KeaQUsox5RxSSjmnnFPOOQgdhMoxBp2DECmlHFPOKccchMxB5ZyD0EEoAAAgwAEAIMBCKDRkRQAQJwDgcCTPkzRLFCVLE0XP' +
        'FGXXE03XlTTNNDVRVFXLE1XVVFXbFk1VtiVNE01N9FRVE0VVFVXTlk1VtW3PNGXZVFXdFlXVtmXbFn5XlnXfM01ZFlXV1k1V' +
        'tXXXln1f1m1dmDTNNDVRVFVNFFXVVFXbNlXXtjVRdFVRVWVZVFVZdmVZ91VX1n1LFFXVU03ZFVVVtlXZ9W1Vln3hdFVdV2XZ' +
        '91VZFn5b14Xh9n3hGFXV1k3X1XVVln1h1mVht3XfKGmaaWqiqKqaKKqqqaq2baqurVui6KqiqsqyZ6qurMqyr6uubOuaKKqu' +
        'qKqyLKqqLKuyrPuqLOu2qKq6rcqysJuuq+u27wvDLOu6cKqurquy7PuqLOu6revGceu6MHymKcumq+q6qbq6buu6ccy2bRyj' +
        'quq+KsvCsMqy7+u6L7R1IVFVdd2UXeNXZVn3bV93nlv3hbJtO7+t+8px67rS+DnPbxy5tm0cs24bv637xvMrP2E4jqVnmrZt' +
        'qqqtm6qr67JuK8Os60JRVX1dlWXfN11ZF27fN45b142iquq6Ksu+sMqyMdzGbxy7MBxd2zaOW9edsq0LfWPI9wnPa9vGcfs6' +
        '4/Z1o68MCcePAACAAQcAgAATykChISsCgDgBAAYh5xRTECrFIHQQUuogpFQxBiFzTkrFHJRQSmohlNQqxiBUjknInJMSSmgp' +
        'lNJSB6GlUEproZTWUmuxptRi7SCkFkppLZTSWmqpxtRajBFjEDLnpGTOSQmltBZKaS1zTkrnoKQOQkqlpBRLSi1WzEnJoKPS' +
        'QUippBJTSam1UEprpaQWS0oxthRbbjHWHEppLaQSW0kpxhRTbS3GmiPGIGTOScmckxJKaS2U0lrlmJQOQkqZg5JKSq2VklLM' +
        'nJPSQUipg45KSSm2kkpMoZTWSkqxhVJabDHWnFJsNZTSWkkpxpJKbC3GWltMtXUQWgultBZKaa21VmtqrcZQSmslpRhLSrG1' +
        'FmtuMeYaSmmtpBJbSanFFluOLcaaU2s1ptZqbjHmGlttPdaac0qt1tRSjS3GmmNtvdWae+8gpBZKaS2U0mJqLcbWYq2hlNZK' +
        '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',
      'aiyo-2':
        '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' +
        'KeaQUsox5RxSSjmnnFPOOQgdhMoxBp2DECmlHFPOKccchMxB5ZyD0EEoAAAgwAEAIMBCKDRkRQAQJwDgcCTPkzRLFCVLE0XP' +
        'FGXXE03XlTTNNDVRVFXLE1XVVFXbFk1VtiVNE01N9FRVE0VVFVXTlk1VtW3PNGXZVFXdFlXVtmXbFn5XlnXfM01ZFlXV1k1V' +
        'tXXXln1f1m1dmDTNNDVRVFVNFFXVVFXbNlXXtjVRdFVRVWVZVFVZdmVZ91VX1n1LFFXVU03ZFVVVtlXZ9W1Vln3hdFVdV2XZ' +
        '91VZFn5b14Xh9n3hGFXV1k3X1XVVln1h1mVht3XfKGmaaWqiqKqaKKqqqaq2baqurVui6KqiqsqyZ6qurMqyr6uubOuaKKqu' +
        'qKqyLKqqLKuyrPuqLOu2qKq6rcqysJuuq+u27wvDLOu6cKqurquy7PuqLOu6revGceu6MHymKcumq+q6qbq6buu6ccy2bRyj' +
        'quq+KsvCsMqy7+u6L7R1IVFVdd2UXeNXZVn3bV93nlv3hbJtO7+t+8px67rS+DnPbxy5tm0cs24bv637xvMrP2E4jqVnmrZt' +
        'qqqtm6qr67JuK8Os60JRVX1dlWXfN11ZF27fN45b142iquq6Ksu+sMqyMdzGbxy7MBxd2zaOW9edsq0LfWPI9wnPa9vGcfs6' +
        '4/Z1o68MCcePAACAAQcAgAATykChISsCgDgBAAYh5xRTECrFIHQQUuogpFQxBiFzTkrFHJRQSmohlNQqxiBUjknInJMSSmgp' +
        'lNJSB6GlUEproZTWUmuxptRi7SCkFkppLZTSWmqpxtRajBFjEDLnpGTOSQmltBZKaS1zTkrnoKQOQkqlpBRLSi1WzEnJoKPS' +
        'QUippBJTSam1UEprpaQWS0oxthRbbjHWHEppLaQSW0kpxhRTbS3GmiPGIGTOScmckxJKaS2U0lrlmJQOQkqZg5JKSq2VklLM' +
        'nJPSQUipg45KSSm2kkpMoZTWSkqxhVJabDHWnFJsNZTSWkkpxpJKbC3GWltMtXUQWgultBZKaa21VmtqrcZQSmslpRhLSrG1' +
        'FmtuMeYaSmmtpBJbSanFFluOLcaaU2s1ptZqbjHmGlttPdaac0qt1tRSjS3GmmNtvdWae+8gpBZKaS2U0mJqLcbWYq2hlNZK' +
        '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' +
        'AQ==',
      'aiyo-3':
        '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' +
        'KeaQUsox5RxSSjmnnFPOOQgdhMoxBp2DECmlHFPOKccchMxB5ZyD0EEoAAAgwAEAIMBCKDRkRQAQJwDgcCTPkzRLFCVLE0XP' +
        'FGXXE03XlTTNNDVRVFXLE1XVVFXbFk1VtiVNE01N9FRVE0VVFVXTlk1VtW3PNGXZVFXdFlXVtmXbFn5XlnXfM01ZFlXV1k1V' +
        'tXXXln1f1m1dmDTNNDVRVFVNFFXVVFXbNlXXtjVRdFVRVWVZVFVZdmVZ91VX1n1LFFXVU03ZFVVVtlXZ9W1Vln3hdFVdV2XZ' +
        '91VZFn5b14Xh9n3hGFXV1k3X1XVVln1h1mVht3XfKGmaaWqiqKqaKKqqqaq2baqurVui6KqiqsqyZ6qurMqyr6uubOuaKKqu' +
        'qKqyLKqqLKuyrPuqLOu2qKq6rcqysJuuq+u27wvDLOu6cKqurquy7PuqLOu6revGceu6MHymKcumq+q6qbq6buu6ccy2bRyj' +
        'quq+KsvCsMqy7+u6L7R1IVFVdd2UXeNXZVn3bV93nlv3hbJtO7+t+8px67rS+DnPbxy5tm0cs24bv637xvMrP2E4jqVnmrZt' +
        'qqqtm6qr67JuK8Os60JRVX1dlWXfN11ZF27fN45b142iquq6Ksu+sMqyMdzGbxy7MBxd2zaOW9edsq0LfWPI9wnPa9vGcfs6' +
        '4/Z1o68MCcePAACAAQcAgAATykChISsCgDgBAAYh5xRTECrFIHQQUuogpFQxBiFzTkrFHJRQSmohlNQqxiBUjknInJMSSmgp' +
        'lNJSB6GlUEproZTWUmuxptRi7SCkFkppLZTSWmqpxtRajBFjEDLnpGTOSQmltBZKaS1zTkrnoKQOQkqlpBRLSi1WzEnJoKPS' +
        'QUippBJTSam1UEprpaQWS0oxthRbbjHWHEppLaQSW0kpxhRTbS3GmiPGIGTOScmckxJKaS2U0lrlmJQOQkqZg5JKSq2VklLM' +
        'nJPSQUipg45KSSm2kkpMoZTWSkqxhVJabDHWnFJsNZTSWkkpxpJKbC3GWltMtXUQWgultBZKaa21VmtqrcZQSmslpRhLSrG1' +
        'FmtuMeYaSmmtpBJbSanFFluOLcaaU2s1ptZqbjHmGlttPdaac0qt1tRSjS3GmmNtvdWae+8gpBZKaS2U0mJqLcbWYq2hlNZK' +
        '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',
    };
    //#endregion embedded-tones

    /** Settings namespace owned by this plugin (== the loader row id). */
    var COMPLETION_ALERT_NS = "completion-alert";
    /** Host route that keeps this plugin's own copy of the preferences. */
    var SETTINGS_PATH = "/api/completion-alert.settings";
    /** Host route that reports how a session's newest turn ended. */
    var TURN_OUTCOME_PATH = "/api/completion-alert.outcome";
    /** How long a turn outcome is reused before the host is asked again. */
    var OUTCOME_TTL_MS = 30000;
    /** How long to wait for the host before giving up on one lookup. */
    var OUTCOME_TIMEOUT_MS = 1500;
    /** How long to wait between lookups while the Host has not recorded yet. */
    var OUTCOME_RETRY_MS = 250;
    /** How many extra lookups an unknown answer is worth. */
    var OUTCOME_TRIES = 6;
    /** How long a notice card stays on screen before it fades (hover pauses it). */
    var TOAST_HOLD_MS = 9000;
    /** Largest accepted custom sound, as a data URL length (~1.1 MB of audio). */
    var MAX_SOUND_DATA_URL = 1600000;
    /** How long one alert tone is allowed to run before it is stopped. */
    var MAX_PLAY_MS = 4000;
    /** How many times a tone may repeat per alert. */
    var MAX_REPEAT = 4;
    /** How long a tone waits before its first repeat. */
    var REPEAT_GAP_MS = 180;
    /** The dialog exit animation in milliseconds; mirrors @keyframes dca-modal-out. */
    var EXIT_MS = 150;
    /** The settings id that stands for "the user's own uploaded tone". */
    var CUSTOM_TONE_ID = "custom";
    /** Default tone: the meme tone this plugin shipped with. */
    var DEFAULT_TONE_ID = "bingbingbing";

    // ========================================================================
    // The tone library
    // ========================================================================

    /**
     * Every tone the settings offer, straight from the registry that
     * tools/embed-tones.ps1 bakes into the block below (tools/tones.json).
     *
     * Reading the table from the bundle rather than hard-coding it means adding a
     * tone is: drop the Ogg into assets/, add a row to tools/tones.json, re-run
     * the embedder. The rows carry a `source` file name and a `kind`:
     *
     *   synth     — generated by tools/synthesize_tones.py, original work
     *   recording — third-party material, documented in NOTICE and shipped with
     *               a way for a user to replace it
     */
    var TONE_LIBRARY = TONE_DEFINITIONS.map(function (tone) {
      return {
        id: tone.id,
        label: tone.label,
        hint: tone.hint,
        source: tone.source,
        kind: tone.kind
      };
    });

    /** One library entry by id, or undefined. */
    function toneById(id) {
      for (var tone of TONE_LIBRARY) if (tone.id === id) return tone;
      return void 0;
    }

    /** The library entries the settings UI lists, in order. */
    function toneOptions() {
      return TONE_LIBRARY.slice();
    }

    /** The index of a tone id in the library, falling back to the default. */
    function toneIndex(id) {
      var index = TONE_LIBRARY.findIndex((tone) => tone.id === id);
      return index < 0 ? Math.max(0, TONE_LIBRARY.findIndex((tone) => tone.id === DEFAULT_TONE_ID)) : index;
    }

    // ========================================================================
    // Settings
    // ========================================================================

    /** Shipped defaults; every key here is also a field of the host Config. */
    var DEFAULT_SETTINGS = Object.freeze({
      /** Master switch for the whole feature. */
      enabled: true,
      /** "all" = every session; "background" = only sessions not on screen. */
      alertScope: "all",
      /**
       * Whether a round the user stopped by hand is announced. Kept in the schema
       * for documents written before the row was removed, but no longer offered:
       * a stopped round is never announced.
       */
      alertOnStop: false,
      /** How many times one alert repeats (1–4). */
      repeat: 1,
      /**
       * When the dsh window is in the background, announce every finished round
       * regardless of the alert scope: the session "on screen" is not on screen
       * any more.
       */
      alertInBackground: true,
      /** Whether the alert tone plays at all. */
      soundEnabled: true,
      /** Playback volume, 0..1. */
      volume: 0.9,
      /** Built-in tone id, or "custom" for the uploaded one. */
      toneId: DEFAULT_TONE_ID,
      /** Uploaded tone as a data URL ("" = none). */
      customData: "",
      /** Uploaded tone's file name, for the settings row. */
      customName: "",
      /** The saved trim range of the custom tone, within its own payload. */
      customRange: null,
      /**
       * Tones the user added from their own files, newest last.
       *
       * Each one is a full tone in the library - its own row, its own preview,
       * its own name - rather than an occupant of a single "custom" slot. The
       * payload lives here so a reload has nothing to re-import: `customData` and
       * `customName` remain for documents written before this existed.
       */
      tones: []
    });

    /**
     * Clamp one numeric field to a range, falling back on anything unusable.
     * @param value - candidate value from the host document.
     * @param fallback - value used when the candidate is not a finite number.
     * @param min - lower bound.
     * @param max - upper bound.
     * @returns the clamped number.
     */
    function clampNumber(value, fallback, min, max) {
      if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
      return Math.min(max, Math.max(min, value));
    }

    /** Accept a stored payload only when it is a data URL of audio. */
    function cleanAudioDataUrl(value) {
      return typeof value === "string" && value.startsWith("data:audio/") && value.length <= MAX_SOUND_DATA_URL ? value : "";
    }

    /**
     * Coerce one raw settings document into the shape the plugin reads. Every
     * invalid value falls back to its default: a typo in the settings file must
     * never leave the alert broken.
     * @param raw - the namespace value (or anything else).
     * @returns the normalized settings object.
     */
    function sanitizeSettings(raw) {
      var source = typeof raw === "object" && raw !== null ? raw : {};
      var customData = cleanAudioDataUrl(source.customData);
      var tones = cleanUserTones(source.tones);
      var toneId = typeof source.toneId === "string" && source.toneId.length > 0 ? source.toneId : DEFAULT_TONE_ID;
      if (toneId !== CUSTOM_TONE_ID && userToneById(tones, toneId) === null && toneById(toneId) === void 0) {
        toneId = DEFAULT_TONE_ID;
      }
      // "custom" without a payload, or a legacy "soundSource: custom", must not
      // leave the plugin silent: fall back to the default tone.
      if (toneId === CUSTOM_TONE_ID && customData === "") toneId = DEFAULT_TONE_ID;
      return {
        enabled: typeof source.enabled === "boolean" ? source.enabled : DEFAULT_SETTINGS.enabled,
        alertScope: source.alertScope === "background" ? "background" : "all",
        alertOnStop: typeof source.alertOnStop === "boolean" ? source.alertOnStop : DEFAULT_SETTINGS.alertOnStop,
        repeat: clampNumber(source.repeat, DEFAULT_SETTINGS.repeat, 1, MAX_REPEAT),
        alertInBackground: typeof source.alertInBackground === "boolean"
          ? source.alertInBackground
          : DEFAULT_SETTINGS.alertInBackground,
        soundEnabled: typeof source.soundEnabled === "boolean" ? source.soundEnabled : DEFAULT_SETTINGS.soundEnabled,
        volume: clampNumber(source.volume, DEFAULT_SETTINGS.volume, 0, 1),
        toneId,
        customData,
        customName: typeof source.customName === "string" ? source.customName : "",
        customRange: cleanRange(source.customRange),
        tones
      };
    }

    /** The id prefix that marks a tone the user added. */
    var USER_TONE_PREFIX = "user:";

    /** Accept only well-formed user tones, keeping the order they were added in. */
    function cleanUserTones(value) {
      if (!Array.isArray(value)) return [];
      var out = [];
      var seen = {};
      for (var entry of value) {
        if (typeof entry !== "object" || entry === null) continue;
        var data = cleanAudioDataUrl(entry.data);
        if (data === "") continue;
        var id = typeof entry.id === "string" && entry.id.startsWith(USER_TONE_PREFIX) ? entry.id : "";
        if (id === "" || seen[id] === true) continue;
        seen[id] = true;
        out.push({
          id,
          label: typeof entry.label === "string" && entry.label !== "" ? entry.label.slice(0, 60) : "自定义音效",
          data,
          range: cleanRange(entry.range)
        });
      }
      return out;
    }

    /** The user tone with this id, or null. */
    function userToneById(tones, id) {
      if (typeof id !== "string" || !id.startsWith(USER_TONE_PREFIX)) return null;
      for (var entry of tones) {
        if (entry.id === id) return entry;
      }
      return null;
    }

    /** Whether an id names a tone from the user's own files. */
    function isUserToneId(id) {
      return typeof id === "string" && id.startsWith(USER_TONE_PREFIX);
    }

    /** A fresh id for a tone the user is adding. */
    function newUserToneId() {
      return USER_TONE_PREFIX + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
    }

    /**
     * What confirming a trimmed clip does to the settings.
     *
     * Pulled out of the component so the one behaviour the feature is about - a
     * clip joins the library as its own entry and becomes the selected tone -
     * is testable without driving a file picker through a React tree.
     *
     * @param settings - the current settings document.
     * @param retrimId - the tone being re-trimmed, or null for a new clip.
     * @param tone - the new entry `{ id, label, data, range }`.
     * @returns `{ patch, toneId, replaced }` - what to store, what is now active,
     * and whether an existing entry was replaced rather than added.
     */
    function planAddedTone(settings, retrimId, tone) {
      if (typeof retrimId === "string" && isUserToneId(retrimId)) {
        // Re-trimming an existing entry: it keeps its place and its id, and only
        // its slice and name change.
        return {
          patch: {
            tones: settings.tones.map((entry) => (entry.id === retrimId
              ? { id: entry.id, label: tone.label, data: tone.data, range: tone.range }
              : entry))
          },
          toneId: retrimId,
          replaced: true
        };
      }
      return {
        patch: { tones: settings.tones.concat([tone]), toneId: tone.id },
        toneId: tone.id,
        replaced: false
      };
    }

    /** Accept a stored trim range only when it is a usable pair of seconds. */
    function cleanRange(value) {
      if (typeof value !== "object" || value === null) return null;
      var start = typeof value.start === "number" && Number.isFinite(value.start) && value.start >= 0 ? value.start : null;
      var end = typeof value.end === "number" && Number.isFinite(value.end) && value.end > 0 ? value.end : null;
      if (start === null || end === null || end <= start) return null;
      return { start, end };
    }

    /**
     * Merge a settings-scope snapshot onto the defaults. A snapshot may be the
     * namespace value itself or a `{ value }` view of it, and either may carry
     * only a subset of the fields (an older document, a partially served
     * namespace), so only defined keys are taken.
     * @param snapshot - `settingsScope.getSnapshot()` result, or a raw object.
     * @returns the effective settings.
     */
    function normalizeSettings(snapshot) {
      var value = snapshot !== null && typeof snapshot === "object" && typeof snapshot.value === "object" && snapshot.value !== null
        ? snapshot.value
        : snapshot;
      var source = typeof value === "object" && value !== null ? value : {};
      // The namespace document may arrive either flat or wrapped in the row's
      // own config key. Accept both, so a core that hands back the wrapped form
      // does not silently reset every field to its default.
      if (typeof source[COMPLETION_ALERT_NS] === "object" && source[COMPLETION_ALERT_NS] !== null
        && source.alertScope === void 0 && source.toneId === void 0 && source.customData === void 0
        && source.enabled === void 0) {
        source = source[COMPLETION_ALERT_NS];
      }
      var merged = {};
      for (var key of Object.keys(DEFAULT_SETTINGS)) {
        merged[key] = source[key] === void 0 ? DEFAULT_SETTINGS[key] : source[key];
      }
      // Version 1.0.x stored "builtin" | "custom" in soundSource with the payload
      // in soundData; carry those documents forward instead of resetting them.
      if (source.toneId === void 0 && source.soundSource !== void 0) {
        merged.toneId = source.soundSource === "custom" && cleanAudioDataUrl(source.soundData) !== "" ? CUSTOM_TONE_ID : DEFAULT_TONE_ID;
      }
      if (source.customData === void 0 && source.soundData !== void 0) merged.customData = source.soundData;
      if (source.customName === void 0 && source.soundName !== void 0) merged.customName = source.soundName;
      return sanitizeSettings(merged);
    }

    /** The tone a settings object actually asks for: an id, or "none" when muted. */
    function effectiveSource(settings) {
      if (!settings.soundEnabled) return "none";
      if (settings.toneId === CUSTOM_TONE_ID && settings.customData !== "") return CUSTOM_TONE_ID;
      var mine = userToneById(settings.tones, settings.toneId);
      if (mine !== null) return mine.id;
      return toneById(settings.toneId) === void 0 ? DEFAULT_TONE_ID : settings.toneId;
    }

    /** The display name of whatever tone a settings object asks for. */
    function toneLabelFor(settings, id) {
      var mine = userToneById(settings.tones, id);
      if (mine !== null) return mine.label;
      if (id === CUSTOM_TONE_ID) return settings.customName;
      var builtin = toneById(id);
      return builtin === void 0 ? "" : builtin.label;
    }

    // ========================================================================
    // Small shared helpers
    // ========================================================================

    /** A minimal external store the React components read through useSyncExternalStore. */
    function createStore(initial) {
      var state = initial;
      var listeners = new Set();
      return {
        getSnapshot: () => state,
        subscribe(listener) {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
        set(next) {
          if (next === state) return;
          state = next;
          for (var listener of [...listeners]) {
            try {
              listener();
            } catch {
              // One broken subscriber must not stop the others.
            }
          }
        }
      };
    }

    /** Clamp an RGB channel into a byte. */
    function clampChannel(value) {
      return Math.max(0, Math.min(255, Math.round(value)));
    }

    /** { r, g, b } -> "#RRGGBB". */
    function rgbToHex(color) {
      var part = (value) => clampChannel(value).toString(16).padStart(2, "0");
      return "#" + part(color.r) + part(color.g) + part(color.b);
    }

    /**
     * Read the page's background at the bottom-right corner so the notice card
     * blends with whatever skin is active (the app's own tokens do not expose a
     * value that resolves on the overlay layer).
     * @param doc - the document to inspect.
     * @returns a hex colour per theme: `{ light, dark }`.
     */
    function detectSurfaces(doc) {
      var fallback = { light: "#FFFFFF", dark: "#2A2C31" };
      try {
        if (doc === null || doc === void 0 || typeof doc.createElement !== "function") return fallback;
        var probe = doc.createElement("div");
        probe.setAttribute("data-ds-dark-theme", "");
        probe.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px;background:var(--dsw-alias-bg-layer-3, var(--dsw-alias-bg-base, transparent));color:var(--dsw-alias-label-primary, #000)";
        doc.body.appendChild(probe);
        var computed = globalThis.getComputedStyle ? globalThis.getComputedStyle(probe) : null;
        var dark = computed === null ? "" : computed.backgroundColor;
        probe.removeAttribute("data-ds-dark-theme");
        probe.style.background = "var(--dsw-alias-bg-layer-2, var(--dsw-alias-bg-base, transparent))";
        var light = globalThis.getComputedStyle ? globalThis.getComputedStyle(probe).backgroundColor : "";
        probe.remove();
        var parse = (text) => {
          var match = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?/i.exec(String(text ?? ""));
          if (match === null) return null;
          var alpha = match[4] === void 0 ? 1 : Number.parseFloat(match[4]);
          if (alpha < 0.55) return null;
          return rgbToHex({ r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) });
        };
        return {
          light: parse(light) ?? fallback.light,
          dark: parse(dark) ?? fallback.dark
        };
      } catch {
        return fallback;
      }
    }

    /**
     * Decode a base64 payload into bytes without relying on a Node Buffer.
     * @param base64 - the encoded payload.
     * @returns a Uint8Array (empty when the payload is unusable).
     */
    function base64ToBytes(base64) {
      if (typeof base64 !== "string" || base64.length === 0) return new Uint8Array(0);
      var binary = globalThis.atob(base64);
      var bytes = new Uint8Array(binary.length);
      for (var index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
      return bytes;
    }

    /** Turn a data URL into bytes, or null when it is not a data URL. */
    function dataUrlToBytes(dataUrl) {
      if (typeof dataUrl !== "string") return null;
      var comma = dataUrl.indexOf(",");
      if (comma < 0 || !dataUrl.startsWith("data:")) return null;
      try {
        return base64ToBytes(dataUrl.slice(comma + 1));
      } catch {
        return null;
      }
    }

    /** Seconds -> "1 分 12 秒" / "18 秒" (empty for a missing duration). */
    function formatDuration(seconds) {
      if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) return "";
      var total = Math.round(seconds);
      if (total < 60) return total + " 秒";
      var minutes = Math.floor(total / 60);
      var rest = total % 60;
      return minutes + " 分 " + rest + " 秒";
    }

    /** The title a session is announced under. */
    function sessionLabel(row) {
      var title = row !== null && typeof row === "object" ? row.displayTitle ?? row.title : "";
      var text = typeof title === "string" ? title.trim() : "";
      return text === "" ? "新会话" : text;
    }

    /** The one-line notice copy for a completion. */
    function completionText(label, seconds) {
      var duration = formatDuration(seconds);
      return duration === "" ? "「" + label + "」已完成" : "「" + label + "」已完成 · 用时 " + duration;
    }

    /**
     * Which session the main view currently shows — the app's own idiom: the
     * session some owner retains for `mainView`.
     * @param list - `sessions.list.getSnapshot()`.
     * @returns the session id, or undefined when nothing is open.
     */
    function resolveMainSessionId(list) {
      if (list === null || typeof list !== "object" || list.byId === null || typeof list.byId !== "object") return void 0;
      for (var row of Object.values(list.byId)) {
        if (row !== null && typeof row === "object" && (row.retainedBy?.mainView ?? 0) > 0) return row.id;
      }
      return void 0;
    }

    // ========================================================================
    // The alert tone
    // ========================================================================

    /**
     * The tone player.
     *
     * One AudioContext, one decoded AudioBuffer per tone (decoded lazily and
     * cached), and at most one tone in flight: a second completion while the
     * first is still ringing replaces it rather than stacking a second voice on
     * top. `play()` also accepts an explicit slice, which is what the trim
     * dialog auditions before anything is saved.
     *
     * Chromium refuses to start an AudioContext before the page has seen a user
     * gesture, which is exactly the state a freshly loaded window is in. Rather
     * than dropping that first alert, an attempt made while the context is
     * suspended registers a one-shot unlock listener and defers the tone to it;
     * if the listener never fires (the user never touches the window) the tone
     * is dropped at the same deadline as its own timeout.
     *
     * @param options.report - sink for degraded-path notes (host diagnostics).
     * @returns the player face used by the runtime and the settings rows.
     */
    function createAlert(options) {
      var report = typeof options?.report === "function" ? options.report : () => {};
      var settings = { ...DEFAULT_SETTINGS };
      var context = null;
      var sourceNode = null;
      var buffers = new Map();
      var decodedFor = new Map();
      var pending = null;
      var unlockBound = false;
      var timer = null;
      /** A scheduled repeat of the tone that is playing. */
      var repeatTimer = null;
      /**
       * Bumped whenever a playback is superseded - by `stop()`, or by a newer
       * `startBuffer`.
       *
       * A pending repeat compares against this instead of against the live source
       * node: a source ends by itself, and treating that as "superseded" is what
       * made a two-repeat alert play once.
       */
      var playbackGeneration = 0;
      /** Why the last attempt did not produce sound ("" = it did). */
      var lastFailure = "";
      /** The in-flight attempt, so tests and callers can observe its outcome. */
      var pendingRequest = null;

      /** Create the AudioContext on first use; null when the browser has none. */
      function ensureContext() {
        if (context !== null) return context;
        try {
          var Ctor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
          if (typeof Ctor !== "function") {
            report("audio: this window has no AudioContext");
            return null;
          }
          context = new Ctor();
          context.destination ??= void 0;
          // The per-play gain node owns the volume; nothing is wired to the
          // destination up front, so an unused context stays silent.
        } catch (error) {
          report("audio: AudioContext failed (" + String(error?.message ?? error) + ")");
          context = null;
        }
        return context;
      }

      /** The data URL one tone id plays from, or "" when it has none. */
      function dataUrlFor(id) {
        if (id === CUSTOM_TONE_ID) return settings.customData;
        // A tone the user added carries its own payload, so it needs no import
        // step and survives a reload on its own.
        var mine = userToneById(settings.tones, id);
        if (mine !== null) return mine.data;
        var payload = TONE_BASE64[id];
        return typeof payload === "string" && payload.length > 0 ? "data:audio/ogg;base64," + payload : "";
      }

      /** The trim range that belongs to one tone id (user tones carry their own). */
      function rangeFor(id) {
        if (id === CUSTOM_TONE_ID) return settings.customRange;
        var mine = userToneById(settings.tones, id);
        return mine === null ? null : mine.range;
      }

      /** The decoded buffer for one tone id, decoding once per payload. */
      function decodeTone(id) {
        var url = dataUrlFor(id);
        if (url === "") return Promise.resolve(null);
        if (buffers.has(id) && decodedFor.get(id) === url) return Promise.resolve(buffers.get(id));
        var bytes = dataUrlToBytes(url);
        if (bytes === null || bytes.length === 0) return Promise.resolve(null);
        var ctx = ensureContext();
        if (ctx === null) return Promise.resolve(null);
        return new Promise((resolve) => {
          var settle = (buffer) => {
            if (buffer === void 0 || buffer === null) {
              report("audio: the " + id + " payload could not be decoded");
              resolve(null);
              return;
            }
            buffers.set(id, buffer);
            decodedFor.set(id, url);
            resolve(buffer);
          };
          try {
            // The slice keeps a previously handed-out ArrayBuffer intact: some
            // engines detach what they are given.
            var attempt = ctx.decodeAudioData(bytes.buffer.slice(0), (buffer) => settle(buffer), () => settle(null));
            if (attempt !== void 0 && typeof attempt.then === "function") attempt.then(settle, () => settle(null));
          } catch {
            settle(null);
          }
        });
      }

      /** Decode an arbitrary data URL (the trim dialog's working copy). */
      function decodeDataUrl(url) {
        var bytes = dataUrlToBytes(url);
        if (bytes === null || bytes.length === 0) return Promise.resolve(null);
        var ctx = ensureContext();
        if (ctx === null) return Promise.resolve(null);
        return new Promise((resolve) => {
          var settle = (buffer) => resolve(buffer === void 0 || buffer === null ? null : buffer);
          try {
            var attempt = ctx.decodeAudioData(bytes.buffer.slice(0), settle, () => settle(null));
            if (attempt !== void 0 && typeof attempt.then === "function") attempt.then(settle, () => settle(null));
          } catch {
            settle(null);
          }
        });
      }

      /** Arm the one-shot gesture unlock for a context that refused to start. */
      function armUnlock() {
        if (unlockBound) return;
        var target = globalThis.window ?? globalThis.document;
        if (target === null || target === void 0 || typeof target.addEventListener !== "function") return;
        unlockBound = true;
        var unlock = () => {
          unlockBound = false;
          target.removeEventListener("pointerdown", unlock, true);
          target.removeEventListener("keydown", unlock, true);
          try {
            context?.resume?.();
          } catch {
            // A resume refusal is not fatal: the deferred play retries below.
          }
          var next = pending;
          pending = null;
          if (next !== null) startBuffer(next.buffer, next.range, settings.repeat);
        };
        target.addEventListener("pointerdown", unlock, true);
        target.addEventListener("keydown", unlock, true);
      }

      /**
       * Start one already-decoded buffer.
       * @param buffer - the decoded tone.
       * @param range - optional `{ start, duration }` slice to play instead of
       * the whole buffer (seconds); clamped to the buffer.
       */
      /**
       * Play one buffer, and optionally repeat it.
       *
       * The repeats are separate source nodes started on a timer rather than one
       * long buffer, so a repeat always replays the *slice* the user chose - and
       * `stop()` cancels the pending repeat with everything else.
       * @param buffer - the decoded audio.
       * @param range - `{ start, duration }`, or null for the whole buffer.
       * @param repeat - how many times to play it (at least once).
       * @returns the source node of the first playback, or null when it did not
       * start; the caller reports a failed attempt from this.
       */
      function startBuffer(buffer, range, repeat) {
        var times = Math.max(1, Math.min(MAX_REPEAT, Math.floor(repeat ?? 1)));
        var played = 0;
        // A newer playback supersedes whatever was pending: this is what stops a
        // repeat that belongs to an older tone from firing over this one.
        playbackGeneration++;
        if (repeatTimer !== null) {
          clearTimeout(repeatTimer);
          repeatTimer = null;
        }
        /**
         * The stop-guard covers the whole sequence, not one playback at a time.
         *
         * It used to be armed per playback from the *total* duration, so the first
         * repeat's guard was still counting down when the second repeat began - and
         * the second was cut off by the first one's timer. That is why a two-repeat
         * alert was heard as one.
         */
        var guardStart = range === null || range === void 0
          ? 0
          : Math.max(0, Math.min(buffer.duration, range.start ?? 0));
        if (timer !== null) clearTimeout(timer);
        var guarded = null;
        timer = setTimeout(() => {
          timer = null;
          // Only the source this guard was armed for is cleared. Clearing
          // whatever happens to be current instead let a finished round's guard
          // wipe out the *next* round's playback: measured live, the second
          // repeat of a 0.747 s tone was skipped because the previous round's
          // guard expired 14 ms before it was due to start and nulled the node
          // it was about to compare against.
          if (sourceNode !== guarded) return;
          try {
            sourceNode?.stop?.();
          } catch {
            // Already finished.
          }
          sourceNode = null;
        }, watchdogFor(guardStart, sliceSeconds(buffer, range), times));
        var playOnce = () => {
          played++;
          var again = played < times;
          var node = startSource(buffer, range);
          guarded = node;
          if (node === null) return null;
          if (again) {
            var generation = playbackGeneration;
            repeatTimer = setTimeout(() => {
              repeatTimer = null;
              // Only a stop() or a newer playback cancels a pending repeat.
              //
              // This used to compare against the live source node, which ends on
              // its own: a 0.75 s tone clears `sourceNode` at 0.75 s through its
              // `onended`, so the repeat due at 0.93 s found "the source was
              // replaced" and skipped itself. The generation only changes when
              // something genuinely supersedes this sequence.
              if (generation !== playbackGeneration) return;
              playOnce();
            }, Math.max(0, sliceSeconds(buffer, range)) * 1000 + REPEAT_GAP_MS);
          }
          return node;
        };
        return playOnce();
      }

      /**
       * How long the stop-guard waits before it forces the tone to end.
       *
       * The guard exists so a tone cannot outlive its welcome, so it has to cover
       * every repeat plus the gaps between them - a guard built for one play would
       * cut a repeated tone short.
       */
      function watchdogFor(start, duration, times) {
        var one = (start + duration) * 1000;
        return Math.max(300, one * times + REPEAT_GAP_MS * (times - 1) + 160);
      }

      /** How long one slice of a buffer lasts, in seconds. */
      function sliceSeconds(buffer, range) {
        if (range === null || range === void 0) return buffer.duration;
        var start = Math.max(0, Math.min(buffer.duration, range.start ?? 0));
        return Math.max(0.005, Math.min(buffer.duration - start, range.duration ?? buffer.duration - start));
      }

      /**
       * Start one playback of a buffer.
       *
       * The stop-guard is *not* armed here: `startBuffer` owns it, so that it spans
       * every repeat instead of each playback clearing the last one's guard and
       * starting a fresh full-length one.
       *
       * @param buffer - the decoded audio.
       * @param range - `{ start, duration }`, or null for the whole buffer.
       * @returns the source node, or null when it did not start.
       */
      function startSource(buffer, range) {
        try {
          sourceNode?.stop?.();
        } catch {
          // An already-stopped source throws; the new one replaces it anyway.
        }
        sourceNode = null;
        try {
          var node = context.createBufferSource();
          node.buffer = buffer;
          var gain = context.createGain();
          gain.gain.value = Math.max(0, Math.min(1, settings.volume));
          node.connect(gain);
          gain.connect(context.destination);
          node.onended = () => {
            if (sourceNode === node) sourceNode = null;
          };
          var start = 0;
          var duration = buffer.duration;
          if (range !== null && range !== void 0) {
            start = Math.max(0, Math.min(buffer.duration, range.start ?? 0));
            var wanted = range.duration ?? buffer.duration - start;
            duration = Math.max(0.005, Math.min(buffer.duration - start, wanted));
          }
          node.start(0, start, duration);
          sourceNode = node;
          return node;
        } catch (error) {
          report("audio: playback failed (" + String(error?.message ?? error) + ")");
          // null, not false: the caller distinguishes "did not start" from a
          // truthy node by this value.
          return null;
        }
      }

      /**
       * Bring the context to `running` if it is not already, and report the
       * starting state.
       *
       * The resume MUST stay inside the caller's synchronous stretch: Chrome
       * only honours it while the page still holds the click/keypress that led
       * here, so a resume deferred into a `.then()` (or armed for a later
       * gesture) is exactly how a preview ends up silent.
       * @returns the state observed before resuming.
       */
      function wakeContext(ctx) {
        var before = ctx.state;
        if (before !== "suspended" && before !== "interrupted") return before;
        if (typeof ctx.resume !== "function") return before;
        try {
          var resumed = ctx.resume();
          if (resumed !== void 0 && typeof resumed.catch === "function") resumed.catch(() => {});
        } catch {
          // A refused resume leaves the state as it was; the caller reports it.
        }
        return before;
      }

      /**
       * Play one tone through the shared path used by the alert, the arrow
       * switcher and the library rows.
       * @param request - `{ toneId, range }`; toneId defaults to the configured
       * tone, and a range only makes sense for a slice preview.
       * @returns true when playback was attempted.
       */
      function play(request) {
        var toneId = request?.toneId ?? effectiveSource(settings);
        if (toneId === "none") {
          lastFailure = "muted";
          return false;
        }
        var ctx = ensureContext();
        if (ctx === null) {
          lastFailure = "no-audio-context";
          return false;
        }
        var range = request?.range ?? null;
        var stateBefore = wakeContext(ctx);
        var started = decodeTone(toneId).then((buffer) => {
          if (buffer === null) {
            lastFailure = "decode-failed";
            return false;
          }
          // A resumed context needs one microtask to settle; if it is still
          // suspended after that, say so instead of pretending to have played.
          if (ctx.state === "suspended") {
            pending = { buffer, range };
            armUnlock();
            lastFailure = "awaiting-gesture";
            return false;
          }
          if (!startBuffer(buffer, range, settings.repeat)) {
            lastFailure = "start-failed";
            return false;
          }
          lastFailure = "";
          return true;
        });
        pendingRequest = started;
        return true;
      }

      return {
        /** Swap the active preferences (called on every settings snapshot). */
        configure(next) {
          settings = sanitizeSettings(next);
        },
        /** Play the configured tone once, honouring the switches. */
        play() {
          if (!settings.enabled || effectiveSource(settings) === "none") {
            lastFailure = "muted";
            return false;
          }
          return play({ toneId: effectiveSource(settings) });
        },
        /** Play one tone regardless of the switches (settings preview). */
        previewTone(toneId, range) {
          var id = toneId ?? effectiveSource(settings);
          if (id === "none" || id === "") id = DEFAULT_TONE_ID;
          return play({ toneId: id, range: range ?? null });
        },
        /** Play the configured tone regardless of the switches. */
        preview() {
          var id = effectiveSource(settings);
          return play({ toneId: id === "none" ? DEFAULT_TONE_ID : id });
        },
        /** Play one explicit data URL (the trim dialog's audition). */
        previewDataUrl(url, range) {
          if (typeof url !== "string" || url === "") {
            lastFailure = "empty-payload";
            return false;
          }
          var ctx = ensureContext();
          if (ctx === null) {
            lastFailure = "no-audio-context";
            return false;
          }
          wakeContext(ctx);
          var started = decodeDataUrl(url).then((buffer) => {
            if (buffer === null) {
              lastFailure = "decode-failed";
              return false;
            }
            if (ctx.state === "suspended") {
              armUnlock();
              lastFailure = "awaiting-gesture";
              return false;
            }
            if (!startBuffer(buffer, range ?? null, settings.repeat)) {
              lastFailure = "start-failed";
              return false;
            }
            lastFailure = "";
            return true;
          });
          pendingRequest = started;
          return true;
        },
        /** Decode a data URL to an AudioBuffer (the trim dialog's waveform). */
        decode: decodeDataUrl,
        /** Silence the tone in flight. */
        stop() {
          playbackGeneration++;
          if (timer !== null) {
            clearTimeout(timer);
            timer = null;
          }
          if (repeatTimer !== null) {
            clearTimeout(repeatTimer);
            repeatTimer = null;
          }
          try {
            sourceNode?.stop?.();
          } catch {
            // Nothing playing.
          }
          sourceNode = null;
        },
        /** Drop decoded payloads (the custom tone changed). */
        invalidate() {
          buffers.delete(CUSTOM_TONE_ID);
          decodedFor.delete(CUSTOM_TONE_ID);
        },
        /**
         * Test hook: what the player would do right now — including the reason
         * the last attempt stayed silent, which the UI surfaces instead of
         * leaving a dead button.
         */
        state() {
          return {
            context: context?.state ?? "none",
            tone: effectiveSource(settings),
            volume: settings.volume,
            repeat: settings.repeat,
            failure: lastFailure
          };
        },
        /** Await the attempt started by the last play/preview call. */
        settled() {
          return pendingRequest ?? Promise.resolve(false);
        }
      };
    }

    /** Peaks for a waveform view: one min/max pair per column, 0..1. */
    function peaksOf(buffer, columns) {
      var count = Math.max(1, Math.floor(columns));
      var channel = buffer.numberOfChannels > 0 ? buffer.getChannelData(0) : new Float32Array(0);
      var perColumn = Math.max(1, Math.floor(channel.length / count));
      var peaks = [];
      for (var column = 0; column < count; column++) {
        var start = column * perColumn;
        var end = Math.min(channel.length, start + perColumn);
        var min = 0;
        var max = 0;
        for (var index = start; index < end; index++) {
          var value = channel[index];
          if (value < min) min = value;
          if (value > max) max = value;
        }
        peaks.push({ min, max });
      }
      return peaks;
    }

    /** Clamp a trim range onto a buffer duration, keeping a usable minimum. */
    function trimRange(range, duration) {
      var total = typeof duration === "number" && Number.isFinite(duration) && duration > 0 ? duration : 0;
      var minLength = Math.min(0.05, total);
      var start = clampNumber(range?.start, 0, 0, Math.max(0, total - minLength));
      var end = clampNumber(range?.end, total, start + minLength, total);
      if (end - start < minLength) end = Math.min(total, start + minLength);
      return { start, end, duration: Math.max(minLength, end - start) };
    }

    /** Seconds as a short label: "0.42s". */
    function formatSeconds(value) {
      if (typeof value !== "number" || !Number.isFinite(value)) return "0.00s";
      return value.toFixed(2) + "s";
    }

    /**
     * Encode an AudioBuffer slice as a 16-bit PCM WAV data URL.
     *
     * WAV is the only container this plugin can write without an encoder, and
     * the size is bounded by the trim UI: a 3 s mono slice is ~260 KB before
     * base64, well inside the settings document's budget.
     * @param buffer - decoded audio.
     * @param range - `{ start, duration }` in seconds.
     * @returns `data:audio/wav;base64,...`, or "" when the slice is unusable.
     */
    function encodeWav(buffer, range) {
      if (buffer === null || buffer === void 0 || typeof buffer.duration !== "number") return "";
      var slice = trimRange({ start: range?.start, end: (range?.start ?? 0) + (range?.duration ?? buffer.duration) }, buffer.duration);
      var sampleRate = buffer.sampleRate;
      var first = Math.floor(slice.start * sampleRate);
      var last = Math.min(buffer.length, Math.ceil(slice.end * sampleRate));
      var frames = Math.max(1, last - first);
      var channels = Math.min(2, Math.max(1, buffer.numberOfChannels));
      var source = [];
      for (var channel = 0; channel < channels; channel++) source.push(buffer.getChannelData(channel));
      var bytes = new Uint8Array(44 + frames * channels * 2);
      var view = new DataView(bytes.buffer);
      var writeText = (offset, text) => {
        for (var index = 0; index < text.length; index++) view.setUint8(offset + index, text.charCodeAt(index));
      };
      writeText(0, "RIFF");
      view.setUint32(4, 36 + frames * channels * 2, true);
      writeText(8, "WAVE");
      writeText(12, "fmt ");
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, channels, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * channels * 2, true);
      view.setUint16(32, channels * 2, true);
      view.setUint16(34, 16, true);
      writeText(36, "data");
      view.setUint32(40, frames * channels * 2, true);
      var offset = 44;
      for (var frame = 0; frame < frames; frame++) {
        for (var channel = 0; channel < channels; channel++) {
          var sample = source[channel][first + frame] ?? 0;
          var clipped = Math.max(-1, Math.min(1, sample));
          view.setInt16(offset, clipped < 0 ? clipped * 0x8000 : clipped * 0x7fff, true);
          offset += 2;
        }
      }
      var binary = "";
      for (var index = 0; index < bytes.length; index++) binary += String.fromCharCode(bytes[index]);
      return "data:audio/wav;base64," + globalThis.btoa(binary);
    }

    // ========================================================================
    // Completion detection
    // ========================================================================

    /**
     * Watch `uiSession.sessionStatus` and report every busy -> idle transition.
     *
     * Why this source: `sessionStatus` is the client's own process-local
     * projection over the running / pending-interaction / unread-completion
     * facts, and `running` is what the sidebar's status dots and the Stop
     * shortcut's guard read. It covers every session the client knows about,
     * including background and subagent sessions, and it updates on the
     * `api-session/status` event instead of a poll.
     *
     * The first snapshot is a baseline, never a completion: a window opened
     * while a session is already busy must not fire an alert for work it never
     * saw start.
     *
     * @param options.status - `uiSession.sessionStatus` (getSnapshot/subscribe).
     * @param options.mainId - resolves the session the main view shows.
     * @param options.onComplete - called once per finished round.
     * @returns `{ start, stop }`.
     */
    function createCompletionWatcher(options) {
      var status = options.status;
      var mainId = typeof options.mainId === "function" ? options.mainId : () => void 0;
      var onComplete = typeof options.onComplete === "function" ? options.onComplete : () => {};
      var isBackground = typeof options.isBackground === "function" ? options.isBackground : () => false;
      var runningSince = new Map();
      var lastSeen = new Map();
      var armed = false;
      var disposed = false;

      /** Fold one snapshot into the running map and report the transitions. */
      function observe(snapshot) {
        var now = Date.now();
        var next = snapshot instanceof Map ? snapshot : new Map();
        var finished = [];
        for (var entry of next) {
          var sessionId = entry[0];
          var running = entry[1]?.running === true;
          var previous = lastSeen.get(sessionId);
          if (running) {
            if (previous !== true) {
              runningSince.set(sessionId, now);
              // A new round starts here, so the previous round's recorded
              // outcome must not be reused when this one ends.
              outcomeCache.delete(sessionId);
            }
          } else if (armed && previous === true) {
            var startedAt = runningSince.get(sessionId);
            runningSince.delete(sessionId);
            finished.push({ sessionId, seconds: startedAt === void 0 ? void 0 : Math.max(0, (now - startedAt) / 1000) });
          }
          lastSeen.set(sessionId, running);
        }
        if (!armed) {
          armed = true;
          return;
        }
        var current = mainId();
        for (var completion of finished) {
          if (disposed) return;
          // Ask the host how the turn ended before announcing it. The status
          // projection cannot tell a finished round from a stopped one — both
          // flip `running` to false — so a tone fired without this check also
          // fires when the user presses Stop.
          void announce(completion, current);
        }
      }

      /** Resolve the outcome, then hand one completion to the caller. */
      async function announce(completion, current) {
        var kind = null;
        if (typeof options.outcome === "function") {
          try {
            kind = await options.outcome(completion.sessionId);
          } catch {
            kind = null;
          }
        }
        if (disposed) return;
        onComplete({
          sessionId: completion.sessionId,
          seconds: completion.seconds,
          isMain: current !== void 0 && completion.sessionId === current,
          outcome: kind,
          background: isBackground() === true
        });
      }

      return {
        start() {
          if (disposed) return () => {};
          if (status === null || status === void 0 || typeof status.subscribe !== "function") return () => {};
          try {
            observe(status.getSnapshot());
          } catch {
            // A refused first read only delays the baseline.
          }
          var unsubscribe = status.subscribe(() => {
            try {
              observe(status.getSnapshot());
            } catch {
              // A refused update is skipped; the next one re-reads the truth.
            }
          });
          return () => {
            disposed = true;
            try {
              unsubscribe();
            } catch {
              // Already released.
            }
          };
        },
        /** Test hook. */
        stop() {
          disposed = true;
        }
      };
    }

    // ========================================================================
    // Toast store (bottom-right notices)
    // ========================================================================

    /** The queue behind the notice cards. */
    function createToastStore() {
      var store = createStore([]);
      var seq = 0;
      return {
        subscribe: store.subscribe,
        getSnapshot: store.getSnapshot,
        push(item) {
          seq += 1;
          store.set([...store.getSnapshot(), { ...item, seq }]);
          return seq;
        },
        remove(seqId) {
          var next = store.getSnapshot().filter((item) => item.seq !== seqId);
          if (next.length !== store.getSnapshot().length) store.set(next);
        },
        clear() {
          if (store.getSnapshot().length > 0) store.set([]);
        }
      };
    }

    // ========================================================================
    // Styles (one style element, theme tokens from the active skin)
    // ========================================================================

    var STYLE_ID = "dsh-completion-alert/css";
    var CSS = [
      ".dca-layer{position:fixed;right:20px;bottom:20px;z-index:60;display:flex;flex-direction:column;align-items:flex-end;gap:10px;pointer-events:none}",
      ".dca-card{box-sizing:border-box;width:min(336px,calc(100vw - 40px));display:flex;align-items:flex-start;gap:10px;padding:11px 12px 11px 14px;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-lg,12px);background:var(--dca-surface,#fff);color:var(--dsw-alias-label-primary);box-shadow:0 12px 32px rgba(0,0,0,.16),0 2px 6px rgba(0,0,0,.08);pointer-events:auto;cursor:pointer;text-align:start;font:inherit;animation:dca-in 220ms var(--ds-ease-out,cubic-bezier(.2,.8,.2,1));transition:background-color 120ms ease,border-color 120ms ease}",
      ".dca-card:hover{border-color:var(--dsw-alias-brand-primary);background:color-mix(in srgb, var(--dsw-alias-brand-primary) 8%, var(--dca-surface,#fff))}",
      ".dca-card[data-leaving=true]{animation:dca-out 160ms ease forwards}",
      ".dca-mark{flex:none;width:18px;height:18px;margin-top:1px;color:var(--dsw-alias-state-success-primary,#22a06b)}",
      ".dca-body{flex:1 1 auto;min-width:0}",
      ".dca-title{font-size:14px;line-height:20px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".dca-text{margin-top:2px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".dca-hint{margin-top:6px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary)}",
      ".dca-close{flex:none;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;border:none;border-radius:6px;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;opacity:0;transition:opacity 120ms ease,background-color 120ms ease}",
      ".dca-card:hover .dca-close,.dca-card:focus-within .dca-close{opacity:1}",
      ".dca-close:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}",
      ".dca-arm{position:fixed;right:20px;bottom:20px;z-index:59;display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;background:var(--dsw-alias-bg-layer-2,#fff);color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;box-shadow:0 6px 18px rgba(0,0,0,.12)}",
      ".dca-section{display:flex;flex-direction:column;width:100%}",
      ".dca-heading{font-size:14px;line-height:20px;font-weight:600;color:var(--dsw-alias-label-primary);padding:0 0 4px}",
      ".dca-intro{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);padding:0 0 4px}",
      ".dca-row{border-bottom:.5px solid var(--dsw-alias-border-l2);display:flex;justify-content:space-between;align-items:center;gap:24px;padding:16px 0}",
      ".dca-row:last-child{border-bottom:none}",
      ".dca-row-main{min-width:0;flex:1 1 auto}",
      ".dca-row-title{font-size:14px;line-height:20px;color:var(--dsw-alias-label-primary)}",
      ".dca-row-desc{color:var(--dsw-alias-label-secondary);margin-top:4px;font-size:12px;line-height:18px;overflow-wrap:anywhere}",
      ".dca-row-alert{color:var(--dsw-alias-state-error-primary,#e5484d);margin-top:6px;font-size:12px;line-height:18px}",
      ".dca-row-ok{color:var(--dsw-alias-state-success-primary,#22a06b);margin-top:6px;font-size:12px;line-height:18px}",
      ".dca-row-side{display:flex;align-items:center;gap:8px;flex:none}",
      ".dca-seg{display:inline-flex;align-items:center;gap:2px;padding:2px;border-radius:999px;background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.14))}",
      ".dca-seg button{border:none;border-radius:999px;padding:3px 12px;font-size:12px;line-height:18px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;transition:background-color 140ms ease,color 140ms ease}",
      ".dca-seg button[data-active=true]{background:var(--dsw-alias-bg-layer-3,#fff);color:var(--dsw-alias-label-primary);font-weight:600;box-shadow:0 1px 2px rgba(0,0,0,.12)}",
      ".dca-btn{border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:4px 12px;font-size:12px;line-height:20px;background:var(--dsw-alias-bg-layer-3,#fff);color:var(--dsw-alias-label-primary);cursor:pointer;transition:background-color 120ms ease,border-color 120ms ease}",
      ".dca-btn:hover:not(:disabled){border-color:var(--dsw-alias-brand-primary)}",
      ".dca-btn:disabled{opacity:.5;cursor:default}",
      ".dca-row strong{font-weight:600}",
      ".dca-tone{display:flex;align-items:center;gap:6px}",
      ".dca-icon{width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;flex:none;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-3,#fff);color:var(--dsw-alias-label-secondary);cursor:pointer;transition:background-color 120ms ease,color 120ms ease,border-color 120ms ease}",
      ".dca-icon:hover:not(:disabled){color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-brand-primary)}",
      ".dca-icon:disabled{opacity:.45;cursor:default}",
      ".dca-icon-placeholder{width:26px;height:26px;flex:none;display:inline-block}",
      ".dca-tone-label{display:flex;flex-direction:column;align-items:center;gap:1px;min-width:118px;max-width:210px;padding:2px 8px;border:1px solid transparent;border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary);cursor:pointer;font:inherit;text-align:center}",
      ".dca-tone-label:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.12))}",
      ".dca-tone-name{font-size:13px;line-height:18px;font-weight:600;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".dca-tone-hint{font-size:11px;line-height:15px;color:var(--dsw-alias-label-tertiary);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".dca-modal-layer{position:fixed;inset:0;z-index:80;display:flex;align-items:center;justify-content:center;animation:dca-mask-in 160ms var(--ds-ease-out,cubic-bezier(.2,.8,.2,1)) both}",
      ".dca-modal-mask{position:absolute;inset:0;background:rgba(0,0,0,.34)}",
      ".dca-modal{position:relative;box-sizing:border-box;width:min(420px,calc(100vw - 40px));max-height:min(70vh,560px);display:flex;flex-direction:column;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-lg,12px);background:var(--dsw-alias-bg-layer-2,#fff);box-shadow:0 18px 48px rgba(0,0,0,.28);overflow:hidden;animation:dca-modal-in 200ms var(--ds-ease-out,cubic-bezier(.2,.8,.2,1)) both}",
      ".dca-modal-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border-bottom:1px solid var(--dsw-alias-border-l2)}",
      ".dca-modal-title{font-size:14px;line-height:20px;font-weight:600;color:var(--dsw-alias-label-primary)}",
      ".dca-modal-body{padding:8px 10px 12px;overflow:auto}",
      ".dca-modal-divider{height:1px;background:var(--dsw-alias-border-l2);margin:8px 6px}",
      ".dca-modal-foot{padding:10px 14px 12px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary)}",
      ".dca-tone-row{display:flex;align-items:center;gap:8px;padding:4px 4px;border-radius:8px}",
      ".dca-tone-row:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.12))}",
      ".dca-tone-row[data-active=true] .dca-tone-pick{color:var(--dsw-alias-label-primary)}",
      ".dca-tone-pick{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:1px;border:none;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;font:inherit;text-align:start;padding:4px 2px}",
      ".dca-tone-pick[data-playing=true] .dca-tone-name{color:var(--dsw-alias-brand-primary)}",
      ".dca-tone-tick{flex:none;display:inline-flex;color:var(--dsw-alias-state-success-primary,#22a06b);width:22px;justify-content:center}",
      ".dca-trim{width:min(560px,calc(100vw - 40px))}",
      ".dca-trim-wrap{position:relative;margin:6px 2px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;overflow:hidden;background:var(--dsw-alias-bg-layer-3,#fff)}",
      ".dca-trim-canvas{display:block;width:100%;height:132px;color:var(--dsw-alias-label-tertiary);cursor:crosshair;touch-action:none}",
      // A name row inside a dialog: the app's field styling, so the rename and
      // the first-save naming look like the rest of the settings page.
      ".dca-field{display:flex;flex-direction:column;gap:5px;margin:2px 2px 10px}",
      ".dca-field-label{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}",
      ".dca-input{box-sizing:border-box;width:100%;padding:6px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-3,#fff);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:20px}",
      ".dca-input:focus{outline:none;border-color:var(--dsw-alias-brand-primary)}",
      ".dca-input::placeholder{color:var(--dsw-alias-label-tertiary)}",
      ".dca-repeat-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:2px 2px 6px}",
      ".dca-repeat-label{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}",
      ".dca-trim-shade{position:absolute;top:0;bottom:0;background:rgba(0,0,0,.28);pointer-events:none}",
      ".dca-trim-handle{position:absolute;top:0;bottom:0;width:2px;margin-left:-1px;background:var(--dsw-alias-brand-primary);pointer-events:none}",
      ".dca-trim-grip{position:absolute;top:calc(50% - 8px);left:-5px;width:12px;height:16px;border-radius:4px;background:var(--dsw-alias-brand-primary)}",
      ".dca-trim-tag{position:absolute;top:2px;left:6px;padding:0 4px;border-radius:4px;background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary-inverted,#fff);font-size:10px;line-height:14px;white-space:nowrap}",
      ".dca-trim-handle[data-side=end] .dca-trim-tag{left:auto;right:6px}",
      ".dca-trim-meta{display:flex;justify-content:space-between;gap:12px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);padding:0 4px}",
      ".dca-trim-hint{margin-top:6px;padding:0 4px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary)}",
      ".dca-trim-actions{display:flex;justify-content:flex-end;gap:8px;padding-top:12px}",
      ".dca-btn-primary{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary-inverted,#fff)}",
      ".dca-btn-primary:hover:not(:disabled){filter:brightness(1.06)}",
      "@keyframes dca-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}",
      "@keyframes dca-out{from{opacity:1;transform:none}to{opacity:0;transform:translateX(14px)}}",
      // The modal layer and its card: the mask fades, the card rises and scales
      // in, which is what makes an overlay read as "opened" rather than "swapped".
      "@keyframes dca-mask-in{from{opacity:0}to{opacity:1}}",
      // Exit runs on a `.dca-leaving` layer, so a dialog animates out before it
      // is unmounted (the element cannot animate what no longer exists).
      "@keyframes dca-mask-out{from{opacity:1}to{opacity:0}}",
      "@keyframes dca-modal-out{from{opacity:1;transform:none}to{opacity:0;transform:translateY(8px) scale(.98)}}",
      ".dca-modal-layer.dca-leaving{animation:dca-mask-out 150ms var(--ds-ease-in,cubic-bezier(.4,0,1,1)) both}",
      ".dca-modal-layer.dca-leaving .dca-modal{animation:dca-modal-out 150ms var(--ds-ease-in,cubic-bezier(.4,0,1,1)) both}",
      "@keyframes dca-modal-in{from{opacity:0;transform:translateY(12px) scale(.97)}to{opacity:1;transform:none}}",
      "@media (prefers-reduced-motion:reduce){.dca-card{animation:none}.dca-card[data-leaving=true]{animation:none;opacity:0}}"
    ].join("\n");

    /** Inject the stylesheet once, keeping a handle for teardown. */
    function injectStyles() {
      var doc = globalThis.document;
      if (doc === null || doc === void 0 || typeof doc.createElement !== "function") return null;
      var existing = doc.querySelector('style[data-dsh-completion-alert="css"]');
      if (existing !== null) return existing;
      var tag = doc.createElement("style");
      tag.setAttribute("data-dsh-plugin", "dsh-completion-alert");
      tag.setAttribute("data-dsh-completion-alert", "css");
      tag.textContent = CSS;
      doc.head.appendChild(tag);
      return tag;
    }

    // ========================================================================
    // Icons (inline; no icon-package dependency for the alert surface)
    // ========================================================================

    /** Circled check, matching the app's success mark. */
    function CheckIcon(props) {
      var size = props?.size ?? 18;
      return react.default.createElement("svg", { className: props?.className, width: size, height: size, viewBox: "0 0 20 20", fill: "none", "aria-hidden": "true" },
        react.default.createElement("circle", { cx: 10, cy: 10, r: 8.25, stroke: "currentColor", strokeWidth: 1.5 }),
        react.default.createElement("path", { d: "M6.4 10.3l2.3 2.3 4.9-5.1", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" }));
    }

    /** Small close glyph. */
    function CrossIcon(props) {
      var size = props?.size ?? 12;
      return react.default.createElement("svg", { width: size, height: size, viewBox: "0 0 12 12", fill: "none", "aria-hidden": "true" },
        react.default.createElement("path", { d: "M2.5 2.5l7 7M9.5 2.5l-7 7", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round" }));
    }

    // ========================================================================
    // The bottom-right notice card
    // ========================================================================

    /**
     * One notice: titled by the session, opened by a click, dismissed by the
     * close control or by its own hold expiring. Hovering pauses the hold so a
     * card that arrived while the user was reading is never yanked away.
     */
    function CompletionCard(props) {
      var item = props.item;
      var t = typeof props.t === "function" ? props.t : (key) => key;
      var store = props.store;
      var openSession = props.openSession;
      var leavingState = react.default.useState(false);
      var leaving = leavingState[0];
      var setLeaving = leavingState[1];
      var hovered = react.default.useRef(false);
      var dismissed = react.default.useRef(false);

      var dismiss = () => {
        if (dismissed.current) return;
        dismissed.current = true;
        setLeaving(true);
        setTimeout(() => store.remove(item.seq), 170);
      };

      react.default.useEffect(() => {
        var handle = setTimeout(() => {
          if (!hovered.current) dismiss();
        }, TOAST_HOLD_MS);
        return () => clearTimeout(handle);
        // The hold is per card; the store identity never changes.
      }, [item.seq]);

      var onOpen = () => {
        dismiss();
        try {
          openSession(item.sessionId);
        } catch {
          // A refused navigation leaves the card's job done anyway.
        }
      };

      return react.default.createElement("div", {
        className: "dca-card",
        role: "alert",
        "data-dsh-completion-alert": "card",
        "data-leaving": leaving ? "true" : void 0,
        tabIndex: 0,
        onMouseEnter: () => {
          hovered.current = true;
        },
        onMouseLeave: () => {
          hovered.current = false;
        },
        onClick: onOpen,
        onKeyDown: (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpen();
          }
        }
      },
        react.default.createElement(CheckIcon, { className: "dca-mark", size: 18 }),
        react.default.createElement("div", { className: "dca-body" },
          react.default.createElement("div", { className: "dca-title" }, item.title),
          react.default.createElement("div", { className: "dca-text" }, item.detail),
          react.default.createElement("div", { className: "dca-hint" }, t("card.open"))),
        react.default.createElement("button", {
          type: "button",
          className: "dca-close",
          "aria-label": t("card.dismiss"),
          onClick: (event) => {
            event.stopPropagation();
            dismiss();
          }
        }, react.default.createElement(CrossIcon, {})));
    }

    /**
     * The `shell.overlay` entry: a fixed layer above the bottom-right corner
     * with the live notice cards, plus the one-time "click anywhere to enable
     * sound" hint Chromium's autoplay rule makes necessary.
     */
    function ToastHost(props) {
      var store = props.store;
      var t = typeof props.t === "function" ? props.t : (key) => key;
      var openSession = props.openSession;
      var surface = react.default.useSyncExternalStore(
        (listener) => props.surface.subscribe(listener),
        () => props.surface.getSnapshot(),
        () => props.surface.getSnapshot()
      );
      var items = react.default.useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
      var audioNeedsGesture = props.audioNeedsGesture;
      var needsGesture = react.default.useSyncExternalStore(audioNeedsGesture.subscribe, audioNeedsGesture.getSnapshot, audioNeedsGesture.getSnapshot);
      var theme = react.default.useSyncExternalStore(
        (listener) => props.dark.subscribe(listener),
        () => props.dark.getSnapshot(),
        () => props.dark.getSnapshot()
      );
      var surfaceColor = theme === true ? surface.dark : surface.light;
      if (items.length === 0 && !needsGesture) return null;
      return react.default.createElement("div", { className: "dca-layer", "data-dsh-completion-alert": "layer", style: { "--dca-surface": surfaceColor } },
        items.map((item) => react.default.createElement(CompletionCard, {
          key: item.seq,
          item,
          t,
          store,
          openSession
        })),
        needsGesture && items.length === 0
          ? react.default.createElement("div", { className: "dca-arm", "data-dsh-completion-alert": "arm" }, t("card.arm"))
          : null);
    }

    // ========================================================================
    // Settings rows
    // ========================================================================

    /** A switch: the app's own component when the primitives package is there. */
    function Toggle(props) {
      if (primitives !== null && typeof primitives.Switch === "function") {
        return react.default.createElement(primitives.Switch, {
          checked: props.checked,
          label: props.label,
          disabled: props.disabled === true,
          onChange: props.onChange
        });
      }
      return react.default.createElement("input", {
        type: "checkbox",
        checked: props.checked,
        disabled: props.disabled === true,
        "aria-label": props.label,
        onChange: (event) => props.onChange(event.target.checked)
      });
    }

    /** A two-or-three position segmented control, in the app's pill style. */
    function Segmented(props) {
      return react.default.createElement("div", { className: "dca-seg", role: "group", "aria-label": props.label },
        props.options.map((option) => react.default.createElement("button", {
          key: option.value,
          type: "button",
          "data-active": props.value === option.value ? "true" : "false",
          "aria-pressed": props.value === option.value,
          onClick: () => props.onChange(option.value)
        }, option.label)));
    }

    /** A small square icon button (arrows, preview, close). */
    function IconButton(props) {
      return react.default.createElement("button", {
        type: "button",
        className: "dca-icon",
        title: props.title,
        "aria-label": props.title,
        disabled: props.disabled === true,
        onClick: props.onClick
      }, props.children);
    }

    /** One settings row: title, description, and a right-hand control. */
    function Row(props) {
      return react.default.createElement("div", { className: "dca-row", "data-dsh-completion-alert": "row" },
        react.default.createElement("div", { className: "dca-row-main" },
          react.default.createElement("div", { className: "dca-row-title" }, props.title),
          props.description === void 0 ? null : react.default.createElement("div", { className: "dca-row-desc" }, props.description),
          props.note === void 0 ? null : react.default.createElement("div", { className: props.noteTone === "ok" ? "dca-row-ok" : "dca-row-alert", role: props.noteTone === "ok" ? void 0 : "alert" }, props.note)),
        props.children === void 0 ? null : react.default.createElement("div", { className: "dca-row-side" }, props.children));
    }

    /**
     * Run `close` after the layer has animated out.
     *
     * A dialog that is unmounted immediately cannot animate its own exit, so the
     * layer keeps itself mounted for the duration of the exit animation. The
     * shape is shared by the tone library, the trim dialog and the rename dialog,
     * which is why it lives here rather than in each of them.
     * @param close - what to do once the exit animation has played.
     * @returns `{ leaving, leave }`, where `leave` starts the exit.
     */
    function useLeaving(close) {
      var leavingState = react.default.useState(false);
      var leaving = leavingState[0];
      var setLeaving = leavingState[1];
      var timer = react.default.useRef(null);
      react.default.useEffect(() => () => {
        if (timer.current !== null) clearTimeout(timer.current);
      }, []);
      var leave = () => {
        if (leaving) return;
        setLeaving(true);
        timer.current = setTimeout(() => {
          timer.current = null;
          close();
        }, EXIT_MS);
      };
      return { leaving: leaving, leave: leave };
    }

    /**
     * Chevron glyphs, drawn locally so the rows need no icon package.
     *
     * The path itself is a downward V, so `down` is the unrotated case: mapping
     * it to 180° (as an early version did) points it straight up instead.
     */
    function Chevron(props) {
      var rotation = { down: 0, left: 90, up: 180, right: 270 }[props.direction] ?? 0;
      return react.default.createElement("svg", {
        width: 14,
        height: 14,
        viewBox: "0 0 14 14",
        fill: "none",
        "aria-hidden": "true",
        style: { transform: `rotate(${String(rotation)}deg)` }
      }, react.default.createElement("path", {
        d: "M3.2 5.1L7 8.9l3.8-3.8",
        stroke: "currentColor",
        strokeWidth: 1.6,
        strokeLinecap: "round",
        strokeLinejoin: "round"
      }));
    }

    /**
     * The tone row's switcher: `‹ current ›` plus a downward arrow that opens the
     * library. Switching with the arrows previews immediately (the user hears
     * what they picked); the library row previews only on its own play button.
     */
    function ToneSwitcher(props) {
      var t = props.t;
      return react.default.createElement("div", { className: "dca-tone" },
        react.default.createElement(IconButton, {
          title: t("tone.prev"),
          onClick: () => props.onStep(-1)
        }, react.default.createElement(Chevron, { direction: "left" })),
        react.default.createElement("button", {
          type: "button",
          className: "dca-tone-label",
          title: props.hint,
          onClick: () => props.onPreview()
        },
          react.default.createElement("span", { className: "dca-tone-name" }, props.label),
          react.default.createElement("span", { className: "dca-tone-hint" }, props.hint)),
        react.default.createElement(IconButton, {
          title: t("tone.next"),
          onClick: () => props.onStep(1)
        }, react.default.createElement(Chevron, { direction: "right" })),
        react.default.createElement(IconButton, {
          title: t("tone.library"),
          onClick: props.onOpenLibrary
        }, react.default.createElement(Chevron, { direction: "down" })));
    }

    /** The play/stop glyph shared by the library rows and the trim dialog. */
    function PlayIcon(props) {
      return react.default.createElement("svg", { width: 13, height: 13, viewBox: "0 0 14 14", fill: "none", "aria-hidden": "true" },
        react.default.createElement("path", { d: "M4.4 2.5l7 4.5-7 4.5z", fill: "currentColor" }));
    }

    /** A tick for the selected library row. */
    function CheckIcon(props) {
      return react.default.createElement("svg", { width: 14, height: 14, viewBox: "0 0 14 14", fill: "none", "aria-hidden": "true" },
        react.default.createElement("path", { d: "M2.8 7.4l2.8 2.8 5.6-6", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" }));
    }

    /**
     * The full tone library, over the settings page: every built-in tone with its
     * own preview button, then every tone the user added from their own files,
     * then the "add" row that opens the file picker.
     *
     * A tone the user adds becomes a row of its own here - not an occupant of a
     * single custom slot - so several clips can live side by side, each with its
     * own name, preview, rename and remove.
     */
    function ToneLibraryPanel(props) {
      var t = props.t;
      var exit = useLeaving(props.onClose);
      var leaving = exit.leaving;
      var leave = exit.leave;
      var playingId = react.default.useState("");
      var playing = playingId[0];
      var setPlaying = playingId[1];
      var userTones = Array.isArray(props.userTones) ? props.userTones : [];
      var preview = (toneId) => {
        setPlaying(toneId);
        props.onPreview(toneId);
        setTimeout(() => setPlaying(""), 900);
      };
      /** One row for a tone the user added. */
      var userToneRow = (tone) => react.default.createElement("div", {
        key: tone.id,
        className: "dca-tone-row",
        "data-active": props.current === tone.id ? "true" : "false"
      },
        react.default.createElement("button", {
          type: "button",
          className: "dca-icon",
          title: t("library.preview"),
          "aria-label": t("library.preview"),
          onClick: () => preview(tone.id)
        }, react.default.createElement(PlayIcon, {})),
        react.default.createElement("button", {
          type: "button",
          className: "dca-tone-pick",
          "data-playing": playing === tone.id ? "true" : "false",
          onClick: () => props.onPick(tone.id)
        },
          react.default.createElement("span", { className: "dca-tone-name" }, tone.label),
          react.default.createElement("span", { className: "dca-tone-hint" }, t("library.mine.hint"))),
        react.default.createElement("button", {
          type: "button",
          className: "dca-icon",
          title: t("library.custom.rename"),
          "aria-label": t("library.custom.rename"),
          onClick: () => props.onRenameTone(tone.id)
        }, react.default.createElement("svg", { width: 13, height: 13, viewBox: "0 0 14 14", fill: "none", "aria-hidden": "true" },
          react.default.createElement("path", { d: "M9.1 2.2l2.7 2.7L5.4 11.3 2.3 12l.7-3.1z", stroke: "currentColor", strokeWidth: 1.3, strokeLinecap: "round", strokeLinejoin: "round" }))),
        react.default.createElement("button", {
          type: "button",
          className: "dca-icon",
          title: t("library.mine.remove"),
          "aria-label": t("library.mine.remove"),
          onClick: () => props.onRemoveTone(tone.id)
        }, react.default.createElement("svg", { width: 13, height: 13, viewBox: "0 0 14 14", fill: "none", "aria-hidden": "true" },
          react.default.createElement("path", { d: "M3 3l8 8M11 3l-8 8", stroke: "currentColor", strokeWidth: 1.3, strokeLinecap: "round" }))),
        props.current === tone.id ? react.default.createElement("span", { className: "dca-tone-tick" }, react.default.createElement(CheckIcon, {})) : null);
      return react.default.createElement("div", {
        className: leaving ? "dca-modal-layer dca-leaving" : "dca-modal-layer",
        "data-dsh-completion-alert": "library"
      },
        react.default.createElement("div", { className: "dca-modal-mask", onClick: leave, "aria-hidden": "true" }),
        react.default.createElement("div", { className: "dca-modal", role: "dialog", "aria-modal": "true", "aria-label": t("library.title") },
          react.default.createElement("div", { className: "dca-modal-head" },
            react.default.createElement("div", { className: "dca-modal-title" }, t("library.title")),
            react.default.createElement("button", {
              type: "button",
              className: "dca-icon",
              "aria-label": t("library.close"),
              title: t("library.close"),
              onClick: leave
            }, react.default.createElement("svg", { width: 12, height: 12, viewBox: "0 0 12 12", fill: "none", "aria-hidden": "true" },
              react.default.createElement("path", { d: "M2.5 2.5l7 7M9.5 2.5l-7 7", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round" })))),
          react.default.createElement("div", { className: "dca-modal-body" },
            props.tones.map((tone) => {
              var active = props.current === tone.id;
              return react.default.createElement("div", {
                key: tone.id,
                className: "dca-tone-row",
                "data-active": active ? "true" : "false"
              },
                react.default.createElement("button", {
                  type: "button",
                  className: "dca-icon",
                  title: t("library.preview"),
                  "aria-label": t("library.preview"),
                  onClick: () => preview(tone.id, false)
                }, react.default.createElement(PlayIcon, {})),
                react.default.createElement("button", {
                  type: "button",
                  className: "dca-tone-pick",
                  "data-playing": playing === tone.id ? "true" : "false",
                  onClick: () => props.onPick(tone.id)
                },
                  react.default.createElement("span", { className: "dca-tone-name" }, tone.label),
                  react.default.createElement("span", { className: "dca-tone-hint" }, tone.hint)),
                active ? react.default.createElement("span", { className: "dca-tone-tick" }, react.default.createElement(CheckIcon, {})) : null);
            }),
            react.default.createElement("div", { className: "dca-modal-divider" }),
            // One row per tone the user added: a clip becomes a library entry of
            // its own instead of occupying the single custom slot.
            userTones.map(userToneRow),
            react.default.createElement("div", {
              className: "dca-tone-row",
              "data-active": props.current === CUSTOM_TONE_ID ? "true" : "false"
            },
              props.hasCustom
                ? react.default.createElement("button", {
                  type: "button",
                  className: "dca-icon",
                  title: t("library.preview"),
                  "aria-label": t("library.preview"),
                  onClick: () => preview(CUSTOM_TONE_ID)
                }, react.default.createElement(PlayIcon, {}))
                : react.default.createElement("span", { className: "dca-icon-placeholder" }),
              react.default.createElement("button", {
                type: "button",
                className: "dca-tone-pick",
                onClick: () => props.onPick(CUSTOM_TONE_ID)
              },
                react.default.createElement("span", { className: "dca-tone-name" }, t("library.custom")),
                react.default.createElement("span", { className: "dca-tone-hint" }, props.hasCustom ? props.customName : t("library.custom.hint"))),
              props.hasCustom
                ? react.default.createElement("button", {
                  type: "button",
                  className: "dca-icon",
                  title: t("library.custom.rename"),
                  "aria-label": t("library.custom.rename"),
                  onClick: props.onRename
                }, react.default.createElement("svg", { width: 13, height: 13, viewBox: "0 0 14 14", fill: "none", "aria-hidden": "true" },
                  react.default.createElement("path", { d: "M9.1 2.2l2.7 2.7L5.4 11.3 2.3 12l.7-3.1z", stroke: "currentColor", strokeWidth: 1.3, strokeLinecap: "round", strokeLinejoin: "round" })))
                : react.default.createElement("span", { className: "dca-icon-placeholder" }),
              props.hasCustom
                ? react.default.createElement("button", {
                  type: "button",
                  className: "dca-icon",
                  title: t("library.custom.retrim"),
                  "aria-label": t("library.custom.retrim"),
                  onClick: props.onRetrim
                }, react.default.createElement("svg", { width: 13, height: 13, viewBox: "0 0 14 14", fill: "none", "aria-hidden": "true" },
                  react.default.createElement("path", { d: "M2.6 7.4l2.6 2.6L5.2 4.6l6.2 2.8-6.2 2.8", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round", strokeLinejoin: "round" })))
                : react.default.createElement("span", { className: "dca-icon-placeholder" }),
              props.current === CUSTOM_TONE_ID && props.hasCustom
                ? react.default.createElement("span", { className: "dca-tone-tick" }, react.default.createElement(CheckIcon, {}))
                : null),
            react.default.createElement("div", { className: "dca-modal-foot" }, t("library.hint")))));
    }

    /**
     * The trim dialog: the whole decoded waveform, two draggable handles, and a
     * preview of exactly the selected slice. Save encodes the slice to a WAV data
     * URL (the only container this plugin can write without an encoder).
     */
    function TrimDialog(props) {
      var t = props.t;
      var exit = useLeaving(props.onCancel);
      var leaving = exit.leaving;
      var leave = exit.leave;
      var nameState = react.default.useState(props.name ?? "");
      var name = nameState[0];
      var setName = nameState[1];
      var rangeState = react.default.useState({ start: props.initial?.start ?? 0, end: props.initial?.end ?? 0 });
      var range = rangeState[0];
      var setRange = rangeState[1];
      var dragging = react.default.useRef("");
      var canvasRef = react.default.useRef(null);
      var duration = props.duration > 0 ? props.duration : Math.max(0.01, range.end || 1);
      var clamped = trimRange({ start: range.start, end: range.end }, duration);

      // Paint the waveform whenever the payload or the size changes.
      react.default.useEffect(() => {
        var canvas = canvasRef.current;
        if (canvas === null || canvas === void 0 || props.peaks.length === 0) return;
        var ratio = Math.max(1, Math.min(3, globalThis.devicePixelRatio ?? 1));
        var cssWidth = canvas.clientWidth > 0 ? canvas.clientWidth : canvas.width;
        var cssHeight = 132;
        // Draw at device resolution: a canvas scaled up by CSS is the reason the
        // waveform looked soft.
        canvas.width = Math.round(cssWidth * ratio);
        canvas.height = Math.round(cssHeight * ratio);
        var width = canvas.width;
        var height = canvas.height;
        var ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, width, height);
        var styles = globalThis.getComputedStyle ? globalThis.getComputedStyle(canvas) : null;
        ctx.fillStyle = styles?.color ?? "#888";
        var middle = height / 2;
        var perColumn = width / props.peaks.length;
        var barWidth = Math.max(1, Math.ceil(perColumn));
        for (var index = 0; index < props.peaks.length; index++) {
          var peak = props.peaks[index];
          var top = middle - peak.max * middle * 0.92;
          var bottom = middle - peak.min * middle * 0.92;
          ctx.fillRect(index * perColumn, top, barWidth, Math.max(1, bottom - top));
        }
      }, [props.peaks, props.payload]);

      var fractionOf = (event) => {
        var canvas = canvasRef.current;
        if (canvas === null || canvas === void 0) return 0;
        var rect = canvas.getBoundingClientRect();
        return Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width)));
      };
      var onDown = (event) => {
        var fraction = fractionOf(event);
        dragging.current = Math.abs(fraction * duration - clamped.start) <= Math.abs(fraction * duration - clamped.end) ? "start" : "end";
        if (typeof event.currentTarget.setPointerCapture === "function") {
          try {
            event.currentTarget.setPointerCapture(event.pointerId);
          } catch {
            // Pointer capture is best effort.
          }
        }
        onMove(event);
      };
      var onMove = (event) => {
        if (dragging.current === "") return;
        var seconds = fractionOf(event) * duration;
        var next = dragging.current === "start" ? { start: seconds, end: clamped.end } : { start: clamped.start, end: seconds };
        setRange(trimRange(next, duration));
      };
      var onUp = () => {
        dragging.current = "";
      };

      var handle = (side) => react.default.createElement("div", {
        className: "dca-trim-handle",
        "data-side": side,
        style: { left: `calc(${String(((side === "start" ? clamped.start : clamped.end) / duration) * 100)}% )` }
      },
        react.default.createElement("span", { className: "dca-trim-grip" }),
        react.default.createElement("span", { className: "dca-trim-tag" }, formatSeconds(side === "start" ? clamped.start : clamped.end)));

      return react.default.createElement("div", {
        className: leaving ? "dca-modal-layer dca-leaving" : "dca-modal-layer",
        "data-dsh-completion-alert": "trim"
      },
        react.default.createElement("div", { className: "dca-modal-mask", onClick: leave, "aria-hidden": "true" }),
        react.default.createElement("div", { className: "dca-modal dca-trim", role: "dialog", "aria-modal": "true", "aria-label": t("trim.title") },
          react.default.createElement("div", { className: "dca-modal-head" },
            react.default.createElement("div", { className: "dca-modal-title" }, t("trim.title")),
            react.default.createElement("button", {
              type: "button",
              className: "dca-icon",
              title: t("trim.cancel"),
              "aria-label": t("trim.cancel"),
              onClick: leave
            }, react.default.createElement("svg", { width: 12, height: 12, viewBox: "0 0 12 12", fill: "none", "aria-hidden": "true" },
              react.default.createElement("path", { d: "M2.5 2.5l7 7M9.5 2.5l-7 7", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round" })))),
          react.default.createElement("div", { className: "dca-modal-body" },
            react.default.createElement("div", { className: "dca-trim-wrap" },
              react.default.createElement("canvas", {
                ref: canvasRef,
                className: "dca-trim-canvas",
                onPointerDown: onDown,
                onPointerMove: onMove,
                onPointerUp: onUp,
                onPointerCancel: onUp
              }),
              react.default.createElement("div", {
                className: "dca-trim-shade",
                "data-side": "start",
                style: { width: `calc(${String((clamped.start / duration) * 100)}%)` }
              }),
              react.default.createElement("div", {
                className: "dca-trim-shade",
                "data-side": "end",
                style: { left: `calc(${String((clamped.end / duration) * 100)}%)`, right: 0 }
              }),
              handle("start"),
              handle("end")),
            react.default.createElement("div", { className: "dca-trim-meta" },
              react.default.createElement("span", null, t("trim.total", { total: formatSeconds(duration) })),
              react.default.createElement("span", null, t("trim.selected", { start: formatSeconds(clamped.start), end: formatSeconds(clamped.end), length: formatSeconds(clamped.duration) }))),
            react.default.createElement("div", { className: "dca-trim-hint" }, t("trim.hint")),
            react.default.createElement("label", { className: "dca-field" },
              react.default.createElement("span", { className: "dca-field-label" }, t("trim.name")),
              react.default.createElement("input", {
                type: "text",
                className: "dca-input",
                value: name,
                maxLength: 48,
                placeholder: t("trim.name.placeholder"),
                onChange: (event) => setName(event.target.value)
              })),
            react.default.createElement("div", { className: "dca-modal-foot dca-trim-actions" },
              react.default.createElement("button", {
                type: "button",
                className: "dca-btn",
                onClick: () => props.onPreview(clamped)
              }, t("trim.preview")),
              react.default.createElement("button", {
                type: "button",
                className: "dca-btn dca-btn-primary",
                disabled: props.busy === true,
                onClick: () => {
                  var chosen = name.trim() === "" ? props.name : name.trim();
                  leave();
                  props.onSave(clamped, chosen);
                }
              }, props.busy === true ? t("trim.saving") : t("trim.save"))))));
    }

    /**
     * Rename the custom tone.
     *
     * Small on purpose: one field, the same dialog chrome as the trim dialog, so
     * the two read as the same kind of surface.
     * @param props - `{ t, name, onCancel, onSave, busy }`.
     */
    function RenameDialog(props) {
      var t = props.t;
      var exit = useLeaving(props.onCancel);
      var leaving = exit.leaving;
      var leave = exit.leave;
      var nameState = react.default.useState(props.name ?? "");
      var name = nameState[0];
      var setName = nameState[1];
      var trimmed = name.trim();
      return react.default.createElement("div", {
        className: leaving ? "dca-modal-layer dca-leaving" : "dca-modal-layer",
        "data-dsh-completion-alert": "rename"
      },
        react.default.createElement("div", { className: "dca-modal-mask", onClick: leave, "aria-hidden": "true" }),
        react.default.createElement("div", { className: "dca-modal", role: "dialog", "aria-modal": "true", "aria-label": t("rename.title") },
          react.default.createElement("div", { className: "dca-modal-head" },
            react.default.createElement("div", { className: "dca-modal-title" }, t("rename.title")),
            react.default.createElement("button", {
              type: "button",
              className: "dca-icon",
              title: t("trim.cancel"),
              "aria-label": t("trim.cancel"),
              onClick: leave
            }, react.default.createElement("svg", { width: 12, height: 12, viewBox: "0 0 12 12", fill: "none", "aria-hidden": "true" },
              react.default.createElement("path", { d: "M2.5 2.5l7 7M9.5 2.5l-7 7", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round" })))),
          react.default.createElement("div", { className: "dca-modal-body" },
            react.default.createElement("label", { className: "dca-field" },
              react.default.createElement("span", { className: "dca-field-label" }, t("rename.field")),
              react.default.createElement("input", {
                type: "text",
                className: "dca-input",
                value: name,
                maxLength: 48,
                autoFocus: true,
                placeholder: t("trim.name.placeholder"),
                onChange: (event) => setName(event.target.value),
                onKeyDown: (event) => {
                  if (event.key === "Enter" && trimmed !== "") {
                    leave();
                    props.onSave(trimmed);
                  }
                }
              })),
            react.default.createElement("div", { className: "dca-modal-foot dca-trim-actions" },
              react.default.createElement("button", {
                type: "button",
                className: "dca-btn",
                onClick: leave
              }, t("trim.cancel")),
              react.default.createElement("button", {
                type: "button",
                className: "dca-btn dca-btn-primary",
                disabled: trimmed === "" || props.busy === true,
                onClick: () => {
                  leave();
                  props.onSave(trimmed);
                }
              }, t("rename.save"))))));
    }

    /**
     * The settings section: master switch, alert scope, sound, volume, and the
     * tone row with its library.
     * @param props - composed settings slot props (localized `t` included).
     */
    function CompletionAlertSection(props) {
      var t = typeof props.t === "function" ? props.t : (key) => key;
      var runtime = props.runtime;
      var settings = react.default.useSyncExternalStore(runtime.settings.subscribe, runtime.settings.getSnapshot, runtime.settings.getSnapshot);
      var notice = react.default.useSyncExternalStore(runtime.notice.subscribe, runtime.notice.getSnapshot, runtime.notice.getSnapshot);
      var fileRef = react.default.useRef(null);
      var libraryState = react.default.useState(false);
      var libraryOpen = libraryState[0];
      var setLibraryOpen = libraryState[1];
      var trimState = react.default.useState(null);
      var trim = trimState[0];
      var setTrim = trimState[1];
      /**
       * Which tone the rename dialog is open for: `null` when closed,
       * `CUSTOM_TONE_ID` for the legacy custom slot, `user:<id>` for a tone the
       * user added from their own file.
       */
      var renameState = react.default.useState(null);
      var renaming = renameState[0];
      var setRenaming = renameState[1];
      var busyState = react.default.useState(false);
      var busy = busyState[0];
      var setBusy = busyState[1];

      var update = (patch) => runtime.update(patch);
      var tones = runtime.tones;
      var currentId = settings.toneId;
      var currentTone = toneById(currentId);
      var usingCustom = currentId === CUSTOM_TONE_ID && settings.customData !== "";

      /** Play one library tone (or the saved custom one) without changing state. */
      var previewTone = (toneId, isCustom) => {
        runtime.alert.changed();
        runtime.alert.previewTone(isCustom ? CUSTOM_TONE_ID : toneId, null);
      };

      /** Step the switcher by one and preview what the arrows landed on. */
      var step = (delta) => {
        var list = tones;
        if (usingCustom) {
          // Custom sits after the built-ins: stepping on from it wraps to the first.
          var target = delta > 0 ? list[0].id : list[list.length - 1].id;
          update({ toneId: target });
          previewTone(target, false);
          return;
        }
        var index = list.findIndex((tone) => tone.id === currentId);
        if (index < 0) index = 0;
        var next = index + delta;
        if (next < 0) next = settings.customData === "" ? list.length - 1 : list.length;
        if (next > list.length) next = 0;
        if (next === list.length) {
          if (settings.customData === "") next = 0;
          else {
            update({ toneId: CUSTOM_TONE_ID });
            previewTone(CUSTOM_TONE_ID, true);
            return;
          }
        }
        var toneId = list[next].id;
        update({ toneId });
        previewTone(toneId, false);
      };

      /** Load a picked file, then open the trim dialog on it. */
      var onPickFile = (event) => {
        var file = event.target.files?.[0];
        if (file === void 0) return;
        setBusy(true);
        var reader = new FileReader();
        reader.onload = () => {
          var dataUrl = String(reader.result ?? "");
          if (dataUrl.length > MAX_SOUND_DATA_URL) {
            setBusy(false);
            runtime.notify("tooLarge");
            return;
          }
          if (!dataUrl.startsWith("data:audio/") && !dataUrl.startsWith("data:application/octet-stream")) {
            setBusy(false);
            runtime.notify("badType");
            return;
          }
          runtime.alert.changed();
          runtime.alert.decode(dataUrl).then((buffer) => {
            setBusy(false);
            if (buffer === null) {
              runtime.notify("decodeFailed");
              return;
            }
            setTrim({
              payload: dataUrl,
              name: file.name,
              buffer,
              peaks: peaksOf(buffer, 320),
              duration: buffer.duration
            });
          });
        };
        reader.onerror = () => {
          setBusy(false);
          runtime.notify("readFailed");
        };
        reader.readAsDataURL(file);
        event.target.value = "";
      };

      /** Re-open the trim dialog on the saved custom tone. */
      /**
       * Open the trim dialog on a tone that is already saved.
       *
       * `toneId` picks which one: the legacy custom slot by default, or one of the
       * tones the user added, which keeps its place in the library and only has
       * its slice replaced.
       */
      var retrim = (toneId) => {
        var target = toneId === void 0 || toneId === null ? CUSTOM_TONE_ID : toneId;
        var payload = target === CUSTOM_TONE_ID ? settings.customData : "";
        var name = target === CUSTOM_TONE_ID ? settings.customName : "";
        var saved = target === CUSTOM_TONE_ID ? settings.customRange : null;
        var mine = userToneById(settings.tones, target);
        if (mine !== null) {
          payload = mine.data;
          name = mine.label;
          saved = mine.range;
        }
        if (payload === "") return;
        setBusy(true);
        runtime.alert.changed();
        runtime.alert.decode(payload).then((buffer) => {
          setBusy(false);
          if (buffer === null) {
            runtime.notify("decodeFailed");
            return;
          }
          setTrim({
            toneId: target,
            payload,
            name,
            buffer,
            peaks: peaksOf(buffer, 320),
            duration: buffer.duration,
            initial: saved !== void 0 && saved !== null && saved.end > saved.start
              ? saved
              : { start: 0, end: buffer.duration }
          });
        });
      };

      /**
       * Encode the chosen slice and add it to the tone library.
       *
       * A confirmed clip becomes a tone of its own rather than taking over the
       * single legacy custom slot, so several clips live side by side. Re-trimming
       * one keeps its place and replaces only its slice.
       *
       * @param range - the slice to keep.
       * @param chosenName - the name from the dialog (already trimmed, may be "").
       */
      var saveTrim = (range, chosenName) => {
        setBusy(true);
        var dataUrl = encodeWav(trim.buffer, { start: range.start, duration: range.duration });
        if (dataUrl === "" || dataUrl.length > MAX_SOUND_DATA_URL) {
          setBusy(false);
          runtime.notify("tooLarge");
          return;
        }
        var label = chosenName === void 0 || chosenName === "" ? trim.name : chosenName;
        var next = planAddedTone(settings, trim.toneId ?? null, {
          id: newUserToneId(),
          label,
          data: dataUrl,
          range: { start: 0, end: range.duration }
        });
        update(next.patch);
        runtime.alert.changed();
        runtime.alert.previewTone(next.toneId, true);
        setBusy(false);
        setTrim(null);
        if (next.replaced) {
          runtime.notify("toneUpdated", { name: label });
          return;
        }
        if (chosenName !== void 0 && chosenName !== "" && chosenName !== trim.name) {
          runtime.notify("toneNamed", { name: label, length: formatSeconds(range.duration) });
        } else {
          runtime.notify("toneAdded", { name: label, length: formatSeconds(range.duration) });
        }
      };

      /** Rename the saved custom tone. */
      var renameCustom = (next) => {
        update({ customName: next });
        runtime.notify("customRenamed", { name: next });
      };

      /** Rename a tone the user added from their own file. */
      var renameUserTone = (toneId, next) => {
        update({
          tones: settings.tones.map((entry) => (entry.id === toneId
            ? { id: entry.id, label: next, data: entry.data, range: entry.range }
            : entry))
        });
        runtime.notify("toneRenamed", { name: next });
      };

      var persistence = react.default.useSyncExternalStore(
        runtime.persistence.subscribe,
        runtime.persistence.getSnapshot,
        runtime.persistence.getSnapshot
      );
      var inBackground = react.default.useSyncExternalStore(
        runtime.background.subscribe,
        runtime.background.getSnapshot,
        runtime.background.getSnapshot
      );

      var noteKey = notice.key;
      var noteText = noteKey === "" ? void 0 : t("note." + noteKey, notice.params ?? {});

      /** The name the rename dialog starts with, for whichever tone it targets. */
      var renameTargetName = renaming === null
        ? ""
        : renaming === CUSTOM_TONE_ID
          ? settings.customName
          : toneLabelFor(settings, renaming);
      /** Close the rename dialog without saving. */
      var cancelRename = () => setRenaming(null);
      /** Save the new name onto whichever tone the dialog was opened for. */
      var saveRename = (next) => {
        var target = renaming;
        setRenaming(null);
        if (target === CUSTOM_TONE_ID) renameCustom(next);
        else renameUserTone(target, next);
      };

      return react.default.createElement("div", { className: "dca-section", "data-dsh-completion-alert": "settings" },
        react.default.createElement("div", { className: "dca-heading" }, t("settings.title")),
        react.default.createElement("div", { className: "dca-intro" }, t("settings.intro")),

        react.default.createElement(Row, {
          title: t("row.enabled.title"),
          description: t("row.enabled.desc")
        }, react.default.createElement(Toggle, {
          checked: settings.enabled,
          label: t("row.enabled.title"),
          onChange: (next) => update({ enabled: next })
        })),

        react.default.createElement(Row, {
          title: t("row.scope.title"),
          description: t("row.scope.desc") + " " + t("row.scope.save", {
            state: persistence.mode === "host" && persistence.writable !== false
              ? t("save.on")
              : persistence.mode === "memory"
                ? t("save.readonly")
                : t("save.nowhere")
          })
        }, react.default.createElement(Segmented, {
          label: t("row.scope.title"),
          value: settings.alertScope,
          onChange: (next) => update({ alertScope: next }),
          options: [
            { value: "all", label: t("scope.all") },
            { value: "background", label: t("scope.background") }
          ]
        })),

        react.default.createElement(Row, {
          title: t("row.background.title"),
          description: t("row.background.desc", { state: inBackground ? t("background.yes") : t("background.no") })
        }, react.default.createElement(Toggle, {
          checked: settings.alertInBackground,
          disabled: settings.alertScope !== "background",
          label: t("row.background.title"),
          onChange: (next) => update({ alertInBackground: next })
        })),

        react.default.createElement(Row, {
          title: t("row.sound.title"),
          description: t("row.sound.desc")
        }, react.default.createElement(Toggle, {
          checked: settings.soundEnabled,
          label: t("row.sound.title"),
          onChange: (next) => {
            update({ soundEnabled: next });
            if (next) {
              runtime.alert.changed();
              runtime.alert.preview();
            }
          }
        })),

        react.default.createElement(Row, {
          title: t("row.volume.title"),
          description: t("row.volume.desc", { percent: String(Math.round(settings.volume * 100)) })
        }, react.default.createElement("input", {
          type: "range",
          min: 0,
          max: 100,
          step: 5,
          value: Math.round(settings.volume * 100),
          "aria-label": t("row.volume.title"),
          style: { width: 150, accentColor: "var(--dsw-alias-brand-primary)" },
          onChange: (event) => update({ volume: Number(event.target.value) / 100 })
        })),

        react.default.createElement(Row, {
          title: t("row.repeat.title"),
          description: t("row.repeat.desc")
        }, react.default.createElement(Segmented, {
          label: t("row.repeat.title"),
          value: String(settings.repeat),
          onChange: (next) => update({ repeat: Number(next) }),
          options: [1, 2, 3, 4].map((count) => ({ value: String(count), label: t("repeat.times", { count }) }))
        })),

        react.default.createElement(Row, {
          title: t("row.tone.title"),
          description: t("row.tone.desc")
        }, react.default.createElement(ToneSwitcher, {
          t,
          label: usingCustom ? t("library.custom") : currentTone?.label ?? t("tone.unknown"),
          hint: usingCustom ? (settings.customName === "" ? t("library.custom.hint") : settings.customName) : currentTone?.hint ?? "",
          onStep: step,
          onPreview: () => {
            runtime.alert.changed();
            runtime.alert.previewTone(usingCustom ? CUSTOM_TONE_ID : settings.toneId, null);
          },
          onOpenLibrary: () => setLibraryOpen(true)
        })),

        react.default.createElement("input", {
          ref: fileRef,
          type: "file",
          accept: "audio/*",
          style: { display: "none" },
          onChange: onPickFile
        }),

        noteText === void 0 ? null : react.default.createElement("div", { className: "dca-intro", role: "status" }, noteText),

        libraryOpen
          ? react.default.createElement(ToneLibraryPanel, {
            t,
            tones,
            current: currentId,
            userTones: settings.tones,
            hasCustom: settings.customData !== "",
            customName: settings.customName === "" ? t("library.custom.hint") : settings.customName,
            onClose: () => setLibraryOpen(false),
            onPreview: previewTone,
            onPick: (toneId) => {
              if (toneId === CUSTOM_TONE_ID) {
                if (settings.customData === "") fileRef.current?.click?.();
                else {
                  update({ toneId: CUSTOM_TONE_ID });
                  previewTone(CUSTOM_TONE_ID, true);
                  setLibraryOpen(false);
                }
                return;
              }
              // A tone the user added selects itself and closes the library: its
              // payload is already stored, so there is nothing to import.
              update({ toneId });
              previewTone(toneId, isUserToneId(toneId));
              if (isUserToneId(toneId)) setLibraryOpen(false);
            },
            onRetrim: retrim,
            onRename: () => setRenaming(CUSTOM_TONE_ID),
            onRenameTone: (toneId) => setRenaming(toneId),
            onRemoveTone: (toneId) => {
              var remaining = settings.tones.filter((entry) => entry.id !== toneId);
              var patch = { tones: remaining };
              // Removing the tone in use must not leave the plugin pointing at a
              // payload that is gone.
              if (settings.toneId === toneId) patch.toneId = DEFAULT_TONE_ID;
              update(patch);
              runtime.notify("toneRemoved", { name: toneLabelFor(settings, toneId) });
            }
          })
          : null,

        trim === null
          ? null
          : react.default.createElement(TrimDialog, {
            t,
            payload: trim.payload,
            name: trim.name,
            peaks: trim.peaks,
            duration: trim.duration,
            initial: trim.initial,
            busy,
            onPreview: (range) => {
              // Audition the *slice*, from the buffer the dialog already holds.
              // Going through the configured custom tone would read the payload
              // of the *saved* choice instead, which for a freshly picked file is
              // still empty - the reason this button used to do nothing.
              runtime.alert.changed();
              var slice = encodeWav(trim.buffer, { start: range.start, duration: range.duration });
              if (slice === "") {
                runtime.notify("previewFailed");
                return;
              }
              runtime.alert.previewDataUrl(slice, null);
            },
            onSave: saveTrim,
            onCancel: () => {
              setTrim(null);
              runtime.alert.stop();
            }
          }),

        // The rename dialog sits on top of the library, so closing it returns to
        // the same list at the same place. The id says which tone is being
        // renamed: "custom" for the legacy slot, a `user:` id for a tone the user
        // added from their own file.
        renaming === null ? null : react.default.createElement(RenameDialog, {
          t: t,
          name: renameTargetName,
          busy: busy,
          onCancel: cancelRename,
          onSave: saveRename
        }));
    }

    // ========================================================================
    // Style binding
    // ========================================================================

    /**
     * Bind this plugin's settings scope and expose it as a store. A client
     * without the service still gets a working alert; its choices then last only
     * for the life of the page.
     */
    function bindSettings(ctx) {
      var service = null;
      try {
        service = typeof ctx.get === "function" ? ctx.get("settingsScope") : ctx.settingsScope;
      } catch {
        service = null;
      }
      if (service === null || service === void 0 || typeof service.bind !== "function") return null;
      try {
        var scope = service.bind({ namespace: COMPLETION_ALERT_NS });
        return typeof scope?.subscribe === "function" && typeof scope?.getSnapshot === "function" ? scope : null;
      } catch (error) {
        ctx.logger?.warn?.(`completion-alert: settingsScope.bind failed (${error?.message ?? error})`);
        return null;
      }
    }

    /**
     * Write one settings patch. Prefers the scope's atomic `set`, then `mutate`,
     * then the older `write({ op, path, value })` shape — the three spellings
     * the shipped web plugin has had to tolerate.
     * @returns true when a writer accepted the patch.
     */
    /**
     * The settings form this plugin owns.
     *
     * `ctx.configForms.get(entryId)` is the client's settings transport: it
     * returns one controller per Host plugin entry, whose snapshot carries the
     * namespace document in `value` (`{ status, value, base, user, revision,
     * writable, mode }`). Its `set(field, value)` returns a **promise** for
     * whether the Host accepted the write.
     *
     * The older `settingsScope.bind({ namespace })` shape is still tried, so a
     * core that predates `configForms` keeps working; a core with neither leaves
     * the preferences in the window, which the settings page then reports.
     * @param ctx - the client plugin context.
     * @returns whichever form face this core offers, or null.
     */
    function obtainSettingsForm(ctx) {
      try {
        var forms = ctx.get ? ctx.get("configForms") : void 0;
        if (forms !== void 0 && forms !== null && typeof forms.get === "function") {
          var form = forms.get(COMPLETION_ALERT_NS);
          if (form !== void 0 && form !== null && typeof form.getSnapshot === "function") return form;
        }
      } catch (error) {
        report("configForms.get refused (" + String(error?.message ?? error) + ")");
      }
      try {
        var legacy = ctx.get ? ctx.get("settingsScope") : void 0;
        if (legacy !== void 0 && legacy !== null && typeof legacy.bind === "function") {
          var bound = legacy.bind({ namespace: COMPLETION_ALERT_NS });
          if (bound !== void 0 && bound !== null) return bound;
        }
      } catch (error) {
        report("settingsScope.bind refused (" + String(error?.message ?? error) + ")");
      }
      return null;
    }

    /**
     * The stored document inside whatever shape the form reports.
     *
     * A form snapshot is `{ status, value, ... }` and only becomes meaningful at
     * `status: "ready"`; a legacy scope reports the document directly. Reading a
     * form before it has loaded would look exactly like "the user chose the
     * defaults", and would overwrite the Host's document with them.
     * @param scope - the form or scope.
     * @returns the document, or null when there is nothing trustworthy yet.
     */
    function readSettingsDocument(scope) {
      if (scope === null || scope === void 0 || typeof scope.getSnapshot !== "function") return null;
      var snapshot;
      try {
        snapshot = scope.getSnapshot();
      } catch {
        return null;
      }
      if (snapshot === null || typeof snapshot !== "object") return null;
      if (snapshot.status === "loading") return null;
      if (snapshot.status === "unavailable") return null;
      if (typeof snapshot.value === "object" && snapshot.value !== null) return snapshot.value;
      // A legacy scope with no `value` wrapper is the document itself.
      if (snapshot.status === void 0) return snapshot;
      return null;
    }

    /**
     * Write fields through the form, whichever shape it has.
     *
     * `configForms` answers asynchronously, so the result is always a promise: a
     * refused write has to be reported after it settles, not optimistically.
     * @param scope - the form or scope.
     * @param patch - field -> value.
     * @returns a promise for whether every write was accepted.
     */
    function writeSettings(scope, patch) {
      if (scope === null) return Promise.resolve(false);
      var fields = Object.keys(patch);
      if (fields.length === 0) return Promise.resolve(true);
      try {
        if (typeof scope.set === "function") {
          // Every field through the same entry point; `configForms` queues and
          // orders them for us, so no explicit mutate() is needed.
          var results = fields.map((field) => scope.set(field, patch[field]));
          return Promise.all(results.map((result) => Promise.resolve(result)))
            .then((accepted) => accepted.every((value) => value !== false))
            .catch(() => false);
        }
        if (typeof scope.mutate === "function") {
          var mutated = scope.mutate(fields.map((field) => ({ op: "set", path: [field], value: patch[field] })));
          return Promise.resolve(mutated).then((value) => value !== false).catch(() => false);
        }
        if (typeof scope.write === "function") {
          for (var field of fields) scope.write({ op: "set", path: [field], value: patch[field] });
          return Promise.resolve(true);
        }
      } catch {
        return Promise.resolve(false);
      }
      return Promise.resolve(false);
    }

    // ========================================================================
    // Plugin body
    // ========================================================================

    /**
     * Nothing is hard-required. The desktop shell aborts its whole boot when one
     * client entry stays pending, so every service is either read optionally or
     * waited for inside a `ctx.inject`/`whenReady` sub-fiber: a composition that
     * lacks one costs this plugin that one surface, never the browser half.
     */
    var inject = [];

    /** Run `callback` once every named service is available (never holds the entry pending). */
    function whenReady(ctx, deps, callback) {
      try {
        if (typeof ctx.inject === "function") {
          ctx.inject(deps, callback);
          return;
        }
      } catch {
        // No waiting facility: fall through and try right now.
      }
      try {
        callback(ctx);
      } catch (error) {
        ctx.logger?.warn?.(`completion-alert: ${deps.join("/")} unavailable (${error?.message ?? error})`);
      }
    }

    /** Read one client service without requiring it. */
    function optionalService(ctx, name) {
      try {
        var value = typeof ctx.get === "function" ? ctx.get(name) : ctx[name];
        return value === void 0 || value === null ? null : value;
      } catch {
        return null;
      }
    }

    /** Register one slot, tolerating a client surface that renamed or dropped it. */
    function registerSlot(ctx, name, options, Component) {
      try {
        ctx.slots.inject(name, () => ctx.slots.register(options, Component));
        return true;
      } catch (error) {
        ctx.logger?.warn?.(`completion-alert: slot ${name} is unavailable (${error?.message ?? error})`);
        return false;
      }
    }

    /** The window's dark-mode state, as a store (the overlay card follows the skin). */
    function createDarkStore() {
      var store = createStore(false);
      try {
        var media = globalThis.matchMedia?.("(prefers-color-scheme: dark)");
        if (media !== null && media !== void 0) {
          store.set(media.matches === true);
          media.addEventListener?.("change", (event) => store.set(event.matches === true));
        }
      } catch {
        // No matchMedia: the light surface is used.
      }
      return store;
    }

    function apply(ctx) {
      var report = (message) => ctx.logger?.warn?.("completion-alert: " + message);
      var styleTag = injectStyles();
      ctx.effect(() => () => {
        try {
          styleTag?.remove?.();
        } catch {
          // Nothing to remove.
        }
      }, "completion-alert: stylesheet");

      // ---- state that exists before any service does ------------------------
      var toasts = createToastStore();
      var notice = createStore({ key: "", params: void 0 });
      var surface = createStore(detectSurfaces(globalThis.document));
      var dark = createDarkStore();
      var audioNeedsGesture = createStore(false);
      var alert = createAlert({ report });
      var settingsScope = null;
      /**
       * True while the plugin's own store, rather than the settings transport,
       * owns the document.
       *
       * The transport is not a usable store on this core: it reports
       * `mode: "host", writable: true` and then answers every write with `false`,
       * so anything it hands back is the shipped default rather than the user's
       * choice. Once the store has a document, the transport stops steering.
       */
      var storeAuthoritative = false;
      var settingsStore = createStore(normalizeSettings(null));
      var writeTimer = null;
      var pendingPatch = {};
      /** True once a settings write has been attempted and refused. */
      var writeRefused = false;
      /** Set by the facade whenever a tone could not start for a browser reason. */
      var awaitingGesture = false;
      /**
       * Resolves once the store has been consulted.
       *
       * A write issued before that happens would send the shipped defaults over a
       * stored document - the one mistake this must never make. Writes wait for
       * this instead of racing it, and a store that never answers (an old Host
       * without the route) still releases the writes after a short grace.
       */
      var storeReady = null;
      /** True once the store has answered, one way or another. */
      var storeReadySettled = false;

      /**
       * Release the pending settings writes.
       *
       * Called when the store answers, and on a short timer when it never does, so
       * a Host without the settings route still saves through the transport.
       */
      function markStoreReady() {
        if (storeReadySettled) return;
        storeReadySettled = true;
        var held = pendingPatch;
        pendingPatch = {};
        if (Object.keys(held).length === 0) return;
        pendingPatch = held;
        if (writeTimer !== null) clearTimeout(writeTimer);
        writeTimer = setTimeout(flushSettings, 0);
      }
      storeReady = markStoreReady;
      setTimeout(markStoreReady, 1200);

      /** Push the whole effective settings document to the host, debounced. */
      function flushSettings() {
        writeTimer = null;
        var patch = pendingPatch;
        pendingPatch = {};
        var fields = Object.keys(patch);
        if (fields.length === 0) return;
        if (storeReady !== null && !storeReadySettled) {
          pendingPatch = Object.assign({}, patch, pendingPatch);
          return;
        }
        // `settingsScope` absence is a silent no-op today, which is exactly how a
        // choice can look saved and come back as a default later.
        // The write answers asynchronously; report the outcome when it settles so
        // "the choice reverts after a restart" can be told apart from "the host
        // refused it".
        return writeSettings(settingsScope, patch).then((accepted) => {
          reportDiagnostics({
            settingsWrite: {
              fields: fields.join(","),
              accepted,
              how: settingsScope === null ? "no-form" : typeof settingsScope.set === "function" ? "set" : "other",
              // A refused write is either a read-only deployment or a revision
              // clash; these two say which.
              mode: persistenceStore.getSnapshot().mode,
              writable: persistenceStore.getSnapshot().writable,
              formStatus: (() => {
                try {
                  return settingsScope?.getSnapshot?.()?.status ?? "";
                } catch {
                  return "";
                }
              })()
            }
          });
          if (!accepted) {
            writeRefused = true;
            report("settings write refused; the choice stays in this window");
            // The transport refusing is not the end of the story: this plugin's
            // own host route still stores the document, so the choice survives
            // the window either way. Without this, a memory-persistence page
            // (measured: every write refused) lost every preference.
            var fallback = hostSettings();
            if (fallback !== null) {
              fallback.write(settingsStore.getSnapshot()).then((stored) => {
                reportDiagnostics({ settingsFallback: { stored, fields: fields.join(",") } });
              });
            }
          }
          return accepted;
        });
      }

      /** Apply a patch locally, refresh the player, and persist it. */
      function update(patch) {
        var next = sanitizeSettings({ ...settingsStore.getSnapshot(), ...patch });
        settingsStore.set(next);
        alert.configure(next);
        for (var key of Object.keys(patch)) localPicks.add(key);
        pendingPatch = { ...pendingPatch, ...patch };
        if (writeTimer !== null) clearTimeout(writeTimer);
        writeTimer = setTimeout(flushSettings, 350);
      }

      /**
       * Re-attempt one field the Host has not accepted yet.
       *
       * A refusal can be transient (a revision clash, a busy editor), and a
       * choice the user made should not need a second click. The retry is bounded
       * to one per field per refusal, so a Host that genuinely rejects a field
       * does not get hammered.
       */
      var restoreAttempted = new Set();
      function queueRestore(field, value) {
        // Once per value: a refusal that repeats must not turn into a retry loop
        // that also keeps the page's timers alive forever.
        var key = field + "=" + JSON.stringify(value);
        if (restoreAttempted.has(key)) return;
        restoreAttempted.add(key);
        if (restoreAttempted.size > 32) restoreAttempted.clear();
        setTimeout(() => {
          if (settingsStore.getSnapshot()[field] !== value) return;
          writeSettings(settingsScope, { [field]: value }).then((accepted) => {
            if (accepted) reportDiagnostics({ settingsRetry: { field, accepted } });
          });
        }, 900);
      }

      /** Publish the runtime's own one-line status note under the settings rows. */
      function notify(key, params) {
        notice.set({ key, params });
        setTimeout(() => {
          if (notice.getSnapshot().key === key) notice.set({ key: "", params: void 0 });
        }, 3200);
      }

      /**
       * The player face the runtime and the settings rows share.
       *
       * Every entry point the settings UI calls has to exist here: the tone
       * switcher's arrows, the library rows and the trim dialog all reach the
       * player through this object, so a missing method is a dead button rather
       * than an error anyone sees.
       *
       * It also owns the autoplay-unlock hint: Chromium refuses to start an
       * AudioContext before the page has seen a gesture, so an alert that could
       * not start is reported instead of silently vanishing.
       */
      var alertFacade = {
        /** Shared wrapper: run one player call and fold its outcome into the hint. */
        run(call) {
          var accepted = call();
          var state = alert.state();
          var silent = !accepted || state.failure === "awaiting-gesture" || state.failure === "no-audio-context";
          if (silent) {
            awaitingGesture = true;
            audioNeedsGesture.set(true);
            report("audio: " + (state.failure === "" ? "the tone did not start" : state.failure));
          } else {
            awaitingGesture = false;
            audioNeedsGesture.set(false);
          }
          return accepted;
        },
        play() {
          return alertFacade.run(() => alert.play());
        },
        preview() {
          return alertFacade.run(() => alert.preview());
        },
        /** Play one named tone (the arrows and the library rows). */
        previewTone(toneId, range) {
          return alertFacade.run(() => alert.previewTone(toneId, range ?? null));
        },
        /** Play one explicit payload slice (the trim dialog's audition). */
        previewDataUrl(url, range) {
          return alertFacade.run(() => alert.previewDataUrl(url, range ?? null));
        },
        /** Decode a payload for the trim dialog's waveform. */
        decode(url) {
          return alert.decode(url);
        },
        stop: () => alert.stop(),
        invalidate: () => alert.invalidate(),
        /** Re-read the live settings before a preview or a tone. */
        changed() {
          alert.configure(settingsStore.getSnapshot());
        },
        state: () => alert.state(),
        needsGesture: () => awaitingGesture,
        /** The reason the last attempt stayed silent ("" = it played). */
        failure: () => alert.state().failure
      };

      /** How preferences are being kept, for the settings page to show. */
      var persistenceStore = createStore({ mode: "none" });
      /**
       * Fields the user just changed, until the stored document agrees with them.
       *
       * A refused or in-flight write makes the form re-read the Host document, and
       * that older document must not overwrite a choice the user already made -
       * otherwise picking a tone (or a scope) visibly snaps back to the previous
       * value. A field leaves this set as soon as the document matches it, so a
       * change made in another window is followed again.
       */
      var localPicks = new Set();

            /**
       * Adopt the settings form: seed the store from the Host document, then
       * follow every later revision.
       *
       * A form starts at `status: "loading"`, so the first read is deliberately
       * skipped until it is ready — writing defaults over the stored document is
       * the one mistake this must not make.
       */
      function attachScope(scope) {
        settingsScope = scope;
        // This plugin's own store is the authoritative document.
        //
        // The settings transport reports `mode: "host", writable: true` and then
        // refuses every write (measured: `accepted: false` on every field), so its
        // writable flag cannot be trusted as "the preferences are being kept".
        // The store is therefore always consulted, and the form is only used to
        // seed a document that does not exist yet - never to overwrite one that
        // does.
        var ownStore = hostSettings();
        if (ownStore === null) {
          // No store route on this Host: the transport is the only path, which is
          // how this plugin worked before it kept its own document.
          storeAuthoritative = false;
          markStoreReady();
        } else {
          ownStore.read().then((payload) => {
            var stored = payload?.settings;
            if (stored === null || typeof stored !== "object") {
              report("nothing stored yet; the transport's document seeds the store");
              return;
            }
            var restored = normalizeSettings(stored);
            storeAuthoritative = true;
            settingsStore.set(restored);
            alert.configure(restored);
            alert.invalidate();
            reportDiagnostics({ settingsFromHostStore: true, fields: Object.keys(stored).join(",") });
          }).then(markStoreReady, markStoreReady);
        }
        // Say plainly whether a write can land. Without a settings form the page
        // still works, but every choice dies with the window - which is exactly
        // the "it did not save" report this exists to prevent.
        try {
          var initial = scope.getSnapshot();
          persistenceStore.set({
            mode: initial?.mode === "memory" ? "memory" : "host",
            writable: initial?.writable !== false
          });
        } catch {
          persistenceStore.set({ mode: "unknown" });
        }
        var sync = () => {
          // Once this plugin's own store has supplied the document, the transport
          // must not steer anything: it is the component that answers every write
          // with `false`, so its copy of the values is the one that goes stale
          // (measured: it reported `mode: "host", writable: true` while refusing
          // every field). Skip its snaps, and keep its subscription so that a
          // future core which really does persist can take over again once the
          // store is empty.
          if (storeAuthoritative) return;
          var document = readSettingsDocument(scope);
          if (document === null) return;
          var next = normalizeSettings(document);
          var previous = settingsStore.getSnapshot();
          var same = true;
          for (var key of Object.keys(DEFAULT_SETTINGS)) {
            var stored = JSON.stringify(previous[key]);
            var incoming = JSON.stringify(next[key]);
            if (stored === incoming) {
              // The document caught up with this field, so it stops being a local
              // pick: from here on, other windows steer it again.
              if (localPicks.has(key)) localPicks.delete(key);
              continue;
            }
            if (localPicks.has(key)) {
              // The user's choice is newer than the document. Keep it, and give
              // the write another chance once the transport settles.
              next[key] = previous[key];
              queueRestore(key, previous[key]);
              continue;
            }
            same = false;
          }
          if (same) return;
          settingsStore.set(next);
          alert.configure(next);
          if (previous.customData !== next.customData) alert.invalidate();
          else if (previous.toneId !== next.toneId) alert.configure(next);
        };
        sync();
        try {
          scope.subscribe(sync);
        } catch {
          // A form without a subscription keeps the initial read only.
        }
        reportDiagnostics({ settingsForm: true });
      }

      // A client without the settings service still gets a working alert: the
      // choices then last for the life of the page.
      // Two independent waits, not one list: a combined wait only fires when
      // EVERY listed service exists, so naming the legacy service alongside
      // `configForms` silently skipped the modern one on every core that has it.
      whenReady(ctx, ["configForms"], (scope) => {
        try {
          var forms = scope.configForms;
          var form = forms !== void 0 && forms !== null && typeof forms.get === "function"
            ? forms.get(COMPLETION_ALERT_NS)
            : null;
          if (form === null || form === void 0) {
            report("configForms.get returned nothing; using this plugin's own store");
            var ownStore = hostSettings();
            if (ownStore === null) {
              markStoreReady();
              return;
            }
            ownStore.read().then((payload) => {
              if (payload?.settings === null || typeof payload?.settings !== "object") return;
              var restored = normalizeSettings(payload.settings);
              storeAuthoritative = true;
              settingsStore.set(restored);
              alert.configure(restored);
              alert.invalidate();
              reportDiagnostics({ settingsFromHostStore: true, fields: Object.keys(restored).join(",") });
            }).then(markStoreReady, markStoreReady);
            return;
          }
          attachScope(form);
        } catch (error) {
          report("configForms binding failed (" + String(error?.message ?? error) + ")");
        }
      });
      // Older cores: the plugin's own scope binding, only when configForms is
      // absent, so a core that has both never double-subscribes.
      whenReady(ctx, ["settingsScope"], (scope) => {
        if (settingsScope !== null) return;
        try {
          var legacy = typeof scope.settingsScope?.bind === "function"
            ? scope.settingsScope.bind({ namespace: COMPLETION_ALERT_NS })
            : null;
          if (legacy === null || legacy === void 0) {
            report("settingsScope.bind is unavailable; preferences stay in this window");
            return;
          }
          attachScope(legacy);
        } catch (error) {
          report("settingsScope binding failed (" + String(error?.message ?? error) + ")");
        }
      });

      // ---- the runtime: one watcher, one overlay, one settings page --------
      whenReady(ctx, ["uiSession", "sessions", "slots"], (scope) => {
        var sessionsService = optionalService(scope, "sessions");
        var uiSession = optionalService(scope, "uiSession");
        var uiWorkspace = optionalService(scope, "uiWorkspace");
        var status = uiSession?.sessionStatus ?? null;

        /** Session row (title) for one id. */
        var rowOf = (sessionId) => {
          try {
            return sessionsService?.list?.getSnapshot()?.byId?.[sessionId] ?? null;
          } catch {
            return null;
          }
        };
        var mainId = () => {
          try {
            return resolveMainSessionId(sessionsService?.list?.getSnapshot());
          } catch {
            return void 0;
          }
        };
        var openSession = (sessionId) => {
          if (uiWorkspace === null || typeof uiWorkspace.openSession !== "function") {
            report("uiWorkspace.openSession is unavailable; the notice cannot navigate");
            return false;
          }
          uiWorkspace.openSession(sessionId);
          return true;
        };

        var backgroundStore = createBackgroundWatcher();
        var watcher = createCompletionWatcher({
          status,
          mainId,
          isBackground: backgroundStore.getSnapshot,
          /** Ask the host how the turn ended; null when it cannot say. */
          outcome: (sessionId) => turnOutcome(scope, sessionId),
          onComplete: (completion) => {
            var settings = settingsStore.getSnapshot();
            if (!settings.enabled) return;
            // A round the user stopped by hand is not a completion. The host
            // answers with the agent's own turn/end reason; when it has nothing
            // to say (older host, or a turn that predates the plugin) the
            // setting decides whether to announce anyway.
            // Only an outcome the Host positively reports as a completion is
            // announced. A hand-stopped round and an unknown outcome both stay
            // quiet: firing a tone the user did not ask for is the reported bug,
            // and "unknown" is exactly the case a stop can hide in.
            var outcome = completion.outcome;
            var announced = outcome === "completed" || outcome === "blocked" || outcome === "max-tokens";
            reportDiagnostics({
              round: {
                sessionId: completion.sessionId,
                outcome: outcome === null || outcome === void 0 ? "unknown" : outcome,
                isMain: completion.isMain === true,
                background: completion.background === true,
                enabled: settings.enabled,
                scope: settings.alertScope,
                sound: settings.soundEnabled,
                toneId: settings.toneId,
                repeat: settings.repeat,
                announced,
                // What the player itself will use: the store and the alert keep
                // their own copies, and "the UI says two" is not the same as
                // "the player was told two".
                playerRepeat: alert.state().repeat
              }
            });
            if (!announced) {
              report("skipped a round whose outcome was " + (outcome === null || outcome === void 0 ? "unknown" : outcome));
              return;
            }
            // Backgrounded app: nothing is really on screen, so the scope choice
            // stops applying and every finished round is announced.
            var inBackground = backgroundStore.getSnapshot();
            var scopeQuiet = settings.alertScope === "background" && completion.isMain;
            if (scopeQuiet && !(settings.alertInBackground && inBackground)) return;
            var row = rowOf(completion.sessionId);
            toasts.push({
              sessionId: completion.sessionId,
              title: sessionLabel(row),
              detail: completionText(sessionLabel(row), completion.seconds),
              at: Date.now()
            });
            var played = alertFacade.play();
            var player = alert.state();
            reportDiagnostics({
              tone: {
                played: played === true,
                context: player.context,
                failure: player.failure,
                toneId: player.tone,
                volume: player.volume
              }
            });
          }
        });
        var stopWatcher = watcher.start();
        ctx.effect(() => () => {
          try {
            stopWatcher?.();
          } catch {
            // Already released.
          }
          alert.stop();
        }, "completion-alert: watcher");

        // The overlay entry: the notice layer above the bottom-right corner.
        var toastsMounted = registerSlot(scope, "shell.overlay", {
          name: "shell.overlay",
          id: "completion-alert-toasts",
          order: 40,
          locale: COMPLETION_ALERT_NS,
          inject: () => ({ store: toasts, surface, dark, audioNeedsGesture, openSession })
        }, ToastHost);

        // The settings section, shown as its own page in the settings dialog.
        var mounted = registerSlot(scope, "settings.section", {
          name: "settings.section",
          id: "completion-alert",
          order: 40,
          label: () => "工作完成提示",
          locale: COMPLETION_ALERT_NS,
          inject: () => ({
            runtime: {
              settings: settingsStore,
              background: backgroundStore,
              persistence: persistenceStore,
              notice,
              update,
              notify,
              tones: toneOptions(),
              alert: alertFacade
            }
          })
        }, CompletionAlertSection);
        if (!mounted) {
          // Older shells may not carry settings.section; the general list is the fallback.
          registerSlot(scope, "settings.plugin.item", {
            name: "settings.plugin.item",
            id: "completion-alert-fallback",
            key: "completion-alert",
            order: 40,
            locale: COMPLETION_ALERT_NS,
            inject: () => ({ runtime: {
              settings: settingsStore,
              background: backgroundStore,
              persistence: persistenceStore,
              notice,
              update,
              notify,
              tones: toneOptions(),
              alert: alertFacade
            } })
          }, CompletionAlertSection);
        }

        reportDiagnostics({
          watcher: status !== null,
          overlay: toastsMounted,
          settings: settingsScope !== null,
          mainId: mainId() ?? null
        });
      });

      // Dictionaries wait for the locale service; the surfaces wait for slots.
      whenReady(ctx, ["locale"], (scope) => {
        try {
          scope.effect(() => scope.locale.register(COMPLETION_ALERT_NS, { zh, en }), "completion-alert: dictionaries");
        } catch (error) {
          report("locale registration failed (" + String(error?.message ?? error) + ")");
        }
      });
    }

    /** Hand one activation report to the host's diagnostics route (best effort). */
    function reportDiagnostics(facts) {
      try {
        var fetchFn = globalThis.fetch;
        if (typeof fetchFn !== "function") return;
        var body = JSON.stringify({
          at: Date.now(),
          facts,
          ua: globalThis.navigator?.userAgent ?? ""
        });
        try {
          fetchFn("/api/completion-alert.diag", {
            method: "POST",
            credentials: "same-origin",
            headers: { "content-type": "application/json" },
            body
          }).catch(() => {});
        } catch {
          // The Host route is the feature; the mirror below is diagnosis only.
        }
      } catch {
        // Diagnostics are optional.
      }
    }

    /**
     * Ask the host how one session's newest turn ended.
     *
     * Returns a reason kind (`completed`, `aborted`, `interrupted`, …) or null
     * when the answer is unavailable — no route, a host that never saw the turn,
     * or a deadline. Null means "unknown", and the caller decides what to do with
     * an unknown; it never fails the alert.
     *
     * Results are cached briefly: one status snapshot can report several sessions
     * finished at once, and a completion is announced at most once per turn.
     * @param scope - the plugin's client scope (for `connection.fetch`).
     * @param sessionId - the session whose turn just ended.
     * @returns a promise for the reason kind, or null.
     */
    function turnOutcome(scope, sessionId) {
      if (typeof sessionId !== "string" || sessionId === "") return Promise.resolve(null);
      var cached = outcomeCache.get(sessionId);
      var now = Date.now();
      // Only a positive answer is worth reusing: "unknown" is retried, because
      // the Host may simply not have recorded the turn yet.
      if (cached !== void 0 && cached.kind !== null && now - cached.at < OUTCOME_TTL_MS) {
        return Promise.resolve(cached.kind);
      }

      /**
       * One lookup.
       *
       * The status projection this watcher reads flips to idle *before* the Host
       * has appended the durable `turn/end` event, so the first question is
       * routinely answered "unknown" for a round that finished normally -
       * measured at about 100 ms. Retrying a few times closes that window
       * without ever treating an unknown as a completion.
       */
      var attempt = (triesLeft) => {
        var fetchFn = globalThis.fetch;
        if (typeof fetchFn !== "function") return Promise.resolve(null);
        var deadline = new Promise((resolve) => {
          globalThis.setTimeout(() => resolve(null), OUTCOME_TIMEOUT_MS);
        });
        var url = TURN_OUTCOME_PATH + "?sessionId=" + encodeURIComponent(sessionId);
        var request = fetchFn(url, {
          method: "GET",
          credentials: "same-origin"
        }).then((response) => {
          return response?.ok === true ? response.json() : null;
        })
          .then((payload) => (typeof payload?.kind === "string" && payload.kind !== "" ? payload.kind : null))
          .catch(() => null);
        return Promise.race([request, deadline]).then((kind) => {
          if (kind !== null || triesLeft <= 0) {
            outcomeCache.set(sessionId, { kind, at: Date.now() });
            return kind;
          }
          return new Promise((resolve) => {
            globalThis.setTimeout(() => resolve(attempt(triesLeft - 1)), OUTCOME_RETRY_MS);
          });
        });
      };
      return attempt(OUTCOME_TRIES);
    }

    /**
     * This plugin's own preferences store, served by its host half.
     *
     * The client settings transport answers `false` to every write when its
     * persistence is memory (a non-loopback page), which is what the desktop app
     * reported for every field. This route is the fallback that still survives a
     * restart, and `attachScope` prefers it whenever the transport cannot write.
     */
    function hostSettings() {
      var fetchFn = globalThis.fetch;
      if (typeof fetchFn !== "function") return null;
      return {
        read() {
          return fetchFn(SETTINGS_PATH, { method: "GET", credentials: "same-origin" })
            .then((response) => (response?.ok === true ? response.json() : null))
            .catch(() => null);
        },
        write(document) {
          return fetchFn(SETTINGS_PATH, {
            method: "POST",
            credentials: "same-origin",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ settings: document })
          }).then((response) => (response?.ok === true ? response.json() : null))
            .then((payload) => payload?.ok === true)
            .catch(() => false);
        }
      };
    }

    /** sessionId -> { kind, at }, so one status snapshot costs one request. */
    var outcomeCache = new Map();

    // ========================================================================
    // Is the window in the background?
    // ========================================================================

    /**
     * Track whether the dsh window is in the background.
     *
     * Why this exists: "sessions I am not looking at" and "the app is not in
     * front of me" are different questions. With the window minimised or behind
     * another app, whatever session was on screen is no longer being watched, so
     * the plugin should speak up for it too - which is what the settings page
     * offers as an option under the alert scope.
     *
     * Page Visibility is the primary signal (`document.visibilityState`), which
     * is exactly "the window is hidden or minimised". Focus is the fallback for
     * a shell that does not report visibility: a window without focus is behind
     * something else. When neither is readable the answer stays false, so the
     * strictest reading wins and no extra tone plays.
     *
     * @returns a store: `getSnapshot()` is the current answer, `subscribe()`
     * notifies on change, and `refresh()` re-reads (the tests drive it that way).
     */
    function createBackgroundWatcher() {
      var listeners = new Set();
      var background = false;

      /** Read the environment once; null when it says nothing either way. */
      function read() {
        try {
          var visibility = globalThis.document?.visibilityState;
          if (visibility === "hidden") return true;
          if (visibility === "visible") return false;
          var focused = globalThis.document?.hasFocus;
          if (typeof focused === "function") return focused.call(globalThis.document) !== true;
        } catch {
          // A shell without a readable document counts as foreground.
        }
        return null;
      }

      function publish() {
        var next = read();
        if (next === null || next === background) return;
        background = next;
        for (var listener of [...listeners]) {
          try {
            listener();
          } catch {
            // One bad subscriber must not stop the others.
          }
        }
      }

      var bound = false;
      /** Bind once, so a plugin that never asks stays inert. */
      function bind() {
        if (bound) return;
        bound = true;
        background = read() === true;
        try {
          globalThis.document?.addEventListener?.("visibilitychange", publish);
          globalThis.addEventListener?.("focus", publish);
          globalThis.addEventListener?.("blur", publish);
        } catch {
          // A shell that refuses listeners keeps the initial read only.
        }
      }

      bind();
      return {
        getSnapshot: () => background,
        subscribe(listener) {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        refresh: publish
      };
    }

    // ========================================================================
    // Dictionaries
    // ========================================================================

    var zh = {
      "card.open": "点击查看该会话",
      "card.dismiss": "关闭这条提示",
      "card.arm": "点击窗口任意位置即可开启提示音",
      "settings.title": "工作完成提示",
      "settings.intro": "一轮工作结束时播放提示音，并在右下角弹出可以点击跳转的通知。",
      "row.enabled.title": "启用工作完成提示",
      "row.enabled.desc": "关闭后既不出声也不弹通知。",
      "row.scope.title": "提示范围",
      "row.scope.desc": "全部会话：任何一个会话完成都提示；仅后台会话：当前正在看的会话完成后不打扰。",
      "row.background.title": "Announce everything while backgrounded",
      "row.background.desc": "When the app is hidden or minimised, any session finishing alerts you, bypassing the scope above. Now: {state}.",
      "background.yes": "in the background",
      "background.no": "window is in front",
      "row.stop.title": "Announce stopped rounds too",
      "row.stop.desc": "When off, a round you ended with Stop raises no notice and no tone; only rounds that finish on their own are announced.",
      "row.background.title": "后台时全部提示",
      "row.background.desc": "应用被切到后台或最小化时，任何一个会话完成都提示，不再区分「仅后台会话」。当前状态：{state}。",
      "background.yes": "已在后台",
      "background.no": "窗口在前台",
      "row.stop.title": "手动停止也提示",
      "row.stop.desc": "关闭后，自己点「停止」结束的一轮不弹通知也不出声（只有正常完成才提示）。",
      "save.on": "偏好会保存在这个 profile 里",
      "save.readonly": "设置存储为只读，改动只在这台窗口内有效",
      "save.nowhere": "这台设备没提供设置存储，改动只在当前窗口内有效",
      "scope.all": "全部会话",
      "scope.background": "仅后台会话",
      "row.sound.title": "播放提示音",
      "row.sound.desc": "只关掉声音，右下角通知照常弹出。",
      "row.volume.title": "音量",
      "row.volume.desc": "当前 {percent}%，预览与正式提示音同时生效。",
      "row.repeat.title": "重复次数",
      "row.repeat.desc": "每次提示把这个音效连播几遍（1～4 遍）。",
      "repeat.times": "{count} 遍",
      "trim.name": "给这段音频起个名字",
      "trim.name.placeholder": "例如：我的短信音",
      "rename.title": "重命名音效",
      "rename.field": "音效名称",
      "rename.save": "保存名称",
      "library.custom.rename": "重命名这个音效",
      "note.customNamed": "已保存并命名为「{name}」。",
      "note.toneAdded": "已加入全部音效：「{name}」（{length}）。",
      "note.toneNamed": "已加入全部音效并命名为「{name}」（{length}）。",
      "note.toneRenamed": "已重命名为「{name}」。",
      "note.toneUpdated": "已重新裁切「{name}」。",
      "note.toneRemoved": "已从全部音效中移除「{name}」。",
      "note.customRenamed": "已重命名为「{name}」。",
      "row.tone.title": "提示音",
      "row.tone.desc": "用左右箭头切换（切换后立即试听），点右侧下拉箭头打开全部音效。",
      "tone.prev": "上一个提示音",
      "tone.next": "下一个提示音",
      "tone.library": "打开全部音效",
      "tone.unknown": "未知音效",
      "library.title": "全部音效",
      "library.close": "关闭",
      "library.preview": "试听这个音效",
      "library.hint": "点音效名字即选用；左边的播放键只试听，不改变当前选择。",
      "library.custom": "添加音效（选择文件）",
      "library.custom.hint": "选一个本地音频文件，裁切后加入上面的列表",
      "library.mine.hint": "本机添加的音效",
      "library.mine.remove": "从列表中移除这个音效",
      "library.custom.retrim": "重新裁切这段音频",
      "sound.custom.unnamed": "未命名音频",
      "trim.title": "裁切这段音频",
      "trim.total": "总长 {total}",
      "trim.selected": "已选 {start} → {end}（{length}）",
      "trim.hint": "拖动两个把手选择要用的片段；确认后这段音频会作为一条独立音效加入「全部音效」。建议 3 秒以内。",
      "trim.preview": "试听这段",
      "trim.save": "加入全部音效",
      "trim.saving": "保存中…",
      "trim.cancel": "取消",
      "note.customSaved": "已保存自定义音效：{name}（{length}）。",
      "note.tooLarge": "音频太大（超过约 2 MB），请换一段更短的，或裁短一点。",
      "note.badType": "这个文件不是浏览器能播放的音频格式。",
      "note.decodeFailed": "这段音频解码失败，换一个文件试试。",
      "note.readFailed": "读取文件失败，请再试一次。",
      "note.previewFailed": "这段音频没法试听，请重新选择一个文件。",
      "note.stopped": "本轮是被手动停止的，不提示。"
    };

    var en = {
      "card.open": "Click to open this session",
      "card.dismiss": "Dismiss this notice",
      "card.arm": "Click anywhere to enable the alert sound",
      "settings.title": "Completion alert",
      "settings.intro": "Play a tone when a round of work finishes, and raise a clickable notice in the bottom-right corner.",
      "row.enabled.title": "Completion alert",
      "row.enabled.desc": "Switches off both the tone and the notice.",
      "row.scope.title": "When to alert",
      "row.scope.desc": "Every session, or only sessions that are not the one on screen.",
      "save.on": "saved in this profile",
      "save.readonly": "the deployment stores settings read-only, so changes last for this window",
      "save.nowhere": "this deployment offers no settings storage, so changes last for this window",
      "scope.all": "All sessions",
      "scope.background": "Background only",
      "row.sound.title": "Play the tone",
      "row.sound.desc": "Mutes the sound only; the notice still appears.",
      "row.volume.title": "Volume",
      "row.volume.desc": "Currently {percent}%; applies to previews and alerts alike.",
      "row.repeat.title": "Repeat",
      "row.repeat.desc": "How many times the tone plays per alert (1 to 4).",
      "repeat.times": "{count}x",
      "trim.name": "Name this audio",
      "trim.name.placeholder": "For example: my message tone",
      "rename.title": "Rename tone",
      "rename.field": "Tone name",
      "rename.save": "Save name",
      "library.custom.rename": "Rename this tone",
      "note.customNamed": "Saved and named \u201c{name}\u201d.",
      "note.toneAdded": "Added to All tones: {name} ({length}).",
      "note.toneNamed": "Added to All tones as \u201c{name}\u201d ({length}).",
      "note.toneRenamed": "Renamed to \u201c{name}\u201d.",
      "note.toneUpdated": "Re-trimmed \u201c{name}\u201d.",
      "note.toneRemoved": "Removed \u201c{name}\u201d from All tones.",
      "note.customRenamed": "Renamed to \u201c{name}\u201d.",
      "row.tone.title": "Tone",
      "row.tone.desc": "Step with the arrows (each step previews), or open the full library with the downward arrow.",
      "tone.prev": "Previous tone",
      "tone.next": "Next tone",
      "tone.library": "Open all tones",
      "tone.unknown": "Unknown tone",
      "library.title": "All tones",
      "library.close": "Close",
      "library.preview": "Preview this tone",
      "library.hint": "Click a tone's name to use it; the play button only auditions it.",
      "library.custom": "Add a tone (choose a file)",
      "library.custom.hint": "Pick a local audio file, trim it, and it joins the list above",
      "library.mine.hint": "Added from your own file",
      "library.mine.remove": "Remove this tone from the list",
      "library.custom.retrim": "Re-trim this audio",
      "sound.custom.unnamed": "Untitled audio",
      "trim.title": "Trim audio",
      "trim.total": "Length {total}",
      "trim.selected": "Selected {start} → {end} ({length})",
      "trim.hint": "Drag the two handles to pick the part to use; confirming adds this clip to All tones as its own entry. Three seconds or less is best.",
      "trim.preview": "Preview slice",
      "trim.save": "Add to All tones",
      "trim.saving": "Saving…",
      "trim.cancel": "Cancel",
      "note.customSaved": "Custom tone saved: {name} ({length}).",
      "note.tooLarge": "That audio is too large (over ~2 MB); pick a shorter file or trim it further.",
      "note.badType": "The browser cannot play that file's audio format.",
      "note.decodeFailed": "That audio could not be decoded; please try another file.",
      "note.readFailed": "Reading the file failed; please try again.",
      "note.previewFailed": "That audio cannot be auditioned; please choose the file again.",
      "note.stopped": "That round was stopped by hand, so it is not announced."
    };

    var client_default = { apply, inject };

    return module.exports;
  }
});













