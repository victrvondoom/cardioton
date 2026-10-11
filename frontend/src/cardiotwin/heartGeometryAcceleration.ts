import * as THREE from "three";
import { acceleratedRaycast, CENTER, MeshBVH } from "three-mesh-bvh";

/** Keep the reference triangles intact while indexing dense anatomy for ray queries. */
export function accelerateHeartMesh(mesh: THREE.Mesh) {
  const geometry = mesh.geometry;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.boundsTree = new MeshBVH(geometry, { strategy: CENTER, maxLeafTris: 12, setBoundingBox: false });
  mesh.raycast = acceleratedRaycast;
  return mesh;
}

export function releaseHeartGeometry(geometry: THREE.BufferGeometry) {
  geometry.boundsTree = undefined;
  geometry.dispose();
}

/** React StrictMode reattaches effects before the next microtask. */
export function createHeartResourceLifetime(dispose: () => void) {
  let retained = 0;
  let disposed = false;
  return function retain() {
    retained++;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      retained--;
      queueMicrotask(() => {
        if (retained === 0 && !disposed) {
          disposed = true;
          dispose();
        }
      });
    };
  };
}
