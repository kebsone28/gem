import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, StatusBar, TouchableOpacity,
  ScrollView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, DashboardStats } from '@types/index';
import { loadSubmissions } from '@services/storage';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

const DashboardScreen: React.FC<Props> = ({ navigation }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const computeStats = useCallback(async () => {
    const all = await loadSubmissions();
    const now = new Date();
    const today = now.toDateString();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

    const todaySubs = all.filter((s) => s.updatedAt && new Date(s.updatedAt).toDateString() === today);
    const weekSubs = all.filter((s) => s.updatedAt && new Date(s.updatedAt) >= weekAgo);

    const byDay: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      byDay[d.toDateString()] = 0;
    }
    for (const s of weekSubs) {
      if (s.updatedAt) {
        const ds = new Date(s.updatedAt).toDateString();
        if (byDay[ds] !== undefined) byDay[ds]++;
      }
    }

    const qualityScores = all
      .filter((s) => s.status === 'synced')
      .map((s) => {
        const vals = s.values || {};
        const keys = Object.keys(vals).filter((k) => !k.includes('::'));
        const filled = keys.filter((k) => vals[k] && String(vals[k]).trim()).length;
        return keys.length ? Math.round((filled / keys.length) * 100) : 0;
      });

    const byFormMap: Record<string, { title: string; count: number }> = {};
    for (const s of all) {
      if (!byFormMap[s.formKey]) byFormMap[s.formKey] = { title: s.formKey, count: 0 };
      byFormMap[s.formKey].count++;
    }

    setStats({
      todayCount: todaySubs.length,
      weekCount: weekSubs.length,
      totalCount: all.length,
      pendingCount: all.filter((s) => s.status === 'pending' || s.status === 'error').length,
      syncedCount: all.filter((s) => s.status === 'synced').length,
      draftCount: all.filter((s) => s.status === 'draft').length,
      averageQuality: qualityScores.length ? Math.round(qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length) : 0,
      lastSyncAt: all.filter((s) => s.status === 'synced').sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))[0]?.updatedAt || null,
      formsThisWeek: Object.entries(byDay).map(([day, count]) => ({ day: dayNames[new Date(day).getDay()], count })),
      byForm: Object.entries(byFormMap).map(([key, v]) => ({ formKey: key, formTitle: v.title, count: v.count })),
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      computeStats().finally(() => setLoading(false));
    }, [computeStats])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await computeStats();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}><ActivityIndicator size="large" color="#4f8cff" /></View>
      </SafeAreaView>
    );
  }

  const StatCard = ({ label, value, color, icon }: { label: string; value: number | string; color: string; icon: string }) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  const maxWeek = Math.max(...(stats?.formsThisWeek.map((d) => d.count) || [1]), 1);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Tableau de bord</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.backBtn}>
          <Text style={styles.backBtnText}>🔄</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4f8cff" />}
      >
        <View style={styles.statsGrid}>
          <StatCard icon="📥" label="Aujourd'hui" value={stats?.todayCount ?? 0} color="#4f8cff" />
          <StatCard icon="📅" label="Cette semaine" value={stats?.weekCount ?? 0} color="#22c55e" />
          <StatCard icon="📋" label="Brouillons" value={stats?.draftCount ?? 0} color="#f59e0b" />
          <StatCard icon="⏳" label="En attente" value={stats?.pendingCount ?? 0} color="#ff4757" />
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{stats?.totalCount ?? 0}</Text>
            <Text style={styles.summaryLabel}>Total soumissions</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{stats?.syncedCount ?? 0}</Text>
            <Text style={styles.summaryLabel}>Synchronisées</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{stats?.averageQuality ?? 0}%</Text>
            <Text style={styles.summaryLabel}>Qualité moyenne</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Activité cette semaine</Text>
          <View style={styles.weekChart}>
            {(stats?.formsThisWeek || []).map((d, i) => (
              <View key={i} style={styles.barCol}>
                <View style={[styles.bar, { height: Math.max((d.count / maxWeek) * 80, 4), backgroundColor: d.count > 0 ? '#4f8cff' : '#1a1f3a' }]} />
                <Text style={styles.barLabel}>{d.day}</Text>
                <Text style={styles.barCount}>{d.count}</Text>
              </View>
            ))}
          </View>
        </View>

        {stats && stats.byForm.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Par formulaire</Text>
            {stats.byForm.map((f, i) => (
              <View key={i} style={styles.formRow}>
                <Text style={styles.formName} numberOfLines={1}>{f.formTitle}</Text>
                <View style={styles.formBarBg}>
                  <View style={[styles.formBarFill, { width: `${Math.min((f.count / stats.totalCount) * 100, 100)}%` }]} />
                </View>
                <Text style={styles.formCount}>{f.count}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {stats?.lastSyncAt ? (
          <Text style={styles.lastSync}>Dernière synchro : {new Date(stats.lastSyncAt).toLocaleString('fr-FR')}</Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e27' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#000',
    borderBottomWidth: 1, borderBottomColor: '#1a1f3a',
  },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#141832', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#1e2a4a' },
  backBtnText: { color: '#e8edf5', fontSize: 20, fontWeight: '800' },
  title: { color: '#fff', fontSize: 18, fontWeight: '800' },
  scroll: { padding: 16, paddingBottom: 40 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statCard: {
    width: '47%', backgroundColor: '#141832', borderRadius: 16, borderWidth: 1, borderColor: '#1e2a4a',
    borderLeftWidth: 4, padding: 16,
  },
  statIcon: { fontSize: 24, marginBottom: 8 },
  statValue: { fontSize: 28, fontWeight: '800' },
  statLabel: { color: '#64748b', fontSize: 13, fontWeight: '600', marginTop: 4 },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  summaryCard: {
    flex: 1, backgroundColor: '#141832', borderRadius: 14, borderWidth: 1, borderColor: '#1e2a4a',
    padding: 14, alignItems: 'center',
  },
  summaryValue: { color: '#fff', fontSize: 22, fontWeight: '800' },
  summaryLabel: { color: '#64748b', fontSize: 12, fontWeight: '600', marginTop: 4 },
  section: { marginBottom: 20 },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '800', marginBottom: 12 },
  weekChart: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 120, backgroundColor: '#141832', borderRadius: 16, borderWidth: 1, borderColor: '#1e2a4a', padding: 16 },
  barCol: { alignItems: 'center', flex: 1 },
  bar: { width: 28, borderRadius: 6, minHeight: 4 },
  barLabel: { color: '#64748b', fontSize: 11, fontWeight: '600', marginTop: 6 },
  barCount: { color: '#94a3b8', fontSize: 11, fontWeight: '700' },
  formRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  formName: { color: '#e8edf5', fontSize: 13, fontWeight: '700', width: 100 },
  formBarBg: { flex: 1, height: 8, backgroundColor: '#0d1130', borderRadius: 4, overflow: 'hidden' },
  formBarFill: { height: '100%', backgroundColor: '#4f8cff', borderRadius: 4 },
  formCount: { color: '#94a3b8', fontSize: 13, fontWeight: '700', width: 30, textAlign: 'right' },
  lastSync: { color: '#64748b', fontSize: 12, textAlign: 'center', marginTop: 10 },
});

export default DashboardScreen;
