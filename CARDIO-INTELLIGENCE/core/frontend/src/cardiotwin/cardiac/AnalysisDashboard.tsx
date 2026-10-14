/**
 * Analysis Dashboard Component
 *
 * Extracted and adapted from: heartAI-main/web/src/app/components/ResultsDashboard.tsx
 * Original License: MIT (Copyright (c) 2025 Ethan Tam)
 * Original Author: Ethan Tam
 *
 * Adapted for CardioTwin cardiovascular intelligence platform
 * This component displays cardiac analysis results with AI explanations and confidence metrics
 */

import React, { useState } from 'react';
import { Diagnosis } from './core__cardiotwin_cardiac__types';
import { HeartVisualization } from './HeartVisualization';

/**
 * Props for the AnalysisDashboard component
 */
export interface AnalysisDashboardProps {
    /** Diagnosis data to display */
    diagnosis: Diagnosis;
    /** Optional callback for AI agent toggle */
    onAgentToggle?: () => void;
    /** Whether to show the AI agent button (default: false) */
    showAgentButton?: boolean;
}

/**
 * Converts an array of labels to a comma-separated string
 */
function labelsToString(labels: string[]): string {
    return labels.join(', ');
}

/**
 * Parses suggestion text to convert bracket references like [1] into clickable links
 */
function parseSuggestionText(text: string, links: string[]): (string | React.ReactElement)[] {
    const regex = /\[(\d+)\]/g;
    const parts: (string | React.ReactElement)[] = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
        const index = match.index;
        if (index > lastIndex) {
            parts.push(text.slice(lastIndex, index));
        }
        const linkNumber = parseInt(match[1], 10);
        const linkUrl = links[linkNumber - 1]; // Adjust for 1-based index in text
        if (linkUrl) {
            parts.push(
                <a
                    key={index}
                    href={linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-orange-500 hover:text-orange-400 underline mx-1 transition-colors"
                    aria-label={`Reference ${linkNumber}`}
                >
                    {match[0]}
                </a>
            );
        } else {
            parts.push(match[0]);
        }
        lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) {
        parts.push(text.slice(lastIndex));
    }
    return parts;
}

/**
 * AnalysisDashboard component
 * Displays cardiac analysis results with AI explanations, confidence metrics, and 3D visualization
 *
 * Features:
 * - AI-generated explanation with reference links
 * - Diagnosis confidence visualization
 * - 3D heart visualization
 * - Severity indicator
 *
 * @example
 * ```tsx
 * <AnalysisDashboard
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
export const AnalysisDashboard: React.FC<AnalysisDashboardProps> = ({
    diagnosis,
    onAgentToggle,
    showAgentButton = false,
}) => {
    const [showAgent, setShowAgent] = useState(false);

    const handleAgentToggle = () => {
        setShowAgent((prev) => !prev);
        onAgentToggle?.();
    };

    // Map severity to color classes
    const getSeverityColor = (severity: string): string => {
        const severityLower = severity.toLowerCase();
        if (severityLower.includes('critical') || severityLower.includes('severe') || severityLower.includes('high')) {
            return 'text-red-500';
        }
        if (severityLower.includes('moderate') || severityLower.includes('medium')) {
            return 'text-orange-500';
        }
        return 'text-yellow-500';
    };

    // Calculate confidence color
    const getConfidenceColor = (confidence: number): string => {
        if (confidence >= 0.8) return 'bg-green-500';
        if (confidence >= 0.6) return 'bg-orange-500';
        if (confidence >= 0.4) return 'bg-yellow-500';
        return 'bg-red-500';
    };

    return (
        <div className="cardiotwin-analysis-dashboard w-full h-full">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 min-h-screen">
                {/* Left Column: AI Explanation */}
                <div className="space-y-6">
                    {/* AI Explanation Card */}
                    <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50 backdrop-blur-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold text-slate-200">
                                AI Explanation
                            </h2>

                            {/* AI Agent Button (optional) */}
                            {showAgentButton && (
                                <button
                                    onClick={handleAgentToggle}
                                    className="relative w-12 h-12 flex items-center justify-center focus:outline-none hover:scale-105 transition-transform"
                                    title="Talk to AI"
                                    aria-label="Toggle AI Agent"
                                    aria-pressed={showAgent}
                                >
                                    {/* Animated outer layers */}
                                    <div className="absolute inset-0 rounded-full bg-orange-600/30 animate-[cardiotwinPulse1_2s_infinite]"></div>
                                    <div className="absolute inset-0 rounded-full bg-orange-600/20 animate-[cardiotwinPulse2_2s_infinite]"></div>
                                    {/* Solid center */}
                                    <div className="relative w-8 h-8 rounded-full bg-orange-600"></div>
                                </button>
                            )}
                        </div>
                        <p className="text-slate-400 leading-relaxed text-sm">
                            {diagnosis.suggestionLinks
                                ? parseSuggestionText(diagnosis.explanation, diagnosis.suggestionLinks)
                                : diagnosis.explanation}
                        </p>
                    </div>
                </div>

                {/* Right Column: Diagnosis Confidence, Visualization */}
                <div className="space-y-6 flex flex-col">
                    {/* Diagnosis Confidence Card */}
                    <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50 backdrop-blur-sm">
                        <h2 className="text-xl font-semibold text-slate-200 mb-4">
                            Diagnosis Confidence
                        </h2>
                        <div className="space-y-4">
                            {/* Severity */}
                            <div className="flex items-center gap-2">
                                <span className="text-slate-400">Severity:</span>
                                <span className={`font-medium ${getSeverityColor(diagnosis.severity)}`}>
                                    {diagnosis.severity}
                                </span>
                            </div>

                            {/* Labels */}
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">{labelsToString(diagnosis.labels)}</span>
                                <span className="font-medium text-orange-500">
                                    {(diagnosis.confidence * 100).toFixed(1)}%
                                </span>
                            </div>

                            {/* Confidence Bar */}
                            <div className="relative pt-1">
                                <div className="overflow-hidden h-2 bg-slate-700/50 rounded-full">
                                    <div
                                        className={`h-full ${getConfidenceColor(diagnosis.confidence)} rounded-full transition-all duration-500`}
                                        style={{ width: `${diagnosis.confidence * 100}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Visualization Card */}
                    <div className="bg-slate-900/30 rounded-xl p-6 border border-slate-700/30 backdrop-blur-sm overflow-hidden flex items-center justify-center flex-grow">
                        <HeartVisualization
                            path={diagnosis.path}
                            width="100%"
                            height="100%"
                        />
                    </div>
                </div>
            </div>

            {/* Custom CSS animations for the AI circle */}
            <style>{`
                @keyframes cardiotwinPulse1 {
                    0% {
                        transform: scale(0.8);
                        opacity: 0.8;
                    }
                    50% {
                        transform: scale(1.2);
                        opacity: 0.2;
                    }
                    100% {
                        transform: scale(0.8);
                        opacity: 0.8;
                    }
                }
                @keyframes cardiotwinPulse2 {
                    0% {
                        transform: scale(0.9);
                        opacity: 0.7;
                    }
                    50% {
                        transform: scale(1.3);
                        opacity: 0.3;
                    }
                    100% {
                        transform: scale(0.9);
                        opacity: 0.7;
                    }
                }
                /* Utility classes for the custom animations */
                .animate-\[cardiotwinPulse1_2s_infinite\] {
                    animation: cardiotwinPulse1 2s infinite;
                }
                .animate-\[cardiotwinPulse2_2s_infinite\] {
                    animation: cardiotwinPulse2 2s infinite;
                }
            `}</style>
        </div>
    );
};

export default AnalysisDashboard;
