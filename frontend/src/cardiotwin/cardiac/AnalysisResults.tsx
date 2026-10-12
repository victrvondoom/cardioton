/**
 * Analysis Results Component
 *
 * Extracted and adapted from: heartAI-main/web/src/app/results/page.tsx
 * Original License: MIT (Copyright (c) 2025 Ethan Tam)
 * Original Author: Ethan Tam
 *
 * Adapted for CardioTwin cardiovascular intelligence platform
 * This component displays the final cardiac analysis results
 */

import React, { useEffect, useState } from 'react';
import { Diagnosis } from './types';
import { AnalysisDashboard } from './AnalysisDashboard';

/**
 * Props for the AnalysisResults component
 */
export interface AnalysisResultsProps {
    /** Diagnosis data to display */
    diagnosis?: Diagnosis;
    /** Optional fallback message when no diagnosis */
    fallbackMessage?: string;
    /** Callback when diagnosis is not available */
    onNoDiagnosis?: () => void;
}

/**
 * AnalysisResults component
 * Displays cardiac analysis results using the AnalysisDashboard
 * Can receive diagnosis data directly or from sessionStorage
 *
 * @example
 * ```tsx
 * <AnalysisResults
 *   diagnosis={{
 *     labels: ['Hypertrophic Cardiomyopathy'],
 *     imageUrl: '/images/heart.png',
 *     confidence: 0.95,
 *     explanation: 'The analysis shows...',
 *     severity: 'High',
 *     suggestionLinks: ['https://...'],
 *     path: '/visualizations/patient-123.html'
 *   }}
 * />
 * ```
 */
export const AnalysisResults: React.FC<AnalysisResultsProps> = ({
    diagnosis: propsDiagnosis,
    fallbackMessage = 'No analysis results available. Please upload a CMR file first.',
    onNoDiagnosis,
}) => {
    const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(propsDiagnosis || null);
    const [isLoading, setIsLoading] = useState<boolean>(!propsDiagnosis);

    useEffect(() => {
        // If diagnosis is provided via props, use it directly
        if (propsDiagnosis) {
            setDiagnosis(propsDiagnosis);
            setIsLoading(false);
            return;
        }

        // Try to read from sessionStorage (for compatibility with original flow)
        const raw = sessionStorage.getItem('ecgData');
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                if (parsed.diagnosis) {
                    setDiagnosis(parsed.diagnosis);
                    setIsLoading(false);
                    return;
                }
            } catch (error) {
                console.error('Error parsing sessionStorage data:', error);
            }
        }

        // No diagnosis available
        setIsLoading(false);
        onNoDiagnosis?.();
    }, [propsDiagnosis, onNoDiagnosis]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="flex items-center gap-3 text-orange-500">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                    <p className="text-slate-300">Loading results...</p>
                </div>
            </div>
        );
    }

    if (!diagnosis) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center space-y-4">
                    <div className="text-6xl text-slate-700/50">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-full h-full">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.898 20.562L16.5 22.5l-.398-1.938a3.375 3.375 0 00-2.455-2.456L12.75 18l1.938-.398a3.375 3.375 0 002.455-2.456L16.5 14.25l.398 1.938a3.375 3.375 0 002.456 2.456L20.25 18l-1.938.398a3.375 3.375 0 00-2.456 2.456z" />
                        </svg>
                    </div>
                    <p className="text-slate-400">{fallbackMessage}</p>
                    <button
                        onClick={onNoDiagnosis}
                        className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-3 rounded-lg transition-colors mx-auto"
                    >
                        Upload CMR
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="cardiotwin-analysis-results bg-slate-950 min-h-screen py-10">
            <div className="max-w-7xl mx-auto px-4">
                <AnalysisDashboard diagnosis={diagnosis} />
            </div>
        </div>
    );
};

export default AnalysisResults;
