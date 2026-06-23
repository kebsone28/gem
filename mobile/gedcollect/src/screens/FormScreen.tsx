import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  ScrollView,
  TextInput,
  SafeAreaView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Alert,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@types/index';
import { submitFormData } from '@services/api';
import Toast from 'react-native-toast-message';

type Props = NativeStackScreenProps<RootStackParamList, 'Form'>;

const FormScreen: React.FC<Props> = ({ route, navigation }) => {
  const { formKey, formTitle, survey, choices } = route.params;
  const [values, setValues] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [progress, setProgress] = useState(0);

  const visibleQuestions = useMemo(
    () => (survey || []).filter((q: any) => q.type !== 'end_group'),
    [survey],
  );

  const choicesByList = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const c of choices || []) {
      if (!map[c.list_name]) map[c.list_name] = [];
      map[c.list_name].push(c);
    }
    return map;
  }, [choices]);

  const handleValueChange = useCallback((fieldName: string, value: string) => {
    setValues((prev) => ({ ...prev, [fieldName]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const clientSubmissionId = `${formKey}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      await submitFormData({
        formKey,
        formVersion: '1.0',
        clientSubmissionId,
        status: 'submitted',
        values,
        metadata: {
          deviceId: 'gedcollect-mobile',
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
        },
      });
      Toast.show({ type: 'success', text1: 'Soumission envoyée', text2: 'Données enregistrées sur le serveur' });
      navigation.goBack();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Erreur', text2: e.message || 'Échec de la soumission' });
    } finally {
      setIsSaving(false);
    }
  }, [formKey, values, navigation]);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
      const p = contentOffset.y / Math.max(contentSize.height - layoutMeasurement.height, 1);
      setProgress(Math.min(Math.max(Math.round(p * 100), 0), 100));
    },
    [],
  );

  const renderField = (q: any, idx: number) => {
    const key = q.name || `q_${idx}`;
    const isRequired = q.required === 'yes' || q.required === true;
    const label = `${q.label || key}${isRequired ? ' *' : ''}`;

    if (q.type === 'select_one' || q.type === 'select_one_external') {
      const listName = q.type === 'select_one_external' ? q.name : (q.type.match(/select_one (.+)/)?.[1] || q.name);
      const options = choicesByList[listName] || choicesByList[q.name] || [];
      return (
        <View key={key} style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>{label}</Text>
          <View style={styles.optionsRow}>
            {options.map((opt) => {
              const selected = values[key] === opt.name;
              return (
                <TouchableOpacity
                  key={opt.name}
                  style={[styles.optionChip, selected && styles.optionChipSelected]}
                  onPress={() => handleValueChange(key, opt.name)}
                >
                  <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                    {opt.label || opt.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      );
    }

    if (q.type === 'geopoint') {
      return (
        <View key={key} style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>{label}</Text>
          <View style={styles.geoRow}>
            <TextInput
              style={[styles.fieldInput, styles.geoInput]}
              placeholder="Latitude"
              placeholderTextColor="#475569"
              value={values[`${key}_latitude`] || ''}
              onChangeText={(v) => handleValueChange(`${key}_latitude`, v)}
              keyboardType="decimal-pad"
            />
            <TextInput
              style={[styles.fieldInput, styles.geoInput]}
              placeholder="Longitude"
              placeholderTextColor="#475569"
              value={values[`${key}_longitude`] || ''}
              onChangeText={(v) => handleValueChange(`${key}_longitude`, v)}
              keyboardType="decimal-pad"
            />
          </View>
        </View>
      );
    }

    if (q.type === 'integer' || q.type === 'decimal' || q.type === 'calculate') {
      return (
        <View key={key} style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>{label}</Text>
          <TextInput
            style={styles.fieldInput}
            placeholder={q.hint || ''}
            placeholderTextColor="#475569"
            value={values[key] || ''}
            onChangeText={(v) => handleValueChange(key, v)}
            keyboardType={q.type === 'integer' ? 'number-pad' : 'decimal-pad'}
            editable={q.type !== 'calculate'}
          />
        </View>
      );
    }

    if (q.type === 'text' || q.type === '') {
      return (
        <View key={key} style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>{label}</Text>
          <TextInput
            style={styles.fieldInput}
            placeholder={q.hint || ''}
            placeholderTextColor="#475569"
            value={values[key] || ''}
            onChangeText={(v) => handleValueChange(key, v)}
          />
        </View>
      );
    }

    return null;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0e27" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Retour</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{formTitle}</Text>
          <Text style={styles.headerProgress}>Progression: {progress}%</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.formScroll}
        contentContainerStyle={styles.formContent}
        onScroll={handleScroll}
        scrollEventThrottle={100}
        showsVerticalScrollIndicator={false}
      >
        {visibleQuestions.length === 0 ? (
          <View style={styles.emptyFields}>
            <Text style={styles.emptyText}>Ce formulaire ne contient aucun champ</Text>
          </View>
        ) : (
          visibleQuestions.map((q: any, idx: number) => renderField(q, idx))
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>Envoyer la soumission</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e27' },
  formScroll: { flex: 1 },
  formContent: { padding: 16 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e2a4a',
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#1e2a4a',
  },
  backBtnText: { color: '#8899aa', fontSize: 14, fontWeight: '600' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { color: '#e8edf5', fontSize: 16, fontWeight: '700' },
  headerProgress: { color: '#64748b', fontSize: 11, marginTop: 2 },
  headerRight: { width: 60 },
  fieldContainer: { marginBottom: 16, backgroundColor: '#141832', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#1e2a4a' },
  fieldLabel: { color: '#8899aa', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  fieldInput: {
    backgroundColor: '#0d1130',
    borderWidth: 1,
    borderColor: '#1e2a4a',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#e8edf5',
    fontSize: 15,
  },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: {
    backgroundColor: '#0d1130',
    borderWidth: 1,
    borderColor: '#1e2a4a',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  optionChipSelected: { backgroundColor: '#4f8cff33', borderColor: '#4f8cff' },
  optionText: { color: '#8899aa', fontSize: 14, fontWeight: '500' },
  optionTextSelected: { color: '#4f8cff' },
  geoRow: { flexDirection: 'row', gap: 10 },
  geoInput: { flex: 1 },
  emptyFields: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#64748b', fontSize: 14 },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#1e2a4a',
    backgroundColor: '#0a0e27',
  },
  saveBtn: { backgroundColor: '#4f8cff', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

export default FormScreen;
