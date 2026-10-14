/**
 * Type Definitions for Cardiac Components
 *
 * Extracted and adapted from: heartAI-main/web/types/cmr.ts
 * Original License: MIT (Copyright (c) 2025 Ethan Tam)
 *
 * These types support the ECG viewer, comparison viewer, and other cardiac components.
 */

/**
 * Marker type for ECG annotations
 */
export type CMRMarkerType = 'st-elevation' | 'q-wave' | 'arrhythmia';

/**
 * Marker object for ECG annotations
 * Defines a rectangular region with position, size, label, and type
 */
export interface CMRMarker {
    /** X position as percentage of container width */
    x: number;
    /** Y position as percentage of container height */
    y: number;
    /** Width as percentage of container width */
    width: number;
    /** Height as percentage of container height */
    height: number;
    /** Display label for the marker */
    label: string;
    /** Type of clinical finding */
    type: CMRMarkerType;
}

/**
 * Diagnosis object for cardiac analysis results
 */
export interface Diagnosis {
    /** List of diagnostic labels */
    labels: string[];
    /** URL of the primary image */
    imageUrl: string;
    /** Confidence score (0-1) */
    confidence: number;
    /** Detailed explanation */
    explanation: string;
    /** Severity level */
    severity: string;
    /** List of suggestion links/citations */
    suggestionLinks: string[];
    /** Path to 3D visualization or other resource */
    path: string;
}

/**
 * Measurement object for ECG analysis
 */
export interface Measurement {
    /** Start point of measurement */
    start: { x: number; y: number };
    /** End point of measurement */
    end: { x: number; y: number };
    /** Distance in pixels */
    distancePx: number;
    /** Distance in milliseconds (for time-based measurements) */
    distanceMs: number;
}

/**
 * Annotation object for ECG markings
 */
export interface Annotation {
    /** X position in container */
    x: number;
    /** Y position in container */
    y: number;
    /** Annotation text */
    text: string;
}

/**
 * ECG viewer state for controlled components
 */
export interface ECGViewerState {
    /** Current scale (1 = 100%) */
    scale: number;
    /** Current position offset */
    position: { x: number; y: number };
    /** Whether currently dragging */
    isDragging: boolean;
}

/**
 * Cardiology-specific modality types
 */
export type CardiologyModality = 'ECG' | 'Echocardiography' | 'CMR' | 'CT' | 'Coronary Angiography';

/**
 * Status of analysis or processing
 */
export type AnalysisStatus = 'idle' | 'uploading' | 'processing' | 'complete' | 'failed';

/**
 * Processing step for multi-stage analysis
 */
export type ProcessingStep = 'embeddings' | 'retrieval' | 'explanation' | 'validation';
