import { useEffect, useRef, useState } from "react";
import { Map, Marker, NavigationControl, setWorkerUrl, type GeoJSONSource } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import "../../styles/maplibre-dark.css";
import type { ContextLocation, EnvironmentLayer } from "./environmentApi";

setWorkerUrl(workerUrl);

interface Props {
  locations: ContextLocation[]; active: string; layer: EnvironmentLayer | null; hour: number;
  onSelect: (location: ContextLocation) => void; onCoordinate: (latitude: number, longitude: number) => void;
}

export default function EnvironmentGlobe({ locations, active, layer, hour, onSelect, onCoordinate }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<Map | null>(null);
  const callbacks = useRef({ onSelect, onCoordinate });
  callbacks.current = { onSelect, onCoordinate };
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [tileError, setTileError] = useState(false);
  useEffect(() => {
    if (!container.current) return;
    let instance: Map;
    try {
      instance = new Map({ container: container.current, style: "https://tiles.openfreemap.org/styles/dark", center: [45, 18], zoom: 1.4, attributionControl: {} });
      map.current = instance;
      instance.addControl(new NavigationControl(), "top-right");
      instance.on("load", () => {
        instance.setProjection({ type: "globe" });
        instance.addSource("ambient-samples", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        instance.addLayer({ id: "ambient-heat", type: "heatmap", source: "ambient-samples", maxzoom: 10,
          paint: { "heatmap-weight": ["get", "weight"], "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 1, 12, 6, 55, 10, 80],
            "heatmap-opacity": 0.5, "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(0,0,0,0)", 0.2, "#125978", 0.5, "#27c3c5", 0.8, "#e8bc62", 1, "#ffdb8c"] } });
        instance.addLayer({ id: "ambient-points", type: "circle", source: "ambient-samples",
          paint: { "circle-radius": 5, "circle-color": "#e8bc62", "circle-stroke-width": 1.5, "circle-stroke-color": "#fff" } });
        setReady(true);
      });
      instance.on("error", () => setTileError(true));
      instance.on("click", (event) => callbacks.current.onCoordinate(Math.max(-90, Math.min(90, event.lngLat.lat)), (event.lngLat.lng + 540) % 360 - 180));
    } catch {
      setFailed(true);
      return;
    }
    return () => { instance.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    if (!map.current) return;
    const markers = locations.map((location) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `ce-marker${location.id === active ? " ce-marker-active" : ""}`;
      button.textContent = location.name;
      button.setAttribute("aria-label", `Select environmental context ${location.name}`);
      button.addEventListener("click", (event) => { event.stopPropagation(); callbacks.current.onSelect(location); });
      return new Marker({ element: button }).setLngLat([location.longitude, location.latitude]).addTo(map.current!);
    });
    return () => markers.forEach((marker) => marker.remove());
  }, [locations, active, ready]);

  useEffect(() => {
    const selected = locations.find((location) => location.id === active);
    if (selected && map.current) map.current.flyTo({ center: [selected.longitude, selected.latitude], zoom: 4.5,
      duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1100, essential: false });
  }, [locations, active, ready]);

  useEffect(() => {
    if (!ready || !map.current) return;
    const valid = layer?.samples.filter((sample) => sample.points[hour]?.value != null) ?? [];
    const peak = Math.max(1, ...valid.map((sample) => sample.points[hour].value!));
    const source = map.current.getSource("ambient-samples") as GeoJSONSource | undefined;
    source?.setData({ type: "FeatureCollection", features: valid.map((sample) => ({ type: "Feature", geometry: { type: "Point", coordinates: [sample.longitude, sample.latitude] }, properties: { weight: sample.points[hour].value! / peak } })) });
  }, [layer, hour, ready]);

  return <div className="ce-globe">
    {!failed && <div ref={container} className="ce-map" role="region" aria-label="Interactive global environmental map. Search and coordinate controls below provide an accessible alternative." />}
    {failed && <p role="status" className="ce-map-fallback">3D map unavailable on this device. Search, coordinate selection, readings and comparison remain available below.</p>}
    {tileError && !failed && <p className="ce-map-warning" role="status">Some map tiles could not load. Environmental readings and location controls remain available.</p>}
    <p className="ce-map-credit">MapLibre globe · <a href="https://openfreemap.org/" target="_blank" rel="noreferrer">OpenFreeMap</a> / <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a> · Click the map to select a context location.</p>
  </div>;
}
