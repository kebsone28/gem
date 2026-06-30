import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, StatusBar, TouchableOpacity,
  FlatList, Alert, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, GedSubmission } from '@types/index';
import { loadSubmissions, deleteSubmission } from '@services/storage';

type Props = NativeStackScreenProps<RootStackParamList, 'Drafts'>;

const DraftsScreen: React.FC<Props> = ({ navigation }) => {
  const [drafts, setDrafts] = useState<GedSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadSubmissions()
        .then((all) => setDrafts(all.filter((s) => s.status === 'draft')))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, [])
  );

  const progressPercent = (sub: GedSubmission) => {
    const values = sub.values || {};
    const keys = Object.keys(values).filter((k) => !k.includes('::'));
    const filled = keys.filter((k) => values[k] && String(values[k]).trim()).length;
    return { filled, total: keys.length || 1, pct: keys.length ? Math.round((filled / keys.length) * 100) : 0 };
  };

  const handleDelete = (id: string) => {
    Alert.alert('Supprimer', 'Supprimer ce brouillon ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => { await deleteSubmission(id); setDrafts((p) => p.filter((s) => s.id !== id)); } },
    ]);
  };

  const handleResume = (sub: GedSubmission) => {
    navigation.getParent()?.navigate('Form', {
      formKey: sub.formKey,
      formTitle: sub.formKey,
      survey: [],
      choices: [],
      draft: { id: sub.id, values: sub.values as any, photos: sub.photos },
      serverVersion: sub.formVersion,
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}><ActivityIndicator size="large" color="#4f8cff" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Mes brouillons</Text>
        <View style={styles.backBtn} />
      </View>
      <Text style={styles.count}>{drafts.length} brouillon{drafts.length !== 1 ? 's' : ''}</Text>
      {drafts.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyText}>Aucun brouillon</Text>
          <Text style={styles.emptySub}>Les formulaires sauvegardés apparaîtront ici</Text>
        </View>
      ) : (
        <FlatList
          data={drafts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const { filled, total, pct } = progressPercent(item);
            return (
              <TouchableOpacity style={styles.card} onPress={() => handleResume(item)} activeOpacity={0.7}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{item.formKey}</Text>
                  <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.delBtn}>
                    <Text style={styles.delBtnText}>🗑️</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.progressBg}>
                  <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: pct === 100 ? '#22c55e' : pct > 50 ? '#4f8cff' : '#f59e0b' }]} />
                </View>
                <Text style={styles.progressText}>{filled}/{total} champs remplis — {pct}%</Text>
                <View style={styles.metaRow}>
                  <Text style={styles.metaText}>📝 {item.formVersion || '1.0'}</Text>
                  <Text style={styles.metaText}>📸 {item.photos ? Object.values(item.photos).reduce((s, arr) => s + (Array.isArray(arr) ? arr.length : 0), 0) : 0}</Text>
                  <Text style={styles.metaText}>💾 {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString('fr-FR') : ''}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
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
  count: { color: '#64748b', fontSize: 14, fontWeight: '600', paddingHorizontal: 16, paddingVertical: 10 },
  list: { paddingHorizontal: 16, paddingBottom: 20 },
  card: {
    backgroundColor: '#141832', borderRadius: 16, borderWidth: 1, borderColor: '#1e2a4a',
    padding: 16, marginBottom: 12,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: '800', flex: 1 },
  delBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#ff475720', alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  delBtnText: { fontSize: 16 },
  progressBg: { height: 6, backgroundColor: '#0d1130', borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', borderRadius: 3 },
  progressText: { color: '#94a3b8', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  metaRow: { flexDirection: 'row', gap: 16 },
  metaText: { color: '#64748b', fontSize: 12, fontWeight: '500' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon: { fontSize: 48 },
  emptyText: { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 12 },
  emptySub: { color: '#64748b', fontSize: 15, textAlign: 'center', marginTop: 8 },
});

export default DraftsScreen;
