import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './cv_risk_viz_prediction__frontend_src__index.css'
import App from './cv_risk_viz_prediction__frontend_src__App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
