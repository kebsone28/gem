import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { loadSubmissions, getSubmissionsForForm } from '@services/storage';
import OfflineBanner from '@components/OfflineBanner';
import HelpOverlay from '@components/HelpOverlay';
import { useTheme } from '@theme/ThemeContext';
import type { ThemeColors } from '@theme/themes';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'FormList'>;
  onLogout: () => void;
};

const FormListScreen: React.FC<Props> = ({ navigation, onLogout }) => {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [forms, setForms] = useState<any[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [syncStatus] = useState<SyncStatus>('idle');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingCounts, setPendingCounts] = useState<Record<string, { pending: number; draft: number }>>({});
  const [showHelp, setShowHelp] = useState(false);
  const [dashboardStats, setDashboardStats] = useState({ drafts: 0, pending: 0, synced: 0, total: 0 });

  const loadPendingCounts = useCallback(async () => {
    try {
      const subs = await loadSubmissions();
      const counts: Record<string, { pending: number; draft: number }> = {};
      let drafts = 0, pending = 0, synced = 0;
      for (const s of subs) {
        if (!counts[s.formKey]) counts[s.formKey] = { pending: 0, draft: 0 };
        if (s.status === 'pending' || s.status === 'error') { counts[s.formKey].pending++; pending++; }
        if (s.status === 'draft') { counts[s.formKey].draft++; drafts++; }
        if (s.status === 'synced') synced++;
      }
      setPendingCounts(counts);
      setDashboardStats({ drafts, pending, synced, total: subs.length });
    } catch {}
  }, []);

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
    loadPendingCounts();
  }, [loadData, loadPendingCounts]);

  useFocusEffect(
    useCallback(() => {
      loadData();
      loadPendingCounts();
    }, [loadData, loadPendingCounts]),
  );

  useEffect(() => {
    const unsubNetInfo = NetInfo.addEventListener((state) => {
      setIsOnline(!!state.isConnected);
    });
    return () => unsubNetInfo();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadData(), loadPendingCounts()]);
    setRefreshing(false);
  };

  const handlePressForm = (form: any) => {
    navigation.navigate('Form', {
      formKey: form.formKey,
      formTitle: form.title,
      survey: form.survey || [],
      choices: form.choices || [],
      serverVersion: form.version,
    });
  };

  const handlePressDraft = async (form: any) => {
    try {
      const subs = await getSubmissionsForForm(form.formKey);
      const draftSub = subs.find((s) => s.status === 'draft');
      if (!draftSub) {
        Toast.show({ type: 'error', text1: 'Aucun brouillon trouvé' });
        return;
      }
      navigation.navigate('Form', {
        formKey: form.formKey,
        formTitle: `${form.title} (brouillon)`,
        survey: form.survey || [],
        choices: form.choices || [],
        serverVersion: form.version,
        draft: { id: draftSub.id, values: draftSub.values, photos: (draftSub as any).photos || {} },
      });
    } catch {
      Toast.show({ type: 'error', text1: 'Erreur chargement brouillon' });
    }
  };

  const handleViewSubmissions = (form: any) => {
    navigation.navigate('Submissions', { formKey: form.formKey });
  };

  const handleLogout = async () => {
    await logout();
    onLogout();
  };

  const renderForm = ({ item }: { item: any }) => {
    const counts = pendingCounts[item.formKey];
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => handlePressForm(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <View style={styles.cardBadgeRow}>
            {counts?.draft ? (
              <TouchableOpacity style={styles.badgeDraft} onPress={() => handlePressDraft(item)}>
                <Text style={styles.badgeDraftText}>{counts.draft} brouillon{counts.draft > 1 ? 's' : ''}</Text>
              </TouchableOpacity>
            ) : null}
            {counts?.pending ? (
              <View style={styles.badgePending}>
                <Text style={styles.badgePendingText}>{counts.pending} en attente</Text>
              </View>
            ) : null}
            <Text style={styles.cardVersion}>v{item.version}</Text>
          </View>
        </View>
        {item.description ? (
          <Text style={styles.cardDesc}>{item.description}</Text>
        ) : null}
        <Text style={styles.cardFields}>
          {item.survey?.length || 0} champ(s)
        </Text>
        {counts && (counts.pending > 0 || counts.draft > 0) ? (
          <TouchableOpacity style={styles.viewSubBtn} onPress={() => handleViewSubmissions(item)}>
            <Text style={styles.viewSubText}>Voir les soumissions →</Text>
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>
    );
  };

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
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => navigation.navigate('Dashboard')} style={styles.settingsBtn}>
              <Text style={styles.settingsText}>📊</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Drafts')} style={styles.settingsBtn}>
              <Text style={styles.settingsText}>📝</Text>
              {dashboardStats.drafts > 0 ? (
                <View style={styles.badge}><Text style={styles.badgeText}>{dashboardStats.drafts > 99 ? '99+' : dashboardStats.drafts}</Text></View>
              ) : null}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowHelp(true)} style={styles.settingsBtn}>
              <Text style={styles.helpText}>?</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.settingsBtn}>
              <Text style={styles.settingsText}>⚙️</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Dashboard */}
      <View style={styles.dashboard}>
        <View style={styles.dashItem}>
          <Text style={styles.dashValue}>{forms.length}</Text>
          <Text style={styles.dashLabel}>📋 Formulaires</Text>
        </View>
        <View style={styles.dashItem}>
          <Text style={[styles.dashValue, { color: '#f59e0b' }]}>{dashboardStats.drafts}</Text>
          <Text style={styles.dashLabel}>📝 Brouillons</Text>
        </View>
        <View style={styles.dashItem}>
          <Text style={[styles.dashValue, { color: '#4f8cff' }]}>{dashboardStats.pending}</Text>
          <Text style={styles.dashLabel}>📤 En attente</Text>
        </View>
        <View style={styles.dashItem}>
          <Text style={[styles.dashValue, { color: '#22c55e' }]}>{dashboardStats.synced}</Text>
          <Text style={styles.dashLabel}>✅ Synchro</Text>
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

      <HelpOverlay visible={showHelp} onClose={() => setShowHelp(false)} />
    </View>
  );
};

const makeStyles = (theme: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  centered: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: theme.textMuted, marginTop: 12, fontWeight: '600' },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerTitle: { color: theme.text, fontSize: 28, fontWeight: '800' },
  headerSubtitle: { color: theme.textMuted, fontSize: 14, fontWeight: '500', marginTop: 4 },
  dashboard: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 16,
    backgroundColor: theme.bgCard, borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: theme.border,
  },
  dashItem: { flex: 1, alignItems: 'center' },
  dashValue: { color: theme.text, fontSize: 22, fontWeight: '800' },
  dashLabel: { color: theme.textMuted, fontSize: 10, fontWeight: '600', marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  settingsBtn: {
    backgroundColor: theme.bgCard,
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: theme.border,
  },
  helpText: { color: theme.accent, fontSize: 18, fontWeight: '800' },
  settingsText: { fontSize: 16 },
  badge: {
    position: 'absolute', top: -6, right: -6,
    backgroundColor: '#f59e0b', borderRadius: 10,
    minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  logoutBtn: {
    backgroundColor: theme.bgCard,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1, borderColor: theme.border,
  },
  logoutText: { color: theme.textMuted, fontSize: 13, fontWeight: '600' },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  card: {
    backgroundColor: theme.bgCard,
    borderRadius: 14, padding: 18, marginBottom: 12,
    borderWidth: 1, borderColor: theme.border,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: theme.text, fontSize: 16, fontWeight: '700', flex: 1 },
  cardBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardVersion: { color: theme.accent, fontSize: 12, fontWeight: '600' },
  badgeDraft: {
    backgroundColor: theme.warning + '22',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    borderWidth: 1, borderColor: theme.warning + '44',
  },
  badgeDraftText: { color: theme.warning, fontSize: 10, fontWeight: '700' },
  badgePending: {
    backgroundColor: theme.accent + '22',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    borderWidth: 1, borderColor: theme.accent + '44',
  },
  badgePendingText: { color: theme.accent, fontSize: 10, fontWeight: '700' },
  cardDesc: { color: theme.textMuted, fontSize: 13, marginTop: 6 },
  cardFields: { color: theme.accent, fontSize: 12, marginTop: 8, fontWeight: '500' },
  viewSubBtn: { marginTop: 10, alignItems: 'flex-end' },
  viewSubText: { color: theme.accent, fontSize: 13, fontWeight: '600' },
  emptyContainer: { flex: 1, justifyContent: 'center' },
  empty: { alignItems: 'center', paddingHorizontal: 40 },
  emptyTitle: { color: theme.text, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySubtitle: { color: theme.textMuted, fontSize: 14, textAlign: 'center' },
});

export default FormListScreen;
