import React from 'react';
import {
    TouchableOpacity,
    Text,
    StyleSheet,
    ActivityIndicator,
    ViewStyle,
    TextStyle,
} from 'react-native';
import { Typography, Spacing, Radius } from '@/constants/axxess__constants__theme';
import { useThemeColors } from '@/constants/useThemeColors';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
    title: string;
    onPress: () => void;
    variant?: ButtonVariant;
    size?: ButtonSize;
    disabled?: boolean;
    loading?: boolean;
    icon?: React.ReactNode;
    style?: ViewStyle;
}

export function Button({
    title,
    onPress,
    variant = 'primary',
    size = 'md',
    disabled,
    loading,
    icon,
    style,
}: ButtonProps) {
    const colors = useThemeColors();

    const variantStyles: Record<ButtonVariant, { bg: string; text: string; border?: string }> = {
        primary: { bg: colors.primary, text: colors.textInverse },
        secondary: { bg: colors.secondary, text: colors.textInverse },
        outline: { bg: 'transparent', text: colors.primary, border: colors.primary },
        ghost: { bg: 'transparent', text: colors.textSecondary },
        danger: { bg: colors.statusRed, text: colors.textInverse },
    };

    const sizeStyles: Record<ButtonSize, { height: number; px: number; text: TextStyle }> = {
        sm: { height: 36, px: Spacing.md, text: Typography.caption },
        md: { height: 44, px: Spacing.lg, text: Typography.body },
        lg: { height: 52, px: Spacing.xl, text: Typography.h3 },
    };

    const v = variantStyles[variant];
    const s = sizeStyles[size];

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled || loading}
            activeOpacity={0.7}
            style={[
                styles.button,
                {
                    backgroundColor: v.bg,
                    height: s.height,
                    paddingHorizontal: s.px,
                    borderColor: v.border || 'transparent',
                    borderWidth: v.border ? 1.5 : 0,
                    opacity: disabled ? 0.5 : 1,
                },
                style,
            ]}
        >
            {loading ? (
                <ActivityIndicator size="small" color={v.text} />
            ) : (
                <>
                    {icon}
                    <Text
                        style={[
                            styles.text,
                            s.text,
                            { color: v.text, fontWeight: '600', marginLeft: icon ? Spacing.sm : 0 },
                        ]}
                    >
                        {title}
                    </Text>
                </>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: Radius.md,
    },
    text: {
        textAlign: 'center',
    },
});
