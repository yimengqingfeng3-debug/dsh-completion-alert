# Embed every built-in tone into lib/client.js, in the marked block:
#
#     //#region embedded-tones
#     var TONE_SOURCES = { ... };
#     var TONE_BASE64 = { ... };
#     //#endregion embedded-tones
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\embed-tones.ps1
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\embed-tones.ps1 -Check
#
# WHY INLINE, and not a sibling `tones-data.js` that the bundle requires:
# the dsh client module loader resolves `require()` only for platform seed words
# (react) and registered package factories. A relative specifier makes the whole
# web boot fail with
#
#   client-modules: require("./tones-data.js") missed the module table
#
# which is an app-wide startup failure, not a degraded plugin. Every shipped dsh
# web plugin inlines its generated payloads for exactly this reason.
#
# The block is replaced wholesale; the rest of the bundle is never touched. The
# file is read and written as UTF-8 WITHOUT a BOM explicitly, because PowerShell
# 5.1's own defaults use the ANSI code page and would double-encode the bundle's
# Chinese copy.
[CmdletBinding()]
param(
  [string]$AssetsDir,
  [string]$ClientPath,
  [switch]$Check
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
if (-not $AssetsDir) { $AssetsDir = Join-Path $root 'assets' }
if (-not $ClientPath) { $ClientPath = Join-Path $root 'lib\client.js' }

$utf8 = New-Object System.Text.UTF8Encoding($false)

# id -> asset file name. Order is the order the settings list shows.
$tones = [ordered]@{
  'bingbingbing' = 'bingbingbing.ogg'
  'crisp-a'      = 'crisp-a.ogg'
  'crisp-b'      = 'crisp-b.ogg'
}

$entries = @()
foreach ($id in $tones.Keys) {
  $file = Join-Path $AssetsDir $tones[$id]
  if (-not (Test-Path $file)) { throw "tone asset not found: $file" }
  $bytes = [System.IO.File]::ReadAllBytes($file)
  if ($bytes.Length -lt 500) { throw "tone asset looks too small: $file ($($bytes.Length) bytes)" }
  $magic = [System.Text.Encoding]::ASCII.GetString($bytes[0..3])
  if ($magic -ne 'OggS') { throw "$file is not an Ogg stream (magic '$magic')" }
  $entries += [pscustomobject]@{
    id     = $id
    source = $tones[$id]
    bytes  = $bytes.Length
    base64 = [Convert]::ToBase64String($bytes)
  }
}

# ---- the generated block -----------------------------------------------------

$block = @()
$block += '    //#region embedded-tones'
$block += '    /** Tone id -> the asset file it was generated from (informational). */'
$block += '    var TONE_SOURCES = {'
foreach ($entry in $entries) { $block += "      '$($entry.id)': '$($entry.source)'," }
$block += '    };'
$block += ''
$block += '    /** Tone id -> base64 of its Ogg Vorbis payload. */'
$block += '    var TONE_BASE64 = {'
foreach ($entry in $entries) {
  $block += "      '$($entry.id)':"
  $chunks = @()
  for ($i = 0; $i -lt $entry.base64.Length; $i += 96) {
    $length = [Math]::Min(96, $entry.base64.Length - $i)
    $chunks += "        '" + $entry.base64.Substring($i, $length) + "'"
  }
  for ($c = 0; $c -lt $chunks.Count; $c++) {
    if ($c -lt $chunks.Count - 1) { $block += ($chunks[$c] + ' +') }
    else { $block += ($chunks[$c] + ',') }
  }
}
$block += '    };'
$block += '    //#endregion embedded-tones'

# ---- splice it into the bundle ----------------------------------------------

if (-not (Test-Path $ClientPath)) { throw "client bundle not found: $ClientPath" }
$lines = @([System.IO.File]::ReadAllText($ClientPath, $utf8) -split "\r?\n")
$start = -1
$end = -1
for ($i = 0; $i -lt $lines.Count; $i++) {
  if ($lines[$i] -match '^\s*//#region embedded-tones\s*$') { $start = $i; continue }
  if ($start -ge 0 -and $lines[$i] -match '^\s*//#endregion embedded-tones\s*$') { $end = $i; break }
}
if ($start -lt 0 -or $end -lt 0) { throw "the embedded-tones marker block was not found in $ClientPath" }

if ($Check) {
  $current = ($lines[($start + 1)..($end - 1)] -join "`n")
  $missing = @()
  foreach ($entry in $entries) {
    # The payload is wrapped into 96-char chunks, so compare on a slice that
    # cannot straddle a wrap.
    if (-not $current.Contains($entry.base64.Substring(0, 90))) { $missing += $entry.id }
  }
  if ($missing.Count -gt 0) {
    throw "the embedded tones are out of date for: $($missing -join ', ') - run tools\embed-tones.ps1"
  }
  Write-Host "client.js matches assets: $($entries.Count) tones"
  return
}

$next = @()
if ($start -gt 0) { $next += $lines[0..($start - 1)] }
$next += $block
if ($end -lt $lines.Count - 1) { $next += $lines[($end + 1)..($lines.Count - 1)] }

[System.IO.File]::WriteAllText($ClientPath, (($next -join "`n") + "`n"), $utf8)

foreach ($entry in $entries) {
  Write-Host ("  {0,-14} {1,8} bytes -> {2,8} base64 chars" -f $entry.id, $entry.bytes, $entry.base64.Length)
}
Write-Host "embedded into $ClientPath"
