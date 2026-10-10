import { lazy, Suspense, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { environmentApi, type ContextLocation, type EnvironmentLayer, type EnvironmentSnapshot, type EnvironmentalSeries } from "./environmentApi";
import "./environment.css";
import SurfaceBoundary from "./SurfaceBoundary";

const EnvironmentGlobe = lazy(() => import("./EnvironmentGlobe"));
const CHENNAI: ContextLocation = { id: "chennai-context", name: "Chennai", region: "Tamil Nadu", country: "India", latitude: 13.0827, longitude: 80.2707 };
const VARIABLES = [ ["pm2_5", "PM2.5"], ["pm10", "PM10"], ["nitrogen_dioxide", "NO₂"], ["ozone", "O₃"], ["temperature_2m", "Temperature"], ["relative_humidity_2m", "Humidity"], ["apparent_temperature", "Apparent temperature"] ];
const fmt = (value: number | null | undefined) => value == null ? "Unavailable" : value.toFixed(1);
const abortError = (error: unknown) => error instanceof Error && error.name === "AbortError";

export interface EnvironmentWorkspaceProps {
  date: string;
  onDateChange?: (date: string) => void;
  clinicalCount?: number;
  onObservations?: (snapshots: EnvironmentSnapshot[]) => void;
}

function Trend({ a, b, nameA, nameB }: { a?: EnvironmentalSeries; b?: EnvironmentalSeries; nameA: string; nameB?: string }) {
  const numbers = [...(a?.points ?? []), ...(b?.points ?? [])].flatMap((point) => point.value == null ? [] : [point.value]);
  const min = numbers.length ? Math.min(...numbers) : 0;
  const max = numbers.length ? Math.max(...numbers) : 1;
  const span = Math.max(1, max - min);
  const segments = (series?: EnvironmentalSeries) => {
    const paths: string[] = [];
    let path = "";
    series?.points.forEach((point, i) => {
      if (point.value == null) { if (path) paths.push(path); path = ""; return; }
      path += `${path ? " L" : "M"}${26 + i * 19},${145 - ((point.value - min) / span) * 112}`;
    });
    if (path) paths.push(path);
    return paths;
  };
  return <div className="ce-trend">
    <div className="ce-trend-legend"><span className="ce-legend-a">{nameA}</span>{nameB && <span className="ce-legend-b">{nameB}</span>}<span>Hourly output · {a?.unit ?? b?.unit ?? ""}</span></div>
    {numbers.length ? <svg viewBox="0 0 500 185" role="img" aria-label={`${a?.label ?? b?.label ?? "Environmental variable"} hourly model trend. Full values are in the hourly table.`}>
      {[35, 90, 145].map((y) => <line key={y} x1="26" x2="464" y1={y} y2={y} stroke="#39505d" strokeWidth="0.6" />)}
      {segments(a).map((path, i) => <path key={`a${i}`} d={path} fill="none" stroke="#57dedb" strokeWidth="2.5" />)}
      {segments(b).map((path, i) => <path key={`b${i}`} d={path} fill="none" stroke="#e9bf73" strokeWidth="2.5" strokeDasharray="5 3" />)}
      <text x="26" y="173" fill="#b4c8d5" fontSize="11">00:00 UTC</text><text x="219" y="173" fill="#b4c8d5" fontSize="11">12:00</text><text x="425" y="173" fill="#b4c8d5" fontSize="11">23:00</text>
      <text x="28" y="25" fill="#b4c8d5" fontSize="10">{max.toFixed(1)}</text><text x="28" y="143" fill="#b4c8d5" fontSize="10">{min.toFixed(1)}</text>
    </svg> : <p className="ce-empty">No provider values for this variable and date. Missing hours are left blank.</p>}
  </div>;
}

export default function EnvironmentWorkspace({ date, onDateChange, clinicalCount = 0, onObservations }: EnvironmentWorkspaceProps) {
  const [localDate, setLocalDate] = useState(date.slice(0, 10));
  const day = onDateChange ? date.slice(0, 10) : localDate;
  useEffect(() => { setLocalDate(date.slice(0, 10)); }, [date]);
  const [locations, setLocations] = useState<ContextLocation[]>([CHENNAI]);
  const [active, setActive] = useState(CHENNAI.id);
  const [target, setTarget] = useState<"primary" | "comparison">("primary");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ContextLocation[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [latInput, setLatInput] = useState("13.0827");
  const [lonInput, setLonInput] = useState("80.2707");
  const [variable, setVariable] = useState("pm2_5");
  const [hour, setHour] = useState(12);
  const [snapshots, setSnapshots] = useState<Record<string, EnvironmentSnapshot>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const [layer, setLayer] = useState<EnvironmentLayer | null>(null);
  const [layerBusy, setLayerBusy] = useState(false);
  const [layerError, setLayerError] = useState("");
  const [alignmentConsent, setAlignmentConsent] = useState(false);
  const [mapEnabled, setMapEnabled] = useState(true);
  const searchAbort = useRef<AbortController | null>(null);
  const layerAbort = useRef<AbortController | null>(null);
  const observer = useRef(onObservations);
  observer.current = onObservations;
  const selected = locations.find((location) => location.id === active) ?? locations[0];
  const layerAllowed = ["pm2_5", "pm10", "nitrogen_dioxide", "ozone"].includes(variable);
  const locationKey = locations.map((location) => `${location.id}/${location.latitude}/${location.longitude}`).join(";");
  const maxDate = new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10);
  const setDay = (value: string) => { if (!value) return; onDateChange?.(value); setLocalDate(value); };

  useEffect(() => {
    const controller = new AbortController();
    setSnapshots({}); setErrors({}); setLoading(true);
    observer.current?.([]);
    const tasks = locations.map(async (location) => {
      try { return { id: location.id, data: await environmentApi.observations(location, day, controller.signal) }; }
      catch (error) { if (abortError(error)) return null; return { id: location.id, error: error instanceof Error ? error.message : "Environmental service unavailable." }; }
    });
    void Promise.all(tasks).then((results) => {
      if (controller.signal.aborted) return;
      const next: Record<string, EnvironmentSnapshot> = {};
      const problems: Record<string, string> = {};
      for (const result of results) {
        if (result?.data) next[result.id] = result.data;
        else if (result?.error) problems[result.id] = result.error;
      }
      setSnapshots(next); setErrors(problems); setLoading(false);
      observer.current?.(Object.values(next));
    });
    return () => controller.abort();
    // Only geography, date and explicit retry change provider queries.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationKey, day, retry]);

  useEffect(() => { layerAbort.current?.abort(); setLayer(null); setLayerError(""); setLayerBusy(false); }, [selected.id, selected.latitude, selected.longitude, day, variable]);
  useEffect(() => () => { searchAbort.current?.abort(); layerAbort.current?.abort(); }, []);

  function chooseLocation(location: ContextLocation) {
    if (target === "comparison" && locations[0].latitude === location.latitude && locations[0].longitude === location.longitude) { setSearchError("Select a different location for comparison B."); return; }
    searchAbort.current?.abort(); setSearchBusy(false);
    setLocations((current) => target === "comparison" ? [current[0], location] : [location, ...current.slice(1).filter((row) => row.id !== location.id)]);
    setActive(location.id); setSearchResults([]);
    setLatInput(String(location.latitude)); setLonInput(String(location.longitude));
  }
  function coordinate(latitude: number, longitude: number) {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) { setSearchError("Latitude must be −90 to 90 and longitude −180 to 180."); return; }
    const lat = Math.round(latitude * 10000) / 10000;
    const lon = Math.round(longitude * 10000) / 10000;
    chooseLocation({ id: `context-${lat}-${lon}`, name: `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`, latitude: lat, longitude: lon, country: "", region: "" });
    setSearchError("");
  }
  async function search(event: FormEvent) {
    event.preventDefault(); searchAbort.current?.abort();
    const controller = new AbortController(); searchAbort.current = controller;
    setSearchBusy(true); setSearchError(""); setSearchResults([]);
    try { const result = await environmentApi.locations(query.trim(), controller.signal); if (!controller.signal.aborted) { setSearchResults(result.results); if (!result.results.length) setSearchError("No matching locations. Try a city followed by its country, or enter coordinates."); } }
    catch (error) { if (!abortError(error)) setSearchError(error instanceof Error ? error.message : "Location search unavailable."); }
    finally { if (!controller.signal.aborted) setSearchBusy(false); }
  }
  async function sampleLayer() {
    layerAbort.current?.abort(); const controller = new AbortController(); layerAbort.current = controller;
    setLayerBusy(true); setLayerError("");
    try { const data = await environmentApi.layer(selected, day, variable, controller.signal); if (!controller.signal.aborted) setLayer(data); }
    catch (error) { if (!abortError(error)) setLayerError(error instanceof Error ? error.message : "Regional layer unavailable."); }
    finally { if (!controller.signal.aborted) setLayerBusy(false); }
  }
  const primary = snapshots[locations[0].id]?.date === day ? snapshots[locations[0].id] : undefined;
  const comparison = locations[1] && snapshots[locations[1].id]?.date === day ? snapshots[locations[1].id] : undefined;
  const seriesA = primary?.series.find((series) => series.variable === variable);
  const seriesB = comparison?.series.find((series) => series.variable === variable);
  const selectedSnapshot = snapshots[selected.id]?.date === day ? snapshots[selected.id] : undefined;
  const activeSeries = selectedSnapshot?.series.find((series) => series.variable === variable);
  const point = activeSeries?.points[hour];
  const regionalPoints = useMemo(() => layer?.samples.map((sample) => ({ ...sample, point: sample.points[hour] })) ?? [], [layer, hour]);

  return <section className="ce-workspace" aria-label="Environmental cardiovascular context">
    <header className="ce-header"><div><p className="ce-eyebrow">EARTH / AMBIENT CONTEXT</p><h2>Environmental intelligence</h2><p>Investigate source-backed models across geography and time.</p></div><span className="ce-badge">CONTEXT · NOT PERSONAL EXPOSURE</span></header>
    <div className="ce-toolbar">
      <label>Context date (UTC)<input type="date" min="1940-01-01" max={maxDate} value={day} onChange={(event) => setDay(event.target.value)} /></label>
      <label>Environmental layer<select value={variable} onChange={(event) => setVariable(event.target.value)}>{VARIABLES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <label className="ce-hour">Hour · {String(hour).padStart(2, "0")}:00 UTC<input aria-label="Environmental hour UTC" type="range" min="0" max="23" value={hour} onChange={(event) => setHour(Number(event.target.value))} /></label>
      <button type="button" className="ce-secondary" onClick={() => setMapEnabled(!mapEnabled)}>{mapEnabled ? "Use text view" : "Show globe"}</button>
    </div>
    <div className="ce-geography">
      <fieldset className="ce-target"><legend>Apply selected location to</legend><label><input type="radio" name="ce-target" checked={target === "primary"} onChange={() => setTarget("primary")} /> Context A</label><label><input type="radio" name="ce-target" checked={target === "comparison"} onChange={() => setTarget("comparison")} /> Compare B</label></fieldset>
      <form className="ce-search" onSubmit={(event) => void search(event)}><label htmlFor="ce-city">City or country</label><div><input id="ce-city" value={query} minLength={2} maxLength={80} placeholder="Chennai, India" onChange={(event) => setQuery(event.target.value)} /><button type="submit" disabled={query.trim().length < 2 || searchBusy}>{searchBusy ? "Searching…" : "Search"}</button></div></form>
      <form className="ce-coordinates" onSubmit={(event) => { event.preventDefault(); coordinate(Number(latInput), Number(lonInput)); }}><label>Latitude<input aria-label="Context latitude" type="number" min="-90" max="90" step="any" required value={latInput} onChange={(event) => setLatInput(event.target.value)} /></label><label>Longitude<input aria-label="Context longitude" type="number" min="-180" max="180" step="any" required value={lonInput} onChange={(event) => setLonInput(event.target.value)} /></label><button type="submit">Select</button></form>
    </div>
    {searchError && <p role="status" className="ce-message">{searchError}</p>}
    {searchResults.length > 0 && <ul className="ce-results" aria-label="Location search results">{searchResults.map((location) => <li key={location.id}><button type="button" onClick={() => chooseLocation(location)}>{location.name}<span>{[location.region, location.country].filter(Boolean).join(", ")}</span></button></li>)}</ul>}
    <nav className="ce-location-tabs" aria-label="Environmental comparison locations">{locations.map((location, i) => <button key={`${i}-${location.id}`} type="button" aria-pressed={active === location.id} onClick={() => setActive(location.id)}><span>{i ? "B" : "A"}</span>{location.name}</button>)}{locations.length > 1 && <button type="button" className="ce-remove" onClick={() => { setLocations([locations[0]]); setActive(locations[0].id); }}>Remove comparison</button>}</nav>
    <div className="ce-main">
      <div className="ce-map-panel">
        {mapEnabled ? <SurfaceBoundary fallback={<p className="ce-empty" role="status">Map rendering is unavailable. Search, coordinates, observations and comparison remain available.</p>}><Suspense fallback={<p className="ce-empty">Loading global map… Location controls and readings are available below.</p>}><EnvironmentGlobe locations={locations} active={active} layer={layer} hour={hour} onSelect={(location) => setActive(location.id)} onCoordinate={coordinate} /></Suspense></SurfaceBoundary> : <div className="ce-text-map"><p className="ce-eyebrow">ACCESSIBLE GEOGRAPHIC SUMMARY</p>{locations.map((location) => <p key={location.id}>{location.name} · {location.latitude.toFixed(4)}°, {location.longitude.toFixed(4)}°</p>)}<p>Search or enter coordinates to change either contextual location.</p></div>}
        <div className="ce-layer-control"><div><strong>Regional model samples</strong><p>Optional 3 × 3 grid around the selected location. Smoothing shows relative values for this hour.</p></div><button type="button" disabled={!layerAllowed || layerBusy} onClick={() => void sampleLayer()}>{layerBusy ? "Sampling…" : "Load regional air layer"}</button></div>
        {!layerAllowed && <p className="ce-small">Regional sampling supports the four air pollutants. Weather remains available in readings and trends.</p>}
        {layerError && <p role="status" className="ce-message">{layerError}</p>}
        {layer && <p className="ce-small">{layer.note} Ingested {layer.ingested_at}. {regionalPoints.filter((sample) => sample.point?.value != null).length}/9 points available at this hour.</p>}
      </div>
      <aside className="ce-readings" aria-label="Selected environmental observations">
        <p className="ce-eyebrow">{selected.name.toUpperCase()} / {day}</p><h3>{activeSeries?.label ?? VARIABLES.find(([id]) => id === variable)?.[1]}</h3>
        <div className="ce-main-value">{fmt(point?.value)}<span>{activeSeries?.unit ?? ""}</span></div><p>{String(hour).padStart(2, "0")}:00 UTC · {point?.value == null ? "DATA GAP" : point.classification}</p>
        {loading && <p role="status">Retrieving environmental models…</p>}
        {errors[selected.id] && <p role="status" className="ce-message">{errors[selected.id]}</p>}
        <button type="button" className="ce-secondary" disabled={loading} onClick={() => setRetry(retry + 1)}>Retry source retrieval</button>
        <dl className="ce-stats"><div><dt>Hourly coverage</dt><dd>{activeSeries?.summary.hours_present ?? 0}/24</dd></div><div><dt>Past-day 24h mean</dt><dd>{fmt(activeSeries?.summary.mean_24h)} {activeSeries?.summary.mean_24h != null ? activeSeries.unit : ""}</dd></div><div><dt>Personal location evidence</dt><dd>Not supplied</dd></div></dl>
        {activeSeries?.summary.reference ? <div className="ce-reference"><strong>{activeSeries.summary.reference.ratio}× WHO 24h reference</strong><p>Modeled complete UTC day compared with {activeSeries.summary.reference.value} {activeSeries.unit}. {activeSeries.summary.reference.note}</p><a href={activeSeries.summary.reference.url} target="_blank" rel="noreferrer">WHO 2021 guidelines ↗</a></div> : <p className="ce-small">WHO comparisons require a complete past UTC day. Hourly values are never compared with a daily threshold. Ozone uses a different averaging period; no ozone guideline calculation is supplied.</p>}
      </aside>
    </div>
    <div className="ce-analysis-grid"><section className="ce-panel"><p className="ce-eyebrow">TEMPORAL CHANGE / REGIONAL COMPARISON</p><h3>Hourly model profile</h3><Trend a={seriesA} b={seriesB} nameA={locations[0].name} nameB={locations[1]?.name} /><p className="ce-small">Change the context date to explore another day. Lines stop at data gaps. Future hours are forecasts. CAMS hourly output is interpolated by the provider from three-hourly global model steps.</p>
      <details><summary>Inspect hourly values and classifications</summary><div className="ce-table-wrap"><table><caption>{VARIABLES.find(([id]) => id === variable)?.[1]} · {day} UTC · {seriesA?.unit ?? seriesB?.unit ?? "unit unavailable"}</caption><thead><tr><th>UTC</th><th>{locations[0].name}</th><th>Type A</th>{locations[1] && <><th>{locations[1].name}</th><th>Type B</th></>}</tr></thead><tbody>{Array.from({ length: 24 }, (_, i) => <tr key={i}><th>{String(i).padStart(2, "0")}:00</th><td>{fmt(seriesA?.points[i]?.value)}</td><td>{seriesA?.points[i]?.value == null ? "Gap" : seriesA.points[i].classification}</td>{locations[1] && <><td>{fmt(seriesB?.points[i]?.value)}</td><td>{seriesB?.points[i]?.value == null ? "Gap" : seriesB.points[i].classification}</td></>}</tr>)}</tbody></table></div></details>
    </section><section className="ce-panel"><p className="ce-eyebrow">SOURCE / FRESHNESS / UNCERTAINTY</p><h3>Environmental evidence chain</h3>{selectedSnapshot?.sources.map((source) => <article key={source.id} className="ce-source"><div><a href={source.url} target="_blank" rel="noreferrer">{source.provider} ↗</a><span>{source.status === "available" ? source.cached ? "CACHED" : "RETRIEVED" : "UNAVAILABLE"}</span></div><p>{source.resolution}</p><p>Grid: {source.grid_latitude ?? "unknown"}°, {source.grid_longitude ?? "unknown"}°</p><p>Ingested: {source.ingested_at ?? "not retrieved"}</p><p>Original publication / historical availability: unknown</p>{source.error && <p className="ce-message">{source.error}</p>}</article>)}{!selectedSnapshot && <p className="ce-small">Source provenance appears after retrieval. No values are generated to fill provider failures.</p>}
      {activeSeries?.warnings.map((warning) => <p key={warning} className="ce-message">{warning}</p>)}
      <p className="ce-small">Global CAMS archive: August 2022 onward, subject to provider gaps. Weather: ERA5 from 1940 for older dates; recent dates use forecast models. Original issue timestamps are unavailable, so environment data do not establish past knowledge at a clinical replay boundary.</p>
    </section></div>
    {layer && <details className="ce-panel"><summary>Regional layer sample values ({String(hour).padStart(2, "0")}:00 UTC)</summary><div className="ce-table-wrap"><table><caption>{layer.variable} · {day} · {layer.unit}</caption><thead><tr><th>Latitude</th><th>Longitude</th><th>Value</th><th>Classification</th></tr></thead><tbody>{regionalPoints.map((sample, i) => <tr key={i}><td>{sample.latitude.toFixed(4)}</td><td>{sample.longitude.toFixed(4)}</td><td>{fmt(sample.point?.value)}</td><td>{sample.point?.value == null ? "Gap" : sample.point.classification}</td></tr>)}</tbody></table></div></details>}
    <section className="ce-context"><p className="ce-eyebrow">CARDIO-ENVIRONMENTAL EVIDENCE ALIGNMENT</p><label><input type="checkbox" checked={alignmentConsent} onChange={(event) => setAlignmentConsent(event.target.checked)} /> I consent to viewing this manually selected ambient context alongside the clinical timeline for contextual research.</label>{alignmentConsent ? <p>{clinicalCount} clinical evidence item{clinicalCount === 1 ? "" : "s"} available at the selected workspace replay boundary. Environmental profiles above share the selected date. Actual personal exposure, physical presence, and a reviewed causal interpretation are not established. This selection is kept only in this workspace session.</p> : <p>The selected geography is public contextual exploration. No patient location history is inferred, saved, or sent to providers. Enable contextual alignment explicitly before interpreting the views together.</p>}
      <p>Fine-particle air pollution is associated with cardiovascular disease at the population level. Ambient models alone cannot establish why an individual developed a coronary finding. Temperature, humidity and apparent temperature provide heat context rather than an individual risk score. <a href="https://www.who.int/news-room/fact-sheets/detail/ambient-(outdoor)-air-quality-and-health" target="_blank" rel="noreferrer">WHO air pollution and health ↗</a></p>
    </section>
    <footer className="ce-attribution"><a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Weather and air-quality data by Open-Meteo</a> · <a href="https://atmosphere.copernicus.eu/" target="_blank" rel="noreferrer">Copernicus CAMS</a> / ERA5 · <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">GeoNames</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>. UTC normalization and day means calculated here. Free API is for non-commercial use; commercial deployment requires a provider agreement.</footer>
  </section>;
}
