import React from 'react';
import {
  Heart,
  Home,
  ClipboardEdit,
  Activity,
  Sparkles,
  BarChart3,
  GitBranch,
  FileText,
  Shield,
  Play,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export const SECTIONS = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'assessment', label: 'Patient Assessment', icon: ClipboardEdit },
  { id: 'analysis', label: 'AI Analysis', icon: Activity },
  { id: 'anatomy', label: '3D Coronary Anatomy', icon: Heart },
  { id: 'explainability', label: 'Explainability', icon: Sparkles },
  { id: 'performance', label: 'Model Performance', icon: BarChart3 },
  { id: 'methodology', label: 'Methodology / Dataset', icon: GitBranch },
  { id: 'report', label: 'Report', icon: FileText },
  { id: 'safety', label: 'Safety / About', icon: Shield },
];

export default function Navbar({
  activeSection,
  setActiveSection,
  apiConnected,
  isAnalyzing,
  onRunAssessment
}) {
  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Brand Identity */}
          <div
            onClick={() => setActiveSection('home')}
            className="flex items-center gap-3 cursor-pointer group select-none shrink-0"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 via-rose-500 to-amber-500 p-0.5 shadow-md shadow-rose-500/20 group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-white dark:bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Heart className="w-5 h-5 text-rose-600 fill-rose-600 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight bg-gradient-to-r from-slate-900 via-slate-800 to-rose-700 dark:from-white dark:to-rose-400 bg-clip-text text-transparent">
                  CardioVision AI
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
                  v1.0
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-tight">
                AI-Assisted Cardiovascular Decision-Support Prototype
              </p>
            </div>
          </div>

          {/* Center Action & API Status Badge */}
          <div className="hidden lg:flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono border bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
              <span className={`w-2 h-2 rounded-full ${apiConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              <span>{apiConnected ? 'ML Engine Online' : 'Local Fallback'}</span>
            </div>
            <button
              onClick={onRunAssessment}
              disabled={isAnalyzing}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 shadow-sm shadow-rose-600/30 flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isAnalyzing ? 'Evaluating...' : 'Run AI Assessment'}</span>
            </button>
          </div>
        </div>

        {/* 9-Section Navigation Bar */}
        <nav className="flex items-center gap-1 overflow-x-auto py-1 scrollbar-none border-t border-slate-100 dark:border-slate-800/80 -mx-4 px-4 sm:mx-0 sm:px-0">
          {SECTIONS.map((sec) => {
            const Icon = sec.icon;
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all select-none ${
                  isActive
                    ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 font-semibold shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/50'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`} />
                <span>{sec.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
