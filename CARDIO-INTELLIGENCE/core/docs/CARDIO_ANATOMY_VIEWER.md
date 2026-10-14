# Cardiovascular reference viewer

The additive `AnatomyViewer` uses the existing React Three Fiber / Drei / Three.js stack and the already bundled `frontend/public/models/hra-human-heart.glb`. Existing `HeartViewer`, `RealisticHeart`, `AtlasHeart3D`, coronary probability behavior and `/cardiotwin/hemo` remain separate compatible consumers of the established architecture. No package or asset was added.

## Reference asset and provenance

- Human Reference Atlas / HuBMAP CCF 3D Reference Object Library **v1.2 (2022)**, `VH_M_Heart.glb`, based on Visible Human Male data.
- Attribution: Kristen Browne, Heidi Schlehlein, Bruce W. Herr II, Ellen M. Quardokus, Andreas Bueckle and Katy Börner. See the [official release citation and license](https://hubmapconsortium.github.io/ccf/pages/ccf-3d-reference-library.html) and [original source asset](https://github.com/hubmapconsortium/ccf-releases/blob/main/v1.2/models/VH_M_Heart.glb).
- License: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The existing asset README and the viewer expose attribution and adaptation notices.
- The bundled 4,071,500-byte GLB was compared directly with the official raw source on **2026-10-09**. Both SHA-256 hashes were `b1237e7e765178e9357fd2ea7ccf19d55d0bf9ca55e187886635febe28244c70`.
- Parsed asset: 14 named meshes, 82,066 vertices and 164,119 indexed triangles. The original file is unchanged. Nine semantic structures have explicit UBERON metadata: LA, RA, LV, RV, interventricular septum and all four valves. Five papillary muscle meshes carry FMA metadata and retain their ventricular association.

The HRA meshes provide actual generic reference surfaces for the chambers, septum, valves and papillary muscles. **Coronaries, aorta, pulmonary arteries, venae cavae and pulmonary veins are added illustrative overlays**, not segmented HRA vessel surfaces. Coronary paths are sampled against the generic chamber surfaces and use fixed radii. These added paths have not undergone clinical anatomical validation. Exact branch completeness and precise coronary segments are not claimed. Tissue microtexture is generated procedurally; epicardial/endocardial tissue-layer segmentation is not available.

## Implemented interaction

- Individually selectable structures: LA, RA, LV, RV, SEPTUM, MITRAL, TRICUSPID, PULMONARY_VALVE, AORTIC_VALVE, AORTA, PULMONARY_ARTERY, VENA_CAVA, PULMONARY_VEINS, LAD, LCX and RCA.
- PBR tissue and vessel materials, deterministic bump microtexture, soft directional/hemisphere illumination, differentiated vessel and interior colors.
- Orbit, zoom and pan using existing Drei controls. Explicit focus, reset, isolation, labels, opacity and lighting adjustment.
- Section clipping with an adjustable plane; combined with opacity and isolate, the reference interior surfaces can be explored. The cut is **uncapped** and uses generic display coordinates, not millimeters or patient image coordinates.
- Fixed vessel-wall and inner-tube layers become visible in cutaway context. They are educational overlays, not measured lumen geometry.
- Optional subtle periodic motion, default off. System reduced-motion preferences disable it and also disable control damping; preference changes are subscribed to live.
- Anatomy/evidence/coronary/hemodynamic/section/replay presentation modes. Supplied hemodynamic snapshots expose all eight existing qualitative dimensions, their classification and confidence, without changing reference geometry.
- Only `review_status: approved` findings create amber anatomical evidence associations. Pending and rejected findings cannot become clinical mesh highlights. Unknown structure IDs stay unresolved.
- All 16 structures have keyboard-accessible buttons outside the canvas. Selection descriptions, approved finding labels, report dates and source references remain available without WebGL. The parent evidence panel receives the same `onSelect` callback from meshes, anchors and text buttons.
- A preview fallback handles missing WebGL, asset/render exceptions and context loss; an explicit Text view provides a comparable text-based explorer.

Anatomical selection is cyan and approved evidence association is amber. Both are accompanied by text. No finding changes mesh shape, vessel radius, clipping depth, material damage or motion rate. A reported `70%` stenosis never creates a synthetic focal obstruction. A reported LVEF never controls heartbeat amplitude. General disease without an explicit structure cannot create a lesion location.

## Data and performance boundaries

`anatomyTypes.ts` exports the parent integration contract. Common structure aliases normalize to the canonical directory; unknown IDs return `null`. The viewer expects the parent/API to supply the already authorized, boundary-filtered finding set. It does not fetch reports, infer diagnoses, approve findings, or independently reconstruct historical clinical state.

The asset is loaded with the existing GLTF loader only when the WebGL scene mounts; route-level lazy import keeps the rendering bundle out of the initial application path. Asset loading has a visible status. The loader cache is retained; cloned display geometries and generated textures are disposed on unmount. Expensive geometry and texture construction is memoized. Frames are drawn on demand unless the user enables illustrative motion. DPR is capped to 1.15 on narrow displays and 1.5 otherwise, with interaction-driven AdaptiveDpr reduction. No new compression decoder, external CDN request or heavyweight renderer is introduced.

There is no geometric multiresolution LOD asset. Detailed HRA surfaces remain 164,119 triangles, and real GPU/browser performance depends on hardware. A short live-browser measurement reached 59.84 FPS at desktop size and 60.24 FPS at an emulated narrow viewport, both at DPR 1. These are not sustained or real-mobile performance guarantees; see the delivery report for actual draw counts and limits. Unit tests cannot validate rendered anatomy or clinical accuracy; screenshots and a browser interaction pass complement them.

## Verification

Run from `frontend`:

```powershell
npm test -- tests/anatomy-viewer.test.tsx tests/anatomy-asset.test.ts
npm run typecheck
npm run build
```

The six focused tests cover all-structure fallback selection, reviewed-evidence filtering, unresolved anatomy, report source/date text, section and text controls, live reduced-motion behavior, and the original asset's hash and ontology IDs. Full frontend regression and browser demonstration results are recorded in the overall Cardio Intelligence delivery report.

For manual review: select each chamber and interior structure; isolate the mitral valve; vary the section depth; adjust opacity and light; orbit to the posterior surfaces; choose LAD in the keyboard directory; confirm the same source panel opens from the vessel anchor; turn on reduced motion; disable WebGL or use Text view; repeat at mobile viewport width. Inspect pending and unspecified findings to confirm that neither creates an authoritative location.
