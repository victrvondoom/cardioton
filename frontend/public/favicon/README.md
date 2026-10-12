# Favicon Generation Instructions

This directory contains the favicon for CardioTwin. Since SVG is the preferred format, we recommend using the SVG logo directly.

## Quick Setup

1. **Copy the SVG icon** to this directory:
   ```bash
   cp /assets/logos/cardiotwin-icon.svg /public/favicon/favicon.svg
   ```

2. **For .ico format**, generate from the SVG:
   ```bash
   # Using ImageMagick
   convert -background none -define icon:auto-resize=16,32,48,64,128,256 cardiotwin-icon.svg favicon.ico

   # Or online converter: https://favicon.io/favicon-converter/
   # Upload: frontend/src/assets/logos/cardiotwin-icon.svg
   # Download: favicon.ico
   ```

## Files to Generate

- `favicon.ico` - Windows/legacy browsers (16x16, 32x32, 48x48, 64x64, 128x128, 256x256)
- `favicon-16x16.png` - Standard favicon
- `favicon-32x32.png` - Medium icon
- `favicon-48x48.png` - Larger icon
- `apple-touch-icon.png` - iOS home screen (180x180 or 192x192)
- `android-chrome-192x192.png` - Android
- `android-chrome-512x512.png` - Android high-res

## Recommended Tools

1. **Online (Easiest):**
   - https://realfavicongenerator.net/
   - https://favicon.io/
   - Upload: `frontend/src/assets/logos/cardiotwin-icon.svg`

2. **Local (CLI):**
   ```bash
   # Install ImageMagick
   # Ubuntu: sudo apt-get install imagemagick
   # Mac: brew install imagemagick
   # Windows: https://imagemagick.org/script/download.php

   # Generate all sizes
   convert cardiotwin-icon.svg -resize 16x16 favicon-16x16.png
   convert cardiotwin-icon.svg -resize 32x32 favicon-32x32.png
   convert cardiotwin-icon.svg -resize 48x48 favicon-48x48.png
   convert cardiotwin-icon.svg -resize 128x128 favicon-128x128.png
   convert cardiotwin-icon.svg -resize 180x180 apple-touch-icon.png
   convert cardiotwin-icon.svg -resize 192x192 android-chrome-192x192.png
   convert cardiotwin-icon.svg -resize 512x512 android-chrome-512x512.png

   # Generate .ico file
   convert favicon-16x16.png favicon-32x32.png favicon-48x48.png favicon-128x128.png -colors 256 favicon.ico
   ```

## CardioTwin Color Palette for Favicon

Use these colors when generating favicons:
- Background: `#0a0a0a` (near black)
- Primary: `#ff4757` (cardiovascular red)
- Secondary: `#ff6b81` (digital twin pink)
- Accent: `#ffa502` (evidence orange)

## Verification

After generating, verify your favicon at:
- https://realfavicongenerator.net/favicon-checker

Enter your website URL to check if the favicon displays correctly.
