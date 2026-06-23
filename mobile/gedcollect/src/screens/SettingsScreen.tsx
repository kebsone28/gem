import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  SafeAreaView,
  Switch,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@types/index';
import { loadSettings, saveSettings, getSettings } from '@config/settings';
import { logout, updateServerUrl } from '@services/api';
import Toast from 'react-native-toast-message';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

const SettingsScreen: React.FC<Props> = ({ navigation }) => {
  const [autoSync, setAutoSync] = useState(true);
  const [wifiOnly, setWifiOnly] = useState(false);
  const [serverUrl, setServerUrl] = useState('');

  useEffect(() => {
    loadSettings().then((s) => {
      setAutoSync(s.autoSync);
      setWifiOnly(s.wifiOnly);
      setServerUrl(s.serverUrl);
    });
  }, []);

  const handleToggleAutoSync = async (v: boolean) => {
    setAutoSync(v);
    await saveSettings({ autoSync: v });
  };

  const handleToggleWifiOnly = async (v: boolean) => {
    setWifiOnly(v);
    await saveSettings({ wifiOnly: v });
  };

  const handleLogout = () => {
    logout();
    navigation.reset({ index: 0, routes: [{ name: 'Login' as any }] });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0e27" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Paramètres</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Synchronisation</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Synchronisation automatique</Text>
            <Switch
              value={autoSync}
              onValueChange={handleToggleAutoSync}
              trackColor={{ false: '#1e2a4a', true: '#4f8cff66' }}
              thumbColor={autoSync ? '#4f8cff' : '#475569'}
            />
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Wi-Fi uniquement</Text>
            <Switch
              value={wifiOnly}
              onValueChange={handleToggleWifiOnly}
              trackColor={{ false: '#1e2a4a', true: '#4f8cff66' }}
              thumbColor={wifiOnly ? '#4f8cff' : '#475569'}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Serveur</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>URL du serveur</Text>
          </View>
          <TextInput
            style={styles.input}
            value={serverUrl}
            onChangeText={setServerUrl}
            placeholder="https://ged.proquelec.sn"
            placeholderTextColor="#475569"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={async () => {
              await saveSettings({ serverUrl });
              await updateServerUrl(serverUrl);
              Toast.show({ type: 'success', text1: 'URL sauvegardée', text2: serverUrl });
            }}
          >
            <Text style={styles.saveBtnText}>Enregistrer</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutBtnText}>Déconnexion</Text>
        </TouchableOpacity>

        <Text style={styles.version}>GedCollect v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e27' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e2a4a',
  },
  backBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#1e2a4a' },
  backBtnText: { color: '#8899aa', fontSize: 14, fontWeight: '600' },
  headerTitle: { flex: 1, textAlign: 'center', color: '#e8edf5', fontSize: 17, fontWeight: '700' },
  content: { padding: 16 },
  section: { backgroundColor: '#141832', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#1e2a4a', marginBottom: 24 },
  sectionTitle: { color: '#4f8cff', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', marginBottom: 16 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e2a4a',
  },
  rowLabel: { color: '#e8edf5', fontSize: 15, fontWeight: '500' },
  logoutBtn: {
    backgroundColor: '#ff475722',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ff475744',
  },
  logoutBtnText: { color: '#ff4757', fontSize: 16, fontWeight: '700' },
  version: { color: '#475569', fontSize: 12, textAlign: 'center', marginTop: 32 },
  input: {
    backgroundColor: '#1e2a4a',
    color: '#e8edf5',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#2a3a5a',
    marginBottom: 12,
  },
  saveBtn: {
    backgroundColor: '#4f8cff22',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4f8cff44',
  },
  saveBtnText: { color: '#4f8cff', fontSize: 15, fontWeight: '700' },
});

export default SettingsScreen;
