import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

// Production API rewrite: when deployed to a static host (e.g. S3 website),
// fetches to "/api/*" can't be proxied. Rewrite them to the deployed
// backend URL. In dev, VITE_API_BASE is empty and the Vite proxy handles it.
const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "");
if (API_BASE) {
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === "string" && input.startsWith("/api/")) {
      return originalFetch(API_BASE + input, init);
    }
    if (input instanceof URL && input.pathname.startsWith("/api/")) {
      return originalFetch(API_BASE + input.pathname + input.search, init);
    }
    return originalFetch(input, init);
  };
}

import { AuthProvider } from "./components/core__frontend_src_components__AuthContext";
import { RequireAuth } from "./components/RequireAuth";
import Agents from "./routes/core__frontend_src_routes__Agents";
import App from "./core__clincase_frontend_src__App";
import BulkImport from "./routes/core__frontend_src_routes__BulkImport";
import CaseDetail from "./routes/CaseDetail";
import Cases from "./routes/core__frontend_src_routes__Cases";
import Cohorts from "./routes/core__frontend_src_routes__Cohorts";
import Compare from "./routes/core__frontend_src_routes__Compare";
import Compliance from "./routes/Compliance";
import Dashboard from "./routes/Dashboard";
import Eval from "./routes/core__frontend_src_routes__Eval";
import Intake from "./routes/core__frontend_src_routes__Intake";
import Landing from "./routes/core__frontend_src_routes__Landing";
import Login from "./routes/core__frontend_src_routes__Login";
import OncologyStack from "./routes/core__frontend_src_routes__OncologyStack";
import Policies from "./routes/core__frontend_src_routes__Policies";
import PolicyDiff from "./routes/core__frontend_src_routes__PolicyDiff";
import Architecture from "./routes/Architecture";
import Industrialize from "./routes/Industrialize";
import Reviewer from "./routes/core__frontend_src_routes__Reviewer";
import ROI from "./routes/ROI";
import Settings from "./routes/core__frontend_src_routes__Settings";
import Signup from "./routes/core__frontend_src_routes__Signup";
import "./styles/index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public marketing landing — the app's front door */}
          <Route path="/" element={<Landing />} />

          {/* Public auth pages */}
          <Route path="/login"  element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Protected app shell */}
          <Route
            element={
              <RequireAuth>
                <App />
              </RequireAuth>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/cases" element={<Cases />} />
            <Route path="/cases/bulk-import" element={<BulkImport />} />
            <Route path="/cases/:caseId" element={<CaseDetail />} />
            <Route path="/cases/:caseId/compare" element={<Compare />} />
            <Route path="/intake" element={<Intake />} />

            <Route path="/policies" element={<Policies />} />
            <Route path="/onco" element={<OncologyStack />} />
            <Route path="/policies/:policyId/diff" element={<PolicyDiff />} />
            <Route path="/agents" element={<Agents />} />

            <Route path="/cohorts" element={<Cohorts />} />
            <Route
              path="/reviewer"
              element={
                <RequireAuth roles={["reviewer", "admin"]}>
                  <Reviewer />
                </RequireAuth>
              }
            />
            <Route path="/compliance"     element={<Compliance />} />
            <Route path="/roi"            element={<ROI />} />
            <Route path="/industrialize"  element={<Industrialize />} />
            <Route path="/architecture"   element={<Architecture />} />
            <Route path="/eval"           element={<Eval />} />
            <Route
              path="/settings"
              element={
                <RequireAuth roles={["admin"]}>
                  <Settings />
                </RequireAuth>
              }
            />

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
