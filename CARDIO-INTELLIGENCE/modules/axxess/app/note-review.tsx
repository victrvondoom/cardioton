/**
 * MedScribe — Note Review Screen
 * Rich clinical note display with SOAP cards, vitals chart,
 * risk gauge, medication table, ICD-10 codes, and patient summary.
 * Includes on-demand translation of patient summary via Gemini.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Share,
    Dimensions,
    Modal,
    FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Header, Card, Badge, Button } from '@/components/ui/axxess__components_ui__index';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/axxess__constants__theme';
import { useThemeColors } from '@/constants/useThemeColors';
import {
    getSession,
    getNoteForSession,
    getUtterancesForSession,
    upsertNote,
    updateNoteTranslation,
} from '@/src/modules/db/axxess__modules_db__queries';
import {
    generateClinicalNote,
    translateText,
    type ClinicalNoteResult,
    type VitalSign,
    type RiskFactor,
    type MedicationEntry,
} from '@/src/modules/ai/gemini';
import {
    generateFHIRBundle,
    generateClinicalNoteText,
} from '@/src/modules/fhir/generator';
import type { Session, Note, SOAPNote, ICDCode } from '@/src/types/axxess__src_types__index';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Language Options for Translation ────────────────

const TRANSLATE_LANGUAGES = [
    { code: 'es', label: 'Spanish', flag: '🇲🇽' },
    { code: 'fr', label: 'French', flag: '🇫🇷' },
    { code: 'ar', label: 'Arabic', flag: '🇸🇦' },
    { code: 'ht', label: 'Haitian Creole', flag: '🇭🇹' },
    { code: 'vi', label: 'Vietnamese', flag: '🇻🇳' },
    { code: 'zh', label: 'Chinese (Simplified)', flag: '🇨🇳' },
    { code: 'ko', label: 'Korean', flag: '🇰🇷' },
    { code: 'ru', label: 'Russian', flag: '🇷🇺' },
    { code: 'km', label: 'Khmer', flag: '🇰🇭' },
    { code: 'pt', label: 'Portuguese', flag: '🇧🇷' },
    { code: 'ja', label: 'Japanese', flag: '🇯🇵' },
    { code: 'de', label: 'German', flag: '🇩🇪' },
    { code: 'it', label: 'Italian', flag: '🇮🇹' },
    { code: 'pl', label: 'Polish', flag: '🇵🇱' },
    { code: 'hi', label: 'Hindi', flag: '🇮🇳' },
    { code: 'en', label: 'English (Original)', flag: '🇺🇸' },
];

function getLangLabel(code: string): string {
    return TRANSLATE_LANGUAGES.find(l => l.code === code)?.label || code;
}

// ─── Visual Components ──────────────────────────────

function ConfidenceBar({ value, color }: { value: number; color: string }) {
    return (
        <View style={styles.confidenceBar}>
            <View style={[styles.confidenceFill, { width: `${Math.round(value * 100)}%`, backgroundColor: color }]} />
        </View>
    );
}

function getConfidenceColor(value: number): string {
    if (value >= 0.9) return Colors.statusGreen;
    if (value >= 0.75) return Colors.statusAmber;
    return Colors.statusRed;
}

const RISK_COLORS: Record<string, string> = {
    low: Colors.statusGreen,
    moderate: Colors.statusAmber,
    high: '#E65100',
    critical: Colors.statusRed,
};

const VITAL_STATUS_COLORS: Record<string, string> = {
    normal: Colors.statusGreen,
    elevated: Colors.statusAmber,
    low: '#2196F3',
    critical: Colors.statusRed,
};

const MED_STATUS_COLORS: Record<string, string> = {
    current: Colors.statusGreen,
    new: '#2563EB',
    discontinued: Colors.statusRed,
    modified: Colors.statusAmber,
};

// Vitals Visualization
function VitalsCard({ vitals, colors: theme }: { vitals: VitalSign[]; colors: any }) {
    if (vitals.length === 0) return null;

    return (
        <>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
                <Ionicons name="pulse" size={18} /> Vital Signs
            </Text>
            <Card style={styles.vitalsCard}>
                {vitals.map((vital, i) => (
                    <View key={vital.name}>
                        <View style={styles.vitalRow}>
                            <View style={styles.vitalInfo}>
                                <Text style={[styles.vitalName, { color: theme.textPrimary }]}>{vital.name}</Text>
                                <Text style={[styles.vitalRef, { color: theme.textTertiary }]}>{vital.reference_range}</Text>
                            </View>
                            <View style={styles.vitalValueContainer}>
                                <Text style={[styles.vitalValue, { color: VITAL_STATUS_COLORS[vital.status] }]}>
                                    {vital.value}
                                </Text>
                                <Text style={[styles.vitalUnit, { color: theme.textTertiary }]}>{vital.unit}</Text>
                            </View>
                            <View style={[styles.vitalStatusDot, { backgroundColor: VITAL_STATUS_COLORS[vital.status] }]}>
                                <Ionicons
                                    name={vital.status === 'normal' ? 'checkmark' : vital.status === 'critical' ? 'alert' : 'trending-up'}
                                    size={12}
                                    color="#FFFFFF"
                                />
                            </View>
                        </View>
                        <View style={styles.vitalBarContainer}>
                            <View style={[styles.vitalBarTrack, { backgroundColor: theme.divider }]}>
                                <View
                                    style={[
                                        styles.vitalBarFill,
                                        {
                                            backgroundColor: VITAL_STATUS_COLORS[vital.status],
                                            width: vital.status === 'normal' ? '60%' : vital.status === 'elevated' ? '80%' : vital.status === 'critical' ? '95%' : '40%',
                                        },
                                    ]}
                                />
                            </View>
                        </View>
                        {i < vitals.length - 1 && <View style={[styles.divider, { backgroundColor: theme.divider }]} />}
                    </View>
                ))}
            </Card>
        </>
    );
}

// Risk Assessment Gauge
function RiskAssessment({ risks, colors: theme }: { risks: RiskFactor[]; colors: any }) {
    if (risks.length === 0) return null;

    return (
        <>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
                <Ionicons name="shield-checkmark" size={18} /> Risk Assessment
            </Text>
            <Card style={styles.riskCard}>
                {risks.map((risk, i) => (
                    <View key={risk.factor}>
                        <View style={styles.riskRow}>
                            <View style={[styles.riskLevel, { backgroundColor: RISK_COLORS[risk.level] + '15' }]}>
                                <Text style={[styles.riskLevelText, { color: RISK_COLORS[risk.level] }]}>
                                    {risk.level.toUpperCase()}
                                </Text>
                            </View>
                            <View style={styles.riskInfo}>
                                <Text style={[styles.riskFactor, { color: theme.textPrimary }]}>{risk.factor}</Text>
                                <Text style={[styles.riskDetail, { color: theme.textSecondary }]}>{risk.detail}</Text>
                            </View>
                        </View>
                        <View style={styles.riskGaugeContainer}>
                            <View style={[styles.riskGaugeTrack, { backgroundColor: theme.divider }]}>
                                <View
                                    style={[
                                        styles.riskGaugeFill,
                                        {
                                            backgroundColor: RISK_COLORS[risk.level],
                                            width: risk.level === 'low' ? '25%' : risk.level === 'moderate' ? '50%' : risk.level === 'high' ? '75%' : '100%',
                                        },
                                    ]}
                                />
                            </View>
                            <View style={styles.riskGaugeLabels}>
                                <Text style={[styles.riskGaugeLabel, { color: theme.textTertiary }]}>Low</Text>
                                <Text style={[styles.riskGaugeLabel, { color: theme.textTertiary }]}>Moderate</Text>
                                <Text style={[styles.riskGaugeLabel, { color: theme.textTertiary }]}>High</Text>
                                <Text style={[styles.riskGaugeLabel, { color: theme.textTertiary }]}>Critical</Text>
                            </View>
                        </View>
                        {i < risks.length - 1 && <View style={[styles.divider, { backgroundColor: theme.divider }]} />}
                    </View>
                ))}
            </Card>
        </>
    );
}

// Medications Table
function MedicationsTable({ medications, colors: theme }: { medications: MedicationEntry[]; colors: any }) {
    if (medications.length === 0) return null;

    return (
        <>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
                <Ionicons name="medkit" size={18} /> Medications
            </Text>
            <Card style={styles.medsCard}>
                {medications.map((med, i) => (
                    <View key={`${med.name}-${i}`}>
                        <View style={styles.medRow}>
                            <View style={styles.medInfo}>
                                <View style={styles.medHeader}>
                                    <Text style={[styles.medName, { color: theme.textPrimary }]}>{med.name}</Text>
                                    <View style={[styles.medStatusPill, { backgroundColor: MED_STATUS_COLORS[med.status] + '20' }]}>
                                        <View style={[styles.medStatusDot, { backgroundColor: MED_STATUS_COLORS[med.status] }]} />
                                        <Text style={[styles.medStatusText, { color: MED_STATUS_COLORS[med.status] }]}>
                                            {med.status.charAt(0).toUpperCase() + med.status.slice(1)}
                                        </Text>
                                    </View>
                                </View>
                                <Text style={[styles.medDose, { color: theme.secondary }]}>
                                    {med.dosage} • {med.frequency} • {med.route}
                                </Text>
                                <Text style={[styles.medIndication, { color: theme.textTertiary }]}>
                                    {med.indication}
                                </Text>
                            </View>
                        </View>
                        {i < medications.length - 1 && <View style={[styles.divider, { backgroundColor: theme.divider }]} />}
                    </View>
                ))}
            </Card>
        </>
    );
}

// ─── Language Picker Modal ───────────────────────────

function LanguagePickerModal({
    visible,
    onClose,
    onSelect,
    currentLang,
}: {
    visible: boolean;
    onClose: () => void;
    onSelect: (code: string) => void;
    currentLang: string;
}) {
    const colors = useThemeColors();
    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={langStyles.overlay}>
                <View style={[langStyles.sheet, { backgroundColor: colors.surface }]}>
                    <View style={langStyles.handle} />
                    <View style={langStyles.header}>
                        <Text style={[langStyles.title, { color: colors.textPrimary }]}>Translate To</Text>
                        <TouchableOpacity onPress={onClose} style={langStyles.closeBtn}>
                            <Ionicons name="close" size={22} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                    <Text style={[langStyles.subtitle, { color: colors.textTertiary }]}>
                        Select a language to translate the patient summary
                    </Text>
                    <FlatList
                        data={TRANSLATE_LANGUAGES}
                        keyExtractor={(item) => item.code}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={[
                                    langStyles.langRow,
                                    { borderBottomColor: colors.divider },
                                    item.code === currentLang && { backgroundColor: colors.primary + '10' },
                                ]}
                                onPress={() => { onSelect(item.code); onClose(); }}
                                activeOpacity={0.7}
                            >
                                <Text style={langStyles.flag}>{item.flag}</Text>
                                <Text style={[langStyles.langLabel, { color: colors.textPrimary }]}>{item.label}</Text>
                                {item.code === currentLang && (
                                    <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                                )}
                            </TouchableOpacity>
                        )}
                        showsVerticalScrollIndicator={false}
                        style={{ maxHeight: 400 }}
                    />
                </View>
            </View>
        </Modal>
    );
}

// ─── Main Screen ────────────────────────────────────

export default function NoteReviewScreen() {
    const colors = useThemeColors();
    const router = useRouter();
    const { sessionId } = useLocalSearchParams<{ sessionId: string }>();

    const [session, setSession] = useState<Session | null>(null);
    const [soap, setSoap] = useState<SOAPNote | null>(null);
    const [icdCodes, setIcdCodes] = useState<ICDCode[]>([]);
    const [patientSummary, setPatientSummary] = useState('');
    const [contradictions, setContradictions] = useState<string[]>([]);
    const [vitals, setVitals] = useState<VitalSign[]>([]);
    const [risks, setRisks] = useState<RiskFactor[]>([]);
    const [medications, setMedications] = useState<MedicationEntry[]>([]);
    const [keyFindings, setKeyFindings] = useState<string[]>([]);
    const [differentials, setDifferentials] = useState<string[]>([]);
    const [urgency, setUrgency] = useState<string>('routine');
    const [followUp, setFollowUp] = useState<number>(7);

    // Translation state
    const [translatedSummary, setTranslatedSummary] = useState('');
    const [translatedSummaryLang, setTranslatedSummaryLang] = useState('');
    const [isTranslating, setIsTranslating] = useState(false);
    const [showLangPicker, setShowLangPicker] = useState(false);
    const [showTranslated, setShowTranslated] = useState(true);

    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);

    useEffect(() => {
        loadData();
    }, [sessionId]);

    async function loadData() {
        if (!sessionId) return;
        try {
            const [sess, existingNote] = await Promise.all([
                getSession(sessionId),
                getNoteForSession(sessionId),
            ]);
            setSession(sess);

            if (existingNote) {
                try {
                    setSoap(JSON.parse(existingNote.soap_json || '{}'));
                    setIcdCodes(JSON.parse(existingNote.icd_codes_json || '[]'));
                    setPatientSummary(existingNote.patient_summary || '');
                    const flags = existingNote.contradiction_flags;
                    setContradictions(flags ? JSON.parse(flags) : []);

                    // Load full clinical result if stored (vitals, risks, medications, etc.)
                    if (existingNote.full_result_json) {
                        const fullResult: ClinicalNoteResult = JSON.parse(existingNote.full_result_json);
                        setVitals(fullResult.vitals || []);
                        setRisks(fullResult.risk_factors || []);
                        setMedications(fullResult.medications || []);
                        setKeyFindings(fullResult.key_findings || []);
                        setDifferentials(fullResult.differential_diagnoses || []);
                        setUrgency(fullResult.urgency_level || 'routine');
                        setFollowUp(fullResult.follow_up_days || 7);
                    }

                    // Load saved translation if exists
                    if (existingNote.translated_summary) {
                        setTranslatedSummary(existingNote.translated_summary);
                        setTranslatedSummaryLang(existingNote.translated_summary_lang || '');
                        setShowTranslated(true);
                    }
                } catch (e) {
                    console.error('Parse error:', e);
                }
            }
        } catch (err) {
            console.error('Load error:', err);
        } finally {
            setLoading(false);
        }
    }

    async function handleGenerate() {
        if (!sessionId || !session) return;

        try {
            setGenerating(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

            const utterances = await getUtterancesForSession(sessionId);

            if (utterances.length === 0) {
                Alert.alert('No Transcript', 'This session has no transcript data to generate notes from.');
                setGenerating(false);
                return;
            }

            const result = await generateClinicalNote(
                utterances.map((u) => ({ speaker: u.speaker, text: u.original_text, confidence: u.confidence })),
                session.specialty,
                session.patient_lang
            );

            // Upsert to DB (update if exists, create if not) — include full result JSON
            await upsertNote({
                session_id: sessionId,
                soap_json: JSON.stringify(result.soap),
                icd_codes_json: JSON.stringify(result.icd_codes),
                patient_summary: result.patient_summary,
                contradiction_flags: JSON.stringify(result.contradiction_flags),
                gemini_model: 'gemini-2.5-pro',
                full_result_json: JSON.stringify(result),
            });

            // Update state
            setSoap(result.soap);
            setIcdCodes(result.icd_codes);
            setPatientSummary(result.patient_summary);
            setContradictions(result.contradiction_flags);
            setVitals(result.vitals);
            setRisks(result.risk_factors);
            setMedications(result.medications);
            setKeyFindings(result.key_findings);
            setDifferentials(result.differential_diagnoses);
            setUrgency(result.urgency_level);
            setFollowUp(result.follow_up_days);

            // Reset any previous translation when note is regenerated
            setTranslatedSummary('');
            setTranslatedSummaryLang('');

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (err: any) {
            Alert.alert('Generation Failed', err.message || 'Failed to generate clinical notes.');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setGenerating(false);
        }
    }

    // ─── Translation ─────────────────────────────────
    const handleTranslateSelect = useCallback(async (targetLang: string) => {
        if (!patientSummary || !sessionId) return;

        // If user picks English (original), just clear the translation
        if (targetLang === 'en') {
            setTranslatedSummary('');
            setTranslatedSummaryLang('');
            setShowTranslated(false);
            await updateNoteTranslation(sessionId, '', '');
            return;
        }

        // If same lang already translated, just toggle display
        if (targetLang === translatedSummaryLang && translatedSummary) {
            setShowTranslated(true);
            return;
        }

        try {
            setIsTranslating(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

            const translated = await translateText(patientSummary, 'en', targetLang);
            setTranslatedSummary(translated);
            setTranslatedSummaryLang(targetLang);
            setShowTranslated(true);

            // Save translation to DB
            await updateNoteTranslation(sessionId, translated, targetLang);

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (err: any) {
            Alert.alert('Translation Failed', err.message || 'Could not translate the patient summary. Check your connection and try again.');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setIsTranslating(false);
        }
    }, [patientSummary, sessionId, translatedSummaryLang, translatedSummary]);

    async function handleShare() {
        if (!soap || !session) return;
        try {
            const note = await getNoteForSession(sessionId!);
            if (note) {
                const text = generateClinicalNoteText(session, note);
                await Share.share({ message: text, title: `Clinical Note — ${session.patient_name}` });
            }
        } catch { }
    }

    async function handleExportFHIR() {
        if (!session) return;
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            const [note, utterances] = await Promise.all([
                getNoteForSession(sessionId!),
                getUtterancesForSession(sessionId!),
            ]);
            const bundle = generateFHIRBundle(session, note, utterances);
            const json = JSON.stringify(bundle, null, 2);
            await Share.share({ message: json, title: `FHIR R4 Bundle — ${session.patient_name}` });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (err: any) {
            Alert.alert('Export Failed', err.message || 'Failed to export FHIR bundle.');
        }
    }

    const formatDuration = (ms: number | null) => ms ? `${Math.round(ms / 60000)} min` : '--';

    if (loading) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <Header title="Clinical Note" leftElement={<TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color="#FFFFFF" /></TouchableOpacity>} />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </View>
        );
    }

    const URGENCY_COLORS: Record<string, string> = { routine: Colors.statusGreen, urgent: Colors.statusAmber, emergent: Colors.statusRed };

    const displayedSummaryText = showTranslated && translatedSummary ? translatedSummary : patientSummary;

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <Header
                title="Clinical Note"
                subtitle={session?.patient_name || 'Patient'}
                leftElement={<TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color="#FFFFFF" /></TouchableOpacity>}
                rightElement={<TouchableOpacity onPress={handleShare}><Ionicons name="share-outline" size={22} color="#FFFFFF" /></TouchableOpacity>}
            />

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Session Info + Urgency */}
                <Card style={styles.infoCard}>
                    <View style={styles.infoRow}>
                        <View style={styles.infoItem}>
                            <Text style={[styles.infoLabel, { color: colors.textTertiary }]}>Specialty</Text>
                            <Text style={[styles.infoValue, { color: colors.textPrimary }]}>
                                {(session?.specialty || 'General').charAt(0).toUpperCase() + (session?.specialty || 'general').slice(1)}
                            </Text>
                        </View>
                        <View style={styles.infoItem}>
                            <Text style={[styles.infoLabel, { color: colors.textTertiary }]}>Duration</Text>
                            <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{formatDuration(session?.duration_ms || null)}</Text>
                        </View>
                        <View style={styles.infoItem}>
                            <Text style={[styles.infoLabel, { color: colors.textTertiary }]}>Urgency</Text>
                            <View style={[styles.urgencyPill, { backgroundColor: (URGENCY_COLORS[urgency] || Colors.statusGreen) + '20' }]}>
                                <View style={[styles.urgencyDot, { backgroundColor: URGENCY_COLORS[urgency] || Colors.statusGreen }]} />
                                <Text style={[styles.urgencyText, { color: URGENCY_COLORS[urgency] || Colors.statusGreen }]}>
                                    {urgency.charAt(0).toUpperCase() + urgency.slice(1)}
                                </Text>
                            </View>
                        </View>
                    </View>
                    {followUp > 0 && soap && (
                        <View style={[styles.followUpBanner, { backgroundColor: colors.secondary + '10' }]}>
                            <Ionicons name="calendar-outline" size={16} color={colors.secondary} />
                            <Text style={[styles.followUpText, { color: colors.secondary }]}>
                                Follow-up in {followUp} days
                            </Text>
                        </View>
                    )}
                </Card>

                {/* Key Findings */}
                {keyFindings.length > 0 && (
                    <>
                        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                            <Ionicons name="flash" size={18} /> Key Findings
                        </Text>
                        <Card style={styles.findingsCard}>
                            {keyFindings.map((finding, i) => (
                                <View key={i} style={styles.findingRow}>
                                    <View style={[styles.findingBullet, { backgroundColor: colors.primary }]}>
                                        <Text style={styles.findingBulletText}>{i + 1}</Text>
                                    </View>
                                    <Text style={[styles.findingText, { color: colors.textPrimary }]}>{finding}</Text>
                                </View>
                            ))}
                        </Card>
                    </>
                )}

                {/* SOAP Note */}
                {soap ? (
                    <>
                        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>SOAP Note</Text>
                        {[
                            { key: 'S', title: 'Subjective', text: soap.subjective, color: '#2563EB' },
                            { key: 'O', title: 'Objective', text: soap.objective, color: '#059669' },
                            { key: 'A', title: 'Assessment', text: soap.assessment, color: '#D97706' },
                            { key: 'P', title: 'Plan', text: soap.plan, color: Colors.primary },
                        ].map((section) => (
                            <Card key={section.key} accentColor={section.color} style={styles.soapCard}>
                                <View style={styles.soapHeader}>
                                    <View style={[styles.soapBadge, { backgroundColor: section.color }]}>
                                        <Text style={styles.soapBadgeText}>{section.key}</Text>
                                    </View>
                                    <Text style={[styles.soapTitle, { color: colors.textPrimary }]}>{section.title}</Text>
                                </View>
                                <Text style={[styles.soapText, { color: colors.textSecondary }]}>{section.text}</Text>
                            </Card>
                        ))}
                    </>
                ) : (
                    <Card style={styles.emptyCard}>
                        <View style={styles.emptyContent}>
                            <Ionicons name="sparkles" size={48} color={colors.primary} />
                            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                                Generate AI Clinical Notes
                            </Text>
                            <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
                                Gemini 2.5 Pro will analyze the transcript and generate detailed SOAP notes, ICD-10 codes, vitals summary, risk assessment, and patient instructions.
                            </Text>
                            <TouchableOpacity
                                style={[styles.generateButton, { backgroundColor: colors.primary }]}
                                onPress={handleGenerate}
                                disabled={generating}
                                activeOpacity={0.8}
                            >
                                {generating ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <Ionicons name="sparkles" size={20} color="#FFFFFF" />
                                )}
                                <Text style={styles.generateButtonText}>
                                    {generating ? 'Analyzing transcript...' : 'Generate with Gemini AI'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </Card>
                )}

                {/* Vitals */}
                <VitalsCard vitals={vitals} colors={colors} />

                {/* Risk Assessment */}
                <RiskAssessment risks={risks} colors={colors} />

                {/* Medications */}
                <MedicationsTable medications={medications} colors={colors} />

                {/* Differential Diagnoses */}
                {differentials.length > 0 && (
                    <>
                        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                            <Ionicons name="git-branch" size={18} /> Differential Diagnoses
                        </Text>
                        <Card style={styles.diffCard}>
                            {differentials.map((dx, i) => (
                                <View key={i} style={styles.diffRow}>
                                    <Text style={[styles.diffRank, { color: i === 0 ? colors.primary : colors.textTertiary }]}>
                                        {i === 0 ? '★' : `${i + 1}.`}
                                    </Text>
                                    <Text style={[styles.diffText, { color: colors.textPrimary, fontWeight: i === 0 ? '600' : '400' }]}>
                                        {dx}
                                    </Text>
                                    {i === 0 && <Badge label="MOST LIKELY" variant="error" />}
                                </View>
                            ))}
                        </Card>
                    </>
                )}

                {/* ICD-10 Codes */}
                {icdCodes.length > 0 && (
                    <>
                        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>ICD-10 Codes</Text>
                        <Card style={styles.icdCard}>
                            {icdCodes.map((code, i) => (
                                <View key={code.code}>
                                    <View style={styles.icdRow}>
                                        <View style={styles.icdCodeRow}>
                                            <Text style={[styles.icdCode, { color: colors.primary }]}>{code.code}</Text>
                                            {code.is_primary && <Badge label="PRIMARY" variant="error" style={{ marginLeft: 8 }} />}
                                        </View>
                                        <Text style={[styles.icdDesc, { color: colors.textSecondary }]}>{code.description}</Text>
                                        <View style={styles.confidenceRow}>
                                            <Text style={[styles.confidenceLabel, { color: colors.textTertiary }]}>AI Confidence</Text>
                                            <Text style={[styles.confidenceValue, { color: getConfidenceColor(code.confidence) }]}>
                                                {Math.round(code.confidence * 100)}%
                                            </Text>
                                        </View>
                                        <ConfidenceBar value={code.confidence} color={getConfidenceColor(code.confidence)} />
                                    </View>
                                    {i < icdCodes.length - 1 && <View style={[styles.divider, { backgroundColor: colors.divider }]} />}
                                </View>
                            ))}
                        </Card>
                    </>
                )}

                {/* Patient Summary + Translation */}
                {patientSummary ? (
                    <>
                        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Patient Summary</Text>
                        <Card accentColor={colors.secondary} style={styles.summaryCard}>
                            {/* Header row */}
                            <View style={styles.summaryHeader}>
                                <Ionicons name="person-circle-outline" size={22} color={colors.secondary} />
                                <Text style={[styles.summaryLabel, { color: colors.secondary }]}>Patient-Facing Instructions</Text>
                                {translatedSummary ? (
                                    <View style={[styles.translatedBadge, { backgroundColor: colors.secondary + '15' }]}>
                                        <Ionicons name="language" size={12} color={colors.secondary} />
                                        <Text style={[styles.translatedBadgeText, { color: colors.secondary }]}>
                                            {getLangLabel(translatedSummaryLang)}
                                        </Text>
                                    </View>
                                ) : null}
                            </View>

                            {/* Summary text (translated or original) */}
                            <Text style={[styles.summaryText, { color: colors.textPrimary }]}>
                                {displayedSummaryText}
                            </Text>

                            {/* Toggle between original/translated */}
                            {translatedSummary ? (
                                <TouchableOpacity
                                    style={[styles.toggleOriginalBtn, { borderColor: colors.divider }]}
                                    onPress={() => setShowTranslated(v => !v)}
                                >
                                    <Ionicons name={showTranslated ? 'eye-off-outline' : 'eye-outline'} size={14} color={colors.textTertiary} />
                                    <Text style={[styles.toggleOriginalText, { color: colors.textTertiary }]}>
                                        {showTranslated ? 'Show original English' : `Show ${getLangLabel(translatedSummaryLang)}`}
                                    </Text>
                                </TouchableOpacity>
                            ) : null}

                            {/* Translate button */}
                            <TouchableOpacity
                                style={[
                                    styles.translateButton,
                                    {
                                        backgroundColor: isTranslating ? colors.divider : colors.secondary + '12',
                                        borderColor: colors.secondary,
                                    },
                                ]}
                                onPress={() => setShowLangPicker(true)}
                                disabled={isTranslating}
                                activeOpacity={0.75}
                            >
                                {isTranslating ? (
                                    <ActivityIndicator size="small" color={colors.secondary} />
                                ) : (
                                    <Ionicons name="language" size={16} color={colors.secondary} />
                                )}
                                <Text style={[styles.translateButtonText, { color: colors.secondary }]}>
                                    {isTranslating
                                        ? 'Translating...'
                                        : translatedSummary
                                            ? `Retranslate (${getLangLabel(translatedSummaryLang)})`
                                            : 'Translate Summary'}
                                </Text>
                                {!isTranslating && (
                                    <Ionicons name="chevron-forward" size={14} color={colors.secondary} />
                                )}
                            </TouchableOpacity>
                        </Card>
                    </>
                ) : null}

                {/* Contradiction Flags */}
                {contradictions.length > 0 && (
                    <>
                        <Text style={[styles.sectionTitle, { color: Colors.statusAmber }]}>
                            <Ionicons name="warning" size={18} /> Contradiction Flags
                        </Text>
                        <Card style={styles.contradictionCard}>
                            {contradictions.map((flag, i) => (
                                <View key={i} style={styles.contradictionRow}>
                                    <Ionicons name="warning" size={18} color={Colors.statusAmber} />
                                    <Text style={[styles.contradictionText, { color: colors.textPrimary }]}>{flag}</Text>
                                </View>
                            ))}
                        </Card>
                    </>
                )}

                {/* Actions */}
                {soap && (
                    <View style={styles.actionsSection}>
                        <View style={styles.actionsRow}>
                            <TouchableOpacity
                                style={[styles.actionButton, { backgroundColor: Colors.statusGreen + '15' }]}
                                onPress={handleExportFHIR}
                            >
                                <Ionicons name="code-slash" size={18} color={Colors.statusGreen} />
                                <Text style={[styles.actionButtonText, { color: Colors.statusGreen }]}>Export FHIR</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.actionButton, { backgroundColor: colors.secondary + '15' }]}
                                onPress={() => router.push({ pathname: '/patient-profile', params: { patientName: session?.patient_name } })}
                            >
                                <Ionicons name="person" size={18} color={colors.secondary} />
                                <Text style={[styles.actionButtonText, { color: colors.secondary }]}>Patient Profile</Text>
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity
                            style={[styles.regenButton, { borderColor: colors.primary }]}
                            onPress={handleGenerate}
                            disabled={generating}
                        >
                            <Ionicons name="refresh" size={18} color={colors.primary} />
                            <Text style={[styles.regenText, { color: colors.primary }]}>
                                {generating ? 'Regenerating...' : 'Regenerate Notes'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}

                <View style={{ height: 48 }} />
            </ScrollView>

            {/* Language Picker Modal */}
            <LanguagePickerModal
                visible={showLangPicker}
                onClose={() => setShowLangPicker(false)}
                onSelect={handleTranslateSelect}
                currentLang={translatedSummaryLang || 'en'}
            />
        </View>
    );
}

// ─── Styles ─────────────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollView: { flex: 1 },
    scrollContent: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md },
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    sectionTitle: { ...Typography.h3, marginTop: Spacing.lg, marginBottom: Spacing.sm },
    // Info
    infoCard: { marginBottom: 0 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
    infoItem: { alignItems: 'center', flex: 1 },
    infoLabel: { ...Typography.caption, marginBottom: 4 },
    infoValue: { ...Typography.body, fontWeight: '600' },
    urgencyPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill },
    urgencyDot: { width: 8, height: 8, borderRadius: 4 },
    urgencyText: { ...Typography.caption, fontWeight: '700' },
    followUpBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm, paddingVertical: Spacing.xs + 2, paddingHorizontal: Spacing.sm, borderRadius: Radius.sm },
    followUpText: { ...Typography.bodySmall, fontWeight: '600' },
    // Key Findings
    findingsCard: { marginBottom: 0 },
    findingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, paddingVertical: 6 },
    findingBullet: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    findingBulletText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
    findingText: { ...Typography.body, flex: 1, lineHeight: 22 },
    // SOAP
    soapCard: { marginBottom: Spacing.sm },
    soapHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
    soapBadge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    soapBadgeText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
    soapTitle: { ...Typography.h3, marginBottom: 0 },
    soapText: { ...Typography.body, lineHeight: 24 },
    // Empty
    emptyCard: { marginBottom: 0, marginTop: Spacing.md },
    emptyContent: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.md },
    emptyTitle: { ...Typography.h2, textAlign: 'center' },
    emptySubtitle: { ...Typography.body, textAlign: 'center', lineHeight: 22, paddingHorizontal: Spacing.md },
    generateButton: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl, borderRadius: Radius.md, marginTop: Spacing.sm, ...Shadows.elevated },
    generateButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
    // Vitals
    vitalsCard: { marginBottom: 0 },
    vitalRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.xs },
    vitalInfo: { flex: 1 },
    vitalName: { ...Typography.body, fontWeight: '600' },
    vitalRef: { ...Typography.caption, fontSize: 11 },
    vitalValueContainer: { alignItems: 'flex-end', marginRight: Spacing.sm },
    vitalValue: { fontSize: 18, fontWeight: '700' },
    vitalUnit: { ...Typography.caption, fontSize: 11 },
    vitalStatusDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    vitalBarContainer: { marginTop: 4, marginBottom: 4 },
    vitalBarTrack: { height: 4, borderRadius: 2 },
    vitalBarFill: { height: 4, borderRadius: 2 },
    // Risk
    riskCard: { marginBottom: 0 },
    riskRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, paddingVertical: Spacing.xs },
    riskLevel: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.sm, minWidth: 72, alignItems: 'center' },
    riskLevelText: { ...Typography.badge, fontWeight: '800', fontSize: 10 },
    riskInfo: { flex: 1 },
    riskFactor: { ...Typography.body, fontWeight: '600' },
    riskDetail: { ...Typography.bodySmall, lineHeight: 20, marginTop: 2 },
    riskGaugeContainer: { marginTop: Spacing.xs, marginBottom: Spacing.xs },
    riskGaugeTrack: { height: 6, borderRadius: 3 },
    riskGaugeFill: { height: 6, borderRadius: 3 },
    riskGaugeLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
    riskGaugeLabel: { ...Typography.caption, fontSize: 9 },
    // Medications
    medsCard: { marginBottom: 0 },
    medRow: { paddingVertical: Spacing.xs },
    medInfo: { flex: 1 },
    medHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 2 },
    medName: { ...Typography.body, fontWeight: '600', flex: 1 },
    medStatusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.pill },
    medStatusDot: { width: 6, height: 6, borderRadius: 3 },
    medStatusText: { ...Typography.caption, fontSize: 10, fontWeight: '700' },
    medDose: { ...Typography.bodySmall, fontWeight: '500' },
    medIndication: { ...Typography.caption, marginTop: 2 },
    // Differentials
    diffCard: { marginBottom: 0 },
    diffRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6 },
    diffRank: { fontSize: 16, width: 24, textAlign: 'center' },
    diffText: { ...Typography.body, flex: 1 },
    // ICD
    icdCard: { marginBottom: 0 },
    icdRow: { paddingVertical: Spacing.xs },
    icdCodeRow: { flexDirection: 'row', alignItems: 'center' },
    icdCode: { ...Typography.h3, fontFamily: 'SpaceMono' },
    icdDesc: { ...Typography.body, marginTop: 2, marginBottom: Spacing.xs },
    confidenceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    confidenceLabel: { ...Typography.caption },
    confidenceValue: { ...Typography.caption, fontWeight: '700' },
    confidenceBar: { height: 4, borderRadius: 2, backgroundColor: '#E9ECEF' },
    confidenceFill: { height: 4, borderRadius: 2 },
    // Summary
    summaryCard: { marginBottom: 0 },
    summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
    summaryLabel: { ...Typography.badge, fontWeight: '700', flex: 1 },
    summaryText: { ...Typography.body, lineHeight: 26 },
    translatedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: Radius.pill,
    },
    translatedBadgeText: { fontSize: 10, fontWeight: '700' },
    toggleOriginalBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: Spacing.sm,
        paddingTop: Spacing.sm,
        borderTopWidth: 1,
    },
    toggleOriginalText: { ...Typography.caption },
    translateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: Spacing.md,
        paddingVertical: Spacing.sm + 2,
        paddingHorizontal: Spacing.md,
        borderRadius: Radius.md,
        borderWidth: 1.5,
    },
    translateButtonText: { ...Typography.body, fontWeight: '600', fontSize: 14 },
    // Contradictions
    contradictionCard: { marginBottom: 0 },
    contradictionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, paddingVertical: Spacing.xs },
    contradictionText: { ...Typography.body, flex: 1 },
    // Actions
    actionsSection: { marginTop: Spacing.lg },
    actionsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
    actionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: Spacing.sm + 2, borderRadius: Radius.md },
    actionButtonText: { fontWeight: '600', fontSize: 13 },
    regenButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, borderRadius: Radius.md, borderWidth: 2 },
    regenText: { fontWeight: '700', fontSize: 15 },
    divider: { height: 1, marginVertical: Spacing.sm },
});

// ─── Language Picker Styles ──────────────────────────

const langStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    sheet: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.sm,
        paddingBottom: 40,
        maxHeight: '80%',
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#D1D5DB',
        alignSelf: 'center',
        marginBottom: Spacing.md,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.xs,
    },
    title: { ...Typography.h2, flex: 1 },
    closeBtn: { padding: 4 },
    subtitle: { ...Typography.caption, marginBottom: Spacing.md },
    langRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 4,
        borderBottomWidth: 1,
        gap: Spacing.sm,
    },
    flag: { fontSize: 22, width: 32 },
    langLabel: { ...Typography.body, flex: 1 },
});
