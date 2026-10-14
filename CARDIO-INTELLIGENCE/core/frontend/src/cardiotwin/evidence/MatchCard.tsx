/**
 * Match Card Component for CardioTwin
 *
 * Extracted and adapted from: case-twin-main/src/components/MatchCard.tsx
 * Original License: MIT (CaseTwin project)
 *
 * This component displays similar cardiovascular case matches with similarity scores.
 */

import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Button } from '../ui/core__cardiotwin_ui__button';
import { CardiacCaseMatch, OutcomeVariant } from './core__cardiotwin_evidence__types';

/**
 * Props for the MatchCard component
 */
export interface MatchCardProps {
    /** The case match to display */
    match: CardiacCaseMatch;
    /** Callback when user clicks to view details */
    onViewDetails: (match: CardiacCaseMatch) => void;
    /** Whether this card is currently selected */
    selected?: boolean;
    /** Whether to show condensed view */
    condensed?: boolean;
}

/**
 * Maps outcome to variant for styling
 */
function getOutcomeVariant(outcome: string): OutcomeVariant {
    switch (outcome.toLowerCase()) {
        case 'improved':
            return 'success';
        case 'deteriorated':
            return 'danger';
        case 'transferred':
            return 'warning';
        default:
            return 'neutral';
    }
}

/**
 * OutcomeBadge component for displaying match outcomes
 */
function OutcomeBadge({ variant, label }: { variant: OutcomeVariant; label: string }) {
    const variantClasses = {
        success: 'bg-green-900/20 text-green-400 border-green-700/50',
        warning: 'bg-yellow-900/20 text-yellow-400 border-yellow-700/50',
        danger: 'bg-red-900/20 text-red-400 border-red-700/50',
        neutral: 'bg-slate-800/20 text-slate-400 border-slate-700/50',
    };

    return (
        <span className={`px-2 py-0.5 rounded-md text-xs font-medium border ${variantClasses[variant]}`}>
            {label}
        </span>
    );
}

/**
 * MatchCard component
 * Displays a cardiovascular case match with similarity score and outcome
 *
 * Features:
 * - Similarity score with visual indicator
 * - Facility and location information
 * - Diagnosis and outcome display
 * - View details button
 * - Condensed and full views
 *
 * @example
 * ```tsx
 * <MatchCard
 *   match={{
 *     id: 'match-1',
 *     facility: 'Mayo Clinic',
 *     country: 'United States',
 *     diagnosis: 'Hypertrophic Cardiomyopathy',
 *     similarity: 94,
 *     outcome: 'Improved',
 *     details: {}
 *   }}
 *   onViewDetails={(match) => console.log('View:', match)}
 * />
 * ```
 */
export const MatchCard: React.FC<MatchCardProps> = ({
    match,
    onViewDetails,
    selected = false,
    condensed = false,
}) => {
    const outcomeVariant = getOutcomeVariant(match.outcome);
    const riskFactors = match.risk_factors ?? [];
    const similarityColor = match.similarity >= 90
        ? 'text-orange-500'
        : match.similarity >= 75
            ? 'text-yellow-500'
            : 'text-slate-400';

    if (condensed) {
        return (
            <article
                className={`cardiotwin-match-card flex flex-col gap-3 p-4 transition-all hover:bg-slate-800/30 cursor-pointer overflow-hidden group shrink-0 rounded-xl border-2 ${
                    selected
                        ? "border-l-4 border-l-orange-500 bg-slate-800/40"
                        : "border-l-4 border-l-transparent border-slate-700/50"
                }`}
                role="button"
                tabIndex={0}
                aria-pressed={selected}
                onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onViewDetails(match);
                    }
                }}
                onClick={() => onViewDetails(match)}
            >
                <div className="flex items-start justify-between gap-2">
                    {/* Similarity score ring */}
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-3 bg-slate-800/30 ${match.similarity >= 90 ? 'border-orange-500' : 'border-slate-600'}`}>
                        <span className={`text-lg font-semibold ${similarityColor}`}>{match.similarity}%</span>
                    </div>

                    <div className="flex-1 min-w-0 flex justify-end">
                        <OutcomeBadge variant={outcomeVariant} label={match.outcome} />
                    </div>
                </div>

                <div className="space-y-1.5 min-w-0">
                    <h3 className="font-semibold text-slate-200 text-lg leading-snug line-clamp-2 group-hover:text-orange-500 transition-colors break-words">
                        {match.diagnosis}
                    </h3>
                    <p className="text-sm leading-relaxed text-slate-500 line-clamp-2 break-words">
                        {match.details?.description || Object.values(match.details)[0] || 'No additional details'}
                    </p>

                    {/* Cardiovascular-specific tags */}
                    {riskFactors.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                            {riskFactors.slice(0, 2).map((rf, i) => (
                                <span key={i} className="text-xs px-2 py-0.5 rounded-sm bg-slate-700/50 text-slate-400 border border-slate-600/50 truncate max-w-[100px]">
                                    {rf}
                                </span>
                            ))}
                            {riskFactors.length > 2 && (
                                <span className="text-xs px-2 py-0.5 rounded-sm bg-slate-700/20 text-slate-500">
                                    +{riskFactors.length - 2}
                                </span>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap text-xs font-medium text-slate-500 uppercase tracking-wider mt-1 gap-x-2 gap-y-1">
                    <span className="truncate max-w-[120px]">{match.facility}</span>
                    {match.country && <span>• {match.country}</span>}
                    {match.age && <span>• {match.age}y</span>}
                    {match.gender && <span>• {match.gender}</span>}
                </div>
            </article>
        );
    }

    // Full card view
    return (
        <article
            className={`cardiotwin-match-card flex flex-col gap-4 p-5 lg:h-[140px] lg:flex-row lg:items-center hover:bg-slate-800/20 transition-all cursor-pointer group shrink-0 rounded-xl border-2 ${
                selected ? "border-l-3 border-l-orange-500 bg-slate-800/30" : "border-slate-700/50"
            }`}
            onClick={() => onViewDetails(match)}
        >
            {/* Similarity score ring */}
            <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-3 bg-slate-800/30 transition-colors group-hover:border-orange-500 ${match.similarity >= 90 ? 'border-orange-500' : 'border-slate-600'}`}>
                <span className={`text-xl font-semibold leading-6 ${similarityColor}`}>{match.similarity}%</span>
            </div>

            {/* Main content */}
            <div className="min-w-0 flex-1 space-y-1.5 pr-4 py-1">
                <p className="text-xl font-semibold leading-5 text-slate-200 group-hover:text-orange-500 transition-colors line-clamp-2 break-words">
                    {match.diagnosis}
                </p>
                <p className="text-sm leading-5 text-slate-500 line-clamp-2 break-words">
                    {match.details?.description || Object.values(match.details)[0] || 'No additional details'}
                </p>

                {/* Cardiovascular-specific tags */}
                {riskFactors.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                        {riskFactors.slice(0, 3).map((rf, idx) => (
                            <span
                                key={idx}
                                className="text-xs px-2 py-0.5 bg-slate-700/50 text-slate-400 rounded-md border border-slate-600/50 truncate max-w-[150px]"
                            >
                                {rf}
                            </span>
                        ))}
                    </div>
                )}

                <div className="flex flex-wrap text-xs text-slate-500 gap-x-3 gap-y-1 mt-2 font-medium">
                    {match.age && (
                        <span className="flex items-center gap-1">
                            <span className="text-slate-600">Age:</span> {match.age}y
                        </span>
                    )}
                    {match.gender && <span>• {match.gender}</span>}
                </div>
            </div>

            {/* Right column */}
            <div className="flex shrink-0 flex-col gap-2 lg:items-end">
                <p className="text-sm font-medium text-slate-400 tracking-wide uppercase">
                    {match.facility}
                </p>
                {match.country && (
                    <p className="text-xs text-slate-600">{match.country}</p>
                )}
                <OutcomeBadge variant={outcomeVariant} label={match.outcome} />
            </div>

            {/* View details button (optional) */}
            {onViewDetails && !condensed && (
                <div className="flex items-center justify-end">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                            e.stopPropagation();
                            onViewDetails(match);
                        }}
                        className="text-slate-400 hover:text-orange-500 hover:bg-slate-700/50 transition-colors gap-1"
                    >
                        View details
                        <ArrowUpRight className="h-3.5 w-3.5" />
                    </Button>
                </div>
            )}
        </article>
    );
};

export default MatchCard;
