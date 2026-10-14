# Navigation Refactor — CARDIOTON

## Before

`Sidenav.tsx` exposed 50+ destinations across seven flat sections (cardiac
assessment, oncology, agents, digital twins, evidence, administration, …).
Combined with the top activity ticker, live-data controls, workflow strip and
a floating action button, every screen competed for attention and no clear
patient journey existed.

## After

One shared inventory — `frontend/src/workflow/workspaces.ts` — defines six
workspaces containing all 56 destinations. Presentation is layered:

| Layer | Surface | Contents |
|---|---|---|
| 1 | Sidebar (desktop) | six workspace entries + collapsible tool lists |
| 2 | Mobile bottom bar | four workspaces + "All tools" dialog with search |
| 3 | Workspace strip | contextual tabs for the current workspace |
| 4 | Search palette (Cmd/Ctrl+K) | all tools + demo cases |

### The six workspaces

1. **Clinic** (`/dashboard`) — overview, clinical journey, Track 7.
2. **Patients** (`/cases`) — registry, intake, bulk import, clinical context,
   follow-up, notification preferences, SMART on FHIR launch.
3. **Cardiology** (`/cardiotwin`) — 3D heart, hemodynamic twin, cardiovascular
   evidence, atlas, global evidence, evaluation & methods, IIT Mandi demo,
   CROSS-5 studio.
4. **Evidence & Exchange** (`/onehealth`) — evidence workbench,
   interoperability, reviewer queues, environmental observations/map/trends,
   context explorer.
5. **Research & AI** (`/research`) — agent console, oncology module, policy
   engine, sandbox, OncoTwin family, cohort analysis.
6. **Administration** (`/runtime`) — system health, compliance, ROI,
   architecture, evaluation, industrialization, settings.

## What was preserved

- Every route. None deleted, none redirected; `workspaceFor()` /
  `workspaceLinkFor()` derive the active context from the pathname, so deep
  links into nested patient records and replay sub-pages keep working.
- Permissions: `adminOnly` links (e.g. Settings) render only for admins;
  reviewer-gated queues keep their `reviewerOrAdmin` flag and route-level
  enforcement.
- Live badges: case counts and awaiting-review counts come from the shared
  snapshot feed, cached per 30s and shared by ticker, sidebar and dashboard.
- User preferences: collapsed sidebar, open workspace groups and scroll
  position persist (localStorage/sessionStorage).
- `Sidenav.FLOW` remains exported for consumers of the original workflow
  inventory.

## Shell changes alongside navigation

- Activity ticker moved into the "Live status" popover (TopBar) — monitoring is
  available when relevant, not permanently scrolling.
- Spatial backdrop is opt-in (default off) via the About dialog.
- FAB (New case) retained; suppressed on routes that already own a
  bottom-right CTA (`/intake`).

## Validation

- `tests/workspaces.test.ts`, `tests/workspace-navigation.test.tsx`,
  `tests/navigation.test.tsx`, `tests/sidenav-feed.test.tsx` and
  `tests/search-palette.test.tsx` assert: every workspace and tool reachable
  from desktop and mobile navigation, permission filtering, deep-link context
  resolution, and search over the shared inventory.
