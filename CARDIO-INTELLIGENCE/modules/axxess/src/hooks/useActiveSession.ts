/**
 * MedScribe — useActiveSession Hook
 * Manages the lifecycle of an active recording session:
 * - Creates session in DB on start
 * - Records audio via expo-speech-recognition (persisted to file)
 * - On end: sends full audio to Gemini for transcription + translation
 * - Shows processing progress
 * - Generates clinical notes from transcript on user proceed
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import {
    ExpoSpeechRecognitionModule,
    useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import * as FileSystem from 'expo-file-system/legacy';
import {
    createSession,
    createUtterance,
    updateSessionStatus,
    upsertNote,
    logAuditEvent,
} from '@/src/modules/db/axxess__modules_db__queries';
import { getSettings } from '@/src/stores/settingsStore';
import {
    transcribeAudio,
    generateClinicalNote,
    translateText,
} from '@/src/modules/ai/gemini';
import type { TranscriptSegment } from '@/src/modules/ai/gemini';
import {
    isModelDownloaded as isWhisperDownloaded,
    isWhisperReady,
    initializeWhisper,
    downloadModel as downloadWhisperModel,
    transcribeWithWhisper,
} from '@/src/modules/ai/whisper';
import type { WhisperResult } from '@/src/modules/ai/whisper';
import { collectTrainingSignal } from '@/src/modules/fl/service';
import type { Session, Specialty, EntityType } from '@/src/types/axxess__src_types__index';

// ─── Types ───────────────────────────────────────────

export type SessionPhase =
    | 'setup'        // Patient info entry
    | 'recording'    // Audio recording in progress
    | 'processing'   // Gemini transcribing audio
    | 'review'       // User reviewing transcript
    | 'generating'   // Generating SOAP note
    | 'complete';    // Note ready

export interface TranscriptEntry {
    id: string;
    speaker: 'DR' | 'PT';
    text: string;                    // Original language
    translatedText: string | null;   // English translation (null if already English)
    sourceLang: string;
    timestamp: string;
    confidence: number;
    entities: { text: string; type: EntityType }[];
    startMs: number;
    endMs: number;
}

interface UseActiveSessionOptions {
    patientName?: string;
    patientLang?: string;
    specialty?: Specialty;
}

function generateId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

export function useActiveSession(options: UseActiveSessionOptions = {}) {
    // ─── State ───────────────────────────────────────────
    const [session, setSession] = useState<Session | null>(null);
    const [phase, setPhase] = useState<SessionPhase>('setup');
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
    const [processingStatus, setProcessingStatus] = useState('');
    const [processingProgress, setProcessingProgress] = useState(0);
    const [clinicalNote, setClinicalNote] = useState<any>(null);
    const [detectedLang, setDetectedLang] = useState('en');
    const [langConfidence, setLangConfidence] = useState(98);

    // Live speech-to-text state
    const [liveText, setLiveText] = useState<Array<{ text: string; translatedText?: string; isFinal: boolean; timestamp: number }>>([]);

    // Whisper dual pipeline state
    const [whisperStatus, setWhisperStatus] = useState<'idle' | 'downloading' | 'initializing' | 'transcribing' | 'done' | 'unavailable'>('idle');
    const [whisperProgress, setWhisperProgress] = useState(0);
    const [whisperResult, setWhisperResult] = useState<WhisperResult | null>(null);
    const [whisperError, setWhisperError] = useState<string | null>(null);

    // ─── Refs ────────────────────────────────────────────
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const sessionRef = useRef<Session | null>(null);
    const runtimeOptionsRef = useRef<UseActiveSessionOptions>({});
    const audioUriRef = useRef<string | null>(null);
    const speechActiveRef = useRef(false);

    // ─── Timer ───────────────────────────────────────────
    useEffect(() => {
        if (isRecording && !isPaused) {
            timerRef.current = setInterval(() => {
                setElapsedSeconds((s) => s + 1);
            }, 1000);
        } else if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isRecording, isPaused]);

    const formatTime = (seconds: number): string => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // ─── Speech Recognition Events (audio recording + live text) ─
    // Capture audio AND display live partial/final transcription text

    useSpeechRecognitionEvent('result', (event) => {
        if (!speechActiveRef.current) return;
        const text = event.results?.[0]?.transcript;
        if (!text) return;
        const isFinal = event.isFinal ?? false;
        const entryTimestamp = Date.now();
        setLiveText((prev) => {
            // Replace last entry if it was interim, otherwise add new
            if (prev.length > 0 && !prev[prev.length - 1].isFinal && !isFinal) {
                return [...prev.slice(0, -1), { text, isFinal, timestamp: entryTimestamp }];
            }
            return [...prev, { text, isFinal, timestamp: entryTimestamp }];
        });

        // If final and non-English patient language, translate asynchronously
        if (isFinal) {
            const patientLang = runtimeOptionsRef.current.patientLang || 'en';
            if (patientLang !== 'en') {
                translateText(text, patientLang, 'en')
                    .then((translated) => {
                        setLiveText((prev) =>
                            prev.map((e) =>
                                e.timestamp === entryTimestamp && e.text === text
                                    ? { ...e, translatedText: translated }
                                    : e
                            )
                        );
                    })
                    .catch(() => { }); // Silently fail — translation is best-effort
            }
        }
    });

    useSpeechRecognitionEvent('audiostart', (event) => {
        if (event.uri) {
            audioUriRef.current = event.uri;
            console.log('🎙️ Audio recording started:', event.uri);
        }
    });

    useSpeechRecognitionEvent('audioend', (event) => {
        if (event.uri) {
            audioUriRef.current = event.uri;
            console.log('🎙️ Audio recording saved:', event.uri);
        }
    });

    useSpeechRecognitionEvent('end', () => {
        // Auto-restart if still recording (to keep audio capture going)
        if (speechActiveRef.current && sessionRef.current) {
            setTimeout(() => {
                try {
                    const opts = runtimeOptionsRef.current;
                    ExpoSpeechRecognitionModule.start({
                        lang: mapLangCode(opts.patientLang || 'en'),
                        interimResults: true,
                        continuous: true,
                        recordingOptions: { persist: true },
                    });
                } catch (err) {
                    console.warn('Failed to restart recording:', err);
                }
            }, 200);
        }
    });

    useSpeechRecognitionEvent('error', (event) => {
        console.warn('Speech recognition error:', event.error, event.message);
        if (speechActiveRef.current && event.error !== 'not-allowed') {
            setTimeout(() => {
                try {
                    const opts = runtimeOptionsRef.current;
                    ExpoSpeechRecognitionModule.start({
                        lang: mapLangCode(opts.patientLang || 'en'),
                        interimResults: true,
                        continuous: true,
                        recordingOptions: { persist: true },
                    });
                } catch { }
            }, 500);
        }
    });

    // ─── Language Code Mapping ───────────────────────────
    function mapLangCode(code: string): string {
        const map: Record<string, string> = {
            en: 'en-US', es: 'es-US', ar: 'ar-SA', ht: 'ht-HT',
            vi: 'vi-VN', ru: 'ru-RU', fr: 'fr-FR', zh: 'zh-CN',
            pt: 'pt-BR', ko: 'ko-KR', ja: 'ja-JP', km: 'km-KH',
        };
        return map[code] || `${code}-${code.toUpperCase()}`;
    }

    // ─── Start Session ──────────────────────────────────
    const startSession = useCallback(async (runtimeOpts?: { name?: string; lang?: string; specialty?: string }) => {
        try {
            if (runtimeOpts) {
                runtimeOptionsRef.current = {
                    patientName: runtimeOpts.name,
                    patientLang: runtimeOpts.lang,
                    specialty: runtimeOpts.specialty as Specialty,
                };
            }
            const opts = runtimeOptionsRef.current;

            const newSession = await createSession({
                patient_name: opts.patientName || options.patientName || 'New Patient',
                patient_lang: opts.patientLang || options.patientLang || 'en',
                specialty: opts.specialty || options.specialty || 'general',
                status: 'recording',
            });
            setSession(newSession);
            sessionRef.current = newSession;
            setPhase('recording');
            setIsRecording(true);
            setIsPaused(false);
            setElapsedSeconds(0);
            setTranscript([]);
            setClinicalNote(null);
            setProcessingProgress(0);
            setProcessingStatus('');
            audioUriRef.current = null;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

            // Request permissions and start recording
            const permResult = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
            if (!permResult.granted) {
                console.warn('Speech recognition permissions denied');
                return;
            }

            // Check ambient mode setting
            const appSettings = await getSettings();
            const useAmbient = appSettings.ambientMode;

            // Start speech recognition with audio persisting
            speechActiveRef.current = true;
            ExpoSpeechRecognitionModule.start({
                lang: mapLangCode(opts.patientLang || 'en'),
                interimResults: true,
                continuous: true,  // Always continuous for reliable capture
                recordingOptions: { persist: true },
            });

            await logAuditEvent(
                'session_started',
                `Session started for ${opts.patientName || 'New Patient'}`,
                { specialty: opts.specialty, lang: opts.patientLang }
            );
        } catch (err) {
            console.error('Failed to start session:', err);
        }
    }, []);

    // ─── Pause / Resume ─────────────────────────────────
    const togglePause = useCallback(() => {
        setIsPaused((prev) => {
            const newPaused = !prev;
            if (newPaused) {
                speechActiveRef.current = false;
                ExpoSpeechRecognitionModule.stop();
            } else {
                speechActiveRef.current = true;
                const opts = runtimeOptionsRef.current;
                ExpoSpeechRecognitionModule.start({
                    lang: mapLangCode(opts.patientLang || 'en'),
                    interimResults: true,
                    continuous: true,
                    recordingOptions: { persist: true },
                });
            }
            return newPaused;
        });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, []);

    // ─── Flag Position ──────────────────────────────────
    const flagPosition = useCallback(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }, []);

    // ─── End Session (stop recording → process audio) ───
    const endSession = useCallback(async () => {
        const currentSession = sessionRef.current;
        if (!currentSession) return;
        sessionRef.current = null; // Prevent double-call

        try {
            const endedAt = Date.now();
            const opts = runtimeOptionsRef.current;

            // Stop recording
            speechActiveRef.current = false;
            setIsRecording(false);
            setLiveText([]); // Clear live text immediately
            ExpoSpeechRecognitionModule.stop();

            // Move to processing phase
            setPhase('processing');
            setProcessingStatus('Preparing audio...');
            setProcessingProgress(10);

            // Wait a moment for the audio file to be finalized
            await new Promise(r => setTimeout(r, 500));

            const audioUri = audioUriRef.current;
            if (!audioUri) {
                console.error('No audio file recorded');
                setProcessingStatus('Error: No audio recorded');
                return;
            }

            // Read the audio file as base64
            setProcessingStatus('Reading audio file...');
            setProcessingProgress(20);
            const base64Audio = await FileSystem.readAsStringAsync(audioUri, {
                encoding: 'base64',
            });

            // ─── Dual Pipeline: Gemini + Whisper in parallel ───
            setProcessingStatus('Transcribing with Gemini AI...');
            setProcessingProgress(30);

            // Start Gemini (cloud) transcription
            const geminiPromise = transcribeAudio(
                base64Audio,
                'audio/wav',
                opts.patientLang || 'en',
                opts.specialty || 'general',
            );

            // Start Whisper (on-device) transcription in parallel
            let whisperPromise: Promise<WhisperResult | null>;
            try {
                let whisperDownloaded = await isWhisperDownloaded();

                // Auto-download the model if not present (~466MB)
                if (!whisperDownloaded) {
                    setWhisperStatus('downloading');
                    setWhisperProgress(0);
                    try {
                        await downloadWhisperModel((downloaded, total) => {
                            const pct = total > 0 ? Math.round((downloaded / total) * 100) : 0;
                            setWhisperProgress(pct);
                        });
                        whisperDownloaded = true;
                    } catch (dlErr) {
                        console.warn('Whisper download failed:', dlErr);
                        setWhisperStatus('unavailable');
                        setWhisperError('Model download failed');
                        whisperDownloaded = false;
                    }
                }

                if (whisperDownloaded) {
                    setWhisperStatus('initializing');
                    setWhisperProgress(10);
                    if (!isWhisperReady()) {
                        // Add timeout so Whisper init doesn't hang forever on low-RAM devices
                        const initTimeout = new Promise<never>((_, reject) =>
                            setTimeout(() => reject(new Error('Whisper init timed out (30s)')), 30000)
                        );
                        await Promise.race([initializeWhisper(), initTimeout]);
                    }
                    setWhisperStatus('transcribing');
                    setWhisperProgress(30);
                    whisperPromise = transcribeWithWhisper(
                        audioUri,
                        opts.patientLang || 'en',
                    ).then(result => {
                        setWhisperProgress(100);
                        setWhisperStatus('done');
                        setWhisperResult(result);
                        return result;
                    });
                } else {
                    whisperPromise = Promise.resolve(null);
                }
            } catch (err) {
                console.warn('Whisper init failed:', err);
                setWhisperStatus('unavailable');
                setWhisperError(err instanceof Error ? err.message : 'Init failed');
                whisperPromise = Promise.resolve(null);
            }

            // Wait for both pipelines
            setProcessingProgress(40);
            const [geminiResult, whisperSettled] = await Promise.allSettled([
                geminiPromise,
                whisperPromise,
            ]);

            // Extract Gemini segments (primary)
            if (geminiResult.status === 'rejected') {
                throw new Error(`Gemini failed: ${geminiResult.reason}`);
            }
            const segments = geminiResult.value;

            // Extract Whisper result if available
            const whisperData = whisperSettled.status === 'fulfilled' ? whisperSettled.value : null;
            if (whisperData) {
                setWhisperResult(whisperData);
                setWhisperStatus('done');
                console.log(`✅ Whisper: ${whisperData.segments.length} segments in ${whisperData.durationMs}ms`);

                // Collect FL training signals from differences
                try {
                    const whisperText = whisperData.fullText.toLowerCase();
                    const geminiText = segments.map(s => s.text).join(' ').toLowerCase();
                    if (whisperText !== geminiText) {
                        await collectTrainingSignal({
                            session_id: currentSession.session_id,
                            type: 'correction',
                            original_text: whisperData.fullText,
                            corrected_text: segments.map(s => s.text).join(' '),
                            confidence: segments.reduce((sum, s) => sum + s.confidence, 0) / segments.length,
                            specialty: opts.specialty || 'general',
                        });
                        console.log('📊 FL training signal collected from Whisper↔Gemini diff');
                    }
                } catch (flErr) {
                    console.warn('FL signal collection failed:', flErr);
                }
            }

            setProcessingStatus('Processing transcript...');
            setProcessingProgress(80);

            // Convert Gemini segments to TranscriptEntry format (primary)
            const entries: TranscriptEntry[] = segments.map((seg, i) => ({
                id: generateId(),
                speaker: seg.speaker,
                text: seg.text,
                translatedText: seg.translatedText,
                sourceLang: seg.sourceLang,
                timestamp: formatTime(Math.floor(seg.startMs / 1000)),
                confidence: seg.confidence,
                entities: seg.entities.map(e => ({
                    text: e.text,
                    type: e.type as EntityType,
                })),
                startMs: seg.startMs,
                endMs: seg.endMs,
            }));

            setTranscript(entries);
            setProcessingStatus('Transcription complete!');
            setProcessingProgress(100);

            // Update session status
            await updateSessionStatus(currentSession.session_id, 'processing', endedAt);

            // Save utterances to DB
            for (const entry of entries) {
                await createUtterance({
                    session_id: currentSession.session_id,
                    speaker: entry.speaker,
                    original_text: entry.text,
                    translated_text: entry.translatedText,
                    source_lang: entry.sourceLang,
                    confidence: entry.confidence,
                    start_ms: entry.startMs,
                    end_ms: entry.endMs,
                });
            }

            await logAuditEvent(
                'transcription_completed',
                `Transcription completed: ${entries.length} segments`,
                { segment_count: entries.length, lang: opts.patientLang }
            );

            // Small delay then show review
            await new Promise(r => setTimeout(r, 800));
            setPhase('review');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            // Store session for later note generation
            sessionRef.current = currentSession;
        } catch (err) {
            console.error('Failed to process session:', err);
            setProcessingStatus(`Error: ${err instanceof Error ? err.message : 'Processing failed'}`);
            setProcessingProgress(0);
        }
    }, []);

    // ─── Generate Note (called when user clicks "Proceed") ──
    const generateNote = useCallback(async () => {
        const currentSession = sessionRef.current;
        if (!currentSession || transcript.length === 0) return;

        try {
            setPhase('generating');
            setProcessingStatus('Generating clinical note...');
            setProcessingProgress(30);

            const opts = runtimeOptionsRef.current;

            // Build transcript for AI — use English translations for note generation
            const transcriptForAI = transcript
                .map(t => ({
                    speaker: t.speaker,
                    text: t.translatedText || t.text, // Use English for SOAP note
                    confidence: t.confidence,
                }));

            setProcessingProgress(50);

            const note = await generateClinicalNote(
                transcriptForAI,
                opts.specialty || options.specialty || 'general',
                'en', // Notes always in English
            );

            setClinicalNote(note);
            setProcessingProgress(80);

            // Save note to DB (upsert to avoid duplicates, store full result)
            await upsertNote({
                session_id: currentSession.session_id,
                soap_json: JSON.stringify(note.soap),
                icd_codes_json: JSON.stringify(note.icd_codes),
                patient_summary: note.patient_summary,
                contradiction_flags: JSON.stringify(note.contradiction_flags),
                full_result_json: JSON.stringify(note),
            });

            await updateSessionStatus(currentSession.session_id, 'complete');
            setProcessingStatus('Note generated!');
            setProcessingProgress(100);

            await logAuditEvent(
                'note_generated',
                `Clinical note generated for ${opts.patientName || 'patient'}`,
                { icd_count: note.icd_codes.length, urgency: note.urgency_level }
            );

            await new Promise(r => setTimeout(r, 500));
            setPhase('complete');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (err) {
            console.error('Failed to generate note:', err);
            setProcessingStatus(`Error: ${err instanceof Error ? err.message : 'Note generation failed'}`);
        }
    }, [transcript]);

    // ─── Reset Session (start fresh) ────────────────────
    const resetSession = useCallback(() => {
        setPhase('setup');
        setSession(null);
        sessionRef.current = null;
        setIsRecording(false);
        setIsPaused(false);
        setElapsedSeconds(0);
        setTranscript([]);
        setClinicalNote(null);
        setProcessingProgress(0);
        setProcessingStatus('');
        setWhisperStatus('idle');
        setWhisperProgress(0);
        setWhisperResult(null);
        setWhisperError(null);
        setLiveText([]);
        runtimeOptionsRef.current = {};
        audioUriRef.current = null;
    }, []);

    return {
        // State
        session,
        phase,
        isRecording,
        isPaused,
        elapsedSeconds,
        transcript,
        processingStatus,
        processingProgress,
        clinicalNote,
        detectedLang,
        langConfidence,
        // Whisper dual pipeline
        whisperStatus,
        whisperProgress,
        whisperResult,
        whisperError,
        // Live text
        liveText,
        // Functions
        formatTime,
        startSession,
        togglePause,
        flagPosition,
        endSession,
        generateNote,
        resetSession,
    };
}
