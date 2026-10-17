param([int]$Port = 4176)
$ErrorActionPreference = 'Stop'
$previousPort = $env:PORT
Push-Location $PSScriptRoot
try {
    node scripts/build.mjs
    if ($LASTEXITCODE -ne 0) { throw '页面构建失败' }
    $env:PORT = "$Port"
    node scripts/serve.mjs
    if ($LASTEXITCODE -ne 0) { throw '本地预览已异常退出' }
}
finally {
    $env:PORT = $previousPort
    Pop-Location
}
