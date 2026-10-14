import React from 'react';
import { View, Text, StyleSheet, StatusBar, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing } from '@/constants/axxess__constants__theme';
import { useThemeColors } from '@/constants/useThemeColors';

interface HeaderProps {
    title: string;
    subtitle?: string;
    leftElement?: React.ReactNode;
    rightElement?: React.ReactNode;
}

export function Header({ title, subtitle, leftElement, rightElement }: HeaderProps) {
    const insets = useSafeAreaInsets();
    const colors = useThemeColors();

    return (
        <View style={[styles.container, { paddingTop: insets.top + Spacing.sm, backgroundColor: colors.primary }]}>
            <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
            <View style={styles.content}>
                <View style={styles.left}>
                    {leftElement}
                </View>
                <View style={styles.center}>
                    <Text style={styles.title} numberOfLines={1}>{title}</Text>
                    {subtitle && <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>}
                </View>
                <View style={styles.right}>
                    {rightElement}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm + 4,
        minHeight: 52,
    },
    left: {
        minWidth: 44,
        alignItems: 'flex-start',
    },
    center: {
        flex: 1,
        alignItems: 'center',
    },
    right: {
        minWidth: 44,
        alignItems: 'flex-end',
    },
    title: {
        ...Typography.h3,
        color: '#FFFFFF',
        fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
    },
    subtitle: {
        ...Typography.caption,
        color: 'rgba(255,255,255,0.8)',
        marginTop: 2,
    },
});
