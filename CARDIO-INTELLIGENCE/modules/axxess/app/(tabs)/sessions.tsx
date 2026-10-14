import React, { useCallback, useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Header, Card, Badge } from '@/components/ui/axxess__components_ui__index';
import { Colors, Typography, Spacing, Radius } from '@/constants/axxess__constants__theme';
import { useThemeColors } from '@/constants/useThemeColors';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { getSessionsWithNotes, searchSessions } from '@/src/modules/db/axxess__modules_db__queries';
import type { SessionWithNote } from '@/src/types/axxess__src_types__index';

const LANGUAGE_NAMES: Record<string, string> = {
    en: 'English', es: 'Spanish', ar: 'Arabic', ht: 'Haitian Creole',
    vi: 'Vietnamese', ru: 'Russian', fr: 'French', zh: 'Chinese',
    pt: 'Portuguese', ko: 'Korean', ja: 'Japanese', km: 'Khmer',
};

const SPECIALTIES = ['All', 'Cardiology', 'General', 'Hospice', 'ER', 'Palliative'];

function formatDate(timestamp: number): string {
    const d = new Date(timestamp);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(timestamp: number): string {
    const d = new Date(timestamp);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatDuration(ms: number | null): string {
    if (!ms) return '--';
    return `${Math.round(ms / 60000)} min`;
}

export default function SessionHistoryScreen() {
    const colors = useThemeColors();
    const router = useRouter();
    const { isReady, refreshKey } = useDatabase();

    const [sessions, setSessions] = useState<SessionWithNote[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSpecialty, setSelectedSpecialty] = useState('All');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadSessions = useCallback(async () => {
        try {
            setLoading(true);
            let data: SessionWithNote[];
            if (searchQuery || selectedSpecialty !== 'All') {
                data = await searchSessions(searchQuery, selectedSpecialty);
            } else {
                data = await getSessionsWithNotes(50);
            }
            setSessions(data);
        } catch (err) {
            console.error('Failed to load sessions:', err);
        } finally {
            setLoading(false);
        }
    }, [searchQuery, selectedSpecialty]);

    useEffect(() => {
        if (isReady) loadSessions();
    }, [isReady, refreshKey, loadSessions]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        Haptics.selectionAsync();
        await loadSessions();
        setRefreshing(false);
    }, [loadSessions]);

    const renderSession = useCallback(({ item }: { item: SessionWithNote }) => {
        const primaryIcd = item.icd_codes?.find((c) => c.is_primary);
        return (
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                    Haptics.selectionAsync();
                    router.push({ pathname: '/note-review', params: { sessionId: item.session_id } });
                }}
            >
                <Card accentColor={colors.primary}>
                    <View style={styles.sessionRow}>
                        <View style={styles.sessionLeft}>
                            <Text style={[styles.sessionPatient, { color: colors.textPrimary }]}>
                                {item.patient_name}
                            </Text>
                            {primaryIcd && (
                                <Text style={[styles.sessionIcd, { color: colors.textSecondary }]} numberOfLines={1}>
                                    {primaryIcd.code} — {primaryIcd.description}
                                </Text>
                            )}
                            <View style={styles.sessionMeta}>
                                <Text style={[styles.sessionMetaText, { color: colors.textTertiary }]}>
                                    {formatDate(item.started_at)} at {formatTime(item.started_at)}
                                </Text>
                                <Text style={[styles.sessionMetaText, { color: colors.textTertiary }]}>
                                    {formatDuration(item.duration_ms)}
                                </Text>
                                <Text style={[styles.sessionMetaText, { color: '#2563EB', fontWeight: '600' }]}>
                                    Gemini 2.5 Pro
                                </Text>
                            </View>
                            {item.fl_contributed > 0 && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                                    <Ionicons name="shield-checkmark-outline" size={10} color={Colors.statusGreen} />
                                    <Text style={{ fontSize: 9, color: Colors.statusGreen, fontWeight: '600' }}>FL Contributed</Text>
                                </View>
                            )}
                        </View>
                        <View style={styles.sessionRight}>
                            <Badge
                                label={item.specialty.toUpperCase()}
                                variant={item.specialty === 'er' ? 'error' : 'default'}
                            />
                            {item.patient_lang !== 'en' && (
                                <Badge
                                    label={LANGUAGE_NAMES[item.patient_lang] || item.patient_lang}
                                    variant="info"
                                    style={{ marginTop: 6 }}
                                />
                            )}
                        </View>
                    </View>
                </Card>
            </TouchableOpacity>
        );
    }, [colors, router]);

    const ItemSeparator = useCallback(() => (
        <View style={{ height: Spacing.sm }} />
    ), []);

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <Header title="Session History" subtitle={`${sessions.length} sessions`} />

            {/* Search Bar */}
            <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderBottomColor: colors.divider }]}>
                <View style={[styles.searchInputRow, { backgroundColor: colors.surfaceElevated }]}>
                    <Ionicons name="search" size={18} color={colors.textTertiary} />
                    <TextInput
                        style={[styles.searchInput, { color: colors.textPrimary }]}
                        placeholder="Search by patient, ICD code, or keyword..."
                        placeholderTextColor={colors.textTertiary}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Specialty Filter */}
                <View style={styles.filtersRow}>
                    {SPECIALTIES.map((item) => (
                        <TouchableOpacity
                            key={item}
                            style={[
                                styles.filterChip,
                                {
                                    backgroundColor:
                                        selectedSpecialty === item ? colors.primary : colors.surfaceElevated,
                                },
                            ]}
                            onPress={() => {
                                Haptics.selectionAsync();
                                setSelectedSpecialty(item);
                            }}
                        >
                            <Text
                                style={[
                                    styles.filterChipText,
                                    {
                                        color:
                                            selectedSpecialty === item ? '#FFFFFF' : colors.textSecondary,
                                    },
                                ]}
                            >
                                {item}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Session List — FlatList (reliable vertical scroll + no gesture conflicts) */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={sessions}
                    keyExtractor={(item) => item.session_id}
                    renderItem={renderSession}
                    ItemSeparatorComponent={ItemSeparator}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    nestedScrollEnabled={true}
                    keyboardShouldPersistTaps="handled"
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={[colors.primary]}
                            tintColor={colors.primary}
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="search" size={48} color={colors.textTertiary} />
                            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
                                No sessions match your search
                            </Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    searchContainer: {
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.sm,
        paddingBottom: Spacing.sm,
        borderBottomWidth: 1,
    },
    searchInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.sm + 4,
        height: 40,
        borderRadius: Radius.md,
        gap: Spacing.sm,
    },
    searchInput: { flex: 1, ...Typography.bodySmall, height: 40 },
    filtersRow: {
        flexDirection: 'row',
        paddingTop: Spacing.sm,
        gap: Spacing.sm,
        flexWrap: 'wrap',
    },
    filterChip: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs + 2,
        borderRadius: Radius.pill,
    },
    filterChipText: { ...Typography.caption, fontWeight: '600' },
    listContent: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.xl },
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    sessionRow: { flexDirection: 'row', justifyContent: 'space-between' },
    sessionLeft: { flex: 1, marginRight: Spacing.sm },
    sessionRight: { alignItems: 'flex-end' },
    sessionPatient: { ...Typography.body, fontWeight: '600' },
    sessionIcd: { ...Typography.caption, marginTop: 2 },
    sessionMeta: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xs },
    sessionMetaText: { ...Typography.caption, fontSize: 12 },
    emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xxl, gap: Spacing.md },
    emptyText: { ...Typography.body },
});
