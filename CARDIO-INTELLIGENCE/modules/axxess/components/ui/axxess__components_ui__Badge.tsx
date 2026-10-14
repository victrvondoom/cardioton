import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Typography, Spacing, Radius } from '@/constants/axxess__constants__theme';
import { useThemeColors } from '@/constants/useThemeColors';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

interface BadgeProps {
    label: string;
    variant?: BadgeVariant;
    style?: ViewStyle;
}

export function Badge({ label, variant = 'default', style }: BadgeProps) {
    const colors = useThemeColors();

    const variantStyles: Record<BadgeVariant, { bg: string; text: string }> = {
        default: { bg: colors.surfaceElevated, text: colors.textSecondary },
        success: { bg: colors.entityVital, text: colors.statusGreen },
        warning: { bg: colors.entityCondition, text: colors.statusAmber },
        error: { bg: colors.entitySymptom, text: colors.statusRed },
        info: { bg: colors.entityMedication, text: colors.secondary },
    };

    const v = variantStyles[variant];

    return (
        <View style={[styles.badge, { backgroundColor: v.bg }, style]}>
            <Text style={[styles.label, { color: v.text }]}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    badge: {
        paddingHorizontal: Spacing.sm + 2,
        paddingVertical: Spacing.xs,
        borderRadius: Radius.pill,
        alignSelf: 'flex-start',
    },
    label: {
        ...Typography.badge,
    },
});
