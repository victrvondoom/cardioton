/**
 * Clinical Extraction Panel
 *
 * Component for extracting cardiovascular findings from clinical text
 * Integrates with Epicast-main adapted clinical extraction service
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { cardio, ClinicalExtractionResult } from '../core__src_cardiotwin__api';

// =============================================================================
// Types
// =============================================================================

interface ClinicalExtractionState {
  loading: boolean;
  error: string | null;
  result: ClinicalExtractionResult | null;
  history: ClinicalExtractionResult[];
  text: string;
  patientId?: string;
  caseId?: string;
  isProcessing: boolean;
  processingProgress: number;
}

interface ClinicalExtractionPanelProps {
  patientId?: string;
  caseId?: string;
  onExtractionComplete?: (result: ClinicalExtractionResult) => void;
  className?: string;
  defaultText?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

const SEVERITY_COLORS = {
  critical: 'text-red-400 bg-red-500/10',
  high: 'text-orange-400 bg-orange-500/10',
  medium: 'text-yellow-400 bg-yellow-500/10',
  low: 'text-blue-400 bg-blue-500/10',
};

const CATEGORY_COLORS: Record<string, string> = {
  'ecg_findings': 'border-purple-500 bg-purple-500/5',
  'echo_findings': 'border-green-500 bg-green-500/5',
  'cardiac_symptoms': 'border-cyan-500 bg-cyan-500/5',
  'cardiac_categories': 'border-indigo-500 bg-indigo-500/5',
  'icd10_codes': 'border-orange-500 bg-orange-500/5',
  'urgent_conditions': 'border-red-500 bg-red-500/5',
};

const FINDING_ICONS: Record<string, string> = {
  'ST_Elevation': '⚠️',
  'ST_Deppression': '⚠️',
  'T_Wave_Inversion': '⚠️',
  'Q_Wave': '⚠️',
  'Atrial_Fibrillation': '🫀',
  'Ventricular_Tachycardia': '🫀',
  'Bradycardia': '🫀',
  'Tachycardia': '🫀',
  'Hypertrophy': '💪',
  'Dilated_Cardiomyopathy': '🫀',
  'Heart_Failure': '🫀',
  'Chest_Pain': '😣',
  'Shortness_of_Breath': '😰',
  'Palpitations': '🫀',
  'Syncope': '😵',
  'Edema': '🦵',
};

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

// =============================================================================
// Component: Finding Badge
// =============================================================================

const FindingBadge: React.FC<{
  finding: string;
  severity: string;
  size?: 'sm' | 'md' | 'lg';
}> = ({ finding, severity, size = 'md' }) => {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  const colorClass = SEVERITY_COLORS[severity.toLowerCase() as keyof typeof SEVERITY_COLORS] || SEVERITY_COLORS.low;
  const icon = FINDING_ICONS[finding] || '📋';

  return (
    <div className={`rounded-full font-medium ${colorClass} ${sizeClasses[size]}`}>
      <span className="mr-1">{icon}</span>
      {finding.replace('_', ' ')}
    </div>
  );
};

// =============================================================================
// Component: ICD10 Code Display
// =============================================================================

const ICD10CodeDisplay: React.FC<{ codes: string[] }> = ({ codes }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-lg">🏥</span>
        <span className="font-medium">ICD-10 Codes</span>
        <button
          onClick={() => setExpanded(!expanded)}
          className="ml-auto text-sm text-cyan-400 hover:text-cyan-300"
        >
          {expanded ? 'Show less' : `Show all (${codes.length})`}
        </button>
      </div>
      <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 ${!expanded && codes.length > 8 ? 'line-clamp-2' : ''}`}>
        {codes.map((code, idx) => (
          <div
            key={idx}
            className="px-3 py-1 rounded bg-white/5 border border-white/10 text-sm font-mono"
          >
            {code}
          </div>
        ))}
      </div>
    </div>
  );
};

// =============================================================================
// Component: Urgent Conditions Alert
// =============================================================================

const UrgentConditionsAlert: React.FC<{
  conditions: Array<{
    condition: string;
    confidence: number;
    icd10: string;
    recommendation: string;
  }>;
}> = ({ conditions }) => {
  if (conditions.length === 0) return null;

  return (
    <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 mb-4 animate-pulse-subtle">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">⚠️</span>
        <span className="font-bold text-red-400">URGENT CONDITIONS DETECTED</span>
      </div>
      <div className="space-y-3">
        {conditions.map((condition, idx) => (
          <div
            key={idx}
            className="p-3 rounded-lg bg-red-500/5 border-l-4 border-red-500/40"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-bold text-red-400">{condition.condition.replace('_', ' ')}</div>
                <div className="text-sm text-red-300/70">
                  ICD-10: {condition.icd10}
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-lg">
                  {Math.round(condition.confidence * 100)}%
                </div>
                <div className="text-xs text-red-300/70">Confidence</div>
              </div>
            </div>
            {condition.recommendation && (
              <div className="mt-2 text-sm text-red-300/80">
                <span className="font-medium">Recommendation:</span> {condition.recommendation}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// =============================================================================
// Component: Extraction Results Display
// =============================================================================

const ExtractionResultsDisplay: React.FC<{
  result: ClinicalExtractionResult;
  onClear?: () => void;
}> = ({ result, onClear }) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'details' | 'raw'>('summary');

  const tabs = [
    { id: 'summary' as const, label: 'Summary', icon: '📊' },
    { id: 'details' as const, label: 'Details', icon: '📋' },
    { id: 'raw' as const, label: 'Raw Data', icon: '🔍' },
  ];

  // ECG/echo findings carry `finding`, symptoms carry `symptom`: normalise to one label.
  const allFindings: Array<{ label: string; severity: string; category: string }> = [
    ...result.findings.ecg_findings.map(f => ({ label: f.finding, severity: f.severity, category: 'ECG' })),
    ...result.findings.echo_findings.map(f => ({ label: f.finding, severity: f.severity, category: 'Echo' })),
    ...result.findings.cardiac_symptoms.map(f => ({ label: f.symptom, severity: 'medium', category: 'Symptom' })),
  ].sort((a, b) => {
    const severityA = SEVERITY_ORDER[a.severity?.toLowerCase() as keyof typeof SEVERITY_ORDER] ?? 4;
    const severityB = SEVERITY_ORDER[b.severity?.toLowerCase() as keyof typeof SEVERITY_ORDER] ?? 4;
    return severityA - severityB;
  });

  const totalFindings = allFindings.length;
  const highSeverity = allFindings.filter(f => ['critical', 'high'].includes(f.severity?.toLowerCase() || '')).length;

  return (
    <div className="bg-black/30 rounded-lg border border-white/5 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📄</span>
          <div>
            <h3 className="font-medium">Extraction Results</h3>
            <p className="text-xs text-gray-400">
              Processed in {result.processing_time_ms}ms
            </p>
          </div>
        </div>
        {onClear && (
          <button
            onClick={onClear}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-colors"
          >
            ✕ Clear
          </button>
        )}
      </div>

      {/* Urgent Conditions */}
      {result.findings.urgent_conditions.length > 0 && (
        <div className="p-4">
          <UrgentConditionsAlert conditions={result.findings.urgent_conditions} />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 px-4">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              px-3 py-2 rounded-t text-sm font-medium transition-all
              ${activeTab === tab.id
                ? 'bg-white/10 text-white border border-b-0 border-white/20'
                : 'text-gray-400 hover:bg-white/5 hover:text-white/80'
              }
            `}
          >
            <span className="mr-1">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-4 min-h-[300px]">
        {activeTab === 'summary' && (
          <div className="space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-white/5">
                <div className="text-sm text-gray-400">Total Findings</div>
                <div className="text-2xl font-bold">{totalFindings}</div>
              </div>
              <div className="p-3 rounded-lg bg-white/5">
                <div className="text-sm text-gray-400">High Severity</div>
                <div className="text-2xl font-bold text-red-400">{highSeverity}</div>
              </div>
              <div className="p-3 rounded-lg bg-white/5">
                <div className="text-sm text-gray-400">ICD-10 Codes</div>
                <div className="text-2xl font-bold">{result.findings.icd10_codes.length}</div>
              </div>
              <div className="p-3 rounded-lg bg-white/5">
                <div className="text-sm text-gray-400">Quality Score</div>
                <div className="text-2xl font-bold text-green-400">
                  {Math.round(result.quality_score * 100)}%
                </div>
              </div>
            </div>

            {/* ICD-10 Codes */}
            {result.findings.icd10_codes.length > 0 && (
              <ICD10CodeDisplay codes={result.findings.icd10_codes} />
            )}

            {/* All Findings List */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-white/70">All Findings</h4>
              <div className="flex flex-wrap gap-2">
                {allFindings.slice(0, 20).map((finding, idx) => (
                  <FindingBadge
                    key={idx}
                    finding={finding.label || finding.category}
                    severity={finding.severity || 'medium'}
                    size="sm"
                  />
                ))}
                {allFindings.length > 20 && (
                  <div className="px-3 py-1 rounded-full bg-gray-500/10 text-gray-400 text-sm">
                    +{allFindings.length - 20} more
                  </div>
                )}
              </div>
            </div>

            {/* Category Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-white/5">
                <h4 className="text-sm font-medium text-white/70 mb-2">ECG Findings</h4>
                {result.findings.ecg_findings.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {result.findings.ecg_findings.map((f, idx) => (
                      <FindingBadge key={idx} finding={f.finding} severity={f.severity} size="sm" />
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-400/50">No ECG findings detected</div>
                )}
              </div>
              <div className="p-3 rounded-lg bg-white/5">
                <h4 className="text-sm font-medium text-white/70 mb-2">Echo Findings</h4>
                {result.findings.echo_findings.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {result.findings.echo_findings.map((f, idx) => (
                      <FindingBadge key={idx} finding={f.finding} severity={f.severity} size="sm" />
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-400/50">No echo findings detected</div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-white/5">
                <h4 className="text-sm font-medium text-white/70 mb-2">Cardiac Symptoms</h4>
                {result.findings.cardiac_symptoms.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {result.findings.cardiac_symptoms.map((s, idx) => (
                      <FindingBadge key={idx} finding={s.symptom} severity={s.severity} size="sm" />
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-400/50">No symptoms detected</div>
                )}
              </div>
              <div className="p-3 rounded-lg bg-white/5">
                <h4 className="text-sm font-medium text-white/70 mb-2">Cardiac Categories</h4>
                {result.findings.cardiac_categories.length > 0 ? (
                  <div className="space-y-2">
                    {result.findings.cardiac_categories.map((cat, idx) => (
                      <div key={idx} className="p-2 rounded bg-white/5">
                        <div className="font-medium">{cat.category}</div>
                        <div className="text-xs text-gray-400">
                          Confidence: {Math.round(cat.confidence * 100)}%
                        </div>
                        {cat.findings.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {cat.findings.map((f, fIdx) => (
                              <span key={fIdx} className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 text-xs">
                                {f}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-400/50">No categories detected</div>
                )}
              </div>
            </div>

            {/* Warnings */}
            {result.warnings.length > 0 && (
              <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                <h4 className="text-sm font-medium text-yellow-400 mb-2">Warnings</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-yellow-300/80">
                  {result.warnings.map((warning, idx) => (
                    <li key={idx}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {activeTab === 'details' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* ECG Findings */}
              <div className={CATEGORY_COLORS.ecg_findings + ' rounded-lg p-4'}>
                <h4 className="font-medium mb-3 text-purple-400">ECG Findings ({result.findings.ecg_findings.length})</h4>
                {result.findings.ecg_findings.length > 0 ? (
                  <div className="space-y-3">
                    {result.findings.ecg_findings.map((f, idx) => (
                      <div key={idx} className="p-3 rounded bg-white/5">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <div className="font-medium">{f.finding}</div>
                            <div className="text-sm text-gray-400">
                              Location: {f.location} | Severity: {f.severity}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-lg">
                              {Math.round(f.confidence * 100)}%
                            </div>
                            <div className="text-xs text-gray-400">Confidence</div>
                          </div>
                        </div>
                        {f.timestamp && (
                          <div className="text-xs text-gray-400 mt-2">
                            Timestamp: {f.timestamp}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-400/50 text-center py-4">No ECG findings</div>
                )}
              </div>

              {/* Echo Findings */}
              <div className={CATEGORY_COLORS.echo_findings + ' rounded-lg p-4'}>
                <h4 className="font-medium mb-3 text-green-400">Echo Findings ({result.findings.echo_findings.length})</h4>
                {result.findings.echo_findings.length > 0 ? (
                  <div className="space-y-3">
                    {result.findings.echo_findings.map((f, idx) => (
                      <div key={idx} className="p-3 rounded bg-white/5">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <div className="font-medium">{f.finding}</div>
                            <div className="text-sm text-gray-400">
                              View: {f.view} | Severity: {f.severity}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-lg">
                              {Math.round(f.confidence * 100)}%
                            </div>
                            <div className="text-xs text-gray-400">Confidence</div>
                          </div>
                        </div>
                        {f.measurement && (
                          <div className="text-xs text-gray-400 mt-2">
                            Measurements: {JSON.stringify(f.measurement)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-400/50 text-center py-4">No echo findings</div>
                )}
              </div>

              {/* Symptoms */}
              <div className={CATEGORY_COLORS.cardiac_symptoms + ' rounded-lg p-4'}>
                <h4 className="font-medium mb-3 text-cyan-400">Cardiac Symptoms ({result.findings.cardiac_symptoms.length})</h4>
                {result.findings.cardiac_symptoms.length > 0 ? (
                  <div className="space-y-3">
                    {result.findings.cardiac_symptoms.map((s, idx) => (
                      <div key={idx} className="p-3 rounded bg-white/5">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <div className="font-medium">{s.symptom}</div>
                            <div className="text-sm text-gray-400">
                              Severity: {s.severity} | Duration: {s.duration} | Onset: {s.onset}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-lg">
                              {Math.round(s.confidence * 100)}%
                            </div>
                            <div className="text-xs text-gray-400">Confidence</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-400/50 text-center py-4">No symptoms detected</div>
                )}
              </div>

              {/* Categories */}
              <div className={CATEGORY_COLORS.cardiac_categories + ' rounded-lg p-4'}>
                <h4 className="font-medium mb-3 text-indigo-400">Cardiac Categories ({result.findings.cardiac_categories.length})</h4>
                {result.findings.cardiac_categories.length > 0 ? (
                  <div className="space-y-3">
                    {result.findings.cardiac_categories.map((cat, idx) => (
                      <div key={idx} className="p-3 rounded bg-white/5">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <div className="font-medium">{cat.category}</div>
                            <div className="text-sm text-gray-400">
                              Findings: {cat.findings.length}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-lg">
                              {Math.round(cat.confidence * 100)}%
                            </div>
                            <div className="text-xs text-gray-400">Confidence</div>
                          </div>
                        </div>
                        {cat.findings.length > 0 && (
                          <div className="mt-2 text-xs text-gray-400">
                            {cat.findings.join(', ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-400/50 text-center py-4">No categories</div>
                )}
              </div>
            </div>

            {/* Urgent Conditions */}
            {result.findings.urgent_conditions.length > 0 && (
              <div className={CATEGORY_COLORS.urgent_conditions + ' rounded-lg p-4'}>
                <h4 className="font-medium mb-3 text-red-400">Urgent Conditions ({result.findings.urgent_conditions.length})</h4>
                <div className="space-y-3">
                  {result.findings.urgent_conditions.map((c, idx) => (
                    <div key={idx} className="p-3 rounded bg-white/5">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="font-medium text-red-400">{c.condition}</div>
                          <div className="text-sm text-gray-400">ICD-10: {c.icd10}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-lg">
                            {Math.round(c.confidence * 100)}%
                          </div>
                          <div className="text-xs text-gray-400">Confidence</div>
                        </div>
                      </div>
                      <div className="text-sm text-red-300/80 mt-2">
                        {c.recommendation}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'raw' && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-black/40">
              <pre className="text-xs text-white/70 overflow-x-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => navigator.clipboard.writeText(JSON.stringify(result, null, 2))}
                className="px-4 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 text-sm transition-colors"
              >
                Copy to Clipboard
              </button>
              <button
                onClick={() => {
                  const data = JSON.stringify(result, null, 2);
                  const blob = new Blob([data], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `clinical_extraction_${result.patient_id || 'export'}_${new Date().toISOString().split('T')[0]}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm transition-colors"
              >
                Export JSON
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// =============================================================================
// Main Component: ClinicalExtractionPanel
// =============================================================================

const ClinicalExtractionPanel: React.FC<ClinicalExtractionPanelProps> = ({
  patientId,
  caseId,
  onExtractionComplete,
  className,
  defaultText = '',
}) => {
  const [state, setState] = useState<ClinicalExtractionState>({
    loading: false,
    error: null,
    result: null,
    history: [],
    text: defaultText,
    patientId,
    caseId,
    isProcessing: false,
    processingProgress: 0,
  });

  const [textInput, setTextInput] = useState(defaultText);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Handle text change
  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTextInput(e.target.value);
  }, []);

  // Handle extraction
  const handleExtract = useCallback(async () => {
    if (!textInput.trim()) {
      setState(prev => ({ ...prev, error: 'Please enter clinical text to extract from' }));
      return;
    }

    try {
      setState(prev => ({ ...prev,
        loading: true,
        error: null,
        isProcessing: true,
        processingProgress: 0,
        result: null
      }));

      const result = await cardio.extractClinicalText(textInput, patientId, caseId);

      setState(prev => ({
        ...prev,
        loading: false,
        isProcessing: false,
        result,
        text: textInput,
        history: [...prev.history, result],
      }));

      // Notify parent
      onExtractionComplete?.(result);
    } catch (error) {
      console.error('Error extracting clinical text:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        isProcessing: false,
        error: error instanceof Error ? error.message : 'Failed to extract clinical text',
      }));
    }
  }, [textInput, patientId, caseId, onExtractionComplete]);

  // Clear results
  const handleClear = useCallback(() => {
    setState(prev => ({
      ...prev,
      result: null,
      text: '',
      error: null,
    }));
    setTextInput('');
    if (textareaRef.current) {
      textareaRef.current.value = '';
    }
  }, []);

  // Load from history
  const handleLoadFromHistory = useCallback((result: ClinicalExtractionResult) => {
    setState(prev => ({
      ...prev,
      result,
      text: '', // Would need to store original text in history to restore
    }));
    setTextInput('');
  }, []);

  // Auto-size textarea
  const handleAutoSize = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, []);

  useEffect(() => {
    handleAutoSize();
  }, [textInput, handleAutoSize]);

  // Check if extraction is possible
  const canExtract = textInput.trim().length > 0 && !state.loading;

  return (
    <div className={`w-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-4 p-4 rounded-lg bg-black/30 border border-white/5">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📝</span>
          <div>
            <h2 className="text-lg font-medium text-white">Clinical Text Extraction</h2>
            <p className="text-sm text-gray-400">
              Extract cardiovascular findings from clinical notes and reports
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {state.isProcessing && (
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white/50"></div>
              <span className="text-sm text-white/70">Processing...</span>
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-black/30 rounded-lg border border-white/5 p-4 mb-4">
        <div className="flex items-center justify-between gap-4 mb-3">
          <label className="text-sm font-medium text-white/80">
            Clinical Text Input
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">
              {textInput.length} characters
            </span>
            <button
              onClick={handleClear}
              disabled={!textInput && !state.result}
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Clear
            </button>
          </div>
        </div>

        <textarea
          ref={textareaRef}
          value={textInput}
          onChange={handleTextChange}
          placeholder={`Enter clinical text here...

Example formats:
- ECG Report: "Sinus rhythm at 72 bpm. No ST elevation. Normal axis."
- Echo Report: "LVEF 60%. Mild LVH. Normal valve function."
- Clinical Notes: "Patient reports chest pain for 2 hours. No radiation. Associated with SOB."
- Discharge Summary: "Admitted with NSTEMI. PCI to LAD. Discharged on DAPT."
- Progress Note: "Stable post-MI. No recurrent chest pain. Tolerating medications."`}
          className="w-full p-4 rounded-lg bg-black/40 border border-white/5 text-white placeholder-gray-500/50 resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500/30 min-h-[150px]"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.ctrlKey && canExtract) {
              handleExtract();
            }
          }}
        />

        <div className="flex items-center justify-between gap-4 mt-4">
          <div className="text-sm text-gray-400">
            Supports: ECG reports, Echo reports, Clinical notes, Discharge summaries, Progress notes
          </div>
          <button
            onClick={handleExtract}
            disabled={!canExtract}
            className={`px-6 py-2 rounded-lg font-medium transition-all ${
              canExtract
                ? 'bg-cyan-500 hover:bg-cyan-600 text-white cursor-pointer'
                : 'bg-cyan-500/20 text-cyan-400 cursor-not-allowed'
            }`}
          >
            {state.loading ? 'Extracting...' : 'Extract Cardiovascular Findings'}
          </button>
        </div>
      </div>

      {/* Error State */}
      {state.error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 mb-4">
          <div className="flex items-center gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <h3 className="font-medium mb-1">Extraction Error</h3>
              <p className="text-sm">{state.error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {state.result && (
        <ExtractionResultsDisplay
          result={state.result}
          onClear={handleClear}
        />
      )}

      {/* History */}
      {state.history.length > 1 && !state.result && (
        <div className="p-4 rounded-lg bg-black/30 border border-white/5">
          <h3 className="font-medium mb-3 text-white/80">
            Recent Extusions ({state.history.length})
          </h3>
          <div className="space-y-2">
            {state.history.slice(0, 5).map((result, idx) => (
              <div
                key={idx}
                onClick={() => handleLoadFromHistory(result)}
                className="p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium">
                      Patient: {result.patient_id || 'N/A'}
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(result.extraction_timestamp).toLocaleString()} |
                      {result.findings.ecg_findings.length + result.findings.echo_findings.length + result.findings.cardiac_symptoms.length} findings
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg">
                      {Math.round(result.quality_score * 100)}%
                    </div>
                    <div className="text-xs text-gray-400">Quality</div>
                  </div>
                </div>
              </div>
            ))}
            {state.history.length > 5 && (
              <div className="text-center text-sm text-gray-400/50 pt-2">
                +{state.history.length - 5} more in history
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!state.result && !state.error && !state.loading && (
        <div className="p-8 rounded-lg bg-white/5 border border-white/5 text-center">
          <div className="text-4xl mb-4">📝</div>
          <h3 className="text-lg font-medium mb-2">Enter Clinical Text</h3>
          <p className="text-sm text-gray-400 mb-4">
            Paste clinical notes, reports, or documents to extract cardiovascular findings
          </p>
          <p className="text-xs text-gray-500 mb-4">
            The system will automatically identify:
          </p>
          <div className="flex flex-wrap justify-center gap-2 text-xs">
            <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400">ECG Findings</span>
            <span className="px-3 py-1 rounded-full bg-green-500/10 text-green-400">Echo Findings</span>
            <span className="px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400">Symptoms</span>
            <span className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-400">ICD-10 Codes</span>
            <span className="px-3 py-1 rounded-full bg-orange-500/10 text-orange-400">Urgent Conditions</span>
            <span className="px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400">Categories</span>
          </div>
        </div>
      )}
    </div>
  );
};

// Add CSS for animations
const styles = document.createElement('style');
styles.textContent = `
  @keyframes pulse-subtle {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }
  .animate-pulse-subtle {
    animation: pulse-subtle 2s ease-in-out infinite;
  }
  textarea::placeholder {
    color: rgba(255, 255, 255, 0.2);
  }
`;
document.head.appendChild(styles);

export default ClinicalExtractionPanel;
