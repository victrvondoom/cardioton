/**
 * Upload Dropzone Component for CardioTwin
 *
 * Extracted and adapted from: case-twin-main/src/components/UploadDropzone.tsx
 * Original License: MIT (CaseTwin project)
 *
 * This component provides drag-and-drop file upload functionality
 * for medical imaging files in cardiovascular workflows.
 */

import React, { useState, useCallback } from 'react';
import { FileImage, Upload, X } from 'lucide-react';

/** File-like object for representing uploaded files */
export interface FileLike {
    name: string;
    size: number;
}

/** Props for the UploadDropzone component */
export interface UploadDropzoneProps {
    /** Currently selected file */
    value: FileLike | null;
    /** Callback when file changes */
    onChange: (file: FileLike | null) => void;
    /** Accepted file types (default: DICOM, JPG, JPEG, PNG) */
    acceptedTypes?: string[];
    /** Maximum file size in bytes */
    maxFileSize?: number;
    /** Optional label text */
    label?: string;
    /** Optional subtitle text */
    subtitle?: string;
}

/** Default accepted cardiovascular imaging file types */
const DEFAULT_ACCEPTED_TYPES = ['.dcm', '.jpg', '.jpeg', '.png', '.nii', '.nii.gz'];

/**
 * UploadDropzone component
 * Provides drag-and-drop interface for medical imaging file uploads
 *
 * Features:
 * - Drag and drop support
 * - Click to browse files
 * - File preview with size
 * - Remove file option
 * - Cardiovascular-specific file type support
 *
 * @example
 * ```tsx
 * const [file, setFile] = useState<FileLike | null>(null);
 *
 * <UploadDropzone
 *   value={file}
 *   onChange={setFile}
 *   label="Upload Cardiac Imaging"
 *   subtitle="DICOM, JPG, JPEG, PNG, NIfTI files"
 * />
 * ```
 */
export const UploadDropzone: React.FC<UploadDropzoneProps> = ({
    value,
    onChange,
    acceptedTypes = DEFAULT_ACCEPTED_TYPES,
    maxFileSize,
    label = 'Drop imaging files to create a case',
    subtitle = `Accepted: ${acceptedTypes.join(', ')}`,
}) => {
    const [dragActive, setDragActive] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /** Handle native file selection */
    const handleNativeFile = useCallback((file: File) => {
        // Validate file type
        const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
        const isAccepted = acceptedTypes.some(ext =>
            file.name.toLowerCase().endsWith(ext.toLowerCase())
        );

        if (!isAccepted) {
            setError(`Unsupported file type: ${fileExtension || file.type}`);
            return;
        }

        // Validate file size
        if (maxFileSize && file.size > maxFileSize) {
            setError(`File too large: ${(file.size / 1024 / 1024).toFixed(1)} MB (max ${maxFileSize / 1024 / 1024} MB)`);
            return;
        }

        // Clear any previous error
        setError(null);

        // Notify parent of new file
        onChange({ name: file.name, size: file.size });
    }, [acceptedTypes, maxFileSize, onChange]);

    /** Handle drag drop */
    const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setDragActive(false);
        setError(null);

        const file = event.dataTransfer.files?.[0];
        if (file) {
            handleNativeFile(file);
        }
    }, [handleNativeFile]);

    /** Handle drag over */
    const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setDragActive(true);
    }, []);

    /** Handle drag leave */
    const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setDragActive(false);
    }, []);

    /** Handle file removal */
    const handleRemove = useCallback(() => {
        onChange(null);
        setError(null);
    }, [onChange]);

    /** Format file size in human-readable format */
    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    };

    return (
        <div className="cardiotwin-upload-dropzone space-y-3">
            {/* Main dropzone area */}
            <div
                onDragEnter={handleDragOver}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className={`relative overflow-hidden rounded-2xl border-4 border-dashed transition-all duration-300 p-7 text-center ${
                    dragActive
                        ? "border-orange-500 bg-orange-900/10 backdrop-blur-sm shadow-lg shadow-orange-500/20"
                        : "border-slate-600/50 bg-slate-900/20 hover:border-orange-500/30 hover:bg-slate-800/30"
                }`}
            >
                {/* Top accent line */}
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-orange-500/30 to-transparent" />

                {/* Upload icon and text */}
                <Upload className="mx-auto mb-2 h-6 w-6 text-orange-500" />
                <p className="text-sm font-semibold text-slate-200">{label}</p>
                <p className="mt-1 text-xs text-slate-500">{subtitle}</p>

                {/* Browse button */}
                <label className="mt-4 inline-block cursor-pointer rounded-xl border border-slate-600/50 bg-slate-800/50 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700/50 hover:border-orange-500/30 transition-all duration-300">
                    Browse files
                    <input
                        type="file"
                        accept={acceptedTypes.map(ext => ext.startsWith('.') ? ext : `.${ext}`).join(',')}
                        className="hidden"
                        onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) {
                                handleNativeFile(file);
                            }
                        }}
                    />
                </label>
            </div>

            {/* Error message */}
            {error && (
                <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-3 text-red-400 text-sm">
                    {error}
                </div>
            )}

            {/* Selected file display */}
            {value && !error && (
                <div className="flex items-center justify-between rounded-xl border border-slate-600/50 bg-slate-800/30 px-4 py-3">
                    <div className="flex items-center gap-3">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-700/50 border border-slate-600/50 text-orange-500">
                            <FileImage className="h-5 w-5" />
                        </span>
                        <div>
                            <p className="text-sm font-medium text-slate-200">{value.name}</p>
                            <p className="text-xs text-slate-500">{formatFileSize(value.size)}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleRemove}
                        className="text-slate-500 hover:text-red-400 transition-colors flex items-center gap-1"
                        aria-label="Remove file"
                    >
                        <X className="h-4 w-4" />
                        <span className="text-xs">Remove</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default UploadDropzone;
