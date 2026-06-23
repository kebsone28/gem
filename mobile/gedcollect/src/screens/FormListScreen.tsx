import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList, SyncStatus } from '@types/index';
import { fetchAssignedForms, logout } from '@services/api';
import { getPendingSubmissions } from '@services/storage';
import OfflineBanner from '@components/OfflineBanner';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'FormList'>;
  onLogout: () => void;
};

const FormListScreen: React.FC<Props> = ({ navigation, onLogout }) => {
  const [forms, setForms] = useState<any[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [syncStatus] = useState<SyncStatus>('idle');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const data = await fetchAssignedForms();
      setForms(data);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Erreur', text2: e.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  useEffect(() => {
    const unsubNetInfo = NetInfo.addEventListener((state) => {
      setIsOnline(!!state.isConnected);
    });
    return () => unsubNetInfo();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handlePressForm = (form: any) => {
    navigation.navigate('Form', {
      formKey: form.formKey,
      formTitle: form.title,
      survey: form.survey || [],
      choices: form.choices || [],
    });
  };

  const handleLogout = async () => {
    await logout();
    onLogout();
  };

  const renderForm = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => handlePressForm(item)}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardVersion}>v{item.version}</Text>
      </View>
      {item.description ? (
        <Text style={styles.cardDesc}>{item.description}</Text>
      ) : null}
      <Text style={styles.cardFields}>
        {item.survey?.length || 0} champ(s)
      </Text>
    </TouchableOpacity>
  );

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>Aucun formulaire assigné</Text>
        <Text style={styles.emptySubtitle}>
          Contactez l'administrateur pour activer votre accès
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#4f8cff" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0e27" />
      <OfflineBanner visible={!isOnline} />

      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>GedCollect</Text>
            <Text style={styles.headerSubtitle}>
              {forms.length} formulaire(s) assigné(s)
            </Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Déconnexion</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={forms}
        keyExtractor={(item) => item.formKey}
        renderItem={renderForm}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={forms.length === 0 ? styles.emptyContainer : styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#4f8cff"
            colors={['#4f8cff']}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e27' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#8899aa', marginTop: 12, fontWeight: '600' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTitle: { color: '#e8edf5', fontSize: 28, fontWeight: '800' },
  headerSubtitle: { color: '#64748b', fontSize: 14, fontWeight: '500', marginTop: 4 },
  logoutBtn: {
    backgroundColor: '#1e2a4a',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a3a5a',
  },
  logoutText: { color: '#8899aa', fontSize: 13, fontWeight: '600' },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  card: {
    backgroundColor: '#141832',
    borderRadius: 14,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1e2a4a',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: { color: '#e8edf5', fontSize: 16, fontWeight: '700', flex: 1 },
  cardVersion: { color: '#4f8cff', fontSize: 12, fontWeight: '600' },
  cardDesc: { color: '#64748b', fontSize: 13, marginTop: 6 },
  cardFields: { color: '#4f8cff', fontSize: 12, marginTop: 8, fontWeight: '500' },
  emptyContainer: { flex: 1, justifyContent: 'center' },
  empty: { alignItems: 'center', paddingHorizontal: 40 },
  emptyTitle: { color: '#e8edf5', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySubtitle: { color: '#64748b', fontSize: 14, textAlign: 'center' },
});

export default FormListScreen;
