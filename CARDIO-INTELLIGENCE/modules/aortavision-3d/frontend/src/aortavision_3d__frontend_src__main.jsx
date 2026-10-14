import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./aortavision_3d__frontend_src__App.jsx";
import { PatientDataProvider } from "./context/PatientDataContext.jsx";
import "./aortavision_3d__frontend_src__index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter
      future={{
        v7_relativeSplatPath: true,
        v7_startTransition: true,
      }}
    >
      <PatientDataProvider>
        <App />
      </PatientDataProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
