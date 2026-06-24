import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  StatusBar,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, GedSubmission } from '@types/index';
import { loadSubmissions, deleteSubmission } from '@services/storage';

type Props = NativeStackScreenProps<RootStackParamList, 'Submissions'>;

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  pending: 'En attente',
  syncing: 'Synchro...',
  synced: 'Synchronisé',
  error: 'Erreur',
};

const STATUS_COLORS: Record<string, string> = {
  draft: '#f59e0b',
  pending: '#4f8cff',
  syncing: '#a78bfa',
  synced: '#22c55e',
  error: '#ff4757',
};

const SubmissionsScreen: React.FC<Props> = ({ route, navigation }) => {
  const { formKey } = route.params;
  const [submissions, setSubmissions] = useState<GedSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const all = await loadSubmissions();
      const filtered = formKey ? all.filter((s) => s.formKey === formKey) : all;
      setSubmissions(filtered.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')));
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [formKey]);

  const handleDelete = async (item: GedSubmission) => {
    await deleteSubmission(item.id);
    loadData();
  };

  const handleView = (item: GedSubmission) => {
    if (item.status !== 'draft') return;
    navigation.navigate('Form', {
      formKey: item.formKey,
      formTitle: `Brouillon`,
      survey: [],
      choices: [],
      draft: { id: item.id, values: item.values as Record<string, string>, photos: (item as any).photos || {} },
    });
  };

  const renderItem = ({ item }: { item: GedSubmission }) => {
    const statusColor = STATUS_COLORS[item.status] || '#64748b';
    const isDraft = item.status === 'draft';
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => handleView(item)}
        disabled={!isDraft}
        activeOpacity={isDraft ? 0.7 : 1}
      >
        <View style={styles.cardRow}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle}>{STATUS_LABELS[item.status] || item.status}</Text>
            <Text style={styles.cardDate}>{item.createdAt ? new Date(item.createdAt).toLocaleString('fr-FR') : '-'}</Text>
            {item.errorMessage ? <Text style={styles.cardError}>{item.errorMessage}</Text> : null}
          </View>
          <TouchableOpacity onPress={() => handleDelete(item)} style={styles.deleteBtn}>
            <Text style={styles.deleteText}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0e27" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Soumissions</Text>
        <View style={{ width: 60 }} />
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color="#4f8cff" /></View>
      ) : (
        <FlatList
          data={submissions}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={submissions.length === 0 ? styles.emptyContainer : styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Aucune soumission</Text>
              <Text style={styles.emptySubtitle}>Les brouillons et soumissions apparaîtront ici</Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e27' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
  list: { padding: 16 },
  emptyContainer: { flex: 1, justifyContent: 'center' },
  empty: { alignItems: 'center', paddingHorizontal: 40 },
  emptyTitle: { color: '#e8edf5', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySubtitle: { color: '#64748b', fontSize: 14, textAlign: 'center' },
  card: {
    backgroundColor: '#141832',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1e2a4a',
  },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  cardInfo: { flex: 1 },
  cardTitle: { color: '#e8edf5', fontSize: 15, fontWeight: '700' },
  cardDate: { color: '#64748b', fontSize: 12, marginTop: 2 },
  cardError: { color: '#ff4757', fontSize: 12, marginTop: 2 },
  deleteBtn: { padding: 8 },
  deleteText: { fontSize: 18 },
});

export default SubmissionsScreen;
