import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { accelerateHeartMesh, createHeartResourceLifetime, releaseHeartGeometry } from "../src/cardiotwin/heartGeometryAcceleration";

describe("reference heart geometry acceleration", () => {
  it("keeps all wall intersections and reference positions for cutaway selection", () => {
    const geometry = new THREE.SphereGeometry(1, 48, 32);
    const positions = geometry.getAttribute("position").array.slice();
    const triangles = geometry.index!.count;
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    mesh.position.set(.2, .1, -.3);
    mesh.updateMatrixWorld();
    const raycaster = new THREE.Raycaster(new THREE.Vector3(.33, .24, 5), new THREE.Vector3(0, 0, -1));
    const before = raycaster.intersectObject(mesh);
    accelerateHeartMesh(mesh);
    const after = raycaster.intersectObject(mesh);
    expect(before.length).toBeGreaterThan(1);
    expect(after).toHaveLength(before.length);
    expect(geometry.index!.count).toBe(triangles);
    expect(geometry.getAttribute("position").array).toEqual(positions);
    after.forEach((hit, index) => {
      expect(hit.point.distanceTo(before[index].point)).toBeLessThan(1e-6);
      expect(hit.face!.normal.distanceTo(before[index].face!.normal)).toBeLessThan(1e-6);
    });
    // A clipped front wall must not hide the retained posterior wall.
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
    expect(after.find(hit => plane.distanceToPoint(hit.point) >= 0)?.point.z).toBeCloseTo(before[1].point.z);
    releaseHeartGeometry(geometry);
    mesh.material.dispose();
  });

  it("supports nearest surface queries locally without changing other raycasters", () => {
    const mesh = accelerateHeartMesh(new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })));
    const origin = new THREE.Vector3(.13, .14, 5), direction = new THREE.Vector3(0, 0, -1);
    const assembly = new THREE.Raycaster(origin, direction);
    const interaction = new THREE.Raycaster(origin, direction);
    assembly.firstHitOnly = true;
    expect(assembly.intersectObject(mesh)).toHaveLength(1);
    expect(interaction.intersectObject(mesh)).toHaveLength(2);
    const dispose = vi.spyOn(mesh.geometry, "dispose");
    releaseHeartGeometry(mesh.geometry);
    expect(mesh.geometry.boundsTree).toBeUndefined();
    expect(dispose).toHaveBeenCalledOnce();
    mesh.material.dispose();
  });

  it("keeps resources through StrictMode effect replay and releases once after actual unmount", async () => {
    const dispose = vi.fn();
    const retain = createHeartResourceLifetime(dispose);
    const simulatedCleanup = retain();
    simulatedCleanup();
    const actualCleanup = retain();
    await Promise.resolve();
    expect(dispose).not.toHaveBeenCalled();
    actualCleanup();
    actualCleanup();
    await Promise.resolve();
    expect(dispose).toHaveBeenCalledOnce();
  });
});
