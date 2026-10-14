/**
 * MedScribe — Settings Store
 * Persists user preferences using AsyncStorage.
 * All settings survive app restarts.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_KEY = '@medscribe_settings';

export interface AppSettings {
    biometricEnabled: boolean;
    hapticEnabled: boolean;
    ambientMode: boolean;
    retentionDays: number;
    defaultSpecialty: string;
    defaultLang: string;
    emrSyncEnabled: boolean;
    lastRetentionCleanup: number;
}

const DEFAULT_SETTINGS: AppSettings = {
    biometricEnabled: true,
    hapticEnabled: true,
    ambientMode: false,
    retentionDays: 90,
    defaultSpecialty: 'cardiology',
    defaultLang: 'en',
    emrSyncEnabled: false,
    lastRetentionCleanup: 0,
};

let cachedSettings: AppSettings | null = null;

/**
 * Load settings from AsyncStorage. Returns cached version if available.
 */
export async function getSettings(): Promise<AppSettings> {
    if (cachedSettings) return { ...cachedSettings };

    try {
        const raw = await AsyncStorage.getItem(SETTINGS_KEY);
        if (raw) {
            cachedSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } as AppSettings;
        } else {
            cachedSettings = { ...DEFAULT_SETTINGS };
        }
    } catch (err) {
        console.error('Failed to load settings:', err);
        cachedSettings = { ...DEFAULT_SETTINGS };
    }
    return { ...cachedSettings };
}

/**
 * Save a partial settings update. Merges with existing settings.
 */
export async function updateSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
    const current = await getSettings();
    const updated = { ...current, ...partial };
    cachedSettings = updated;

    try {
        await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    } catch (err) {
        console.error('Failed to save settings:', err);
    }
    return { ...updated };
}

/**
 * Reset all settings to defaults.
 */
export async function resetSettings(): Promise<AppSettings> {
    cachedSettings = { ...DEFAULT_SETTINGS };
    try {
        await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(cachedSettings));
    } catch (err) {
        console.error('Failed to reset settings:', err);
    }
    return { ...cachedSettings };
}

/**
 * Check if data retention cleanup is needed (runs once per day).
 */
export async function shouldRunRetentionCleanup(): Promise<boolean> {
    const settings = await getSettings();
    const oneDayMs = 24 * 60 * 60 * 1000;
    return Date.now() - settings.lastRetentionCleanup > oneDayMs;
}

/**
 * Mark retention cleanup as completed.
 */
export async function markRetentionCleanupDone(): Promise<void> {
    await updateSettings({ lastRetentionCleanup: Date.now() });
}
