import React from 'react';
import { View, StyleSheet } from 'react-native';

type StatusLevel = 'high' | 'medium' | 'low';

interface StatusDotProps {
    level: StatusLevel;
    size?: number;
}

const STATUS_COLORS: Record<StatusLevel, string> = {
    high: '#059669',    // Green — >90% confidence
    medium: '#D97706',  // Amber — 75-90%
    low: '#DC2626',     // Red — <75%
};

export function StatusDot({ level, size = 8 }: StatusDotProps) {
    return (
        <View
            style={[
                styles.dot,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: STATUS_COLORS[level],
                },
            ]}
        />
    );
}

/**
 * Returns the status level for a confidence score (0.0 - 1.0).
 */
export function getConfidenceLevel(confidence: number): StatusLevel {
    if (confidence >= 0.9) return 'high';
    if (confidence >= 0.75) return 'medium';
    return 'low';
}

const styles = StyleSheet.create({
    dot: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 1,
    },
});
