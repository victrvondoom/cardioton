# CLINI-CASE spatial interface

7 October 2026. Local, uncommitted visual implementation following the completed
Cardio-Hemo feature. The earlier Cardio-Hemo delivery report describes the state
before this separate visual pass.

## What changed

Shared light/dark dimensional styling now gives protected workspaces beveled
panels, extruded controls, inset fields, raised navigation and a perspective floor
with shaded background geometry. The sign-in and registration screens use the
same visual system. The landing page retains its existing WebGL scene, device
fallbacks and scoped palette; its existing glass panels receive dimensional edges.

Cardio-Hemo adds a CSS perspective platform, layered schematic heart and eight
spatial state nodes. Each node reads the exact snapshot level, classification and
confidence, and opens the existing WHY/source explanation. Existing state cards,
replay, uncertainty, governance and exports remain present. Spatial position and
heart geometry are explicitly schematic, never physiological measurements.

No dependencies, backend, API, authentication, model gateway, clinical rules,
database, `.env` or deployment files changed in this visual pass. No route or
feature was removed. Existing uncommitted navigation and architecture work is
preserved. No Git staging, commit, push, branch, reset, stash or checkout occurred.

## Modified files in this visual pass - exactly 6

1. `frontend/index.html`
2. `frontend/src/main.tsx`
3. `frontend/src/components/AppShell.tsx`
4. `frontend/src/routes/Login.tsx`
5. `frontend/src/routes/Signup.tsx`
6. `frontend/src/cardiotwin/HemoPanels.tsx` (already untracked from Cardio-Hemo)

## Created files in this visual pass - exactly 11

1. `frontend/src/styles/spatial.css`
2. `frontend/src/components/SpatialBackdrop.tsx`
3. `frontend/src/cardiotwin/HemoStateScene.tsx`
4. `frontend/src/cardiotwin/hemo-scene.css`
5. `frontend/tests/hemo-state-scene.test.tsx`
6. `docs/SPATIAL_UI_DELIVERY.md`
7. `output/playwright/spatial-cardio-dark.png`
8. `output/playwright/spatial-cardio-light.png`
9. `output/playwright/spatial-cardio-mobile.png`
10. `output/playwright/spatial-interop.png`
11. `output/playwright/spatial-signin.png`

Ignored runtime artifacts include the existing synthetic launcher's log/SQLite
files, frontend build output, browser session state and temporary verification
scripts under `backend/.cache/`: `spatial_scene_capture.js`,
`spatial_accessibility_verify.js`, `spatial_platform_verify.js`,
`spatial_final_capture.js`, and `spatial-snapshot.txt`.

## Verification

- Full frontend regression: **35 files, 177 tests passed**.
- TypeScript and production build passed. Existing large Three.js/MapLibre chunk
  warnings remain; no new Three.js/WebGL dependency was added to routine UI.
- New tests verify all eight source classifications remain exact and selecting
  both known/UNKNOWN spatial nodes dispatches the correct evidence selection.
- Browser verified desktop dark/light appearance, 390px mobile with no horizontal
  overflow, spatial-node WHY links, keyboard UNKNOWN selection, viewport-anchored
  Ctrl+K search, and reduced-motion focus transform suppression.
- Browser verified dimensional interoperability panels, the existing sign-in
  field focus ring, landing-page glass surfaces and return to the protected twin.
- CSS review caught an inset field shadow overriding the original focus ring;
  lowering selector specificity fixed it, and the live browser check passed.
- Generic app containers have no new transforms or perspective. Fixed navigation,
  search and overlays retain their viewport coordinates. Decorative geometry is
  hidden from assistive technology and cannot intercept pointer input.
- Whitespace check passed. `.env` SHA-256 and HEAD remain unchanged.

Backend code was untouched in this visual pass; its preceding offline validation
was 935 passed / 108 deselected, including 120 Cardio-Hemo tests. The isolated
SQLite demo still lacks PostgreSQL-backed case workflows; the UI reports that
limitation rather than fabricating availability. Browser verification covers the
listed flows, not every legacy page in every viewport.

## Accessibility and limits

Static depth remains visible with reduced motion; interactive lift is suppressed.
On touch devices cards do not depend on hover. The heart scene does not animate
or simulate patient physiology. Forced-colour and print modes suppress decorative
depth. Theme palettes and explicit clinical labels remain owned by existing code.

This is a CSS/SVG dimensional interface, alongside the existing WebGL anatomy and
architecture scenes. Ordinary forms and clinical tables remain readable HTML;
they are not converted into camera-controlled 3D objects.

Local preview: `http://127.0.0.1:5181/cardiotwin/hemo` using the existing synthetic
demo sign-in. The preview services run only while their local launcher is running.
