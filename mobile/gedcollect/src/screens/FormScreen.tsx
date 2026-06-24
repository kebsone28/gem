import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  TextInput,
  SafeAreaView,
  Alert,
  Platform,
  Image,
  Dimensions,
  Animated,
  PanResponder,
  PermissionsAndroid,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@types/index';
import { submitFormData } from '@services/api';
import { saveSubmission, loadSubmissions, updateSubmission } from '@services/storage';
import Toast from 'react-native-toast-message';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import HelpOverlay from '@components/HelpOverlay';
import { useVoiceAssistant } from '@services/voiceAssistant';
import { evaluateQuality } from '@services/qualityScore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Props = NativeStackScreenProps<RootStackParamList, 'Form'>;

const FormScreen: React.FC<Props> = ({ route, navigation }) => {
  const { formKey, formTitle, survey, choices, draft, viewOnly, serverVersion } = route.params;

  const [values, setValues] = useState<Record<string, string>>(() => (draft as any)?.values || {});
  const [photos, setPhotos] = useState<Record<string, string[]>>(() => (draft as any)?.photos || {});
  const [isSaving, setIsSaving] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showDatePicker, setShowDatePicker] = useState<string | null>(null);
  const [showTimePicker, setShowTimePicker] = useState<string | null>(null);
  const [repeatGroups, setRepeatGroups] = useState<Record<string, number>>({});
  const [showHelp, setShowHelp] = useState(false);
  const [slideAnim] = useState(() => new Animated.Value(0));
  const [searchText, setSearchText] = useState('');
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const translateX = useRef(new Animated.Value(0)).current;
  const autoSaveTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const voice = useVoiceAssistant();

  React.useEffect(() => {
    if (draft && serverVersion && (draft as any).savedVersion && (draft as any).savedVersion !== serverVersion) {
      Alert.alert('Version différente', 'Ce brouillon a été créé avec une version différente du formulaire.');
    }
  }, []);

  useEffect(() => {
    if (viewOnly) return;
    autoSaveTimer.current = setInterval(() => {
      const id = draft?.id;
      if (!id) return;
      saveSubmission({
        id, formKey, formVersion: serverVersion || '1.0', clientSubmissionId: id,
        status: 'draft', values, photos,
        metadata: { deviceId: 'gedcollect-mobile', startTime: new Date().toISOString(), endTime: new Date().toISOString() },
      }).catch(() => {});
    }, 5000);
    return () => { if (autoSaveTimer.current) clearInterval(autoSaveTimer.current); };
  }, [values, photos, viewOnly]);

  useEffect(() => {
    if (!currentField || !voice.enabled) return;
    const isReq = currentField.required === 'yes' || currentField.required === true;
    const label = currentField.label || currentField.name;
    const num = currentIndex + 1;
    voice.speakNow(`Question ${num} sur ${totalVisible}. ${label}${isReq ? ', champ obligatoire' : ''}.`);
  }, [currentIndex, voice.enabled]);

  const choicesByList = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const c of choices || []) {
      if (!map[c.list_name]) map[c.list_name] = [];
      map[c.list_name].push(c);
    }
    return map;
  }, [choices]);

  const fields = useMemo(() => {
    const result: any[] = [];
    let currentRepeat: string | null = null;
    for (const q of survey || []) {
      if (q.type === 'begin_group' || q.type === 'end_group' || q.type === 'end_repeat') continue;
      if (q.type === 'begin_repeat') { currentRepeat = q.name; continue; }
      if (!q.name) continue;
      if (currentRepeat) q._repeatGroup = currentRepeat;
      result.push(q);
    }
    return result;
  }, [survey]);

  const filteredFields = useMemo(() => {
    return fields.filter((q) => {
      if (!q.relevant) return true;
      const m = q.relevant.match(/\$\{(\w+)\}\s*=\s*['"](\w+)['"]/);
      return m ? values[m[1]] === m[2] : true;
    });
  }, [fields, values]);

  const currentField = filteredFields[currentIndex];
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === filteredFields.length - 1;
  const totalVisible = filteredFields.length;

  const goTo = useCallback((index: number) => {
    Animated.timing(translateX, {
      toValue: index > currentIndex ? -SCREEN_WIDTH * 0.3 : SCREEN_WIDTH * 0.3,
      duration: 0,
      useNativeDriver: true,
    }).start(() => {
      setCurrentIndex(index);
      Animated.spring(translateX, { toValue: 0, speed: 16, bounciness: 4, useNativeDriver: true }).start();
    });
  }, [currentIndex, translateX]);

  const next = useCallback(() => {
    if (currentIndex < filteredFields.length - 1) {
      const current = filteredFields[currentIndex];
      if (current && voice.enabled) {
        const isReq = current.required === 'yes' || current.required === true;
        const val = values[current.name];
        if (isReq && (!val || val.trim() === '')) {
          voice.speakNow(`Attention, la question "${current.label || current.name}" est obligatoire et n'a pas été renseignée.`);
          return;
        }
      }
      goTo(currentIndex + 1);
    }
  }, [currentIndex, filteredFields, goTo, values, voice]);

  const prev = useCallback(() => {
    if (currentIndex > 0) goTo(currentIndex - 1);
  }, [currentIndex, goTo]);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 20 && Math.abs(gs.dx) > Math.abs(gs.dy),
    onPanResponderRelease: (_, gs) => {
      if (gs.dx < -80) next();
      else if (gs.dx > 80) prev();
    },
  }), [next, prev]);

  const validate = useCallback((): string[] => {
    const errors: string[] = [];
    for (const q of filteredFields) {
      if (!q.name) continue;
      const isReq = q.required === 'yes' || q.required === true;
      const val = values[q.name];
      if (isReq && (!val || val.trim() === '')) errors.push(`${q.label || q.name} est requis`);
      if (val && q.type === 'integer' && q.constraint === '. > 0' && Number(val) <= 0) {
        errors.push(`${q.label || q.name} doit être > 0`);
      }
    }
    return errors;
  }, [filteredFields, values]);

  const takePhoto = useCallback(async (fieldName: string) => {
    const r = await launchCamera({ mediaType: 'photo', quality: 0.7, maxWidth: 1024, maxHeight: 1024 });
    if (r.assets?.[0]?.uri) setPhotos((p) => ({ ...p, [fieldName]: [...(p[fieldName] || []), r.assets![0].uri!] }));
  }, []);

  const pickPhoto = useCallback(async (fieldName: string) => {
    const r = await launchImageLibrary({ mediaType: 'photo', quality: 0.7, selectionLimit: 5 });
    if (r.assets) setPhotos((p) => ({ ...p, [fieldName]: [...(p[fieldName] || []), ...r.assets!.map((a) => a.uri!).filter(Boolean)] }));
  }, []);

  const getLocation = useCallback(async (latKey: string, lngKey: string) => {
    setGpsLoading(true);
    try {
      if (Platform.OS === 'android') await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
      const pos = await new Promise<{ latitude: number; longitude: number; accuracy: number }>((res, rej) =>
        navigator.geolocation.getCurrentPosition(
          (p) => res({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy || 0 }),
          rej, { enableHighAccuracy: true, timeout: 15000 },
        ),
      );
      setGpsAccuracy(pos.accuracy);
      setValues((v) => ({ ...v, [latKey]: pos.latitude.toFixed(6), [lngKey]: pos.longitude.toFixed(6) }));
      Toast.show({ type: 'success', text1: 'Position obtenue', text2: `Précision: ${pos.accuracy.toFixed(0)}m` });
    } catch {
      Toast.show({ type: 'error', text1: 'Erreur GPS', text2: 'Impossible d\'obtenir la position' });
    } finally { setGpsLoading(false); }
  }, []);

  const handleValue = useCallback((name: string, val: string) => {
    setValues((p) => ({ ...p, [name]: val }));
  }, []);

  const onDate = useCallback((name: string, _: any, d?: Date) => {
    setShowDatePicker(null);
    if (d) handleValue(name, d.toISOString().split('T')[0]);
  }, [handleValue]);

  const onTime = useCallback((name: string, _: any, d?: Date) => {
    setShowTimePicker(null);
    if (d) handleValue(name, d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
  }, [handleValue]);

  const saveDraft = useCallback(async () => {
    const id = draft?.id || `${formKey}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    await saveSubmission({
      id, formKey, formVersion: serverVersion || '1.0', savedVersion: serverVersion,
      clientSubmissionId: id, status: 'draft', values, photos,
      metadata: { deviceId: 'gedcollect-mobile', startTime: new Date().toISOString(), endTime: new Date().toISOString() },
    });
    Toast.show({ type: 'success', text1: draft ? 'Brouillon mis à jour' : 'Brouillon sauvegardé' });
    navigation.goBack();
  }, [formKey, values, photos, navigation, draft, serverVersion]);

  const handleSubmit = useCallback(async () => {
    const errors = validate();
    const quality = evaluateQuality(values, photos, gpsAccuracy, filteredFields);
    const qualityMsg = `Qualité du formulaire : ${quality.score}%.`;
    const detailLines = quality.checks.filter((c) => !c.ok).map((c) => `  • ${c.label} : ${c.detail || 'Manquant'}`);
    if (errors.length > 0) {
      const msg = `${errors.length} champ(s) obligatoire(s) manquant(s). ${errors.join('. ')}\n\n${qualityMsg}\n${detailLines.join('\n')}`;
      if (voice.enabled) voice.speakNow(`Attention. ${errors.length} champs obligatoires manquants. Qualité ${quality.score} pour cent.`);
      Alert.alert('Validation', msg);
      return;
    }
    if (quality.score < 70) {
      const msg = `${qualityMsg}\n\nRecommandations :\n${detailLines.join('\n')}\n\nVoulez-vous envoyer quand même ?`;
      const ok = await new Promise((res) => Alert.alert('Qualité faible', msg, [{ text: 'Compléter', style: 'cancel', onPress: () => res(false) }, { text: 'Envoyer', onPress: () => res(true) }]));
      if (!ok) return;
    }
    const photoCount = Object.values(photos).reduce((s, p) => s + p.length, 0);
    const hasGps = Object.keys(values).some((k) => k.includes('latitude') || k.includes('longitude'));
    const fieldsFilled = Object.keys(values).filter((k) => values[k] && values[k].trim()).length;
    if (voice.enabled) {
      voice.speakNow(`Formulaire terminé. ${fieldsFilled} champs remplis, ${photoCount} photo(s)${hasGps ? ', localisation GPS enregistrée' : ''}. Prêt à être envoyé. Qualité ${quality.score} pour cent.`);
    }
    setIsSaving(true);
    try {
      const id = draft?.id || `${formKey}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      await saveSubmission({
        id, formKey, formVersion: serverVersion || '1.0', clientSubmissionId: id, status: 'pending',
        values, photos,
        metadata: { deviceId: 'gedcollect-mobile', startTime: new Date().toISOString(), endTime: new Date().toISOString() },
      });
      const pending = (await loadSubmissions()).filter((s) => s.status === 'pending');
      for (const s of pending) {
        try {
          await submitFormData({ formKey: s.formKey, formVersion: s.formVersion || '1.0', clientSubmissionId: s.clientSubmissionId, status: 'submitted', values: s.values, metadata: s.metadata });
          await updateSubmission(s.id, { status: 'synced' });
        } catch { await updateSubmission(s.id, { status: 'pending' }); throw new Error('Sync en attente'); }
      }
      Toast.show({ type: 'success', text1: 'Soumission envoyée' });
      navigation.goBack();
    } catch (e: any) {
      Toast.show({ type: 'success', text1: "Mise en file d'attente", text2: 'Sync auto quand connecté' });
      navigation.goBack();
    } finally { setIsSaving(false); }
  }, [formKey, values, photos, navigation, validate, draft, serverVersion]);

  const renderField = () => {
    if (!currentField) return null;
    const q = currentField;
    const key = q.name;
    const isReq = q.required === 'yes' || q.required === true;
    const label = `${q.label || key}${isReq ? ' *' : ''}`;

    const sharedInputStyle = [styles.input, viewOnly && styles.inputReadOnly];

    if (q.type === 'select_one' || q.type === 'select_one_external') {
      const listName = q.type === 'select_one_external' ? q.name : (q.type.match(/select_one (.+)/)?.[1] || q.name);
      const opts = choicesByList[listName] || choicesByList[q.name] || [];
      const filtered = searchText ? opts.filter((o: any) => (o.label || o.name).toLowerCase().includes(searchText.toLowerCase())) : opts;
      return (
        <View style={styles.fieldPage}>
          <Text style={styles.label}>{label}</Text>
          {q.hint ? <Text style={styles.hint}>{q.hint}</Text> : null}
          {opts.length > 5 ? (
            <TextInput style={[styles.input, { marginBottom: 12, fontSize: 16 }]} placeholder="🔍 Rechercher..." placeholderTextColor="#64748b" value={searchText} onChangeText={setSearchText} />
          ) : null}
          <View style={styles.chipsWrap}>
            {filtered.map((opt: any) => {
              const sel = values[key] === opt.name;
              return (
                <TouchableOpacity key={opt.name} style={[styles.chip, sel && styles.chipSel]} onPress={() => { if (!viewOnly) handleValue(key, opt.name); }} activeOpacity={0.6}>
                  <Text style={[styles.chipText, sel && styles.chipTextSel]}>{opt.label || opt.name}</Text>
                </TouchableOpacity>
              );
            })}
            {filtered.length === 0 ? <Text style={{ color: '#64748b', fontSize: 14 }}>Aucun résultat</Text> : null}
          </View>
        </View>
      );
    }

    if (q.type === 'image') {
      const imgs = photos[key] || [];
      return (
        <View style={styles.fieldPage}>
          <Text style={styles.label}>{label}</Text>
          {q.hint ? <Text style={styles.hint}>{q.hint}</Text> : null}
          {imgs.length > 0 ? (
            <View style={styles.multiPhotoWrap}>
              {imgs.map((uri, i) => (
                <View key={i} style={styles.photoBox}>
                  <Image source={{ uri }} style={styles.photo} resizeMode="cover" />
                  <TouchableOpacity onPress={() => setPhotos((p) => ({ ...p, [key]: (p[key] || []).filter((_, idx) => idx !== i) }))} style={styles.photoDel}>
                    <Text style={styles.photoDelText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoPlaceholderIcon}>📷</Text>
              <Text style={styles.photoPlaceholderText}>{imgs.length === 0 ? 'Appuyez pour ajouter des photos' : `${imgs.length} photo(s)`}</Text>
            </View>
          )}
          {!viewOnly ? (
            <View style={styles.photoRow}>
              <TouchableOpacity style={styles.photoBtn} onPress={() => takePhoto(key)} activeOpacity={0.6}>
                <Text style={styles.photoBtnText}>📸 Prendre</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoBtn} onPress={() => pickPhoto(key)} activeOpacity={0.6}>
                <Text style={styles.photoBtnText}>🖼️ {imgs.length > 0 ? 'Ajouter' : 'Galerie'}</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      );
    }

    if (q.type === 'date') {
      return (
        <View style={styles.fieldPage}>
          <Text style={styles.label}>{label}</Text>
          {q.hint ? <Text style={styles.hint}>{q.hint}</Text> : null}
          <TouchableOpacity style={styles.input} onPress={() => { if (!viewOnly) setShowDatePicker(key); }}>
            <Text style={[styles.inputText, !values[key] && { color: '#64748b' }]}>{values[key] || 'Appuyez pour choisir une date'}</Text>
          </TouchableOpacity>
          {showDatePicker === key ? <DateTimePicker value={new Date()} mode="date" display="default" onChange={(e, d) => onDate(key, e, d)} locale="fr-FR" /> : null}
        </View>
      );
    }

    if (q.type === 'time') {
      return (
        <View style={styles.fieldPage}>
          <Text style={styles.label}>{label}</Text>
          {q.hint ? <Text style={styles.hint}>{q.hint}</Text> : null}
          <TouchableOpacity style={styles.input} onPress={() => { if (!viewOnly) setShowTimePicker(key); }}>
            <Text style={[styles.inputText, !values[key] && { color: '#64748b' }]}>{values[key] || 'Appuyez pour choisir une heure'}</Text>
          </TouchableOpacity>
          {showTimePicker === key ? <DateTimePicker value={new Date()} mode="time" display="default" onChange={(e, d) => onTime(key, e, d)} locale="fr-FR" /> : null}
        </View>
      );
    }

    if (q.type === 'datetime') {
      const dVal = values[`${key}_date`] || '';
      const tVal = values[`${key}_time`] || '';
      return (
        <View style={styles.fieldPage}>
          <Text style={styles.label}>{label}</Text>
          {q.hint ? <Text style={styles.hint}>{q.hint}</Text> : null}
          <View style={styles.geoRow}>
            <TouchableOpacity style={[styles.input, styles.geoIn]} onPress={() => { if (!viewOnly) setShowDatePicker(`${key}_date`); }}>
              <Text style={[styles.inputText, !dVal && { color: '#64748b' }]}>{dVal || 'Date'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.input, styles.geoIn]} onPress={() => { if (!viewOnly) setShowTimePicker(`${key}_time`); }}>
              <Text style={[styles.inputText, !tVal && { color: '#64748b' }]}>{tVal || 'Heure'}</Text>
            </TouchableOpacity>
          </View>
          {showDatePicker === `${key}_date` ? <DateTimePicker value={new Date()} mode="date" display="default" onChange={(e, d) => onDate(`${key}_date`, e, d)} locale="fr-FR" /> : null}
          {showTimePicker === `${key}_time` ? <DateTimePicker value={new Date()} mode="time" display="default" onChange={(e, d) => onTime(`${key}_time`, e, d)} locale="fr-FR" /> : null}
        </View>
      );
    }

    if (q.type === 'geopoint') {
      const accMsg = gpsAccuracy !== null ? `Précision GPS : ${gpsAccuracy.toFixed(0)} m` : null;
      return (
        <View style={styles.fieldPage}>
          <Text style={styles.label}>{label}</Text>
          {q.hint ? <Text style={styles.hint}>{q.hint}</Text> : null}
          {accMsg ? <Text style={[styles.hint, { color: gpsAccuracy < 10 ? '#22c55e' : gpsAccuracy < 50 ? '#f59e0b' : '#ff4757' }]}>{accMsg}</Text> : null}
          <View style={styles.geoRow}>
            <TextInput style={[styles.input, styles.geoIn, viewOnly && styles.inputReadOnly]} placeholder="Latitude" placeholderTextColor="#64748b" value={values[`${key}_latitude`] || ''} onChangeText={(v) => handleValue(`${key}_latitude`, v)} keyboardType="decimal-pad" editable={!viewOnly} />
            <TextInput style={[styles.input, styles.geoIn, viewOnly && styles.inputReadOnly]} placeholder="Longitude" placeholderTextColor="#64748b" value={values[`${key}_longitude`] || ''} onChangeText={(v) => handleValue(`${key}_longitude`, v)} keyboardType="decimal-pad" editable={!viewOnly} />
          </View>
          {!viewOnly ? (
            <TouchableOpacity style={[styles.photoBtn, { marginTop: 10, flexDirection: 'row', gap: 8 }]} onPress={() => getLocation(`${key}_latitude`, `${key}_longitude`)} disabled={gpsLoading} activeOpacity={0.6}>
              {gpsLoading ? <ActivityIndicator size="small" color="#e8edf5" /> : <Text style={{ fontSize: 16 }}>📍</Text>}
              <Text style={styles.photoBtnText}>{gpsLoading ? 'Localisation...' : 'Obtenir ma position'}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      );
    }

    if (q.type === 'audio') {
      return (
        <View style={styles.fieldPage}>
          <Text style={styles.label}>{label}</Text>
          {q.hint ? <Text style={styles.hint}>{q.hint}</Text> : null}
          <View style={styles.audioPlaceholder}>
            <Text style={styles.audioIcon}>🎤</Text>
            <Text style={styles.audioText}>Enregistrement vocal disponible prochainement</Text>
          </View>
        </View>
      );
    }

    if (q.type === 'barcode' || q.type === 'scan') {
      return (
        <View style={styles.fieldPage}>
          <Text style={styles.label}>{label}</Text>
          {q.hint ? <Text style={styles.hint}>{q.hint}</Text> : null}
          <TextInput style={[...sharedInputStyle, { fontSize: 22, letterSpacing: 2 }]} placeholder="Code-barres" placeholderTextColor="#64748b" value={values[key] || ''} onChangeText={(v) => handleValue(key, v)} editable={!viewOnly} autoCapitalize="characters" />
          {!viewOnly ? (
            <TouchableOpacity style={[styles.photoBtn, { marginTop: 12 }]} onPress={() => Alert.alert('Scan', 'Scanner dans une prochaine version')} activeOpacity={0.6}>
              <Text style={styles.photoBtnText}>📱 Scanner</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      );
    }

    if (q.type === 'signature') {
      return (
        <View style={styles.fieldPage}>
          <Text style={styles.label}>{label}</Text>
          {q.hint ? <Text style={styles.hint}>{q.hint}</Text> : null}
          <View style={styles.signatureBox}>
            {values[key] ? (
              <View>
                <Text style={styles.signatureText}>✓ Signé</Text>
                <TouchableOpacity onPress={() => handleValue(key, '')} style={{ marginTop: 6 }}><Text style={{ color: '#ff4757', fontSize: 13, fontWeight: '600' }}>Effacer</Text></TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={() => { if (!viewOnly) Alert.alert('Signature', 'Tracez votre signature au doigt', [{ text: 'Signer', onPress: () => handleValue(key, new Date().toISOString()) }, { text: 'Annuler' }]); }} style={styles.signatureArea}>
                <Text style={styles.signaturePlaceholder}>___________________</Text>
                <Text style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>Appuyez pour signer</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      );
    }

    return (
      <View style={styles.fieldPage}>
        <Text style={styles.label}>{label}</Text>
        {q.hint ? <Text style={styles.hint}>{q.hint}</Text> : null}
        <TextInput
          style={[...sharedInputStyle, { fontSize: 22 }]}
          placeholder={q.hint || 'Saisissez la valeur'}
          placeholderTextColor="#64748b"
          value={values[key] || ''}
          onChangeText={(v) => handleValue(key, v)}
          keyboardType={q.type === 'integer' ? 'number-pad' : q.type === 'decimal' ? 'decimal-pad' : 'default'}
          editable={!viewOnly && q.type !== 'calculate'}
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Text style={styles.headerBtnText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{formTitle}</Text>
          {totalVisible > 0 ? (
            <Text style={styles.headerCounter}>{currentIndex + 1} / {totalVisible}</Text>
          ) : null}
        </View>
        <TouchableOpacity onPress={() => setShowHelp(true)} style={styles.headerBtn}>
          <Text style={[styles.headerBtnText, { color: '#4f8cff' }]}>?</Text>
        </TouchableOpacity>
        {!viewOnly ? (
          <TouchableOpacity onPress={voice.toggle} style={[styles.headerBtn, voice.enabled && { backgroundColor: '#22c55e20', borderColor: '#22c55e' }]}>
            <Text style={[styles.headerBtnText, voice.enabled ? { color: '#22c55e' } : { color: '#64748b' }]}>🎤</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Progress bar */}
      <View style={styles.progressBg}>
        <View style={[styles.progressFill, { width: totalVisible > 0 ? `${((currentIndex + 1) / totalVisible) * 100}%` : '0%' }]} />
      </View>

      {/* Field content */}
      <View style={styles.body} {...panResponder.panHandlers}>
        {currentField ? (
          <Animated.View style={[styles.fieldWrap, { transform: [{ translateX }] }]}>
            <View style={styles.fieldNumber}>
              <Text style={styles.fieldNumberText}>{currentIndex + 1}</Text>
            </View>
            {renderField()}
          </Animated.View>
        ) : (
          <View style={styles.emptyBody}>
            <Text style={styles.emptyTitle}>Aucun champ</Text>
            <Text style={styles.emptySub}>Ce formulaire ne contient aucun champ visible</Text>
          </View>
        )}
      </View>

      {/* Navigation footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={[styles.navBtn, isFirst && styles.navBtnDisabled]} onPress={prev} disabled={isFirst} activeOpacity={0.6}>
          <Text style={[styles.navBtnText, isFirst && styles.navBtnTextDisabled]}>←</Text>
          <Text style={[styles.navBtnLabel, isFirst && styles.navBtnTextDisabled]}>Précédent</Text>
        </TouchableOpacity>

        {isLast ? (
          <View style={styles.submitRow}>
            {!viewOnly ? (
              <>
                <TouchableOpacity style={styles.draftBtn} onPress={saveDraft} activeOpacity={0.6}>
                  <Text style={styles.draftBtnText}>💾</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.submitBtn, isSaving && { opacity: 0.5 }]} onPress={handleSubmit} disabled={isSaving} activeOpacity={0.6}>
                  {isSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.submitBtnText}>Envoyer</Text>}
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        ) : (
          <TouchableOpacity style={styles.navBtn} onPress={next} activeOpacity={0.6}>
            <Text style={styles.navBtnText}>→</Text>
            <Text style={styles.navBtnLabel}>Suivant</Text>
          </TouchableOpacity>
        )}
      </View>

      <HelpOverlay visible={showHelp} onClose={() => setShowHelp(false)} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e27' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: '#000',
    borderBottomWidth: 1, borderBottomColor: '#1a1f3a',
  },
  headerBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#141832',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#1e2a4a',
  },
  headerBtnText: { color: '#e8edf5', fontSize: 20, fontWeight: '800' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  headerCounter: { color: '#4f8cff', fontSize: 13, fontWeight: '700', marginTop: 2 },

  // Progress
  progressBg: { height: 4, backgroundColor: '#1a1f3a' },
  progressFill: { height: '100%', backgroundColor: '#4f8cff', borderRadius: 2 },

  // Body
  body: { flex: 1, justifyContent: 'center', padding: 20 },
  fieldWrap: { flex: 1, justifyContent: 'center' },
  fieldNumber: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#4f8cff20',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#4f8cff40',
    marginBottom: 16,
  },
  fieldNumberText: { color: '#4f8cff', fontSize: 14, fontWeight: '800' },
  fieldPage: {},

  // Labels
  label: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 6, lineHeight: 30 },
  hint: { color: '#94a3b8', fontSize: 15, marginBottom: 20, lineHeight: 22 },

  // Inputs — large, high contrast, sunlight readable
  input: {
    backgroundColor: '#141832',
    borderWidth: 2, borderColor: '#1e2a4a',
    borderRadius: 16,
    paddingHorizontal: 20, paddingVertical: 18,
    color: '#fff', fontSize: 20, fontWeight: '600',
  },
  inputText: { color: '#fff', fontSize: 20, fontWeight: '600' },
  inputReadOnly: { backgroundColor: '#0d1130', borderColor: '#1a1f3a', color: '#94a3b8' },

  // Signature
  signatureBox: { backgroundColor: '#141832', borderRadius: 16, borderWidth: 2, borderColor: '#1e2a4a', padding: 20, alignItems: 'center' },
  signatureArea: { alignItems: 'center', paddingVertical: 20 },
  signaturePlaceholder: { color: '#64748b', fontSize: 24, letterSpacing: 4 },
  signatureText: { color: '#22c55e', fontSize: 20, fontWeight: '800', textAlign: 'center' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    backgroundColor: '#141832',
    borderWidth: 2, borderColor: '#1e2a4a',
    borderRadius: 16,
    paddingHorizontal: 24, paddingVertical: 16,
  },
  chipSel: { backgroundColor: '#4f8cff25', borderColor: '#4f8cff' },
  chipText: { color: '#94a3b8', fontSize: 17, fontWeight: '600' },
  chipTextSel: { color: '#4f8cff' },

  // Photos
  photoBox: { borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: '#1e2a4a', width: '48%' },
  multiPhotoWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  photo: { width: '100%', height: 200, borderRadius: 12 },
  photoDel: { position: 'absolute', top: 8, right: 8, backgroundColor: '#ff4757dd', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  photoDelText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  photoPlaceholder: {
    height: 200, borderRadius: 16, borderWidth: 2, borderColor: '#1e2a4a', borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#0d1130', marginBottom: 12,
  },
  photoPlaceholderIcon: { fontSize: 48 },
  photoPlaceholderText: { color: '#64748b', fontSize: 15, marginTop: 8, fontWeight: '500' },
  photoRow: { flexDirection: 'row', gap: 10 },
  photoBtn: {
    flex: 1, backgroundColor: '#141832',
    borderRadius: 14, borderWidth: 1, borderColor: '#1e2a4a',
    paddingVertical: 16, alignItems: 'center',
  },
  photoBtnText: { color: '#e8edf5', fontSize: 16, fontWeight: '700' },

  // Audio
  audioPlaceholder: { alignItems: 'center', paddingVertical: 40, backgroundColor: '#141832', borderRadius: 16, borderWidth: 1, borderColor: '#1e2a4a' },
  audioIcon: { fontSize: 48 },
  audioText: { color: '#64748b', fontSize: 15, marginTop: 12, fontWeight: '500' },

  // Geopoint
  geoRow: { flexDirection: 'row', gap: 10 },
  geoIn: { flex: 1 },

  // Empty
  emptyBody: { alignItems: 'center', padding: 40 },
  emptyTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 8 },
  emptySub: { color: '#64748b', fontSize: 15, textAlign: 'center' },

  // Footer nav
  footer: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: '#1a1f3a',
    backgroundColor: '#000',
    gap: 10,
  },
  navBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#141832',
    borderRadius: 14, borderWidth: 1, borderColor: '#1e2a4a',
    paddingVertical: 16, gap: 6,
  },
  navBtnDisabled: { opacity: 0.3 },
  navBtnText: { color: '#fff', fontSize: 20, fontWeight: '800' },
  navBtnLabel: { color: '#94a3b8', fontSize: 14, fontWeight: '700' },
  navBtnTextDisabled: { color: '#475569' },

  // Submit area
  submitRow: { flex: 1, flexDirection: 'row', gap: 10 },
  draftBtn: {
    backgroundColor: '#141832',
    borderRadius: 14, borderWidth: 1, borderColor: '#1e2a4a',
    width: 56, alignItems: 'center', justifyContent: 'center',
  },
  draftBtnText: { fontSize: 24 },
  submitBtn: {
    flex: 1, backgroundColor: '#22c55e',
    borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center',
  },
  submitBtnText: { color: '#fff', fontSize: 18, fontWeight: '800' },
});

export default FormScreen;
