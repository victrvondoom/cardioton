# Deterministic demo rehearsal

Use only the existing public development example. No source-profile editing, training, evaluation, threshold adjustment or scientific changes are part of rehearsal. The [storyboard](DEMO_SCRIPT.md) targets 5:10; the actual recorded video must remain within 3-10 minutes.

## Environment and pre-roll

- Browser: the tested in-app Chromium, Firefox 157.0 or Safari 27.2 on the verified macOS environment. These describe recorded checks, not universal version requirements.
- Recording viewport: **1440 x 1000 CSS pixels**, desktop, 100% zoom. Keep personal tabs/chrome outside the recording. Reset temporary capture overrides afterward.
- Preferred app URL: `http://127.0.0.1:8000/`. Capture/rehearsal may use `http://127.0.0.1:8005/` without changing an existing server.
- Install/build ahead of recording with `make install prepare verify build`. Packages/base images need network; frozen inference does not.
- Start/restart: **Ctrl-C** in the identified local server terminal, then `make run PORT=8000`. If another server owns it, use `make run PORT=8005`. Do not terminate an unidentified process.
- Prepare the architecture SVG in a separate local tab/document preview. One optional static-only command is `python3 -m http.server 8006 --bind 127.0.0.1 --directory docs/submission/assets`; open `http://127.0.0.1:8006/architecture.svg`. This serves existing presentation assets only, without modifying the application. Stop that server afterward.
- Before the take: refresh, load the public example, run prediction, wait for all outputs and complete geometry. **Reset view**, **Show all**, **Anterior view**, select **RCA**. Frame the heart and vessel controls, with the LAD card/control visible and the disclaimer retained. The take begins with a prepared example, not an empty form.

## Fixed example and outputs

Source ID: `0056fb5ae87a9ac1510fd77cb5cd6bd3b348a0d0de578cf1a86132f8d87733dc`. Confirm **55/55 valid** and the explicit public-example label.

| Target | Frozen probability | UI display | Dataset class at 0.5 |
|---|---:|---:|---|
| CAD | 0.1709399517600908 | 17.1% | Normal |
| LAD | 0.24305384913623826 | 24.3% | Normal |
| LCX | 0.3705140009054133 | 37.1% | Normal |
| RCA | 0.3090592361868292 | 30.9% | Normal |

Allow minor platform roundoff up to 1e-12. Normal is the **model's dataset class label**, not a clinical finding that disease is absent. During the input section, reload the same example and rerun prediction; do not edit values. New predictions choose CAD as explanation target; select RCA explicitly before the later synchronization demonstration.

## Reproducible bidirectional selection

1. Start anterior, show all, **RCA selected**. Confirm RCA selected, LAD not selected. Do not select LAD before clicking its mesh.
2. Click an exposed descending **LAD** segment on the anterior heart. Confirm **LAD selected** in both the viewer and its card/control, with RCA cleared. Use visible anatomy, not fixed screen coordinates; framing changes the click location. This transition was reproduced in the unchanged app during the polish pass.
3. Click **Select LCX anatomy** in the card/control. Confirm LCX geometry highlight and label. This separately demonstrates UI → anatomy.
4. If a mesh click hits empty space or another vessel, stop the take and rehearse the visible LAD segment again. A named-button click alone cannot prove mesh → UI synchronization. Avoid trying to pick hidden LCX geometry.

## Camera sequence and timing

- Teaser **0:00-0:10**: the prepared RCA → LAD mesh click. Then return to the page top for context.
- Architecture **1:30-1:40**: switch to the prepared existing diagram; trace its actual arrows. Return to the app for anatomy.
- Main anatomy **1:40-2:35**: reset, show all, anterior, RCA → LAD mesh click → LCX card. One short drag, brief zoom, reset, LCX, posterior, isolate, show all. No long orbit/search for a hidden vessel.
- Drag from about 50% canvas width/50% height to 62%/44% over a second; wheel up briefly. Deltas depend on browser input. Preset top is superior; after dragging, the UI says **last preset**, not guaranteed current orientation.
- Ending **4:40-4:50**: return to Prediction, scroll to anatomy, **LAD**, **Show all**, **Anterior view**. Prepare this frame before the final 20 seconds of speech. Navigation preserves scroll, so explicitly check framing.

## Explanation and Evidence anchors

- **CAD**: wait for verified factors. Point to **Typical Chest Pain**, **Entered: 0**, negative contribution (displayed about **-0.9143 log-odds**) as the one concrete example. Remaining factors are retained and reconstruct the output. Do not read residual digits aloud.
- Switch to **RCA** to show probability contribution units. CAD/LAD use log-odds; LCX/RCA probability space. These magnitudes cannot be directly compared.
- Numerical tolerances remain **1e-10 / 1e-6** respectively. Reconstruction checks numerical consistency, not clinical correctness, causality or correlated-feature stability. All 55 factors are available without expanding them during the timed narration.
- Evidence displays saved aggregates, not new evaluation. Show **303 / 242 / 61**, **Final holdout - 61 records**, then CAD/LAD stronger discrimination/recall and weak LCX/RCA sensitivity. Point to numbers rather than reading decimals. Briefly show matrices and limitations.
- The shorter research narration ends at 4:40, leaving a dedicated 10-second action pause and an uninterrupted 20-second close.

## Failure and offline plans

| Failure | Honest recovery |
|---|---|
| Mesh picking misses | Rehearse the exposed anterior LAD segment; rerecord the take. Do not substitute a same-vessel button/mesh click as synchronization proof. |
| WebGL unavailable/context lost | Show the explicit failure and numerical fallback; recover/restart for the working-interaction take. A labeled real still is illustrative, not proof of a live viewer. |
| SHAP unavailable/error | Predictions/evidence remain visible. State explanation unavailable; do not manufacture factors. A real same-example capture may be labeled as a still. |
| Backend restart | Stop only the identified server, restart with the command above, reload the same example and rerun frozen prediction. No evaluation command. |
| Network unavailable | With packages installed, frontend built and artifacts present, prediction, SHAP, meshes and saved evidence run locally. No cloud AI API/CDN. Fresh builds and upstream links need network. |
| Report/still fallback | Use the existing [real captures](SCREENSHOTS.md), explicitly identified as saved images. They cannot replace the main video's working-app interaction evidence. |

Before recording: verify all expected outputs, geometry ready, distinct selection transitions, correct SHAP units, evidence heading, final framing and audible narration. The polish pass verified RCA → LAD geometry selection in the browser; it did **not** record or time a complete video. Measure the actual exported take, including action pauses, before upload.
