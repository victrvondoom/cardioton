# Design System — CARDIOTON Frontend

Mistral-inspired, warm-neutral editorial aesthetic over a scientific
digital-twin product. Three typefaces, one accent color, hairline borders,
restrained shadows. The system is Tailwind-based with semantic tokens driven
by CSS custom properties (`frontend/src/styles/index.css`); light and dark
themes share one set of class names. Use these tokens; do not introduce
page-specific arbitrary colors.

## Color tokens

| Role | Light | Dark | Usage |
|---|---|---|---|
| `surface-bg` | `#FAF9F6` warm paper | `#111111` genuine charcoal | app canvas |
| `surface-panel` | `#F3F1EB` | `#181818` | sidebar / telemetry strips |
| `surface-raised` / `raised-hi` | `#FFFFFF` / `#F3F1EB` | `#202020` / `#2A2A2A` | cards, elevated surfaces |
| `surface-border` / `border-hi` | `#E8E6E0` / `#D1CEC5` | `#303030` / `#444444` | hairline separators |
| `ink-primary` | `#171717` | `#F5F5F4` | headings, key values |
| `ink-body` / `ink-muted` / `ink-faint` | `#404040` / `#737373` / `#A1A1A1` | `#D4D4D4` / `#A3A3A3` / `#737373` | body, metadata, fine print |
| `accent-brand` | `#F26A32` (hover ramp to `#DC5425`) | `#FF7845` | primary actions, active nav, selection |
| `accent-red` | `#DC2626` | `#F87171` | clinical status only (ischemia, errors, destructive) |
| `accent-green` / `amber` | `#059669` / `#D97706` | `#34D399` / `#FBBF24` | meaningful status only |
| `accent-cyan` / `blue` | `#0E7490` / `#2563EB` | `#38BDF8` / `#60A5FA` | information accents, evidence links |

Rules:

- Orange (`accent-brand`) is the single primary accent for interaction and
  selection. Red, green and amber appear only on real clinical status —
  never as decoration.
- Dark mode is genuine neutral charcoal (`#111111`), not navy or purple.
- The brand ramp (`brand-50…900`) is an orange scale for components that
  need graduated emphasis.
- The decorative spatial backdrop exists but is opt-in and off by default.

## Typography

Three families (loaded in `index.html`), exposed through nine semantic role
classes defined in `src/styles/index.css`:

- **Inter** — `.text-ui-primary` (nav, buttons, body), `.text-ui-secondary`
  (descriptions, metadata), `.text-compact` (uppercase tags/labels),
  `.text-micro` (fine print), `.text-data-numeric` (stats and counters with
  `nums-tabular` tabular figures).
- **Newsreader** — `.text-display-primary`, `.text-display-secondary`,
  `.text-editorial-italic`: editorial serif for hero and section headings.
- **JetBrains Mono** — `.text-mono-tech`: IDs, digests, logs, measurements,
  system metadata.

Page headings follow the shell default: `text-2xl font-semibold` (applied by
`AppShell` via `[&_h1]`). No oversized gradient headings on workspace pages.

## Spacing and layout

- App header: fixed 56px (`--app-header-height`); sidebar 208px expanded /
  64px collapsed.
- Page gutters: `.workspace-page` = 16–18px; 4/8px spacing scale elsewhere.
- Standard card: `bg-surface-raised border border-surface-border rounded-2xl`
  — borders over shadows.

## Components and states

- **Metric tile** (`StatTile`): eyebrow, tabular value, optional real
  sparkline/trend. Unavailable sources render `—` with an explicit reason —
  never a placeholder number.
- **Status item** (dashboard strip): ok / down / loading states are visually
  distinct.
- **Empty states**: name the missing thing and the next action.
- **Loading states**: spinners only for blocking actions; data panels keep
  last good data with a "checking…" label.
- **Buttons**: primary = solid `accent-brand`; secondary = bordered
  `surface-raised`. Every button performs a real action or is disabled with
  a reason.
- **Dialogs**: native `<dialog>` or role="dialog" with Escape/outside-click
  close and focus return.

## Interaction feedback

- Focus: `focus-visible:ring-2 ring-accent-brand` everywhere; skip link to
  `#main-content`.
- Reduced motion: shell reveal animation and the FAB respect
  `prefers-reduced-motion`.
- Known contrast note: white-on-orange primary buttons (`#F26A32`) sit near
  the WCAG AA threshold for small text; hover state darkens to `#DC5425`.

## Copy rules

- Plain, precise labels ("Clinic overview", "Cardiovascular Evidence",
  "Global Evidence") — not marketing slogans.
- Never claim real-time processing, clinical approval or proven medical
  effectiveness unless the backend supports it; model pages state
  limitations explicitly (e.g. CardioTwin's 3D view is labelled as a semantic
  display of model output that does not localise lesions).
