# Regression Report — AI-Slop Removal & Product Quality Refactor

Branch: `refactor/product-quality`. Date: 2026-10-11.
All commands below were executed in this working tree; outputs are quoted as
observed.

## Baseline (recorded before this session's changes)

- Frontend typecheck (`tsc --noEmit`): clean.
- Frontend tests (`vitest run`): 58 files, 328 tests, all passing.
- Working tree already carried the navigation/workspace refactor
  (`workspaces.ts`, shell restyle, workspace.css) and the Cross-5 / IIT Mandi /
  SlicerHeart modules, uncommitted from earlier sessions.
- Backend tests: not run at baseline (see below for post-change run).
- Production build: not captured at baseline (noted as a gap).

## Changes made in this session

| Change | File |
|---|---|
| Dashboard rebuilt: kinetic hero, marketing trust chips, live DAG console, ROI/savings tiles and CMS band removed; replaced by operational status strip, real-value KPI tiles, needs-attention panel, plain header with one primary action | `frontend/src/routes/Dashboard.tsx` |
| Dashboard tests rewritten to assert computed values, unavailable-state honesty, and the absence of showcase elements | `frontend/tests/dashboard-tiles.test.tsx` |
| Hardcoded "Verified" user badge removed | `frontend/src/components/TopBar.tsx` |
| Nav labels: "Global Intelligence" → "Global Evidence", "Cardiovascular AI" → "Cardiovascular Evidence"; matching copy in the global dashboard header/footer | `frontend/src/workflow/workspaces.ts`, `frontend/src/cardiotwin/CardioGlobalDashboard.tsx`, `frontend/tests/search-palette.test.tsx` |
| Spatial backdrop made opt-in (off by default), toggle added to the About dialog | `frontend/src/components/AppShell.tsx`, `frontend/src/components/AboutModal.tsx` |
| Product docs | `UX_AUDIT.md`, `DESIGN_SYSTEM.md`, `NAVIGATION_REFACTOR.md`, this file |

Deliberately NOT deleted (orphans kept to preserve capability, per brief):
`LivePipelineConsole`, `AgentHealthPanel` (still unit-tested), `usePipelineRun`,
`KineticHeading`. They are simply no longer mounted on the dashboard.

## Post-change verification (executed)

- Frontend typecheck (`tsc --noEmit`): clean, no errors.
- Frontend tests: `vitest run` — **58 files, 330 tests passed** (328 baseline
  + net 2 new dashboard assertions; no test was deleted without replacement).
- Production build (`npm run build`): succeeded in 14.65s. Route-level code
  splitting confirmed: entry bundle 302 kB (94 kB gzip);
  `react-three-fiber` 824 kB and `maplibre-gl` 1.08 MB load as separate lazy
  chunks; CaseDetail, RealisticHeart and HemoHeartCanvas are separate chunks.
- Backend tests (`python -m pytest`): **1269 passed, 108 deselected**
  (project default marker selection), 1 unrelated deprecation warning.

## Route preservation check

All 56 navigation destinations defined in `workspaces.ts` map to existing
routes; no route removals or redirects were made in this session. Navigation
tests assert reachability from desktop sidebar, mobile dialog and search
palette, including admin-only and reviewer-gated entries.

## Known remaining issues (not concealed)

1. `/cases/:id` (CaseDetail) is still a long single-scroll page rather than
   the contextual Overview / Risk / CardioTwin 3D / Timeline / Evidence tab
   structure. This is the largest outstanding product task.
2. No visual browser screenshots were captured (no browser available in this
   environment); layout claims rest on code review and DOM-level tests.
3. The tailwind config retains unused decorative keyframes (aurora, float,
   particle-drift) used by the landing page; a token/keyframe cleanup pass is
   open.
4. 108 backend tests are deselected by the project's default pytest markers
   (slow/e2e); they were not executed here.
5. `Dashboard` polls the shared 30s snapshot; the KPI tiles refresh with the
   org-value feed (30s). If backend latency is high the tiles show "—" until
   first response — intended behavior, but worth watching on slow demos.
