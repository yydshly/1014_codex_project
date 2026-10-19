$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$snapshot = '0d3aa13241b3714f32f93fdc705100150e6c42af'
$sourcePath = Join-Path $projectRoot "upstream/specreel-$snapshot/specreel.py"
if (Test-Path -LiteralPath $sourcePath) { Write-Host '固定版本源码已存在。'; exit 0 }
$zipPath = Join-Path $projectRoot 'specreel-0d3aa13.zip'
Invoke-WebRequest -Uri "https://codeload.github.com/specreel/specreel/zip/$snapshot" -OutFile $zipPath -TimeoutSec 60
Expand-Archive -LiteralPath $zipPath -DestinationPath (Join-Path $projectRoot 'upstream')
Write-Host "已下载固定版本 $snapshot"
