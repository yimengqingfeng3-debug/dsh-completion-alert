# tools/embed-audio.ps1 is superseded by tools/embed-tones.ps1, which embeds every
# built-in tone into lib/tones-data.js. This file stays as a thin forwarding shim
# so an older invocation still does the right thing.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\embed-audio.ps1
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\embed-audio.ps1 -Check
[CmdletBinding()]
param(
  [string]$Source,
  [string]$AssetsDir,
  [string]$OutputPath,
  [switch]$Check
)

$target = Join-Path $PSScriptRoot 'embed-tones.ps1'
Write-Host 'embed-audio.ps1 now forwards to embed-tones.ps1 (one payload per tone).'

# Only name the parameters that were actually given: embed-tones.ps1 resolves its
# own defaults, and passing an empty -AssetsDir would override them.
$forward = @{}
if ($Source) { $forward['Source'] = $Source }
if ($AssetsDir) { $forward['AssetsDir'] = $AssetsDir }
if ($OutputPath) { $forward['OutputPath'] = $OutputPath }
if ($Check) { $forward['Check'] = $true }

& $target @forward
exit $LASTEXITCODE
