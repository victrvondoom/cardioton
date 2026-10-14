/**
 * MedScribe — Axxess Healthcare Design System
 * Professional medical aesthetics, no emojis.
 * Crimson headers, white cards, blue interactive elements.
 */

export const Colors = {
    // Primary (Crimson) — Headers, primary actions, clinician-side elements
    primary: '#8B1A2E',
    primaryDark: '#6A1423',
    primaryLight: '#B83249',

    // Secondary (Blue) — Interactive elements, patient-side, links
    secondary: '#2563EB',
    secondaryDark: '#1D4ED8',
    secondaryLight: '#3B82F6',

    // Backgrounds
    background: '#F8F9FA',
    surface: '#FFFFFF',
    surfaceElevated: '#F1F3F5',

    // Text
    textPrimary: '#1A1D21',
    textSecondary: '#495057',
    textTertiary: '#868E96',
    textInverse: '#FFFFFF',

    // Status
    statusGreen: '#059669',
    statusAmber: '#D97706',
    statusRed: '#DC2626',

    // Entity Highlights
    entitySymptom: '#FEE2E2',
    entityMedication: '#DBEAFE',
    entityVital: '#D1FAE5',
    entityCondition: '#FEF3C7',

    // Borders & Dividers
    border: '#DEE2E6',
    borderLight: '#E9ECEF',
    divider: '#F1F3F5',

    // Overlays
    overlay: 'rgba(0, 0, 0, 0.5)',
    overlayLight: 'rgba(0, 0, 0, 0.08)',
} as const;

export const DarkColors = {
    primary: '#B83249',
    primaryDark: '#8B1A2E',
    primaryLight: '#D94A63',

    secondary: '#3B82F6',
    secondaryDark: '#2563EB',
    secondaryLight: '#60A5FA',

    background: '#0F1117',
    surface: '#1A1D24',
    surfaceElevated: '#252830',

    textPrimary: '#F1F3F5',
    textSecondary: '#ADB5BD',
    textTertiary: '#6C757D',
    textInverse: '#1A1D21',

    statusGreen: '#10B981',
    statusAmber: '#F59E0B',
    statusRed: '#EF4444',

    entitySymptom: 'rgba(254, 226, 226, 0.15)',
    entityMedication: 'rgba(219, 234, 254, 0.15)',
    entityVital: 'rgba(209, 250, 229, 0.15)',
    entityCondition: 'rgba(254, 243, 199, 0.15)',

    border: '#2D3139',
    borderLight: '#353940',
    divider: '#252830',

    overlay: 'rgba(0, 0, 0, 0.7)',
    overlayLight: 'rgba(255, 255, 255, 0.06)',
} as const;

export const Typography = {
    h1: {
        fontSize: 28,
        fontWeight: '700' as const,
        lineHeight: 36,
        letterSpacing: -0.5,
    },
    h2: {
        fontSize: 22,
        fontWeight: '600' as const,
        lineHeight: 28,
        letterSpacing: -0.3,
    },
    h3: {
        fontSize: 18,
        fontWeight: '600' as const,
        lineHeight: 24,
        letterSpacing: 0,
    },
    body: {
        fontSize: 16,
        fontWeight: '400' as const,
        lineHeight: 24,
        letterSpacing: 0,
    },
    bodySmall: {
        fontSize: 14,
        fontWeight: '400' as const,
        lineHeight: 20,
        letterSpacing: 0,
    },
    caption: {
        fontSize: 13,
        fontWeight: '400' as const,
        lineHeight: 18,
        letterSpacing: 0.1,
    },
    badge: {
        fontSize: 11,
        fontWeight: '600' as const,
        lineHeight: 14,
        letterSpacing: 0.5,
        textTransform: 'uppercase' as const,
    },
    mono: {
        fontSize: 14,
        fontWeight: '500' as const,
        lineHeight: 20,
        letterSpacing: 0,
        fontFamily: 'monospace',
    },
} as const;

export const Spacing = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
} as const;

export const Radius = {
    sm: 6,
    md: 10,
    lg: 16,
    xl: 24,
    pill: 999,
} as const;

export const Shadows = {
    card: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        elevation: 2,
    },
    elevated: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
        elevation: 6,
    },
    header: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    },
} as const;

export const Animation = {
    fast: 150,
    normal: 250,
    slow: 400,
    spring: {
        damping: 18,
        stiffness: 180,
        mass: 1,
    },
} as const;
