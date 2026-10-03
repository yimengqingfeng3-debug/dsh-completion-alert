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
      apply: () => apply,
      base64ToBytes: () => base64ToBytes,
      completionText: () => completionText,
      createAlert: () => createAlert,
      createCompletionWatcher: () => createCompletionWatcher,
      createToastStore: () => createToastStore,
      dataUrlToBytes: () => dataUrlToBytes,
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
        id: "hiss",
        label: "哈气",
        hint: "短促的一声「嘶——」，带气声的警觉感",
        source: "hiss.ogg",
        kind: "synth"
      },
      {
        id: "yikes",
        label: "哎呀我去",
        hint: "两音下行短哨「哟↘」，惊讶那一下",
        source: "yikes.ogg",
        kind: "synth"
      },
    ];

    /** Tone id -> the asset file it was generated from (informational). */
    var TONE_SOURCES = {
      'bingbingbing': 'bingbingbing.ogg',
      'crisp-a': 'crisp-a.ogg',
      'crisp-b': 'crisp-b.ogg',
      'hiss': 'hiss.ogg',
      'yikes': 'yikes.ogg',
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
      'hiss':
        'T2dnUwACAAAAAAAAAAAmUTEWAAAAAC0zIycBHgF2b3JiaXMAAAAAAYC7AAAAAAAAAHcBAAAAAAC4AU9nZ1MAAAAAAAAAAAAA' +
        'JlExFgEAAAC4YEi1ED7//////////////////8kDdm9yYmlzDAAAAExhdmY2My4xLjEwMgEAAAAeAAAAZW5jb2Rlcj1MYXZj' +
        'NjMuMS4xMDIgbGlidm9yYmlzAQV2b3JiaXMpQkNWAQAIAAAAMUwgxYDQkFUAABAAAGAkKQ6TZkkppZShKHmYlEhJKaWUxTCJ' +
        'mJSJxRhjjDHGGGOMMcYYY4wgNGQVAAAEAIAoCY6j5klqzjlnGCeOcqA5aU44pyAHilHgOQnC9SZjbqa0pmtuziklCA1ZBQAA' +
        'AgBASCGFFFJIIYUUYoghhhhiiCGHHHLIIaeccgoqqKCCCjLIIINMMumkk0466aijjjrqKLTQQgsttNJKTDHVVmOuvQZdfHPO' +
        'Oeecc84555xzzglCQ1YBACAAAARCBhlkEEIIIYUUUogppphyCjLIgNCQVQAAIACAAAAAAEeRFEmxFMuxHM3RJE/yLFETNdEz' +
        'RVNUTVVVVVV1XVd2Zdd2ddd2fVmYhVu4fVm4hVvYhV33hWEYhmEYhmEYhmH4fd/3fd/3fSA0ZBUAIAEAoCM5luMpoiIaouI5' +
        'ogOEhqwCAGQAAAQAIAmSIimSo0mmZmquaZu2aKu2bcuyLMuyDISGrAIAAAEABAAAAAAAoGmapmmapmmapmmapmmapmmapmma' +
        'ZlmWZVmWZVmWZVmWZVmWZVmWZVmWZVmWZVmWZVmWZVmWZVmWZVlAaMgqAEACAEDHcRzHcSRFUiTHciwHCA1ZBQDIAAAIAEBS' +
        'LMVyNEdzNMdzPMdzPEd0RMmUTM30TA8IDVkFAAACAAgAAAAAAEAxHMVxHMnRJE9SLdNyNVdzPddzTdd1XVdVVVVVVVVVVVVV' +
        'VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVgdCQVQAABAAAIZ1mlmqACDOQYSA0ZBUAgAAAABihCEMMCA1ZBQAABAAAiKHkIJrQ' +
        'mvPNOQ6a5aCpFJvTwYlUmye5qZibc84555xszhnjnHPOKcqZxaCZ0JpzzkkMmqWgmdCac855EpsHranSmnPOGeecDsYZYZxz' +
        'zmnSmgep2Vibc85Z0JrmqLkUm3POiZSbJ7W5VJtzzjnnnHPOOeecc86pXpzOwTnhnHPOidqba7kJXZxzzvlknO7NCeGcc845' +
        '55xzzjnnnHPOCUJDVgEAQAAABGHYGMadgiB9jgZiFCGmIZMedI8Ok6AxyCmkHo2ORkqpg1BSGSeldILQkFUAACAAAIQQUkgh' +
        'hRRSSCGFFFJIIYYYYoghp5xyCiqopJKKKsoos8wyyyyzzDLLrMPOOuuwwxBDDDG00kosNdVWY4215p5zrjlIa6W11lorpZRS' +
        'SimlIDRkFQAAAgBAIGSQQQYZhRRSSCGGmHLKKaegggoIDVkFAAACAAgAAADwJM8RHdERHdERHdERHdERHc/xHFESJVESJdEy' +
        'LVMzPVVUVVd2bVmXddu3hV3Ydd/Xfd/XjV8XhmVZlmVZlmVZlmVZlmVZlmUJQkNWAQAgAAAAQgghhBRSSCGFlGKMMcecg05C' +
        'CYHQkFUAACAAgAAAAABHcRTHkRzJkSRLsiRN0izN8jRP8zTRE0VRNE1TFV3RFXXTFmVTNl3TNWXTVWXVdmXZtmVbt31Ztn3f' +
        '933f933f933f933f13UgNGQVACABAKAjOZIiKZIiOY7jSJIEhIasAgBkAAAEAKAojuI4jiNJkiRZkiZ5lmeJmqmZnumpogqE' +
        'hqwCAAABAAQAAAAAAKBoiqeYiqeIiueIjiiJlmmJmqq5omzKruu6ruu6ruu6ruu6ruu6ruu6ruu6ruu6ruu6ruu6ruu6ruu6' +
        'QGjIKgBAAgBAR3IkR3IkRVIkRXIkBwgNWQUAyAAACADAMRxDUiTHsixN8zRP8zTREz3RMz1VdEUXCA1ZBQAAAgAIAAAAAADA' +
        'kAxLsRzN0SRRUi3VUjXVUi1VVD1VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVXVNE3TNIHQkJUAABkAACNBBhmE' +
        'EIpykEJuPVgIMeYkBaE5BqHEGISnEDMMOQ0idJBBJz24kjnDDPPgUigVREyDjSU3jiANwqZcSeU4CEJDVgQAUQAAgDHIMcQY' +
        'cs5JyaBEzjEJnZTIOSelk9JJKS2WGDMpJaYSY+Oco9JJyaSUGEuKnaQSY4mtAACAAAcAgAALodCQFQFAFAAAYgxSCimFlFLO' +
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
      'yikes':
        'T2dnUwACAAAAAAAAAAASyTYxAAAAAIy/BzYBHgF2b3JiaXMAAAAAAYC7AAAAAAAAAHcBAAAAAAC4AU9nZ1MAAAAAAAAAAAAA' +
        'Esk2MQEAAAChPjjkED7//////////////////8kDdm9yYmlzDAAAAExhdmY2My4xLjEwMgEAAAAeAAAAZW5jb2Rlcj1MYXZj' +
        'NjMuMS4xMDIgbGlidm9yYmlzAQV2b3JiaXMpQkNWAQAIAAAAMUwgxYDQkFUAABAAAGAkKQ6TZkkppZShKHmYlEhJKaWUxTCJ' +
        'mJSJxRhjjDHGGGOMMcYYY4wgNGQVAAAEAIAoCY6j5klqzjlnGCeOcqA5aU44pyAHilHgOQnC9SZjbqa0pmtuziklCA1ZBQAA' +
        'AgBASCGFFFJIIYUUYoghhhhiiCGHHHLIIaeccgoqqKCCCjLIIINMMumkk0466aijjjrqKLTQQgsttNJKTDHVVmOuvQZdfHPO' +
        'Oeecc84555xzzglCQ1YBACAAAARCBhlkEEIIIYUUUogppphyCjLIgNCQVQAAIACAAAAAAEeRFEmxFMuxHM3RJE/yLFETNdEz' +
        'RVNUTVVVVVV1XVd2Zdd2ddd2fVmYhVu4fVm4hVvYhV33hWEYhmEYhmEYhmH4fd/3fd/3fSA0ZBUAIAEAoCM5luMpoiIaouI5' +
        'ogOEhqwCAGQAAAQAIAmSIimSo0mmZmquaZu2aKu2bcuyLMuyDISGrAIAAAEABAAAAAAAoGmapmmapmmapmmapmmapmmapmma' +
        'ZlmWZVmWZVmWZVmWZVmWZVmWZVmWZVmWZVmWZVmWZVmWZVmWZVlAaMgqAEACAEDHcRzHcSRFUiTHciwHCA1ZBQDIAAAIAEBS' +
        'LMVyNEdzNMdzPMdzPEd0RMmUTM30TA8IDVkFAAACAAgAAAAAAEAxHMVxHMnRJE9SLdNyNVdzPddzTdd1XVdVVVVVVVVVVVVV' +
        'VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVgdCQVQAABAAAIZ1mlmqACDOQYSA0ZBUAgAAAABihCEMMCA1ZBQAABAAAiKHkIJrQ' +
        'mvPNOQ6a5aCpFJvTwYlUmye5qZibc84555xszhnjnHPOKcqZxaCZ0JpzzkkMmqWgmdCac855EpsHranSmnPOGeecDsYZYZxz' +
        'zmnSmgep2Vibc85Z0JrmqLkUm3POiZSbJ7W5VJtzzjnnnHPOOeecc86pXpzOwTnhnHPOidqba7kJXZxzzvlknO7NCeGcc845' +
        '55xzzjnnnHPOCUJDVgEAQAAABGHYGMadgiB9jgZiFCGmIZMedI8Ok6AxyCmkHo2ORkqpg1BSGSeldILQkFUAACAAAIQQUkgh' +
        'hRRSSCGFFFJIIYYYYoghp5xyCiqopJKKKsoos8wyyyyzzDLLrMPOOuuwwxBDDDG00kosNdVWY4215p5zrjlIa6W11lorpZRS' +
        'SimlIDRkFQAAAgBAIGSQQQYZhRRSSCGGmHLKKaegggoIDVkFAAACAAgAAADwJM8RHdERHdERHdERHdERHc/xHFESJVESJdEy' +
        'LVMzPVVUVVd2bVmXddu3hV3Ydd/Xfd/XjV8XhmVZlmVZlmVZlmVZlmVZlmUJQkNWAQAgAAAAQgghhBRSSCGFlGKMMcecg05C' +
        'CYHQkFUAACAAgAAAAABHcRTHkRzJkSRLsiRN0izN8jRP8zTRE0VRNE1TFV3RFXXTFmVTNl3TNWXTVWXVdmXZtmVbt31Ztn3f' +
        '933f933f933f933f13UgNGQVACABAKAjOZIiKZIiOY7jSJIEhIasAgBkAAAEAKAojuI4jiNJkiRZkiZ5lmeJmqmZnumpogqE' +
        'hqwCAAABAAQAAAAAAKBoiqeYiqeIiueIjiiJlmmJmqq5omzKruu6ruu6ruu6ruu6ruu6ruu6ruu6ruu6ruu6ruu6ruu6ruu6' +
        'QGjIKgBAAgBAR3IkR3IkRVIkRXIkBwgNWQUAyAAACADAMRxDUiTHsixN8zRP8zTREz3RMz1VdEUXCA1ZBQAAAgAIAAAAAADA' +
        'kAxLsRzN0SRRUi3VUjXVUi1VVD1VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVXVNE3TNIHQkJUAABkAACNBBhmE' +
        'EIpykEJuPVgIMeYkBaE5BqHEGISnEDMMOQ0idJBBJz24kjnDDPPgUigVREyDjSU3jiANwqZcSeU4CEJDVgQAUQAAgDHIMcQY' +
        'cs5JyaBEzjEJnZTIOSelk9JJKS2WGDMpJaYSY+Oco9JJyaSUGEuKnaQSY4mtAACAAAcAgAALodCQFQFAFAAAYgxSCimFlFLO' +
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
    /** Host route that reports how a session's newest turn ended. */
    var TURN_OUTCOME_PATH = "/api/completion-alert.outcome";
    /** How long a turn outcome is reused before the host is asked again. */
    var OUTCOME_TTL_MS = 30000;
    /** How long to wait for the host before announcing without its answer. */
    var OUTCOME_TIMEOUT_MS = 1500;
    /** How long a notice card stays on screen before it fades (hover pauses it). */
    var TOAST_HOLD_MS = 9000;
    /** Largest accepted custom sound, as a data URL length (~1.1 MB of audio). */
    var MAX_SOUND_DATA_URL = 1600000;
    /** How long one alert tone is allowed to run before it is stopped. */
    var MAX_PLAY_MS = 4000;
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
      /** Whether a round the user stopped by hand is announced at all. */
      alertOnStop: false,
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
      customRange: null
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
      var toneId = typeof source.toneId === "string" && source.toneId.length > 0 ? source.toneId : DEFAULT_TONE_ID;
      if (toneId !== CUSTOM_TONE_ID && toneById(toneId) === void 0) toneId = DEFAULT_TONE_ID;
      // "custom" without a payload, or a legacy "soundSource: custom", must not
      // leave the plugin silent: fall back to the default tone.
      if (toneId === CUSTOM_TONE_ID && customData === "") toneId = DEFAULT_TONE_ID;
      return {
        enabled: typeof source.enabled === "boolean" ? source.enabled : DEFAULT_SETTINGS.enabled,
        alertScope: source.alertScope === "background" ? "background" : "all",
        alertOnStop: typeof source.alertOnStop === "boolean" ? source.alertOnStop : DEFAULT_SETTINGS.alertOnStop,
        alertInBackground: typeof source.alertInBackground === "boolean"
          ? source.alertInBackground
          : DEFAULT_SETTINGS.alertInBackground,
        soundEnabled: typeof source.soundEnabled === "boolean" ? source.soundEnabled : DEFAULT_SETTINGS.soundEnabled,
        volume: clampNumber(source.volume, DEFAULT_SETTINGS.volume, 0, 1),
        toneId,
        customData,
        customName: typeof source.customName === "string" ? source.customName : "",
        customRange: cleanRange(source.customRange)
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
      return toneById(settings.toneId) === void 0 ? DEFAULT_TONE_ID : settings.toneId;
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
        var payload = TONE_BASE64[id];
        return typeof payload === "string" && payload.length > 0 ? "data:audio/ogg;base64," + payload : "";
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
          if (next !== null) startBuffer(next.buffer, next.range);
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
      function startBuffer(buffer, range) {
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
          if (timer !== null) clearTimeout(timer);
          timer = setTimeout(() => {
            timer = null;
            try {
              node.stop();
            } catch {
              // Already finished.
            }
          }, Math.max(300, (start + duration) * 1000 + 120));
          return true;
        } catch (error) {
          report("audio: playback failed (" + String(error?.message ?? error) + ")");
          return false;
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
            pending = { toneId, range };
            armUnlock();
            lastFailure = "awaiting-gesture";
            return false;
          }
          if (!startBuffer(buffer, range)) {
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
            if (!startBuffer(buffer, range ?? null)) {
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
          if (timer !== null) {
            clearTimeout(timer);
            timer = null;
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
      ".dca-trim-canvas{display:block;width:100%;height:120px;color:var(--dsw-alias-label-tertiary);cursor:crosshair;touch-action:none}",
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
     * own preview button, then the custom row. Picking a built-in switches and
     * previews; picking custom either uses the saved upload or opens the picker.
     */
    function ToneLibraryPanel(props) {
      var t = props.t;
      var playingId = react.default.useState("");
      var playing = playingId[0];
      var setPlaying = playingId[1];
      var preview = (toneId, isCustom) => {
        setPlaying(isCustom ? CUSTOM_TONE_ID : toneId);
        props.onPreview(toneId, isCustom);
        setTimeout(() => setPlaying(""), 900);
      };
      return react.default.createElement("div", { className: "dca-modal-layer", "data-dsh-completion-alert": "library" },
        react.default.createElement("div", { className: "dca-modal-mask", onClick: props.onClose, "aria-hidden": "true" }),
        react.default.createElement("div", { className: "dca-modal", role: "dialog", "aria-modal": "true", "aria-label": t("library.title") },
          react.default.createElement("div", { className: "dca-modal-head" },
            react.default.createElement("div", { className: "dca-modal-title" }, t("library.title")),
            react.default.createElement("button", {
              type: "button",
              className: "dca-icon",
              "aria-label": t("library.close"),
              title: t("library.close"),
              onClick: props.onClose
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
                  onClick: () => preview(CUSTOM_TONE_ID, true)
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
        var width = canvas.width;
        var height = canvas.height;
        var ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, width, height);
        var styles = globalThis.getComputedStyle ? globalThis.getComputedStyle(canvas) : null;
        ctx.fillStyle = styles?.color ?? "#888";
        var middle = height / 2;
        var perColumn = width / props.peaks.length;
        for (var index = 0; index < props.peaks.length; index++) {
          var peak = props.peaks[index];
          var top = middle - peak.max * middle * 0.92;
          var bottom = middle - peak.min * middle * 0.92;
          ctx.fillRect(index * perColumn, top, Math.max(1, perColumn), Math.max(1, bottom - top));
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

      return react.default.createElement("div", { className: "dca-modal-layer", "data-dsh-completion-alert": "trim" },
        react.default.createElement("div", { className: "dca-modal-mask", onClick: props.onCancel, "aria-hidden": "true" }),
        react.default.createElement("div", { className: "dca-modal dca-trim", role: "dialog", "aria-modal": "true", "aria-label": t("trim.title") },
          react.default.createElement("div", { className: "dca-modal-head" },
            react.default.createElement("div", { className: "dca-modal-title" }, t("trim.title")),
            react.default.createElement("button", {
              type: "button",
              className: "dca-icon",
              title: t("trim.cancel"),
              "aria-label": t("trim.cancel"),
              onClick: props.onCancel
            }, react.default.createElement("svg", { width: 12, height: 12, viewBox: "0 0 12 12", fill: "none", "aria-hidden": "true" },
              react.default.createElement("path", { d: "M2.5 2.5l7 7M9.5 2.5l-7 7", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round" })))),
          react.default.createElement("div", { className: "dca-modal-body" },
            react.default.createElement("div", { className: "dca-trim-wrap" },
              react.default.createElement("canvas", {
                ref: canvasRef,
                className: "dca-trim-canvas",
                width: 520,
                height: 120,
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
                onClick: () => props.onSave(clamped)
              }, props.busy === true ? t("trim.saving") : t("trim.save"))))));
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
            setLibraryOpen(false);
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
      var retrim = () => {
        setBusy(true);
        runtime.alert.changed();
        runtime.alert.decode(settings.customData).then((buffer) => {
          setBusy(false);
          if (buffer === null) {
            runtime.notify("decodeFailed");
            return;
          }
          setLibraryOpen(false);
          var saved = settings.customRange;
          setTrim({
            payload: settings.customData,
            name: settings.customName,
            buffer,
            peaks: peaksOf(buffer, 320),
            duration: buffer.duration,
            initial: saved !== void 0 && saved.end > saved.start ? saved : { start: 0, end: buffer.duration }
          });
        });
      };

      /** Encode the chosen slice and store it as the custom tone. */
      var saveTrim = (range) => {
        setBusy(true);
        var dataUrl = encodeWav(trim.buffer, { start: range.start, duration: range.duration });
        if (dataUrl === "" || dataUrl.length > MAX_SOUND_DATA_URL) {
          setBusy(false);
          runtime.notify("tooLarge");
          return;
        }
        update({ toneId: CUSTOM_TONE_ID, customData: dataUrl, customName: trim.name, customRange: { start: 0, end: range.duration } });
        runtime.alert.changed();
        runtime.alert.previewTone(CUSTOM_TONE_ID, null);
        setBusy(false);
        setTrim(null);
        runtime.notify("customSaved", { name: trim.name, length: formatSeconds(range.duration) });
      };

      var inBackground = react.default.useSyncExternalStore(
        runtime.background.subscribe,
        runtime.background.getSnapshot,
        runtime.background.getSnapshot
      );

      var noteKey = notice.key;
      var noteText = noteKey === "" ? void 0 : t("note." + noteKey, notice.params ?? {});

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
          description: t("row.scope.desc")
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
          title: t("row.stop.title"),
          description: t("row.stop.desc")
        }, react.default.createElement(Toggle, {
          checked: settings.alertOnStop,
          label: t("row.stop.title"),
          onChange: (next) => update({ alertOnStop: next })
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
              update({ toneId });
              previewTone(toneId, false);
            },
            onRetrim: retrim
          })
          : null,

        trim === null
          ? null
          : react.default.createElement(TrimDialog, {
            t,
            payload: trim.payload,
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
    function writeSettings(scope, patch) {
      if (scope === null) return false;
      var fields = Object.keys(patch);
      try {
        if (typeof scope.set === "function") {
          scope.set(fields[0], patch[fields[0]]);
          for (var index = 1; index < fields.length; index++) scope.set(fields[index], patch[fields[index]]);
          return true;
        }
        if (typeof scope.mutate === "function") {
          scope.mutate(fields.map((field) => ({ op: "set", path: [field], value: patch[field] })));
          return true;
        }
        if (typeof scope.write === "function") {
          for (var field of fields) scope.write({ op: "set", path: [field], value: patch[field] });
          return true;
        }
      } catch (error) {
        return false;
      }
      return false;
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
      var settingsStore = createStore(normalizeSettings(null));
      var writeTimer = null;
      var pendingPatch = {};
      /** True once a settings write has been attempted and refused. */
      var writeRefused = false;
      /** Set by the facade whenever a tone could not start for a browser reason. */
      var awaitingGesture = false;

      /** Push the whole effective settings document to the host, debounced. */
      function flushSettings() {
        writeTimer = null;
        var patch = pendingPatch;
        pendingPatch = {};
        var fields = Object.keys(patch);
        if (fields.length === 0) return;
        var accepted = writeSettings(settingsScope, patch);
        // Report every attempt: a setting that reverts after a restart is either
        // a refused write or a document the host never stored, and from the
        // settings page those two look exactly alike.
        reportDiagnostics({
          settingsWrite: {
            fields: fields.join(","),
            accepted,
            how: settingsScope === null ? "no-scope" : typeof settingsScope.set === "function" ? "set" : "unknown"
          }
        });
        if (!accepted) {
          writeRefused = true;
          report("settings write refused; the choice stays in this window");
        }
      }

      /** Apply a patch locally, refresh the player, and persist it. */
      function update(patch) {
        var next = sanitizeSettings({ ...settingsStore.getSnapshot(), ...patch });
        settingsStore.set(next);
        alert.configure(next);
        pendingPatch = { ...pendingPatch, ...patch };
        if (writeTimer !== null) clearTimeout(writeTimer);
        writeTimer = setTimeout(flushSettings, 350);
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

      /** Adopt a settings scope: seed the store, then follow every later revision. */
      function attachScope(scope) {
        settingsScope = scope;
        var sync = () => {
          var next = normalizeSettings(scope.getSnapshot());
          var previous = settingsStore.getSnapshot();
          settingsStore.set(next);
          alert.configure(next);
          if (previous.customData !== next.customData) alert.invalidate();
          else if (previous.toneId !== next.toneId) alert.configure(next);
        };
        sync();
        try {
          scope.subscribe(sync);
        } catch {
          // A scope without a subscription keeps the initial read only.
        }
        reportDiagnostics({ settingsScope: true });
      }

      // A client without the settings service still gets a working alert: the
      // choices then last for the life of the page.
      whenReady(ctx, ["settingsScope"], (scope) => {
        try {
          var bound = bindSettings(scope);
          if (bound === null) {
            report("settingsScope.bind is unavailable; preferences stay in this window");
            return;
          }
          attachScope(bound);
        } catch (error) {
          report("settings binding failed (" + String(error?.message ?? error) + ")");
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
            var stopped = completion.outcome !== null && completion.outcome !== void 0
              && completion.outcome !== "completed"
              && completion.outcome !== "blocked"
              && completion.outcome !== "max-tokens";
            if (stopped && !settings.alertOnStop) {
              report("skipped a hand-stopped round (" + completion.outcome + ")");
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
            alertFacade.play();
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
        fetchFn("/api/completion-alert.diag", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            at: Date.now(),
            facts,
            ua: globalThis.navigator?.userAgent ?? ""
          })
        }).catch(() => {});
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
      if (cached !== void 0 && now - cached.at < OUTCOME_TTL_MS) return Promise.resolve(cached.kind);
      var fetchFn = globalThis.fetch;
      if (typeof fetchFn !== "function") return Promise.resolve(null);
      var request = fetchFn(TURN_OUTCOME_PATH + "?sessionId=" + encodeURIComponent(sessionId), {
        method: "GET",
        credentials: "same-origin"
      }).then((response) => (response?.ok === true ? response.json() : null))
        .then((payload) => {
          var kind = typeof payload?.kind === "string" && payload.kind !== "" ? payload.kind : null;
          outcomeCache.set(sessionId, { kind, at: Date.now() });
          return kind;
        })
        .catch(() => null);
      // A host that does not answer must not hold up the notice.
      var deadline = new Promise((resolve) => {
        globalThis.setTimeout(() => resolve(null), OUTCOME_TIMEOUT_MS);
      });
      return Promise.race([request, deadline]);
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
      "scope.all": "全部会话",
      "scope.background": "仅后台会话",
      "row.sound.title": "播放提示音",
      "row.sound.desc": "只关掉声音，右下角通知照常弹出。",
      "row.volume.title": "音量",
      "row.volume.desc": "当前 {percent}%，预览与正式提示音同时生效。",
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
      "library.custom": "自定义音效",
      "library.custom.hint": "选择本地音频文件",
      "library.custom.retrim": "重新裁切这段音频",
      "sound.custom.unnamed": "未命名音频",
      "trim.title": "裁切音频",
      "trim.total": "总长 {total}",
      "trim.selected": "已选 {start} → {end}（{length}）",
      "trim.hint": "拖动两个把手选择要用的片段；保存后只播放这一段。建议 3 秒以内。",
      "trim.preview": "试听这段",
      "trim.save": "保存并使用",
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
      "scope.all": "All sessions",
      "scope.background": "Background only",
      "row.sound.title": "Play the tone",
      "row.sound.desc": "Mutes the sound only; the notice still appears.",
      "row.volume.title": "Volume",
      "row.volume.desc": "Currently {percent}%; applies to previews and alerts alike.",
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
      "library.custom": "Custom tone",
      "library.custom.hint": "Choose an audio file",
      "library.custom.retrim": "Re-trim this audio",
      "sound.custom.unnamed": "Untitled audio",
      "trim.title": "Trim audio",
      "trim.total": "Length {total}",
      "trim.selected": "Selected {start} → {end} ({length})",
      "trim.hint": "Drag the two handles to pick the part to use; only that slice plays afterwards. Three seconds or less is best.",
      "trim.preview": "Preview slice",
      "trim.save": "Save and use",
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





