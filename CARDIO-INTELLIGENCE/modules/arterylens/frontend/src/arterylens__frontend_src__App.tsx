import React, { useEffect, useState } from 'react';
import { 
  PatientData, 
  SamplePatient, 
  PredictionResult, 
  ExplanationResult 
} from './arterylens__frontend_src__types';
import { 
  fetchSamples, 
  predictRisk, 
  explainRisk 
} from './arterylens__frontend_src__api';
import { HeartViewer } from './components/arterylens__src_components__HeartViewer';
import { PatientForm } from './components/arterylens__src_components__PatientForm';
import { RiskCard } from './components/RiskCard';
import { VesselCards } from './components/VesselCards';
import { ShapChart } from './components/arterylens__src_components__ShapChart';
import { MeasurementsTable } from './components/MeasurementsTable';
import { AiAgentChat } from './components/AiAgentChat';
import { MetricsModal } from './components/MetricsModal';
import { 
  Info, 
  Sun, 
  Moon, 
  RotateCw, 
  AlertCircle 
} from 'lucide-react';

export const App: React.FC = () => {
  const [samples, setSamples] = useState<SamplePatient[]>([]);
  const [currentPatient, setCurrentPatient] = useState<PatientData>({});
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [explanation, setExplanation] = useState<ExplanationResult | null>(null);
  const [selectedVessel, setSelectedVessel] = useState<string>('LAD');
  const [selectedTarget, setSelectedTarget] = useState<string>('CAD');
  const [activeBottomTab, setActiveBottomTab] = useState<'shap' | 'table' | 'agent'>('shap');
  const [loading, setLoading] = useState<boolean>(false);
  const [metricsOpen, setMetricsOpen] = useState<boolean>(false);
  const [apiConnected, setApiConnected] = useState<boolean>(true);
  const [darkMode, setDarkMode] = useState<boolean>(false);

  // Sync dark mode class with root html element
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Load benchmark samples on mount
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = () => {
    fetchSamples()
      .then(sampleList => {
        setSamples(sampleList);
        if (sampleList.length > 0) {
          const first = sampleList[0];
          setCurrentPatient(first.data);
          runFullEvaluation(first.data, 'CAD');
        }
        setApiConnected(true);
      })
      .catch(err => {
        console.error('API connection failed:', err);
        setApiConnected(false);
      });
  };

  const runFullEvaluation = async (patientData: PatientData, target: string = 'CAD') => {
    setLoading(true);
    try {
      const [predRes, expRes] = await Promise.all([
        predictRisk(patientData),
        explainRisk(patientData, target)
      ]);
      setPrediction(predRes);
      setExplanation(expRes);
      setApiConnected(true);
    } catch (err) {
      console.error('Error running assessment:', err);
      setApiConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSample = (sample: SamplePatient) => {
    setCurrentPatient(sample.data);
    runFullEvaluation(sample.data, selectedTarget);
  };

  const handleSelectVessel = (vessel: string) => {
    setSelectedVessel(vessel);
    setSelectedTarget(vessel);
    explainRisk(currentPatient, vessel)
      .then(res => setExplanation(res))
      .catch(err => console.error(err));
  };

  const handleSelectTarget = (target: string) => {
    setSelectedTarget(target);
    setSelectedVessel(target === 'CAD' ? 'LAD' : target);
    explainRisk(currentPatient, target)
      .then(res => setExplanation(res))
      .catch(err => console.error(err));
  };

  const probabilities = prediction?.probabilities || {
    LAD: 0.5,
    LCX: 0.5,
    RCA: 0.5
  };

  return (
    <div className="min-h-screen bg-[#F6F7F9] dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      {/* 1. Slim Header */}
      <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 md:px-6 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-sky-700 flex items-center justify-center text-white font-bold text-xs">
            C3D
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-tight">
              CardioRisk 3D
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-none">
              Cardiovascular decision support
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Subtle Connection Status Dot */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
            <span className={`w-2 h-2 rounded-full ${apiConnected ? 'bg-emerald-600' : 'bg-rose-600'}`} />
            <span className="text-[11px]">{apiConnected ? 'Connected' : 'Offline'}</span>
          </div>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />

          {/* Theme Toggle Button */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label="Toggle color theme"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Model Validation Text Button */}
          <button
            onClick={() => setMetricsOpen(true)}
            className="px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            Model validation
          </button>
        </div>
      </header>

      {/* 2. Slim Neutral Disclaimer Info Bar */}
      <div className="bg-amber-50/80 dark:bg-slate-850 border-b border-amber-200/60 dark:border-slate-800 px-4 py-1.5 text-xs text-amber-900 dark:text-amber-200/90 flex items-center justify-center gap-2">
        <Info className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
        <span>
          For decision support and educational use only. Not a substitute for formal diagnostic imaging or clinical judgment.
        </span>
      </div>

      {/* Offline Error Alert Banner (if backend disconnected) */}
      {!apiConnected && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border-b border-rose-200 dark:border-rose-900 px-4 py-2 text-xs text-rose-800 dark:text-rose-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>FastAPI backend is unreachable on port 8000. Predictions and explanations are paused.</span>
          </div>
          <button
            onClick={loadInitialData}
            className="flex items-center gap-1 font-semibold text-rose-700 hover:underline"
          >
            <RotateCw className="w-3 h-3" /> Retry
          </button>
        </div>
      )}

      {/* 3. Main Three-Column Desktop Layout */}
      <main className="flex-1 max-w-[1560px] w-full mx-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column (320px equivalent ~ 3 cols on lg) */}
        <section className="lg:col-span-3 min-w-[300px] flex flex-col">
          <PatientForm
            patient={currentPatient}
            onChange={setCurrentPatient}
            samples={samples}
            onSelectSample={handleSelectSample}
            onSubmit={() => runFullEvaluation(currentPatient, selectedTarget)}
            loading={loading}
          />
        </section>

        {/* Center Column: 3D Viewer + Below-Viewer Tabs (~ 6 cols on lg) */}
        <section className="lg:col-span-6 flex flex-col gap-4">
          {/* 3D Heart Viewer */}
          <HeartViewer
            probabilities={probabilities}
            selectedVessel={selectedVessel}
            onSelectVessel={handleSelectVessel}
          />

          {/* Below-Viewer Tabs */}
          <div className="flex flex-col gap-2">
            {/* Tab Navigation */}
            <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 pb-1 text-xs">
              <button
                onClick={() => setActiveBottomTab('shap')}
                className={`px-3 py-1.5 rounded-md font-medium transition ${
                  activeBottomTab === 'shap'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold shadow-sm border border-slate-200 dark:border-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Feature contributions
              </button>

              <button
                onClick={() => setActiveBottomTab('table')}
                className={`px-3 py-1.5 rounded-md font-medium transition ${
                  activeBottomTab === 'table'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold shadow-sm border border-slate-200 dark:border-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Measurements
              </button>

              <button
                onClick={() => setActiveBottomTab('agent')}
                className={`px-3 py-1.5 rounded-md font-medium transition ${
                  activeBottomTab === 'agent'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold shadow-sm border border-slate-200 dark:border-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Explanation
              </button>
            </div>

            {/* Tab Contents */}
            <div>
              {activeBottomTab === 'shap' && (
                <ShapChart
                  explanation={explanation}
                  selectedTarget={selectedTarget}
                  onSelectTarget={handleSelectTarget}
                  loading={loading}
                />
              )}

              {activeBottomTab === 'table' && (
                <MeasurementsTable patient={currentPatient} />
              )}

              {activeBottomTab === 'agent' && (
                <AiAgentChat
                  patient={currentPatient}
                  selectedTarget={selectedTarget}
                />
              )}
            </div>
          </div>
        </section>

        {/* Right Column (380px equivalent ~ 3 cols on lg) */}
        <section className="lg:col-span-3 min-w-[320px] flex flex-col gap-4">
          {/* Overall CAD Compact Card */}
          <RiskCard prediction={prediction} loading={loading} />

          {/* Table-like Vessel Stenosis List with Single Caveat Footnote */}
          <VesselCards
            prediction={prediction}
            selectedVessel={selectedVessel}
            onSelectVessel={handleSelectVessel}
            loading={loading}
          />
        </section>
      </main>

      {/* 4. Quiet Clinical Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-3 mt-auto text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-[1560px] mx-auto flex flex-col md:flex-row items-center justify-between gap-2">
          <div>
            CardioRisk 3D • Extension of Z-Alizadeh Sani cohort (N=303)
          </div>
          <div>
            For decision support and educational use only. Not a substitute for formal diagnostic imaging or clinical judgment.
          </div>
        </div>
      </footer>

      {/* Model Validation Benchmark Modal */}
      <MetricsModal
        isOpen={metricsOpen}
        onClose={() => setMetricsOpen(false)}
      />
    </div>
  );
};

export default App;
