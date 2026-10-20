$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Test-Path -LiteralPath 'node_modules')) {
    npm.cmd ci
    if ($LASTEXITCODE -ne 0) { throw '依赖安装失败。' }
}
if (-not (Test-Path -LiteralPath 'public\vendor\live2dcubismcore.min.js')) {
    npm.cmd run assets
    if ($LASTEXITCODE -ne 0) { throw '角色素材下载失败。' }
}
npm.cmd run dev
