import { useColorScheme } from 'react-native';
import { Colors, DarkColors } from './axxess__constants__theme';

/**
 * Returns the active color palette based on system theme.
 */
export function useThemeColors() {
    const scheme = useColorScheme();
    return scheme === 'dark' ? DarkColors : Colors;
}
