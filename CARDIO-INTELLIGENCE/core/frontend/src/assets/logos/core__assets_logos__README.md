# CardioTwin Logos

This directory contains all official CardioTwin branding assets, designed to match the project's **pixel-geometric visual style**.

## 📁 Files

| File | Purpose | Usage |
|------|---------|-------|
| `cardiotwin-logo.svg` | Full logo with text | Hero sections, landing pages |
| `cardiotwin-icon.svg` | Icon-only version | Favicon, app icons, small spaces |
| `CardioTwinLogo.tsx` | React component | Dynamic logo rendering in components |
| `cardiotwin-logo-styles.css` | CSS styles | Styling and theming |
| `core__assets_logos__index.ts` | Exports | Easy imports |

## 🎨 Design Concept

The CardioTwin logo represents the core philosophy of the project:

- **Dual Hearts**: Patient heart (left, red) and Digital Twin heart (right, pink)
- **Evidence Path**: Orange connecting line representing evidence continuity
- **Evidence Nodes**: Small circles representing multi-agent orchestration points
- **Central Hub**: Main evidence hub where all data converges

### Color Palette

| Element | Color | Hex | Meaning |
|---------|-------|-----|---------|
| Patient Heart | Cardiovascular Red | `#ff4757` | Real patient data |
| Digital Twin Heart | Twin Pink | `#ff6b81` | Digital representation |
| Evidence Path | Orange Accent | `#ffa502` | Evidence continuity |
| Background | Near Black | `#0a0a0a` | Project theme |

## 📦 Usage

### React Component

```tsx
import { CardioTwinLogo } from '@/assets/logos';

// Full logo with text
<CardioTwinLogo variant="full" size="medium" />

// Icon only (for favicon)
<CardioTwinLogo variant="icon" />

// Symbol only (minimal)
<CardioTwinLogo variant="symbol" size={48} />
```

**Props:**
- `variant`: `'full'` | `'icon'` | `'symbol'` (default: `'full'`)
- `size`: `'small'` | `'medium'` | `'large'` | `number` (default: `'medium'`)
- `showTagline`: `boolean` (default: `true` for full variant)
- `className`: `string` (additional CSS classes)

### SVG Files (Direct Usage)

```html
<!-- Full logo -->
<img src="/assets/logos/cardiotwin-logo.svg" alt="CardioTwin Logo" />

<!-- Icon -->
<img src="/assets/logos/cardiotwin-icon.svg" alt="CardioTwin" />
```

### CSS Import

```css
/* Import logo styles */
@import '@/assets/logos/cardiotwin-logo-styles.css';

/* Use predefined classes */
<div class="cardiotwin-logo cardiotwin-logo-medium">
  <!-- Logo content -->
</div>
```

## 📏 Sizes

| Size | Full Logo Dimensions | Icon Dimensions |
|------|---------------------|----------------|
| small | 200 x 150px | 32 x 32px |
| medium | 300 x 225px | 48 x 48px |
| large | 400 x 300px | 64 x 64px |

**Custom sizes:** Pass a number to the `size` prop for pixel-perfect control.

## 🎯 Favicon

For favicon usage, use the `cardiotwin-icon.svg` file:

```html
<!-- In your HTML head -->
<link rel="icon" type="image/svg+xml" href="/assets/logos/cardiotwin-icon.svg" />
```

## 🔄 Variants

### Full Logo
- Includes "CARDIOTWIN" text and tagline
- Best for: Landing pages, hero sections, documentation
- Recommended size: medium or large

### Icon
- Dual hearts with evidence path
- Best for: Favicon, app icons, navigation bars
- Recommended size: 32-64px

### Symbol
- Minimal dual heart representation
- Best for: Buttons, watermarks, compact spaces
- Recommended size: 24-48px

## 🎨 Design System Integration

The logo follows CardioTwin's **pixel-geometric visual style**:
- ✅ Near-black background compatibility
- ✅ Restrained orange/red/yellow accents
- ✅ Precise alignment and geometry
- ✅ Square pixels aesthetic
- ✅ Minimal borders and clean lines

## 📝 Brand Guidelines

### Do:
- Use the full logo on landing pages and documentation
- Use the icon for favicon and app identifiers
- Maintain color consistency with the palette
- Scale proportionally (maintain aspect ratio)

### Don't:
- Distort or stretch the logo
- Change the color palette
- Remove the evidence path (central to brand identity)
- Use low-resolution versions

## 🔧 Technical Details

- **Format**: SVG (scalable, resolution-independent)
- **Viewport**: Full logo: 400x300, Icon: 64x64
- **Colors**: Uses CSS variables for theming compatibility
- **Accessibility**: High contrast, clear visual hierarchy

## 📄 License

All CardioTwin branding assets are part of the project and licensed under the same terms as the main codebase. See the project's `LICENSE` file for details.
