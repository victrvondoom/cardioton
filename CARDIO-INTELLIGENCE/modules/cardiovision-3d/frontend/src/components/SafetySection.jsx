import React from 'react';
import {
  Shield,
  ShieldCheck,
  AlertTriangle,
  BookOpen,
  FileCheck,
  ExternalLink,
  Heart,
  Scale
} from 'lucide-react';

export default function SafetySection() {
  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="hospital-card p-6 space-y-3">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950 dark:text-amber-300">
            CLINICAL SAFETY & ETHICS
          </span>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Clinical Safety, Governance & Attributions
          </h2>
        </div>
        <p className="text-xs text-slate-500 max-w-3xl leading-relaxed">
          CardioVision AI is intentionally designed to elevate scientific credibility, ML transparency, and clinical safety above mere visual aesthetics.
        </p>
      </div>

      {/* Persistent Disclaimer Deep-Dive */}
      <div className="hospital-card p-6 border-l-4 border-l-amber-500 space-y-4">
        <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          <h3 className="text-base">Persistent Safety Mandate</h3>
        </div>

        <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 space-y-2 leading-relaxed">
          <p className="font-semibold text-sm">
            "Research & Educational Decision-Support Prototype. Model outputs are estimates for demonstration purposes only and are not medical diagnoses or substitutes for professional evaluation or formal diagnostic imaging."
          </p>
          <p>
            CardioVision AI does not provide definitive medical diagnoses, does not prescribe pharmaceutical interventions, and does not replace coronary angiography, intravascular ultrasound (IVUS), or fractional flow reserve (FFR).
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border space-y-1">
            <span className="font-bold text-slate-800 dark:text-slate-200">What This System Does:</span>
            <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400">
              <li>Computes statistical probabilities of significant stenosis (≥50%).</li>
              <li>Maps risk estimates to coronary arterial territories (LAD, LCX, RCA).</li>
              <li>Provides transparent, additive TreeSHAP feature attributions.</li>
              <li>Strictly prevents target leakage by excluding outcome proxies.</li>
            </ul>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border space-y-1">
            <span className="font-bold text-slate-800 dark:text-slate-200">What This System Does NOT Do:</span>
            <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400">
              <li>Does not detect physical plaque coordinates or intravascular morphology.</li>
              <li>Does not recommend invasive revascularization (PCI / CABG).</li>
              <li>Does not generate unverified medical claims or hardcoded metrics.</li>
              <li>Does not replace formal cardiovascular clinical judgment.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Attributions & Licenses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 3D MODEL ATTRIBUTION */}
        <div className="hospital-card p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Heart className="w-4 h-4 text-rose-600" />
            <span>3D Anatomical Model License & Attribution</span>
          </h3>
          <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            <p>
              <strong>Asset:</strong> Segmented Human Coronary Anatomy 3D Organ Mesh (<code className="font-mono text-[11px]">cardiovision_3d__public_models__heart.glb</code>).
            </p>
            <p>
              <strong>License:</strong> Creative Commons Attribution 4.0 International (CC-BY 4.0).
            </p>
            <p>
              <strong>Coronary Sulcus Alignment:</strong> Target vessels LAD, LCX, and RCA are registered along their respective anatomical grooves (anterior interventricular, circumflex atrioventricular, and right atrioventricular sulci).
            </p>
            <p className="text-[11px] text-slate-500 italic">
              <strong>Disclaimer:</strong> Geometry reflects standard human macroscopic coronary anatomy. Vessel highlights denote statistical model predictions, not directly measured endovascular plaque.
            </p>
          </div>
        </div>

        {/* DATASET CITATION */}
        <div className="hospital-card p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-sky-600" />
            <span>Dataset & Scientific Literature Citations</span>
          </h3>
          <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            <p>
              <strong>UCI Machine Learning Repository:</strong> Alizadehsani, R., et al. (2013, 2018). <em>Extension of Z-Alizadeh Sani Dataset</em> (Dataset ID: 411).
            </p>
            <p>
              <strong>Explainability:</strong> Lundberg, S. M., & Lee, S.-I. (2017). <em>A Unified Approach to Interpreting Model Predictions</em>. Advances in Neural Information Processing Systems (NeurIPS).
            </p>
            <p>
              <strong>Gradient Boosting:</strong> Chen, T., & Guestrin, C. (2016). <em>XGBoost: A Scalable Tree Boosting System</em>. ACM SIGKDD.
            </p>
            <p>
              <strong>Ensemble Learning:</strong> Breiman, L. (2001). <em>Random Forests</em>. Machine Learning, 45(1), 5-32.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
