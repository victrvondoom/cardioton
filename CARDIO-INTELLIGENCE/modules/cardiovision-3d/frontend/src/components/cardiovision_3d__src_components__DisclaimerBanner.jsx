import React from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';

export default function DisclaimerBanner() {
  return (
    <div className="bg-amber-500/10 border-b border-amber-500/30 text-amber-950 dark:text-amber-200 px-4 py-2 text-xs backdrop-blur-md">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 animate-pulse" />
          <p className="font-medium leading-relaxed">
            <strong className="font-semibold text-amber-900 dark:text-amber-100">Research & Educational Decision-Support Prototype.</strong>{' '}
            Model outputs are estimates for demonstration purposes only and are not medical diagnoses or substitutes for professional evaluation or formal diagnostic imaging.
          </p>
        </div>
        <div className="hidden md:flex items-center gap-1.5 shrink-0 px-2 py-0.5 rounded bg-amber-500/20 text-[11px] font-mono font-medium text-amber-900 dark:text-amber-100">
          <ShieldCheck className="w-3 h-3 text-emerald-600" />
          <span>Target-Leakage Protected</span>
        </div>
      </div>
    </div>
  );
}
