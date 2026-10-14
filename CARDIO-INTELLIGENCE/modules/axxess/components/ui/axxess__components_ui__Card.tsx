import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Spacing, Radius, Shadows } from '@/constants/axxess__constants__theme';
import { useThemeColors } from '@/constants/useThemeColors';

interface CardProps {
    children: React.ReactNode;
    accentColor?: string;
    elevated?: boolean;
    style?: ViewStyle;
}

export function Card({ children, accentColor, elevated, style }: CardProps) {
    const colors = useThemeColors();

    return (
        <View
            style={[
                styles.card,
                { backgroundColor: colors.surface },
                elevated ? Shadows.elevated : Shadows.card,
                style,
            ]}
        >
            {accentColor && (
                <View style={[styles.accent, { backgroundColor: accentColor }]} />
            )}
            <View style={styles.content}>
                {children}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: Radius.md,
        overflow: 'hidden',
        flexDirection: 'row',
    },
    accent: {
        width: 4,
        borderTopLeftRadius: Radius.md,
        borderBottomLeftRadius: Radius.md,
    },
    content: {
        flex: 1,
        padding: Spacing.md,
    },
});
