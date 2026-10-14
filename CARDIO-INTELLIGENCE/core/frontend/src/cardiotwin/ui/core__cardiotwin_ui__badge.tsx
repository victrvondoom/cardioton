/**
 * Badge Component for CardioTwin
 *
 * Simplified version adapted for CardioTwin design system
 * Original inspiration: case-twin-main shadcn/ui components
 *
 * This component provides styled badge variants for CardioTwin's near-black theme
 */

import React from 'react';
import { cn } from './core__cardiotwin_ui__utils';

/** Badge variant types */
export type BadgeVariant = 'default' | 'secondary' | 'success' | 'warning' | 'danger' | 'primary';

/** Props for Badge component */
export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
    /** Badge variant for styling */
    variant?: BadgeVariant;
}

/** Badge component
 * Displays a styled badge with different color variants
 *
 * @example
 * ```tsx
 * <Badge variant="primary">New</Badge>
 * <Badge variant="success">Verified</Badge>
 * <Badge variant="danger">Critical</Badge>
 * ```
 */
export function Badge({ className, variant = 'default', children, ...props }: BadgeProps) {
    const variantClasses = {
        default: 'bg-slate-700/50 text-slate-300 border-slate-600/50',
        secondary: 'bg-slate-800/50 text-slate-400 border-slate-700/50',
        primary: 'bg-orange-900/30 text-orange-400 border-orange-700/50',
        success: 'bg-green-900/30 text-green-400 border-green-700/50',
        warning: 'bg-yellow-900/30 text-yellow-400 border-yellow-700/50',
        danger: 'bg-red-900/30 text-red-400 border-red-700/50',
    };

    return (
        <div
            className={cn(
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border',
                variantClasses[variant],
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
}

export default Badge;
