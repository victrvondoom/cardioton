import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Component, useEffect, useMemo, useState, type ReactNode } from "react";
import * as THREE from "three";
import { aortaCurve, bodyGeometry, HEART_TILT_Z, pulmonaryCurve } from "../vesselGeometry";
import HemoStateScene from "../HemoStateScene";
import { HEMO_AXES, type HemoAxisKey, type HemoSnapshot } from "../hemoTypes";

const COLORS: Record<string,string> = { UNKNOWN: "#8793a3", NORMAL: "#3b9c89", LOW: "#7299be", ELEVATED: "#c38a49", HIGH: "#ba606c" };
const POSITIONS: [number,number,number][] = [[-1.65,1.25,0], [1.65,1.25,0], [-1.9,.4,0], [1.9,.4,0], [-1.9,-.5,0], [1.9,-.5,0], [-1.5,-1.35,0], [1.5,-1.35,0]];
class SceneBoundary extends Component<{children:ReactNode;fallback:ReactNode},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){ return {failed:true}; }
  render(){return this.state.failed ? this.props.fallback : this.props.children;}
}
function Geometry({snapshot,onSelect}:{snapshot:HemoSnapshot;onSelect:(axis:HemoAxisKey)=>void}) {
  const geometries=useMemo(()=>({heart:bodyGeometry(),aorta:new THREE.TubeGeometry(aortaCurve(),36,.14,10,false),pulmonary:new THREE.TubeGeometry(pulmonaryCurve(),28,.12,10,false)}),[]);
  useEffect(()=>()=>Object.values(geometries).forEach(g=>g.dispose()),[geometries]);
  return <>
    <ambientLight intensity={1.5}/><directionalLight position={[3,5,6]} intensity={2}/><directionalLight position={[-4,1,2]} intensity={1} color="#b3cce8"/>
    <group rotation={[0,-.25,HEART_TILT_Z]}>
      <mesh geometry={geometries.heart} onClick={e=>{e.stopPropagation();onSelect("pump_function");}}><meshStandardMaterial color="#b77380" roughness={.48} metalness={.15}/></mesh>
      <mesh geometry={geometries.aorta}><meshStandardMaterial color="#ad6475" roughness={.5}/></mesh>
      <mesh geometry={geometries.pulmonary}><meshStandardMaterial color="#7698ae" roughness={.5}/></mesh>
    </group>
    {HEMO_AXES.map(([axis],i)=><mesh key={axis} position={POSITIONS[i]} onClick={e=>{e.stopPropagation();onSelect(axis);}}><sphereGeometry args={[snapshot[axis].level==="HIGH"?.16:.12,20,16]}/><meshStandardMaterial color={COLORS[snapshot[axis].level]} emissive={COLORS[snapshot[axis].level]} emissiveIntensity={snapshot[axis].level==="UNKNOWN"?0:.18}/></mesh>)}
    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
    <OrbitControls {...{enablePan:false} as any} enableZoom minDistance={3.7} maxDistance={8} autoRotate={false}/>
  </>;
}
export default function AtlasHeart3D({snapshot,onSelect}:{snapshot:HemoSnapshot;onSelect:(axis:HemoAxisKey)=>void}) {
  const [supported,setSupported]=useState(false);
  useEffect(()=>{try{const c=document.createElement("canvas");const gl=c.getContext("webgl2")||c.getContext("webgl");setSupported(Boolean(gl));gl?.getExtension("WEBGL_lose_context")?.loseContext();}catch{setSupported(false);}},[]);
  const fallback=<HemoStateScene snapshot={snapshot} onSelect={onSelect}/>;
  if(!supported)return fallback;
  return <figure className="atlas-heart" aria-label="Interactive schematic cardiovascular twin">
    <figcaption><span className="atlas-kicker">Evidence-linked 3D • drag to rotate</span><span className="atlas-badge">SCHEMATIC</span></figcaption>
    <SceneBoundary fallback={fallback}><div className="atlas-heart-canvas"><Canvas frameloop="demand" dpr={[1,1.5]} camera={{position:[0,.2,5.5],fov:43}} gl={{antialias:true,alpha:true}}><Geometry snapshot={snapshot} onSelect={onSelect}/></Canvas></div></SceneBoundary>
    <div className="atlas-heart-keys">{HEMO_AXES.map(([axis,label],i)=><button type="button" key={axis} onClick={()=>onSelect(axis)}><i style={{background:COLORS[snapshot[axis].level]}}/>{i+1}. {label}<b>{snapshot[axis].level}</b></button>)}</div>
    <p className="atlas-muted">Color encodes qualitative research state. Geometry is schematic, with no patient-specific imaging or physical flow simulation.</p>
  </figure>;
}
