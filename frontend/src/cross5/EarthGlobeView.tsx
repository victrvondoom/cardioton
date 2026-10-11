/**
 * CardioEarth — CesiumJS globe with country-level CVD mortality pins.
 *
 * Reuses the pinned jsDelivr CesiumJS loader (no Cesium ion, no token) and the
 * Esri imagery + Natural Earth II fallback pattern from the OneAquaHealth
 * globe. Pins show the committed WHO GHO snapshot values — historical
 * population statistics, labelled as such. When WebGL or the CDN is
 * unavailable, a table fallback keeps the data accessible.
 */
import { useEffect, useRef, useState } from "react";

import { webglAvailable } from "../cardiotwin/HeartViewer";
import { type CesiumNamespace, loadCesium } from "../globe/cesiumLoader";
import type { EarthCountry } from "./api";

const ESRI_IMAGERY = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const ESRI_CREDIT = "Imagery © Esri and its licensors";

/** Representative coordinates for the snapshot countries (capital-area anchors). */
const COUNTRY_COORDS: Record<string, [number, number]> = {
  IN: [77.2, 28.6], US: [-77.0, 38.9], GB: [-0.1, 51.5], DE: [13.4, 52.5],
  BR: [-47.9, -15.8], ZA: [28.0, -25.7], CN: [116.4, 39.9], JP: [139.7, 35.7],
  AU: [149.1, -35.3], FR: [2.35, 48.9],
};

export function EarthGlobeView({
  countries,
  selectedIso,
  onSelect,
}: {
  countries: EarthCountry[];
  selectedIso: string | null;
  onSelect: (iso: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewerRef = useRef<any>(null);
  const cesiumRef = useRef<CesiumNamespace | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">("loading");

  useEffect(() => {
    if (!webglAvailable()) {
      setStatus("fallback");
      return;
    }
    let cancelled = false;
    loadCesium()
      .then((C: CesiumNamespace) => {
        if (cancelled || !container.current) return;
        C.Ion.defaultAccessToken = "";
        const viewer = new C.Viewer(container.current, {
          baseLayer: false,
          baseLayerPicker: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          navigationHelpButton: false,
          animation: false,
          timeline: false,
          fullscreenButton: false,
          infoBox: false,
          selectionIndicator: false,
          shouldAnimate: false,
        });
        const layers = viewer.imageryLayers;
        layers.add(
          C.ImageryLayer.fromProviderAsync(
            C.TileMapServiceImageryProvider.fromUrl(C.buildModuleUrl("Assets/Textures/NaturalEarthII")),
          ),
        );
        layers.addImageryProvider(
          new C.UrlTemplateImageryProvider({ url: ESRI_IMAGERY, maximumLevel: 12, credit: new C.Credit(ESRI_CREDIT) }),
        );
        viewer.camera.setView({ destination: C.Cartesian3.fromDegrees(20, 15, 18_000_000) });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const handler = new C.ScreenSpaceEventHandler(viewer.scene.canvas);
        handler.setInputAction((movement: any) => {
          const picked = viewer.scene.pick(movement.position);
          if (picked && picked.id && typeof picked.id.cross5Iso === "string") {
            onSelectRef.current(picked.id.cross5Iso);
          }
        }, C.ScreenSpaceEventType.LEFT_CLICK);
        viewerRef.current = viewer;
        cesiumRef.current = C;
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("fallback");
      });
    return () => {
      cancelled = true;
      const viewer = viewerRef.current;
      if (viewer) {
        viewer.entities?.removeAll();
        viewer.destroy?.();
        viewerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const C = cesiumRef.current;
    const viewer = viewerRef.current;
    if (status !== "ready" || !C || !viewer) return;
    viewer.entities.removeAll();
    for (const country of countries) {
      const coords = COUNTRY_COORDS[country.iso];
      if (!coords) continue;
      const selected = country.iso === selectedIso;
      const entity = viewer.entities.add({
        position: C.Cartesian3.fromDegrees(coords[0], coords[1]),
        point: {
          pixelSize: selected ? 22 : 12,
          color: selected
            ? C.Color.fromCssColorString("#3b82f6")
            : C.Color.fromCssColorString("#c8102e").withAlpha(0.9),
          outlineColor: C.Color.WHITE,
          outlineWidth: 1.5,
        },
        label: {
          text: `${country.country}: ${country.cvd_mortality_per_100k.toFixed(0)} /100k (${country.year})`,
          font: "12px sans-serif",
          showBackground: true,
          backgroundColor: C.Color.BLACK.withAlpha(0.6),
          pixelOffset: new C.Cartesian2(0, -18),
        },
      });
      entity.cross5Iso = country.iso;
    }
  }, [countries, selectedIso, status]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-surface-border bg-surface-panel/40">
      <div ref={container} className="h-full w-full" />
      {status === "loading" && (
        <div className="absolute inset-0 grid place-items-center bg-surface-panel/70 text-[12px] text-ink-muted">
          Loading CesiumJS globe (pinned CDN build)…
        </div>
      )}
      {status === "fallback" && (
        <div className="absolute inset-0 overflow-auto bg-surface-panel/95 p-3">
          <p className="mb-2 text-[11.5px] text-ink-muted">
            Interactive globe unavailable (no WebGL or CesiumJS CDN unreachable) — country data fallback:
          </p>
          <table className="w-full text-[11.5px]">
            <thead>
              <tr className="text-left text-ink-faint">
                <th className="py-1">Country</th>
                <th className="py-1 text-right">CVD deaths / 100k</th>
              </tr>
            </thead>
            <tbody>
              {countries.map((c) => (
                <tr
                  key={c.iso}
                  onClick={() => onSelect(c.iso)}
                  className={`cursor-pointer border-t border-surface-border/50 ${c.iso === selectedIso ? "text-accent-cyan" : "hover:text-ink-primary"}`}
                >
                  <td className="py-1">{c.country}</td>
                  <td className="py-1 text-right tabular-nums">{c.cvd_mortality_per_100k.toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
