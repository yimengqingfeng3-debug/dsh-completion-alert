# dsh-completion-alert installer.
#
# ASCII-only on purpose: Windows PowerShell 5.1 mis-decodes non-ASCII script text
# that has no BOM, and this file must run under both hosts.
#
# Installs the plugin into a dsh profile:
#
#   1. copy this package into <profile>/node_modules/dsh-completion-alert
#   2. append the `completion-alert` insert to the profile's cordis.patch.yml
#      (unless the profile lists this package under dsh.profile.bundles, whose
#      own bundle patch already inserts the row — a duplicate row id is a hard
#      boot failure)
#   3. make sure dsh.profile.patchReload = live, so later edits recompose
#      without an app restart
#
# Profiles with `patchReload: live` recompose each write without a restart; the
# desktop app composes its reserved profile at launch, so it needs ONE restart
# (or a page reload) to pick the browser bundle up. Every profile file this
# script edits is backed up under <profile>\.completion-alert-backup\ first.
#
#   pwsh -File install.ps1                      # install into the running desktop profile
#   pwsh -File install.ps1 -Profile web
#   pwsh -File install.ps1 -Uninstall           # remove the row and the package
[CmdletBinding()]
param(
  [string]$Profile = 'desktop',
  [string]$DshHome = $(if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $HOME '.dsh' }),
  [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'
$source = $PSScriptRoot
$profileDir = Join-Path (Join-Path $DshHome 'profiles') $Profile
$packageJsonPath = Join-Path $profileDir 'package.json'
$patchPath = Join-Path $profileDir 'cordis.patch.yml'
$installDir = Join-Path (Join-Path $profileDir 'node_modules') 'dsh-completion-alert'
$backupDir = Join-Path $profileDir '.completion-alert-backup'
$rowId = 'completion-alert'
$packageName = 'dsh-completion-alert'

if (-not (Test-Path $profileDir)) { throw "profile directory not found: $profileDir" }
if (-not (Test-Path $packageJsonPath)) { throw "profile manifest not found: $packageJsonPath" }

$insertLines = @(
  '- insert:',
  "    - id: $rowId",
  "      name: '$packageName'"
)

# ---------------------------------------------------------------- helpers ----

function Read-PatchLines {
  if (-not (Test-Path $patchPath)) { return @() }
  # Read UTF-8 explicitly: the patch may carry non-ASCII copy (plugin labels,
  # comments) and PowerShell 5.1's Get-Content defaults to the ANSI code page.
  $utf8 = New-Object System.Text.UTF8Encoding($false)
  return @([System.IO.File]::ReadAllText($patchPath, $utf8) -split "\r?\n")
}

function Write-PatchLines([string[]]$lines) {
  # A patch layer holding only comments parses to null, not to the empty array
  # the launcher expects, so always leave an explicit list behind.
  $meaningful = @($lines | Where-Object { $_.Trim() -ne '' -and -not $_.Trim().StartsWith('#') })
  if ($meaningful.Count -eq 0) { $lines = @($lines) + @('[]') }
  $text = ($lines -join "`n").TrimEnd() + "`n"
  # UTF-8 without a BOM under both PowerShell hosts.
  [System.IO.File]::WriteAllText($patchPath, $text, (New-Object System.Text.UTF8Encoding($false)))
}

function Backup-Once([string]$path) {
  if (-not (Test-Path $path)) { return }
  if (-not (Test-Path $backupDir)) { New-Item -ItemType Directory -Path $backupDir | Out-Null }
  $target = Join-Path $backupDir (Split-Path $path -Leaf)
  if (-not (Test-Path $target)) { Copy-Item $path $target }
}

# Index of the `- insert:` line opening the block that holds `- id: <id>`, or -1.
function Find-InsertStart([string[]]$lines, [string]$id) {
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -notmatch '^\s*- insert:\s*$') { continue }
    for ($j = $i + 1; $j -lt [Math]::Min($i + 4, $lines.Count); $j++) {
      if ($lines[$j] -match "^\s*- id:\s*$([regex]::Escape($id))\s*$") { return $i }
    }
  }
  return -1
}

# Index of a top-level `- id: <id>` row, or -1.
function Find-RowLine([string[]]$lines, [string]$id) {
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match "^\s*- id:\s*$([regex]::Escape($id))\s*$") { return $i }
  }
  return -1
}

# Remove a whole row: `- id: X` plus its more-indented continuation, and the
# `- insert:` header when the row belonged to one.
function Remove-Row([string[]]$lines, [string]$id) {
  $start = Find-RowLine $lines $id
  if ($start -lt 0) { return $lines }
  $end = $start
  for ($j = $start + 1; $j -lt $lines.Count; $j++) {
    if ($lines[$j] -match '^\s*$') { break }
    if ($lines[$j] -match '^\s*-') { break }
    $end = $j
  }
  if ($start -gt 0 -and $lines[$start - 1] -match '^\s*- insert:\s*$') { $start -= 1 }
  $kept = @()
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($i -lt $start -or $i -gt $end) { $kept += $lines[$i] }
  }
  return $kept
}

# Append a top-level row, dropping the empty flow sequence and trailing blanks.
function Add-Row([string[]]$lines, [string[]]$rowLines) {
  $kept = @()
  foreach ($line in $lines) { if ($line.Trim() -ne '[]') { $kept += $line } }
  while ($kept.Count -gt 0 -and $kept[$kept.Count - 1].Trim() -eq '') {
    if ($kept.Count -eq 1) { $kept = @() } else { $kept = @($kept[0..($kept.Count - 2)]) }
  }
  return @($kept) + @('') + $rowLines
}

# The package ships its own bundle patch, so a profile that lists it under
# `dsh.profile.bundles` already gets the row inserted.
function Test-Bundled {
  try {
    $text = [System.IO.File]::ReadAllText($packageJsonPath, (New-Object System.Text.UTF8Encoding($false))).TrimStart([char]0xFEFF)
    $manifest = $text | ConvertFrom-Json
    return (@($manifest.dsh.profile.bundles) -contains $packageName)
  } catch {
    return $false
  }
}

# -------------------------------------------------------------- uninstall ----

if ($Uninstall) {
  Backup-Once $patchPath
  $lines = Read-PatchLines
  if ((Find-InsertStart $lines $rowId) -ge 0) {
    Write-PatchLines (Remove-Row $lines $rowId)
    Write-Host "removed the $rowId row from $patchPath"
  } else {
    Write-Host "no $rowId row in $patchPath"
  }
  if (Test-Path $installDir) {
    Remove-Item -Recurse -Force $installDir
    Write-Host "removed $installDir"
  }
  if (Test-Bundled) {
    Write-Host ''
    Write-Host "WARNING: this profile still lists '$packageName' under dsh.profile.bundles."
    Write-Host '         A listed bundle that is not installed fails startup, so remove that'
    Write-Host '         entry from package.json before starting dsh again.'
  }
  Write-Host 'Uninstalled.'
  return
}

# ---------------------------------------------------------------- install ----

# 1. Copy the package into the profile's node_modules. A plain directory is
#    enough: the loader resolves the row name relative to the profile. The lib
#    directory is replaced wholesale so a stale file can never survive an update.
if (-not (Test-Path $installDir)) { New-Item -ItemType Directory -Path $installDir | Out-Null }
foreach ($item in @('package.json', 'cordis.patch.yml', 'README.md')) {
  if (Test-Path (Join-Path $source $item)) { Copy-Item (Join-Path $source $item) $installDir -Force }
}
$installedLib = Join-Path $installDir 'lib'
if (Test-Path $installedLib) { Remove-Item -Recurse -Force $installedLib }
Copy-Item (Join-Path $source 'lib') $installDir -Recurse -Force
$installedTools = Join-Path $installDir 'tools'
if (Test-Path (Join-Path $source 'tools')) {
  if (Test-Path $installedTools) { Remove-Item -Recurse -Force $installedTools }
  Copy-Item (Join-Path $source 'tools') $installDir -Recurse -Force
}
Write-Host "installed package -> $installDir"

# 2. Mount the row.
Backup-Once $patchPath
$lines = Read-PatchLines
$bundled = Test-Bundled
$needsInsert = (-not $bundled) -and ((Find-InsertStart $lines $rowId) -lt 0)

if ($bundled) {
  if ((Find-InsertStart $lines $rowId) -ge 0) {
    Write-Host "removed the conflicting manual $rowId row (the profile mounts this package as a bundle)"
    Write-PatchLines (Remove-Row $lines $rowId)
  } else {
    Write-Host "the profile lists $packageName in dsh.profile.bundles: its bundle patch inserts the row"
  }
} elseif ($needsInsert) {
  Write-PatchLines (Add-Row $lines $insertLines)
  Write-Host "mounted the plugin in $patchPath"
} else {
  Write-Host "the $rowId row is already in $patchPath"
}

# 3. Make later patch edits recompose without a restart. Only the manifest key is
#    touched, and only when it is absent.
Backup-Once $packageJsonPath
$manifestText = [System.IO.File]::ReadAllText($packageJsonPath)
if ($manifestText -notmatch '"patchReload"\s*:\s*"live"') {
  $manifest = $manifestText | ConvertFrom-Json
  if ($manifest.dsh -eq $null) { $manifest | Add-Member -NotePropertyName dsh -NotePropertyValue ([pscustomobject]@{}) -Force }
  if ($manifest.dsh.profile -eq $null) { $manifest.dsh | Add-Member -NotePropertyName profile -NotePropertyValue ([pscustomobject]@{}) -Force }
  $manifest.dsh.profile | Add-Member -NotePropertyName patchReload -NotePropertyValue 'live' -Force
  $json = $manifest | ConvertTo-Json -Depth 12
  [System.IO.File]::WriteAllText($packageJsonPath, $json + [Environment]::NewLine, (New-Object System.Text.UTF8Encoding($false)))
  Write-Host 'enabled dsh.profile.patchReload = live (later edits recompose without a restart)'
}

Write-Host ''
Write-Host 'Done.'
Write-Host '  * A finished round of work plays the alert tone once and raises a notice in'
Write-Host '    the bottom-right corner; clicking it opens that session.'
Write-Host '  * Settings -> 工作完成提示 configures the switch, the alert scope, the volume,'
Write-Host '    the preview and a custom tone upload.'
Write-Host ''
Write-Host 'If the notice does not appear: reload the DSH window (Ctrl+Shift+R), and for a'
Write-Host 'cold profile restart the app once. Verify the host half is mounted with:'
Write-Host '  curl http://127.0.0.1:<port>/api/completion-alert.diag'
