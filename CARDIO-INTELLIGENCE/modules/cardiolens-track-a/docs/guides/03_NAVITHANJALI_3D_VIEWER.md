# 03 — NAVITHANJALI: Interactive 3D Heart and Coronary Arteries
**Read `00_MASTER_FLOW.md` first.** You own: `frontend/src/components/HeartViewer/` and `frontend/public/models/`. Branch: `viewer/navithanjali`.
You carry 25% of the marks (3D visualization) and the visual half of the extra idea (the "fog of uncertainty").
You do **not** need the backend or the ML model. You build against the sample JSON in the contract.

## What you deliver
| # | Deliverable | When | Who is waiting |
|---|---|---|---|
| G1 | `HeartViewer` with heart, 3 arteries, colour from probability, rotate/zoom/select | Day 3 | Nivasri |
| G2 | Fog of uncertainty (halo, opacity, pulse) + legend | Day 4 | Nivasri |
| H | `docs/sections/viewer.md` | Day 5 | Nivasri |

## When you must WAIT
| You need | From | What to do until it arrives |
|---|---|---|
| Frontend shell pushed (HANDOFF B) | Nivasri, Day 1 | Do Part 1 and Part 2 (set-up and finding the 3D model) on your own laptop |
| Nothing else. Your data is the sample JSON | — | — |

---

## PART 1 — Setup (Day 1, about 30 minutes)
**Step 1.1** Install Node.js 20 LTS from nodejs.org if you have not. Check: `node --version`.
**Step 1.2** Accept the GitHub collaborator invite (email from GitHub, click **Accept invitation**).
**Step 1.3** Clone and create your branch:
```
git clone https://github.com/<nivasri-username>/cardiolens-track-a.git
cd cardiolens-track-a
git checkout -b viewer/navithanjali
```
**Step 1.4** Wait for Nivasri's message "FRONTEND SHELL PUSHED". Then:
```
git checkout main
git pull origin main
git checkout viewer/navithanjali
git merge main
cd frontend
npm install
```
Open `package.json` and look at the React version (`"react": "^18..."` or `"^19..."`). This decides the 3D library versions:
- React **19** → `npm install three @react-three/fiber@9 @react-three/drei@10`
- React **18** → `npm install three @react-three/fiber@8 @react-three/drei@9`

Test: `npm run dev` and open the address it prints (usually `http://localhost:5173`).

---

## PART 2 — Find the 3D heart model (Day 1)
**Step 2.1** The brief suggests BodyParts3D, Sketchfab, Three.js examples, or NIH 3D Print Exchange. Easiest first try: **Sketchfab**. Search "human heart anatomy" and filter **Downloadable**. Sign in (free) and download in **glTF / GLB** format.
**Step 2.2 Check the licence** on the model page. Most are CC-BY: you **must** give credit (author, title, link). Write it in a file `frontend/public/models/CREDITS.md` and later in the README. Never use a model that says "no derivatives" or "non-commercial" without checking that it is fine for a hackathon submission.
**Step 2.3** Prefer a **heart with the surface only** and under about 25 MB. If the file is huge, open it in https://gltf.report or use Blender (File, Import, then File, Export, glTF 2.0 `.glb`, tick "Compression") to shrink it.
**Step 2.4** If you only find `.obj` or `.stl` (BodyParts3D), convert in Blender: File, Import, choose the file; File, Export, **glTF 2.0 (.glb)**.
**Step 2.5** Save the file as `frontend/public/models/heart.glb`.

**Plan B (if no coronary arteries are in the model):** this is normal. We draw the 3 arteries ourselves as tubes over the heart. This is easy and it looks custom. Part 4 shows how.

---

## PART 3 — Show the heart (Day 2)
**Step 3.1** Make your folder: `frontend/src/components/HeartViewer/` with these files:
```
HeartViewer.jsx     (the main component Nivasri will import)
Heart.jsx           (loads the .glb)
Artery.jsx          (one artery tube)
colors.js           (risk to colour)
arteryPaths.js      (control points for LAD, LCX, RCA)
PointPicker.jsx     (temporary helper tool)
```
**Step 3.2** `colors.js`:
```js
import * as THREE from "three";

const STOPS = [
  { t: 0.0, c: new THREE.Color("#2a9d8f") },  // low risk, teal
  { t: 0.5, c: new THREE.Color("#e9c46a") },  // medium, amber
  { t: 1.0, c: new THREE.Color("#e63946") },  // high, crimson
];

export function riskColor(p) {
  const t = Math.min(1, Math.max(0, p));
  const hi = STOPS.findIndex((s) => s.t >= t);
  if (hi <= 0) return STOPS[0].c.clone();
  const a = STOPS[hi - 1], b = STOPS[hi];
  return a.c.clone().lerp(b.c, (t - a.t) / (b.t - a.t));
}
```
**Step 3.3** `Heart.jsx`: make the heart semi-transparent so arteries on and behind it stay visible.
```jsx
import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";

export default function Heart({ onPick }) {
  const { scene } = useGLTF("/models/heart.glb");
  const cloned = useMemo(() => {
    const s = scene.clone(true);
    s.traverse((o) => {
      if (o.isMesh) {
        o.material = new THREE.MeshPhysicalMaterial({
          color: "#c9767a", transparent: true, opacity: 0.35,
          roughness: 0.6, depthWrite: false, side: THREE.DoubleSide,
        });
      }
    });
    return s;
  }, [scene]);
  return <primitive object={cloned} onClick={onPick} />;
}
useGLTF.preload("/models/heart.glb");
```
**Step 3.4** `HeartViewer.jsx` (first version):
```jsx
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import { Suspense } from "react";
import Heart from "./Heart";

export default function HeartViewer() {
  return (
    <div style={{ width: "100%", height: "100%", minHeight: 420 }}>
      <Canvas camera={{ position: [0, 0, 3], fov: 45 }} dpr={[1, 2]}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 4, 5]} intensity={1.2} />
        <Suspense fallback={null}>
          <Heart />
          <Environment preset="city" />
        </Suspense>
        <OrbitControls makeDefault enablePan={false} minDistance={1.2} maxDistance={6} />
      </Canvas>
    </div>
  );
}
```
**Step 3.5** Ask Nivasri for the `/playground` route (a page that shows `<HeartViewer />` alone with sliders). If it is not there, create your own file `frontend/src/components/HeartViewer/Playground.jsx` and tell Nivasri to add the route. Run `npm run dev` and open `/playground`.
**Check:** you can see the heart, drag to rotate, scroll to zoom. If the heart is tiny or huge, change `camera.position` Z (2 to 8) or add `scale={...}` on the `<primitive>`. If it is invisible, check the browser console (F12) for a 404 on `/models/heart.glb`.

---

## PART 4 — Draw the three arteries (Day 2)
Anatomy reminder (from the brief):
- **LAD** runs down the **front** of the heart, from the top-left to the tip (apex). Supplies the front.
- **LCX** curves around the **left side** towards the back. Supplies the side and back.
- **RCA** runs along the **right side** and wraps to the bottom. Supplies the right side and bottom.

**Step 4.1 Build the point picker** so you do not guess coordinates. `PointPicker.jsx` shows small spheres where you click on the heart and prints the coordinates:
```jsx
import { useState } from "react";

export default function PointPicker({ children, enabled }) {
  const [pts, setPts] = useState([]);
  const add = (e) => {
    if (!enabled) return;
    e.stopPropagation();
    const p = e.point.toArray().map((n) => +n.toFixed(3));
    setPts((a) => {
      const next = [...a, p];
      console.log(JSON.stringify(next));       // copy this from the console
      return next;
    });
  };
  return (
    <group onClick={add}>
      {children}
      {pts.map((p, i) => (
        <mesh key={i} position={p}><sphereGeometry args={[0.015]} /><meshBasicMaterial color="yellow" /></mesh>
      ))}
    </group>
  );
}
```
Wrap the `<Heart />` with `<PointPicker enabled>` in the playground only. **Step 4.2** Click along the path of the LAD from the top to the apex (8 to 12 clicks, evenly spaced), open the browser console (F12), copy the last printed array. Refresh the page to reset, then do the LCX, then the RCA. Rotate the heart between clicks to reach the sides.

**Step 4.3** Save the arrays in `arteryPaths.js` (the numbers below are only an example shape; use yours):
```js
export const ARTERY_PATHS = {
  LAD: [[0.05, 0.55, 0.3], [0.1, 0.3, 0.38], [0.12, 0.0, 0.4], [0.1, -0.35, 0.3]],
  LCX: [[0.05, 0.55, 0.3], [-0.2, 0.4, 0.2], [-0.35, 0.1, 0.0], [-0.3, -0.2, -0.2]],
  RCA: [[0.0, 0.55, 0.3], [0.3, 0.4, 0.25], [0.42, 0.0, 0.1], [0.3, -0.3, -0.1]],
};
```
Turn the picker off (`enabled={false}`) when you are done. Delete it from the final build or leave it behind a hidden flag.

**Step 4.4** `Artery.jsx` (version 1, colour only):
```jsx
import { useMemo } from "react";
import * as THREE from "three";
import { riskColor } from "./colors";

export default function Artery({ name, points, probability = 0, selected, onSelect }) {
  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    return new THREE.TubeGeometry(curve, 80, 0.022, 14, false);
  }, [points]);
  const color = useMemo(() => riskColor(probability), [probability]);

  return (
    <mesh
      geometry={geometry}
      onClick={(e) => { e.stopPropagation(); onSelect?.(name); }}
      onPointerOver={() => (document.body.style.cursor = "pointer")}
      onPointerOut={() => (document.body.style.cursor = "auto")}
    >
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={selected ? 0.9 : 0.35} />
    </mesh>
  );
}
```
**Step 4.5** Use the sample JSON. In `HeartViewer.jsx` accept props and render the three arteries:
```jsx
import Artery from "./Artery";
import { ARTERY_PATHS } from "./arteryPaths";

export default function HeartViewer({ vessels = {}, selected, onSelect }) {
  ...inside <Canvas>:
  {Object.keys(ARTERY_PATHS).map((n) => (
    <Artery key={n} name={n} points={ARTERY_PATHS[n]}
            probability={vessels[n]?.probability ?? 0}
            selected={selected === n} onSelect={onSelect} />
  ))}
}
```
In the playground, import `docs/api_contract/sample_response.json` (copy it to `frontend/src/mock/`) and pass `sample.vessels`. Add three sliders (0 to 1) that override the probabilities so you can test colours live.

**Check:** each artery follows the heart surface and changes teal, amber, crimson when you move the sliders. Tube radius 0.022 depends on the model scale, adjust until it looks right (usually 0.015 to 0.04).

**HANDOFF G1 (Day 3).** Commit, push, Pull Request, then post:
> `READY: HeartViewer v1 (props: vessels, selected, onSelect), merged to main, folder frontend/src/components/HeartViewer. @Nivasri`

---

## PART 5 — Interaction polish (Day 3)
1. **Click to select** (done in `Artery`). Selected artery glows more. Clicking empty space clears the selection: add `onPointerMissed={() => onSelect?.(null)}` on `<Canvas>`.
2. **Hover label.** Use drei's `Html` to show `LAD 78%` near the artery on hover. Keep the label small and readable.
3. **Camera focus on selection.** Each artery has a good viewing direction. On select, smoothly move the camera:
```jsx
import { useFrame, useThree } from "@react-three/fiber";
const VIEWS = { LAD: [0.4, 0.2, 2.6], LCX: [-2.4, 0.3, 0.8], RCA: [2.4, -0.1, 1.0], null: [0, 0, 3] };

function CameraRig({ selected, controls }) {
  const { camera } = useThree();
  useFrame(() => {
    const t = VIEWS[selected ?? "null"];
    camera.position.lerp({ x: t[0], y: t[1], z: t[2] }, 0.06);
    controls.current?.update();
  });
  return null;
}
```
Hold the controls with `const controls = useRef()` and `<OrbitControls ref={controls} makeDefault />`. If the camera fights the user's dragging, run the rig only for about 1 second after a selection (use a timestamp).
4. **Reset view button** outside the canvas (small button top-right) that sets selection to `null`.
5. **Region selection.** The brief wants region selection. Add 3 invisible clickable spheres over the front, side/back, and right/bottom heart areas that select LAD, LCX and RCA respectively (the region each vessel supplies). Tooltip text: "Front wall, supplied by LAD".
6. **Performance:** keep `dpr={[1, 2]}`, avoid creating geometry inside render (use `useMemo`, as in the code above), and test on a normal laptop on battery.
7. **Mobile:** test touch rotate and pinch zoom on your phone (same Wi-Fi, open `http://<laptop-ip>:5173`).

---

## PART 6 — THE EXTRA: Fog of Uncertainty (Day 4)
Meaning: **colour = risk, haze = how unsure the model is.** The contract gives `ci_low` and `ci_high` for each vessel. Uncertainty = `ci_high − ci_low` (0 = sure; about 0.5 or more = very unsure).

**Step 6.1** Upgrade `Artery.jsx`:
```jsx
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { riskColor } from "./colors";

export default function Artery({ name, points, probability = 0, ciLow, ciHigh, selected, onSelect }) {
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), [points]);
  const core = useMemo(() => new THREE.TubeGeometry(curve, 80, 0.022, 14, false), [curve]);
  const halo = useMemo(() => new THREE.TubeGeometry(curve, 80, 0.06, 14, false), [curve]);
  const color = useMemo(() => riskColor(probability), [probability]);

  const width = Math.max(0, (ciHigh ?? probability) - (ciLow ?? probability));
  const u = Math.min(1, width / 0.5);                 // 0 sure, 1 very unsure

  const coreMat = useRef(); const haloMat = useRef();
  useFrame(({ clock }) => {
    const speed = 1.2 + 4 * u;                         // unsure arteries pulse faster
    const pulse = Math.sin(clock.elapsedTime * speed);
    if (coreMat.current) coreMat.current.emissiveIntensity = (selected ? 0.8 : 0.35) + 0.2 * u * pulse;
    if (haloMat.current) haloMat.current.opacity = u * (0.28 + 0.12 * pulse);
  });

  return (
    <group>
      <mesh geometry={halo}>
        <meshBasicMaterial ref={haloMat} color={color} transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh geometry={core} onClick={(e) => { e.stopPropagation(); onSelect?.(name); }}>
        <meshStandardMaterial ref={coreMat} color={color} emissive={color}
          transparent opacity={1 - 0.45 * u} />
      </mesh>
    </group>
  );
}
```
In `HeartViewer.jsx` pass `ciLow={vessels[n]?.ci_low}` and `ciHigh={vessels[n]?.ci_high}`.

**Step 6.2** Test with sliders: add two more sliders per artery in the playground (`ci_low`, `ci_high`). Check the three cases:
- `ci_low = ci_high`: crisp solid artery, no halo (this is what the app shows before Nivedha's ensemble arrives, so it must look good).
- Narrow interval: almost crisp.
- Wide interval (for example 0.2 to 0.9): hazy, soft halo, faster pulse.
The difference must be visible from a distance (this is what the video will show).

**Step 6.3** Add a **legend** (small card in the corner of the viewer, plain HTML on top of the canvas):
- Colour bar: teal to amber to crimson, labelled "Predicted stenosis probability".
- "Crisp = confident, hazy = uncertain".
Keep it short and in English.

**Step 6.4** Add an **accessibility fallback**: do not rely on colour alone. Show the percentage label (for example `LAD 78% (55–92)`) on hover and in the selected-vessel box.

**HANDOFF G2 (Day 4).** Pull Request, then:
> `READY: HeartViewer v2 with fog of uncertainty and legend (new props ciLow/ciHigh inside vessels), merged to main. @Nivasri`

---

## PART 7 — Docs and voice-over (Day 5 to 6)
**`docs/sections/viewer.md` (about 1 page):** the model used with credit and licence, how arteries are built (tubes along curves picked on the surface), colour mapping, fog of uncertainty (formula and meaning), interactions (rotate, zoom, click, hover, camera focus, region select), performance notes, one screenshot with three confidence states side by side.
**Voice-over (about 1.5 minutes):** rotate the heart, click LAD, show the camera move, then the fog difference between confident and unsure arteries. Practise the sentence: "Colour shows risk. Haze shows how unsure the model is."

## Done checklist
- [ ] Heart loads fast and rotates/zooms smoothly
- [ ] LAD, LCX, RCA drawn along the surface, clickable, hoverable
- [ ] Colours update live from `vessels[name].probability`
- [ ] Fog (halo, opacity, pulse) updates from `ci_low`/`ci_high`
- [ ] Legend, reset button, region selection
- [ ] Credits file for the 3D model; model file under 25 MB
- [ ] `docs/sections/viewer.md` merged; voice-over recorded

## If you get stuck
Send Claude: the step number, the browser console error (F12, Console tab), and the component file. Common problems: model not visible (wrong scale or the path `/models/heart.glb`), library version mismatch (check the React version again in Step 1.4), arteries floating off the heart (collect the points again with the picker).
