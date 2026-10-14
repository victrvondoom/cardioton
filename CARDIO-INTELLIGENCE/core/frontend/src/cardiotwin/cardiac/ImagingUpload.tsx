/**
 * Imaging Upload Component
 *
 * Extracted and adapted from: heartAI-main/web/src/app/upload/page.tsx
 * Original License: MIT (Copyright (c) 2025 Ethan Tam)
 * Original Author: Ethan Tam
 *
 * Adapted for CardioTwin cardiovascular intelligence platform
 * This component handles CMR (Cardiovascular Magnetic Resonance) file uploads
 * and triggers cardiac analysis workflows
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { authHeader } from '../../lib/core__src_lib__auth';
import { useDropzone } from 'react-dropzone';
import { Diagnosis, AnalysisStatus, ProcessingStep } from './core__cardiotwin_cardiac__types';

/**
 * Props for the ImagingUpload component
 */
export interface ImagingUploadProps {
    /** Callback when upload is complete with diagnosis */
    onUploadComplete?: (diagnosis: Diagnosis) => void;
    /** Receives the actual embedding response; this endpoint does not diagnose. */
    onStudyProcessed?: (study: ImagingStudyResult) => void;
    /** Callback for status changes */
    onStatusChange?: (status: AnalysisStatus) => void;
    /** Callback for step changes */
    onStepChange?: (step: ProcessingStep) => void;
    /** Base API URL (defaults to CardioTwin backend) */
    apiBaseUrl?: string;
    /** Accepted file types (defaults to .nii and .nii.gz) */
    acceptedFileTypes?: string[];
    /** Maximum file size in bytes (defaults to 100MB) */
    maxFileSize?: number;
}

/**
 * Analysis state for tracking upload and processing progress
 */
export interface ImagingStudyResult {
    study_id: string;
    embedding_dim: number | null;
    modality: string;
    status: string;
    processing_time_ms: number;
    message: string;
}

interface AnalysisState {
    study?: ImagingStudyResult;
    status: AnalysisStatus;
    currentStep: ProcessingStep | '';
    files: File[];
    diagnosis: Diagnosis | null;
    suggestionText?: string;
    suggestionLinks?: string[];
    error?: string;
}

/**
 * ImagingUpload component
 * Handles CMR file uploads with drag-and-drop interface
 * Shows progress through upload, processing, and analysis steps
 *
 * Features:
 * - Drag and drop file upload
 * - Multi-step processing visualization
 * - Error handling
 * - File type validation
 *
 * @example
 * ```tsx
 * <ImagingUpload
 *   onUploadComplete={(diagnosis) => console.log('Analysis complete:', diagnosis)}
 *   apiBaseUrl="http://localhost:8000"
 * />
 * ```
 */
export const ImagingUpload: React.FC<ImagingUploadProps> = ({
    onUploadComplete,
    onStudyProcessed,
    onStatusChange,
    onStepChange,
    apiBaseUrl = '/api/v1/cardiotwin',
    acceptedFileTypes = ['application/nii', '.nii', '.nii.gz'],
    maxFileSize = 100 * 1024 * 1024, // 100MB
}) => {
    const [analysisState, setAnalysisState] = useState<AnalysisState>({
        status: 'idle',
        currentStep: '',
        files: [],
        diagnosis: null,
    });

    const requestRef = useRef<AbortController | null>(null);
    useEffect(() => () => requestRef.current?.abort(), []);

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        const file = acceptedFiles[0];
        if (!file) return;
        if (!/\.nii(?:\.gz)?$/i.test(file.name)) {
            setAnalysisState(prev => ({ ...prev, status: 'failed', error: 'Only .nii and .nii.gz files are supported' }));
            return;
        }
        requestRef.current?.abort();
        const controller = new AbortController();
        requestRef.current = controller;
        setAnalysisState({ status: 'processing', currentStep: 'embeddings', files: [file], diagnosis: null });
        onStatusChange?.('processing');
        onStepChange?.('embeddings');
        const payload = new FormData();
        payload.append('file', file);
        payload.append('modality', 'CMR');
        try {
            const response = await fetch(`${apiBaseUrl}/imaging/upload`, {
                method: 'POST', headers: authHeader(), body: payload, signal: controller.signal,
            });
            const data = await response.json() as Partial<ImagingStudyResult> & { detail?: unknown; error?: string };
            if (!response.ok) {
                throw new Error(typeof data.detail === 'string' ? data.detail : `Imaging service returned HTTP ${response.status}. Check that imaging processing is configured.`);
            }
            if (data.error || data.status !== 'processed' || typeof data.study_id !== 'string' || typeof data.message !== 'string') {
                throw new Error(data.error || 'The imaging service returned an incomplete processing result.');
            }
            if (controller.signal.aborted) return;
            const study: ImagingStudyResult = {
                study_id: data.study_id, status: data.status, message: data.message,
                embedding_dim: data.embedding_dim ?? null, modality: data.modality ?? 'CMR',
                processing_time_ms: data.processing_time_ms ?? 0,
            };
            setAnalysisState({ status: 'complete', currentStep: '', files: [file], diagnosis: null, study });
            onStatusChange?.('complete');
            onStudyProcessed?.(study);
        } catch (error) {
            if (controller.signal.aborted) return;
            setAnalysisState(prev => ({ ...prev, status: 'failed', currentStep: '', error: error instanceof Error ? error.message : 'Imaging request failed' }));
            onStatusChange?.('failed');
        } finally {
            if (requestRef.current === controller) requestRef.current = null;
        }
    }, [apiBaseUrl, onStatusChange, onStepChange, onStudyProcessed]);

    /**
     * Dropzone configuration
     */
    const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
        accept: { 'application/octet-stream': acceptedFileTypes.filter(type => type.startsWith('.')) },
        disabled: analysisState.status === 'processing' || analysisState.status === 'uploading',
        maxFiles: 1,
        maxSize: maxFileSize,
        onDrop,
    });

    /**
     * Handles the view results action
     */
    const handleViewResults = useCallback(() => {
        if (!analysisState.diagnosis) return;
        onUploadComplete?.(analysisState.diagnosis);
    }, [analysisState.diagnosis, onUploadComplete]);

    /**
     * Resets the upload state
     */
    const handleReset = useCallback(() => {
        requestRef.current?.abort();
        onStatusChange?.('idle');
        setAnalysisState({
            status: 'idle',
            currentStep: '',
            files: [],
            diagnosis: null,
            error: undefined,
        });
    }, [onStatusChange]);

    /**
     * Gets the status message based on current state
     */
    const getStatusMessage = useCallback((): string => {
        if (analysisState.error) {
            return analysisState.error;
        }

        switch (analysisState.status) {
            case 'uploading':
                return 'Uploading your file...';
            case 'processing':
                return `Processing... (Step: ${analysisState.currentStep})`;
            case 'complete':
                return 'Imaging processing complete';
            case 'failed':
                return 'Upload failed. Please try again.';
            default:
                return 'Drag & drop your CMR (.nii) file here, or click to select';
        }
    }, [analysisState]);

    return (
        <div className="cardiotwin-imaging-upload flex items-center justify-center min-h-screen w-full p-4">
            <div className="max-w-4xl mx-auto w-full space-y-8">
                {/* Header */}
                <h1 className="text-3xl font-bold text-slate-200 text-center">
                    Upload Cardiovascular Magnetic Resonance (CMR)
                </h1>

                {/* File Rejection Errors */}
                {fileRejections.length > 0 && (
                    <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-4 text-red-400 text-sm">
                        {fileRejections[0].errors[0].message}
                    </div>
                )}

                {/* Main Upload Area */}
                <div
                    {...getRootProps()}
                    className={`flex flex-col items-center justify-center p-10 border-4 border-dashed rounded-xl cursor-pointer transition-all duration-300 ${
                        isDragActive
                            ? 'border-orange-500 bg-orange-900/20'
                            : analysisState.status === 'idle'
                                ? 'border-slate-600 bg-slate-900/30 hover:border-orange-500 hover:bg-slate-800/50'
                                : 'border-slate-700 bg-slate-900/50'
                    }`}
                >
                    <input {...getInputProps()} />

                    {/* Status Content */}
                    <div className="text-center space-y-4">
                        {analysisState.status === 'idle' && (
                            <>
                                <div className="text-6xl text-orange-500/20">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-full h-full">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                                    </svg>
                                </div>
                                <p className="text-lg text-slate-400">
                                    {getStatusMessage()}
                                </p>
                            </>
                        )}

                        {analysisState.status === 'uploading' && (
                            <div className="flex items-center gap-3 text-orange-500">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                                <p className="text-slate-300">{getStatusMessage()}</p>
                            </div>
                        )}

                        {analysisState.status === 'processing' && (
                            <div className="text-center space-y-2">
                                <p className="text-slate-300">{getStatusMessage()}</p>
                                <p className="text-xs text-slate-400">Waiting for the imaging service. Keep this page open or cancel below.</p>
                            </div>
                        )}

                        {analysisState.status === 'complete' && analysisState.study && (
                            <div className="bg-slate-800/50 rounded-lg p-6 text-center space-y-4">
                                <div className="text-6xl text-green-500/50">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-full h-full">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <h2 className="text-xl font-semibold text-green-500">
                                    {getStatusMessage()}
                                </h2>
                                <p className="text-slate-300">{analysisState.study.message}</p>
                                <p className="text-sm text-slate-400">{analysisState.study.embedding_dim ?? 'Unknown'} embedding dimensions ? {Math.round(analysisState.study.processing_time_ms)} ms</p>
                                <p className="text-sm text-slate-400">An embedding is a processing result. No diagnostic assessment or saved patient record is produced by this upload.</p>
                                {analysisState.diagnosis && <button onClick={handleViewResults}>View results</button>}
                            </div>
                        )}

                        {analysisState.status === 'failed' && (
                            <div className="text-center space-y-4">
                                <div className="text-6xl text-red-500/50">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-full h-full">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008h3.75c.31 0 .594-.055.847-.164a1.012 1.012 0 00.534-.534A10.96 10.96 0 0016.5 9.75" />
                                    </svg>
                                </div>
                                <p className="text-red-400">{getStatusMessage()}</p>
                                <button
                                    onClick={handleReset}
                                    className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-3 rounded-lg transition-colors mx-auto"
                                >
                                    Try Again
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* File Info */}
                {analysisState.files.length > 0 && analysisState.status !== 'complete' && analysisState.status !== 'failed' && (
                    <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/50">
                        <p className="text-sm text-slate-400">
                            File: <span className="text-orange-500">{analysisState.files[0].name}</span>
                            <span className="text-slate-600"> ({Math.round(analysisState.files[0].size / 1024 / 1024)} MB)</span>
                        </p>
                    </div>
                )}

                {/* Footer */}
                <div className="pt-6 border-t border-slate-700/50 flex justify-between items-center">
                    <button
                        onClick={handleReset}
                        disabled={analysisState.status === 'idle'}
                        className="text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0011.667 0l3.181-3.183m-4.991-2.696a4.125 4.125 0 01-5.832 0M3 16.5v-4.5m18 4.5v-4.5" />
                        </svg>
                        {analysisState.status === 'processing' ? 'Cancel upload' : 'Reset'}
                    </button>
                    <span className="text-xs text-slate-600">
                        Supports: .nii, .nii.gz files
                    </span>
                </div>
            </div>
        </div>
    );
};

export default ImagingUpload;
