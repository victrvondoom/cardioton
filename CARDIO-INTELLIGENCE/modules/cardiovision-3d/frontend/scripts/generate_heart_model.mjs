import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Node.js FileReader polyfill for Three.js GLTFExporter
class FileReaderPolyfill {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then(buf => {
      this.result = buf;
      if (this.onloadend) this.onloadend({ target: this });
    });
  }
}
globalThis.FileReader = FileReaderPolyfill;

console.log('[Heart Generator] Building High-Fidelity Anatomical 3D Heart Model with Distinct Coronary Arteries...');

const scene = new THREE.Scene();
const rootGroup = new THREE.Group();
rootGroup.name = 'HumanHeart';

// ==========================================
// 1. PBR MATERIALS
// ==========================================
// Deep red anatomical myocardial ventricular walls
const myocardiumMat = new THREE.MeshStandardMaterial({
  name: 'Mat_Myocardium',
  color: new THREE.Color('#7f1d1d'), // Deep clinical crimson
  roughness: 0.50,
  metalness: 0.12,
});

const atriaMat = new THREE.MeshStandardMaterial({
  name: 'Mat_Atria',
  color: new THREE.Color('#701a35'), // Deeper atrium muscle tone
  roughness: 0.52,
  metalness: 0.10,
});

// Ascending aorta arch: distinct pinkish-buff arterial wall
const aortaMat = new THREE.MeshStandardMaterial({
  name: 'Mat_Aorta',
  color: new THREE.Color('#fecdd3'), // Crisp arterial pinkish-buff
  roughness: 0.30,
  metalness: 0.18,
});

// Pulmonary trunk: distinct cyan/blue pulmonary artery
const pulmonaryMat = new THREE.MeshStandardMaterial({
  name: 'Mat_PulmonaryArtery',
  color: new THREE.Color('#0284c7'), // Vibrant clinical pulmonary blue
  roughness: 0.32,
  metalness: 0.15,
});

const venaCavaMat = new THREE.MeshStandardMaterial({
  name: 'Mat_VenaCava',
  color: new THREE.Color('#1e3a8a'), // Deep systemic venous blue
  roughness: 0.35,
  metalness: 0.12,
});

const fatPadMat = new THREE.MeshStandardMaterial({
  name: 'Mat_EpicardialFat',
  color: new THREE.Color('#fef9c3'), // Sulcus adipose tissue
  roughness: 0.70,
  metalness: 0.05,
});

// Artery PBR Materials (resting emerald green #059669)
const ladMat = new THREE.MeshStandardMaterial({
  name: 'Mat_LAD',
  color: new THREE.Color('#059669'),
  roughness: 0.18,
  metalness: 0.25,
  emissive: new THREE.Color('#047857'),
  emissiveIntensity: 0.35,
});

const lcxMat = new THREE.MeshStandardMaterial({
  name: 'Mat_LCX',
  color: new THREE.Color('#059669'),
  roughness: 0.18,
  metalness: 0.25,
  emissive: new THREE.Color('#047857'),
  emissiveIntensity: 0.35,
});

const rcaMat = new THREE.MeshStandardMaterial({
  name: 'Mat_RCA',
  color: new THREE.Color('#059669'),
  roughness: 0.18,
  metalness: 0.25,
  emissive: new THREE.Color('#047857'),
  emissiveIntensity: 0.35,
});

// ==========================================
// 2. ANATOMICAL VENTRICLES & ATRIAL MASS
// ==========================================
function createSculptedVentricularMass() {
  const geo = new THREE.SphereGeometry(1.02, 64, 64);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);

    // Anatomical Heart Shaping:
    // Left Ventricle dominant apex pointing to (-0.14, -1.35, 0.22)
    if (v.y < 0) {
      const taper = 1.0 + v.y * 0.44;
      v.x *= Math.max(taper, 0.22);
      v.z *= Math.max(taper * 0.85, 0.22);
      v.x -= Math.pow(Math.abs(v.y), 1.35) * 0.14; // curve towards left apex
      v.z += Math.pow(Math.abs(v.y), 1.15) * 0.14; // curve anteriorly
      v.y *= 1.36; // elongate ventricles
    } else {
      v.x *= 1.16;
      v.z *= 0.96;
      v.y *= 0.84;
    }

    // Anterior interventricular sulcus indentation where LAD runs
    const angle = Math.atan2(v.z, v.x);
    if (angle > 0.82 && angle < 1.58 && v.y < 0.25 && v.y > -1.1) {
      const depth = Math.sin((angle - 0.82) / 0.76 * Math.PI) * 0.08 * (1.0 - Math.abs(v.y) / 1.4);
      v.x -= depth * Math.cos(angle);
      v.z -= depth * Math.sin(angle);
    }

    pos.setXYZ(i, v.x, v.y, v.z);
  }

  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, myocardiumMat);
  mesh.name = 'Myocardium';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createRightVentricleBulge() {
  const geo = new THREE.SphereGeometry(0.74, 32, 32);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    v.x *= 1.12;
    v.y *= 1.24;
    v.z *= 0.64;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, myocardiumMat);
  mesh.name = 'RightVentricle';
  mesh.position.set(0.38, -0.32, 0.44);
  mesh.rotation.set(0.2, -0.3, 0.15);
  return mesh;
}

function createAtria() {
  const atriaGroup = new THREE.Group();
  atriaGroup.name = 'Atria_Group';

  // Left Atrium (posterior-superior)
  const laGeo = new THREE.SphereGeometry(0.56, 32, 32);
  const laMesh = new THREE.Mesh(laGeo, atriaMat);
  laMesh.name = 'LeftAtrium';
  laMesh.position.set(-0.35, 0.62, -0.25);
  laMesh.scale.set(1.12, 0.86, 1.02);
  atriaGroup.add(laMesh);

  // Left Auricle
  const laAuricleGeo = new THREE.ConeGeometry(0.26, 0.52, 24);
  const laAuricle = new THREE.Mesh(laAuricleGeo, atriaMat);
  laAuricle.position.set(-0.55, 0.52, 0.28);
  laAuricle.rotation.set(1.2, 0.3, -0.8);
  laAuricle.name = 'LeftAuricle';
  atriaGroup.add(laAuricle);

  // Right Atrium
  const raGeo = new THREE.SphereGeometry(0.62, 32, 32);
  const raMesh = new THREE.Mesh(raGeo, atriaMat);
  raMesh.name = 'RightAtrium';
  raMesh.position.set(0.52, 0.55, 0.05);
  raMesh.scale.set(1.02, 1.12, 0.92);
  atriaGroup.add(raMesh);

  // Right Auricle
  const raAuricleGeo = new THREE.ConeGeometry(0.28, 0.55, 24);
  const raAuricle = new THREE.Mesh(raAuricleGeo, atriaMat);
  raAuricle.position.set(0.38, 0.68, 0.42);
  raAuricle.rotation.set(1.4, -0.4, 0.5);
  raAuricle.name = 'RightAuricle';
  atriaGroup.add(raAuricle);

  return atriaGroup;
}

// ==========================================
// 3. GREAT VESSELS: AORTA & PULMONARY TRUNK
// ==========================================
function createGreatVessels() {
  const vesselsGroup = new THREE.Group();
  vesselsGroup.name = 'GreatVessels';

  // Ascending Aorta and Aortic Arch
  const aortaCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.02, 0.35, 0.08),   // Aortic root
    new THREE.Vector3(-0.02, 0.88, 0.02),  // Ascending aorta
    new THREE.Vector3(-0.14, 1.30, -0.15), // Arch apex
    new THREE.Vector3(-0.28, 1.10, -0.42), // Arch turn
    new THREE.Vector3(-0.30, 0.45, -0.55), // Descending thoracic aorta
  ]);
  const aortaGeo = new THREE.TubeGeometry(aortaCurve, 48, 0.23, 24, false);
  const aortaMesh = new THREE.Mesh(aortaGeo, aortaMat);
  aortaMesh.name = 'Aorta';
  vesselsGroup.add(aortaMesh);

  // Brachiocephalic Artery
  const bCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.08, 1.25, -0.12),
    new THREE.Vector3(0.10, 1.62, -0.05),
  ]);
  const bMesh = new THREE.Mesh(new THREE.TubeGeometry(bCurve, 14, 0.075, 16, false), aortaMat);
  bMesh.name = 'BrachiocephalicArtery';
  vesselsGroup.add(bMesh);

  // Left Common Carotid
  const lccCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.16, 1.29, -0.18),
    new THREE.Vector3(-0.12, 1.68, -0.16),
  ]);
  const lccMesh = new THREE.Mesh(new THREE.TubeGeometry(lccCurve, 14, 0.060, 16, false), aortaMat);
  lccMesh.name = 'LeftCommonCarotid';
  vesselsGroup.add(lccMesh);

  // Left Subclavian
  const lscCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.22, 1.25, -0.26),
    new THREE.Vector3(-0.30, 1.64, -0.28),
  ]);
  const lscMesh = new THREE.Mesh(new THREE.TubeGeometry(lscCurve, 14, 0.060, 16, false), aortaMat);
  lscMesh.name = 'LeftSubclavian';
  vesselsGroup.add(lscMesh);

  // Pulmonary Trunk crossing anterior to ascending aorta
  const pulCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.18, 0.25, 0.44),   // Infundibulum origin
    new THREE.Vector3(0.08, 0.74, 0.30),   // Crossing in front of aorta
    new THREE.Vector3(-0.06, 0.98, 0.05),  // Bifurcation point
  ]);
  const pulGeo = new THREE.TubeGeometry(pulCurve, 36, 0.22, 24, false);
  const pulMesh = new THREE.Mesh(pulGeo, pulmonaryMat);
  pulMesh.name = 'PulmonaryTrunk';
  vesselsGroup.add(pulMesh);

  // Left Pulmonary Branch
  const lpCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.06, 0.98, 0.05),
    new THREE.Vector3(-0.52, 0.94, -0.22),
  ]);
  const lpMesh = new THREE.Mesh(new THREE.TubeGeometry(lpCurve, 16, 0.13, 16, false), pulmonaryMat);
  lpMesh.name = 'LeftPulmonaryArtery';
  vesselsGroup.add(lpMesh);

  // Right Pulmonary Branch (runs beneath aortic arch)
  const rpCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.06, 0.98, 0.05),
    new THREE.Vector3(0.46, 0.90, -0.24),
  ]);
  const rpMesh = new THREE.Mesh(new THREE.TubeGeometry(rpCurve, 16, 0.13, 16, false), pulmonaryMat);
  rpMesh.name = 'RightPulmonaryArtery';
  vesselsGroup.add(rpMesh);

  // Superior Vena Cava (SVC)
  const svcCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.62, 0.45, -0.15),
    new THREE.Vector3(0.58, 1.30, -0.18),
  ]);
  const svcMesh = new THREE.Mesh(new THREE.TubeGeometry(svcCurve, 20, 0.18, 20, false), venaCavaMat);
  svcMesh.name = 'SuperiorVenaCava';
  vesselsGroup.add(svcMesh);

  // Inferior Vena Cava (IVC)
  const ivcCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.52, -0.55, -0.32),
    new THREE.Vector3(0.56, -0.90, -0.36),
  ]);
  const ivcMesh = new THREE.Mesh(new THREE.TubeGeometry(ivcCurve, 16, 0.17, 20, false), venaCavaMat);
  ivcMesh.name = 'InferiorVenaCava';
  vesselsGroup.add(ivcMesh);

  return vesselsGroup;
}

// Epicardial sulcus cushioning
function createEpicardialFatPads() {
  const fatGroup = new THREE.Group();
  fatGroup.name = 'EpicardialFat';

  const avCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.46, 0.36, 0.58),
    new THREE.Vector3(0.0, 0.42, 0.74),
    new THREE.Vector3(0.56, 0.30, 0.54),
    new THREE.Vector3(0.74, 0.16, 0.0),
    new THREE.Vector3(0.54, 0.10, -0.52),
  ]);
  const avFat = new THREE.Mesh(new THREE.TubeGeometry(avCurve, 36, 0.09, 14, false), fatPadMat);
  fatGroup.add(avFat);

  return fatGroup;
}

// ==========================================
// 4. DISTINCT CORONARY ARTERY TREE (LAD, LCX, RCA)
// Prominent, elevated calibers for optimal anatomical clarity
// ==========================================
function createCoronaryBranch(curvePointsList, radiiList, material, vesselName) {
  const vesselGroup = new THREE.Group();
  vesselGroup.name = vesselName;

  curvePointsList.forEach((pts, idx) => {
    const vectors = pts.map(p => new THREE.Vector3(...p));
    const curve = new THREE.CatmullRomCurve3(vectors);
    const radius = radiiList[idx] || 0.055;
    const geo = new THREE.TubeGeometry(curve, 54, radius, 16, false);
    const mesh = new THREE.Mesh(geo, material);
    mesh.name = `${vesselName}_Segment_${idx + 1}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    vesselGroup.add(mesh);
  });

  return vesselGroup;
}

// LAD: Left Anterior Descending Artery
// Running prominently down the anterior interventricular groove to the apex
function createLADSystem() {
  const ladMain = [
    [-0.05, 0.44, 0.55],
    [-0.02, 0.30, 0.78],
    [0.02, 0.08, 0.94],
    [0.01, -0.20, 1.00],
    [-0.04, -0.52, 0.94],
    [-0.09, -0.84, 0.78],
    [-0.14, -1.14, 0.54],
    [-0.17, -1.34, 0.28], // Cardiac Apex
  ];

  // First Diagonal Branch (D1)
  const d1Branch = [
    [0.02, 0.08, 0.94],
    [-0.24, -0.06, 0.92],
    [-0.46, -0.26, 0.80],
    [-0.60, -0.52, 0.60],
  ];

  // Second Diagonal Branch (D2)
  const d2Branch = [
    [-0.04, -0.52, 0.94],
    [-0.28, -0.66, 0.82],
    [-0.48, -0.86, 0.58],
  ];

  // Septal Perforator (S1)
  const s1Branch = [
    [0.01, -0.20, 1.00],
    [0.09, -0.30, 0.88],
    [0.14, -0.46, 0.74],
  ];

  return createCoronaryBranch(
    [ladMain, d1Branch, d2Branch, s1Branch],
    [0.065, 0.045, 0.038, 0.034],
    ladMat,
    'LAD'
  );
}

// LCX: Left Circumflex Artery
// Running along the left atrioventricular groove to the posterior lateral wall
function createLCXSystem() {
  const lcxMain = [
    [-0.05, 0.44, 0.55],
    [-0.30, 0.42, 0.60],
    [-0.60, 0.34, 0.52],
    [-0.84, 0.18, 0.26],
    [-0.94, -0.02, -0.06],
    [-0.88, -0.26, -0.36],
    [-0.68, -0.50, -0.54],
    [-0.44, -0.70, -0.60],
  ];

  // First Obtuse Marginal Branch (OM1)
  const om1Branch = [
    [-0.84, 0.18, 0.26],
    [-0.98, -0.06, 0.18],
    [-1.02, -0.36, 0.04],
    [-0.92, -0.66, -0.12],
  ];

  // Second Obtuse Marginal Branch (OM2)
  const om2Branch = [
    [-0.88, -0.26, -0.36],
    [-0.92, -0.52, -0.34],
    [-0.80, -0.78, -0.28],
  ];

  return createCoronaryBranch(
    [lcxMain, om1Branch, om2Branch],
    [0.062, 0.042, 0.036],
    lcxMat,
    'LCX'
  );
}

// RCA: Right Coronary Artery
// Running through the right atrioventricular groove to diaphragmatic surface
function createRCASystem() {
  const rcaMain = [
    [0.16, 0.40, 0.52],
    [0.38, 0.34, 0.62],
    [0.62, 0.20, 0.56],
    [0.78, -0.02, 0.42],
    [0.84, -0.26, 0.16],
    [0.78, -0.54, -0.12],
    [0.65, -0.74, -0.34],
    [0.44, -0.90, -0.48],
  ];

  // Conus Branch
  const conusBranch = [
    [0.16, 0.40, 0.52],
    [0.28, 0.48, 0.58],
    [0.38, 0.56, 0.52],
  ];

  // Acute Marginal (AM) Branch
  const amBranch = [
    [0.78, -0.02, 0.42],
    [0.84, -0.22, 0.48],
    [0.82, -0.48, 0.46],
    [0.72, -0.76, 0.36],
  ];

  // Posterior Descending Artery (PDA)
  const pdaBranch = [
    [0.44, -0.90, -0.48],
    [0.30, -1.04, -0.36],
    [0.14, -1.18, -0.18],
    [-0.04, -1.26, 0.02],
  ];

  return createCoronaryBranch(
    [rcaMain, conusBranch, amBranch, pdaBranch],
    [0.062, 0.034, 0.040, 0.044],
    rcaMat,
    'RCA'
  );
}

// Assemble Complete Organ
rootGroup.add(createSculptedVentricularMass());
rootGroup.add(createRightVentricleBulge());
rootGroup.add(createAtria());
rootGroup.add(createGreatVessels());
rootGroup.add(createEpicardialFatPads());

// Coronary Arteries
rootGroup.add(createLADSystem());
rootGroup.add(createLCXSystem());
rootGroup.add(createRCASystem());

scene.add(rootGroup);

// Export to .glb binary
const outputPath = path.resolve(__dirname, '../public/models/cardiovision_3d__public_models__heart.glb');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });

const exporter = new GLTFExporter();
exporter.parse(
  scene,
  (glbBuffer) => {
    fs.writeFileSync(outputPath, Buffer.from(glbBuffer));
    const stats = fs.statSync(outputPath);
    console.log(`[Heart Generator] Model generated successfully!`);
    console.log(`  Path: ${outputPath}`);
    console.log(`  Size: ${(stats.size / 1024).toFixed(1)} KB`);
  },
  (err) => {
    console.error('[Heart Generator] Error exporting GLB:', err);
    process.exit(1);
  },
  { binary: true }
);
