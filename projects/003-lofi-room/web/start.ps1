$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    if (-not (Test-Path -LiteralPath 'node_modules')) {
        & npm.cmd ci
        if ($LASTEXITCODE -ne 0) { throw '依赖安装失败。' }
    }
    & npm.cmd run dev
    if ($LASTEXITCODE -ne 0) { throw '预览启动失败，请检查 Node.js 版本或 4175 端口占用。' }
} finally {
    Pop-Location
}
