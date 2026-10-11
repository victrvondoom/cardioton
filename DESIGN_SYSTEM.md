# Design System — CARDIOTON Frontend

The system is Tailwind-based with semantic tokens driven by CSS custom
properties (`frontend/src/styles/index.css`), so light and dark themes share
one set of class names. Use these tokens; do not introduce page-specific
arbitrary colors.

## Color tokens

| Role | Light | Dark | Usage |
|---|---|---|---|
| `surface-bg` | `#f8fafc` neutral off-white | `#0b0f19` near-black | app canvas |
| `surface-raised` / `raised-hi` | white ramp | gray ramp | cards, popover triggers |
| `surface-border` / `border-hi` | subtle gray | gray | 1px separators, card outlines |
| `ink-primary` | `slate-900` | `slate-50` | headings, key values |
| `ink-body` / `ink-muted` / `ink-faint` | gray ramp | gray ramp | body, metadata, fine print |
| `accent-brand` | `#e11d48` deep arterial red | `#f43f5e` | primary actions, active nav |
| `accent-green` / `amber` / `red` / `cyan` / `blue` | status + information colors | same roles | only for meaningful status |

Rules:

- Deep red (`accent-brand`) is the single primary accent. Status colors appear
  only on real statuses (verdicts, health, errors) — never as decoration.
- No purple/blue gradient washes, glowing borders or glassmorphism on clinical
  content surfaces. The decorative spatial backdrop exists but is opt-in and
  off by default.
- Dark mode is a real near-black (`11 15 25`), not a washed gray.

## Typography

Nine configured families (`tailwind.config.js`), of which the day-to-day set
is:

- `text-ui-primary` (Outfit) — navigation, buttons, body.
- `text-ui-secondary` (Work Sans) — descriptions, metadata.
- `text-mono-tech` (JetBrains Mono) — IDs, digests, system metadata.
- `text-data-numeric` (Space Grotesk) + `nums-tabular` — all medical
  measurements and counters, so columns of numbers align.

Page headings follow the shell default: `text-2xl font-semibold` (applied by
`AppShell` via `[&_h1]`). Do not add oversized display headings to workspace
pages; the kinetic/aurora display styles are reserved for the public landing
page only.

## Spacing and layout

- App header: fixed 56px (`--app-header-height`); sidebar 208px expanded /
  64px collapsed.
- Page gutters: `.workspace-page` = 16–18px; content max width is not
  artificially constrained — grids cap card rows (e.g. `lg:grid-cols-4`).
- Standard card: `bg-surface-raised border border-surface-border rounded-2xl`.

## Components and states

- **Metric tile** (`StatTile`): eyebrow, tabular value, optional real
  sparkline/trend. When the source is unavailable the value is `—` and the
  hint says so — never a placeholder number.
- **Status item** (dashboard strip): ok / down / loading states are visually
  distinct (green check, red cross, muted).
- **Empty states**: name the missing thing and the next action
  ("No outstanding issues. Cases awaiting review appear here.").
- **Loading states**: spinners only for actions that block; data panels keep
  their last good data and show a "checking…" label.
- **Buttons**: primary = solid `accent-brand`; secondary = bordered
  `surface-raised`. Every button performs a real action or is disabled with
  a reason.
- **Dialogs**: native `<dialog>` or role="dialog" with Escape/outside-click
  close and focus return (see Sidenav "All tools", About modal).

## Interaction feedback

- Focus: `focus-visible:ring-2 ring-accent-brand` everywhere; skip link to
  `#main-content`.
- Reduced motion: shell reveal animation and the FAB respect
  `prefers-reduced-motion`.

## Copy rules

- Plain, precise labels ("Clinic overview", "Cardiovascular Evidence",
  "Global Evidence") — not marketing slogans.
- Never claim real-time processing, clinical approval or proven medical
  effectiveness unless the backend supports it; model pages state limitations
  explicitly (e.g. CardioTwin's 3D view is labelled as a semantic display of
  model output that does not localise lesions).
