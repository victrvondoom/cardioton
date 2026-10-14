import { MotionConfig } from "motion/react";
import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import "./cardio__frontend_src__index.css";
import { Landing } from "./landing/cardio__src_landing__Landing";
import { NotFound } from "./NotFound";
import { usePath } from "./cardio__frontend_src__router";

// The dashboard (form, charts, API wiring) loads only when opened.
const Dashboard = lazy(() => import("./cardio__frontend_src__App"));

function Root() {
  const path = usePath();
  return (
    // reducedMotion="user": every motion animation is disabled when the OS asks for reduced motion
    <MotionConfig reducedMotion="user" transition={{ ease: [0.22, 1, 0.36, 1] }}>
      {path === "/app" || path === "/app/" ? (
        <Suspense fallback={<div className="grid h-full place-items-center text-sm text-slate-400">Loading dashboard…</div>}>
          <Dashboard />
        </Suspense>
      ) : path === "/" || path === "/index.html" ? (
        <Landing />
      ) : (
        <NotFound />
      )}
    </MotionConfig>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
