# dsh-completion-alert

[中文](README.zh-CN.md) | English

A [dsh](https://github.com/deepseek-ai) (DeepSeek Harness) **client plugin** that tells you when a round of work has finished:

- **plays a short alert tone** — the looping "bing bing bing" meme sound effect, cut to one 1.06 s round — the moment a session goes busy → idle;
- **raises a notice card in the bottom-right corner** naming *which* session finished and how long it ran;
- **clicking the card opens that session** in the main view;
- **every part of it is configurable in Settings**: on/off, alert scope, sound on/off, volume, preview, and a **custom tone upload**.

The tone is embedded in the client bundle, so the plugin needs no host route, no on-disk asset and no network access. The notice layer and the settings page use dsh's own theme tokens and slot system, so they match the desktop app's look.

```
a round of work ends  (session running: true -> false)
        │
        ├─ play the alert tone once (volume per settings)
        └─ notice card, bottom right:  "「Compress the icons」 finished · 1m 12s"
                                          └─ click -> uiWorkspace.openSession(id)
```

---

## Install

### From this repository (recommended)

```powershell
git clone https://github.com/yimengqingfeng3-debug/dsh-completion-alert.git
cd dsh-completion-alert
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1            # desktop profile
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -Profile web
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -Uninstall
```

The installer is idempotent and backs up every file it edits:

1. copies the package into `<DSH_HOME>/profiles/<profile>/node_modules/dsh-completion-alert`;
2. appends the `completion-alert` insert to that profile's `cordis.patch.yml` (unless the profile already lists this package under `dsh.profile.bundles`, where the bundle's own patch inserts it — a duplicate row id is a hard boot failure);
3. sets `dsh.profile.patchReload = live` when it is absent, so later edits recompose without an app restart.

**Reload the dsh window once** (`Ctrl+R`) so the browser fetches the new client bundle.

### Manually

Copy `lib/`, `package.json` and `cordis.patch.yml` into the profile's `node_modules/dsh-completion-alert`, then add to the profile's `cordis.patch.yml`:

```yaml
- insert:
    - id: completion-alert
      name: 'dsh-completion-alert'
```

### Verify it mounted

The host half serves a diagnostics route that the browser half reports its own activation to (mount facts only — no session content, no preferences):

```
GET http://127.0.0.1:<port>/api/completion-alert.diag
-> { "report": { "facts": { "watcher": true, "overlay": true, "settings": true } } }
```

`watcher: true` means completion detection is wired up; `settings: true` means preferences are bound to the host settings document. The loopback port is token-guarded, so read this from the app's own console or DevTools network tab rather than curl.

---

## Settings

**Settings → Completion alert**, its own page beside *General* and *Built-in plugins*:

| Setting | Meaning |
| --- | --- |
| Completion alert | Master switch. Off means no tone and no notice |
| When to alert | `All sessions`: every session that finishes; `Background only`: stay quiet for the session you are looking at |
| Play the tone | Mutes the sound only; the notice still appears |
| Volume | 0–100 %, applies to previews and alerts alike |
| Preview | Plays the tone once with the current settings, changing nothing |
| Custom tone | Upload an mp3 / wav / ogg to replace the built-in tone (under 3 s and ~2 MB is best), with a one-click clear |
| Tone in use | `Built-in` / `Custom` |

Preferences live in this plugin's own settings namespace (`completion-alert`) inside the profile's settings document, so they survive a restart and reach every open window. On a client without the settings service the plugin still works and keeps its choices for the life of the page.

---

## How it works

### 1. Completion detection reads `uiSession.sessionStatus`

No DOM scraping and no polling. The plugin subscribes to the client's own process-local session status projection — the same one the sidebar's status dots and the Stop shortcut's guard use:

```js
status.subscribe(() => {
  // running: true -> false means one round of work just ended
});
```

That projection is fed by the host's `api-session/status` event (`agent/status` → `status === "running"`), so **main-view, background and subagent sessions all report**.

Two deliberate rules:

- **The first snapshot is a baseline, not a completion.** A window opened while a session is already busy must not alert for work it never saw start.
- **Only the true → false edge counts.** A round that ends waiting for approval, or that the user stops, also ends — and alerts like any other.

### 2. The tone: an embedded Ogg through Web Audio

The bundle carries a base64 Ogg payload in a marked chunk (`//#region embedded-tone`). It is decoded once with `decodeAudioData` and cached; at most one tone plays at a time, so a second completion cannot stack a second voice on top of the first.

Chromium refuses to start an `AudioContext` before the page has seen a user gesture, which is exactly the state a freshly loaded window is in. Instead of dropping that first alert, the plugin registers a one-shot gesture unlock and replays the pending tone when it fires, and shows a small "click anywhere to enable the alert sound" pill in the corner meanwhile. Once the window has been touched, the pill never comes back.

### 3. The notice and the navigation

The notice layer registers into `shell.overlay` — the frame's own overlay slot (`position: absolute; inset: 0`) — and the cards position themselves `fixed` in the bottom-right corner, with pointer events enabled on the card alone so the layer never blocks the UI.

Clicking a card calls `uiWorkspace.openSession(sessionId)`, the same entry point the session browser and the fork action use. Hovering pauses the auto-dismiss timer, and the × dismisses it.

### 4. Card colours

The settings page rides the theme's `--dsw-alias-*` variables throughout. The corner card additionally probes the page's own background colour once (those variables do not resolve inside the overlay layer) for both light and dark modes, so the card blends with whatever skin is active instead of reading as a white block dropped on top.

---

## The audio

The tone is a clip of the "bing bing bing" sound effect that circulates as a public meme, cut, levelled and trimmed to one clean round:

| Version | File | Notes |
| --- | --- | --- |
| Source of the embed | `assets/bingbingbing.ogg` | 48 kHz mono Ogg Vorbis, 1.06 s, 12 642 bytes |
| Packaged asset | — | the same payload, inlined in `lib/client.js` |

Replace it with your own tone:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\embed-audio.ps1 -Source C:\path\to\your-tone.ogg
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\embed-audio.ps1 -Check   # fails when the bundle and the asset drift
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
```

The script validates the `OggS` magic, rewrites **only** the marked chunk, and preserves the bundle's UTF-8. **Ogg is required**: Chromium's `decodeAudioData` does not decode mp3, and embedding one would be pointless. Cross-platform equivalent: `node tools/check-embedded-tone.mjs`.

See [NOTICE](NOTICE) for the asset's provenance — and note that the settings page lets any end user upload their own tone at runtime, which is the recommended path when distribution rights are unclear.

---

## Project layout

```
dsh-completion-alert/
├─ package.json             dsh.pluginType=client, dsh.client.inject, bundle patch
├─ cordis.patch.yml         inserts the completion-alert row into a profile
├─ install.ps1              install / uninstall (backups, patchReload=live, idempotent)
├─ assets/bingbingbing.ogg  the tone source the embedder reads
├─ lib/
│  ├─ index.js              host half: the volatile settings schema + diagnostics route
│  └─ client.js             browser half: detector, player, notice layer, settings page
├─ tools/
│  ├─ embed-audio.ps1       re-embed a tone (Windows)
│  └─ check-embedded-tone.mjs  drift + Ogg-magic check (cross-platform, CI)
└─ test/
   ├─ host.test.mjs         schema surface, volatile marker, diagnostics route
   ├─ client.test.mjs       settings coercion, completion edges, scope, persistence, navigation
   └─ loader.mjs / -hooks   resolves the schemastery peer dependency for the tests
```

## Development

```bash
npm install          # pulls the schemastery peer dependency the host half imports
npm test             # 35 tests
node tools/check-embedded-tone.mjs
```

The test suite is behavioural rather than structural: the client tests load the real bundle into a `vm` sandbox with a stub React and a fake dsh client context, then drive the stores to assert the things that decide behaviour — the first-snapshot baseline, the busy → idle edge, the *background only* scope, debounced persistence into the plugin's own namespace, navigation through `uiWorkspace`, and the notice queue. The host tests validate the schema surface (including that a volatile node sits at a fixed path with no volatile field inside it, which the app rejects) and the diagnostics route round-trip.

CI (`.github/workflows/test.yml`) runs both plus the drift check on Node 24.

## Known limitations

- **Ogg only for custom tones.** mp3 uploads are rejected up front rather than silently failing to decode.
- **One tone at a time.** A completion arriving while the previous tone still rings replaces it rather than mixing.
- **No OS-level notifications.** The notice is a dsh overlay card, so the plugin needs no Electron notification permission and stays consistent across web and desktop builds.
- **The sound is a meme asset.** Redistribute with your own tone if that matters for your use (see NOTICE).

## License

MIT for the code — see [LICENSE](LICENSE). The bundled audio clip is third-party material; read [NOTICE](NOTICE) before redistributing.
