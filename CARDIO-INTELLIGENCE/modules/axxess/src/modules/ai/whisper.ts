/**
 * MedScribe — Whisper On-Device Transcription
 * Uses whisper.rn (whisper.cpp bindings) for local speech-to-text.
 * Downloads the small GGML model on first use (~466MB, mobile-optimized).
 */
import { initWhisper as initWhisperRN, type WhisperContext } from 'whisper.rn/index';
import * as FileSystem from 'expo-file-system/legacy';

// ─── Config ─────────────────────────────────────────
const MODEL_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin';
const MODEL_FILENAME = 'ggml-small.bin';
const MODEL_DIR = `${FileSystem.documentDirectory}whisper-models/`;
const MODEL_PATH = `${MODEL_DIR}${MODEL_FILENAME}`;

export type WhisperStatus = 'idle' | 'downloading' | 'loading' | 'ready' | 'transcribing' | 'error';

export interface WhisperSegment {
    text: string;
    t0: number;  // start ms
    t1: number;  // end ms
}

export interface WhisperResult {
    segments: WhisperSegment[];
    fullText: string;
    durationMs: number;
}

// ─── State ──────────────────────────────────────────
let whisperCtx: WhisperContext | null = null;
let modelReady = false;

// ─── Model Download ─────────────────────────────────
/**
 * Check if the Whisper model is already downloaded.
 */
export async function isModelDownloaded(): Promise<boolean> {
    try {
        const info = await FileSystem.getInfoAsync(MODEL_PATH);
        return info.exists && !info.isDirectory;
    } catch {
        return false;
    }
}

/**
 * Download the Whisper medium model from HuggingFace.
 * Returns a download resumable that can be paused/cancelled.
 */
export async function downloadModel(
    onProgress?: (downloaded: number, total: number) => void,
): Promise<void> {
    // Ensure directory exists
    const dirInfo = await FileSystem.getInfoAsync(MODEL_DIR);
    if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(MODEL_DIR, { intermediates: true });
    }

    console.log('📥 Downloading Whisper small model...');

    const downloadResumable = FileSystem.createDownloadResumable(
        MODEL_URL,
        MODEL_PATH,
        {},
        (progress) => {
            if (onProgress) {
                onProgress(
                    progress.totalBytesWritten,
                    progress.totalBytesExpectedToWrite,
                );
            }
        },
    );

    const result = await downloadResumable.downloadAsync();
    if (!result || !result.uri) {
        throw new Error('Model download failed');
    }

    console.log('✅ Whisper model downloaded:', result.uri);
}

// ─── Initialize ─────────────────────────────────────
/**
 * Initialize the Whisper context with the downloaded model.
 * Must be called after downloadModel() completes.
 */
export async function initializeWhisper(): Promise<void> {
    if (whisperCtx) return; // Already initialized

    const downloaded = await isModelDownloaded();
    if (!downloaded) {
        throw new Error('Whisper model not downloaded yet. Call downloadModel() first.');
    }

    console.log('🔄 Loading Whisper small model...');
    whisperCtx = await initWhisperRN({
        filePath: MODEL_PATH,
    });

    modelReady = true;
    console.log('✅ Whisper model loaded and ready');
}

// ─── Transcribe ─────────────────────────────────────
/**
 * Transcribe an audio file using the loaded Whisper model.
 * Uses auto language detection to handle mixed/partial language scenarios.
 * Always translates to English for consistency with Gemini pipeline.
 * @param audioUri - file:// URI to the audio file (WAV preferred)
 * @param _language - unused, kept for API compat (Whisper auto-detects)
 */
export async function transcribeWithWhisper(
    audioUri: string,
    _language: string = 'en',
): Promise<WhisperResult> {
    if (!whisperCtx || !modelReady) {
        throw new Error('Whisper not initialized. Call initializeWhisper() first.');
    }

    const startTime = Date.now();

    console.log('🎤 Whisper transcribing (auto-detect language):', audioUri);

    const { promise } = whisperCtx.transcribe(audioUri, {
        language: 'auto',    // Auto-detect: handles mixed/partial/multilingual audio
        maxLen: 0,           // no max length per segment
        translate: true,     // Always translate to English for FL comparison with Gemini
        onProgress: (progress: number) => {
            console.log(`  Whisper progress: ${Math.round(progress)}%`);
        },
    });

    const result = await promise;

    const durationMs = Date.now() - startTime;
    const detectedLang = result.language || 'unknown';
    const segments: WhisperSegment[] = (result.segments || []).map((s: any) => ({
        text: s.text?.trim() || '',
        t0: s.t0 || 0,
        t1: s.t1 || 0,
    }));

    const fullText = segments.map(s => s.text).join(' ').trim();

    console.log(`✅ Whisper done in ${durationMs}ms: ${segments.length} segs, detected lang: ${detectedLang}`);

    return { segments, fullText, durationMs };
}

// ─── Cleanup ────────────────────────────────────────
export async function releaseWhisper(): Promise<void> {
    if (whisperCtx) {
        await whisperCtx.release();
        whisperCtx = null;
        modelReady = false;
        console.log('🧹 Whisper context released');
    }
}

// ─── Status ─────────────────────────────────────────
export function isWhisperReady(): boolean {
    return modelReady;
}

/**
 * Delete the downloaded model to free space.
 */
export async function deleteModel(): Promise<void> {
    await releaseWhisper();
    try {
        await FileSystem.deleteAsync(MODEL_PATH, { idempotent: true });
    } catch { /* ignore */ }
}
