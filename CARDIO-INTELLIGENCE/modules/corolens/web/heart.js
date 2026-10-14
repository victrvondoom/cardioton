// Procedural, schematic 3D heart with the three target coronary arteries (no external mesh needed).
import * as THREE from "three";
import { OrbitControls } from "./vendor/three/OrbitControls.js";

// One shared shape function so the coronary vessels sit exactly on the heart surface.
// `a` is azimuth (0 = anterior), `y` height in [-1.3, 0.9] (apex at the bottom).
function radiusAt(y) {
  const t = (y + 1.3) / 2.2; // 0 at apex, 1 at base
  const body = 0.12 + 0.95 * Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.62) ** 0.9;
  const vy = Math.max(-1, Math.min(1, (y + 0.2) / 1.1));
  return body * (0.35 + 0.65 * Math.sqrt(1 - vy * vy));
}

function surface(a, y, lift = 0.0) {
  const r = radiusAt(y);
  const x = Math.sin(a) * r * 1.05;
  const z = Math.cos(a) * r * 0.9;
  const n = new THREE.Vector3(Math.sin(a) / 1.05, 0, Math.cos(a) / 0.9).normalize();
  return new THREE.Vector3(x, y, z).addScaledVector(n, lift);
}

function heartBody() {
  const g = new THREE.SphereGeometry(1, 96, 64);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const y = v.y * 1.1 - 0.2;
    const s = surface(Math.atan2(v.x, v.z), y);
    p.setXYZ(i, s.x, y, s.z);
  }
  g.computeVertexNormals();
  return g;
}

function tube(points, radius, color) {
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, 120, radius, 12, false);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.0 });
  return { mesh: new THREE.Mesh(geo, mat), curve };
}

const VESSEL_PATHS = {
  // Anterior interventricular groove from the base down to the apex.
  LAD: () => [[0.35, 0.78], [0.3, 0.45], [0.22, 0.05], [0.12, -0.4], [0.02, -0.85], [-0.1, -1.2]].map(([a, y]) => surface(a, y, 0.02)),
  // Left atrioventricular groove, wrapping to the back of the heart.
  LCX: () => [[0.45, 0.62], [0.95, 0.52], [1.45, 0.42], [2.0, 0.3], [2.5, 0.1], [2.85, -0.2]].map(([a, y]) => surface(a, y, 0.02)),
  // Right atrioventricular groove down to the inferior wall.
  RCA: () => [[-0.2, 0.62], [-0.7, 0.5], [-1.2, 0.36], [-1.75, 0.18], [-2.3, -0.1], [-2.75, -0.45]].map(([a, y]) => surface(a, y, 0.02)),
};

export class HeartView {
  constructor(container, { onSelect } = {}) {
    this.container = container;
    this.onSelect = onSelect;
    this.vessels = {};
    this.labels = {};
    const w = container.clientWidth;
    const h = container.clientHeight;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    container.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 100);
    this.camera.position.set(0.5, 0.35, 6.4);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 0.15, 0);
    this.controls.minDistance = 2.6;
    this.controls.maxDistance = 9;
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xdfe6f2, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(3, 4, 5);
    this.scene.add(key);

    const root = new THREE.Group();
    root.rotation.set(0.15, -0.35, -0.35); // anatomical tilt: apex points down and to the patient's left
    this.root = root;
    this.scene.add(root);
    const muscle = new THREE.Mesh(heartBody(), new THREE.MeshStandardMaterial({ color: 0xe9b8b2, roughness: 0.75 }));
    root.add(muscle);
    // great vessels (schematic)
    const aorta = tube([new THREE.Vector3(0.0, 0.6, 0.0), new THREE.Vector3(0.1, 1.35, 0.15), new THREE.Vector3(-0.25, 1.75, -0.1),
      new THREE.Vector3(-0.7, 1.6, -0.35), new THREE.Vector3(-0.85, 1.1, -0.45)], 0.15, 0xf1cfc9).mesh;
    const pulm = tube([new THREE.Vector3(0.25, 0.6, 0.2), new THREE.Vector3(0.45, 1.25, 0.25), new THREE.Vector3(0.75, 1.45, -0.1)], 0.12, 0xc9d6ee).mesh;
    root.add(aorta, pulm);

    for (const [name, pathFn] of Object.entries(VESSEL_PATHS)) {
      const pts = pathFn();
      const { mesh, curve } = tube(pts, 0.05, 0x9aa5b1);
      mesh.userData.vessel = name;
      const nodes = [0.15, 0.5, 0.85].map((t, i) => {
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.075, 20, 16), new THREE.MeshStandardMaterial({ color: 0x9aa5b1, roughness: 0.4 }));
        s.position.copy(curve.getPoint(t));
        s.userData = { vessel: name, segment: ["proximal", "mid", "distal"][i], base: 1 };
        return s;
      });
      root.add(mesh, ...nodes);
      this.vessels[name] = { mesh, nodes, curve, prob: null, uncertain: false };
      const label = document.createElement("div");
      label.className = "vessel-label";
      label.textContent = name;
      container.appendChild(label);
      this.labels[name] = label;
    }
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.renderer.domElement.addEventListener("pointerdown", (e) => (this._down = [e.clientX, e.clientY]));
    this.renderer.domElement.addEventListener("pointerup", (e) => {
      if (!this._down || Math.hypot(e.clientX - this._down[0], e.clientY - this._down[1]) > 5) return;
      const hit = this.pick(e);
      if (hit && this.onSelect) this.onSelect(hit.vessel, hit.segment);
    });
    this.renderer.domElement.addEventListener("pointermove", (e) => {
      const hit = this.pick(e);
      this.renderer.domElement.style.cursor = hit ? "pointer" : "grab";
    });
    new ResizeObserver(() => this.resize()).observe(container);
    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  pick(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const objs = Object.values(this.vessels).flatMap((v) => [v.mesh, ...v.nodes]);
    const hit = this.raycaster.intersectObjects(objs, false)[0];
    return hit ? hit.object.userData : null;
  }

  resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  static riskColor(p) {
    // light, colour-blind-aware ramp: teal (low) -> amber -> red (high)
    const stops = [[0, [0x3b, 0x9c, 0x8f]], [0.5, [0xe6, 0xa1, 0x3a]], [1, [0xd1, 0x4b, 0x4b]]];
    const i = p <= 0.5 ? 0 : 1;
    const [p0, c0] = stops[i];
    const [p1, c1] = stops[i + 1];
    const t = (p - p0) / (p1 - p0);
    return new THREE.Color(...c0.map((c, k) => (c + (c1[k] - c) * t) / 255));
  }

  update(results, selected) {
    for (const [name, v] of Object.entries(this.vessels)) {
      const r = results[name];
      v.prob = r.probability;
      v.uncertain = r.conformal_set.length === 2;
      const color = HeartView.riskColor(r.probability);
      v.mesh.material.color.copy(color);
      v.nodes.forEach((n) => n.material.color.copy(color));
      const sel = name === selected;
      v.nodes.forEach((n) => (n.userData.base = sel ? 1.45 : 1));
      this.labels[name].textContent = `${name} ${(r.probability * 100).toFixed(0)}%${v.uncertain ? " (uncertain)" : ""}`;
      this.labels[name].classList.toggle("selected", sel);
    }
  }

  frame() {
    const t = this.clock.getElapsedTime();
    for (const v of Object.values(this.vessels)) {
      // uncertain vessels (conformal set contains both labels) pulse gently
      const k = v.uncertain ? 1 + 0.22 * (0.5 + 0.5 * Math.sin(t * 3)) : 1;
      v.nodes.forEach((n) => n.scale.setScalar((n.userData.base || 1) * k));
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    for (const [name, v] of Object.entries(this.vessels)) {
      const p = this.root.localToWorld(v.curve.getPoint(0.55).clone()).project(this.camera);
      const el = this.labels[name];
      el.style.left = `${((p.x + 1) / 2) * r.width}px`;
      el.style.top = `${((1 - p.y) / 2) * r.height}px`;
    }
  }
}
