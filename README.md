# dsh-completion-alert

[中文](README.zh-CN.md) | English

A [dsh](https://github.com/deepseek-ai) (DeepSeek Harness) **client plugin** that tells you when a round of work has finished:

- **plays a short alert tone** — three ship by default: the "bing bing bing" meme tone plus two original synthesized crisp dings — the moment a session goes busy → idle;
- **raises a notice card in the bottom-right corner** naming *which* session finished and how long it ran;
- **clicking the card opens that session** in the main view;
- **every part of it is configurable in Settings**: on/off, alert scope, sound on/off, volume, a tone library with instant preview, and a **custom tone you can trim on its own waveform**.

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

### From the registry (what the plugin manager does)

```
dsh-completion-alert
```

Paste that name into **Settings → Built-in plugins → Install**. The plugin manager runs `pnpm add` in the profile, records the dependency, and lists the package under `dsh.profile.bundles`.

### From this repository (a checkout, no package manager)

```powershell
git clone https://github.com/yimengqingfeng3-debug/dsh-completion-alert.git
cd dsh-completion-alert
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1            # desktop profile
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -Profile web
```

The installer is idempotent and backs up every file it edits:

1. copies the package into `<DSH_HOME>/profiles/<profile>/node_modules/dsh-completion-alert`;
2. appends the `completion-alert` insert to that profile's `cordis.patch.yml` (unless the profile already lists this package under `dsh.profile.bundles`, where the bundle's own patch inserts it — a duplicate row id is a hard boot failure);
3. sets `dsh.profile.patchReload = live` when it is absent, so later edits recompose without an app restart.

**Reload the dsh window once** (`Ctrl+R`) so the browser fetches the new client bundle.

### Manually

Copy `lib/`, `assets/`, `package.json` and `cordis.patch.yml` into the profile's `node_modules/dsh-completion-alert`, then add to the profile's `cordis.patch.yml`:

```yaml
- insert:
    - id: completion-alert
      name: 'dsh-completion-alert'
```

---

## Uninstall

Three ways out, all verified. **None of them needs this plugin to cooperate**, and none touches any other plugin.

### 1. The plugin manager's own button

**Settings → Built-in plugins → dsh-completion-alert → 卸载 / Uninstall.** It removes the bundle listing and the patch row (so the plugin stops loading) and then asks pnpm to remove the package.

Known issue with that last step: the plugin manager drives the pnpm **the app ships (11.7.0)**, and that version ignores the profile's `minimumReleaseAgeExclude` list when a package was published within the last 24 hours — so `pnpm remove` can fail with `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` and report a failed uninstall, even though the plugin is already unloaded. pnpm 12 (the one on your PATH) honours the list, so the same removal run by hand succeeds.

Either way, the GUI's own state is correct after it returns. What can be left behind is the copy in `node_modules` and its entry in `package.json` / `pnpm-lock.yaml` — which is what the next two options clean up.

### 2. The thorough script (recommended when the button complains)

Close dsh, then:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\uninstall-all.ps1                 # desktop profile
powershell -NoProfile -ExecutionPolicy Bypass -File .\uninstall-all.ps1 -Profile web
powershell -NoProfile -ExecutionPolicy Bypass -File .\uninstall-all.ps1 -WhatIf        # show the plan, change nothing
```

It removes, and then verifies, every trace:

| Where | What goes |
| --- | --- |
| `node_modules/dsh-completion-alert` | the package directory |
| `cordis.patch.yml` | every `completion-alert` insert row (a failed install can leave more than one) |
| `package.json` | the dependency entry, if the plugin manager added one |
| `pnpm-lock.yaml` | the importer entry and the `packages:` / `snapshots:` blocks |
| `pnpm-workspace.yaml` | this package's `minimumReleaseAgeExclude` line |

Every file it rewrites is backed up to `<profile>\.completion-alert-backup\`, it prints what it left alone by name — the balance plugin's directory, dependency, exemptions and lockfile entries are all reported as untouched — and it finishes with a "should be none" scan that lists any reference it failed to remove. Run with dsh **closed**: the app holds the profile while it runs, and a closing app can write the same files back.

### 3. By hand

Delete `node_modules/dsh-completion-alert`, remove its `- insert:` row from `cordis.patch.yml`, drop `"dsh-completion-alert"` from `package.json` (both `dsh.profile.bundles` and `dependencies`) and its entries from `pnpm-lock.yaml`. Leaving the lockfile entry behind is not fatal — pnpm reports "lockfile is not up to date" rather than doing the wrong thing — but the script above exists so you do not have to.

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
| Everything while backgrounded | With `Background only` selected: once the app is hidden or minimised, nothing is really "on screen", so any session finishing alerts you. The row shows the current state and is disabled while `All sessions` is selected |
| Announce stopped rounds too | Off by default: a round you ended with **Stop** raises no notice and no tone. Only rounds that finish on their own are announced |
| Play the tone | Mutes the sound only; the notice still appears |
| Volume | 0–100 %, applies to previews and alerts alike |
| Tone | `‹ current ›` steps through the tones and previews each step; the downward arrow opens the full library. Clicking the name replays it |
| All tones | Every built-in tone with a preview button per row, then a **Custom tone** row that picks a local file |
| Custom tone | Choose an mp3 / wav / ogg, then trim it on its waveform. **Preview slice** auditions exactly the range you selected, before anything is saved |

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

## The tones

Three tones ship with the plugin. Two of them are **original additive synthesis** — one clean bell-like ding, the character a system notification has — so nothing is sampled from another product and the package can carry them legally:

| Tone | Source | Notes |
| --- | --- | --- |
| 冰冰冰 (`bingbingbing`) | `assets/bingbingbing.ogg` | the meme tone, cut to one 1.06 s round, 12 642 bytes |
| Crisp (`crisp-a`) | `assets/crisp-a.ogg`, synthesized | two ascending notes (F#6 -> F#7), the payment-confirmation shape, 0.50 s, 6 477 bytes |
| Crisp short (`crisp-b`) | `assets/crisp-b.ogg`, synthesized | three ascending marimba notes (D4 -> A4 -> D5), the message-alert shape, 0.58 s, 7 068 bytes |
| Hiss (`hiss`) | `assets/hiss.ogg`, synthesized | one short breathy hiss: band-passed noise with no pitch, a hard onset and a fast release, 0.70 s, 11 053 bytes |
| Yikes (`yikes`) | `assets/yikes.ogg`, synthesized | a two-note descending whistle (A#4 -> D#4) with a breathy onset: surprise, 0.46 s, 8 457 bytes |

### Adding a tone

`tools/tones.json` is the only place a tone is declared:

1. put an Ogg in `assets/`;
2. add a row to `tools/tones.json` - `id`, `label`, `hint`, `source`, and `kind` (`synth` for
   generated work, `recording` for third-party material, which NOTICE must then document);
3. `powershell -NoProfile -ExecutionPolicy Bypass -File tools\embed-tones.ps1`;
4. bump the version and reload the window.

`lib/client.js` builds its library from `TONE_DEFINITIONS` in the generated block, so no code edit
is needed, and both drift checks (`tools/check-embedded-tone.mjs` and the PowerShell `-Check`)
read that same registry.


The synthesiser is `tools/synthesize_tones.py`. Each note is a stack of decaying partials plus a very short band-limited noise burst at the onset (what makes a bell read as crisp), summed into a track with hand-placed onsets and mixed down. Two details are worth keeping if you edit it:

* **Struck notes decay in dB, not in linear amplitude.** A linear `exp(-t / tau)` stays near its peak for the first `tau`, so a short note reads as a swell out of silence instead of a strike. Every note here falls as `10 ** (-3 * t / tau)`, which puts the peak at the attack — the same mistake produced an audible "crescendo" on the last note during development, and it is visible in a rendered envelope immediately.
* **Never shape a whole track that is built from struck notes.** A note already decays to silence, so any window applied across the track lands on a note's attack and turns that strike into a swell. Only the last 25 ms is faded, to avoid ending on a step.

* **A marimba's upper partials decay faster than its fundamental**, which is why the strike of `crisp-b` reads a fifth above and settles onto the fundamental. The 3rd and 5th partials are the loudest of the stack.

Rebuild the assets with

```bash
python tools/synthesize_tones.py assets            # WAV masters
python tools/synthesize_tones.py assets <ffmpeg>   # WAV + the Ogg the plugin embeds
```

and re-embed them into the bundle's marked `//#region embedded-tones` block with

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\embed-tones.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\embed-tones.ps1 -Check   # fails when they drift
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
```

The script validates the `OggS` magic on every asset before writing. **Ogg is required**: Chromium's `decodeAudioData` does not decode mp3, and embedding one would be pointless. Cross-platform equivalent: `node tools/check-embedded-tone.mjs`.

### Custom tones, trimmed in place

The settings offer a **Custom tone** entry. Picking a local file decodes it, draws its waveform, and opens a trim dialog: drag the start and end handles, audition exactly that slice, then save. Only the selected range is encoded (16-bit PCM WAV, the one container this plugin can write without an encoder) and stored in the settings document; 3 s or less is recommended, and anything over ~2 MB is refused rather than silently truncated.

See [NOTICE](NOTICE) for the meme tone's provenance. The synthesized tones carry no such caveat, and an end user can always upload their own instead.

---

## Project layout

```
dsh-completion-alert/
├─ package.json             dsh.pluginType=client, dsh.client.inject, bundle patch
├─ cordis.patch.yml         inserts the completion-alert row into a profile
├─ install.ps1              install (backups, patchReload=live, idempotent); -Uninstall too
├─ uninstall-all.ps1        removes every trace from a profile, leaving other plugins alone
├─ assets/                  the tone sources the embedder reads
│  ├─ bingbingbing.ogg      the meme tone (see NOTICE)
│  ├─ crisp-a.ogg/.wav      synthesized: one bright bell
│  └─ crisp-b.ogg/.wav      synthesized: the same, shorter and higher
├─ lib/
│  ├─ index.js              host half: the volatile settings schema + diagnostics route
│  ├─ client.js             browser half: detector, player, notice layer, settings page, inline tones

├─ tools/
│  ├─ synthesize_tones.py   renders the crisp tones from scratch (numpy)
│  ├─ embed-tones.ps1       re-embeds assets/ into lib/client.js (-Check for drift)
│  ├─ embed-audio.ps1       shim that forwards to embed-tones.ps1
│  └─ check-embedded-tone.mjs  drift + Ogg-magic check (cross-platform, CI)
└─ test/
   ├─ host.test.mjs         schema surface, volatile marker, diagnostics route
   ├─ client.test.mjs       tone library, settings coercion, completion edges, persistence
   └─ loader.mjs / -hooks   resolves the schemastery peer dependency for the tests
```

## Development

```bash
npm install          # pulls the schemastery peer dependency the host half imports
npm test             # 45 tests
node tools/check-embedded-tone.mjs
```

The test suite is behavioural rather than structural: the client tests load the real bundle into a `vm` sandbox with a stub React, a fake AudioContext and a fake dsh client context, then drive the stores to assert the things that decide behaviour — the tone library and its payloads against the packaged assets, the first-snapshot baseline, the busy → idle edge, the *background only* scope, debounced persistence into the plugin's own namespace, navigation through `uiWorkspace`, and the notice queue. The host tests validate the schema surface (including that a volatile node sits at a fixed path with no volatile field inside it, which the app rejects) and the diagnostics route round-trip.

CI (`.github/workflows/test.yml`) runs both plus the drift check on Node 24.

## Troubleshooting

| Symptom | What to do |
| --- | --- |
| Nothing happens at all | Reload the dsh window (`Ctrl+R`); check that `POST /api/completion-alert.diag` reports `watcher: true` |
| Notices appear but there is no sound | Check **Play the tone** and the volume; if the "click anywhere to enable the alert sound" pill is up, click the window once |
| A preview button does nothing | The player now reports why (`muted`, `no-audio-context`, `decode-failed`, `start-failed`, `awaiting-gesture`) — look for a `dsh-completion-alert` line in the renderer console |
| The app will not start after installing | A client bundle that requires something the module loader cannot resolve fails the **whole web boot**. Boot with **Disable third-party plugins** from the crash dialog, then send the newest `%APPDATA%\@deepseek-ai\dsh-desktop\logs\crash-*-web-boot.log` |
| The uninstall button reports failure | It already unloaded the plugin; run `uninstall-all.ps1` with dsh closed to remove the leftovers — see [Uninstall](#uninstall) |
| A custom tone is refused | Over ~2 MB, or not decodable by the browser. Trim it shorter in the dialog |

## Known limitations

- **Custom tones are stored as WAV.** The trim dialog writes 16-bit PCM because that is the only container the browser can encode without a library; 3 s or less keeps the settings document small.
- **Ogg only for the built-in replace path.** Custom uploads accept mp3/wav/ogg *for decoding* (Chromium decodes mp3 fine), but a payload embedded at build time must be Ogg.
- **One tone at a time.** A completion arriving while the previous tone still rings replaces it rather than mixing.
- **No OS-level notifications.** The notice is a dsh overlay card, so the plugin needs no Electron notification permission and stays consistent across web and desktop builds.
- **One of the three tones is meme material.** The crisp tones are original synthesis modelled on measured facts about two well-known notification sounds (see NOTICE); redistribute the meme tone only under the terms in NOTICE.

## License

MIT for the code — see [LICENSE](LICENSE). The bundled audio clip is third-party material; read [NOTICE](NOTICE) before redistributing.
