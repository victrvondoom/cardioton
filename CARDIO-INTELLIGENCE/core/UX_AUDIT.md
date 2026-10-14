# UX Audit — CARDIOTON Frontend

Audit date: 2026-10-11. Scope: application shell, navigation, dashboard, patient
case views, CardioTwin workspace, global styling. Findings are classified by
severity; each finding states what was changed in this refactor and what
remains open.

The audit was performed on real code and executed tests (TypeScript, Vitest,
production build). No visual browser inspection was possible in this
environment, so purely visual defects (pixel spacing, rendered contrast)
are marked as unverified.

## 1. Navigation overload — SEVERITY: HIGH — FIXED

- Before: the sidebar exposed every capability at the same level
  (50+ destinations across seven flat sections), forcing users to scan the
  entire product inventory to find one tool.
- After: one inventory (`frontend/src/workflow/workspaces.ts`) groups the same
  56 destinations into six workspaces — Clinic, Patients, Cardiology,
  Evidence & Exchange, Research & AI, Administration. The sidebar shows the
  six workspaces; individual tools appear in a collapsible per-workspace list,
  the mobile "All tools" dialog, the search palette and the workspace strip.
- Every existing route, deep link, permission flag (`adminOnly`,
  `reviewerOrAdmin`) and live badge is preserved. No routes were deleted or
  redirected.

## 2. Always-visible activity ticker — SEVERITY: HIGH — FIXED

- Before: a top ticker scrolled live status text over the clinical workflow at
  all times, competing with the primary content.
- After: the ticker renders inside the "Live status" popover in the top bar.
  The underlying `ActivityTicker` and its real, fail-soft data feed
  (`lib/liveFeed.ts`) are unchanged; only the always-on presentation was
  removed.

## 3. Dashboard as a component showcase — SEVERITY: HIGH — FIXED

- Before: `/dashboard` opened with a kinetic animated hero
  ("WORLD CARDIOLOGY CLINIC" at up to 52px), marketing trust chips
  ("Bedrock-ready", "CMS-0057-F · 2026/2027"), a live-streaming 7-agent DAG
  console, ROI/savings tiles and a CMS compliance countdown — none of which
  helped a clinician start work.
- After: an operational clinic overview — one plain heading, one primary
  action (New patient case), a measured system-status strip, four KPI tiles
  computed from backend endpoints, the recent-cases list, and a
  "Needs attention" panel derived from real system state. Every metric shows
  "—" with an explicit "unavailable" note when its source is down, instead of
  a fabricated number.
- The agent pipeline console, DAG summary band and CMS countdown remain
  available in their own workspaces (`/agents`, `/compliance`).

## 4. Decorative spatial backdrop — SEVERITY: MEDIUM — FIXED

- Before: a CSS gradient/orb backdrop (`SpatialBackdrop`) rendered behind
  every screen by default.
- After: opt-in, off by default, toggled from the About dialog
  (`Appearance → Spatial backdrop`), persisted in localStorage.

## 5. Misleading status labels — SEVERITY: MEDIUM — FIXED

- A hardcoded "Verified" pill rendered next to the user chip regardless of any
  verification state. Removed.
- "Global Intelligence" / "Cardiovascular AI" nav labels overclaimed; renamed
  to "Global Evidence" and "Cardiovascular Evidence" to match what the pages
  actually show (source records, evidence mapping, passports).

## 6. Terminology sweep — SEVERITY: MEDIUM — VERIFIED CLEAN / PARTIAL

- Grep for the classic slop phrases ("revolutionary", "unlock next-generation",
  "seamless AI-powered", "transforming global cardiology", "the future of
  healthcare", "unleash", "AI-powered") returns no matches in `frontend/src`.
- Remaining honest-but-busy wording may exist on individual deep pages; a full
  page-by-page copy pass is still open.

## 7. Patient workspace consistency — SEVERITY: MEDIUM — OPEN

- `/cases/:id` (CaseDetail) is real-data driven (trace stream, audit log,
  evidence pack, compliance scorecard), but it is still laid out as a
  long single-scroll document rather than the contextual tab structure
  (Overview / Risk / CardioTwin 3D / Timeline / Evidence) described in the
  product brief. Unifying it is the largest remaining UX task.

## 8. CardioTwin honesty — SEVERITY: LOW (already good)

- The 3D view is explicitly labelled as a semantic display of model output
  that does not localise lesions; safety banners, limitations and vessel-level
  provenance are in place; the heavy `HeartViewer` is lazy-loaded. No change
  required beyond the shell-level noise reduction.

## 9. Performance — SEVERITY: LOW (already acceptable)

- Production build shows route-level code splitting: Three.js
  (react-three-fiber 824 kB) and MapLibre (1.08 MB) ship as separate lazy
  chunks; the entry bundle is 302 kB (94 kB gzip). Shell polling is shared
  (one snapshot round, 30s TTL) across ticker, sidebar chips and the
  dashboard.

## 10. Accessibility — SEVERITY: LOW (spot-checked)

- Skip link, `focus-visible` rings, `aria-current`, dialog semantics and
  keyboard shortcuts (Cmd/Ctrl+K) are in place throughout the shell.
  A full keyboard/screen-reader pass over the 56 destinations is still open.
