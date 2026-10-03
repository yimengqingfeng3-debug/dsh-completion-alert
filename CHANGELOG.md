# Changelog

## 1.7.0

**The alert was silent for every completed round, and preferences were never
stored. Both are fixed, and both were found by measurement rather than guesswork
- the desktop renderer cannot be inspected, so the plugin was taught to report
its own decisions.**

### The tone arrived too early to be told apart from a stop

The browser half detects "a round finished" from the client's session-status
projection, and asks the Host how that turn ended before announcing it. Measured
in the running app, with both sides timestamped:

```
17:20:28.355  the browser asks      -> outcome: "unknown"
17:20:28.456  the Host records it   -> reason: { kind: "completed" }
```

The status projection flips to idle **about 100 ms before** the Host appends the
durable `turn/end` event, so the first question was routinely answered "unknown"
for rounds that finished normally. Since 1.6.0 an unknown outcome stays quiet
(that is what keeps a hand-stopped round silent), which meant **every** natural
completion was silent.

The lookup is now retried (up to 6 times, 250 ms apart) while the answer is
unknown, so the record is picked up as soon as it lands. An unknown that never
resolves still stays quiet - the rule that stops a manual Stop from announcing is
untouched.

### Preferences were reported as saved and never stored

The diagnostics showed every field write refused:

```
settingsWrite: { fields: "enabled", accepted: false }
settingsWrite: { fields: "volume",  accepted: false }
settingsWrite: { fields: "toneId",  accepted: false }
```

`ctx.configForms` falls back to `persistence: "memory"` on a non-loopback page,
and a memory form answers every write with `false` - so the settings page looked
like it saved and the choice was gone after a restart.

The plugin now keeps its own document: the host half serves
`GET/POST /api/completion-alert.settings`, writing
`completion-alert.settings.json` beside the profile's other plugin data, and the
browser half falls back to it whenever the transport cannot write. Preferences
survive a restart either way; the scope row says which store is in use.

### Diagnosis

The browser half can mirror its reports to an absolute URL (`DIAG_MIRROR`, empty
in a release build), and the host half writes what its `session/event` listener
sees to `turn-outcomes.debug.json`. Both are what made the two faults above
provable instead of guessable.

## 1.6.1

**Why the uninstall button kept failing, and what actually fixes it.**

The plugin manager drives the pnpm the app ships (11.7.0), which checks the
profile against a 24-hour release-age quarantine. That verdict is **cached for
about a minute**: a removal right after a successful install passes, and one
whose cache has expired fails with `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`. The
exemption list (`minimumReleaseAgeExclude`) does not help here - 11.7.0 honours it
during an install but not during the removal verification.

The failure is also misleading: by the time pnpm refuses, the plugin manager has
already unloaded the plugin and dropped its bundle listing, so the removal looks
like it did nothing when in fact only the package directory is left.

The fix is to disable the quarantine for the profile, which is what its own
install script writes:

```yaml
# <profile>/pnpm-workspace.yaml
minimumReleaseAge: 0
```

Both READMEs now document that, and the "known issue" paragraph that blamed the
exemption list is gone.

## 1.6.0

**Six requests, one bug.**

* The custom tone can be **named** while trimming it, and **renamed** afterwards
  from the library's custom row.
* **Repeat count**: one alert can play its tone 1 to 4 times. The repeats are
  separate source nodes on a timer, so a repeat replays the *slice* the user
  chose, and Stop cancels the ones still pending. The stop-guard scales with the
  count, or it would cut a repeated tone short.
* Every dialog now has a **closing animation** to match its opening one.
* The trim dialog's **waveform is drawn at device resolution** on a backing store
  sized by `devicePixelRatio`, instead of a 520x120 bitmap stretched by CSS -
  that stretch was the blur.
* Picking a file from the library **opens the trim dialog on top of it** rather
  than replacing it, so closing the trim returns to the library, in place, with
  the custom row right where it was.
* The two placeholder tones from 1.2/1.3 are **gone**: `hiss` and `yikes` were
  synthesized stand-ins, and the tones that replaced them are the user's own.

Fixed: **a hand-stopped round no longer announces.** The rule is now that only an
outcome the Host positively reports as a completion is announced - `completed`,
`blocked` or `max-tokens`. An `aborted` round and an *unknown* outcome both stay
quiet. Treating "unknown" as "finished" was the bug: a stop can hide in an
unavailable answer. The "Announce stopped rounds too" row is removed with it.

## 1.5.1

**Uninstalling through the plugin manager now works.** The manager's uninstall
disables the bundle and then checks that none of the bundle's rows is still
loaded. A row installed through the profile's own `cordis.patch.yml` survives
that step, so removal failed with *"other configurations are still using this
bundle's components"* (`bundle-in-use`) - and `install.ps1` created exactly that
situation by appending the manual row.

`mount-as-bundle.ps1` moves an existing installation onto the bundle path (the
way `dsh-cost-balance-indicator` is mounted): the package goes into
`dsh.profile.bundles`, the redundant manual row is removed, and its own
`cordis.patch.yml` supplies the row. Run it with dsh closed; backups end in
`.bak-bundle`.

## 1.5.0

**The arrows no longer snap back to 冰冰冰.** Picking a tone (or a scope) could be
undone a moment later by the stored document: a refused or in-flight write makes
the settings form re-read the Host document, and that older document was applied
over the choice the user had just made. Fields the user has changed are now
protected until the stored document agrees with them, and a refused write is
retried once per value instead of being dropped.

Two faults found while fixing it, both worth recording:

* the retry was unbounded. Clearing its in-flight marker on every attempt turned
  it into a loop that also kept the page's timers alive, so the test runner never
  exited. It is now one retry per value, and the suite finishes in seconds again.
* the tone payloads for locally added tones were being written as `<id>.ogg`,
  which is a name git tracks. Local tones now use `<id>.local.ogg`, the suffix
  `.gitignore` already covered.

**Local-only tones.** `tools/use-local-tone.ps1` turns an audio file on this
machine into a tone that behaves like a built-in one - its own label in the
settings list, its own row, reachable with the arrows - while
`tools/tones.local.json` and `assets/*.local.ogg` stay out of git and out of the
package. `npm run prepublishOnly` (and CI) now refuse to publish a bundle that
carries one, because this checkout is mounted in place and its bundle does.

## 1.4.0

**Preferences now actually persist.** Everything before this release kept its
choices in the window only, because the plugin wrote through a service name that
does not exist. Three separate faults stacked up:

1. `settingsScope` is not a service in dsh. The real one is `configForms`, and a
   plugin writes through `ctx.configForms.get(<entry id>)`.
2. The mount waited on `["configForms", "settingsScope"]` together. `whenReady`
   fires only when *every* listed service exists, so naming a service that never
   exists skipped the one that does.
3. A form reports `{ status, value, ... }` and only becomes readable at
   `status: "ready"`. Reading earlier looks exactly like "the user chose the
   defaults", and would have written those defaults over the stored document.

Writes answer asynchronously through `ConfigForm.set`, so the plugin now reports
each attempt's real outcome over the diagnostics route, and the settings page
states where preferences live ("saved in this profile", "read-only", or "this
window only") instead of looking identical in all three cases.

Note for anyone whose dsh has `@deepseek-ai/dsh-client-ui-settings` disabled: that
plugin is what provides `configForms`, so with it off no plugin's settings can be
stored. The page says so now.

## 1.3.0

* the reported UI bugs: the downward chevron pointed up; the tone library had no
  entrance animation; **Preview slice** in the trim dialog played nothing (it
  asked for the *saved* custom tone, which is still empty while a file is only
  being picked).
* pressing **Stop** no longer fires the alert: the host half records each
  `turn/end` reason and the client asks before announcing. A new row,
  *Announce stopped rounds too*, is off by default.
* while the window is hidden or minimised, every finished round is announced
  regardless of the alert scope, with a row under the alert scope to turn that
  off.
* tones are declared in `tools/tones.json`; two new synthesized ones (`hiss`,
  `yikes`) ship alongside the crisp pair.

## 1.2.1 / 1.2.0

* the two crisp tones were retuned to the sounds they imitate (a two-note
  ascending payment chime; a three-note ascending marimba message tone), built
  from measured facts rather than from any recording.
* fixed two envelope faults found by rendering the generated audio: struck notes
  now decay in dB and peak at their attack, and no window is applied across a
  track built from struck notes.

## 1.1.4 - 1.1.0

* 1.1.4 ships `uninstall-all.ps1` in the tarball.
* 1.1.3 makes the cleanup path complete and verified, and fixes its lockfile pass
  (it matched `packages:` keys only at a fixed indent, so a `snapshots:` entry
  survived).
* 1.1.2 fixes the preview entry points, which existed on the player but not on
  the facade the settings page calls - so every preview button threw inside a
  React handler and was silently dead.
* 1.1.1 stops the client bundle from requiring a sibling file. A relative
  `require` fails the whole web boot, not just the plugin.

## 1.0.0

First release: a completion tone plus a clickable notice in the corner.
