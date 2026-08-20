param(
  [string]$Version
)

$ErrorActionPreference = "Stop"
$workspace = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$manifestPath = Join-Path $workspace "manifest.json"
$manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
$packageVersion = if ($Version) { $Version } else { $manifest.version }
$dist = Join-Path $workspace "dist"
$stage = Join-Path $workspace ".package-stage"
$zip = Join-Path $dist "ChannelFence-$packageVersion.zip"

if (-not $stage.StartsWith($workspace, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Unsafe staging path: $stage"
}

if (Test-Path -LiteralPath $stage) {
  Remove-Item -LiteralPath $stage -Recurse -Force
}
New-Item -ItemType Directory -Path $stage | Out-Null
New-Item -ItemType Directory -Path (Join-Path $stage "assets\icons") -Force | Out-Null
New-Item -ItemType Directory -Path $dist -Force | Out-Null

Copy-Item -LiteralPath $manifestPath -Destination $stage
Copy-Item -LiteralPath (Join-Path $workspace "src") -Destination $stage -Recurse
Copy-Item -LiteralPath (Join-Path $workspace "ui") -Destination $stage -Recurse
$runtimeIcons = @(
  "channelfence-16.png",
  "channelfence-32.png",
  "channelfence-48.png",
  "channelfence-128.png",
  "channelfence-512.png"
)
foreach ($icon in $runtimeIcons) {
  Copy-Item -LiteralPath (Join-Path $workspace "assets\icons\$icon") -Destination (Join-Path $stage "assets\icons")
}

if (Test-Path -LiteralPath $zip) {
  Remove-Item -LiteralPath $zip -Force
}
Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $zip -CompressionLevel Optimal
Remove-Item -LiteralPath $stage -Recurse -Force

Write-Output $zip
