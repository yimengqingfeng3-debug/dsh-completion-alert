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
  [switch]$Uninstall,
  # Mount the row without copying this checkout into the profile. Use it after
  # installing the package from the registry, so the profile runs the published
  # artifact rather than the working tree:
  #
  #   npm install --prefix <profile> --no-save dsh-completion-alert
  #   powershell -File install.ps1 -NoCopy
  [switch]$NoCopy,
  # Explicit package directory to mount instead of '<profile>/node_modules/dsh-completion-alert'.
  [string]$PackageDir
)

$ErrorActionPreference = 'Stop'
$source = $PSScriptRoot
# UTF-8 without a BOM: the profile's YAML and JSON are read and written with it
# explicitly, because PowerShell 5.1's own defaults use the ANSI code page.
$utf8 = New-Object System.Text.UTF8Encoding($false)
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
    if (-not $bundled -and -not $NoCopy) {
  Write-Host ''
  Write-Host 'NOTE: this installation mounts the row from the profile patch, which the'
  Write-Host '      plugin manager cannot uninstall (it reports "other configurations are'
  Write-Host '      still using this bundle''s components"). Run mount-as-bundle.ps1 with dsh'
  Write-Host '      closed to mount it the way the manager manages bundles.'
}
Write-Host ''
    Write-Host "WARNING: this profile still lists '$packageName' under dsh.profile.bundles."
    Write-Host '         A listed bundle that is not installed fails startup, so remove that'
    Write-Host '         entry from package.json before starting dsh again.'
  }
  Write-Host 'Uninstalled.'
  return
}

# ---------------------------------------------------------------- install ----

# 1. Put the package into the profile's node_modules: copy this checkout, or
#    leave whatever is already there alone (the registry-installed artifact).
#    The copy replaces lib/ and tools/ wholesale, so a stale file can never
#    survive an update.
if ($NoCopy) {
  if (-not (Test-Path $installDir)) {
    throw "no package at $installDir; install it first (npm install --prefix `"$profileDir`" --no-save $packageName) or drop -NoCopy"
  }
  if ($PackageDir) { throw '-NoCopy and -PackageDir are mutually exclusive' }
  Write-Host "keeping the existing package -> $installDir (registry artifact, not copied)"
} else {
  if ($PackageDir) {
    if (-not (Test-Path (Join-Path $PackageDir 'lib\client.js'))) { throw "no client bundle under $PackageDir" }
    $installDir = $PackageDir
    Write-Host "mounting the package in place -> $installDir"
  } else {
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
  }
}

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

# 4. Keep the profile's pnpm supply-chain policy out of the way of the NEXT
#    install. pnpm 11+ refuses a freshly published package (default window: 24 h)
#    unless the exact version is exempted, and it normally offers to add that
#    exemption itself — which it cannot do when DSH drives the install with a
#    closed stdin, so `dsh plugin install` fails with
#    ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION instead. One line per installed
#    version is all pnpm needs; the profile already carries such lines for its
#    other plugins.
$workspacePath = Join-Path $profileDir 'pnpm-workspace.yaml'
if (Test-Path $workspacePath) {
  $installedManifest = Join-Path $installDir 'package.json'
  $installedVersion = $null
  if (Test-Path $installedManifest) {
    try {
      $installedVersion = (([System.IO.File]::ReadAllText($installedManifest, $utf8)) | ConvertFrom-Json).version
    } catch {
      $installedVersion = $null
    }
  }
  if ($installedVersion) {
    $exemption = "$packageName@$installedVersion"
    $workspaceText = [System.IO.File]::ReadAllText($workspacePath, $utf8)
    if ($workspaceText -match "(?m)^\s*-\s*$([regex]::Escape($exemption))\s*$") {
      Write-Host "pnpm release-age exemption already present: $exemption"
    } else {
      Backup-Once $workspacePath
      if ($workspaceText -match '(?m)^minimumReleaseAgeExclude:') {
        $updated = $workspaceText.TrimEnd() + "`n  - $exemption`n"
      } else {
        $updated = $workspaceText.TrimEnd() + "`nminimumReleaseAgeExclude:`n  - $exemption`n"
      }
      [System.IO.File]::WriteAllText($workspacePath, $updated, $utf8)
      Write-Host "added pnpm release-age exemption: $exemption"
    }
  }
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
