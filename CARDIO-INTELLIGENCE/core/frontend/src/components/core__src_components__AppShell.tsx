/** Shared workspace shell. A 56px header contains status and global controls;
 * the persistent sidebar and compact tool strip preserve route and scroll state. */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  Outlet,
  useLocation,
  useNavigate,
  useNavigationType,
} from "react-router-dom";

import { WorkflowNavigation } from "../workflow/WorkflowNavigation";
import { PixelTransition } from "../pixel/PixelTransition";
import { FAB } from "./core__src_components__FAB";
import { SearchPalette } from "./core__src_components__SearchPalette";
import { Sidenav } from "./Sidenav";
import { TopBar } from "./core__src_components__TopBar";
import { RouteBoundary } from "./RouteBoundary";
import { SpatialBackdrop } from "./SpatialBackdrop";
import "../styles/workspace.css";

// Keep the new-case shortcut beside the patient workflow. On research canvases
// and evidence inspectors it obscures measurements and map controls.
const _CASE_FAB_ROUTES = new Set(["/dashboard", "/cases"]);

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const contentRef = useRef<HTMLDivElement>(null);
  const pageScroll = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const key = location.key;
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      contentRef.current?.animate?.(
        [
          { opacity: 0.65, transform: "translateY(4px)" },
          { opacity: 1, transform: "translateY(0)" },
        ],
        { duration: 160, easing: "ease-out" },
      );
    }
    window.scrollTo({
      top: navigationType === "POP" ? (pageScroll.current.get(key) ?? 0) : 0,
      behavior: "instant",
    });
    const remember = () => pageScroll.current.set(key, window.scrollY);
    window.addEventListener("scroll", remember, { passive: true });
    return () => window.removeEventListener("scroll", remember);
  }, [location.key, navigationType]);
  useEffect(() => {
    if (location.pathname.startsWith("/journey/")) {
      try {
        sessionStorage.setItem("clini-current-journey", location.pathname);
      } catch {
        /* storage unavailable */
      }
    }
  }, [location.pathname]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Decorative spatial backdrop is opt-in (off by default); toggled in the About dialog.
  const [spatialBackdrop, setSpatialBackdrop] = useState(() => {
    try { return localStorage.getItem("clini-spatial-backdrop") === "on"; } catch { return false; }
  });
  useEffect(() => {
    const sync = () => setSpatialBackdrop(() => {
      try { return localStorage.getItem("clini-spatial-backdrop") === "on"; } catch { return false; }
    });
    window.addEventListener("clini-spatial-backdrop", sync);
    return () => window.removeEventListener("clini-spatial-backdrop", sync);
  }, []);
  const oneHealth =
    location.pathname === "/onehealth" ||
    location.pathname === "/interop" ||
    location.pathname === "/oah-bridge" ||
    location.pathname.startsWith("/journey") ||
    location.pathname.startsWith("/aquahealth");
  const showFab = _CASE_FAB_ROUTES.has(location.pathname) || location.pathname.startsWith("/cases/");
  // Atlas tabs share one reconstruction; retain it across workspace navigation.
  const outletKey = location.pathname === "/cardiotwin/atlas" || location.pathname.startsWith("/cardiotwin/atlas/") ? "/cardiotwin/atlas" : location.pathname;

  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);

  // Global keyboard shortcuts:
  //  - Cmd+K / Ctrl+K → toggle command palette
  //  - N (when no input focused, no modifier) → new case (intake)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const isInput =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
        return;
      }
      if (
        !paletteOpen &&
        !isInput &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        e.key.toLowerCase() === "n"
      ) {
        e.preventDefault();
        navigate("/intake");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, paletteOpen]);

  return (
    <div className="spatial-shell compact-workspace min-h-screen bg-surface-bg text-ink-body">
      <PixelTransition locationKey={location.pathname} />
      {spatialBackdrop && <SpatialBackdrop />}

      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:z-[100] focus:top-2 focus:left-2 focus:bg-surface-raised focus:p-3"
      >
        Skip to content
      </a>
      <TopBar onOpenSearch={openPalette} oneHealth={oneHealth} />

      <div className="pt-14 flex">
        <Sidenav />
        <main id="main-content" tabIndex={-1} className="flex-1 min-w-0 pb-28 md:pb-24">
          <WorkflowNavigation />
          <div ref={contentRef}>
            <RouteBoundary>
              {/* Dashboard and Cases own their intro; every other page gets the same reveal and heading style. */}
              {location.pathname === "/dashboard" || location.pathname === "/cases" ? (
                <Outlet />
              ) : (
                <div
                  key={outletKey}
                  className="page-typography reveal-go [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:leading-tight [&_h1]:text-ink-primary"
                >
                  <Outlet />
                </div>
              )}
            </RouteBoundary>
          </div>
        </main>
      </div>

      {showFab && <FAB />}
      <SearchPalette open={paletteOpen} onClose={closePalette} />
    </div>
  );
}
