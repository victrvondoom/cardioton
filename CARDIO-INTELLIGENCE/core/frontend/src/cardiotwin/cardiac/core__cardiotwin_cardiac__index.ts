/**
 * CardioTwin Cardiac Components Package
 *
 * Extracted and adapted from heartAI-main project
 * Original License: MIT (Copyright (c) 2025 Ethan Tam)
 *
 * This package provides cardiac-specific visualization and analysis components
 * for the CardioTwin cardiovascular intelligence platform.
 *
 * Components:
 * - ECGViewer: Interactive ECG signal viewer with pan/zoom
 * - ImagingComparison: Side-by-side medical imaging comparison
 * - HeartVisualization: 3D heart model visualization via iframe
 * - AnalysisDashboard: Analysis results with AI explanations and confidence
 * - ImagingUpload: Drag-and-drop CMR file upload with processing workflow
 * - AnalysisResults: Final analysis results display
 *
 * Types:
 * - CMRMarker, Diagnosis, Measurement, Annotation, etc.
 */

// Components
export { ECGViewer } from './ECGViewer';
export { ImagingComparison } from './ImagingComparison';
export { default as HeartVisualization } from './HeartVisualization';
export { default as AnalysisDashboard } from './AnalysisDashboard';
export { default as ImagingUpload } from './ImagingUpload';
export { default as AnalysisResults } from './AnalysisResults';
export { default as FeedbackForm } from './FeedbackForm';

// Types
export type {
    CMRMarkerType,
    CMRMarker,
    Diagnosis,
    Measurement,
    Annotation,
    ECGViewerState,
    CardiologyModality,
    AnalysisStatus,
    ProcessingStep,
} from './core__cardiotwin_cardiac__types';

export type { FeedbackType, FeedbackFormProps } from './FeedbackForm';

// Props types for better TypeScript support
export type { HeartVisualizationProps } from './HeartVisualization';
export type { AnalysisDashboardProps } from './AnalysisDashboard';
export type { ImagingUploadProps } from './ImagingUpload';
export type { AnalysisResultsProps } from './AnalysisResults';

// Constants
export { CARDIAC_CORRECTION_OPTIONS } from './FeedbackForm';
