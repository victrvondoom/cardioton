import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RotateCw, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { RISK_BANDS, getRiskBand } from '../config/arterylens__src_config__riskBands';

interface HeartViewerProps {
  probabilities: {
    LAD: number;
    LCX: number;
    RCA: number;
  };
  selectedVessel: string;
  onSelectVessel: (vessel: string) => void;
}

export const HeartViewer: React.FC<HeartViewerProps> = ({
  probabilities,
  selectedVessel,
  onSelectVessel
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [hoveredVessel, setHoveredVessel] = useState<string | null>(null);
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // References to Three.js objects
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const heartGroupRef = useRef<THREE.Group | null>(null);
  const materialsRef = useRef<{ [key: string]: THREE.MeshStandardMaterial }>({});
  const isDraggingRef = useRef(false);
  const previousMousePosition = useRef({ x: 0, y: 0 });
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());

  // Helper to compute clinical risk color from probability [0, 1] using central risk bands
  const getRiskThreeColor = (prob: number): THREE.Color => {
    const band = getRiskBand(prob);
    return new THREE.Color(band.colorHex);
  };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // --- 1. Scene setup ---
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const width = mount.clientWidth;
    const height = mount.clientHeight;

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 1.0, 5.2);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = false;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // --- 2. Balanced clinical lighting (soft daylight, no colored neon rims) ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.8);
    dirLight1.position.set(4, 8, 6);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xf1f5f9, 0.8);
    dirLight2.position.set(-4, -2, -3);
    scene.add(dirLight2);

    // --- 3. Heart anatomical group ---
    const heartGroup = new THREE.Group();
    heartGroupRef.current = heartGroup;
    scene.add(heartGroup);

    // Anatomical Myocardium (Ventricles Body) - natural matte tissue tone
    const heartGeo = new THREE.SphereGeometry(1.35, 64, 64);
    const pos = heartGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);

      if (y < 0) {
        const factor = 1.0 + y * 0.45;
        x *= Math.max(factor, 0.2);
        z *= Math.max(factor, 0.2);
      } else {
        y += Math.sin(x * 2.0) * 0.12;
      }
      if (x < 0 && y < 0.2) {
        x *= 1.15;
      }
      pos.setXYZ(i, x, y * 1.15, z * 0.85);
    }
    heartGeo.computeVertexNormals();

    const heartMat = new THREE.MeshStandardMaterial({
      color: 0x933333,        // Desaturated anatomical tissue crimson
      roughness: 0.55,
      metalness: 0.05,
      emissive: 0x2b0d0d,
      emissiveIntensity: 0.15
    });
    const heartMesh = new THREE.Mesh(heartGeo, heartMat);
    heartGroup.add(heartMesh);

    // Aorta Arch (Deep arterial tone)
    const aortaCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.15, 0.8, 0.1),
      new THREE.Vector3(-0.05, 1.4, 0.0),
      new THREE.Vector3(0.3, 1.65, -0.2),
      new THREE.Vector3(0.55, 1.45, -0.4),
      new THREE.Vector3(0.65, 0.6, -0.5),
    ]);
    const aortaGeo = new THREE.TubeGeometry(aortaCurve, 32, 0.26, 16, false);
    const aortaMat = new THREE.MeshStandardMaterial({
      color: 0xbe123c,
      roughness: 0.5,
      metalness: 0.05
    });
    const aortaMesh = new THREE.Mesh(aortaGeo, aortaMat);
    heartGroup.add(aortaMesh);

    // Pulmonary Trunk (Venous deep indigo-blue)
    const pulmCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.15, 0.65, 0.35),
      new THREE.Vector3(0.1, 1.25, 0.15),
      new THREE.Vector3(-0.35, 1.35, -0.15),
    ]);
    const pulmGeo = new THREE.TubeGeometry(pulmCurve, 24, 0.22, 16, false);
    const pulmMat = new THREE.MeshStandardMaterial({
      color: 0x1d4ed8,
      roughness: 0.5,
      metalness: 0.05
    });
    const pulmMesh = new THREE.Mesh(pulmGeo, pulmMat);
    heartGroup.add(pulmMesh);

    // Superior Vena Cava
    const svcCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.75, 0.6, 0.1),
      new THREE.Vector3(0.8, 1.5, 0.05)
    ]);
    const svcGeo = new THREE.TubeGeometry(svcCurve, 16, 0.2, 16, false);
    const svcMesh = new THREE.Mesh(svcGeo, pulmMat);
    heartGroup.add(svcMesh);

    // --- 4. Coronary Arteries (TubeGeometry over CatmullRomCurve3) ---
    // LAD: Left Anterior Descending Artery
    const ladCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.15, 0.95, 0.45),
      new THREE.Vector3(-0.25, 0.65, 0.88),
      new THREE.Vector3(-0.35, 0.25, 1.05),
      new THREE.Vector3(-0.25, -0.25, 1.02),
      new THREE.Vector3(-0.15, -0.75, 0.8),
      new THREE.Vector3(-0.05, -1.2, 0.45),
      new THREE.Vector3(0.0, -1.35, 0.15)
    ]);
    const ladGeo = new THREE.TubeGeometry(ladCurve, 64, 0.065, 16, false);
    const ladMat = new THREE.MeshStandardMaterial({
      color: getRiskThreeColor(probabilities.LAD),
      roughness: 0.35,
      metalness: 0.1
    });
    const ladMesh = new THREE.Mesh(ladGeo, ladMat);
    ladMesh.userData = { name: 'LAD', title: 'Left anterior descending artery' };
    heartGroup.add(ladMesh);

    // LCX: Left Circumflex Artery
    const lcxCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.15, 0.95, 0.45),
      new THREE.Vector3(-0.55, 0.85, 0.55),
      new THREE.Vector3(-0.95, 0.65, 0.4),
      new THREE.Vector3(-1.25, 0.35, -0.05),
      new THREE.Vector3(-1.18, -0.15, -0.45),
      new THREE.Vector3(-0.85, -0.65, -0.65)
    ]);
    const lcxGeo = new THREE.TubeGeometry(lcxCurve, 64, 0.058, 16, false);
    const lcxMat = new THREE.MeshStandardMaterial({
      color: getRiskThreeColor(probabilities.LCX),
      roughness: 0.35,
      metalness: 0.1
    });
    const lcxMesh = new THREE.Mesh(lcxGeo, lcxMat);
    lcxMesh.userData = { name: 'LCX', title: 'Left circumflex artery' };
    heartGroup.add(lcxMesh);

    // RCA: Right Coronary Artery
    const rcaCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.35, 0.8, 0.45),
      new THREE.Vector3(0.75, 0.65, 0.65),
      new THREE.Vector3(0.95, 0.25, 0.62),
      new THREE.Vector3(1.05, -0.2, 0.42),
      new THREE.Vector3(0.85, -0.65, 0.05),
      new THREE.Vector3(0.55, -1.0, -0.3),
      new THREE.Vector3(0.15, -1.25, -0.25)
    ]);
    const rcaGeo = new THREE.TubeGeometry(rcaCurve, 64, 0.062, 16, false);
    const rcaMat = new THREE.MeshStandardMaterial({
      color: getRiskThreeColor(probabilities.RCA),
      roughness: 0.35,
      metalness: 0.1
    });
    const rcaMesh = new THREE.Mesh(rcaGeo, rcaMat);
    rcaMesh.userData = { name: 'RCA', title: 'Right coronary artery' };
    heartGroup.add(rcaMesh);

    materialsRef.current = { LAD: ladMat, LCX: lcxMat, RCA: rcaMat };

    // --- 5. Mouse Interaction & Orbit Dragging ---
    const handleMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      previousMousePosition.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = mount.getBoundingClientRect();
      const mouseX = ((e.clientX - rect.left) / mount.clientWidth) * 2 - 1;
      const mouseY = -((e.clientY - rect.top) / mount.clientHeight) * 2 + 1;
      mouseRef.current.set(mouseX, mouseY);

      // Raycast for hover
      raycasterRef.current.setFromCamera(mouseRef.current, camera);
      const intersects = raycasterRef.current.intersectObjects([ladMesh, lcxMesh, rcaMesh]);

      if (intersects.length > 0) {
        const hit = intersects[0].object;
        const name = hit.userData.name;
        setHoveredVessel(name);
        setTooltipPos({ x: e.clientX - rect.left + 12, y: e.clientY - rect.top - 18 });
      } else {
        setHoveredVessel(null);
        setTooltipPos(null);
      }

      if (isDraggingRef.current && heartGroupRef.current) {
        const deltaX = e.clientX - previousMousePosition.current.x;
        const deltaY = e.clientY - previousMousePosition.current.y;

        heartGroupRef.current.rotation.y += deltaX * 0.008;
        heartGroupRef.current.rotation.x += deltaY * 0.008;

        previousMousePosition.current = { x: e.clientX, y: e.clientY };
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (isDraggingRef.current) {
        const deltaX = Math.abs(e.clientX - previousMousePosition.current.x);
        const deltaY = Math.abs(e.clientY - previousMousePosition.current.y);
        if (deltaX < 5 && deltaY < 5) {
          raycasterRef.current.setFromCamera(mouseRef.current, camera);
          const intersects = raycasterRef.current.intersectObjects([ladMesh, lcxMesh, rcaMesh]);
          if (intersects.length > 0) {
            const name = intersects[0].object.userData.name;
            onSelectVessel(name);
          }
        }
      }
      isDraggingRef.current = false;
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (!cameraRef.current) return;
      cameraRef.current.position.z = THREE.MathUtils.clamp(
        cameraRef.current.position.z + e.deltaY * 0.003,
        2.5,
        7.5
      );
    };

    mount.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    mount.addEventListener('wheel', handleWheel, { passive: false });

    // --- 6. Animation Loop ---
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Gentle physiological heartbeat rhythm (72 bpm)
      const beatFreq = 1.2;
      const cycle = (elapsedTime * beatFreq) % 1.0;
      let pulse = 0.0;
      if (cycle < 0.15) {
        pulse = Math.sin((cycle / 0.15) * Math.PI) * 0.035;
      } else if (cycle >= 0.2 && cycle < 0.35) {
        pulse = Math.sin(((cycle - 0.2) / 0.15) * Math.PI) * 0.02;
      }

      if (heartGroupRef.current) {
        heartGroupRef.current.scale.set(1.0 + pulse, 1.0 + pulse * 1.05, 1.0 + pulse);
        
        if (autoRotate && !isDraggingRef.current) {
          heartGroupRef.current.rotation.y += 0.004;
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!mount || !renderer || !camera) return;
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      mount.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      mount.removeEventListener('wheel', handleWheel);
      window.removeEventListener('resize', handleResize);
      if (mount && renderer.domElement) {
        mount.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Update artery colors smoothly using central risk bands
  useEffect(() => {
    ['LAD', 'LCX', 'RCA'].forEach(vessel => {
      const mat = materialsRef.current[vessel];
      if (mat) {
        const prob = probabilities[vessel as keyof typeof probabilities] || 0.0;
        const color = getRiskThreeColor(prob);
        mat.color.copy(color);
        
        // Selected vessel gets a subtle clean brightness boost (no neon bloom)
        if (selectedVessel === vessel) {
          mat.emissive.copy(color);
          mat.emissiveIntensity = 0.4;
        } else if (hoveredVessel === vessel) {
          mat.emissive.copy(color);
          mat.emissiveIntensity = 0.25;
        } else {
          mat.emissive.set(0x000000);
          mat.emissiveIntensity = 0;
        }
      }
    });
  }, [probabilities, selectedVessel, hoveredVessel]);

  const handleResetView = () => {
    if (heartGroupRef.current && cameraRef.current) {
      heartGroupRef.current.rotation.set(0, 0, 0);
      cameraRef.current.position.set(0, 1.0, 5.2);
    }
  };

  const handleZoom = (delta: number) => {
    if (cameraRef.current) {
      cameraRef.current.position.z = THREE.MathUtils.clamp(
        cameraRef.current.position.z + delta,
        2.5,
        7.5
      );
    }
  };

  return (
    <div className="relative w-full h-[580px] rounded-lg overflow-hidden bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col shadow-sm">
      {/* 3D Canvas Mount */}
      <div 
        ref={mountRef} 
        className="w-full h-full cursor-grab active:cursor-grabbing relative select-none"
      />

      {/* Top Left: Clean Title & Prompt */}
      <div className="absolute top-3 left-3 pointer-events-none">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          3D coronary anatomy
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Rotate to inspect vessel pathways • Click vessel to view SHAP drivers
        </p>
      </div>

      {/* Top Right: Standardized Clinical Risk Legend */}
      <div className="absolute top-3 right-3 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3 text-xs">
        <span className="text-slate-500 dark:text-slate-400 font-medium text-[11px]">Risk:</span>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-600" />
          <span className="text-slate-700 dark:text-slate-300 tabular-nums">Low (&lt;35%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-slate-700 dark:text-slate-300 tabular-nums">Intermediate (35–60%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-rose-600" />
          <span className="text-slate-700 dark:text-slate-300 tabular-nums">High (&gt;60%)</span>
        </div>
      </div>

      {/* Floating Hover Tooltip (Professional clean popover) */}
      {hoveredVessel && tooltipPos && (
        <div 
          className="absolute z-20 pointer-events-none px-2.5 py-1.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-md transform -translate-x-1/2 -translate-y-full text-xs"
          style={{ left: `${tooltipPos.x}px`, top: `${tooltipPos.y}px` }}
        >
          <div className="font-semibold text-slate-900 dark:text-slate-100">
            {hoveredVessel === 'LAD' ? 'Left anterior descending (LAD)' :
             hoveredVessel === 'LCX' ? 'Left circumflex (LCX)' :
             'Right coronary artery (RCA)'}
          </div>
          <div className="text-slate-600 dark:text-slate-300 text-[11px] tabular-nums mt-0.5">
            Estimated risk: <strong className="text-slate-900 dark:text-slate-100">{Math.round((probabilities[hoveredVessel as keyof typeof probabilities] || 0) * 100)}%</strong>
          </div>
        </div>
      )}

      {/* Bottom Left: Vessel Quick Selector Buttons */}
      <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm p-1 rounded-md border border-slate-200 dark:border-slate-700 shadow-sm">
        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium px-2">Vessel:</span>
        {(['CAD', 'LAD', 'LCX', 'RCA'] as const).map(vessel => {
          const isSelected = selectedVessel === vessel;
          const prob = vessel === 'CAD' ? (probabilities.LAD || 0.5) : probabilities[vessel as keyof typeof probabilities];
          const band = getRiskBand(prob);

          return (
            <button
              key={vessel}
              onClick={() => onSelectVessel(vessel)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition flex items-center gap-1.5 ${
                isSelected 
                  ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-semibold ring-1 ring-slate-300 dark:ring-slate-600' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50'
              }`}
            >
              {vessel !== 'CAD' && (
                <span className={`w-1.5 h-1.5 rounded-full ${band.dotColor}`} />
              )}
              <span>{vessel}</span>
              {vessel !== 'CAD' && (
                <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                  {Math.round(prob * 100)}%
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom Right: Clean Unobtrusive Toolbar */}
      <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm p-1 rounded-md border border-slate-200 dark:border-slate-700 shadow-sm text-slate-600 dark:text-slate-300">
        <button
          onClick={() => setAutoRotate(!autoRotate)}
          className={`px-2 py-1 rounded text-xs transition flex items-center gap-1 ${
            autoRotate ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-medium' : 'hover:bg-slate-100 dark:hover:bg-slate-700'
          }`}
          title="Toggle rotation"
        >
          <RotateCw className="w-3.5 h-3.5" />
          <span>Rotate</span>
        </button>

        <button
          onClick={() => handleZoom(-0.5)}
          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          title="Zoom in"
          aria-label="Zoom in"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => handleZoom(0.5)}
          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          title="Zoom out"
          aria-label="Zoom out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={handleResetView}
          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          title="Reset camera view"
          aria-label="Reset camera view"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
