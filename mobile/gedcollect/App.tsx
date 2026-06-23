import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import type { RootStackParamList } from '@types/index';
import { loadSettings } from '@config/settings';
import { isAuthenticated } from '@services/api';

import LoginScreen from '@screens/LoginScreen';
import FormListScreen from '@screens/FormListScreen';
import FormScreen from '@screens/FormScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

const App: React.FC = () => {
  const [ready, setReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    loadSettings()
      .then(() => isAuthenticated())
      .then((auth) => setLoggedIn(auth))
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  if (!ready) return null;

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
          contentStyle: { backgroundColor: '#0f172a' },
        }}
      >
        <Stack.Screen name="FormList">
          {(props) => <FormListScreen {...props} onLogout={() => setLoggedIn(false)} />}
        </Stack.Screen>
        <Stack.Screen name="Form" component={FormScreen} />
      </Stack.Navigator>
      <Toast />
    </NavigationContainer>
  );
};

export default App;
