# Design System — CARDIOTWIN Frontend

Pixel-native, dark-first visual identity. The atomic unit of the system is
the **square**: an 8px grid, a five-colour pixel ramp, hairline borders and
flat near-black surfaces. Typography is a two-family geometric system —
Inter for display/UI/data, JetBrains Mono for telemetry. The system is
Tailwind-based with semantic tokens driven by CSS custom properties
(`frontend/src/styles/index.css`); dark is the primary theme and light
remains available as a secondary theme sharing the same class names.

The visual language is flat geometric pixel composition — square blocks,
mosaics, staircases, thin dividing lines, high-precision spacing, restrained
physics-weighted motion. All pixel artwork is original to CardioTwin
(compositions of the cardiovascular system, ECG signals, agent graphs and
geospatial networks); no third-party brand assets are used.

**Scientific realism rule.** Pixel geometry is chrome: it frames, transitions
and annotates the product. The cardiac 3D models, ECG waveforms, simulation
outputs and maplibre globes always render at full scientific fidelity —
medical data is never pixelated, quantised or stylised.

## Color tokens

Dark (default) values; the light theme remaps the same custom properties.

| Token | Dark | Usage |
|---|---|---|
| `surface-bg` | `#0D0E10` | primary canvas — near-black, not navy or purple |
| `surface-panel` | `#101113` | sidebar, telemetry strips |
| `surface-raised` / `raised-hi` | `#141518` / `#1B1C20` | flat panels, elevated surfaces |
| `surface-border` / `border-hi` | `#292A2E` / `#404147` | hairline separators |
| `ink-primary` | `#F7F7F4` | headings, key values |
| `ink-body` / `ink-muted` / `ink-faint` | `#C9CAD0` / `#96979E` / `#707178` | body, metadata, fine print |
| `ink-invert` | `#0D0E10` | text on solid accent fills |

### The pixel ramp

The only source of colour in the UI. Compose with it; do not introduce
page-specific arbitrary colours.

| Token | Dark | Role |
|---|---|---|
| `pixel-red` | `#F0442B` | alerts, clinical risk, errors |
| `pixel-orange` | `#FF7900` | primary accent — selection, active states, CTAs |
| `pixel-yellow` | `#FFB400` | caution, review states |
| `pixel-blue` | `#39A9E8` | information, geospatial, evidence |
| `pixel-green` | `#59DFA6` | stable, completed, healthy |

Semantic accents alias the ramp: `accent-brand` = orange, `accent-red` =
red, `accent-amber` = yellow, `accent-cyan` = blue, `accent-green` = green.
`accent-violet` is a muted legacy token kept for multiomics semantics only.

Rules:

- Flat surfaces only. No gradients, glows, glassmorphism or oversized
  shadows. Depth comes from the border/surface steps above. No element may
  carry a `gradient()` background-image, a `backdrop-filter`, or a
  `filter: blur()` — this is audited live on every route. Hairline
  engineering grids are drawn with SVG data-URIs (`url("data:image/svg+xml,…")`)
  or on `::before`/`::after` pseudo-elements; alpha fades use `mask-image`
  only. Entry reveals animate opacity + transform, never blur.
- Every radius is square-biased: `none` 0, `sm`/DEFAULT 2px, `md`/`lg` 4px,
  `xl`/`2xl` 6px, `3xl` 8px, and `full` **2px** — pills, avatars, status
  dots and progress bars are all squares. There are no circles in the UI.
- Colour appears through pixel compositions, visualisations and real
  interaction states — never as painted decoration.

## Typography

Two families (loaded in `index.html`):

- **Inter** — display, UI and data. Hierarchy comes from size, weight
  (400–500) and negative tracking, not ornament.
- **JetBrains Mono** — `.text-mono-tech`: IDs, timestamps, telemetry,
  traces, numerical diagnostics. Tabular numerals (`nums-tabular`) for
  scientific readings.

| Element | Size | Weight | Tracking |
|---|---|---|---|
| Hero | 72–88px | 400–500 | -0.035em |
| Section heading | 48–60px | 400 | -0.03em |
| Page heading | 34–44px | 400–500 | -0.025em |
| Sub-heading | 24–30px | 500 | -0.02em |
| Body | 15–16px | 400 | normal |
| Navigation | 13–14px | 500 | -0.01em |
| Scientific labels | 11–13px | 400–500 | normal |

No serif headlines. Page headings inside the app shell default to
`text-2xl font-semibold`; landing/hero sections use the display scale.

## Geometry

- Atomic units: `--grid-unit: 8px`, `--pixel-unit: 16px`; larger blocks are
  grid-aligned multiples (24px, …).
- Square tiles, clusters, mosaics, staircases, diamonds (rotated squares)
  and rectangular partitions on mathematically consistent positions.
- Section boundaries are grid-aligned hairlines.

## The pixel engine (`frontend/src/pixel/`)

Reusable primitives — never hardcode decorative pixel fragments into pages.

| Component | Purpose |
|---|---|
| `PixelTile` | one square cell |
| `PixelCluster` | renders a character bitmap as an arrangement of squares |
| `PixelMosaic` | deterministic seeded mosaic field (hero backdrops) |
| `PixelStaircase` | ascending square steps |
| `PixelReveal` | blocky stepped-clip scroll reveal |
| `PixelPulse` | short square pulse on real events (ECG markers, completions) |
| `PixelStatus` | square status indicator: queued / running / completed / failed / awaiting / canceled / idle |
| `PixelField` | interactive canvas layer of grid-snapped square particles (pointer repulsion + spring return) |
| `PixelFlow` | event-driven square-particle streams along lanes — spawns only on real activity or explicit `emit()` |
| `PixelScene` / `PixelBlock` | layered 2.5D planes with Z-depth, pointer tilt, contact shadows |
| `PixelTransition` | shared route transition (pixel wipe / cluster dissolve / mask reveal) |
| `PixelEcgTrace` | stepped square-joint ECG path (M/H/V commands only) |
| `PixelToHeart` | signature transition: pixel field → original pixel heart → dissolve, revealing the real 3D viewer underneath (never torn down) |

Pure core: `spring.ts` (damped spring F = -kx - cv, semi-implicit Euler
with clamped dt; `mulberry32` deterministic RNG), `bitmaps.ts` (original
heart / globe / staircase bitmaps, `mosaicField`, `matrixToBitmap`,
`ecgStepPath`), `tokens.ts` (ramp + CSS-var/canvas colour resolution),
`core__src_pixel__hooks.ts` (`usePrefersReducedMotion`, `useInView`).

## Motion

- Damped spring dynamics (F = -kx - cv) with delta-time integration; no
  exaggerated bouncing.
- Frame-rate independent; transform/opacity for ordinary UI; high-frequency
  state lives outside the React tree (canvas + rAF loops that pause
  offscreen, when the tab is hidden, and under reduced motion).
- `prefers-reduced-motion` disables particle loops and renders static frames.

## Honesty rules

- Multi-agent visuals reflect real backend events only (30 s metrics poll,
  run streams). Never fabricate agent activity or percentages.
- Unavailable data renders `—` with a reason, never a placeholder number.
- The pixel-heart intro is labelled "stylised pixel preview — schematic,
  not a medical reconstruction".

## Per-page accent map

| Route | Page | Pixel treatment |
|---|---|---|
| `/` | Landing | hero pixel compositions, mosaic field, staircase, ECG trace |
| `/dashboard` | Dashboard | StatTile sparklines, ECG telemetry HUD, PixelStatus |
| `/cardiotwin` | CardioTwin 3D | PixelToHeart intro over the live HeartViewer |
| `/cardiotwin/intelligence` | Cardiac intelligence | flat panels, square markers, mono telemetry |
| `/cardiotwin/global` | Global intelligence | flat metric panels, dark-basemap globe |
| `/cardiotwin/hemo` | Hemodynamics | flat studio panels, square status marks |
| `/cardiotwin/atlas` | Atlas | dark offline map, square pins, graph nodes |
| `/agents` | Multi-agent | DAG with event-driven PixelFlow lanes, PixelStatus legend |
| `/cases`, `/journey` | Patient/case workflows | flat tables, PixelStatus auto-refresh indicator |
| `/twin/*`, `/interop` | AI workspace | restrained accents, real processing states |
| `/aquahealth/*` | AquaHealth | dark maplibre basemap, square markers |
| `/settings` | Settings | flat panels, square avatars, role tints from the ramp |
| all routes | — | shared AppShell chrome + PixelTransition route transitions |

Globes (maplibre) use the dark basemap
(`https://tiles.openfreemap.org/styles/dark`) so real geography embeds in
the near-black product; camera, markers and layers are untouched.

## Copy rules

- Plain, precise labels ("Clinic overview", "Cardiovascular Evidence",
  "Global Evidence") — not marketing slogans.
- Never claim real-time processing, clinical approval or proven medical
  effectiveness unless the backend supports it; model pages state
  limitations explicitly (e.g. CardioTwin's 3D view is labelled as a
  semantic display of model output that does not localise lesions).
