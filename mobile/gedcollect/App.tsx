import React, { useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import type { RootStackParamList } from '@types/index';
import { loadSettings } from '@config/settings';
import { isAuthenticated } from '@services/api';
import { startAutoSync, stopAutoSync, syncPendingSubmissions } from '@services/syncService';
import { ThemeProvider, useTheme } from '@theme/ThemeContext';
import { PinLockProvider } from '@components/PinLock';

import LoginScreen from '@screens/LoginScreen';
import FormListScreen from '@screens/FormListScreen';
import FormScreen from '@screens/FormScreen';
import DraftsScreen from '@screens/DraftsScreen';
import DashboardScreen from '@screens/DashboardScreen';
import QRScannerScreen from '@screens/QRScannerScreen';
import SettingsScreen from '@screens/SettingsScreen';
import SubmissionsScreen from '@screens/SubmissionsScreen';
import { isBiometricAvailable, authenticateBiometric } from '@services/nativeCapabilities';

const Stack = createNativeStackNavigator<RootStackParamList>();

const ThemedApp: React.FC<{ loggedIn: boolean; setLoggedIn: (v: boolean) => void }> = ({
  loggedIn,
  setLoggedIn,
}) => {
  const { theme } = useTheme();

  if (!loggedIn) {
    return (
      <>
        <LoginScreen onLoginSuccess={() => setLoggedIn(true)} />
        <Toast />
      </>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="FormList"
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: theme.bg },
        }}
      >
        <Stack.Screen name="FormList">
          {(props) => <FormListScreen {...props} onLogout={() => setLoggedIn(false)} />}
        </Stack.Screen>
        <Stack.Screen name="Form" component={FormScreen} />
        <Stack.Screen name="Drafts" component={DraftsScreen} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="QRScanner" component={QRScannerScreen} />
        <Stack.Screen name="Settings">
          {(props) => <SettingsScreen {...props} onLogout={() => setLoggedIn(false)} />}
        </Stack.Screen>
        <Stack.Screen name="Submissions" component={SubmissionsScreen} />
      </Stack.Navigator>
      <Toast />
    </NavigationContainer>
  );
};

const App: React.FC = () => {
  const [ready, setReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [appState, setAppState] = useState<AppStateStatus>('active');

  useEffect(() => {
    let cancelled = false;

    Promise.resolve()
      .then(() => loadSettings())
      .then(() => isAuthenticated())
      .then((auth) => {
        if (cancelled) return;
        setLoggedIn(auth);
        if (auth) {
          try {
            startAutoSync();
          } catch (e) {
            console.warn('[startup] AutoSync init failed:', e);
          }
        }
      })
      .catch((err) => {
        console.warn('[startup] Initialization error (non-fatal):', err);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
      try {
        stopAutoSync();
      } catch {
        /* ignore */
      }
    };
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      setAppState(state);
      if (state === 'active') {
        syncPendingSubmissions();
        isBiometricAvailable().then((avail) => {
          if (avail) authenticateBiometric().catch(() => {});
        });
      }
    });
    return () => sub.remove();
  }, []);

  if (!ready) return null;

  return (
    <ThemeProvider>
      <PinLockProvider appState={appState}>
        <ThemedApp loggedIn={loggedIn} setLoggedIn={setLoggedIn} />
      </PinLockProvider>
    </ThemeProvider>
  );
};

export default App;
