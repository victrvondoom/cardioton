/** The inherited projects' own web apps, running inside CARDIO INTELLIGENCE. */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppWindow, ExternalLink } from "lucide-react";
import { hubApi, type HubModuleSummary } from "../hub/hubApi";
import { GlassPanel } from "../hub/HubCard";

export default function HubLiveApps() {
  const [apps, setApps] = useState<HubModuleSummary[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    hubApi.modules()
      .then((all) => {
        if (cancelled) return;
        const live = all.filter((m) => m.live_app);
        setApps(live);
        setActive(live[0]?.slug ?? null);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const current = apps.find((a) => a.slug === active);
  // Two inherited projects can share a title (two "CardioScope"s); the folder name tells them apart.
  const label = (app: HubModuleSummary) =>
    apps.filter((a) => a.title === app.title).length > 1 ? `${app.title} · ${app.slug}` : app.title;

  return (
    <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-6 md:px-6">
      <div>
        <h1 className="ci-gradient-text text-3xl font-semibold">Live Module Apps</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {loading ? "Looking for built apps…" : `${apps.length} inherited web apps run here exactly as their authors built them.`}
        </p>
        {!loading && apps.length > 0 && (
          <p className="mt-1 max-w-4xl text-xs text-ink-faint">
            Each app's interface runs in the browser. Apps that compute predictions in their own Python API need that API
            running too; its start command is on the project's Files &amp; Run tab.
          </p>
        )}
      </div>
      {!loading && apps.length === 0 && (
        <GlassPanel className="p-6 text-sm text-ink-muted">
          No module app has been built yet. Run <code className="rounded bg-black/40 px-1.5 py-0.5 text-sky-200">python scripts/build_hub_apps.py</code> from <code className="rounded bg-black/40 px-1.5 py-0.5 text-sky-200">core/</code> to build them.
        </GlassPanel>
      )}
      {apps.length > 0 && (
        <>
          <div className="flex flex-wrap gap-2">
            {apps.map((a) => (
              <button key={a.slug} type="button" className="ci-chip !px-3.5 !py-1.5 !text-xs" data-active={active === a.slug} onClick={() => setActive(a.slug)}>
                <AppWindow className="h-3.5 w-3.5" aria-hidden />{label(a)}
              </button>
            ))}
          </div>
          {current && (
            <GlassPanel className="overflow-hidden p-2">
              <div className="flex items-center justify-between px-3 py-2 text-xs">
                <Link to={`/hub/${current.slug}`} className="text-sky-300 hover:underline">{label(current)} · project page</Link>
                <a href={hubApi.liveAppUrl(current.slug)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-ink-muted hover:text-sky-300">
                  Open full screen <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              </div>
              <iframe key={current.slug} title={`${current.title} live app`} src={hubApi.liveAppUrl(current.slug)} className="h-[78vh] w-full rounded-xl border-0 bg-black" />
            </GlassPanel>
          )}
        </>
      )}
    </div>
  );
}
