# Mount this plugin the way the plugin manager mounts a bundle.
#
# The manager refuses to remove a plugin it does not own: its uninstall flow
# disables the bundle, then checks that none of the bundle's rows is still
# loaded, and a row that came from the profile's own `cordis.patch.yml` survives
# that step - so the removal fails with "other configurations are still using
# this bundle's components" (`bundle-in-use`) and there is no way out from the
# UI.
#
# This script moves the plugin onto the bundle path instead:
#
#   1. adds the package to `dsh.profile.bundles` in the profile's package.json;
#   2. removes any `completion-alert` insert row from the profile's
#      cordis.patch.yml, because with the package bundle-listed its own
#      cordis.patch.yml inserts that row (a duplicate row id is a hard boot
#      failure);
#   3. adds the pnpm release-age exemption for the mounted version, so a later
#      install step can proceed.
#
# Run it with dsh CLOSED, once. Close dsh, run this, start dsh, then the
# plugin's 卸载 / Uninstall button in the plugin manager works.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\mount-as-bundle.ps1
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\mount-as-bundle.ps1 -WhatIf
#
# This file is ASCII-only on purpose: Windows PowerShell 5.1 reads .ps1 files in
# the ANSI code page, and non-ASCII literals break its parser.
[CmdletBinding()]
param(
  [string]$Profile,
  [string]$ProfileDir,
  [switch]$WhatIf
)

$ErrorActionPreference = 'Stop'
$packageName = 'dsh-completion-alert'
$rowId = 'completion-alert'
$utf8 = New-Object System.Text.UTF8Encoding($false)

if (-not $ProfileDir) {
  $dshHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }
  if (-not $Profile) { $Profile = 'desktop' }
  $ProfileDir = Join-Path (Join-Path $dshHome 'profiles') $Profile
}
if (-not (Test-Path (Join-Path $ProfileDir 'package.json'))) {
  throw "not a profile directory (no package.json): $ProfileDir"
}
$manifestPath = Join-Path $ProfileDir 'package.json'
$patchPath = Join-Path $ProfileDir 'cordis.patch.yml'
$workspacePath = Join-Path $ProfileDir 'pnpm-workspace.yaml'

# --- 1. the manifest ----------------------------------------------------------

$manifestText = [System.IO.File]::ReadAllText($manifestPath, $utf8)
$manifest = $manifestText | ConvertFrom-Json
$profileNode = $manifest.dsh.profile
if ($null -eq $profileNode) { throw "the profile manifest has no dsh.profile section: $manifestPath" }

$bundles = @()
if ($profileNode.bundles) { $bundles = @($profileNode.bundles) }
if ($bundles -contains $packageName) {
  Write-Host "1. dsh.profile.bundles already lists $packageName"
} else {
  if ($WhatIf) {
    Write-Host "1. [whatif] would add $packageName to dsh.profile.bundles"
  } else {
    # Rebuild the manifest as an object and serialise it back, rather than
    # patching the text: a profile manifest holds bundle specs that may contain
    # characters `ConvertTo-Json` escapes, so matching the array as written is
    # not reliable.
    $profileNode.bundles = @($bundles + $packageName)
    $manifest.dsh.profile = $profileNode
    $json = $manifest | ConvertTo-Json -Depth 20
    Copy-Item $manifestPath "$manifestPath.bak-bundle" -Force
    # Written as UTF-8 without a BOM: the app's own reader rejects a BOM.
    [System.IO.File]::WriteAllText($manifestPath, $json + "`n", $utf8)
    Write-Host "1. added $packageName to dsh.profile.bundles"
  }
}

# --- 2. the manual row --------------------------------------------------------

if (-not (Test-Path $patchPath)) {
  Write-Host "2. no cordis.patch.yml; the bundle's own patch supplies the row"
} else {
  $lines = @([System.IO.File]::ReadAllText($patchPath, $utf8) -split "\r?\n")
  $kept = @()
  $skipped = 0
  for ($index = 0; $index -lt $lines.Count; $index++) {
    $line = $lines[$index]
    # A `- insert:` block that lists our row: drop the marker and every line
    # indented under it that still belongs to it.
    if ($line -match "^\s*-\s*insert:\s*$") {
      $lookahead = $index + 1
      $belongs = $false
      while ($lookahead -lt $lines.Count -and $lines[$lookahead] -match "^\s{4,}\S") {
        if ($lines[$lookahead] -match "id:\s*['`"]?$rowId['`"]?\s*$") { $belongs = $true }
        $lookahead++
      }
      if ($belongs) {
        $skipped++
        $index = $lookahead - 1
        continue
      }
    }
    $kept += $line
  }
  if ($skipped -gt 0) {
    if ($WhatIf) {
      Write-Host "2. [whatif] would remove $skipped manual insert block(s) for $rowId"
    } else {
      $text = (($kept -join "`n") -replace "(`n){3,}", "`n`n").TrimEnd() + "`n"
      Copy-Item $patchPath "$patchPath.bak-bundle" -Force
      [System.IO.File]::WriteAllText($patchPath, $text, $utf8)
      Write-Host "2. removed $skipped manual insert block(s) for $rowId"
    }
  } else {
    Write-Host "2. no manual $rowId row in cordis.patch.yml"
  }
}

# --- 3. the release-age exemption --------------------------------------------

$mountedVersion = $null
$installedManifest = Join-Path (Join-Path $ProfileDir 'node_modules') (Join-Path $packageName 'package.json')
if (Test-Path $installedManifest) {
  $mountedVersion = (([System.IO.File]::ReadAllText($installedManifest, $utf8)) | ConvertFrom-Json).version
}
if ($mountedVersion -and (Test-Path $workspacePath)) {
  $workspace = [System.IO.File]::ReadAllText($workspacePath, $utf8)
  $key = "$packageName@$mountedVersion"
  if ($workspace -match [regex]::Escape($key)) {
    Write-Host "3. pnpm release-age exemption already present: $key"
  } elseif ($WhatIf) {
    Write-Host "3. [whatif] would add the exemption for $key"
  } else {
    Copy-Item $workspacePath "$workspacePath.bak-bundle" -Force
    $workspace = $workspace.TrimEnd() + "`n  - $key`n"
    [System.IO.File]::WriteAllText($workspacePath, $workspace, $utf8)
    Write-Host "3. added the pnpm release-age exemption for $key"
  }
} else {
  Write-Host "3. no mounted package to exempt"
}

Write-Host ''
Write-Host "Next: start dsh. The plugin is now mounted as a bundle, so the plugin"
Write-Host "manager's own 卸载 / Uninstall button removes it (and pnpm cleans up)."
Write-Host "Backups written next to each edited file end in .bak-bundle."
