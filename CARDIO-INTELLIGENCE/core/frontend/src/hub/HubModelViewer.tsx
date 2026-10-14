/** Interactive viewer for a module's 3D anatomy (GLB/GLTF, STL, OBJ, PLY). */
import { Component, Suspense, useMemo, type ReactNode } from "react";
import { Canvas, useLoader } from "@react-three/fiber";
import { Bounds, Center, Html, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { useHubBlobUrl } from "./hubAssets";

const TISSUE = new THREE.MeshPhysicalMaterial({
  color: new THREE.Color("#e4576f"),
  roughness: 0.42,
  metalness: 0.05,
  clearcoat: 0.6,
  clearcoatRoughness: 0.35,
  sheen: 0.4,
  sheenColor: new THREE.Color("#ffb4c2"),
});

function GeometryMesh({ geometry }: { geometry: THREE.BufferGeometry }) {
  const prepared = useMemo(() => {
    if (!geometry.attributes.normal) geometry.computeVertexNormals();
    return geometry;
  }, [geometry]);
  const material = prepared.attributes.color
    ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 })
    : TISSUE;
  return <mesh geometry={prepared} material={material} castShadow receiveShadow />;
}

function GltfModel({ url }: { url: string }) {
  const gltf = useLoader(GLTFLoader, url);
  return <primitive object={gltf.scene} />;
}

function ObjModel({ url }: { url: string }) {
  const group = useLoader(OBJLoader, url);
  useMemo(() => {
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) child.material = TISSUE;
    });
  }, [group]);
  return <primitive object={group} />;
}

function StlModel({ url }: { url: string }) {
  return <GeometryMesh geometry={useLoader(STLLoader, url)} />;
}

function PlyModel({ url }: { url: string }) {
  return <GeometryMesh geometry={useLoader(PLYLoader, url)} />;
}

function Model({ url, format }: { url: string; format: string }) {
  switch (format) {
    case "glb":
    case "gltf":
      return <GltfModel url={url} />;
    case "obj":
      return <ObjModel url={url} />;
    case "ply":
      return <PlyModel url={url} />;
    default:
      return <StlModel url={url} />;
  }
}

class ViewerBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return (
        <Html center>
          <div className="ci-glass px-4 py-3 text-xs text-ink-muted">This model could not be rendered in the browser.</div>
        </Html>
      );
    }
    return this.props.children;
  }
}

export function HubModelViewer({ slug, path, format, className = "h-[420px]" }: {
  slug: string;
  path: string;
  format: string;
  className?: string;
}) {
  const { url, error, loading } = useHubBlobUrl(slug, path);
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_50%_40%,rgba(56,189,248,0.12),rgba(5,8,20,0.9)_70%)] ${className}`}>
      <div className="ci-scanline" />
      {loading && <div className="absolute inset-0 flex items-center justify-center text-xs text-ink-muted">Loading model…</div>}
      {error && <div className="absolute inset-0 flex items-center justify-center text-xs text-red-300">{error}</div>}
      {url && (
        <Canvas dpr={[1, 2]} gl={{ antialias: true, alpha: true }} camera={{ position: [0, 0, 4], fov: 45 }} shadows>
          <ambientLight intensity={0.55} />
          <directionalLight position={[5, 8, 5]} intensity={1.4} castShadow />
          <pointLight position={[-6, -2, -4]} intensity={18} color="#38bdf8" />
          <pointLight position={[6, -3, 4]} intensity={14} color="#a78bfa" />
          <ViewerBoundary>
            <Suspense fallback={<Html center><span className="text-xs text-ink-muted">Preparing geometry…</span></Html>}>
              <Bounds fit clip observe margin={1.25}>
                <Center>
                  <Model url={url} format={format} />
                </Center>
              </Bounds>
            </Suspense>
          </ViewerBoundary>
          <OrbitControls makeDefault autoRotate autoRotateSpeed={0.9} enableDamping />
        </Canvas>
      )}
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-black/40 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-sky-200">
        {format} · drag to orbit · scroll to zoom
      </div>
    </div>
  );
}
