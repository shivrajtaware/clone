$ErrorActionPreference = 'Stop'
$iconPath = Join-Path $PSScriptRoot '..\frontend\src-tauri\icons\icon.ico'
$iconDirectory = Split-Path $iconPath -Parent
New-Item -ItemType Directory -Force -Path $iconDirectory | Out-Null

Add-Type -AssemblyName System.Drawing
$bitmap = New-Object System.Drawing.Bitmap 256, 256
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.Clear([System.Drawing.Color]::FromArgb(13, 30, 56))
$brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(0, 212, 224))
$graphics.FillEllipse($brush, 28, 28, 200, 200)
$font = New-Object System.Drawing.Font('Arial', 92, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$format = New-Object System.Drawing.StringFormat
$format.Alignment = [System.Drawing.StringAlignment]::Center
$format.LineAlignment = [System.Drawing.StringAlignment]::Center
$graphics.DrawString('M', $font, [System.Drawing.Brushes]::White, (New-Object System.Drawing.RectangleF(0, 0, 256, 256)), $format)
$handle = $bitmap.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($handle)
$stream = [System.IO.File]::Open($iconPath, [System.IO.FileMode]::Create)
$icon.Save($stream)
$stream.Dispose()
$icon.Dispose()
$graphics.Dispose()
$brush.Dispose()
$font.Dispose()
$format.Dispose()
$bitmap.Dispose()
Write-Host "Created $iconPath"
