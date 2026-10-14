import { BrowserRouter, Link, NavLink, Route, Routes } from 'react-router-dom'
import { Activity } from 'lucide-react'
import Dashboard from './pages/cv_risk_viz_prediction__src_pages__Dashboard'
import PatientInput from './pages/PatientInput'
import Heart3D from './pages/cv_risk_viz_prediction__src_pages__Heart3D'
import Explainability from './pages/Explainability'
import Performance from './pages/Performance'
import { PredictionProvider } from './state/PredictionContext'

const nav = [
  { to: '/', label: 'Dashboard' },
  { to: '/input', label: 'Patient Input' },
  { to: '/heart', label: '3D Heart' },
  { to: '/explain', label: 'Explainable AI' },
  { to: '/performance', label: 'Model Performance' },
]

export default function App() {
  return (
    <PredictionProvider>
      <BrowserRouter>
        <div className="min-h-screen flex flex-col">
          <header className="border-b border-cyan-900/40 backdrop-blur sticky top-0 z-40 bg-[#0b1120]/85">
            <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-6">
              <Link to="/" className="flex items-center gap-2">
                <Activity className="text-cyan-400" size={26} />
                <div>
                  <div className="font-bold tracking-widest text-cyan-300">CARDIOVISION AI</div>
                  <div className="text-[10px] text-slate-400 tracking-wider">EXPLAINABLE CORONARY RISK INTELLIGENCE</div>
                </div>
              </Link>
              <nav className="ml-auto flex gap-1 flex-wrap">
                {nav.map(n => (
                  <NavLink
                    key={n.to}
                    to={n.to}
                    className={({ isActive }) =>
                      `px-3 py-1.5 rounded-lg text-sm transition-colors ${isActive
                        ? 'bg-cyan-500/15 text-cyan-300'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`
                    }
                  >
                    {n.label}
                  </NavLink>
                ))}
              </nav>
            </div>
          </header>
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/input" element={<PatientInput />} />
              <Route path="/heart" element={<Heart3D />} />
              <Route path="/explain" element={<Explainability />} />
              <Route path="/performance" element={<Performance />} />
            </Routes>
          </main>
          <footer className="border-t border-cyan-900/30 py-4 text-center text-xs text-slate-500">
            Research prototype — not a medical device. No clinical diagnosis is provided.
          </footer>
        </div>
      </BrowserRouter>
    </PredictionProvider>
  )
}
