/**
 * Button Component for CardioTwin
 *
 * Simplified version adapted for CardioTwin design system
 * Original inspiration: case-twin-main shadcn/ui components
 *
 * This component provides styled button variants for CardioTwin's near-black theme
 */

import React from 'react';
import { cn } from './core__cardiotwin_ui__utils';

/** Button variant types */
export type ButtonVariant = 'default' | 'secondary' | 'ghost' | 'outline' | 'destructive';

/** Button size types */
export type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';

/** Props for Button component */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    /** Button variant for styling */
    variant?: ButtonVariant;
    /** Button size */
    size?: ButtonSize;
    /** Whether button is loading */
    isLoading?: boolean;
}

/** Button component
 * Displays a styled button with different variants and sizes
 *
 * @example
 * ```tsx
 * <Button variant="default">Click me</Button>
 * <Button variant="secondary">Secondary</Button>
 * <Button variant="ghost" size="sm">Ghost</Button>
 * ```
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({
        className,
        variant = 'default',
        size = 'default',
        isLoading = false,
        children,
        ...props
    }, ref) => {
        const baseClasses = 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:pointer-events-none disabled:opacity-50';

        const sizeClasses = {
            default: 'h-10 px-4 py-2',
            sm: 'h-9 px-3',
            lg: 'h-11 px-6',
            icon: 'h-10 w-10 p-0',
        };

        const variantClasses = {
            default: 'bg-orange-600 text-white shadow-[0_1px_2px_rgba(0,0,0,0.3)] hover:bg-orange-700 active:scale-[0.98]',
            secondary: 'border border-slate-600 bg-slate-800/50 text-slate-200 hover:bg-slate-700/50 active:scale-[0.98]',
            ghost: 'text-slate-300 hover:bg-slate-800/50 active:scale-[0.98]',
            outline: 'border border-slate-600 bg-transparent text-slate-200 hover:bg-slate-800/50 active:scale-[0.98]',
            destructive: 'bg-red-600 text-white hover:bg-red-700 active:scale-[0.98]',
        };

        return (
            <button
                className={cn(
                    baseClasses,
                    sizeClasses[size],
                    variantClasses[variant],
                    className
                )}
                ref={ref}
                disabled={isLoading || props.disabled}
                {...props}
            >
                {isLoading ? (
                    <div className="flex items-center gap-2">
                        <div className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                        <span>Loading...</span>
                    </div>
                ) : (
                    children
                )}
            </button>
        );
    }
);
Button.displayName = "Button";

export default Button;
