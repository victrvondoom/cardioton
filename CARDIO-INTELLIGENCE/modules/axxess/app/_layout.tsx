import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { StatusBar, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import 'react-native-reanimated';
import * as LocalAuthentication from 'expo-local-authentication';
import { Ionicons } from '@expo/vector-icons';

import { useColorScheme } from '@/components/useColorScheme';
import { Colors, DarkColors } from '@/constants/axxess__constants__theme';
import { DatabaseProvider } from '@/src/providers/DatabaseProvider';
import { getSettings } from '@/src/stores/settingsStore';

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

const MedScribeLight = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.primary,
    background: Colors.background,
    card: Colors.surface,
    text: Colors.textPrimary,
    border: Colors.border,
    notification: Colors.statusRed,
  },
};

const MedScribeDark = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: DarkColors.primary,
    background: DarkColors.background,
    card: DarkColors.surface,
    text: DarkColors.textPrimary,
    border: DarkColors.border,
    notification: DarkColors.statusRed,
  },
};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

// ─── Auth states ─────────────────────────────────────
type AuthState = 'checking' | 'authenticated' | 'locked' | 'failed';

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const [authState, setAuthState] = useState<AuthState>('checking');
  const [biometricLabel, setBiometricLabel] = useState('Biometric');

  useEffect(() => {
    checkBiometricGate();
  }, []);

  async function checkBiometricGate() {
    try {
      const settings = await getSettings();

      // If biometric not enabled, skip gate
      if (!settings.biometricEnabled) {
        setAuthState('authenticated');
        return;
      }

      // Check hardware availability
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();

      if (!compatible || !enrolled) {
        // Hardware not available — skip gate to avoid locking user out
        setAuthState('authenticated');
        return;
      }

      // Detect type for label
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        setBiometricLabel('Face ID');
      } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        setBiometricLabel('Fingerprint');
      }

      await promptBiometric();
    } catch {
      // Any error during check — let user in to prevent lockout
      setAuthState('authenticated');
    }
  }

  async function promptBiometric() {
    setAuthState('locked');
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access MedScribe',
        fallbackLabel: 'Use Passcode',
        cancelLabel: 'Cancel',
      });

      if (result.success) {
        setAuthState('authenticated');
      } else {
        setAuthState('failed');
      }
    } catch {
      setAuthState('failed');
    }
  }

  // ─── Checking state — brief loading screen ────────
  if (authState === 'checking') {
    return (
      <View style={authStyles.container}>
        <View style={authStyles.logoBox}>
          <View style={authStyles.logoCircle}>
            <Ionicons name="medical" size={36} color="#FFFFFF" />
          </View>
          <Text style={authStyles.appName}>MedScribe</Text>
        </View>
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
      </View>
    );
  }

  // ─── Locked / Failed state — auth wall ───────────
  if (authState === 'locked' || authState === 'failed') {
    return (
      <View style={authStyles.container}>
        <View style={authStyles.logoBox}>
          <View style={authStyles.logoCircle}>
            <Ionicons name="medical" size={36} color="#FFFFFF" />
          </View>
          <Text style={authStyles.appName}>MedScribe</Text>
          <Text style={authStyles.appSub}>Clinical Documentation AI</Text>
        </View>

        <View style={authStyles.lockBox}>
          <View style={authStyles.lockIconCircle}>
            <Ionicons name="lock-closed" size={32} color={Colors.primary} />
          </View>
          <Text style={authStyles.lockTitle}>Authentication Required</Text>
          <Text style={authStyles.lockSub}>
            {biometricLabel} is required to access MedScribe and protect patient data.
          </Text>
          {authState === 'failed' && (
            <Text style={authStyles.failedText}>Authentication failed. Please try again.</Text>
          )}

          <TouchableOpacity
            style={authStyles.authButton}
            onPress={promptBiometric}
            activeOpacity={0.8}
          >
            <Ionicons
              name={biometricLabel === 'Face ID' ? 'scan' : 'finger-print'}
              size={22}
              color="#FFFFFF"
            />
            <Text style={authStyles.authButtonText}>
              Authenticate with {biometricLabel}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={authStyles.passkeyButton}
            onPress={promptBiometric}
          >
            <Text style={authStyles.passkeyText}>Use Passcode Instead</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── Authenticated — show app ─────────────────────
  return (
    <DatabaseProvider>
      <ThemeProvider value={colorScheme === 'dark' ? MedScribeDark : MedScribeLight}>
        <StatusBar
          barStyle="light-content"
          backgroundColor={Colors.primary}
        />
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="note-review" options={{ headerShown: false, presentation: 'card' }} />
          <Stack.Screen name="patient-profile" options={{ headerShown: false, presentation: 'card' }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
        </Stack>
      </ThemeProvider>
    </DatabaseProvider>
  );
}

const authStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logoBox: { alignItems: 'center', marginBottom: 16 },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  appName: { fontSize: 28, fontWeight: '800', color: '#1a1a2e' },
  appSub: { fontSize: 13, color: '#888', marginTop: 4 },
  lockBox: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    marginTop: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  lockIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  lockTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a2e', marginBottom: 8 },
  lockSub: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  failedText: {
    fontSize: 13,
    color: Colors.statusRed,
    fontWeight: '600',
    marginBottom: 8,
  },
  authButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    width: '100%',
    justifyContent: 'center',
    marginTop: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  authButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  passkeyButton: { marginTop: 12, padding: 8 },
  passkeyText: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
});
