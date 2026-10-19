param([int]$Port = 4182)
$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
  node scripts/build.mjs
  if ($LASTEXITCODE -ne 0) { throw '构建失败' }
  $env:PORT = "$Port"
  node scripts/serve.mjs
} finally {
  Pop-Location
}
