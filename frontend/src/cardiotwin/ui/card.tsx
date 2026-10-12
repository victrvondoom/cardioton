/**
 * Card Component for CardioTwin
 *
 * Simplified version adapted for CardioTwin design system
 * Original inspiration: case-twin-main shadcn/ui components
 *
 * This component provides styled card variants for CardioTwin's near-black theme
 */

import React from 'react';
import { cn } from './utils';

/** Card component - main container */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn(
                'rounded-xl border border-slate-700/50 bg-slate-800/30 backdrop-blur-sm transition-shadow duration-200',
                className
            )}
            {...props}
        />
    );
}

/** CardHeader - header section of card */
export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn('px-6 py-4 border-b border-slate-700/50', className)}
            {...props}
        />
    );
}

/** CardTitle - title in card header */
export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
    return (
        <h3
            className={cn('text-lg font-semibold tracking-tight text-slate-200', className)}
            {...props}
        />
    );
}

/** CardDescription - description text in card */
export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
    return (
        <p
            className={cn('text-sm leading-relaxed text-slate-500', className)}
            {...props}
        />
    );
}

/** CardContent - main content area of card */
export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn('p-6', className)}
            {...props}
        />
    );
}

/** CardFooter - footer section of card */
export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn('px-6 py-4 border-t border-slate-700/50', className)}
            {...props}
        />
    );
}
