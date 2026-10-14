import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Header, Card, Badge } from '@/components/ui/axxess__components_ui__index';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/axxess__constants__theme';
import { useThemeColors } from '@/constants/useThemeColors';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import {
  getSessionsWithNotes,
  getTodaySessionCount,
  getWeekSessionCount,
  getAverageConfidence,
  getNoteForSession,
  getUtterancesForSession,
} from '@/src/modules/db/axxess__modules_db__queries';
import { generateFHIRBundle, generateClinicalNoteText } from '@/src/modules/fhir/generator';
import { getAdapterInfo } from '@/src/modules/fl/service';
import type { SessionWithNote } from '@/src/types/axxess__src_types__index';

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English', es: 'Spanish', ar: 'Arabic', ht: 'Haitian Creole',
  vi: 'Vietnamese', ru: 'Russian', fr: 'French', zh: 'Chinese',
  pt: 'Portuguese', ko: 'Korean', ja: 'Japanese', km: 'Khmer',
};

function getStatusColor(status: string): string {
  switch (status) {
    case 'complete': return Colors.statusGreen;
    case 'processing': return Colors.statusAmber;
    case 'error': return Colors.statusRed;
    default: return Colors.textTertiary;
  }
}

function formatDuration(ms: number | null): string {
  if (!ms) return '--';
  const minutes = Math.round(ms / 60000);
  return `${minutes} min`;
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

export default function DashboardScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { isReady, refreshKey } = useDatabase();

  const [sessions, setSessions] = useState<SessionWithNote[]>([]);
  const [todayCount, setTodayCount] = useState(0);
  const [weekCount, setWeekCount] = useState(0);
  const [avgConfidence, setAvgConfidence] = useState(0);
  const [adapterVersion, setAdapterVersion] = useState('v0.0');
  const [adapterParams, setAdapterParams] = useState(294912);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [sessionsData, today, week, confidence] = await Promise.all([
        getSessionsWithNotes(6),
        getTodaySessionCount(),
        getWeekSessionCount(),
        getAverageConfidence(),
      ]);
      setSessions(sessionsData);
      setTodayCount(today);
      setWeekCount(week);
      setAvgConfidence(confidence);

      // Load adapter info async
      try {
        const info = await getAdapterInfo();
        setAdapterVersion(info.version);
        setAdapterParams(info.trainable_params);
      } catch { }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isReady) loadData();
  }, [isReady, refreshKey, loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  if (!isReady || loading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: colors.background }]}>
        <Header title="MedScribe" subtitle="Clinical Documentation" />
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Initializing database...
          </Text>
        </View>
      </View>
    );
  }

  const confidencePercent = Math.round(avgConfidence * 100);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="MedScribe" subtitle="Clinical Documentation" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* Stats Overview */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{todayCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Today</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.statValue, { color: colors.secondary }]}>{weekCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>This Week</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.statValue, { color: colors.statusGreen }]}>
              {confidencePercent > 0 ? `${confidencePercent}%` : '--'}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Accuracy</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Quick Actions</Text>
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.primary }]}
              activeOpacity={0.8}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push('/(tabs)/session');
              }}
            >
              <Ionicons name="mic" size={28} color="#FFFFFF" />
              <Text style={styles.actionLabel}>New Session</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.secondary }]}
              activeOpacity={0.8}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/(tabs)/sessions');
              }}
            >
              <Ionicons name="search" size={28} color="#FFFFFF" />
              <Text style={styles.actionLabel}>Search Notes</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#6C63FF' }]}
              activeOpacity={0.8}
              onPress={async () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (sessions.length === 0) {
                  Alert.alert('No Sessions', 'Record a session first to export notes.');
                  return;
                }
                try {
                  const session = sessions[0];
                  const [note, utterances] = await Promise.all([
                    getNoteForSession(session.session_id),
                    getUtterancesForSession(session.session_id),
                  ]);
                  if (note) {
                    const text = generateClinicalNoteText(session, note);
                    await Share.share({ message: text, title: `Clinical Note — ${session.patient_name}` });
                  } else {
                    const bundle = generateFHIRBundle(session, null, utterances);
                    await Share.share({ message: JSON.stringify(bundle, null, 2), title: 'FHIR Export' });
                  }
                } catch (err: any) {
                  Alert.alert('Export Failed', err.message || 'Failed to export.');
                }
              }}
            >
              <Ionicons name="document-text" size={28} color="#FFFFFF" />
              <Text style={styles.actionLabel}>Export</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Sessions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Recent Sessions</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/sessions')}>
              <Text style={[styles.seeAll, { color: colors.secondary }]}>See All</Text>
            </TouchableOpacity>
          </View>

          {sessions.length === 0 ? (
            <Card style={styles.emptyCard}>
              <View style={styles.emptyContent}>
                <Ionicons name="mic-off-outline" size={36} color={colors.textTertiary} />
                <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
                  No sessions yet. Tap New Session to start.
                </Text>
              </View>
            </Card>
          ) : (
            sessions.map((session) => {
              const primaryIcd = session.icd_codes?.find((c) => c.is_primary);
              return (
                <TouchableOpacity key={session.session_id} activeOpacity={0.7} onPress={() => router.push({ pathname: '/note-review', params: { sessionId: session.session_id } })}>
                  <Card accentColor={colors.primary} style={styles.sessionCard}>
                    <View style={styles.sessionHeader}>
                      <View style={styles.sessionInfo}>
                        <Text style={[styles.sessionPatient, { color: colors.textPrimary }]}>
                          {session.patient_name}
                        </Text>
                        {primaryIcd && (
                          <Text style={[styles.sessionIcd, { color: colors.textSecondary }]} numberOfLines={1}>
                            {primaryIcd.code} — {primaryIcd.description}
                          </Text>
                        )}
                        <Text style={[styles.sessionDate, { color: colors.textTertiary }]}>
                          {formatRelativeTime(session.started_at)}
                        </Text>
                      </View>
                      <View style={styles.sessionMeta}>
                        <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(session.status) }]} />
                        <Text style={[styles.statusText, { color: getStatusColor(session.status) }]}>
                          {session.status === 'complete' ? 'Complete' : session.status === 'processing' ? 'Processing' : 'Recording'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.sessionDetails}>
                      <View style={styles.detailChip}>
                        <Ionicons name="time-outline" size={14} color={colors.textTertiary} />
                        <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                          {formatDuration(session.duration_ms)}
                        </Text>
                      </View>
                      <View style={styles.detailChip}>
                        <Ionicons name="medical-outline" size={14} color={colors.textTertiary} />
                        <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                          {session.specialty.charAt(0).toUpperCase() + session.specialty.slice(1)}
                        </Text>
                      </View>
                      {session.patient_lang !== 'en' && (
                        <View style={styles.detailChip}>
                          <Ionicons name="language-outline" size={14} color={colors.textTertiary} />
                          <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                            {LANGUAGE_NAMES[session.patient_lang] || session.patient_lang}
                          </Text>
                        </View>
                      )}
                    </View>
                  </Card>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Model Status */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Model Status</Text>
          <Card style={styles.modelCard}>
            <View style={styles.modelRow}>
              <View style={styles.modelInfo}>
                <Text style={[styles.modelName, { color: colors.textPrimary }]}>Gemini 2.5 Pro</Text>
                <Text style={[styles.modelSize, { color: colors.textTertiary }]}>Cloud · Primary Engine</Text>
              </View>
              <Badge label="ACTIVE" variant="success" />
            </View>
            <View style={[styles.modelDivider, { backgroundColor: colors.divider }]} />
            <View style={styles.modelRow}>
              <View style={styles.modelInfo}>
                <Text style={[styles.modelName, { color: colors.textPrimary }]}>Whisper Small</Text>
                <Text style={[styles.modelSize, { color: colors.textTertiary }]}>On-device · 466MB</Text>
              </View>
              <Badge label="READY" variant="success" />
            </View>
            <View style={[styles.modelDivider, { backgroundColor: colors.divider }]} />
            <View style={styles.modelRow}>
              <View style={styles.modelInfo}>
                <Text style={[styles.modelName, { color: colors.textPrimary }]}>FL Pipeline</Text>
                <Text style={[styles.modelSize, { color: colors.textTertiary }]}>Firebase · Approved data</Text>
              </View>
              <Badge label="SYNCED" variant="info" />
            </View>
          </Card>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: {},
  loadingContent: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  loadingText: { ...Typography.body },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md, borderRadius: Radius.md, ...Shadows.card },
  statValue: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  statLabel: { ...Typography.caption, marginTop: Spacing.xs },
  section: { marginBottom: Spacing.lg },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  sectionTitle: { ...Typography.h3, marginBottom: Spacing.sm },
  seeAll: { ...Typography.bodySmall, fontWeight: '600', marginBottom: Spacing.sm },
  actionsRow: { flexDirection: 'row', gap: Spacing.sm },
  actionButton: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.lg, borderRadius: Radius.md, ...Shadows.card },
  actionLabel: { ...Typography.caption, color: '#FFFFFF', fontWeight: '600', marginTop: Spacing.sm },
  emptyCard: { marginBottom: 0 },
  emptyContent: { alignItems: 'center', paddingVertical: Spacing.lg, gap: Spacing.sm },
  emptyText: { ...Typography.body, textAlign: 'center' },
  sessionCard: { marginBottom: Spacing.sm },
  sessionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  sessionInfo: { flex: 1, marginRight: Spacing.sm },
  sessionPatient: { ...Typography.body, fontWeight: '600' },
  sessionIcd: { ...Typography.caption, marginTop: 2 },
  sessionDate: { ...Typography.caption, marginTop: 2 },
  sessionMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusIndicator: { width: 8, height: 8, borderRadius: 4 },
  statusText: { ...Typography.caption, fontWeight: '600' },
  sessionDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginTop: Spacing.sm },
  detailChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailText: { ...Typography.caption },
  modelCard: { marginBottom: 0 },
  modelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modelInfo: { flex: 1 },
  modelName: { ...Typography.body, fontWeight: '600' },
  modelSize: { ...Typography.caption, marginTop: 2 },
  modelDivider: { height: 1, marginVertical: Spacing.sm },
});
