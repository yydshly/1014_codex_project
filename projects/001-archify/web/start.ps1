param([int]$Port = 4173)
$ErrorActionPreference = 'Stop'
$taskCandidates = @()
if ($env:ARCHIFY_NODE) { $taskCandidates += $env:ARCHIFY_NODE }
$taskInstalledNode = Get-Command node -ErrorAction SilentlyContinue
if ($taskInstalledNode) { $taskCandidates += $taskInstalledNode.Source }
$taskCandidates += Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
$taskNode = $null
foreach ($taskCandidate in ($taskCandidates | Select-Object -Unique)) {
  if (Test-Path -LiteralPath $taskCandidate) {
    & $taskCandidate -e "const [m,n]=process.versions.node.split('.').map(Number);process.exit(m>24||(m===24&&n>=19)?0:1)"
    if ($LASTEXITCODE -eq 0) { $taskNode = $taskCandidate; break }
  }
}
if (-not $taskNode) { throw 'This Windows reproduction requires Node.js 24.19 or later. Set ARCHIFY_NODE to a compatible node.exe.' }
Push-Location $PSScriptRoot
try {
  & $taskNode scripts/build.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Build failed. See the reported Archify diagnostics.' }
  $env:PORT = [string]$Port
  & $taskNode scripts/serve.mjs
} finally { Pop-Location }
