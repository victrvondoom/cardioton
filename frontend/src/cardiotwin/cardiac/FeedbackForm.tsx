/**
 * Feedback Form Component
 *
 * Extracted and adapted from: heartAI-main/web/src/app/components/FeedbackForm.tsx
 * Original License: MIT (Copyright (c) 2025 Ethan Tam)
 * Original Author: Ethan Tam
 *
 * Adapted for CardioTwin cardiovascular intelligence platform
 * This component allows clinicians to provide feedback on cardiac diagnosis
 */

import React, { useState } from 'react';

/**
 * Type of feedback for cardiac diagnosis
 */
export type FeedbackType = 'confirm' | 'correct' | null;

/**
 * Cardiac diagnosis correction options
 * These are specific to congenital heart disease and cardiac conditions
 */
export const CARDIAC_CORRECTION_OPTIONS = [
    'Congenital Heart Defect',
    'Ventricular Septal Defect',
    'Atrial Septal Defect',
    'Double Outlet Right Ventricle',
    'D-Loop Transposition of the Great Arteries',
    'L-Loop Transposition of the Great Arteries',
    'Single Ventricle Defect',
    'Double Inlet Left Ventricle',
    'Double Inlet Double Outlet Right Ventricle',
    'Common Atrium',
    'Superoinferior Ventricles',
    'Pulmonary Atresia',
    'Aortic-Pulmonary Anastomosis',
    'Mild Dilation',
    'Moderate Dilation',
    'Severe Dilation',
    'Tortuous Vessels',
    'Bilateral SVC',
    'Left Central IVC',
    'Left Central SVC',
    'Dextrocardia',
    'Mesocardia',
    'Inverted Ventricles',
    'Inverted Atria',
    'Heterotaxy Syndrome',
    'Marfan Syndrome',
    'CMR Artifact AO',
    'CMR Artifact PA',
] as const;

/**
 * Props for the FeedbackForm component
 */
export interface FeedbackFormProps {
    /** Callback when feedback is submitted */
    onSubmit?: (feedbackType: FeedbackType, comment: string, correction?: string) => void;
    /** Whether to show the component in a compact mode */
    compact?: boolean;
}

/**
 * FeedbackForm component
 * Allows clinicians to confirm or correct cardiac diagnosis
 *
 * Features:
 * - Confirm diagnosis option
 * - Suggest correction with cardiac-specific options
 * - Additional comments field
 * - Submit button
 *
 * @example
 * ```tsx
 * <FeedbackForm
 *   onSubmit={(type, comment, correction) => console.log({ type, comment, correction })}
 * />
 * ```
 */
export const FeedbackForm: React.FC<FeedbackFormProps> = ({
    onSubmit,
    compact = false,
}) => {
    const [feedbackType, setFeedbackType] = useState<FeedbackType>(null);
    const [comment, setComment] = useState('');
    const [correction, setCorrection] = useState<string>('');

    const handleSubmit = () => {
        if (!feedbackType) return;
        onSubmit?.(feedbackType, comment, feedbackType === 'correct' ? correction : undefined);
        // Reset form
        setFeedbackType(null);
        setComment('');
        setCorrection('');
    };

    const isSubmitDisabled = !feedbackType || (feedbackType === 'correct' && !correction);

    return (
        <div className={`cardiotwin-feedback-form ${compact ? 'p-4' : 'p-6'}`}>
            <h2 className={`font-semibold mb-4 ${compact ? 'text-lg' : 'text-xl'} text-slate-200`}>
                Provide Feedback
            </h2>
            <div className="space-y-4">
                {/* Feedback Type Selection */}
                <div className="flex gap-4">
                    <button
                        onClick={() => {
                            setFeedbackType('confirm');
                            setCorrection('');
                        }}
                        className={`flex-1 p-3 rounded-lg transition-all duration-300 border ${
                            feedbackType === 'confirm'
                                ? 'bg-green-900/30 border-green-500 text-green-400'
                                : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-700/50 text-slate-400 hover:text-slate-300'
                        }`}
                    >
                        Confirm Diagnosis
                    </button>
                    <button
                        onClick={() => {
                            setFeedbackType('correct');
                            setCorrection('');
                        }}
                        className={`flex-1 p-3 rounded-lg transition-all duration-300 border ${
                            feedbackType === 'correct'
                                ? 'bg-red-900/30 border-red-500 text-red-400'
                                : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-700/50 text-slate-400 hover:text-slate-300'
                        }`}
                    >
                        Suggest Correction
                    </button>
                </div>

                {/* Correction Selection (only shown when suggesting correction) */}
                {feedbackType === 'correct' && (
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-400">
                            Suggested Correction
                        </label>
                        <select
                            className="w-full p-2 border border-slate-600 rounded-lg bg-slate-800/50 focus:outline-none focus:ring-2 focus:ring-orange-500/50 text-slate-200"
                            value={correction}
                            onChange={(e) => setCorrection(e.target.value)}
                        >
                            <option value="" className="text-slate-500">
                                Select a correction...
                            </option>
                            {CARDIAC_CORRECTION_OPTIONS.map((option) => (
                                <option key={option} value={option} className="text-slate-300">
                                    {option}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Additional Comments */}
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-400">
                        Additional Comments
                    </label>
                    <textarea
                        className="w-full h-24 p-2 border border-slate-600 rounded-lg bg-slate-800/50 focus:outline-none focus:ring-2 focus:ring-orange-500/50 text-slate-200 placeholder-slate-500 resize-none"
                        placeholder="Enter any additional observations..."
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                    />
                </div>

                {/* Submit Button */}
                <button
                    onClick={handleSubmit}
                    disabled={isSubmitDisabled}
                    className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white py-2.5 rounded-lg transition-colors duration-300 font-medium"
                >
                    Submit Feedback
                </button>
            </div>
        </div>
    );
};

export default FeedbackForm;
