$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$workspace = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$sourceDirectory = Join-Path $workspace "site\assets\source"
$siteAssetDirectory = Join-Path $workspace "site\assets"
$storeDirectory = Join-Path $workspace "store\assets"
$iconPath = Join-Path $workspace "assets\icons\channelfence-512.png"
$manifest = Get-Content -Raw -LiteralPath (Join-Path $workspace "manifest.json") | ConvertFrom-Json
$packageVersion = $manifest.version
$optionsSource = "options-$packageVersion-1280x800.png"
$popupSource = "popup-hide-shorts-$packageVersion.png"

New-Item -ItemType Directory -Path $siteAssetDirectory -Force | Out-Null
New-Item -ItemType Directory -Path $storeDirectory -Force | Out-Null

function New-Canvas([int]$width, [int]$height) {
  $bitmap = [System.Drawing.Bitmap]::new(
    $width,
    $height,
    [System.Drawing.Imaging.PixelFormat]::Format24bppRgb
  )
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  return @{ Bitmap = $bitmap; Graphics = $graphics }
}

function New-RoundedPath(
  [System.Drawing.RectangleF]$rectangle,
  [float]$radius
) {
  $diameter = $radius * 2
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $path.AddArc($rectangle.X, $rectangle.Y, $diameter, $diameter, 180, 90)
  $path.AddArc($rectangle.Right - $diameter, $rectangle.Y, $diameter, $diameter, 270, 90)
  $path.AddArc($rectangle.Right - $diameter, $rectangle.Bottom - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($rectangle.X, $rectangle.Bottom - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function Fill-RoundedRectangle(
  [System.Drawing.Graphics]$graphics,
  [System.Drawing.Brush]$brush,
  [System.Drawing.RectangleF]$rectangle,
  [float]$radius
) {
  $path = New-RoundedPath $rectangle $radius
  $graphics.FillPath($brush, $path)
  $path.Dispose()
}

function Draw-CroppedImage(
  [System.Drawing.Graphics]$graphics,
  [System.Drawing.Image]$image,
  [System.Drawing.RectangleF]$destination,
  [System.Drawing.RectangleF]$source,
  [float]$radius = 18
) {
  $state = $graphics.Save()
  $clipPath = New-RoundedPath $destination $radius
  $graphics.SetClip($clipPath)
  $destinationPixels = [System.Drawing.Rectangle]::Round($destination)
  $sourcePixels = [System.Drawing.Rectangle]::Round($source)
  $graphics.DrawImage($image, $destinationPixels, $sourcePixels, [System.Drawing.GraphicsUnit]::Pixel)
  $graphics.Restore($state)
  $clipPath.Dispose()
}

function Draw-ContainedImage(
  [System.Drawing.Graphics]$graphics,
  [System.Drawing.Image]$image,
  [System.Drawing.RectangleF]$destination,
  [System.Drawing.RectangleF]$source,
  [float]$radius = 18
) {
  $scale = [Math]::Min($destination.Width / $source.Width, $destination.Height / $source.Height)
  $drawWidth = [float]($source.Width * $scale)
  $drawHeight = [float]($source.Height * $scale)
  $drawRectangle = [System.Drawing.RectangleF]::new(
    [float]($destination.X + (($destination.Width - $drawWidth) / 2)),
    [float]($destination.Y + (($destination.Height - $drawHeight) / 2)),
    $drawWidth,
    $drawHeight
  )
  Draw-CroppedImage $graphics $image $drawRectangle $source $radius
}

function Save-Png24(
  [System.Drawing.Bitmap]$bitmap,
  [string]$path
) {
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  Write-Output $path
}

function Save-StoreScreenshot(
  [string]$sourceName,
  [System.Drawing.RectangleF]$sourceCrop,
  [string]$step,
  [string]$heading,
  [string]$support,
  [string]$outputName,
  [bool]$contain = $false
) {
  $canvas = New-Canvas 1280 800
  $bitmap = $canvas.Bitmap
  $graphics = $canvas.Graphics
  $bounds = [System.Drawing.Rectangle]::new(0, 0, 1280, 800)
  $background = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    $bounds,
    [System.Drawing.Color]::FromArgb(7, 15, 50),
    [System.Drawing.Color]::FromArgb(15, 43, 72),
    10.0
  )
  $graphics.FillRectangle($background, $bounds)

  $glowBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(36, 27, 222, 211))
  $graphics.FillEllipse($glowBrush, -230, 520, 720, 420)
  $graphics.FillEllipse($glowBrush, 930, -250, 590, 590)

  $icon = [System.Drawing.Image]::FromFile($iconPath)
  $sourceImage = [System.Drawing.Image]::FromFile((Join-Path $sourceDirectory $sourceName))
  $graphics.DrawImage($icon, [System.Drawing.Rectangle]::new(62, 54, 62, 62))

  $brandFont = [System.Drawing.Font]::new("Segoe UI", 26, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $stepFont = [System.Drawing.Font]::new("Segoe UI", 16, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $headingFont = [System.Drawing.Font]::new("Segoe UI", 49, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $supportFont = [System.Drawing.Font]::new("Segoe UI", 22, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $footerFont = [System.Drawing.Font]::new("Segoe UI", 15, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $white = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
  $teal = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(83, 224, 218))
  $muted = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(190, 204, 236))
  $chipBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 107, 77))
  $cardBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(20, 30, 68))

  $graphics.DrawString("ChannelFence", $brandFont, $white, 140, 69)
  Fill-RoundedRectangle $graphics $chipBrush ([System.Drawing.RectangleF]::new(62, 151, 128, 38)) 19
  $graphics.DrawString($step, $stepFont, $white, 83, 159)

  $headingBox = [System.Drawing.RectangleF]::new(62, 226, 330, 240)
  $supportBox = [System.Drawing.RectangleF]::new(62, 493, 314, 150)
  $graphics.DrawString($heading, $headingFont, $white, $headingBox)
  $graphics.DrawString($support, $supportFont, $muted, $supportBox)
  $graphics.DrawString("Free  |  Open source  |  Local only", $footerFont, $teal, 62, 718)

  $visualCard = [System.Drawing.RectangleF]::new(420, 54, 810, 692)
  Fill-RoundedRectangle $graphics $cardBrush $visualCard 28
  $imageDestination = [System.Drawing.RectangleF]::new(442, 76, 766, 648)
  if ($contain) {
    Draw-ContainedImage $graphics $sourceImage $imageDestination $sourceCrop 18
  } else {
    Draw-CroppedImage $graphics $sourceImage $imageDestination $sourceCrop 18
  }

  $outputPath = Join-Path $storeDirectory $outputName
  Save-Png24 $bitmap $outputPath

  $cardBrush.Dispose(); $chipBrush.Dispose(); $muted.Dispose(); $teal.Dispose(); $white.Dispose()
  $footerFont.Dispose(); $supportFont.Dispose(); $headingFont.Dispose(); $stepFont.Dispose(); $brandFont.Dispose()
  $sourceImage.Dispose(); $icon.Dispose(); $glowBrush.Dispose(); $background.Dispose()
  $graphics.Dispose(); $bitmap.Dispose()
}

function Save-YouTubeThumbnail {
  $canvas = New-Canvas 1280 720
  $bitmap = $canvas.Bitmap
  $graphics = $canvas.Graphics
  $backgroundImage = [System.Drawing.Image]::FromFile((Join-Path $sourceDirectory "generated-growth-background-v1.png"))
  $menuImage = [System.Drawing.Image]::FromFile((Join-Path $sourceDirectory "menu-frame-v2.png"))
  $icon = [System.Drawing.Image]::FromFile($iconPath)

  $graphics.DrawImage($backgroundImage, [System.Drawing.Rectangle]::new(0, 0, 1280, 720))
  $overlay = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(42, 3, 10, 35))
  $graphics.FillRectangle($overlay, 0, 0, 1280, 720)

  $graphics.DrawImage($icon, [System.Drawing.Rectangle]::new(72, 58, 78, 78))
  $brandFont = [System.Drawing.Font]::new("Segoe UI", 29, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $headlineFont = [System.Drawing.Font]::new("Segoe UI", 64, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $supportFont = [System.Drawing.Font]::new("Segoe UI", 20, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $white = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
  $teal = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(91, 235, 226))
  $coral = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 107, 77))
  $card = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(232, 7, 15, 40))

  $graphics.DrawString("ChannelFence", $brandFont, $white, 168, 79)
  $graphics.DrawString("A REAL`nYOUTUBE`nBLOCK LIST", $headlineFont, $white, [System.Drawing.RectangleF]::new(72, 195, 555, 310))
  Fill-RoundedRectangle $graphics $coral ([System.Drawing.RectangleF]::new(75, 548, 260, 44)) 22
  $graphics.DrawString("FREE + OPEN SOURCE", $supportFont, $white, 96, 557)

  $visualCard = [System.Drawing.RectangleF]::new(646, 112, 570, 506)
  Fill-RoundedRectangle $graphics $card $visualCard 28
  Draw-CroppedImage `
    $graphics `
    $menuImage `
    ([System.Drawing.RectangleF]::new(668, 134, 526, 462)) `
    ([System.Drawing.RectangleF]::new(660, 190, 800, 703)) `
    18

  $outputPath = Join-Path $siteAssetDirectory "youtube-thumbnail-1280x720-v2.png"
  Save-Png24 $bitmap $outputPath

  $card.Dispose(); $coral.Dispose(); $teal.Dispose(); $white.Dispose()
  $supportFont.Dispose(); $headlineFont.Dispose(); $brandFont.Dispose()
  $icon.Dispose(); $menuImage.Dispose(); $backgroundImage.Dispose(); $overlay.Dispose()
  $graphics.Dispose(); $bitmap.Dispose()
}

Save-StoreScreenshot `
  "menu-frame-v2.png" `
  ([System.Drawing.RectangleF]::new(670, 200, 800, 677)) `
  "01" `
  "BLOCK IN`nTHE 3-DOT`nMENU" `
  "No need to open the channel first." `
  "store-01-menu-v2.png"

Save-StoreScreenshot `
  "blocked-frame.png" `
  ([System.Drawing.RectangleF]::new(500, 280, 750, 635)) `
  "02" `
  "BLOCK ONCE`nHIDE ACROSS`nYOUTUBE" `
  "Supported feeds, search, Watch Next, and direct visits." `
  "store-02-across-youtube-v2.png"

Save-StoreScreenshot `
  "shorts-frame.png" `
  ([System.Drawing.RectangleF]::new(720, 160, 520, 720)) `
  "03" `
  "BLOCK WHILE`nYOU SCROLL" `
  "ChannelFence advances to the next Short." `
  "store-03-shorts-v2.png" `
  $true

Save-StoreScreenshot `
  $popupSource `
  ([System.Drawing.RectangleF]::new(0, 0, 360, 560)) `
  "04" `
  "HIDE SHORTS`nIN FEEDS" `
  "Keep the Shorts tab when you want it." `
  "store-04-hide-shorts-v2.png" `
  $true

Save-StoreScreenshot `
  $optionsSource `
  ([System.Drawing.RectangleF]::new(170, 0, 940, 795)) `
  "05" `
  "YOUR PRIVATE`nBLOCK LIST" `
  "Search, add handles, import, or export." `
  "store-05-block-list-v2.png"

Save-YouTubeThumbnail
