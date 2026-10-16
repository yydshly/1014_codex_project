param(
    [string]$BlenderPath = $env:BLENDER_BIN,
    [ValidateSet('preview','final')][string]$Quality = 'final',
    [switch]$Review
)
$ErrorActionPreference='Stop'
$sceneRoot=Split-Path -Parent $PSScriptRoot
if (-not $BlenderPath) {
    $candidate=Get-Command blender -ErrorAction SilentlyContinue
    if ($candidate) { $BlenderPath=$candidate.Source }
}
if (-not $BlenderPath -or -not (Test-Path -LiteralPath $BlenderPath)) {
    throw 'Set BLENDER_BIN or pass -BlenderPath with the absolute path of Blender 4.5 LTS.'
}
if ($Review) {
    & $BlenderPath --background (Join-Path $sceneRoot 'artifacts/moonwater.blend') --python-exit-code 1 --python (Join-Path $PSScriptRoot 'review_and_animate.py')
} else {
    & $BlenderPath --background --factory-startup --python-exit-code 1 --python (Join-Path $PSScriptRoot 'build_moonwater.py') -- --quality $Quality
}
if ($LASTEXITCODE -ne 0) { throw "Blender failed with exit code $LASTEXITCODE" }
