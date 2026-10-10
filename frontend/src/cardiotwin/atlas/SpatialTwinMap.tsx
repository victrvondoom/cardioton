import { useEffect, useMemo, useRef, useState } from "react";
import type { AtlasSpatial } from "./types";
import type { Map as LibreMap, Marker as LibreMarker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

type Point=Record<string,unknown>;
const num=(p:Point,key:string)=>Number(p[key]);
export default function SpatialTwinMap({spatial,onEvidence}:{spatial:AtlasSpatial;onEvidence:(id:string)=>void}) {
  const host=useRef<HTMLDivElement>(null);
  const [mapReady,setMapReady]=useState(false);
  const [layers,setLayers]=useState({patient:true,care:true,environment:true});
  const points=useMemo<(Point & {layer:string})[]>(()=>[...(layers.patient?spatial.events:[]).map(p=>({...p,layer:"patient"})),...(layers.care?spatial.facilities:[]).map(p=>({...p,layer:"care"})),...(layers.environment?spatial.environment:[]).map(p=>({...p,layer:"environment"}))],[spatial,layers]);
  const loc=spatial.location;
  useEffect(()=>{
    if(!host.current||!loc)return;
    let disposed=false,map:LibreMap|undefined;
    const markers:LibreMarker[]=[];
    setMapReady(false);
    void import("maplibre-gl").then(lib=>{
      if(disposed||!host.current)return;
      try{
        lib.setWorkerUrl(workerUrl);
        const lng=num(loc,"longitude"),lat=num(loc,"latitude");
        map=new lib.Map({container:host.current,center:[lng,lat],zoom:11,attributionControl:false,style:{version:8,sources:{},layers:[{id:"offline-background",type:"background",paint:{"background-color":"#e7edf0"}}]}});
        map.addControl(new lib.NavigationControl({showCompass:false}),"top-right");
        map.on("load",()=>{
          if(disposed||!map)return;
          // Deliberately abstract coordinate grid: no public tile/geocoder requests.
          const lines=[];
          for(let i=-8;i<=8;i++){lines.push({type:"Feature" as const,properties:{},geometry:{type:"LineString" as const,coordinates:[[lng+i*.01,lat-.08],[lng+i*.01,lat+.08]]}},{type:"Feature" as const,properties:{},geometry:{type:"LineString" as const,coordinates:[[lng-.08,lat+i*.01],[lng+.08,lat+i*.01]]}});}
          map.addSource("context-grid",{type:"geojson",data:{type:"FeatureCollection",features:lines}});
          map.addLayer({id:"context-grid",type:"line",source:"context-grid",paint:{"line-color":"#bdcbd1","line-width":1}});
          const all=[{...loc,layer:"location"},...points];
          all.forEach(p=>{const pin=document.createElement("button");pin.type="button";pin.className=`atlas-map-pin atlas-map-pin--${p.layer}`;pin.textContent=p.layer==="location"?"◎":p.layer==="care"?"+":p.layer==="environment"?"◌":"•";pin.setAttribute("aria-label",String(p.label));pin.title=String(p.label);pin.onclick=()=>{const refs=p.evidence_refs as string[]|undefined;if(refs?.[0])onEvidence(refs[0]);};markers.push(new lib.Marker({element:pin}).setLngLat([num(p,"longitude"),num(p,"latitude")]).addTo(map!));});
          setMapReady(true);
        });
        map.on("error",()=>setMapReady(false));
      }catch{setMapReady(false);map?.remove();map=undefined;}
    }).catch(()=>setMapReady(false));
    return()=>{disposed=true;markers.forEach(m=>m.remove());map?.remove();};
  },[loc,points,onEvidence]);
  return <section className="atlas-panel" aria-label="Spatial Cardio Twin"><div className="atlas-panel-head"><div><p className="atlas-kicker">Same replay boundary • context only</p><h2>Spatial Cardio Twin</h2></div><span className="atlas-badge">{spatial.synthetic?"SYNTHETIC GEOGRAPHY":"CONSENT-GATED"}</span></div>
    <p className="atlas-muted">Care access and retained environmental context. No causal claim, live capacity or travel-time estimate.</p>
    <div className="atlas-filter" aria-label="Spatial layers">{(["patient","care","environment"] as const).map(k=><button key={k} aria-pressed={layers[k]} onClick={()=>setLayers(v=>({...v,[k]:!v[k]}))}>{k==="patient"?"Patient events":k==="care"?"Care infrastructure":"Environment"}</button>)}</div>
    {!loc?<p className="atlas-empty">No consented location available at this replay. Patient locations, events and linked environmental context are withheld.</p>:<div className="atlas-map"><div ref={host} className="atlas-map-canvas" aria-label="Offline interactive context map"/>{!mapReady&&<svg viewBox="0 0 600 300" className="atlas-map-fallback" aria-label="Offline coordinate projection"><defs><pattern id="atlas-map-grid" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M30 0H0V30" fill="none" stroke="#bdcbd1"/></pattern></defs><rect width="600" height="300" fill="#e7edf0"/><rect width="600" height="300" fill="url(#atlas-map-grid)"/><circle cx="300" cy="150" r="75" fill="none" stroke="#6e9a93" strokeDasharray="5 5"/><text x="300" y="145" textAnchor="middle" fill="#305c60">◎</text>{points.map(p=><g key={String(p.id)} transform={`translate(${300+(num(p,"longitude")-num(loc,"longitude"))*3500},${150-(num(p,"latitude")-num(loc,"latitude"))*2500})`}><circle r="7" fill={p.layer==="care"?"#4a7778":p.layer==="environment"?"#b28847":"#a76379"}/><title>{String(p.label)}</title></g>)}</svg>}<span className="atlas-map-caption">Offline coordinate grid · {mapReady?"pan / zoom enabled":"schematic fallback"} · no street map</span></div>}
    <div className="atlas-context-list">{points.map(p=><article key={String(p.id)}><span className="atlas-kicker">{String(p.layer)} · {p.synthetic?"SYNTHETIC":"SOURCE ASSERTION"}</span><h3>{String(p.label)}</h3>{p.distance_km!==undefined&&<p><b>{String(p.distance_km)} km</b> straight-line · live capacity UNKNOWN</p>}{p.kind!==undefined&&<p>{String(p.kind)}: {String(p.value??"UNKNOWN")} {String(p.unit??"")} · CONTEXT</p>}{Boolean(p.capabilities)&&<div className="atlas-capabilities">{Object.entries(p.capabilities as Record<string,string>).map(([k,v])=><span key={k}>{k.replace(/_/g," ")}: <b>{v}</b></span>)}</div>}<small>Available: {String(p.available_at)}</small>{(p.evidence_refs as string[]|undefined)?.map(id=><button key={id} onClick={()=>onEvidence(id)}>Trace evidence</button>)}</article>)}</div>
    <p className="atlas-muted">{String(spatial.notice??"Environmental context never enters the hemodynamic engine.")}</p>
  </section>;
}
