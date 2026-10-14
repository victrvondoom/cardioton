# CARDIOTON workspace UI audit

This audit records the current interface boundaries for the Mistral-inspired visual work. It is an inventory of the existing application, not a claim of clinical or production validation.

## Architecture and feature placement

The frontend is React, TypeScript, Vite and Tailwind. `frontend/src/main.tsx` owns the route tree; authenticated routes share `AppShell`, `TopBar`, `Sidenav`, `WorkflowNavigation` and `SearchPalette`. `frontend/src/workflow/workspaces.ts` is the navigation inventory. Its six groups retain the existing routes:

| Workspace | Main route | Existing capabilities |
|---|---|---|
| Clinic | `/dashboard` | Operational overview, clinical journey, Track 7 overview |
| Patients | `/cases` | Registry, intake, import, clinical context, follow-up and EHR launch |
| Cardiology | `/cardiotwin` | Coronary estimates and live 3D heart, hemodynamic twin, reviewed reports/anatomy, Atlas replay, global evidence, evaluation, IIT Mandi and CROSS-5 |
| Evidence & Exchange | `/onehealth` | Human review, OAH/FHIR exchange, AquaHealth observations, map, trends, community and context explorer |
| Research & AI | `/research` | Agent observability, oncology, policies, OncoTwin, sandbox, lab and cohorts |
| Administration | `/runtime` | Health, compliance, value, architecture, evaluation and settings |

Nested case, journey, twin, observation and Atlas tab URLs remain in `main.tsx`. The shared search palette indexes the actual workspace links and available demo fixtures. It does not search all patient records or provide a global conversational assistant.

The scientific canvases remain the existing implementations: React Three Fiber and Three.js heart viewers, the CesiumJS context globe with its browser fallback, MapLibre evidence maps, and the SlicerHeart integration panel. `useLive`, route state, URL parameters and local/session storage continue to drive current data and navigation state. The frontend calls existing FastAPI contracts; this visual work does not change clinical calculations, evidence semantics, review permissions or persistence.

## Visual issues found and changes made

- The pre-paint theme script defaulted to light while the runtime hook defaulted to dark. They now agree on light by default and preserve an explicit dark preference.
- CardioTwin and Atlas placed large cross-links before the scientific work area. Compact related-workspace navigation keeps those routes available and exposes the canvas sooner.
- An empty environmental context occupied a full card on CardioTwin. The independent-scenario notice is now a compact strip; a linked exposure still uses the detailed evidence panel.
- The CardioTwin measurement strip sat before the visualization. The heart canvas and prediction inspector now precede that strip. Mobile scenarios use a horizontal picker that keeps the selected scenario in view.
- The global new-case button covered scientific measurements. It now appears only in patient/clinic context; the Patients navigation and `N` shortcut remain available throughout the shell.
- The One Health evidence workbench had a large gradient header and a long, unbounded record column. It now uses a flat editorial header, a scrollable desktop record rail, and the primary orange interaction accent.
- OAH-Bridge controls now use the shared interaction and status tokens while leaving epistemic map markers and underlying evidence unchanged.

## Boundaries still visible in the product

Agent observability and the Atlas Copilot are real, separate capabilities. A general cross-workspace chat composer, shared conversation history and automatic transfer of arbitrary patient or simulation context are not implemented. The interface should not imply those exist.

CesiumJS depends on browser WebGL and external imagery; its existing fallback remains. SlicerHeart and clinical image workflows depend on their configured integrations. The SQLite demo is synthetic and does not supply the production case database. Clinical outputs remain decision support and require human review.

The design tokens, typography, focus behavior, reduced-motion rules and theme palette are documented in [`core__DESIGN_SYSTEM.md`](../core__DESIGN_SYSTEM.md).
