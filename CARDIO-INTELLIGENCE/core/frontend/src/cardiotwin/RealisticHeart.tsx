import { useFrame, useLoader, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { accelerateHeartMesh, createHeartResourceLifetime, releaseHeartGeometry } from "./heartGeometryAcceleration";

type Point = [number, number, number];
type SurfacePoint = [number, number];

export interface RealisticHeartProps {
  animated: boolean;
  cutaway?: boolean;
  vesselsVisible?: boolean;
  flowVisible?: boolean;
  selectedStructure?: string | null;
  onSelectStructure?: (structure: string) => void;
}

// HRA supplies the chamber, valve and septal reference surfaces. Surface
// treatments, vessels and presentation motion are illustrative additions;
// none reconstruct patient imaging or encode measured pressure or blood flow.
const HEART_MODEL = "/models/hra-human-heart.glb";

function hash(x: number, y: number) {
  let value = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function noise(x: number, y: number) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const dx = x - ix, dy = y - iy;
  const u = dx * dx * (3 - 2 * dx), v = dy * dy * (3 - 2 * dy);
  return THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(hash(ix, iy), hash(ix + 1, iy), u),
    THREE.MathUtils.lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), u), v,
  );
}

function tissueTextures() {
  const size = 512;
  const color = new Uint8Array(size * size * 4);
  const bump = new Uint8Array(size * size * 4);
  const roughness = new Uint8Array(size * size * 4);
  const adipose = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const broad = noise(u * 14, v * 15);
      const grain = noise(u * 157, v * 164);
      const fine = hash(x, y);
      const fibers = Math.sin(u * 940 + noise(u * 17, v * 19) * 39 + v * 87);
      const secondaryFibers = Math.sin(u * 1350 - v * 116 + grain * 7);
      const variation = broad * .62 + grain * .28 + fine * .1;
      const marbling = Math.pow(noise(u * 31 + 7, v * 34 + 4), 4);
      const index = (y * size + x) * 4;
      color[index] = 99 + variation * 54 + fibers * 2 + marbling * 15;
      color[index + 1] = 43 + variation * 41 + fibers + marbling * 14;
      color[index + 2] = 39 + variation * 34 + fibers + marbling * 10;
      color[index + 3] = 255;
      const height = 105 + grain * 36 + fine * 15 + fibers * 5 + secondaryFibers * 2;
      const matte = 167 + broad * 23 + grain * 19;
      for (let channel = 0; channel < 3; channel++) {
        bump[index + channel] = height;
        roughness[index + channel] = matte;
      }
      bump[index + 3] = roughness[index + 3] = 255;
      const fatMottle = noise(u * 29 + 3, v * 21 + 9);
      adipose[index] = 173 + fatMottle * 41 + fine * 3;
      adipose[index + 1] = 135 + fatMottle * 38 + fine * 3;
      adipose[index + 2] = 93 + fatMottle * 34 + fine * 2;
      const feather = 1 - THREE.MathUtils.smoothstep(Math.abs(v * 2 - 1), .2, .97);
      const patches = THREE.MathUtils.smoothstep(noise(u * 17 + 8, v * 6 + 13), .31, .76);
      adipose[index + 3] = feather * patches * 232;
    }
  }
  const texture = (data: Uint8Array<ArrayBuffer>, space: THREE.ColorSpace = THREE.NoColorSpace) => {
    const result = new THREE.DataTexture(data, size, size);
    result.wrapS = result.wrapT = THREE.RepeatWrapping;
    result.magFilter = THREE.LinearFilter;
    result.minFilter = THREE.LinearMipmapLinearFilter;
    result.generateMipmaps = true;
    result.colorSpace = space;
    result.anisotropy = 4;
    result.needsUpdate = true;
    return result;
  };
  return { color: texture(color, THREE.SRGBColorSpace), bump: texture(bump), roughness: texture(roughness), adipose: texture(adipose, THREE.SRGBColorSpace) };
}

function structureOf(name: string) {
  const value = name.toLowerCase();
  if (value.includes("left_ventricle")) return "LEFT_VENTRICLE";
  if (value.includes("right_ventricle")) return "RIGHT_VENTRICLE";
  if (value.includes("left_cardiac_atrium")) return "LEFT_ATRIUM";
  if (value.includes("right_cardiac_atrium")) return "RIGHT_ATRIUM";
  if (value.includes("interventricular_septum")) return "INTERVENTRICULAR_SEPTUM";
  if (value.includes("mitral_valve")) return "MITRAL_VALVE";
  if (value.includes("tricuspid_valve")) return "TRICUSPID_VALVE";
  if (value.includes("aortic_valve")) return "AORTIC_VALVE";
  if (value.includes("pulmonary_valve")) return "PULMONARY_VALVE";
  return "PAPILLARY_MUSCLE";
}

function taperedTube(curve: THREE.CatmullRomCurve3, radius: number, endRadius = radius, segments = 64) {
  const sides = radius > .06 ? 20 : 12;
  const geometry = new THREE.TubeGeometry(curve, segments, 1, sides, false);
  const position = geometry.getAttribute("position");
  const color = new Float32Array(position.count * 3);
  const vertex = new THREE.Vector3();
  for (let ring = 0; ring <= segments; ring++) {
    const t = ring / segments;
    const center = curve.getPointAt(t);
    const thickness = THREE.MathUtils.lerp(radius, endRadius, t) * (1 + Math.sin(t * 11) * .018);
    for (let side = 0; side <= sides; side++) {
      const index = ring * (sides + 1) + side;
      vertex.fromBufferAttribute(position, index).sub(center).multiplyScalar(thickness).add(center);
      position.setXYZ(index, vertex.x, vertex.y, vertex.z);
      const variation = .78 + noise(t * 19, side * .55) * .22;
      color.set([variation, variation, variation], index * 3);
    }
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(color, 3));
  geometry.computeVertexNormals();
  return geometry;
}

type FlowPath = { curve: THREE.CatmullRomCurve3; count: number; color: string; radius: number; offset: number };

function createHeart(source: THREE.Group) {
  const root = new THREE.Group();
  const tissues = new THREE.Group();
  const vessels = new THREE.Group();
  const fat = new THREE.Group();
  const textures = tissueTextures();
  const selectableMaterials: { id: string; material: THREE.MeshPhysicalMaterial }[] = [];
  const contraction = { value: 0 };
  const flowPaths: FlowPath[] = [];
  const tag = (mesh: THREE.Mesh, id: string) => { mesh.userData.structureId = id; return mesh; };
  source.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(source);
  const center = bounds.getCenter(new THREE.Vector3());
  const scale = 2.35 / bounds.getSize(new THREE.Vector3()).y;
  source.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld);
    geometry.translate(-center.x, -center.y, -center.z).scale(scale, scale, scale);
    const position = geometry.getAttribute("position");
    const uv = new Float32Array(position.count * 2);
    const color = new Float32Array(position.count * 3);
    const id = structureOf(object.name);
    const valve = id.endsWith("VALVE");
    for (let index = 0; index < position.count; index++) {
      const x = position.getX(index), y = position.getY(index), z = position.getZ(index);
      uv[index * 2] = Math.atan2(z, x) / (2 * Math.PI) + .5;
      uv[index * 2 + 1] = (y + 1.175) / 2.35;
      const shade = .82 + noise(x * 6 + 16, y * 7 + z * 3 + 16) * .18;
      color.set([shade, shade * .96, shade * .95], index * 3);
    }
    geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    geometry.setAttribute("color", new THREE.BufferAttribute(color, 3));
    const atrium = id.endsWith("ATRIUM");
    const material = new THREE.MeshPhysicalMaterial({
      color: valve ? "#d2b9a9" : atrium ? "#cbb0ae" : "#ecddcf",
      map: valve ? null : textures.color,
      bumpMap: textures.bump, bumpScale: valve ? .005 : .012,
      roughnessMap: textures.roughness, roughness: valve ? .97 : .92,
      metalness: 0, clearcoat: valve ? .08 : .16,
      clearcoatRoughness: .48, sheen: .12,
      sheenColor: new THREE.Color("#b68b79"), sheenRoughness: .76,
      envMapIntensity: .45, vertexColors: true, side: THREE.DoubleSide,
    });
    if (id.endsWith("VENTRICLE") || atrium) {
      // This minute fixed-phase display deformation never uses patient data.
      material.onBeforeCompile = shader => {
        shader.uniforms.heartContraction = contraction;
        shader.vertexShader = "uniform float heartContraction;\n" + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>",
          "#include <begin_vertex>\nfloat chamberMask = 1.0 - smoothstep(0.40, 1.15, position.y);\ntransformed *= vec3(1.0 - heartContraction * chamberMask * 0.019, 1.0 + heartContraction * chamberMask * 0.009, 1.0 - heartContraction * chamberMask * 0.015);");
      };
      material.customProgramCacheKey = () => "cardioton-reference-tissue-v3";
    }
    const mesh = tag(accelerateHeartMesh(new THREE.Mesh(geometry, material)), id);
    mesh.name = object.name;
    mesh.castShadow = mesh.receiveShadow = true;
    tissues.add(mesh);
    selectableMaterials.push({ id, material });
  });
  root.add(tissues, vessels, fat);
  tissues.updateMatrixWorld(true);

  const vesselMaterial = (color: string, id: string) => {
    const material = new THREE.MeshPhysicalMaterial({ color, bumpMap: textures.bump,
      bumpScale: .013, roughness: .65, metalness: 0, clearcoat: .15,
      clearcoatRoughness: .45, sheen: .08, sheenColor: "#ba9991",
      envMapIntensity: .45, side: THREE.DoubleSide, vertexColors: true });
    selectableMaterials.push({ id, material });
    return material;
  };
  const aorta = vesselMaterial("#88564e", "AORTA");
  const pulmonary = vesselMaterial("#686878", "PULMONARY_ARTERY");
  const cava = vesselMaterial("#6d626d", "VENA_CAVA");
  const pulmonaryVein = vesselMaterial("#906764", "PULMONARY_VEINS");
  const arterialCoronaries = Object.fromEntries(["LAD", "RCA", "LCX"].map(id => [id, vesselMaterial("#966b54", id)]));
  const coronaryVein = vesselMaterial("#686079", "CORONARY_VEINS");
  const rimMaterial = new THREE.MeshPhysicalMaterial({ color: "#c28c80", roughness: .57, metalness: 0, clearcoat: .18 });
  const lumenMaterial = new THREE.MeshStandardMaterial({ color: "#2b0f16", roughness: .95, side: THREE.DoubleSide });
  const vessel = (id: string, points: Point[], radius: number, endRadius: number, material: THREE.Material, flow = false) => {
    const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)), false, "centripetal");
    const mesh = tag(new THREE.Mesh(taperedTube(curve, radius, endRadius), material), id);
    mesh.castShadow = mesh.receiveShadow = true;
    vessels.add(mesh);
    const end = curve.getPointAt(1), direction = curve.getTangentAt(1);
    const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
    const rim = tag(new THREE.Mesh(new THREE.TorusGeometry(endRadius * .87, endRadius * .13, 8, 28), rimMaterial), id);
    rim.position.copy(end);
    rim.quaternion.copy(rotation);
    const lumen = tag(new THREE.Mesh(new THREE.CircleGeometry(endRadius * .73, 28), lumenMaterial), id);
    lumen.position.copy(end).addScaledVector(direction, -.015);
    lumen.quaternion.copy(rotation);
    vessels.add(rim, lumen);
    if (flow) flowPaths.push({ curve, count: 10, color: id === "AORTA" ? "#f4b08c" : "#91c3da", radius: radius * .22, offset: radius * 1.09 });
  };

  // Great-vessel diameter and shape stay fixed across all clinical states.
  vessel("AORTA", [[-.25,.57,-.17],[-.29,1.1,-.19],[-.17,1.48,-.27],
    [.21,1.64,-.38],[.63,1.48,-.58],[.81,1.12,-.68],[.76,.57,-.69]], .17, .135, aorta, true);
  vessel("AORTA", [[-.16,1.45,-.28],[-.3,1.75,-.27],[-.38,2.02,-.25]], .071, .055, aorta);
  vessel("AORTA", [[.16,1.62,-.37],[.2,1.85,-.37],[.22,2.11,-.34]], .054, .04, aorta);
  vessel("AORTA", [[.51,1.55,-.51],[.64,1.79,-.55],[.78,1.96,-.56]], .063, .044, aorta);
  vessel("PULMONARY_ARTERY", [[.03,.6,.24],[-.06,1.02,.31],[-.22,1.34,.18],[-.55,1.44,.02],[-.86,1.37,-.06]], .16, .112, pulmonary, true);
  vessel("PULMONARY_ARTERY", [[-.2,1.28,.2],[.15,1.38,-.03],[.54,1.32,-.28],[.88,1.25,-.42]], .11, .085, pulmonary);
  vessel("VENA_CAVA", [[-.9,.6,-.09],[-.98,1.12,-.13],[-.87,1.67,-.17]], .115, .103, cava);
  vessel("VENA_CAVA", [[-.95,.18,-.21],[-1.13,-.28,-.3],[-1.1,-.68,-.36]], .1, .09, cava);
  vessel("PULMONARY_VEINS", [[.03,.56,-.7],[.44,.62,-.93],[.71,.7,-1.01]], .075, .067, pulmonaryVein);
  vessel("PULMONARY_VEINS", [[.08,.25,-.73],[.47,.27,-.99],[.74,.34,-1.04]], .07, .056, pulmonaryVein);
  vessel("PULMONARY_VEINS", [[-.06,.61,-.64],[-.47,.68,-.81],[-.7,.78,-.86]], .067, .058, pulmonaryVein);
  vessel("PULMONARY_VEINS", [[-.1,.33,-.7],[-.46,.29,-.88],[-.7,.35,-.98]], .064, .052, pulmonaryVein);

  const raycaster = new THREE.Raycaster();
  // Surface dressing needs the nearest point only. Keep this local to assembly:
  // interaction still receives every wall intersection for cutaway inspection.
  raycaster.firstHitOnly = true;
  const front = new THREE.Vector3(0, 0, -1);
  const exteriorMeshes = tissues.children.filter(object => !["PAPILLARY_MUSCLE", "INTERVENTRICULAR_SEPTUM"].includes(object.userData.structureId)
    && !String(object.userData.structureId).endsWith("VALVE"));
  const surfaceCache = new Map<string, { point: THREE.Vector3; normal: THREE.Vector3 } | null>();
  const surface = (x: number, y: number, offset = .016) => {
    // Paths and cushions reuse the same samples. Cache their reference
    // intersections during assembly instead of repeating dense mesh queries.
    const key = `${Math.round(x * 10000)}:${Math.round(y * 10000)}`;
    if (!surfaceCache.has(key)) {
      raycaster.set(new THREE.Vector3(x, y, 5), front);
      const hit = raycaster.intersectObjects(exteriorMeshes, false)[0];
      if (!hit) surfaceCache.set(key, null);
      else {
        const normal = hit.face?.normal.clone() ?? new THREE.Vector3(0, 0, 1);
        if (normal.z < 0) normal.negate();
        surfaceCache.set(key, { point: hit.point.clone(), normal });
      }
    }
    const sample = surfaceCache.get(key);
    return sample ? sample.point.clone().addScaledVector(sample.normal, offset) : null;
  };
  const conformingCurve = (path: SurfacePoint[], shift = 0, offset = .016) => {
    const xy = new THREE.CatmullRomCurve3(path.map(([x, y]) => new THREE.Vector3(x + shift, y, 0)), false, "centripetal");
    const points = Array.from({ length: 65 }, (_, index) => {
      const point = xy.getPoint(index / 64);
      return surface(point.x, point.y, offset);
    }).filter((point): point is THREE.Vector3 => point !== null);
    return points.length > 3 ? new THREE.CatmullRomCurve3(points, false, "centripetal") : null;
  };
  const coronary = (id: string, path: SurfacePoint[], radius: number, endRadius: number, material: THREE.Material, shift = 0, flow = false) => {
    const curve = conformingCurve(path, shift, radius * .45);
    if (!curve) return;
    const mesh = tag(new THREE.Mesh(taperedTube(curve, radius, endRadius, 96), material), id);
    mesh.castShadow = mesh.receiveShadow = true;
    vessels.add(mesh);
    if (flow) flowPaths.push({ curve, count: 9, color: "#ffc18e", radius: .017, offset: radius * 1.1 });
  };

  // Irregular cushions at coronary grooves are an illustrative epicardial
  // surface treatment, not an adipose measurement or an anatomical lesion.
  const fatMaterial = new THREE.MeshPhysicalMaterial({ color: "#e2cfb4", map: textures.adipose, bumpMap: textures.bump,
    bumpScale: .009, roughness: .86, clearcoat: .08, clearcoatRoughness: .55,
    sheen: .06, sheenColor: "#ccb897", side: THREE.DoubleSide, vertexColors: true,
    transparent: true, depthWrite: false, opacity: .86 });
  const fatRibbon = (path: SurfacePoint[], width: number) => {
    const xy = new THREE.CatmullRomCurve3(path.map(([x, y]) => new THREE.Vector3(x, y, 0)), false, "centripetal");
    const positions: number[] = [], colors: number[] = [], uv: number[] = [], indices: number[] = [];
    const rows = 65, columns = 7;
    let validRows = 0;
    for (let row = 0; row < rows; row++) {
      const t = row / (rows - 1);
      const point = xy.getPoint(t), tangent = xy.getTangent(t);
      const centerSurface = surface(point.x, point.y, .006);
      if (!centerSurface) continue;
      const normal = new THREE.Vector2(-tangent.y, tangent.x).normalize();
      const breadth = width * (.38 + noise(t * 27, 6) * .75) * Math.pow(Math.sin(Math.PI * t), .35);
      for (let column = 0; column < columns; column++) {
        const across = column / (columns - 1) * 2 - 1;
        const puff = (1 - across * across) * (.003 + noise(t * 33, column * .4) * .005);
        const sample = surface(point.x + normal.x * breadth * across, point.y + normal.y * breadth * across, .006 + puff)
          ?? centerSurface.clone().add(new THREE.Vector3(0, 0, puff));
        positions.push(sample.x, sample.y, sample.z);
        const shade = .73 + noise(t * 35, column * .8) * .27;
        colors.push(shade, shade, shade);
        uv.push(t * 2, column / (columns - 1));
        if (validRows > 0 && column < columns - 1) {
          const a = (validRows - 1) * columns + column, b = a + columns;
          indices.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
      validRows++;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, fatMaterial);
    mesh.raycast = () => undefined;
    fat.add(mesh);
  };

  const main: SurfacePoint[] = [[-.18,.73],[-.1,.5],[.12,.22],[.33,-.15],[.54,-.51],[.73,-.91]];
  const right: SurfacePoint[] = [[-.14,.57],[-.55,.43],[-.86,.18],[-1.01,-.14],[-.79,-.44]];
  const circumflex: SurfacePoint[] = [[-.18,.73],[.25,.5],[.64,.38],[.98,.12],[1.05,-.2]];
  fatRibbon(main, .041);
  fatRibbon(right, .046);
  fatRibbon(circumflex, .035);
  coronary("LAD", main, .026, .005, arterialCoronaries.LAD, 0, true);
  coronary("CORONARY_VEINS", main, .018, .004, coronaryVein, .059);
  coronary("RCA", right, .025, .007, arterialCoronaries.RCA, 0, true);
  coronary("LCX", circumflex, .023, .004, arterialCoronaries.LCX);
  coronary("LAD", [[.1,.25],[.52,.21],[.85,.03],[1.02,-.3]], .017, .0028, arterialCoronaries.LAD);
  coronary("LAD", [[.34,-.15],[.74,-.23],[1.02,-.53]], .016, .0025, arterialCoronaries.LAD);
  coronary("LAD", [[.56,-.55],[.87,-.62],[.95,-.78]], .012, .002, arterialCoronaries.LAD);
  coronary("RCA", [[-.57,.4],[-.5,.03],[-.42,-.28],[-.29,-.58]], .016, .0025, arterialCoronaries.RCA);
  coronary("RCA", [[-.88,.17],[-.74,-.08],[-.61,-.38]], .013, .002, arterialCoronaries.RCA);
  coronary("LCX", [[.64,.38],[.83,.05],[.95,-.26],[.9,-.5]], .015, .0025, arterialCoronaries.LCX);
  coronary("CORONARY_VEINS", [[.05,.33],[-.12,.08],[-.14,-.25],[.06,-.58]], .014, .0025, coronaryVein);
  coronary("CORONARY_VEINS", [[.7,-.07],[.82,-.3],[.94,-.46]], .01, .002, coronaryVein);

  const flowGeometry = new THREE.SphereGeometry(1, 8, 6);
  const flowMaterial = new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false });
  const flow = new THREE.InstancedMesh(flowGeometry, flowMaterial, flowPaths.reduce((sum, path) => sum + path.count, 0));
  flow.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  flow.frustumCulled = false;
  flow.visible = false;
  flow.raycast = () => undefined;
  const transform = new THREE.Object3D();
  const flowPoint = new THREE.Vector3();
  const setFlow = (phase: number) => {
    let index = 0;
    for (const path of flowPaths) {
      for (let particle = 0; particle < path.count; particle++) {
        const t = (particle / path.count + phase * .23) % 1;
        path.curve.getPointAt(t, flowPoint);
        // Optional symbols follow the fixed reference vessel path; they do
        // not portray measured velocity, volume or an individual circulation.
        flowPoint.z += path.offset + path.radius * .35;
        transform.position.copy(flowPoint);
        transform.scale.setScalar(path.radius);
        transform.updateMatrix();
        flow.setMatrixAt(index++, transform.matrix);
      }
    }
    flow.instanceMatrix.needsUpdate = true;
  };
  let flowIndex = 0;
  for (const path of flowPaths) for (let particle = 0; particle < path.count; particle++) flow.setColorAt(flowIndex++, new THREE.Color(path.color));
  setFlow(0);
  root.add(flow);
  root.position.y = -.43;
  root.rotation.set(.025, -.32, -.025);
  const retain = createHeartResourceLifetime(() => {
    const materials = new Set<THREE.Material>();
    const geometries = new Set<THREE.BufferGeometry>();
    root.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      const list = Array.isArray(object.material) ? object.material : [object.material];
      list.forEach(material => materials.add(material));
    });
    geometries.forEach(releaseHeartGeometry);
    materials.forEach(material => material.dispose());
    Object.values(textures).forEach(texture => texture.dispose());
  });
  return { root, tissues, vessels, fat, textures, contraction, selectableMaterials, flow, setFlow, retain };
}

export default function RealisticHeart({ animated, cutaway = false, vesselsVisible = true, flowVisible = false,
  selectedStructure = null, onSelectStructure }: RealisticHeartProps) {
  const gltf = useLoader(GLTFLoader, HEART_MODEL);
  const invalidate = useThree(state => state.invalidate);
  const model = useMemo(() => createHeart(gltf.scene), [gltf.scene]);
  const pulse = useRef<THREE.Group>(null);
  const elapsed = useRef(0);
  const planes = useMemo(() => [new THREE.Plane(new THREE.Vector3(0, 0, -1), .12)], []);
  useEffect(() => {
    model.vessels.visible = vesselsVisible;
    model.fat.visible = vesselsVisible;
    model.flow.visible = vesselsVisible && flowVisible;
    invalidate();
  }, [model, vesselsVisible, flowVisible, invalidate]);
  useEffect(() => {
    model.selectableMaterials.forEach(({ id, material }) => {
      material.emissive.set(id === selectedStructure ? "#53b5c6" : "#000000");
      material.emissiveIntensity = id === selectedStructure ? .18 : 0;
    });
    invalidate();
  }, [model, selectedStructure, invalidate]);
  useEffect(() => {
    model.root.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(material => {
        material.clippingPlanes = cutaway ? planes : null;
        material.needsUpdate = true;
      });
    });
    invalidate();
  }, [model, planes, cutaway, invalidate]);
  useFrame((_state, delta) => {
    // Keep phase while paused and discard long hidden-tab intervals. This
    // fixed rhythm is presentation motion, never a patient measurement.
    if (!pulse.current || !animated || document.visibilityState === "hidden") return;
    elapsed.current = (elapsed.current + Math.min(Math.max(delta, 0), .05)) % 1000;
    const phase = (elapsed.current % .88) / .88;
    const contraction = Math.exp(-Math.pow((phase - .18) / .067, 2))
      + .22 * Math.exp(-Math.pow((phase - .34) / .049, 2));
    model.contraction.value = contraction;
    pulse.current.scale.set(1 - contraction * .006, 1 + contraction * .003, 1 - contraction * .004);
    if (flowVisible && vesselsVisible) model.setFlow(elapsed.current);
  });
  useEffect(() => model.retain(), [model]);
  const select = (event: ThreeEvent<MouseEvent>) => {
    // GPU clipping does not change raycast geometry. Inspect the first
    // retained intersection so a hidden wall cannot steal a cutaway click.
    const target = cutaway ? event.intersections.find(hit => planes[0].distanceToPoint(hit.point) >= 0
      && typeof hit.object.userData.structureId === "string")?.object : event.object;
    const structure = target?.userData.structureId;
    if (typeof structure !== "string" || !onSelectStructure) return;
    event.stopPropagation();
    onSelectStructure(structure);
  };
  return <group ref={pulse} onClick={select}><primitive object={model.root} dispose={null} /></group>;
}
