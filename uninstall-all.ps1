# Remove every trace of dsh-completion-alert from a dsh profile.
#
# Run it with the DSH app CLOSED: the app holds the profile's node_modules while
# it runs, and a half-closed app can rewrite the same files this script edits.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\uninstall-all.ps1
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\uninstall-all.ps1 -WhatIf
#
# What it touches (and nothing else):
#   1. <profile>/node_modules/dsh-completion-alert            the package directory
#   2. <profile>/cordis.patch.yml                             the `completion-alert` insert
#   3. <profile>/package.json                                 the dependency entry, if any
#   4. <profile>/pnpm-lock.yaml                               this package's importer + package entry
#   5. <profile>/pnpm-workspace.yaml                          this package's minimumReleaseAgeExclude entry
#
# It NEVER touches dsh-cost-balance-indicator: its directory, its dependency
# entry, its lockfile entry and its three exemption entries are left exactly as
# they are. Every file it rewrites is backed up first.
#
# Note on the settings page: the "瀹搞儰缍旂€瑰本鍨氶幓鎰仛" page is served by the plugin's
# browser bundle. Removing the row while the app runs does not unload code the
# browser already fetched, so the page can survive until the app restarts. That
# is a stale bundle, not a leftover file - after this script, start the app and
# the page is gone.
[CmdletBinding()]
param(
  [string]$Profile = 'desktop',
  [string]$DshHome = $(if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $HOME '.dsh' }),
  [switch]$WhatIf
)

$ErrorActionPreference = 'Stop'
$rowId = 'completion-alert'
$packageName = 'dsh-completion-alert'
$keep = 'dsh-cost-balance-indicator'

$profileDir = Join-Path (Join-Path $DshHome 'profiles') $Profile
if (-not (Test-Path $profileDir)) { throw "profile directory not found: $profileDir" }

$patchPath = Join-Path $profileDir 'cordis.patch.yml'
$manifestPath = Join-Path $profileDir 'package.json'
$lockPath = Join-Path $profileDir 'pnpm-lock.yaml'
$workspacePath = Join-Path $profileDir 'pnpm-workspace.yaml'
$packageDir = Join-Path (Join-Path $profileDir 'node_modules') $packageName
$backupDir = Join-Path $profileDir '.completion-alert-backup'

$utf8 = New-Object System.Text.UTF8Encoding($false)
$changed = @()

function Write-Text([string]$path, [string]$text) {
  if ($WhatIf) { Write-Host "  [whatif] would write $path"; return }
  [System.IO.File]::WriteAllText($path, $text, $utf8)
}


# Read a text file as UTF-8 and normalise its line endings, so every matcher in
# this script works whether the file uses CRLF or LF (the profile's own files
# have been both).
function Read-Lines([string]$path) {
  return @([System.IO.File]::ReadAllText($path, $utf8) -split "\r?\n")
}

# Serialize a manifest with two-space indentation, the way the profile's own
# `dsh` tooling writes it (PowerShell 5.1's ConvertTo-Json uses four).
function ConvertTo-ManifestJson($value, [int]$depth = 0) {
  $pad = ' ' * ($depth * 2)
  $childPad = ' ' * (($depth + 1) * 2)
  if ($null -eq $value) { return 'null' }
  if ($value -is [bool]) { return $value.ToString().ToLowerInvariant() }
  if ($value -is [int] -or $value -is [long] -or $value -is [double] -or $value -is [decimal]) { return [string]$value }
  if ($value -is [string]) {
    return '"' + ($value -replace '\\', '\\' -replace '"', '\"' -replace "`r", '\r' -replace "`n", '\n' -replace "`t", '\t') + '"'
  }
  if ($value -is [System.Collections.IEnumerable] -and $value -isnot [System.Management.Automation.PSCustomObject]) {
    $items = @($value)
    if ($items.Count -eq 0) { return '[]' }
    $parts = @()
    foreach ($item in $items) { $parts += ($childPad + (ConvertTo-ManifestJson $item ($depth + 1))) }
    return '[' + "`n" + (($parts -join ',' + "`n")) + $pad + ']'
  }
  $names = @($value.PSObject.Properties | Where-Object { $_.MemberType -in @('NoteProperty', 'Property') } | ForEach-Object { $_.Name })
  if ($names.Count -eq 0) { return '{}' }
  $parts = @()
  foreach ($name in $names) {
    $parts += ($childPad + '"' + $name + '": ' + (ConvertTo-ManifestJson $value.$name ($depth + 1)))
  }
  return '{' + "`n" + ($parts -join ',' + "`n") + $pad + '}'
}

function Backup-Once([string]$path) {
  if (-not (Test-Path $path)) { return }
  if ($WhatIf) { return }
  if (-not (Test-Path $backupDir)) { New-Item -ItemType Directory -Path $backupDir | Out-Null }
  $target = Join-Path $backupDir ((Split-Path $path -Leaf) + '.before-uninstall-all')
  if (-not (Test-Path $target)) { Copy-Item $path $target }
}

# ---------------------------------------------------------------- 1. the directory ----

Write-Host "1. package directory"
if (Test-Path $packageDir) {
  Write-Host "   removing $packageDir"
  if (-not $WhatIf) { Remove-Item -Recurse -Force $packageDir }
  $changed += 'node_modules'
} else {
  Write-Host "   already gone"
}

# ---------------------------------------------------------------- 2. the patch row ----
# The row is an `- insert:` block holding exactly this id, so the block goes with
# it. A profile can hold more than one copy after a failed install, so this
# removes every match rather than stopping at the first.
Write-Host "2. cordis.patch.yml row"
if (Test-Path $patchPath) {
  $lines = @(Read-Lines $patchPath)
  # Collect the id line of every copy: inside an insert block, or bare.
  $idLines = @()
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match "^\s*- id:\s*$([regex]::Escape($rowId))\s*$") { $idLines += $i }
  }
  if ($idLines.Count -eq 0) {
    Write-Host "   no $rowId row present"
  } else {
    # Each id line anchors a block: [start..end] with the blank line before it.
    $ranges = @()
    foreach ($idLine in $idLines) {
      $start = $idLine
      # Walk up over `- insert:` (possibly across a blank line).
      $probe = $start - 1
      while ($probe -ge 0 -and $lines[$probe].Trim() -eq '') { $probe -= 1 }
      if ($probe -ge 0 -and $lines[$probe] -match '^\s*- insert:\s*$') { $start = $probe }
      # Walk down over the row's more-indented continuation lines.
      $end = $idLine
      for ($j = $idLine + 1; $j -lt $lines.Count; $j++) {
        if ($lines[$j] -match '^\s*$' -or $lines[$j] -match '^\s*-') { break }
        $end = $j
      }
      # Include the blank line that separated the block from the previous row.
      $head = $start
      if ($head -gt 0 -and $lines[$head - 1].Trim() -eq '') { $head -= 1 }
      $ranges += ,@($head, $end)
    }
    $drop = New-Object 'System.Collections.Generic.HashSet[int]'
    foreach ($range in $ranges) { for ($i = $range[0]; $i -le $range[1]; $i++) { [void]$drop.Add($i) } }
    $kept = @()
    for ($i = 0; $i -lt $lines.Count; $i++) { if (-not $drop.Contains($i)) { $kept += $lines[$i] } }
    while ($kept.Count -gt 0 -and $kept[$kept.Count - 1].Trim() -eq '') {
      if ($kept.Count -eq 1) { $kept = @() } else { $kept = @($kept[0..($kept.Count - 2)]) }
    }
    if ($kept.Count -eq 0) { $kept = @('[]') }
    Backup-Once $patchPath
    Write-Text $patchPath (($kept -join "`n") + "`n")
    Write-Host "   removed $($ranges.Count) $rowId row(s)"
    $changed += 'cordis.patch.yml'
  }
} else {
  Write-Host "   no cordis.patch.yml"
}

# ---------------------------------------------------------------- 3. package.json ----

Write-Host "3. package.json dependency"
if (Test-Path $manifestPath) {
  $raw = [System.IO.File]::ReadAllText($manifestPath, $utf8).TrimStart([char]0xFEFF)
  $manifest = $raw | ConvertFrom-Json
  $hasTop = $null -ne $manifest.dependencies -and $null -ne $manifest.dependencies.$packageName
  $hasDev = $null -ne $manifest.devDependencies -and $null -ne $manifest.devDependencies.$packageName
  if ($hasTop -or $hasDev) {
    Backup-Once $manifestPath
    if ($hasTop) { $manifest.dependencies.PSObject.Properties.Remove($packageName) }
    if ($hasDev) { $manifest.devDependencies.PSObject.Properties.Remove($packageName) }
    Write-Text $manifestPath ((ConvertTo-ManifestJson $manifest) + "`n")
    Write-Host "   removed the dependency entry"
    $changed += 'package.json'
  } else {
    Write-Host "   no dependency entry (normal when the profile only mounts it via the patch)"
  }
}

# ---------------------------------------------------------------- 4. pnpm-lock.yaml ----
# Surgical: only this package's importer line and its package/snapshot blocks.
Write-Host "4. pnpm-lock.yaml"
if (Test-Path $lockPath) {
  $lines = @(Read-Lines $lockPath)
  $kept = @()
  $dropped = 0
  for ($i = 0; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]
    # The importer entry under `dependencies:`.
    if ($line -match "^\s{6}$([regex]::Escape($packageName)):\s*$") {
      $dropped += 1
      # Skip its two more-indented continuation lines.
      while ($i + 1 -lt $lines.Count -and $lines[$i + 1] -match '^\s{8}\S') { $i += 1 }
      continue
    }
    # A package/snapshot block: the key line plus everything more indented than it.
    if ($line -match "^\s{2}$([regex]::Escape($packageName))@\S+:\s*$") {
      $indent = $line.Length - $line.TrimStart().Length
      $dropped += 1
      while ($i + 1 -lt $lines.Count) {
        $next = $lines[$i + 1]
        if ($next.Trim() -eq '') { break }
        $nextIndent = $next.Length - $next.TrimStart().Length
        if ($nextIndent -le $indent) { break }
        $i += 1
      }
      continue
    }
    $kept += $line
  }
  if ($dropped -gt 0) {
    Backup-Once $lockPath
    # A dropped block can leave a doubled blank line behind; YAML does not care,
    # but the file should look hand-written.
    $text = (($kept -join "`n") -replace "(`n){3,}", "`n`n").TrimEnd() + "`n"
    Write-Text $lockPath $text
    Write-Host "   removed $dropped lockfile block(s)"
    $changed += 'pnpm-lock.yaml'
  } else {
    Write-Host "   no lockfile entry"
  }
} else {
  Write-Host "   no pnpm-lock.yaml"
}

# ------------------------------------------------------- 5. the release-age exemption ----
# pnpm adds this line for every freshly published plugin; leaving it behind is
# harmless but it is a trace, so it goes too.
Write-Host "5. pnpm-workspace.yaml exemption"
if (Test-Path $workspacePath) {
  $lines = @(Read-Lines $workspacePath)
  $kept = @()
  $dropped = 0
  foreach ($line in $lines) {
    if ($line -match "^\s*-\s*$([regex]::Escape($packageName))@") { $dropped += 1; continue }
    $kept += $line
  }
  if ($dropped -gt 0) {
    Backup-Once $workspacePath
    Write-Text $workspacePath (($kept -join "`n").TrimEnd() + "`n")
    Write-Host "   removed $dropped exemption line(s)"
    $changed += 'pnpm-workspace.yaml'
  } else {
    Write-Host "   no exemption entry"
  }
}

# ---------------------------------------------------------------- report ----

Write-Host ''
Write-Host "changed: $(if ($changed.Count -eq 0) { 'nothing' } else { $changed -join ', ' })"
if (-not $WhatIf -and $changed.Count -gt 0) { Write-Host "backups: $backupDir" }

Write-Host ''
Write-Host "left untouched on purpose:"
$balanceDir = Join-Path (Join-Path $profileDir 'node_modules') $keep
Write-Host "   $keep directory      : $(Test-Path $balanceDir)"
if (Test-Path $manifestPath) {
  $manifest = ([System.IO.File]::ReadAllText($manifestPath, $utf8).TrimStart([char]0xFEFF)) | ConvertFrom-Json
  Write-Host "   $keep dependency     : $($manifest.dependencies.$keep)"
}
if (Test-Path $workspacePath) {
  $keptExemptions = @(Read-Lines $workspacePath | Where-Object { $_ -match "^\s*-\s*$([regex]::Escape($keep))@" })
  Write-Host "   $keep exemptions     : $($keptExemptions.Count) entries kept"
}
if (Test-Path $lockPath) {
  $lockHits = @(Read-Lines $lockPath | Where-Object { $_ -match $keep })
  Write-Host "   $keep lockfile lines : $($lockHits.Count) kept"
}

Write-Host ''
Write-Host "still present for $packageName (should be none):"
foreach ($path in @($packageDir, $patchPath, $lockPath, $workspacePath, $manifestPath)) {
  if (-not (Test-Path $path)) { continue }
  $hits = @([System.IO.File]::ReadAllText($path, $utf8) -split "\r?\n" | Where-Object { $_ -match $packageName -and $_ -notmatch $keep })
  if ($hits.Count -gt 0) { Write-Host "   $path : $($hits.Count) reference(s)"; $hits | ForEach-Object { Write-Host "      $_" } }
}
Write-Host '   (nothing listed above means a clean removal)'
