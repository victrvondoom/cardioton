/**
 * MedScribe — Patient Profile Screen
 * Shows patient visit history, trends, and clinical timeline.
 * Accessed as a detail view from Dashboard or History.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Share,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Header, Card, Badge, Button } from '@/components/ui/axxess__components_ui__index';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/axxess__constants__theme';
import { useThemeColors } from '@/constants/useThemeColors';
import {
    getSessionsWithNotes,
    getNoteForSession,
    getUtterancesForSession,
} from '@/src/modules/db/axxess__modules_db__queries';
import {
    generateFHIRBundle,
    generateClinicalNoteText,
} from '@/src/modules/fhir/generator';
import type { SessionWithNote, Note } from '@/src/types/axxess__src_types__index';

function formatDate(ts: number): string {
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatDuration(ms: number | null): string {
    if (!ms) return '--';
    const mins = Math.round(ms / 60000);
    return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

const STATUS_COLORS: Record<string, string> = {
    complete: Colors.statusGreen,
    processing: Colors.statusAmber,
    error: Colors.statusRed,
    recording: '#2563EB',
};

export default function PatientProfileScreen() {
    const colors = useThemeColors();
    const router = useRouter();
    const { patientName } = useLocalSearchParams<{ patientName: string }>();

    const [sessions, setSessions] = useState<SessionWithNote[]>([]);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState<string | null>(null);

    useEffect(() => {
        loadPatientSessions();
    }, [patientName]);

    const loadPatientSessions = useCallback(async () => {
        try {
            const allSessions = await getSessionsWithNotes(100);
            const patientSessions = allSessions.filter(
                (s) => s.patient_name.toLowerCase() === (patientName || '').toLowerCase()
            );
            setSessions(patientSessions);
        } catch (err) {
            console.error('Load error:', err);
        } finally {
            setLoading(false);
        }
    }, [patientName]);

    const handleExportFHIR = useCallback(async (session: SessionWithNote) => {
        try {
            setExporting(session.session_id);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

            const note = await getNoteForSession(session.session_id);
            const utterances = await getUtterancesForSession(session.session_id);
            const bundle = generateFHIRBundle(session, note, utterances);
            const json = JSON.stringify(bundle, null, 2);

            await Share.share({
                message: json,
                title: `FHIR Bundle — ${session.patient_name}`,
            });

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (err) {
            console.error('FHIR export error:', err);
        } finally {
            setExporting(null);
        }
    }, []);

    const handleExportNote = useCallback(async (session: SessionWithNote) => {
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            const note = await getNoteForSession(session.session_id);
            if (!note) {
                Alert.alert('No Notes', 'Generate AI notes first from the Note Review screen.');
                return;
            }
            const text = generateClinicalNoteText(session, note);
            await Share.share({ message: text, title: `Clinical Note — ${session.patient_name}` });
        } catch (err) {
            console.error('Note export error:', err);
        }
    }, []);

    // Compute stats
    const totalVisits = sessions.length;
    const totalMinutes = sessions.reduce((sum, s) => sum + (s.duration_ms || 0), 0) / 60000;
    const specialties = [...new Set(sessions.map((s) => s.specialty))];
    const languages = [...new Set(sessions.map((s) => s.patient_lang))];

    // ICD code frequency
    const icdFrequency: Record<string, { code: string; desc: string; count: number }> = {};
    sessions.forEach((s) => {
        s.icd_codes?.forEach((c) => {
            if (!icdFrequency[c.code]) {
                icdFrequency[c.code] = { code: c.code, desc: c.description, count: 0 };
            }
            icdFrequency[c.code].count++;
        });
    });
    const topICD = Object.values(icdFrequency).sort((a, b) => b.count - a.count).slice(0, 5);

    if (loading) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <Header
                    title="Patient Profile"
                    leftElement={<TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color="#FFFFFF" /></TouchableOpacity>}
                />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <Header
                title="Patient Profile"
                subtitle={patientName || 'Patient'}
                leftElement={<TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color="#FFFFFF" /></TouchableOpacity>}
            />

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Patient Overview */}
                <Card style={styles.overviewCard}>
                    <View style={styles.avatarRow}>
                        <View style={[styles.avatar, { backgroundColor: colors.primary + '15' }]}>
                            <Text style={[styles.avatarText, { color: colors.primary }]}>
                                {(patientName || 'P').charAt(0).toUpperCase()}
                            </Text>
                        </View>
                        <View style={styles.patientInfo}>
                            <Text style={[styles.patientName, { color: colors.textPrimary }]}>
                                {patientName}
                            </Text>
                            <View style={styles.langRow}>
                                {languages.map((lang) => (
                                    <Badge key={lang} label={lang.toUpperCase()} variant="info" />
                                ))}
                                {specialties.map((spec) => (
                                    <Badge key={spec} label={spec.charAt(0).toUpperCase() + spec.slice(1)} variant="default" />
                                ))}
                            </View>
                        </View>
                    </View>
                </Card>

                {/* Stats Row */}
                <View style={styles.statsRow}>
                    <Card style={styles.statCard}>
                        <Text style={[styles.statValue, { color: colors.primary }]}>{totalVisits}</Text>
                        <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Visits</Text>
                    </Card>
                    <Card style={styles.statCard}>
                        <Text style={[styles.statValue, { color: colors.secondary }]}>{Math.round(totalMinutes)}</Text>
                        <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Minutes</Text>
                    </Card>
                    <Card style={styles.statCard}>
                        <Text style={[styles.statValue, { color: Colors.statusGreen }]}>{topICD.length}</Text>
                        <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Diagnoses</Text>
                    </Card>
                </View>

                {/* Top Diagnoses */}
                {topICD.length > 0 && (
                    <>
                        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Top Diagnoses</Text>
                        <Card style={styles.diagCard}>
                            {topICD.map((icd, i) => (
                                <View key={icd.code}>
                                    <View style={styles.diagRow}>
                                        <View style={[styles.diagBadge, { backgroundColor: colors.primary }]}>
                                            <Text style={styles.diagBadgeText}>{icd.count}</Text>
                                        </View>
                                        <View style={styles.diagInfo}>
                                            <Text style={[styles.diagCode, { color: colors.primary }]}>{icd.code}</Text>
                                            <Text style={[styles.diagDesc, { color: colors.textSecondary }]} numberOfLines={1}>
                                                {icd.desc}
                                            </Text>
                                        </View>
                                        {/* Frequency bar */}
                                        <View style={styles.diagBarContainer}>
                                            <View style={[styles.diagBarTrack, { backgroundColor: colors.divider }]}>
                                                <View
                                                    style={[
                                                        styles.diagBarFill,
                                                        {
                                                            backgroundColor: colors.primary,
                                                            width: `${Math.min((icd.count / totalVisits) * 100, 100)}%`,
                                                        },
                                                    ]}
                                                />
                                            </View>
                                        </View>
                                    </View>
                                    {i < topICD.length - 1 && (
                                        <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                                    )}
                                </View>
                            ))}
                        </Card>
                    </>
                )}

                {/* Visit Timeline */}
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Visit Timeline</Text>
                {sessions.map((session, i) => {
                    const primaryIcd = session.icd_codes?.find((c) => c.is_primary);

                    return (
                        <View key={session.session_id} style={styles.timelineItem}>
                            {/* Timeline connector */}
                            <View style={styles.timelineConnector}>
                                <View style={[styles.timelineDot, { backgroundColor: STATUS_COLORS[session.status] || colors.primary }]} />
                                {i < sessions.length - 1 && (
                                    <View style={[styles.timelineLine, { backgroundColor: colors.divider }]} />
                                )}
                            </View>

                            {/* Session card */}
                            <Card style={styles.timelineCard}>
                                <View style={styles.timelineHeader}>
                                    <View>
                                        <Text style={[styles.timelineDate, { color: colors.textPrimary }]}>
                                            {formatDate(session.started_at)}
                                        </Text>
                                        <Text style={[styles.timelineTime, { color: colors.textTertiary }]}>
                                            {formatTime(session.started_at)} · {formatDuration(session.duration_ms)}
                                        </Text>
                                    </View>
                                    <Badge
                                        label={session.specialty.toUpperCase()}
                                        variant={session.specialty === 'er' ? 'error' : 'default'}
                                    />
                                </View>

                                {primaryIcd && (
                                    <View style={styles.timelineIcd}>
                                        <Text style={[styles.timelineIcdCode, { color: colors.primary }]}>
                                            {primaryIcd.code}
                                        </Text>
                                        <Text style={[styles.timelineIcdDesc, { color: colors.textSecondary }]} numberOfLines={1}>
                                            {primaryIcd.description}
                                        </Text>
                                    </View>
                                )}

                                {/* Actions */}
                                <View style={styles.timelineActions}>
                                    <TouchableOpacity
                                        style={[styles.actionChip, { backgroundColor: colors.primary + '10' }]}
                                        onPress={() => router.push({ pathname: '/note-review', params: { sessionId: session.session_id } })}
                                    >
                                        <Ionicons name="document-text-outline" size={14} color={colors.primary} />
                                        <Text style={[styles.actionChipText, { color: colors.primary }]}>View Note</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[styles.actionChip, { backgroundColor: colors.secondary + '10' }]}
                                        onPress={() => handleExportNote(session)}
                                    >
                                        <Ionicons name="share-outline" size={14} color={colors.secondary} />
                                        <Text style={[styles.actionChipText, { color: colors.secondary }]}>Share</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[styles.actionChip, { backgroundColor: Colors.statusGreen + '10' }]}
                                        onPress={() => handleExportFHIR(session)}
                                        disabled={exporting === session.session_id}
                                    >
                                        {exporting === session.session_id ? (
                                            <ActivityIndicator size={12} color={Colors.statusGreen} />
                                        ) : (
                                            <Ionicons name="code-slash" size={14} color={Colors.statusGreen} />
                                        )}
                                        <Text style={[styles.actionChipText, { color: Colors.statusGreen }]}>FHIR</Text>
                                    </TouchableOpacity>
                                </View>
                            </Card>
                        </View>
                    );
                })}

                {sessions.length === 0 && (
                    <Card style={styles.emptyCard}>
                        <View style={styles.emptyContent}>
                            <Ionicons name="person-outline" size={40} color={colors.textTertiary} />
                            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
                                No sessions found for this patient.
                            </Text>
                        </View>
                    </Card>
                )}

                <View style={{ height: 48 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollView: { flex: 1 },
    scrollContent: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md },
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    sectionTitle: { ...Typography.h3, marginTop: Spacing.lg, marginBottom: Spacing.sm },
    // Overview
    overviewCard: { marginBottom: 0 },
    avatarRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 24, fontWeight: '700' },
    patientInfo: { flex: 1 },
    patientName: { ...Typography.h2, marginBottom: Spacing.xs },
    langRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    // Stats
    statsRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
    statCard: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, marginBottom: 0 },
    statValue: { fontSize: 28, fontWeight: '700' },
    statLabel: { ...Typography.caption, marginTop: 2 },
    // Diagnoses
    diagCard: { marginBottom: 0 },
    diagRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6 },
    diagBadge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    diagBadgeText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
    diagInfo: { flex: 1 },
    diagCode: { ...Typography.badge, fontFamily: 'SpaceMono' },
    diagDesc: { ...Typography.caption, marginTop: 1 },
    diagBarContainer: { width: 60 },
    diagBarTrack: { height: 4, borderRadius: 2 },
    diagBarFill: { height: 4, borderRadius: 2 },
    divider: { height: 1, marginVertical: Spacing.xs },
    // Timeline
    timelineItem: { flexDirection: 'row', marginBottom: Spacing.sm },
    timelineConnector: { width: 24, alignItems: 'center', paddingTop: 18 },
    timelineDot: { width: 12, height: 12, borderRadius: 6, zIndex: 1 },
    timelineLine: { width: 2, flex: 1, marginTop: -2 },
    timelineCard: { flex: 1, marginLeft: Spacing.sm, marginBottom: 0 },
    timelineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    timelineDate: { ...Typography.body, fontWeight: '600' },
    timelineTime: { ...Typography.caption, marginTop: 2 },
    timelineIcd: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm, paddingTop: Spacing.xs, borderTopWidth: 1, borderTopColor: '#E9ECEF' },
    timelineIcdCode: { ...Typography.badge, fontFamily: 'SpaceMono' },
    timelineIcdDesc: { ...Typography.caption, flex: 1 },
    timelineActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
    actionChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.pill },
    actionChipText: { ...Typography.caption, fontWeight: '600', fontSize: 11 },
    // Empty
    emptyCard: { marginBottom: 0 },
    emptyContent: { alignItems: 'center', paddingVertical: Spacing.lg, gap: Spacing.md },
    emptyText: { ...Typography.body, textAlign: 'center' },
});
