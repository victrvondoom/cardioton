import { useFrame, useLoader } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

type Point = [number, number, number];

// Reference chamber surfaces are supplied by HRA, rather than assembled from
// primitives. The surface treatments and great/coronary vessels below are
// illustrative additions; this is not a reconstruction of patient imaging.
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
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const broad = noise(u * 18, v * 18);
      const grain = noise(u * 105, v * 105);
      const fine = hash(x, y);
      const fibers = Math.sin(u * 470 + noise(u * 14, v * 14) * 17 + v * 30);
      const variation = broad * .55 + grain * .3 + fine * .15;
      const index = (y * size + x) * 4;
      color[index] = 153 + variation * 56 + fibers * 5;
      color[index + 1] = 48 + variation * 39 + fibers * 2;
      color[index + 2] = 49 + variation * 38 + fibers * 2;
      color[index + 3] = 255;
      const height = 104 + grain * 54 + fine * 15 + fibers * 13;
      const matte = 161 + variation * 35;
      for (let channel = 0; channel < 3; channel++) {
        bump[index + channel] = height;
        roughness[index + channel] = matte;
      }
      bump[index + 3] = roughness[index + 3] = 255;
    }
  }
  const texture = (data: Uint8Array<ArrayBuffer>, space: THREE.ColorSpace = THREE.NoColorSpace) => {
    const result = new THREE.DataTexture(data, size, size);
    result.wrapS = result.wrapT = THREE.RepeatWrapping;
    result.magFilter = THREE.LinearFilter;
    result.minFilter = THREE.LinearMipmapLinearFilter;
    result.generateMipmaps = true;
    result.colorSpace = space;
    result.needsUpdate = true;
    return result;
  };
  return { color: texture(color, THREE.SRGBColorSpace), bump: texture(bump), roughness: texture(roughness) };
}

function taperedTube(curve: THREE.CatmullRomCurve3, radius: number, endRadius = radius, segments = 64) {
  const geometry = new THREE.TubeGeometry(curve, segments, 1, 12, false);
  const position = geometry.getAttribute("position");
  const color = new Float32Array(position.count * 3);
  const vertex = new THREE.Vector3();
  for (let ring = 0; ring <= segments; ring++) {
    const t = ring / segments;
    const center = curve.getPointAt(t);
    const thickness = THREE.MathUtils.lerp(radius, endRadius, t) * (1 + Math.sin(t * 11) * .024);
    for (let side = 0; side <= 12; side++) {
      const index = ring * 13 + side;
      vertex.fromBufferAttribute(position, index).sub(center).multiplyScalar(thickness).add(center);
      position.setXYZ(index, vertex.x, vertex.y, vertex.z);
      const variation = .86 + noise(t * 16, side * .55) * .14;
      color.set([variation, variation, variation], index * 3);
    }
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(color, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function cutVessel(points: Point[], radius: number, endRadius: number, material: THREE.Material) {
  const group = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)), false, "centripetal");
  group.add(new THREE.Mesh(taperedTube(curve, radius, endRadius), material));
  const end = curve.getPointAt(1), direction = curve.getTangentAt(1);
  const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(endRadius * .89, endRadius * .11, 8, 28),
    new THREE.MeshPhysicalMaterial({ color: "#bd8d83", roughness: .63, metalness: 0 }));
  rim.position.copy(end);
  rim.quaternion.copy(rotation);
  const lumen = new THREE.Mesh(new THREE.CircleGeometry(endRadius * .8, 28),
    new THREE.MeshStandardMaterial({ color: "#2e121c", roughness: .94, side: THREE.DoubleSide }));
  lumen.position.copy(end).addScaledVector(direction, -.008);
  lumen.quaternion.copy(rotation);
  group.add(rim, lumen);
  return group;
}

function createHeart(source: THREE.Group) {
  const root = new THREE.Group();
  const tissues = new THREE.Group();
  const textures = tissueTextures();
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
    for (let index = 0; index < position.count; index++) {
      const x = position.getX(index), y = position.getY(index), z = position.getZ(index);
      uv[index * 2] = Math.atan2(z, x) / (2 * Math.PI) + .5;
      uv[index * 2 + 1] = (y + 1.175) / 2.35;
      const shade = .88 + noise(x * 7 + 16, y * 7 + z * 3 + 16) * .12;
      color.set([shade, shade, shade], index * 3);
    }
    geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    geometry.setAttribute("color", new THREE.BufferAttribute(color, 3));
    const atrium = object.name.includes("atrium");
    const material = new THREE.MeshPhysicalMaterial({
      color: atrium ? "#d6b1bd" : "#fff0e5",
      map: textures.color, bumpMap: textures.bump, bumpScale: .013,
      roughnessMap: textures.roughness, roughness: .7, metalness: 0,
      clearcoat: .2, clearcoatRoughness: .38, sheen: .3,
      sheenColor: new THREE.Color("#d98c83"), sheenRoughness: .65,
      vertexColors: true, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = object.name;
    mesh.castShadow = mesh.receiveShadow = true;
    tissues.add(mesh);
  });
  root.add(tissues);
  tissues.updateMatrixWorld(true);

  const artery = new THREE.MeshPhysicalMaterial({ color: "#ac6555",
    bumpMap: textures.bump, bumpScale: .008, roughness: .52, metalness: 0,
    clearcoat: .16, clearcoatRoughness: .42, side: THREE.DoubleSide, vertexColors: true });
  const vein = new THREE.MeshPhysicalMaterial({ color: "#68788b", bumpMap: textures.bump,
    bumpScale: .014, roughness: .52, metalness: 0, clearcoat: .17,
    clearcoatRoughness: .42, side: THREE.DoubleSide, vertexColors: true });
  const arteryWall = new THREE.MeshPhysicalMaterial({ color: "#ba6961", bumpMap: textures.bump,
    bumpScale: .015, roughness: .52, metalness: 0, clearcoat: .16,
    clearcoatRoughness: .45, side: THREE.DoubleSide, vertexColors: true });

  // The reference file contains the four chamber walls and internal structures.
  // Great-vessel silhouettes give the chamber surfaces their exterior context.
  root.add(cutVessel([[-.25,.57,-.17],[-.29,1.1,-.19],[-.17,1.48,-.27],
    [.21,1.64,-.38],[.63,1.48,-.58],[.81,1.12,-.68],[.76,.57,-.69]], .17, .135, arteryWall));
  root.add(cutVessel([[-.16,1.45,-.28],[-.3,1.75,-.27],[-.38,2.02,-.25]], .071, .055, arteryWall));
  root.add(cutVessel([[.16,1.62,-.37],[.2,1.85,-.37],[.22,2.11,-.34]], .054, .04, arteryWall));
  root.add(cutVessel([[.51,1.55,-.51],[.64,1.79,-.55],[.78,1.96,-.56]], .063, .044, arteryWall));
  root.add(cutVessel([[.03,.6,.24],[-.06,1.02,.31],[-.22,1.34,.18],[-.55,1.44,.02],[-.86,1.37,-.06]], .16, .112, vein));
  root.add(cutVessel([[-.2,1.28,.2],[.15,1.38,-.03],[.54,1.32,-.28],[.88,1.25,-.42]], .11, .085, vein));
  root.add(cutVessel([[-.9,.6,-.09],[-.98,1.12,-.13],[-.87,1.67,-.17]], .115, .103, vein));
  root.add(cutVessel([[-.95,.18,-.21],[-1.13,-.28,-.3],[-1.1,-.68,-.36]], .1, .09, vein));
  root.add(cutVessel([[.03,.56,-.7],[.44,.62,-.93],[.71,.7,-1.01]], .075, .067, arteryWall));
  root.add(cutVessel([[.08,.25,-.73],[.47,.27,-.99],[.74,.34,-1.04]], .07, .056, arteryWall));

  const raycaster = new THREE.Raycaster();
  const front = new THREE.Vector3(0, 0, -1);
  const surface = (x: number, y: number, offset = .016) => {
    raycaster.set(new THREE.Vector3(x, y, 5), front);
    const hit = raycaster.intersectObjects(tissues.children, false)[0];
    if (!hit) return null;
    return hit.point.clone().addScaledVector(hit.face?.normal ?? new THREE.Vector3(0, 0, 1), offset);
  };
  const coronary = (path: [number, number][], radius: number, endRadius: number, material: THREE.Material, shift = 0) => {
    // Sample each vessel densely onto the true chamber surface before creating
    // its tapered tube, so branches conform to the anatomy instead of floating.
    const xy = new THREE.CatmullRomCurve3(path.map(([x, y]) => new THREE.Vector3(x + shift, y, 0)), false, "centripetal");
    const points = Array.from({ length: 45 }, (_, index) => {
      const point = xy.getPoint(index / 44);
      return surface(point.x, point.y);
    }).filter((point): point is THREE.Vector3 => point !== null);
    if (points.length < 3) return;
    const curve = new THREE.CatmullRomCurve3(points, false, "centripetal");
    root.add(new THREE.Mesh(taperedTube(curve, radius, endRadius, 96), material));
  };
  const main: [number, number][] = [[-.18,.73],[-.1,.5],[.12,.22],[.33,-.15],[.54,-.51],[.73,-.91]];
  coronary(main, .033, .009, artery);
  coronary(main, .024, .008, vein, .065);
  coronary([[-.14,.57],[-.55,.43],[-.86,.18],[-1.01,-.14],[-.79,-.44]], .031, .013, artery);
  coronary([[.1,.25],[.52,.21],[.85,.03],[1.02,-.3]], .023, .006, artery);
  coronary([[.34,-.15],[.74,-.23],[1.02,-.53]], .021, .005, artery);
  coronary([[.56,-.55],[.87,-.62],[.95,-.78]], .017, .004, artery);
  coronary([[-.57,.4],[-.5,.03],[-.42,-.28],[-.29,-.58]], .021, .005, artery);
  coronary([[-.88,.17],[-.74,-.08],[-.61,-.38]], .017, .004, artery);
  coronary([[.05,.33],[-.12,.08],[-.14,-.25],[.06,-.58]], .019, .004, vein);
  coronary([[.7,-.07],[.82,-.3],[.94,-.46]], .013, .003, vein);

  root.position.y = -.43;
  root.rotation.set(.025, -.32, -.025);
  return { root, textures };
}

export default function RealisticHeart({ animated }: { animated: boolean }) {
  const gltf = useLoader(GLTFLoader, HEART_MODEL);
  const model = useMemo(() => createHeart(gltf.scene), [gltf.scene]);
  const pulse = useRef<THREE.Group>(null);
  const elapsed = useRef(0);
  useFrame((_state, delta) => {
    // This is presentation motion, not a measured cardiac rhythm. Keep its
    // phase when paused and discard long gaps after a hidden tab resumes.
    if (!pulse.current || !animated || document.visibilityState === "hidden") return;
    elapsed.current = (elapsed.current + Math.min(Math.max(delta, 0), .05)) % .88;
    const phase = elapsed.current / .88;
    const contraction = Math.exp(-Math.pow((phase - .18) / .06, 2))
      + .26 * Math.exp(-Math.pow((phase - .34) / .045, 2));
    pulse.current.scale.set(1 - contraction * .016, 1 + contraction * .008, 1 - contraction * .011);
  });
  useEffect(() => () => {
    const materials = new Set<THREE.Material>();
    model.root.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const list = Array.isArray(object.material) ? object.material : [object.material];
      list.forEach(material => materials.add(material));
    });
    materials.forEach(material => material.dispose());
    Object.values(model.textures).forEach(texture => texture.dispose());
  }, [model]);
  return <group ref={pulse}><primitive object={model.root} dispose={null} /></group>;
}
