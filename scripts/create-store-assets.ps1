$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$workspace = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$assetDirectory = Join-Path $workspace "store\assets"
$iconPath = Join-Path $workspace "assets\icons\channelfence-512.png"
New-Item -ItemType Directory -Path $assetDirectory -Force | Out-Null

function New-Canvas([int]$width, [int]$height) {
  $bitmap = [System.Drawing.Bitmap]::new($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

  $bounds = [System.Drawing.Rectangle]::new(0, 0, $width, $height)
  $gradient = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    $bounds,
    [System.Drawing.Color]::FromArgb(7, 15, 50),
    [System.Drawing.Color]::FromArgb(18, 53, 88),
    18.0
  )
  $graphics.FillRectangle($gradient, $bounds)
  $gradient.Dispose()

  $glow = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(22, 18, 217, 210))
  $graphics.FillEllipse($glow, [int]($width * 0.62), [int](-$height * 0.55), [int]($height * 1.5), [int]($height * 1.5))
  $glow.Dispose()
  return @{ Bitmap = $bitmap; Graphics = $graphics }
}

function Save-SmallTile {
  $canvas = New-Canvas 440 280
  $bitmap = $canvas.Bitmap
  $graphics = $canvas.Graphics
  $icon = [System.Drawing.Image]::FromFile($iconPath)
  $graphics.DrawImage($icon, [System.Drawing.Rectangle]::new(28, 72, 136, 136))

  $nameFont = [System.Drawing.Font]::new("Segoe UI", 25, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $taglineFont = [System.Drawing.Font]::new("Segoe UI", 17, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $supportFont = [System.Drawing.Font]::new("Segoe UI", 12, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $white = [System.Drawing.Brushes]::White
  $teal = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(45, 235, 225))
  $muted = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(196, 208, 245))

  $graphics.DrawString("ChannelFence", $nameFont, $teal, 188, 70)
  $graphics.DrawString("Never see that`ncreator again.", $taglineFont, $white, 188, 111)
  $graphics.DrawString("Private. Local. One click.", $supportFont, $muted, 188, 175)

  $output = Join-Path $assetDirectory "small-promo-440x280.png"
  $bitmap.Save($output, [System.Drawing.Imaging.ImageFormat]::Png)
  $muted.Dispose(); $teal.Dispose(); $supportFont.Dispose(); $taglineFont.Dispose(); $nameFont.Dispose()
  $icon.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
  Write-Output $output
}

function Save-Marquee {
  $canvas = New-Canvas 1400 560
  $bitmap = $canvas.Bitmap
  $graphics = $canvas.Graphics
  $icon = [System.Drawing.Image]::FromFile($iconPath)
  $graphics.DrawImage($icon, [System.Drawing.Rectangle]::new(112, 80, 400, 400))

  $nameFont = [System.Drawing.Font]::new("Segoe UI", 66, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $taglineFont = [System.Drawing.Font]::new("Segoe UI", 34, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $supportFont = [System.Drawing.Font]::new("Segoe UI", 21, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $white = [System.Drawing.Brushes]::White
  $teal = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(45, 235, 225))
  $muted = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(196, 208, 245))

  $graphics.DrawString("ChannelFence", $nameFont, $teal, 580, 144)
  $graphics.DrawString("Never see that creator again.", $taglineFont, $white, 585, 245)
  $graphics.DrawString("Hard-block creators across supported YouTube surfaces. Your list stays private.", $supportFont, $muted, 590, 318)

  $output = Join-Path $assetDirectory "marquee-1400x560.png"
  $bitmap.Save($output, [System.Drawing.Imaging.ImageFormat]::Png)
  $muted.Dispose(); $teal.Dispose(); $supportFont.Dispose(); $taglineFont.Dispose(); $nameFont.Dispose()
  $icon.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
  Write-Output $output
}

Save-SmallTile
Save-Marquee
