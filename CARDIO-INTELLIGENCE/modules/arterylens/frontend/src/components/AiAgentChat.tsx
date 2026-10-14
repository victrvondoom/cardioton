import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { PatientData, WhatIfResult } from '../arterylens__frontend_src__types';
import { askAgent, simulateWhatIf } from '../arterylens__frontend_src__api';
import { Send, SlidersHorizontal, ArrowRight, Loader2, Sparkles } from 'lucide-react';

interface AiAgentChatProps {
  patient: PatientData;
  selectedTarget: string;
}

export const AiAgentChat: React.FC<AiAgentChatProps> = ({
  patient,
  selectedTarget
}) => {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'agent'; text: string }>>([
    {
      role: 'agent',
      text: "The Clinical AI Explainer provides tool-verified case interpretations and counterfactual sensitivity testing. Click **Synthesize case findings** below or adjust parameters in the **What-if simulator**."
    }
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [whatIfResult, setWhatIfResult] = useState<WhatIfResult | null>(null);
  const [whatIfLoading, setWhatIfLoading] = useState(false);

  // Counterfactual sliders
  const [targetLDL, setTargetLDL] = useState<number>(70);
  const [targetBP, setTargetBP] = useState<number>(120);
  const [cessateSmoking, setCessateSmoking] = useState<boolean>(true);

  const handleSend = async (queryText?: string) => {
    const q = queryText || inputQuery;
    if (!q.trim() || loading) return;

    const userMsg = { role: 'user' as const, text: q };
    setMessages(prev => [...prev, userMsg]);
    if (!queryText) setInputQuery('');
    setLoading(true);

    try {
      const res = await askAgent(q, patient, selectedTarget);
      setMessages(prev => [...prev, { role: 'agent', text: res.reply }]);
    } catch (err) {
      setMessages(prev => [
        ...prev, 
        { role: 'agent', text: "Unable to contact the clinical decision support server. Please verify backend connectivity." }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const runCounterfactualSimulation = async () => {
    setWhatIfLoading(true);
    try {
      const changes: Record<string, number> = {
        LDL: targetLDL,
        BP: targetBP,
        'Current Smoker': cessateSmoking ? 0.0 : (patient['Current Smoker'] ?? 0.0)
      };
      const res = await simulateWhatIf(patient, changes);
      setWhatIfResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setWhatIfLoading(false);
    }
  };

  return (
    <div className="clinical-card p-4 rounded-lg shadow-sm flex flex-col space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Clinical AI explanation
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Tool-grounded clinical reasoning and sensitivity analysis
          </p>
        </div>

        <button
          onClick={() => handleSend(`Provide a clinical case summary with key risk factors for ${selectedTarget}.`)}
          disabled={loading}
          className="px-3 py-1.5 rounded-md bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 text-xs font-medium hover:bg-sky-100 transition disabled:opacity-50 flex items-center gap-1.5"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Synthesize case findings</span>
        </button>
      </div>

      {/* Messages Stream (rendered with ReactMarkdown) */}
      <div className="overflow-y-auto space-y-3 max-h-[300px] pr-1">
        {messages.map((m, idx) => (
          <div 
            key={idx} 
            className={`p-3 rounded-md text-xs leading-relaxed ${
              m.role === 'user' 
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 ml-6 border border-slate-200 dark:border-slate-700' 
                : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <div className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 mb-1">
              {m.role === 'user' ? 'Clinician query' : 'Decision support explanation'}
            </div>
            
            {/* Proper Markdown rendering */}
            <div className="prose prose-xs max-w-none dark:prose-invert prose-p:my-1 prose-headings:my-1.5 prose-ul:my-1 prose-li:my-0.5 text-xs">
              <ReactMarkdown>{m.text}</ReactMarkdown>
            </div>
          </div>
        ))}
        {loading && (
          <div className="p-3 rounded-md bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-600" />
            <span>Analyzing clinical parameters...</span>
          </div>
        )}
      </div>

      {/* What-If Counterfactual Simulator */}
      <div className="p-3 rounded-md bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-xs">
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
            What-if sensitivity simulator
          </span>
          <button
            onClick={runCounterfactualSimulation}
            disabled={whatIfLoading}
            className="px-2.5 py-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium hover:bg-slate-100 transition flex items-center gap-1 shadow-sm"
          >
            <span>Simulate delta</span>
            <ArrowRight className="w-3 h-3 text-slate-400" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-2">
          <div>
            <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-400 mb-0.5">
              <span>Target LDL:</span>
              <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-200">{targetLDL} mg/dL</span>
            </div>
            <input 
              type="range" min="50" max="160" step="5" value={targetLDL}
              onChange={e => setTargetLDL(Number(e.target.value))}
              className="w-full accent-sky-600 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-400 mb-0.5">
              <span>Target systolic BP:</span>
              <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-200">{targetBP} mmHg</span>
            </div>
            <input 
              type="range" min="100" max="160" step="5" value={targetBP}
              onChange={e => setTargetBP(Number(e.target.value))}
              className="w-full accent-sky-600 cursor-pointer"
            />
          </div>

          <div className="flex items-center pt-2">
            <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={cessateSmoking}
                onChange={e => setCessateSmoking(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-600 text-sky-600 focus:ring-0"
              />
              <span className="text-xs">Smoking cessation</span>
            </label>
          </div>
        </div>

        {/* Counterfactual results */}
        {whatIfResult && (
          <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800 grid grid-cols-4 gap-2 text-[11px] tabular-nums">
            {(['CAD', 'LAD', 'LCX', 'RCA'] as const).map(vessel => {
              const item = whatIfResult.risk_comparison[vessel];
              const arr = Math.round(item.absolute_risk_reduction * 100);
              return (
                <div key={vessel} className="p-1.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
                  <span className="text-slate-500 block text-[10px]">{vessel}</span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                    {arr > 0 ? `-${arr}%` : '0%'}
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    ({Math.round(item.modified_prob * 100)}% new)
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Query Input Bar */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={inputQuery}
          onChange={e => setInputQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Ask a clinical question (e.g. 'Why is LAD risk elevated?')..."
          className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-1 focus:ring-sky-500 focus:outline-none"
        />
        <button
          onClick={() => handleSend()}
          disabled={loading || !inputQuery.trim()}
          className="p-1.5 rounded-md bg-sky-700 hover:bg-sky-800 text-white transition disabled:opacity-40"
          title="Send query"
          aria-label="Send query"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
