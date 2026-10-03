# Changelog

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
