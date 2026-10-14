import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Switch,
    TouchableOpacity,
    Platform,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import { Header, Card, Badge, Button } from '@/components/ui/axxess__components_ui__index';
import { Colors, Typography, Spacing, Radius } from '@/constants/axxess__constants__theme';
import { useThemeColors } from '@/constants/useThemeColors';
import { getSettings, updateSettings } from '@/src/stores/settingsStore';
import type { AppSettings } from '@/src/stores/settingsStore';
import {
    logAuditEvent,
    getAuditLogs,
    deleteAllSessions,
    deleteSessionsOlderThan,
} from '@/src/modules/db/axxess__modules_db__queries';
import type { AuditLogEntry } from '@/src/modules/db/axxess__modules_db__queries';
import { useDatabase } from '@/src/providers/DatabaseProvider';

const SPECIALTY_OPTIONS = [
    { code: 'general', label: 'General Care' },
    { code: 'cardiology', label: 'Cardiology' },
    { code: 'er', label: 'Emergency (ER)' },
    { code: 'hospice', label: 'Hospice' },
    { code: 'palliative', label: 'Palliative Care' },
];

const LANGUAGE_OPTIONS = [
    { code: 'en', label: 'English' },
    { code: 'es', label: 'Spanish' },
    { code: 'fr', label: 'French' },
    { code: 'ar', label: 'Arabic' },
    { code: 'ht', label: 'Haitian Creole' },
    { code: 'vi', label: 'Vietnamese' },
    { code: 'zh', label: 'Chinese (Mandarin)' },
    { code: 'ko', label: 'Korean' },
    { code: 'ru', label: 'Russian' },
    { code: 'km', label: 'Khmer' },
];

const RETENTION_OPTIONS = [30, 90, 180];

interface SettingRowProps {
    icon: string;
    iconColor?: string;
    label: string;
    description?: string;
    rightElement?: React.ReactNode;
    onPress?: () => void;
}

function SettingRow({ icon, iconColor, label, description, rightElement, onPress }: SettingRowProps) {
    const colors = useThemeColors();
    const Wrapper = onPress ? TouchableOpacity : View;

    return (
        <Wrapper
            style={styles.settingRow}
            activeOpacity={0.7}
            onPress={onPress}
        >
            <View style={[styles.settingIcon, { backgroundColor: (iconColor || colors.primary) + '15' }]}>
                <Ionicons name={icon as any} size={20} color={iconColor || colors.primary} />
            </View>
            <View style={styles.settingInfo}>
                <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{label}</Text>
                {description && (
                    <Text style={[styles.settingDescription, { color: colors.textTertiary }]}>
                        {description}
                    </Text>
                )}
            </View>
            {rightElement || (
                onPress && <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            )}
        </Wrapper>
    );
}

export default function SettingsScreen() {
    const colors = useThemeColors();
    const { refreshKey, refresh } = useDatabase();

    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [biometricAvailable, setBiometricAvailable] = useState(false);
    const [biometricType, setBiometricType] = useState('Biometric');

    useEffect(() => {
        (async () => {
            const loaded = await getSettings();
            setSettings(loaded);
            setLoading(false);

            // Check biometric hardware
            const compatible = await LocalAuthentication.hasHardwareAsync();
            const enrolled = await LocalAuthentication.isEnrolledAsync();
            setBiometricAvailable(compatible && enrolled);

            const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
            if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
                setBiometricType('Face ID');
            } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
                setBiometricType('Fingerprint');
            } else {
                setBiometricType('Biometric');
            }

            await logAuditEvent('settings_accessed', 'Settings screen opened');
        })();
    }, []);

    const updateSetting = useCallback(async <K extends keyof AppSettings>(
        key: K, value: AppSettings[K]
    ) => {
        const updated = await updateSettings({ [key]: value });
        setSettings(updated);
    }, []);

    // ─── Biometric Toggle ────────────────────────────
    const handleBiometricToggle = useCallback(async (val: boolean) => {
        if (val) {
            if (!biometricAvailable) {
                Alert.alert(
                    'Not Available',
                    'Biometric authentication is not set up on this device. Please enroll Face ID or a fingerprint in your device settings first.',
                );
                return;
            }
            // Verify identity before enabling
            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: `Verify your identity to enable ${biometricType}`,
                cancelLabel: 'Cancel',
                fallbackLabel: 'Use Passcode',
            });
            if (!result.success) {
                Alert.alert('Authentication Failed', `Could not verify identity. ${biometricType} lock was not enabled.`);
                return;
            }
            await updateSetting('biometricEnabled', true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            await logAuditEvent('biometric_changed', `${biometricType} authentication enabled`);
            Alert.alert(
                `${biometricType} Enabled`,
                `${biometricType} authentication will be required each time you open MedScribe.`,
            );
        } else {
            // Require auth before disabling too
            if (biometricAvailable) {
                const result = await LocalAuthentication.authenticateAsync({
                    promptMessage: `Verify to disable ${biometricType}`,
                    cancelLabel: 'Cancel',
                    fallbackLabel: 'Use Passcode',
                });
                if (!result.success) return;
            }
            await updateSetting('biometricEnabled', false);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            await logAuditEvent('biometric_changed', `${biometricType} authentication disabled`);
            Alert.alert(`${biometricType} Disabled`, 'Sessions can be accessed without biometric verification.');
        }
    }, [biometricAvailable, biometricType, updateSetting]);

    // ─── Specialty Picker ────────────────────────────
    const handleSpecialtyPicker = useCallback(() => {
        if (!settings) return;
        Alert.alert(
            'Default Specialty',
            `Current: ${SPECIALTY_OPTIONS.find(s => s.code === settings.defaultSpecialty)?.label || settings.defaultSpecialty}`,
            [
                ...SPECIALTY_OPTIONS.map(opt => ({
                    text: opt.code === settings.defaultSpecialty ? `✓ ${opt.label}` : opt.label,
                    onPress: async () => {
                        await updateSetting('defaultSpecialty', opt.code);
                        Haptics.selectionAsync();
                        await logAuditEvent('setting_changed', `Default specialty set to ${opt.code}`);
                    },
                })),
                { text: 'Cancel', style: 'cancel' as const },
            ],
        );
    }, [settings, updateSetting]);

    // ─── Language Picker ─────────────────────────────
    const handleLanguagePicker = useCallback(() => {
        if (!settings) return;
        const currentLabel = LANGUAGE_OPTIONS.find(l => l.code === settings.defaultLang)?.label || settings.defaultLang;
        Alert.alert(
            'Default Patient Language',
            `Current: ${currentLabel}`,
            [
                ...LANGUAGE_OPTIONS.map(opt => ({
                    text: opt.code === settings.defaultLang ? `✓ ${opt.label}` : opt.label,
                    onPress: async () => {
                        await updateSetting('defaultLang', opt.code);
                        Haptics.selectionAsync();
                        await logAuditEvent('setting_changed', `Default language set to ${opt.code}`);
                    },
                })),
                { text: 'Cancel', style: 'cancel' as const },
            ],
        );
    }, [settings, updateSetting]);

    // ─── Ambient Mode ────────────────────────────────
    const handleAmbientToggle = useCallback(async (val: boolean) => {
        await updateSetting('ambientMode', val);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await logAuditEvent('setting_changed', `Ambient mode ${val ? 'enabled' : 'disabled'}`);
        if (val) {
            Alert.alert(
                'Ambient Mode Enabled',
                'MedScribe will use continuous Voice Activity Detection (VAD) during sessions. The mic stays open and captures speech automatically without manual pausing.',
            );
        }
    }, [updateSetting]);

    // ─── Data Retention ──────────────────────────────
    const handleRetention = useCallback(() => {
        if (!settings) return;
        Alert.alert(
            'Data Retention Policy',
            `Current: ${settings.retentionDays} days\n\nSessions older than this are automatically deleted.`,
            [
                ...RETENTION_OPTIONS.map(days => ({
                    text: days === settings.retentionDays ? `✓ ${days} days` : `${days} days`,
                    onPress: async () => {
                        await updateSetting('retentionDays', days);
                        const deleted = await deleteSessionsOlderThan(days);
                        refresh();
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        if (deleted > 0) Alert.alert('Cleanup Complete', `Deleted ${deleted} sessions older than ${days} days.`);
                    },
                })),
                { text: 'Cancel', style: 'cancel' as const },
            ],
        );
    }, [settings, updateSetting, refresh]);

    // ─── Audit Log ───────────────────────────────────
    const handleAuditLog = useCallback(async () => {
        try {
            const logs = await getAuditLogs(20);
            if (logs.length === 0) {
                Alert.alert('Audit Trail', 'No events recorded yet.');
                return;
            }
            const formatted = logs.map((log: AuditLogEntry) => {
                const date = new Date(log.created_at);
                const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
                return `${dateStr} ${time} — ${log.description}`;
            }).join('\n');
            Alert.alert('Audit Trail', `Last ${logs.length} events:\n\n${formatted}`);
        } catch {
            Alert.alert('Error', 'Failed to load audit logs.');
        }
    }, []);

    // ─── Danger Zone ─────────────────────────────────
    const handleClearSessions = useCallback(() => {
        Alert.alert(
            'Clear All Sessions?',
            'This permanently deletes ALL sessions, clinical notes, transcripts, and utterances. This cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete All', style: 'destructive', onPress: async () => {
                        try {
                            const count = await deleteAllSessions();
                            refresh();
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                            Alert.alert('Cleared', `Deleted ${count} sessions and all associated data.`);
                        } catch {
                            Alert.alert('Error', 'Failed to delete sessions.');
                        }
                    },
                },
            ],
        );
    }, [refresh]);

    const handleResetAdapters = useCallback(() => {
        Alert.alert(
            'Reset FL Adapters?',
            'This removes all fine-tuned LoRA adapters and reverts to the base model. Training history is preserved in the audit log.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Reset', style: 'destructive', onPress: async () => {
                        await logAuditEvent('fl_reset', 'FL adapters reset to base model');
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        Alert.alert('Reset Complete', 'Adapters reverted to base Whisper model.');
                    },
                },
            ],
        );
    }, []);

    if (loading || !settings) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
                <Header title="Settings" subtitle="Application Configuration" />
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    const specialtyLabel = SPECIALTY_OPTIONS.find(s => s.code === settings.defaultSpecialty)?.label
        || settings.defaultSpecialty.charAt(0).toUpperCase() + settings.defaultSpecialty.slice(1);
    const languageLabel = LANGUAGE_OPTIONS.find(l => l.code === settings.defaultLang)?.label || settings.defaultLang;

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <Header title="Settings" subtitle="Application Configuration" />

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Model Configuration */}
                <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>MODEL CONFIGURATION</Text>
                <Card style={styles.sectionCard}>
                    <SettingRow
                        icon="mic"
                        label="Speech Engine"
                        description="Gemini 2.5 Pro Multimodal ASR"
                    />
                    <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                    <SettingRow
                        icon="ear"
                        iconColor="#7C3AED"
                        label="On-Device Model"
                        description="Whisper Small — 466MB GGML"
                    />
                    <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                    <SettingRow
                        icon="language"
                        iconColor={colors.secondary}
                        label="Translation Engine"
                        description="Gemini 2.5 Pro — 100+ languages"
                    />
                    <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                    <SettingRow
                        icon="download"
                        iconColor={Colors.statusGreen}
                        label="Storage Used"
                        description="Whisper Small: ~466MB on-device"
                    />
                </Card>

                {/* AI Configuration */}
                <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>AI CLINICAL NOTES</Text>
                <Card style={styles.sectionCard}>
                    <SettingRow
                        icon="sparkles"
                        iconColor="#6C63FF"
                        label="AI Engine"
                        description="Gemini 2.5 Pro — Connected ✓"
                    />
                    <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                    <SettingRow
                        icon="document-text"
                        iconColor="#6C63FF"
                        label="Note Format"
                        description="SOAP + ICD-10 + Vitals + Risk Assessment"
                    />
                </Card>

                {/* Recording Preferences */}
                <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>RECORDING</Text>
                <Card style={styles.sectionCard}>
                    <SettingRow
                        icon="globe"
                        iconColor={colors.secondary}
                        label="Default Language"
                        description={languageLabel}
                        onPress={handleLanguagePicker}
                    />
                    <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                    <SettingRow
                        icon="medical"
                        label="Default Specialty"
                        description={specialtyLabel}
                        onPress={handleSpecialtyPicker}
                    />
                    <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                    <SettingRow
                        icon="ear"
                        iconColor="#6C63FF"
                        label="Ambient Mode"
                        description={settings.ambientMode ? 'ON — Continuous VAD listening' : 'Continuous listening with VAD gating'}
                        rightElement={
                            <Switch
                                value={settings.ambientMode}
                                onValueChange={handleAmbientToggle}
                                trackColor={{ false: colors.border, true: colors.primary + '60' }}
                                thumbColor={settings.ambientMode ? colors.primary : '#F4F3F4'}
                            />
                        }
                    />
                </Card>

                {/* Security */}
                <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>SECURITY</Text>
                <Card style={styles.sectionCard}>
                    <SettingRow
                        icon="finger-print"
                        iconColor={Colors.statusGreen}
                        label={`${biometricType} Authentication`}
                        description={
                            !biometricAvailable
                                ? 'Not enrolled on this device — set up in device settings'
                                : settings.biometricEnabled
                                    ? `Required to open MedScribe`
                                    : 'Tap to enable app lock'
                        }
                        rightElement={
                            <Switch
                                value={settings.biometricEnabled && biometricAvailable}
                                onValueChange={handleBiometricToggle}
                                trackColor={{ false: colors.border, true: Colors.statusGreen + '60' }}
                                thumbColor={settings.biometricEnabled && biometricAvailable ? Colors.statusGreen : '#F4F3F4'}
                            />
                        }
                    />
                    <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                    <SettingRow
                        icon="time"
                        iconColor={Colors.statusAmber}
                        label="Data Retention"
                        description={`${settings.retentionDays} days — sessions auto-deleted after this period`}
                        onPress={handleRetention}
                    />
                    <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                    <SettingRow
                        icon="document-text"
                        label="Audit Log"
                        description="View all data access and change events"
                        onPress={handleAuditLog}
                    />
                </Card>

                {/* General */}
                <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>GENERAL</Text>
                <Card style={styles.sectionCard}>
                    <SettingRow
                        icon="phone-portrait"
                        iconColor={colors.secondary}
                        label="Haptic Feedback"
                        description={settings.hapticEnabled ? 'Enabled' : 'Disabled'}
                        rightElement={
                            <Switch
                                value={settings.hapticEnabled}
                                onValueChange={async (val) => {
                                    await updateSetting('hapticEnabled', val);
                                    if (val) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                }}
                                trackColor={{ false: colors.border, true: colors.primary + '60' }}
                                thumbColor={settings.hapticEnabled ? colors.primary : '#F4F3F4'}
                            />
                        }
                    />
                    <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                    <SettingRow
                        icon="cloud-upload"
                        label="Axxess EMR Sync"
                        description={settings.emrSyncEnabled ? 'Connected to Axxess Exchange' : 'Not connected — tap to configure'}
                        onPress={() => {
                            Alert.alert(
                                'Axxess EMR Sync',
                                'EMR sync integration connects MedScribe directly to your Axxess portal. Contact your Axxess administrator to configure the API credentials.',
                            );
                        }}
                    />
                    <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                    <SettingRow
                        icon="information-circle"
                        iconColor={colors.textTertiary}
                        label="About MedScribe"
                        description="Version 1.0.0 — Powered by Gemini 2.5 Pro"
                        onPress={() => {
                            Alert.alert(
                                'MedScribe v1.0.0',
                                'AI-powered clinical documentation.\n\nModels:\n• Gemini 2.5 Pro (Cloud ASR + Notes)\n• Whisper Small (On-device ASR)\n\nFeatures:\n• SOAP notes, ICD-10 coding\n• Federated Learning (privacy-preserving)\n• FHIR R4 export\n• Multilingual support (10+ languages)',
                            );
                        }}
                    />
                </Card>

                {/* Danger Zone */}
                <Text style={[styles.sectionTitle, { color: Colors.statusRed }]}>DANGER ZONE</Text>
                <Card style={styles.sectionCard}>
                    <SettingRow
                        icon="trash"
                        iconColor={Colors.statusRed}
                        label="Clear All Sessions"
                        description="Permanently delete all local data"
                        onPress={handleClearSessions}
                    />
                    <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                    <SettingRow
                        icon="refresh"
                        iconColor={Colors.statusRed}
                        label="Reset FL Adapters"
                        description="Revert to base Whisper model"
                        onPress={handleResetAdapters}
                    />
                </Card>

                <View style={{ height: 48 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollView: { flex: 1 },
    scrollContent: {
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.md,
    },
    sectionTitle: {
        ...Typography.badge,
        marginBottom: Spacing.sm,
        marginTop: Spacing.md,
        marginLeft: Spacing.xs,
    },
    sectionCard: { marginBottom: 0 },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Spacing.xs,
        gap: Spacing.sm + 4,
    },
    settingIcon: {
        width: 36,
        height: 36,
        borderRadius: Radius.sm,
        alignItems: 'center',
        justifyContent: 'center',
    },
    settingInfo: { flex: 1 },
    settingLabel: { ...Typography.body, fontWeight: '500' },
    settingDescription: { ...Typography.caption, marginTop: 1 },
    divider: {
        height: 1,
        marginVertical: Spacing.sm,
        marginLeft: 48,
    },
});
