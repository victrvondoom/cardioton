import React, { useEffect, useCallback, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Platform,
    Alert,
    TextInput,
    KeyboardAvoidingView,
    FlatList,
    ScrollView,
    ActivityIndicator,
    Share,
} from 'react-native';
import Animated, {
    FadeIn,
    FadeInDown,
    FadeInUp,
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSequence,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useActiveSession, TranscriptEntry } from '@/src/hooks/useActiveSession';
import { collectApprovedSession } from '@/src/modules/fl/service';
import { generateFHIRBundle, generateClinicalNoteText } from '@/src/modules/fhir/generator';
import * as Haptics from 'expo-haptics';

// ─── Color Constants ────────────────────────────────
const PRIMARY = '#8B1A2E';
const SUCCESS = '#059669';
const ENTITY_COLORS: Record<string, string> = {
    symptom: '#e74c3c',
    medication: '#3498db',
    condition: '#f39c12',
    vital: '#27ae60',
    duration: '#9b59b6',
    procedure: '#1abc9c',
};

// ─── Recording Dot ──────────────────────────────────
function RecordingDot() {
    const opacity = useSharedValue(1);
    useEffect(() => {
        opacity.value = withRepeat(
            withSequence(withTiming(0.3, { duration: 800 }), withTiming(1, { duration: 800 })),
            -1, false,
        );
    }, []);
    const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
    return <Animated.View style={[{ width: 14, height: 14, borderRadius: 7, backgroundColor: '#ff4444', marginBottom: 8 }, style]} />;
}

// ─── Waveform Bar ───────────────────────────────────
function WaveformBar({ delay }: { delay: number }) {
    const height = useSharedValue(8);
    useEffect(() => {
        setTimeout(() => {
            height.value = withRepeat(
                withSequence(
                    withTiming(Math.random() * 30 + 10, { duration: 300 + Math.random() * 200 }),
                    withTiming(Math.random() * 15 + 5, { duration: 300 + Math.random() * 200 }),
                ),
                -1, true,
            );
        }, delay);
    }, []);
    const style = useAnimatedStyle(() => ({
        height: height.value,
        backgroundColor: PRIMARY,
        width: 4,
        borderRadius: 2,
        marginHorizontal: 1.5,
    }));
    return <Animated.View style={style} />;
}

// ─── Transcript Bubble ──────────────────────────────
function TranscriptBubble({ item }: { item: TranscriptEntry }) {
    const isDr = item.speaker === 'DR';
    const hasTranslation = item.translatedText && item.sourceLang !== 'en';

    return (
        <Animated.View entering={FadeInDown.duration(300)}
            style={[s.bubble, isDr ? s.bubbleDr : s.bubblePt]}
        >
            <View style={s.bubbleHeader}>
                <View style={[s.speakerBadge, isDr ? { backgroundColor: '#3b82f6' } : { backgroundColor: '#f59e0b' }]}>
                    <Ionicons name={isDr ? 'medical' : 'person'} size={12} color="#fff" />
                    <Text style={s.speakerBadgeText}>{isDr ? 'Doctor' : 'Patient'}</Text>
                </View>
                <Text style={{ fontSize: 10, color: '#aaa' }}>{item.timestamp}</Text>
            </View>
            <Text style={s.bubbleText}>{item.text}</Text>
            {hasTranslation && (
                <View style={s.translationBox}>
                    <Text style={{ fontSize: 10, color: '#888' }}>🌐 English:</Text>
                    <Text style={s.translationText}>{item.translatedText}</Text>
                </View>
            )}
            {item.entities.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                    {item.entities.map((e, i) => (
                        <View key={i} style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: (ENTITY_COLORS[e.type] || '#666') + '22' }}>
                            <Text style={{ fontSize: 10, fontWeight: '600', color: ENTITY_COLORS[e.type] || '#666' }}>{e.text}</Text>
                        </View>
                    ))}
                </View>
            )}
        </Animated.View>
    );
}

// ─── Setup View ─────────────────────────────────────
function SetupView({ onStart }: { onStart: (name: string, lang: string, specialty: string) => void }) {
    const [name, setName] = useState('');
    const [lang, setLang] = useState('en');
    const [specialty, setSpecialty] = useState('general');

    const langs = [
        { code: 'en', label: 'English', flag: '🇺🇸' },
        { code: 'es', label: 'Spanish', flag: '🇲🇽' },
        { code: 'fr', label: 'French', flag: '🇫🇷' },
        { code: 'ar', label: 'Arabic', flag: '🇸🇦' },
        { code: 'ht', label: 'Haitian Creole', flag: '🇭🇹' },
        { code: 'vi', label: 'Vietnamese', flag: '🇻🇳' },
        { code: 'zh', label: 'Chinese', flag: '🇨🇳' },
        { code: 'ko', label: 'Korean', flag: '🇰🇷' },
        { code: 'ru', label: 'Russian', flag: '🇷🇺' },
        { code: 'km', label: 'Khmer', flag: '🇰🇭' },
    ];

    const specs = [
        { code: 'general', label: 'General Care', icon: 'fitness-outline' as const },
        { code: 'cardiology', label: 'Cardiology', icon: 'heart-outline' as const },
        { code: 'orthopedics', label: 'Orthopedics', icon: 'body-outline' as const },
        { code: 'neurology', label: 'Neurology', icon: 'flash-outline' as const },
        { code: 'pediatrics', label: 'Pediatrics', icon: 'happy-outline' as const },
        { code: 'psychiatry', label: 'Psychiatry', icon: 'chatbubble-outline' as const },
        { code: 'emergency', label: 'Emergency', icon: 'warning-outline' as const },
    ];

    return (
        <ScrollView style={{ flex: 1, paddingHorizontal: 20, paddingTop: 50 }} contentContainerStyle={{ paddingBottom: 40 }}>
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
                <Ionicons name="mic-circle-outline" size={56} color={PRIMARY} />
                <Text style={{ fontSize: 26, fontWeight: '800', color: '#1a1a2e', marginTop: 10 }}>New Session</Text>
                <Text style={{ fontSize: 13, color: '#888', marginTop: 2 }}>Enter patient info to begin recording</Text>
            </View>

            <Text style={s.fieldLabel}>Patient Name</Text>
            <TextInput style={s.textInput} placeholder="Enter patient name..." placeholderTextColor="#999" value={name} onChangeText={setName} />

            <Text style={s.fieldLabel}>Patient Language</Text>
            <View style={s.chipGrid}>
                {langs.map((l) => (
                    <TouchableOpacity key={l.code} style={[s.chip, lang === l.code && s.chipActive]} onPress={() => setLang(l.code)}>
                        <Text style={{ fontSize: 14 }}>{l.flag}</Text>
                        <Text style={[s.chipLabel, lang === l.code && s.chipLabelActive]}>{l.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <Text style={s.fieldLabel}>Specialty</Text>
            <View style={s.chipGrid}>
                {specs.map((sp) => (
                    <TouchableOpacity key={sp.code} style={[s.chip, specialty === sp.code && s.chipActive]} onPress={() => setSpecialty(sp.code)}>
                        <Ionicons name={sp.icon} size={16} color={specialty === sp.code ? PRIMARY : '#666'} />
                        <Text style={[s.chipLabel, specialty === sp.code && s.chipLabelActive]}>{sp.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <TouchableOpacity
                style={[s.primaryBtn, !name.trim() && { opacity: 0.35 }]}
                onPress={() => name.trim() && onStart(name.trim(), lang, specialty)}
                disabled={!name.trim()}
            >
                <Ionicons name="mic" size={24} color="#fff" />
                <Text style={s.primaryBtnText}>Start Recording</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

// ─── Recording View ─────────────────────────────────
function RecordingView({ elapsed, paused, onPause, onEnd, fmt, liveText }: {
    elapsed: number; paused: boolean; onPause: () => void; onEnd: () => void; fmt: (s: number) => string;
    liveText: Array<{ text: string; translatedText?: string; isFinal: boolean; timestamp: number }>;
}) {
    const scrollRef = useRef<ScrollView>(null);

    // Auto-scroll to bottom when new text arrives
    useEffect(() => {
        if (liveText.length > 0) {
            setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
        }
    }, [liveText.length, liveText[liveText.length - 1]?.translatedText]);

    return (
        <View style={{ flex: 1, justifyContent: 'space-between', paddingTop: 40 }}>
            {/* Header: Dot + Timer */}
            <View style={{ alignItems: 'center' }}>
                <RecordingDot />
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#ff4444', letterSpacing: 3 }}>{paused ? 'PAUSED' : 'RECORDING'}</Text>
                <Text style={{ fontSize: 48, fontWeight: '200', color: '#1a1a2e', marginVertical: 8 }}>{fmt(elapsed)}</Text>
                {!paused && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', height: 36, marginBottom: 8 }}>
                        {Array.from({ length: 24 }).map((_, i) => <WaveformBar key={i} delay={i * 50} />)}
                    </View>
                )}
            </View>

            {/* Live Transcription Area */}
            <View style={{ flex: 1, marginHorizontal: 16, marginTop: 8, marginBottom: 12, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee', overflow: 'hidden' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: paused ? '#ccc' : '#059669' }} />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#888', letterSpacing: 0.5 }}>LIVE TRANSCRIPTION</Text>
                    {!paused && liveText.length > 0 && (
                        <View style={{ marginLeft: 'auto', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: '#05966912' }}>
                            <Text style={{ fontSize: 10, fontWeight: '700', color: '#059669' }}>• Listening</Text>
                        </View>
                    )}
                </View>
                <View style={{ height: 1, backgroundColor: '#f0f0f0' }} />
                <ScrollView
                    ref={scrollRef}
                    style={{ flex: 1 }}
                    contentContainerStyle={{ padding: 14, paddingBottom: 20 }}
                    showsVerticalScrollIndicator={false}
                >
                    {liveText.length === 0 ? (
                        <View style={{ alignItems: 'center', paddingVertical: 30 }}>
                            <Ionicons name="mic-outline" size={28} color="#ccc" />
                            <Text style={{ fontSize: 13, color: '#bbb', marginTop: 8, textAlign: 'center' }}>
                                {paused ? 'Recording paused...' : 'Start speaking to see live text...'}
                            </Text>
                        </View>
                    ) : (
                        liveText.map((entry, i) => (
                            <Animated.View
                                key={`${entry.timestamp}-${i}`}
                                entering={FadeIn.duration(200)}
                                style={{ marginBottom: entry.isFinal ? 10 : 2 }}
                            >
                                {/* Original text */}
                                <Text style={{
                                    fontSize: 15,
                                    lineHeight: 22,
                                    color: entry.isFinal ? '#1a1a2e' : '#999',
                                    fontStyle: entry.isFinal ? 'normal' : 'italic',
                                }}>
                                    {entry.text}
                                    {!entry.isFinal && <Text style={{ color: '#ccc' }}> ▁</Text>}
                                </Text>
                                {/* English translation for non-English */}
                                {entry.translatedText && (
                                    <Animated.View entering={FadeIn.duration(300)} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginTop: 3 }}>
                                        <Text style={{ fontSize: 12, color: '#2563EB' }}>🌐</Text>
                                        <Text style={{ fontSize: 13, lineHeight: 19, color: '#2563EB', flex: 1 }}>
                                            {entry.translatedText}
                                        </Text>
                                    </Animated.View>
                                )}
                            </Animated.View>
                        ))
                    )}
                </ScrollView>
            </View>

            {/* Control Buttons */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 24, paddingBottom: 40 }}>
                <TouchableOpacity style={[s.ctrlBtn, { backgroundColor: '#ff8800' }]} onPress={onPause}>
                    <Ionicons name={paused ? 'play' : 'pause'} size={28} color="#fff" />
                    <Text style={s.ctrlLabel}>{paused ? 'Resume' : 'Pause'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.ctrlBtn, { backgroundColor: '#ff4444' }]} onPress={() =>
                    Alert.alert('End Session', 'Stop recording and process with Gemini AI?', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'End & Process', style: 'destructive', onPress: onEnd },
                    ])
                }>
                    <Ionicons name="stop" size={28} color="#fff" />
                    <Text style={s.ctrlLabel}>End</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

// ─── Processing View (Dual Pipeline) ────────────────
function ProcessingView({ status, progress, whisperStatus, whisperProgress, whisperResult }: {
    status: string; progress: number;
    whisperStatus?: 'idle' | 'downloading' | 'initializing' | 'transcribing' | 'done' | 'unavailable';
    whisperProgress?: number;
    whisperResult?: { segments: any[]; fullText: string; durationMs: number } | null;
}) {
    const geminiSteps = [
        { label: 'Preparing audio file', threshold: 10, done: 20 },
        { label: 'Uploading to Gemini 2.5 Pro', threshold: 20, done: 40 },
        { label: 'Transcribing & detecting speakers', threshold: 40, done: 80 },
        { label: 'Translating & building transcript', threshold: 80, done: 100 },
    ];
    const whisperLabel =
        whisperStatus === 'downloading' ? `Downloading Whisper Small (${whisperProgress || 0}%)…` :
            whisperStatus === 'initializing' ? 'Loading Whisper Small model…' :
                whisperStatus === 'transcribing' ? 'On-device transcription in progress…' :
                    whisperStatus === 'done' ? '✓ Transcription complete' :
                        whisperStatus === 'unavailable' ? 'Not available on this device' : '';
    const showWhisper = whisperStatus && whisperStatus !== 'idle';

    return (
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 }}>
            <View style={{ alignItems: 'center' }}>
                <ActivityIndicator size="large" color={PRIMARY} style={{ marginBottom: 16 }} />
                <Text style={{ fontSize: 22, fontWeight: '800', color: '#1a1a2e', marginBottom: 4 }}>Processing Audio</Text>
                <Text style={{ fontSize: 13, color: '#666', marginBottom: 20, textAlign: 'center' }}>{status}</Text>

                {/* Gemini Pipeline Card */}
                <View style={{ width: '100%', backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#eee', marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#2563EB14', alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="cloud" size={16} color="#2563EB" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: '#2563EB' }}>Gemini 2.5 Pro</Text>
                            <Text style={{ fontSize: 10, color: '#888' }}>Cloud ASR · Speaker detection · Translation</Text>
                        </View>
                        <Text style={{ fontSize: 14, fontWeight: '800', color: '#2563EB' }}>{Math.round(progress)}%</Text>
                    </View>
                    <View style={{ height: 6, backgroundColor: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
                        <View style={{ height: '100%', width: `${progress}%`, backgroundColor: '#2563EB', borderRadius: 3 }} />
                    </View>
                </View>

                {/* Whisper Pipeline Card */}
                {showWhisper && (
                    <View style={{ width: '100%', backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#eee', marginBottom: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                            <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#7C3AED14', alignItems: 'center', justifyContent: 'center' }}>
                                <Ionicons name="phone-portrait" size={16} color="#7C3AED" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 13, fontWeight: '700', color: '#7C3AED' }}>Whisper Small</Text>
                                <Text style={{ fontSize: 10, color: '#888' }}>On-device · Privacy-first · FL comparison</Text>
                            </View>
                            <Text style={{ fontSize: 14, fontWeight: '800', color: '#7C3AED' }}>{Math.round(whisperProgress || 0)}%</Text>
                        </View>
                        <View style={{ height: 6, backgroundColor: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
                            <View style={{ height: '100%', width: `${whisperProgress || 0}%`, backgroundColor: '#7C3AED', borderRadius: 3 }} />
                        </View>
                        <Text style={{ fontSize: 10, color: whisperStatus === 'done' ? SUCCESS : '#888', marginTop: 6, fontWeight: whisperStatus === 'done' ? '600' : '400' }}>{whisperLabel}</Text>

                        {/* Whisper Diagnostic Summary — only when done */}
                        {whisperStatus === 'done' && whisperResult && (
                            <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f0f0f0' }}>
                                <Text style={{ fontSize: 11, fontWeight: '700', color: '#555', marginBottom: 6 }}>Diagnostic Summary</Text>
                                <View style={{ flexDirection: 'row', gap: 12 }}>
                                    <View style={{ flex: 1, backgroundColor: '#f8f9fa', borderRadius: 8, padding: 8, alignItems: 'center' }}>
                                        <Text style={{ fontSize: 16, fontWeight: '800', color: '#7C3AED' }}>{whisperResult.segments.length}</Text>
                                        <Text style={{ fontSize: 9, color: '#888' }}>Segments</Text>
                                    </View>
                                    <View style={{ flex: 1, backgroundColor: '#f8f9fa', borderRadius: 8, padding: 8, alignItems: 'center' }}>
                                        <Text style={{ fontSize: 16, fontWeight: '800', color: '#7C3AED' }}>{(whisperResult.durationMs / 1000).toFixed(1)}s</Text>
                                        <Text style={{ fontSize: 9, color: '#888' }}>Processing</Text>
                                    </View>
                                    <View style={{ flex: 1, backgroundColor: '#f8f9fa', borderRadius: 8, padding: 8, alignItems: 'center' }}>
                                        <Text style={{ fontSize: 16, fontWeight: '800', color: '#7C3AED' }}>{whisperResult.fullText.split(/\s+/).length}</Text>
                                        <Text style={{ fontSize: 9, color: '#888' }}>Words</Text>
                                    </View>
                                </View>
                            </View>
                        )}
                    </View>
                )}

                {/* Pipeline Steps */}
                <View style={{ width: '100%', backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#eee' }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#888', marginBottom: 10, letterSpacing: 0.5 }}>PIPELINE STEPS</Text>
                    {geminiSteps.map((step, i) => {
                        const isDone = progress >= step.done;
                        const isCurrent = progress >= step.threshold && !isDone;
                        return (
                            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4 }}>
                                <Ionicons
                                    name={isDone ? 'checkmark-circle' : isCurrent ? 'ellipse' : 'ellipse-outline'}
                                    size={18}
                                    color={isDone ? SUCCESS : isCurrent ? PRIMARY : '#ddd'}
                                />
                                <Text style={{ fontSize: 13, color: isDone ? SUCCESS : isCurrent ? PRIMARY : '#bbb', fontWeight: isDone || isCurrent ? '600' : '400', flex: 1 }}>{step.label}</Text>
                            </View>
                        );
                    })}
                    {showWhisper && whisperStatus === 'done' && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4 }}>
                            <Ionicons name="checkmark-circle" size={18} color={SUCCESS} />
                            <Text style={{ fontSize: 13, color: SUCCESS, fontWeight: '600', flex: 1 }}>FL training signal collected</Text>
                            <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: '#05966915' }}>
                                <Text style={{ fontSize: 9, fontWeight: '800', color: SUCCESS }}>HIPAA</Text>
                            </View>
                        </View>
                    )}
                </View>
            </View>
        </ScrollView>
    );
}

// ─── Transcript Review ──────────────────────────────
function ReviewView({ transcript, whisperResult, onProceed }: {
    transcript: TranscriptEntry[];
    whisperResult?: { segments: any[]; fullText: string; durationMs: number } | null;
    onProceed: () => void;
}) {
    const [source, setSource] = useState<'gemini' | 'whisper'>('gemini');
    const hasWhisper = whisperResult && whisperResult.segments.length > 0;

    // Build whisper entries for display
    const whisperEntries: TranscriptEntry[] = hasWhisper
        ? whisperResult.segments.map((seg: any, i: number) => ({
            id: `whisper-${i}`,
            speaker: 'DR' as const,
            text: seg.text?.trim() || '',
            translatedText: null,
            sourceLang: 'en',
            timestamp: `${Math.round((seg.t0 || 0) / 1000)}s`,
            entities: [],
            confidence: 0.85,
            startMs: seg.t0 || 0,
            endMs: seg.t1 || 0,
        }))
        : [];

    const activeTranscript = source === 'gemini' ? transcript : whisperEntries;

    return (
        <View style={{ flex: 1 }}>
            {/* Header */}
            <View style={{ alignItems: 'center', paddingTop: 50, paddingBottom: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' }}>
                <Ionicons name="document-text" size={24} color={PRIMARY} />
                <Text style={{ fontSize: 20, fontWeight: '800', color: '#1a1a2e', marginTop: 6 }}>Transcript Review</Text>
                <Text style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{activeTranscript.length} segments</Text>

                {/* Source Toggle — only show when Whisper data exists */}
                {hasWhisper && (
                    <View style={{ flexDirection: 'row', backgroundColor: '#f0f0f0', borderRadius: 10, marginTop: 10, padding: 3 }}>
                        <TouchableOpacity
                            style={{
                                paddingHorizontal: 16, paddingVertical: 7, borderRadius: 8,
                                backgroundColor: source === 'gemini' ? PRIMARY : 'transparent',
                            }}
                            onPress={() => setSource('gemini')}
                        >
                            <Text style={{ fontSize: 12, fontWeight: '700', color: source === 'gemini' ? '#fff' : '#888' }}>
                                Gemini ({transcript.length})
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={{
                                paddingHorizontal: 16, paddingVertical: 7, borderRadius: 8,
                                backgroundColor: source === 'whisper' ? '#7C3AED' : 'transparent',
                            }}
                            onPress={() => setSource('whisper')}
                        >
                            <Text style={{ fontSize: 12, fontWeight: '700', color: source === 'whisper' ? '#fff' : '#888' }}>
                                Whisper ({whisperEntries.length})
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* Transcript list — scrollable with Generate Note at the bottom */}
            <FlatList
                data={activeTranscript}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => <TranscriptBubble item={item} />}
                contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 8, paddingBottom: 20 }}
                showsVerticalScrollIndicator={false}
                ListFooterComponent={
                    <View style={{ paddingTop: 12, paddingBottom: 30 }}>
                        {/* Whisper Diagnostic Comparison Card */}
                        {hasWhisper && (
                            <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#eee', marginBottom: 14 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                    <Ionicons name="analytics" size={18} color="#7C3AED" />
                                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#1a1a2e' }}>Pipeline Comparison</Text>
                                </View>

                                {/* Metrics grid */}
                                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                                    <View style={{ flex: 1, backgroundColor: '#2563EB08', borderRadius: 10, padding: 10, alignItems: 'center' }}>
                                        <Ionicons name="cloud" size={14} color="#2563EB" />
                                        <Text style={{ fontSize: 18, fontWeight: '800', color: '#2563EB', marginTop: 4 }}>{transcript.length}</Text>
                                        <Text style={{ fontSize: 9, color: '#888' }}>Gemini Segs</Text>
                                    </View>
                                    <View style={{ flex: 1, backgroundColor: '#7C3AED08', borderRadius: 10, padding: 10, alignItems: 'center' }}>
                                        <Ionicons name="phone-portrait" size={14} color="#7C3AED" />
                                        <Text style={{ fontSize: 18, fontWeight: '800', color: '#7C3AED', marginTop: 4 }}>{whisperResult!.segments.length}</Text>
                                        <Text style={{ fontSize: 9, color: '#888' }}>Whisper Segs</Text>
                                    </View>
                                    <View style={{ flex: 1, backgroundColor: '#05966908', borderRadius: 10, padding: 10, alignItems: 'center' }}>
                                        <Ionicons name="timer" size={14} color={SUCCESS} />
                                        <Text style={{ fontSize: 18, fontWeight: '800', color: SUCCESS, marginTop: 4 }}>{(whisperResult!.durationMs / 1000).toFixed(1)}s</Text>
                                        <Text style={{ fontSize: 9, color: '#888' }}>On-device</Text>
                                    </View>
                                </View>

                                {/* Quality checks */}
                                {[
                                    { label: 'Speaker detection', gemini: true, whisper: false, icon: 'people' as const },
                                    { label: 'Medical entity extraction', gemini: true, whisper: false, icon: 'medkit' as const },
                                    { label: 'Timestamps', gemini: true, whisper: true, icon: 'time' as const },
                                    { label: 'Translation', gemini: true, whisper: false, icon: 'language' as const },
                                    { label: 'Privacy (on-device)', gemini: false, whisper: true, icon: 'shield-checkmark' as const },
                                    { label: 'Works offline', gemini: false, whisper: true, icon: 'airplane' as const },
                                ].map((check, i) => (
                                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 5, borderTopWidth: i === 0 ? 1 : 0, borderTopColor: '#f0f0f0' }}>
                                        <Ionicons name={check.icon} size={14} color="#888" style={{ width: 22 }} />
                                        <Text style={{ flex: 1, fontSize: 12, color: '#555' }}>{check.label}</Text>
                                        <Ionicons name={check.gemini ? 'checkmark-circle' : 'close-circle'} size={16} color={check.gemini ? SUCCESS : '#ddd'} style={{ marginRight: 16 }} />
                                        <Ionicons name={check.whisper ? 'checkmark-circle' : 'close-circle'} size={16} color={check.whisper ? '#7C3AED' : '#ddd'} />
                                    </View>
                                ))}
                                <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 6 }}>
                                    <View style={{ flex: 1 }} />
                                    <Text style={{ fontSize: 9, color: '#2563EB', fontWeight: '700', marginRight: 10 }}>Gemini</Text>
                                    <Text style={{ fontSize: 9, color: '#7C3AED', fontWeight: '700' }}>Whisper</Text>
                                </View>

                                {/* Word count comparison */}
                                <View style={{ backgroundColor: '#f8f9fa', borderRadius: 10, padding: 10, marginTop: 10 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                        <Ionicons name="document-text" size={12} color="#888" />
                                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#888' }}>WORD COUNT</Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', gap: 12 }}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontSize: 11, color: '#2563EB', fontWeight: '700' }}>Gemini: {transcript.reduce((sum, t) => sum + t.text.split(/\s+/).length, 0)}</Text>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontSize: 11, color: '#7C3AED', fontWeight: '700' }}>Whisper: {whisperResult!.fullText.split(/\s+/).length}</Text>
                                        </View>
                                    </View>
                                </View>
                            </View>
                        )}
                        <TouchableOpacity style={s.primaryBtn} onPress={onProceed}>
                            <Text style={s.primaryBtnText}>Generate Clinical Notes</Text>
                            <Ionicons name="arrow-forward" size={20} color="#fff" />
                        </TouchableOpacity>
                    </View>
                }
            />
        </View>
    );
}

// ─── Section Header with Icon ───────────────────────
function SectionHeader({ icon, label, color }: { icon: string; label: string; color?: string }) {
    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: (color || PRIMARY) + '14', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={icon as any} size={15} color={color || PRIMARY} />
            </View>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#1a1a2e', letterSpacing: 0.2 }}>{label}</Text>
        </View>
    );
}

// ─── SOAP Field with Colored Accent ─────────────────
function SoapField({ label, letter, color, value, onChange }: {
    label: string; letter: string; color: string; value: string; onChange: (t: string) => void;
}) {
    return (
        <View style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <View style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: color + '18', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 11, fontWeight: '900', color }}>{letter}</Text>
                </View>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#555' }}>{label}</Text>
            </View>
            <View style={{ flexDirection: 'row' }}>
                <View style={{ width: 3, backgroundColor: color, borderRadius: 2, marginRight: 10 }} />
                <TextInput
                    style={{ flex: 1, backgroundColor: '#f8f9fa', borderRadius: 10, padding: 10, fontSize: 13, color: '#333', lineHeight: 20, minHeight: 56, borderWidth: 1, borderColor: '#eee' }}
                    value={value}
                    onChangeText={onChange}
                    multiline
                    textAlignVertical="top"
                />
            </View>
        </View>
    );
}

// ─── Editable Note with Approve/Delete ──────────────
function NoteView({ note, onApprove, onDelete, onNew }: {
    note: any; onApprove: () => void; onDelete: () => void; onNew: () => void;
}) {
    const router = useRouter();
    const [summary, setSummary] = useState(note?.patient_summary || '');
    const [subj, setSubj] = useState(note?.soap?.subjective || '');
    const [obj, setObj] = useState(note?.soap?.objective || '');
    const [assess, setAssess] = useState(note?.soap?.assessment || '');
    const [plan, setPlan] = useState(note?.soap?.plan || '');
    const [approved, setApproved] = useState(false);

    if (!note) return null;

    if (approved) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30, backgroundColor: '#f8f9fa' }}>
                <Animated.View entering={FadeIn.duration(600)} style={{ alignItems: 'center' }}>
                    <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: SUCCESS + '15', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                        <Ionicons name="checkmark-circle" size={56} color={SUCCESS} />
                    </View>
                    <Text style={{ fontSize: 24, fontWeight: '800', color: '#1a1a2e', marginBottom: 4 }}>Note Approved</Text>
                    <Text style={{ fontSize: 14, color: '#888', marginBottom: 32 }}>Saved to session history</Text>
                    <TouchableOpacity style={[s.primaryBtn, { width: 260 }]} onPress={onNew}>
                        <Ionicons name="add-circle-outline" size={20} color="#fff" />
                        <Text style={s.primaryBtnText}>Start New Session</Text>
                    </TouchableOpacity>
                </Animated.View>
            </View>
        );
    }

    return (
        <ScrollView style={{ flex: 1, backgroundColor: '#f4f5f7' }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 50, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            {/* Header */}
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
                <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: PRIMARY + '12', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                    <Ionicons name="document-text" size={24} color={PRIMARY} />
                </View>
                <Text style={{ fontSize: 22, fontWeight: '800', color: '#1a1a2e' }}>Clinical Note</Text>
                <Text style={{ fontSize: 12, color: '#999', marginTop: 2 }}>Review and edit before approving</Text>
            </View>

            {/* Patient Summary */}
            <View style={ns.card}>
                <SectionHeader icon="clipboard-outline" label="Patient Summary" />
                <TextInput
                    style={ns.editField}
                    value={summary}
                    onChangeText={setSummary}
                    multiline
                    textAlignVertical="top"
                    placeholder="Patient summary..."
                    placeholderTextColor="#bbb"
                />
            </View>

            {/* SOAP Note */}
            <View style={ns.card}>
                <SectionHeader icon="medkit-outline" label="SOAP Note" />
                <SoapField letter="S" label="Subjective" color="#3b82f6" value={subj} onChange={setSubj} />
                <SoapField letter="O" label="Objective" color="#8b5cf6" value={obj} onChange={setObj} />
                <SoapField letter="A" label="Assessment" color="#f59e0b" value={assess} onChange={setAssess} />
                <SoapField letter="P" label="Plan" color={SUCCESS} value={plan} onChange={setPlan} />
            </View>

            {/* ICD-10 Codes */}
            {note.icd_codes?.length > 0 && (
                <View style={ns.card}>
                    <SectionHeader icon="barcode-outline" label="ICD-10 Codes" />
                    {note.icd_codes.map((c: any, i: number) => (
                        <View key={i} style={ns.icdRow}>
                            <View style={ns.icdCodeBadge}>
                                <Text style={ns.icdCodeText}>{c.code}</Text>
                            </View>
                            <Text style={ns.icdDesc}>{c.description}</Text>
                        </View>
                    ))}
                </View>
            )}

            {/* Contradiction Flags */}
            {note.contradiction_flags?.length > 0 && (
                <View style={ns.card}>
                    <SectionHeader icon="warning-outline" label="Contradiction Flags" color="#f59e0b" />
                    {note.contradiction_flags.map((flag: string, i: number) => (
                        <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                            <Ionicons name="alert-circle" size={16} color="#f59e0b" style={{ marginTop: 2 }} />
                            <Text style={{ fontSize: 13, color: '#555', flex: 1, lineHeight: 18 }}>{flag}</Text>
                        </View>
                    ))}
                </View>
            )}

            {/* Urgency Level */}
            {note.urgency_level && (
                <View style={ns.card}>
                    <SectionHeader icon="speedometer-outline" label="Urgency Level" />
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Ionicons
                            name={note.urgency_level === 'high' ? 'alert-circle' : note.urgency_level === 'medium' ? 'warning' : 'shield-checkmark'}
                            size={20}
                            color={note.urgency_level === 'high' ? '#ef4444' : note.urgency_level === 'medium' ? '#f59e0b' : SUCCESS}
                        />
                        <View style={{
                            paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8,
                            backgroundColor: note.urgency_level === 'high' ? '#ef444415' : note.urgency_level === 'medium' ? '#f59e0b15' : SUCCESS + '15',
                        }}>
                            <Text style={{
                                fontSize: 13, fontWeight: '700', letterSpacing: 0.5,
                                color: note.urgency_level === 'high' ? '#ef4444' : note.urgency_level === 'medium' ? '#f59e0b' : SUCCESS,
                            }}>{note.urgency_level.toUpperCase()}</Text>
                        </View>
                    </View>
                </View>
            )}

            {/* Follow-up Banner */}
            {note.follow_up_days > 0 && (
                <View style={[ns.card, { backgroundColor: '#2563EB08' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: '#2563EB14', alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="calendar-outline" size={18} color="#2563EB" />
                        </View>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#2563EB' }}>
                            Follow-up in {note.follow_up_days} days
                        </Text>
                    </View>
                </View>
            )}

            {/* Key Findings */}
            {note.key_findings?.length > 0 && (
                <View style={ns.card}>
                    <SectionHeader icon="flash-outline" label="Key Findings" color="#f59e0b" />
                    {note.key_findings.map((finding: string, i: number) => (
                        <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                            <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: PRIMARY + '14', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                                <Text style={{ fontSize: 10, fontWeight: '800', color: PRIMARY }}>{i + 1}</Text>
                            </View>
                            <Text style={{ fontSize: 13, color: '#333', flex: 1, lineHeight: 19 }}>{finding}</Text>
                        </View>
                    ))}
                </View>
            )}

            {/* Vitals Summary */}
            {note.vitals?.length > 0 && (
                <View style={ns.card}>
                    <SectionHeader icon="heart-outline" label="Vitals" color="#ef4444" />
                    {note.vitals.map((v: any, i: number) => {
                        const statusColor = v.status === 'normal' ? SUCCESS : v.status === 'elevated' ? '#f59e0b' : v.status === 'critical' ? '#ef4444' : '#2563EB';
                        return (
                            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: i < note.vitals.length - 1 ? 1 : 0, borderBottomColor: '#f0f0f0' }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#1a1a2e' }}>{v.name}</Text>
                                    {v.reference_range && <Text style={{ fontSize: 10, color: '#999' }}>{v.reference_range}</Text>}
                                </View>
                                <Text style={{ fontSize: 16, fontWeight: '700', color: statusColor, marginRight: 4 }}>{v.value}</Text>
                                <Text style={{ fontSize: 10, color: '#888' }}>{v.unit}</Text>
                                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: statusColor, marginLeft: 8 }} />
                            </View>
                        );
                    })}
                </View>
            )}

            {/* Risk Assessment */}
            {note.risk_factors?.length > 0 && (
                <View style={ns.card}>
                    <SectionHeader icon="shield-outline" label="Risk Assessment" color="#dc2626" />
                    {note.risk_factors.map((r: any, i: number) => {
                        const riskColor = r.level === 'low' ? SUCCESS : r.level === 'moderate' ? '#f59e0b' : r.level === 'high' ? '#E65100' : '#ef4444';
                        return (
                            <View key={i} style={{ marginBottom: 10 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                                    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: riskColor + '15' }}>
                                        <Text style={{ fontSize: 10, fontWeight: '800', color: riskColor, textTransform: 'uppercase' }}>{r.level}</Text>
                                    </View>
                                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#1a1a2e', flex: 1 }}>{r.factor}</Text>
                                </View>
                                {r.detail && <Text style={{ fontSize: 12, color: '#666', lineHeight: 17, marginLeft: 4 }}>{r.detail}</Text>}
                            </View>
                        );
                    })}
                </View>
            )}

            {/* Medications */}
            {note.medications?.length > 0 && (
                <View style={ns.card}>
                    <SectionHeader icon="medkit-outline" label="Medications" color="#059669" />
                    {note.medications.map((m: any, i: number) => {
                        const medColor = m.status === 'current' ? SUCCESS : m.status === 'new' ? '#2563EB' : m.status === 'discontinued' ? '#ef4444' : '#f59e0b';
                        return (
                            <View key={i} style={{ paddingVertical: 6, borderBottomWidth: i < note.medications.length - 1 ? 1 : 0, borderBottomColor: '#f0f0f0' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#1a1a2e', flex: 1 }}>{m.name}</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: medColor + '15' }}>
                                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: medColor }} />
                                        <Text style={{ fontSize: 10, fontWeight: '700', color: medColor, textTransform: 'uppercase' }}>{m.status}</Text>
                                    </View>
                                </View>
                                <Text style={{ fontSize: 12, color: '#555' }}>{m.dosage} · {m.frequency} · {m.route}</Text>
                                {m.indication && <Text style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{m.indication}</Text>}
                            </View>
                        );
                    })}
                </View>
            )}

            {/* Differential Diagnoses */}
            {note.differential_diagnoses?.length > 0 && (
                <View style={ns.card}>
                    <SectionHeader icon="git-branch-outline" label="Differential Diagnoses" />
                    {note.differential_diagnoses.map((dx: string, i: number) => (
                        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <Text style={{ fontSize: 14, width: 22, textAlign: 'center', color: i === 0 ? PRIMARY : '#888' }}>
                                {i === 0 ? '★' : `${i + 1}.`}
                            </Text>
                            <Text style={{ fontSize: 13, color: '#333', flex: 1, fontWeight: i === 0 ? '600' : '400' }}>{dx}</Text>
                            {i === 0 && (
                                <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: '#ef444415' }}>
                                    <Text style={{ fontSize: 9, fontWeight: '800', color: '#ef4444' }}>MOST LIKELY</Text>
                                </View>
                            )}
                        </View>
                    ))}
                </View>
            )}

            {/* Export & Profile Actions */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4, marginBottom: 8 }}>
                <TouchableOpacity
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, backgroundColor: SUCCESS + '12' }}
                    onPress={async () => {
                        try {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            const bundle = generateFHIRBundle(
                                { patient_name: 'Patient', specialty: 'general', patient_lang: 'en' } as any,
                                { soap_json: JSON.stringify(note.soap), icd_codes_json: JSON.stringify(note.icd_codes), patient_summary: note.patient_summary } as any,
                                [],
                            );
                            await Share.share({ message: JSON.stringify(bundle, null, 2), title: 'FHIR R4 Bundle' });
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        } catch { }
                    }}
                >
                    <Ionicons name="code-slash" size={16} color={SUCCESS} />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: SUCCESS }}>Export FHIR</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, backgroundColor: '#2563EB12' }}
                    onPress={() => router.push({ pathname: '/patient-profile' as any, params: { patientName: 'Patient' } })}
                >
                    <Ionicons name="person" size={16} color="#2563EB" />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#2563EB' }}>Patient Profile</Text>
                </TouchableOpacity>
            </View>

            {/* Action Buttons */}
            <View style={{ marginTop: 8, marginBottom: 20, gap: 10 }}>
                <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: SUCCESS, borderRadius: 14, paddingVertical: 15, gap: 8, shadowColor: SUCCESS, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 }}
                    onPress={() => { setApproved(true); onApprove(); }}
                >
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff' }}>Approve & Save to History</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 13, gap: 6, borderRadius: 14, borderWidth: 1.5, borderColor: '#e0e0e0', backgroundColor: '#fff' }}
                    onPress={() => Alert.alert('Delete Note', 'Discard this note and session data?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: onDelete }])}
                >
                    <Ionicons name="trash-outline" size={18} color="#999" />
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#999' }}>Discard Note</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

// ─── Main Session Screen ────────────────────────────
export default function SessionScreen() {
    const {
        session, phase, isPaused, elapsedSeconds, transcript,
        processingStatus, processingProgress, clinicalNote,
        whisperStatus, whisperProgress, whisperResult,
        liveText,
        formatTime, startSession, togglePause, endSession, generateNote, resetSession,
    } = useActiveSession();

    const handleStart = useCallback((name: string, lang: string, specialty: string) => {
        startSession({ name, lang, specialty });
    }, [startSession]);

    // ─── Approve → send to FL ───────────────────────
    const handleApprove = useCallback(async () => {
        if (!clinicalNote || !transcript.length) return;
        try {
            const signalCount = await collectApprovedSession({
                session_id: session?.session_id || `session-${Date.now()}`,
                specialty: session?.specialty || 'general',
                transcript: transcript.map(t => ({
                    speaker: t.speaker,
                    text: t.text,
                    translatedText: t.translatedText,
                    entities: t.entities,
                    confidence: t.confidence,
                })),
                soap: clinicalNote.soap || { subjective: '', objective: '', assessment: '', plan: '' },
                icd_codes: clinicalNote.icd_codes || [],
                patient_summary: clinicalNote.patient_summary || '',
            });
            console.log(`✅ Approved: ${signalCount} signals sent to FL`);
        } catch (err) {
            console.warn('⚠️ FL upload failed (data saved locally):', err);
        }
    }, [clinicalNote, transcript, session]);

    return (
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#f8f9fa' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            {phase === 'setup' && <SetupView onStart={handleStart} />}
            {phase === 'recording' && <RecordingView elapsed={elapsedSeconds} paused={isPaused} onPause={togglePause} onEnd={endSession} fmt={formatTime} liveText={liveText} />}
            {(phase === 'processing' || phase === 'generating') && <ProcessingView status={processingStatus} progress={processingProgress} whisperStatus={whisperStatus} whisperProgress={whisperProgress} whisperResult={whisperResult} />}
            {phase === 'review' && <ReviewView transcript={transcript} whisperResult={whisperResult} onProceed={generateNote} />}
            {phase === 'complete' && <NoteView note={clinicalNote} onApprove={handleApprove} onDelete={resetSession} onNew={resetSession} />}
        </KeyboardAvoidingView>
    );
}

// ─── Styles ─────────────────────────────────────────
const s = StyleSheet.create({
    fieldLabel: { fontSize: 13, fontWeight: '700', color: '#333', marginBottom: 6, marginTop: 14 },
    textInput: { backgroundColor: '#fff', borderRadius: 12, padding: 14, fontSize: 16, borderWidth: 1, borderColor: '#e0e0e0', color: '#1a1a2e' },
    chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e0e0e0', gap: 4 },
    chipActive: { backgroundColor: PRIMARY + '15', borderColor: PRIMARY },
    chipLabel: { fontSize: 12, color: '#555' },
    chipLabelActive: { color: PRIMARY, fontWeight: '700' },
    primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: PRIMARY, borderRadius: 16, padding: 16, marginTop: 20, gap: 10 },
    primaryBtnText: { fontSize: 17, fontWeight: '800', color: '#fff' },
    ctrlBtn: { alignItems: 'center', justifyContent: 'center', width: 76, height: 76, borderRadius: 38 },
    ctrlLabel: { fontSize: 11, color: '#fff', fontWeight: '700', marginTop: 3 },
    bubble: { marginVertical: 4, padding: 12, borderRadius: 14 },
    bubbleDr: { backgroundColor: '#e8f0fe', marginRight: 30 },
    bubblePt: { backgroundColor: '#fef3e0', marginLeft: 30 },
    bubbleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    speakerBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, gap: 3 },
    speakerBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },
    bubbleText: { fontSize: 14, color: '#1a1a2e', lineHeight: 20 },
    translationBox: { marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#0001' },
    translationText: { fontSize: 13, color: '#3b82f6', fontStyle: 'italic', lineHeight: 18 },
    card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#eee' },
    cardTitle: { fontSize: 14, fontWeight: '800', color: '#1a1a2e', marginBottom: 8 },
    soapLabel: { fontSize: 12, fontWeight: '700', color: PRIMARY, marginBottom: 4, marginTop: 8 },
    editField: { backgroundColor: '#f8f9fa', borderRadius: 10, padding: 10, fontSize: 13, color: '#333', lineHeight: 20, minHeight: 60, borderWidth: 1, borderColor: '#e5e5e5' },
});

// ─── Note Styles ────────────────────────────────────
const ns = StyleSheet.create({
    card: {
        backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
    },
    editField: {
        backgroundColor: '#f8f9fa', borderRadius: 10, padding: 12, fontSize: 13,
        color: '#333', lineHeight: 20, minHeight: 70, borderWidth: 1, borderColor: '#eee',
    },
    icdRow: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
    },
    icdCodeBadge: {
        backgroundColor: PRIMARY + '10', paddingHorizontal: 8, paddingVertical: 3,
        borderRadius: 6, borderWidth: 1, borderColor: PRIMARY + '20',
    },
    icdCodeText: { fontSize: 12, fontWeight: '800', color: PRIMARY, letterSpacing: 0.3 },
    icdDesc: { fontSize: 12, color: '#555', flex: 1, lineHeight: 16 },
});
