/**
 * CardioTwin UI Components Package
 *
 * This package provides shared UI components for the CardioTwin
 * cardiovascular intelligence platform, adapted from case-twin-main
 * shadcn/ui components to match CardioTwin's design system.
 *
 * Components:
 * - Badge: Styled badges for labels and status indicators
 * - Button: Interactive buttons with multiple variants
 * - Card: Container cards with header, content, and footer
 *
 * Utilities:
 * - cn: Class name merger (clsx + tailwind-merge)
 * - formatPercentage: Format numbers as percentages
 * - formatFileSize: Format file sizes in human-readable format
 */

// Components
export { default as Badge, type BadgeProps, type BadgeVariant } from './core__cardiotwin_ui__badge';
export { default as Button, type ButtonProps, type ButtonVariant, type ButtonSize } from './core__cardiotwin_ui__button';
export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './core__cardiotwin_ui__card';

// Utilities
export { cn, simpleCn, formatPercentage, formatFileSize, capitalize, truncate, debounce } from './core__cardiotwin_ui__utils';
