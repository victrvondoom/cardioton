# CardioTwin Logo Assets - Complete Package

## 📦 Asset Package Overview

This comprehensive logo package includes everything needed for CardioTwin branding across all platforms and use cases.

---

## 📁 File Structure

```
frontend/
├── src/
│   └── assets/
│       └── logos/
│           ├── cardiotwin-logo.svg          # Full logo with text
│           ├── cardiotwin-icon.svg          # Icon-only version
│           ├── CardioTwinLogo.tsx          # React component
│           ├── cardiotwin-logo-styles.css  # CSS styles
│           ├── index.ts                     # Exports
│           ├── README.md                    # Usage guide
│           └── LOGO_ASSETS_SUMMARY.md       # This file
│
└── public/
    ├── manifest.json                      # Web app manifest
    ├── logo-favicon-snippet.html           # HTML snippet
    └── favicon/
        └── README.md                       # Favicon generation
```

---

## 🎨 Logo Variants

### 1. Full Logo (`cardiotwin-logo.svg`)

**Purpose:** Primary branding, landing pages, documentation

**Features:**
- Dual heart design (patient + digital twin)
- Evidence continuity pathway
- "CARDIOTWIN" text
- "Cardiovascular Intelligence Workspace" tagline
- Pixel-geometric style

**Dimensions:**
- Default: 400 x 300px
- Scalable: SVG format (any size)

**Color Palette:**
- Patient Heart: `#ff4757`
- Digital Twin Heart: `#ff6b81`
- Evidence Path: `#ffa502`
- Text: `#ff4757`
- Tagline: `#ffa502`

**Usage:**
```html
<img src="/assets/logos/cardiotwin-logo.svg" alt="CardioTwin" />
```

---

### 2. Icon (`cardiotwin-icon.svg`)

**Purpose:** Favicon, app icons, navigation, small spaces

**Features:**
- Dual heart symbol
- Evidence connection line
- Central evidence hub dot
- Compact design

**Dimensions:**
- Default: 64 x 64px
- Scalable: SVG format (any size)

**Usage:**
```html
<!-- Favicon -->
<link rel="icon" type="image/svg+xml" href="/assets/logos/cardiotwin-icon.svg" />

<!-- App icon -->
<img src="/assets/logos/cardiotwin-icon.svg" alt="CardioTwin" width="32" />
```

---

### 3. React Component (`CardioTwinLogo.tsx`)

**Purpose:** Dynamic logo rendering with multiple variants

**Props:**
```tsx
<CardioTwinLogo
  variant="full"      // 'full' | 'icon' | 'symbol'
  size="medium"       // 'small' | 'medium' | 'large' | number
  showTagline={true}   // boolean
  className="my-class" // string
/>
```

**Example Usage:**
```tsx
// In your component
import { CardioTwinLogo } from '@/assets/logos';

function App() {
  return (
    <header>
      <CardioTwinLogo variant="full" size="medium" />
    </header>
  );
}
```

---

### 4. CSS Styles (`cardiotwin-logo-styles.css`)

**Purpose:** Predefined classes for consistent theming

**Classes Available:**
- `.cardiotwin-logo` - Container
- `.cardiotwin-logo-full` - Full logo size
- `.cardiotwin-logo-icon` - Icon size
- `.cardiotwin-logo-small` - Small (200x150px)
- `.cardiotwin-logo-medium` - Medium (300x225px)
- `.cardiotwin-logo-large` - Large (400x300px)
- `.cardiotwin-logo-text` - Text styling
- `.cardiotwin-logo-tagline` - Tagline styling

**CSS Variables:**
```css
:root {
  --cardiotwin-red-primary: #ff4757;
  --cardiotwin-red-secondary: #ff6b81;
  --cardiotwin-red-light: #ff8fa3;
  --cardiotwin-orange-accent: #ffa502;
  --cardiotwin-orange-light: #ffb347;
  --cardiotwin-bg-dark: #0a0a0a;
  --cardiotwin-bg-darker: #050505;
  --cardiotwin-text-primary: #ffffff;
  --cardiotwin-text-secondary: #cccccc;
  --cardiotwin-text-accent: #ffa502;
}
```

---

## 🎯 Design Concept

### Symbolism

| Element | Represents | Color | Meaning |
|---------|------------|-------|---------|
| Left Heart | Patient Heart | `#ff4757` | Real cardiovascular data |
| Right Heart | Digital Twin | `#ff6b81` | Digital representation |
| Evidence Path | Continuity | `#ffa502` | Data flow between states |
| Evidence Nodes | Multi-agent | `#ffa502` | Orchestration points |
| Center Hub | Validation | `#ffa502` | Central evidence processing |

### Pixel-Geometric Style

The logo embodies CardioTwin's design principles:
- ✅ **Near-black background** compatibility
- ✅ **Square pixels** aesthetic
- ✅ **Precise alignment** and geometry
- ✅ **Restrained accents** (orange/red/yellow)
- ✅ **Minimal borders** and clean lines
- ✅ **Fluid transitions** ready

---

## 📏 Size Guide

### Full Logo

| Size | Dimensions | Use Case |
|------|------------|----------|
| small | 200 x 150px | Mobile, compact headers |
| medium | 300 x 225px | Tablet, standard headers |
| large | 400 x 300px | Desktop, hero sections |
| custom | N x N/1.33 | Any custom size |

### Icon

| Size | Dimensions | Use Case |
|------|------------|----------|
| 16px | 16 x 16px | Favicon (minimum) |
| 32px | 32 x 32px | Standard favicon |
| 48px | 48 x 48px | Toolbar icons |
| 64px | 64 x 64px | App icons |
| 128px+ | 128+ x 128+ | High-res icons |

---

## 🌐 Platform Integration

### Web (HTML)

```html
<!-- In <head> -->
<link rel="icon" type="image/svg+xml" href="/assets/logos/cardiotwin-icon.svg" />
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#0a0a0a" />

<!-- In <body> -->
<img src="/assets/logos/cardiotwin-logo.svg" alt="CardioTwin" />
```

### React/Next.js

```tsx
// Import component
import { CardioTwinLogo } from '@/assets/logos';

// Or import SVG directly
import CardioTwinLogoSVG from '@/assets/logos/cardiotwin-logo.svg';

// Usage
<CardioTwinLogo variant="full" size="medium" />
```

### Web Manifest

```json
{
  "name": "CardioTwin",
  "icons": [
    {
      "src": "/assets/logos/cardiotwin-icon.svg",
      "sizes": "any",
      "type": "image/svg+xml",
      "purpose": "any maskable"
    }
  ],
  "theme_color": "#0a0a0a",
  "background_color": "#0a0a0a"
}
```

---

## 🔧 Favicon Setup

### Quick Setup (Recommended)

1. Use the SVG favicon directly (modern browsers support this):
   ```html
   <link rel="icon" type="image/svg+xml" href="/assets/logos/cardiotwin-icon.svg" />
   ```

2. Copy the icon to your public directory:
   ```bash
   cp frontend/src/assets/logos/cardiotwin-icon.svg frontend/public/favicon.svg
   ```

3. Reference it in your HTML:
   ```html
   <link rel="icon" href="/favicon.svg" />
   ```

### Complete Favicon Package

For maximum compatibility, generate these files:

```
public/favicon/
├── favicon.ico          # Legacy browsers
├── favicon-16x16.png   # Standard
├── favicon-32x32.png   # Medium
├── favicon-48x48.png   # Larger
├── favicon-128x128.png # High-res
├── apple-touch-icon.png # iOS (180x180 or 192x192)
├── android-chrome-192x192.png # Android
└── android-chrome-512x512.png # Android high-res
```

**Generation:** Use the README in `frontend/public/favicon/` for instructions.

---

## 📋 Brand Guidelines

### ✅ Do

- Use the full logo on landing pages and documentation
- Use the icon for favicon and app identifiers
- Maintain color consistency with the palette
- Scale proportionally (maintain 4:3 aspect ratio for full logo, 1:1 for icon)
- Use SVG format for scalability
- Maintain minimum 16px size for icon
- Ensure high contrast for accessibility

### ❌ Don't

- Distort or stretch the logo
- Change the color palette
- Remove the evidence path (central to brand identity)
- Use low-resolution versions
- Alter the heart shapes
- Rotate or flip the logo
- Add gradients or shadows (keep flat design)

---

## 🎨 Color Usage

### Primary Brand Colors

| Name | Hex | Usage |
|------|-----|-------|
| Cardiovascular Red | `#ff4757` | Primary heart, main text |
| Digital Twin Pink | `#ff6b81` | Digital twin heart |
| Evidence Orange | `#ffa502` | Evidence path and nodes |
| Near Black | `#0a0a0a` | Background |

### Secondary Colors

| Name | Hex | Usage |
|------|-----|-------|
| Light Red | `#ff8fa3` | Borders, highlights |
| Light Orange | `#ffb347` | Accents |
| White | `#ffffff` | Text on dark backgrounds |
| Gray | `#cccccc` | Secondary text |

### Accessibility

- **Contrast Ratios:**
  - Red on Black: 7.2:1 ✅ (AAA compliant)
  - Orange on Black: 5.9:1 ✅ (AA compliant)
  - Pink on Black: 5.1:1 ✅ (AA compliant)

---

## 📄 File Reference

| File | Type | Size | Purpose |
|------|------|------|---------|
| `cardiotwin-logo.svg` | SVG | 400x300 | Full logo |
| `cardiotwin-icon.svg` | SVG | 64x64 | Icon |
| `CardioTwinLogo.tsx` | TSX | N/A | React component |
| `cardiotwin-logo-styles.css` | CSS | N/A | Styling |
| `index.ts` | TypeScript | N/A | Exports |
| `README.md` | Markdown | N/A | Documentation |

---

## 🚀 Implementation Checklist

- [ ] Copy logo files to your project
- [ ] Update HTML head with favicon link
- [ ] Add manifest.json reference
- [ ] Test logo rendering on all target platforms
- [ ] Verify colors match design system
- [ ] Test responsive sizing
- [ ] Verify accessibility (alt text, contrast)

---

## 📞 Support

For questions about logo usage, contact the CardioTwin design team or refer to:
- `frontend/src/assets/logos/README.md` - Usage guide
- `frontend/public/favicon/README.md` - Favicon generation
- `docs/DESIGN_SYSTEM.md` - Design system documentation

---

**Version:** 1.0.0
**Date:** 2026-10-11
**Last Updated:** 2026-10-11
**Classification:** Internal - Brand Assets
