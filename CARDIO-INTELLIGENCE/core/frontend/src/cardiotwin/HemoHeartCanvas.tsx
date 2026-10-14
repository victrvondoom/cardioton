import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useRef, type ElementRef } from "react";
import * as THREE from "three";
import RealisticHeart from "./RealisticHeart";
import type { HeartCameraView } from "./HemoStateScene";

interface HeartCanvasProps {
  animated: boolean; rotate: boolean; cutaway: boolean; vesselsVisible: boolean; flowVisible: boolean;
  view: HeartCameraView; reset: number; selectedStructure: string | null;
  onSelectStructure: (structure: string | null) => void; onReady: () => void; onFailure: () => void;
}
const CAMERA_POSITIONS: Record<HeartCameraView, [number, number, number]> = {
  anterior: [.1, .25, 6.2], posterior: [-.1, .35, -6.2], left: [6.2, .3, .15],
};

function AnatomyStudio(props: HeartCanvasProps) {
  const controls = useRef<ElementRef<typeof OrbitControls>>(null);
  const { camera, invalidate, gl } = useThree();
  const destination = useRef<THREE.Vector3 | null>(null);
  const target = useRef(new THREE.Vector3(0, .05, 0));
  useEffect(() => { props.onReady(); }, [props.onReady]);
  useEffect(() => {
    const failure = props.onFailure;
    gl.domElement.addEventListener("webglcontextlost", failure, { once: true });
    return () => gl.domElement.removeEventListener("webglcontextlost", failure);
  }, [gl, props.onFailure]);
  useEffect(() => {
    destination.current = new THREE.Vector3(...CAMERA_POSITIONS[props.view]);
    controls.current?.target.copy(target.current);
    invalidate();
  }, [props.view, props.reset, invalidate]);
  useFrame((_state, delta) => {
    const position = destination.current;
    if (!position) return;
    camera.position.lerp(position, 1 - Math.exp(-Math.min(delta, .05) * 9));
    camera.lookAt(target.current);
    controls.current?.update();
    if (camera.position.distanceTo(position) < .01) destination.current = null;
    else invalidate();
  });
  return <>
    <ambientLight intensity={.36} />
    <hemisphereLight args={["#f4e3dc", "#272134", .65]} />
    <directionalLight position={[-3.5, 5, 5]} color="#fff0df" intensity={2.8} />
    <directionalLight position={[4, 1, -2]} color="#9ebdd2" intensity={2.0} />
    <directionalLight position={[1, -2, 4]} color="#e5a28b" intensity={.45} />
    <Environment resolution={128} frames={1}>
      <Lightformer form="rect" intensity={2.5} color="#ffeadd" position={[-3, 4, 4]} scale={[4, 5, 1]} rotation={[0, -.7, 0]} />
      <Lightformer form="rect" intensity={1.2} color="#b6c9df" position={[4, 1, -2]} scale={[2, 5, 1]} rotation={[0, 2.1, 0]} />
      <Lightformer form="rect" intensity={.7} color="#ffe9d6" position={[0, 5, 0]} scale={[4, 4, 1]} rotation={[Math.PI / 2, 0, 0]} />
    </Environment>
    <RealisticHeart animated={props.animated} cutaway={props.cutaway} vesselsVisible={props.vesselsVisible} flowVisible={props.flowVisible} selectedStructure={props.selectedStructure} onSelectStructure={props.onSelectStructure} />
    <ContactShadows position={[0, -1.7, 0]} scale={7} opacity={.35} blur={2.5} far={4} resolution={256} frames={1} color="#08060a" />
    <OrbitControls ref={controls} makeDefault enablePan={false} minDistance={3.1} maxDistance={9.5} minPolarAngle={.15} maxPolarAngle={Math.PI - .15} target={[0, .05, 0]} enableDamping dampingFactor={.08} autoRotate={props.rotate} autoRotateSpeed={.55} rotateSpeed={.65} zoomSpeed={.8} onStart={() => { destination.current = null; }} />
  </>;
}

export default function HemoHeartCanvas(props: HeartCanvasProps) {
  return <Canvas className="hemo-scene__canvas" camera={{ position: CAMERA_POSITIONS.anterior, fov: 36, near: .1, far: 40 }}
    frameloop={props.animated || props.rotate ? "always" : "demand"} dpr={[1, 1.6]}
    gl={{ antialias: true, alpha: true, powerPreference: "high-performance", localClippingEnabled: true }}
    onCreated={({ gl }) => {
      gl.toneMapping = THREE.ACESFilmicToneMapping;
      gl.toneMappingExposure = 1.05;
    }}>
    <Suspense fallback={null}><AnatomyStudio {...props} /></Suspense>
  </Canvas>;
}
