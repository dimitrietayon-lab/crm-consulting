# Renames Sprint-* files/dirs to Acquisition-* / akquise.
# Run from PowerShell:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\rename-sprint-to-acquisition.ps1
# Writes every step to .\rename-log.txt (do NOT close the window before reading it).

$ErrorActionPreference = 'Continue'
$root = 'C:\innolab\crm-consulting'
$log  = Join-Path $root 'rename-log.txt'
Set-Location $root

function Write-Log([string]$msg) {
  Write-Host $msg
  Add-Content -LiteralPath $log -Value $msg -Encoding UTF8
}

"" | Set-Content -LiteralPath $log -Encoding UTF8
Write-Log "Rename started $(Get-Date -Format o)"
Write-Log "PowerShell $($PSVersionTable.PSVersion) / PWD $((Get-Location).Path)"

$moves = @(
  # Backend routes
  @('backend/src/routes/sprint-targets.js',     'backend/src/routes/acquisition-targets.js'),
  @('backend/src/routes/sprint-assessments.js', 'backend/src/routes/acquisition-assessments.js'),
  @('backend/src/routes/sprint-offers.js',      'backend/src/routes/acquisition-offers.js'),
  @('backend/src/routes/sprint-handover.js',    'backend/src/routes/acquisition-handover.js'),
  @('backend/src/routes/sprint-settings.js',    'backend/src/routes/acquisition-settings.js'),
  @('backend/src/routes/sprint-outreach.js',    'backend/src/routes/acquisition-outreach.js'),
  @('backend/src/routes/sprint-contacts.js',    'backend/src/routes/acquisition-contacts.js'),
  @('backend/src/routes/sprint-market.js',      'backend/src/routes/acquisition-market.js'),
  # Backend libs
  @('backend/src/lib/sprintCompliance.js',      'backend/src/lib/acquisitionCompliance.js'),
  @('backend/src/lib/sprintAccount.js',         'backend/src/lib/acquisitionAccount.js'),
  # Backend PDFs
  @('backend/src/lib/pdf/sprint-assessment.js', 'backend/src/lib/pdf/acquisition-assessment.js'),
  @('backend/src/lib/pdf/sprint-offer.js',      'backend/src/lib/pdf/acquisition-offer.js'),
  @('backend/src/lib/pdf/sprint-report.js',     'backend/src/lib/pdf/acquisition-report.js'),
  # Frontend app folder
  @('frontend/app/(protected)/sprint-targets',  'frontend/app/(protected)/akquise'),
  # Frontend components
  @('frontend/components/sprint',               'frontend/components/acquisition'),
  # Frontend libs
  @('frontend/lib/sprintOptions.js',            'frontend/lib/acquisitionOptions.js'),
  @('frontend/lib/sprintSettings.js',           'frontend/lib/acquisitionSettings.js'),
  @('frontend/lib/sprintTeam.js',               'frontend/lib/acquisitionTeam.js')
)

$ok = 0; $skipped = 0; $failed = 0
foreach ($m in $moves) {
  $from = Join-Path $root $m[0]
  $to   = Join-Path $root $m[1]
  try {
    if (-not (Test-Path -LiteralPath $from)) {
      if (Test-Path -LiteralPath $to) {
        Write-Log "SKIP   $($m[0])  (already moved)"
      } else {
        Write-Log "SKIP   $($m[0])  (not found)"
      }
      $skipped++
      continue
    }
    $parent = Split-Path -Parent $to
    if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
    if (Test-Path -LiteralPath $to) { Remove-Item -LiteralPath $to -Recurse -Force }
    Move-Item -LiteralPath $from -Destination $to -Force
    Write-Log "MOVED  $($m[0])  ->  $($m[1])"
    $ok++
  } catch {
    Write-Log "ERROR  $($m[0])  ->  $($m[1])  ::  $($_.Exception.Message)"
    $failed++
  }
}

# Dead, unused components (no importers after the pipeline rewrite)
$deadFiles = @(
  'frontend/components/acquisition/SprintNav.jsx',
  'frontend/components/acquisition/StatusPicker.jsx'
)
foreach ($d in $deadFiles) {
  $dead = Join-Path $root $d
  try {
    if (Test-Path -LiteralPath $dead) {
      Remove-Item -LiteralPath $dead -Force
      Write-Log "DELETED $d"
    }
  } catch {
    Write-Log "ERROR  deleting $d  ::  $($_.Exception.Message)"
    $failed++
  }
}

Write-Log ''
Write-Log "SUMMARY moved=$ok skipped=$skipped failed=$failed"
if ($failed -eq 0) {
  Write-Log 'Rename OK. Files now live under acquisition-* / akquise / components/acquisition.'
  Write-Log 'Next: cd backend; npx prisma migrate deploy; npx prisma generate'
} else {
  Write-Log 'Rename finished WITH ERRORS — see ERROR lines above.'
}
Write-Log "Log: $log"
