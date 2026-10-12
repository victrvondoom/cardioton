/**
 * Heart Visualization Component
 *
 * Extracted and adapted from: heartAI-main/web/src/app/components/Heart.tsx
 * Original License: MIT (Copyright (c) 2025 Ethan Tam)
 * Original Author: Ethan Tam
 *
 * Adapted for CardioTwin cardiovascular intelligence platform
 * This component renders 3D heart visualizations in an iframe
 */

import React from 'react';

/**
 * Props for the HeartVisualization component
 */
export interface HeartVisualizationProps {
    /** URL path to the 3D heart visualization */
    path: string;
    /** Optional width (defaults to 100%) */
    width?: string | number;
    /** Optional height (defaults to 600px) */
    height?: string | number;
    /** Optional className for styling */
    className?: string;
}

/**
 * HeartVisualization component
 * Renders an iframe with a 3D heart visualization
 *
 * @example
 * ```tsx
 * <HeartVisualization
 *   path="/visualizations/patient-123.html"
 *   width="100%"
 *   height="800px"
 * />
 * ```
 */
export const HeartVisualization: React.FC<HeartVisualizationProps> = ({
    path,
    width = '100%',
    height = '600px',
    className = '',
}) => {
    return (
        <div className={`cardiotwin-heart-visualization ${className}`}>
            <iframe
                src={path}
                style={{
                    width: width,
                    height: height,
                    border: 'none',
                    background: 'transparent',
                }}
                className="rounded-lg"
                title="3D Heart Visualization"
                aria-label="3D Heart Visualization"
            />
        </div>
    );
};

export default HeartVisualization;
