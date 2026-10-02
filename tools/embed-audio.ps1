# Regenerate the alert tone embedded in lib/client.js from the source Ogg file.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\embed-audio.ps1
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\embed-audio.ps1 -Source C:\path\to\tone.ogg
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\embed-audio.ps1 -Check
#
# The client bundle carries the payload inline, in a marked chunk:
#
#     //#region embedded-tone
#     var TONE_SOURCE_NAME = "...";
#     var TONE_BASE64 = [ "..." ].join("");
#     //#endregion embedded-tone
#
# This script rewrites exactly that chunk, so the rest of the bundle is never
# touched. -Check compares the bundle against the asset and exits non-zero when
# they differ, which is what CI runs.
#
# The payload must be Ogg Vorbis: Chromium's decodeAudioData does not decode mp3,
# and the plugin decodes the embedded bytes through Web Audio.
[CmdletBinding()]
param(
  [string]$Source,
  [string]$ClientPath,
  [switch]$Check
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
if (-not $ClientPath) { $ClientPath = Join-Path $root 'lib\client.js' }
if (-not $Source) { $Source = Join-Path $root 'assets\bingbingbing.ogg' }

if (-not (Test-Path $Source)) { throw "source audio not found: $Source" }
if (-not (Test-Path $ClientPath)) { throw "client bundle not found: $ClientPath" }

$bytes = [System.IO.File]::ReadAllBytes($Source)
if ($bytes.Length -lt 1000) { throw "source audio looks too small: $($bytes.Length) bytes" }
# Ogg pages begin with "OggS"; refuse anything else so a wrong file cannot
# silently become the alert tone.
$magic = [System.Text.Encoding]::ASCII.GetString($bytes[0..3])
if ($magic -ne 'OggS') { throw "source audio is not an Ogg stream (magic '$magic')" }

$base64 = [Convert]::ToBase64String($bytes)
$name = Split-Path $Source -Leaf

# The payload currently inside the bundle, reassembled from its chunk.
#
# The bundle is UTF-8 and carries Chinese copy, so it must be read as UTF-8
# explicitly: PowerShell 5.1's Get-Content/Set-Content default to the console's
# ANSI code page and would silently double-encode every non-ASCII literal in the
# file this script rewrites.
$utf8 = New-Object System.Text.UTF8Encoding($false)
$lines = @([System.IO.File]::ReadAllText($ClientPath, $utf8) -split "\r?\n")
$start = -1
$end = -1
for ($i = 0; $i -lt $lines.Count; $i++) {
  if ($lines[$i] -match '^\s*//#region embedded-tone\s*$') { $start = $i; continue }
  if ($start -ge 0 -and $lines[$i] -match '^\s*//#endregion embedded-tone\s*$') { $end = $i; break }
}
if ($start -lt 0 -or $end -lt 0) { throw "the embedded-tone marker chunk was not found in $ClientPath" }

$embedded = ''
$inPayload = $false
for ($i = $start; $i -le $end; $i++) {
  if ($lines[$i] -match 'var TONE_BASE64\s*=\s*\[') {
    $inPayload = $true
    # A one-line form (`var TONE_BASE64 = ['...'].join('')`) carries the payload
    # on the same line, after the bracket.
    $after = $lines[$i].Substring($lines[$i].IndexOf('[') + 1)
    $inPayload = -not ($after -match '\]')
    foreach ($match in [regex]::Matches($after, "'([A-Za-z0-9+/=]+)'")) { $embedded += $match.Groups[1].Value }
    continue
  }
  if ($inPayload -and $lines[$i] -match '\]\s*\.join') { break }
  if ($inPayload) {
    foreach ($match in [regex]::Matches($lines[$i], "'([A-Za-z0-9+/=]+)'")) { $embedded += $match.Groups[1].Value }
  }
}

if ($Check) {
  if ($embedded -eq $base64) {
    Write-Host "embedded tone matches $name ($($base64.Length) base64 chars)"
    return
  }
  if ($embedded.Length -eq 0) {
    throw "the bundle carries no tone payload; run tools\embed-audio.ps1"
  }
  throw "the embedded tone does NOT match $name ($($embedded.Length) vs $($base64.Length) base64 chars); run tools\embed-audio.ps1"
}

# Wrap the payload so the generated lines stay readable in a diff.
$chunks = @()
for ($i = 0; $i -lt $base64.Length; $i += 96) {
  $length = [Math]::Min(96, $base64.Length - $i)
  $chunks += "      '" + $base64.Substring($i, $length) + "',"
}
$chunk = @(
  '    //#region embedded-tone',
  '    /** Original asset name (informational). */',
  "    var TONE_SOURCE_NAME = '$name';",
  '    /** The Ogg Vorbis payload shipped as the built-in alert tone. */',
  '    var TONE_BASE64 = ['
) + $chunks + @(
  "    ].join('');",
  '    //#endregion embedded-tone'
)

$next = @()
if ($start -gt 0) { $next += $lines[0..($start - 1)] }
$next += $chunk
if ($end -lt $lines.Count - 1) { $next += $lines[($end + 1)..($lines.Count - 1)] }

$utf8 = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($ClientPath, (($next -join "`n") + "`n"), $utf8)

Write-Host "embedded $name ($($bytes.Length) bytes -> $($base64.Length) base64 chars) into"
Write-Host "  $ClientPath"
