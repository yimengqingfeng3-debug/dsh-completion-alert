# Add a tone from an audio file on this machine, without publishing it.
#
# This is the local-only path: the file is converted to Ogg, copied into assets/
# and registered in tools/tones.local.json, which is gitignored and is merged on
# top of the shipped registry by tools/embed-tones.ps1. The tone then works
# exactly like a built-in one - it appears in the settings list with its own
# label, the arrows step onto it - but nothing about it leaves this machine.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\use-local-tone.ps1 `
#     -Id hiss -Label "哈气" -Hint "猫哈气" -Source C:\clips\haqi.wav
#
#   -Trim 2.30 2.72   take only that slice (seconds), which is what makes a clip
#                     out of a compilation
#   -Force            replace a row that already claims this id
#
# After it runs, reload the dsh window (Ctrl+R): the tone is already in the
# bundle, because this checkout is mounted in place.
#
# This file is ASCII-only on purpose: Windows PowerShell 5.1 reads .ps1 files in
# the ANSI code page, and non-ASCII literals break its parser here. Pass labels
# as arguments instead of editing them in.
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$Id,
  [Parameter(Mandatory = $true)][string]$Label,
  [string]$Hint = '',
  [Parameter(Mandatory = $true)][string]$Source,
  [switch]$Recording,
  [double[]]$Trim,
  [string]$Ffmpeg,
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$assetsDir = Join-Path $root 'assets'
$localPath = Join-Path $root 'tools\tones.local.json'
$utf8 = New-Object System.Text.UTF8Encoding($false)

if ($Trim -and $Trim.Count -ne 2) { throw '-Trim needs exactly two values: start and end seconds' }
if (-not (Test-Path $Source)) { throw "source audio not found: $Source" }
if ($Id -notmatch '^[a-z0-9][a-z0-9-]*$') { throw "id must be lower-case letters, digits and dashes: '$Id'" }

if (-not $Ffmpeg) {
  foreach ($candidate in @('ffmpeg', 'C:\Users\shenghua\Desktop\dsh\scratch\bin\ffmpeg.exe')) {
    if (Test-Path $candidate) { $Ffmpeg = $candidate; break }
    $found = Get-Command $candidate -ErrorAction SilentlyContinue
    if ($found) { $Ffmpeg = $found.Source; break }
  }
}
if (-not $Ffmpeg -or -not (Test-Path $Ffmpeg)) { throw 'ffmpeg not found; pass -Ffmpeg <path>' }

# ---- the registry rows -------------------------------------------------------

$rows = @()
if (Test-Path $localPath) {
  $existing = [System.IO.File]::ReadAllText($localPath, $utf8) | ConvertFrom-Json
  if ($existing.tones) { $rows = @($existing.tones) }
}
$already = @($rows | Where-Object { $_.id -eq $Id })
if ($already.Count -gt 0) {
  if (-not $Force) { throw "tools/tones.local.json already has a tone with id '$Id'; pass -Force to replace it" }
  $rows = @($rows | Where-Object { $_.id -ne $Id })
}

# `.local.ogg` is the convention that keeps a local-only tone out of git (see
# .gitignore): the suffix is the difference between "part of the package" and
# "lives on this machine".
$oggName = "$Id.local.ogg"
$oggPath = Join-Path $assetsDir $oggName
# A previous run may have written the plain name; clear both so the registry and
# the folder never disagree.
foreach ($stale in @($oggPath, (Join-Path $assetsDir "$Id.ogg"))) {
  if (Test-Path $stale) { Remove-Item $stale -Force }
}

# ---- convert -----------------------------------------------------------------

$args = @('-y', '-hide_banner', '-loglevel', 'error')
if ($Trim) { $args += @('-ss', [string]$Trim[0], '-t', [string]($Trim[1] - $Trim[0])) }
$args += @('-i', $Source, '-ac', '1', '-ar', '48000')
if ($Trim) { $args += @('-af', 'afade=t=in:st=0:d=0.005,afade=t=out:st=' + [string]([math]::Max(0, ($Trim[1] - $Trim[0]) - 0.02)) + ':d=0.02') }
$args += @('-c:a', 'libvorbis', '-q:a', '5', $oggPath)
& $Ffmpeg @args
if ($LASTEXITCODE -ne 0) { throw "ffmpeg failed to write $oggPath" }
if (-not (Test-Path $oggPath)) { throw "ffmpeg produced nothing at $oggPath" }

$bytes = [System.IO.File]::ReadAllBytes($oggPath)
$magic = [System.Text.Encoding]::ASCII.GetString($bytes[0..3])
if ($magic -ne 'OggS') { throw "$oggPath is not an Ogg stream" }

# ---- record it locally -------------------------------------------------------

$kind = if ($Recording) { 'recording' } else { 'synth' }
$row = [ordered]@{
  id     = $Id
  label  = $Label
  hint   = $Hint
  source = $oggName
  kind   = $kind
}
$rows += [pscustomobject]$row
# Written by hand: ConvertTo-Json escapes non-ASCII, and these labels are Chinese.
# Single-quoted PowerShell strings do NOT expand backtick escapes, so the JSON is
# assembled from real newlines rather than from '`n' literals.
$jsonLines = @('{', '  "tones": [')
for ($index = 0; $index -lt $rows.Count; $index++) {
  $item = $rows[$index]
  $jsonLines += '    {'
  $jsonLines += '      "id": "' + $item.id + '",'
  $jsonLines += '      "label": "' + $item.label + '",'
  $jsonLines += '      "hint": "' + $item.hint + '",'
  $jsonLines += '      "source": "' + $item.source + '",'
  $jsonLines += '      "kind": "' + $item.kind + '"'
  $jsonLines += if ($index -lt $rows.Count - 1) { '    },' } else { '    }' }
}
$jsonLines += '  ]'
$jsonLines += '}'
$json = ($jsonLines -join [Environment]::NewLine) + [Environment]::NewLine
[System.IO.File]::WriteAllText($localPath, $json, $utf8)

Write-Host "converted  $Source -> $oggName ($($bytes.Length) bytes)"
Write-Host "registered $Id ('$Label', kind=$kind) in tools\tones.local.json"

# ---- bake it into the bundle -------------------------------------------------

& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'embed-tones.ps1')
if ($LASTEXITCODE -ne 0) { throw 'embed-tones.ps1 failed' }

Write-Host ''
Write-Host "Done. Reload the dsh window (Ctrl+R); '$Label' is in the tone list."
