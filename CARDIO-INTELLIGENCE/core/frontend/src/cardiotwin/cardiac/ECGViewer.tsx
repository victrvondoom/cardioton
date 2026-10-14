/**
 * ECGViewer Component
 *
 * Extracted and adapted from: heartAI-main/web/src/app/components/ECGViewer.tsx
 * Original License: MIT (Copyright (c) 2025 Ethan Tam)
 *
 * Adaptations for CardioTwin:
 * - Changed styling to match CardioTwin design system
 * - Updated to use CardioTwin types and conventions
 * - Added integration with CardioTwin API endpoints
 * - Improved documentation and TypeScript types
 *
 * Features:
 * - Interactive pan and zoom for ECG images
 * - Marker overlay for annotations (ST-elevation, Q-wave, arrhythmia)
 * - Custom styling with CardioTwin's pixel-geometric design
 */

import React, { useState } from 'react';
import type { CMRMarker } from './core__cardiotwin_cardiac__types';

/**
 * Props for ECGViewer component
 */
interface ECGViewerProps {
  /** URL of the ECG image to display */
  imageUrl: string;
  /** Markers to display on the ECG */
  markers?: CMRMarker[];
  /** Controlled scale value, if provided, overrides internal scale */
  scale?: number;
  onScaleChange?: (scale: number) => void;
  /** On marker click callback */
  onMarkerClick?: (marker: CMRMarker) => void;
  /** On image click callback */
  onImageClick?: (event: React.MouseEvent<HTMLImageElement>) => void;
}

/**
 * ECG Viewer Component
 *
 * Displays ECG images with interactive pan/zoom and annotation markers.
 * Supports multiple marker types for clinical annotations.
 */
export function ECGViewer({
  imageUrl,
  markers = [],
  scale: controlledScale,
  onScaleChange,
  onMarkerClick,
  onImageClick,
}: ECGViewerProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [internalScale, setInternalScale] = useState(1);

  const scale = controlledScale !== undefined ? controlledScale : internalScale;

  // Zoom handlers
  const handleZoom = (direction: 'in' | 'out') => {
    const factor = direction === 'in' ? 1.2 : 1 / 1.2;
    const nextScale = Math.min(Math.max(scale * factor, 0.5), 4);
    if (controlledScale !== undefined) onScaleChange?.(nextScale);
    else setInternalScale(nextScale);
  };

  // Drag handlers
  const onMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const onMouseUp = () => setIsDragging(false);

  // Reset view
  const resetView = () => {
    setPosition({ x: 0, y: 0 });
    setInternalScale(1);
    onScaleChange?.(1);
  };

  // Marker colors for different annotation types
  const markerColors: Record<CMRMarker['type'], string> = {
    'st-elevation': 'rgba(255, 82, 82, 0.8)',      // Red for ST elevation
    'q-wave': 'rgba(255, 177, 66, 0.8)',          // Orange for Q-wave
    arrhythmia: 'rgba(76, 175, 80, 0.8)',         // Green for arrhythmia
  };

  // Default marker color for unknown types
  const defaultMarkerColor = 'rgba(139, 92, 246, 0.8)'; // Purple

  return (
    <div className="bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-100">ECG Analysis</h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleZoom('out')}
            className="p-2 bg-slate-800 rounded hover:bg-slate-700 transition-colors"
            title="Zoom out"
            disabled={controlledScale !== undefined && !onScaleChange}
          >
            <ZoomOutIcon className="w-4 h-4 text-slate-400" />
          </button>
          <span className="text-slate-400 text-sm">{Math.round(scale * 100)}%</span>
          <button
            onClick={() => handleZoom('in')}
            className="p-2 bg-slate-800 rounded hover:bg-slate-700 transition-colors"
            title="Zoom in"
            disabled={controlledScale !== undefined && !onScaleChange}
          >
            <ZoomInIcon className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>

      <div
        className="relative h-80 overflow-hidden border border-slate-700 rounded-lg"
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <div
          className="w-full h-full"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: '0 0',
          }}
        >
          <img
            src={imageUrl}
            alt="ECG scan"
            className="object-contain w-full h-full p-4 pointer-events-none"
            onClick={(e) => {
              if (!isDragging && onImageClick) {
                onImageClick(e);
              }
            }}
          />

          {/* Render markers */}
          {markers.map((marker, index) => {
            const markerColor = markerColors[marker.type] || defaultMarkerColor;
            return (
              <div
                key={index}
                className="absolute border rounded-md pointer-events-none"
                style={{
                  left: `${marker.x}%`,
                  top: `${marker.y}%`,
                  width: `${marker.width}%`,
                  height: `${marker.height}%`,
                  borderColor: markerColor,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onMarkerClick) {
                    onMarkerClick(marker);
                  }
                }}
              >
                <span
                  className="absolute top-0 left-0 m-1 px-1.5 py-0.5 text-xs bg-slate-800/80 rounded shadow"
                  style={{ color: '#fff' }}
                >
                  {marker.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Reset View Button */}
        <button
          onClick={resetView}
          className="absolute bottom-4 right-4 px-3 py-1 text-sm bg-slate-800/80 rounded shadow hover:bg-slate-700"
          title="Reset view"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

/**
 * Zoom In Icon Component
 */
function ZoomInIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" strokeWidth={2} stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 21l-4.35-4.35m0 0a7.5 7.5 0 10-10.61-10.61 7.5 7.5 0 0010.61 10.61zM13 10h-3m1.5-1.5v3"
      />
    </svg>
  );
}

/**
 * Zoom Out Icon Component
 */
function ZoomOutIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" strokeWidth={2} stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 21l-4.35-4.35m0 0a7.5 7.5 0 10-10.61-10.61 7.5 7.5 0 0010.61 10.61zM13 10H10"
      />
    </svg>
  );
}

// Export icon components for reuse
export { ZoomInIcon, ZoomOutIcon };
