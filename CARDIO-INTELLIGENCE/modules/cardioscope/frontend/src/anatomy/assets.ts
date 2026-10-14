import { Box3, BufferGeometry, Mesh, Vector3 } from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import type { AnatomyManifest } from '../api';
import { GROUPS, transformPoint, validateManifest } from './contract';
import type { GroupName } from './contract';

export interface AnatomyAssets {
  groups: Record<GroupName, { leaf: string; geometry: BufferGeometry }[]>;
  bounds: Record<GroupName, Box3>;
  dispose: () => void;
}

export async function loadAnatomy(
  manifest: AnatomyManifest,
  signal: AbortSignal,
  progress: (loaded: number, total: number) => void,
): Promise<AnatomyAssets> {
  validateManifest(manifest);
  const controller = new AbortController();
  const abort = () => controller.abort(signal.reason);
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) abort();
  const groups: AnatomyAssets['groups'] = { heart: [], LAD: [], LCX: [], RCA: [] };
  const bounds = Object.fromEntries(GROUPS.map(name => [name, new Box3()])) as AnatomyAssets['bounds'];
  const dispose = () => {
    for (const group of GROUPS) for (const mesh of groups[group]) mesh.geometry.dispose();
  };
  const tasks = GROUPS.flatMap(group => manifest.groups[group].leaf_ids.map(leaf => ({ group, leaf })));
  let next = 0, loaded = 0;
  let failure: unknown;
  async function worker() {
    while (!controller.signal.aborted && next < tasks.length) {
      const { group, leaf } = tasks[next++];
      try {
        const response = await fetch(`/anatomy/${manifest.meshes[leaf].path}`, { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const content = await response.arrayBuffer();
        const expected = manifest.meshes[leaf];
        const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', content)))
          .map(value => value.toString(16).padStart(2, '0')).join('');
        if (content.byteLength !== expected.bytes || hash !== expected.sha256) {
          throw new Error('Mesh checksum/size differs from the pinned source');
        }
        controller.signal.throwIfAborted();
        const object = new OBJLoader().parse(new TextDecoder().decode(content));
        let triangles = 0;
        object.traverse(child => {
          if (!(child instanceof Mesh)) return;
          const geometry = child.geometry as BufferGeometry;
          groups[group].push({ leaf, geometry });
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach(material => material.dispose());
          const position = geometry.getAttribute('position');
          if (!position || !Array.from(position.array).every(Number.isFinite)) {
            throw new Error('Invalid vertex data');
          }
          triangles += (geometry.index?.count ?? position.count) / 3;
          geometry.computeBoundingBox();
          bounds[group].union(geometry.boundingBox!);
        });
        if (triangles !== expected.faces) throw new Error('OBJ triangle count differs from the source');
        progress(++loaded, tasks.length);
      } catch (error) {
        if (!failure && !signal.aborted) {
          failure = new Error(`Could not load ${group}/${leaf}: ${error instanceof Error ? error.message : String(error)}`);
        }
        controller.abort();
      }
    }
  }
  try {
    // Bounded parallel downloads; never present a partial model as a complete heart.
    await Promise.all(Array.from({ length: 6 }, worker));
    if (signal.aborted || failure) {
      dispose();
      signal.throwIfAborted();
      throw failure;
    }
    for (const group of GROUPS) {
      if (bounds[group].isEmpty()) { dispose(); throw new Error(`Empty ${group} geometry`); }
      bounds[group] = new Box3(
        new Vector3(...transformPoint(bounds[group].min.toArray(), manifest)),
        new Vector3(...transformPoint(bounds[group].max.toArray(), manifest)),
      );
    }
    return { groups, bounds, dispose };
  } finally {
    signal.removeEventListener('abort', abort);
  }
}
