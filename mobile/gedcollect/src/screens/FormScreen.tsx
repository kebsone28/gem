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
  Linking,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@types/index';
import { submitFormData } from '@services/api';
import { saveSubmission, loadSubmissions, updateSubmission } from '@services/storage';
import Toast from 'react-native-toast-message';
import Geolocation from '@react-native-community/geolocation';
import { MediaService } from '@services/mediaService';
import DateTimePicker from '@react-native-community/datetimepicker';
import HelpOverlay from '@components/HelpOverlay';
import { useVoiceAssistant } from '@services/voiceAssistant';
import { evaluateQuality } from '@services/qualityScore';
import {
  hapticLight,
  hapticMedium,
  hapticSuccess,
  hapticError,
  startSpeechToText,
  stopSpeechToText,
  initNfc,
  readNfcTag,
  stopNfc,
  onSpeechResults,
  onSpeechError,
  pickDocument,
  getAltitudeAndHeading,
} from '@services/nativeCapabilities';
import {
  calculatePolygonArea,
  calculatePathLength,
  formatArea,
  formatLength,
  parseXFormGeoString,
  serializeXFormGeo,
  type Coordinate,
} from '@utils/geo';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Props = NativeStackScreenProps<RootStackParamList, 'Form'>;

const FormScreen: React.FC<Props> = ({ route, navigation }) => {
  const { formKey, formTitle, survey, choices, draft, viewOnly, serverVersion } = route.params;

  const [values, setValues] = useState<Record<string, string>>(() => (draft as any)?.values || {});
  const [photos, setPhotos] = useState<Record<string, string[]>>(
    () => (draft as any)?.photos || {}
  );
  const [isSaving, setIsSaving] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showDatePicker, setShowDatePicker] = useState<string | null>(null);
  const [showTimePicker, setShowTimePicker] = useState<string | null>(null);
  const [repeatGroups, setRepeatGroups] = useState<Record<string, number>>(() => {
    const v = (draft as any)?.values || {};
    const groups: Record<string, number> = {};
    for (const key of Object.keys(v)) {
      const m = key.match(/^(.+?)::(\d+)::/);
      if (m) groups[m[1]] = Math.max(groups[m[1]] || 0, parseInt(m[2], 10) + 1);
    }
    return groups;
  });
  const [activeRepeatInstance, setActiveRepeatInstance] = useState<{
    group: string;
    index: number;
  } | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [slideAnim] = useState(() => new Animated.Value(0));
  const [searchText, setSearchText] = useState('');
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [altitude, setAltitude] = useState<number | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [isDrawingGeotrace, setIsDrawingGeotrace] = useState(false);
  const [isDrawingGeoshape, setIsDrawingGeoshape] = useState(false);
  const [currentGeoCoords, setCurrentGeoCoords] = useState<Coordinate[]>([]);
  const translateX = useRef(new Animated.Value(0)).current;
  const autoSaveTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const voice = useVoiceAssistant();

  const repeatGroupNames = useMemo(() => {
    const names: string[] = [];
    for (const q of survey || []) {
      if (q.type === 'begin_repeat') names.push(q.name);
    }
    return names;
  }, [survey]);

  const repeatFieldsMap = useMemo(() => {
    const map: Record<string, any[]> = {};
    let currentGroup = '';
    for (const q of survey || []) {
      if (q.type === 'begin_repeat') {
        currentGroup = q.name;
        map[currentGroup] = [];
        continue;
      }
      if (q.type === 'end_repeat') {
        currentGroup = '';
        continue;
      }
      if (q.type === 'begin_group' || q.type === 'end_group') continue;
      if (!q.name || !currentGroup) continue;
      map[currentGroup].push({ ...q, _repeatGroup: currentGroup });
    }
    return map;
  }, [survey]);

  React.useEffect(() => {
    if (
      draft &&
      serverVersion &&
      (draft as any).savedVersion &&
      (draft as any).savedVersion !== serverVersion
    ) {
      Alert.alert(
        'Version différente',
        'Ce brouillon a été créé avec une version différente du formulaire.'
      );
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (viewOnly) return;
      autoSaveTimer.current = setInterval(() => {
        const id = draft?.id;
        if (!id) return;
        const autoRepeatVals: Record<string, any[]> = {};
        for (const name of repeatGroupNames) {
          const count = repeatGroups[name] || 0;
          if (count === 0) continue;
          const instances: any[] = [];
          const rFields = repeatFieldsMap[name] || [];
          for (let i = 0; i < count; i++) {
            const instance: any = {};
            for (const rf of rFields) {
              const v = values[repeatValueKey(name, i, rf.name)];
              if (v !== undefined) instance[rf.name] = v;
            }
            if (Object.keys(instance).length > 0) instances.push(instance);
          }
          if (instances.length > 0) autoRepeatVals[name] = instances;
        }
        saveSubmission({
          id,
          formKey,
          formVersion: serverVersion || '1.0',
          clientSubmissionId: id,
          status: 'draft',
          values: { ...values, ...autoRepeatVals },
          photos,
          metadata: {
            deviceId: 'gedcollect-mobile',
            startTime: new Date().toISOString(),
            endTime: new Date().toISOString(),
          },
        }).catch(() => {});
      }, 5000);
      return () => {
        if (autoSaveTimer.current) {
          clearInterval(autoSaveTimer.current);
          autoSaveTimer.current = null;
        }
      };
    }, [
      viewOnly,
      draft?.id,
      formKey,
      serverVersion,
      repeatGroupNames,
      repeatGroups,
      repeatFieldsMap,
      values,
      photos,
    ])
  );



  const repeatValueKey = (group: string, index: number, fieldName: string) =>
    `${group}::${index}::${fieldName}`;

  const handleValue = useCallback(
    (name: string, val: string, repeatGroup?: string, repeatIndex?: number) => {
      if (repeatGroup !== undefined && repeatIndex !== undefined) {
        const key = repeatValueKey(repeatGroup, repeatIndex, name);
        setValues((p) => ({ ...p, [key]: val }));
      } else {
        setValues((p) => ({ ...p, [name]: val }));
      }
    },
    []
  );

  const hv = handleValue;

  const getFieldValue = (fieldName: string, repeatGroup?: string, repeatIndex?: number): string => {
    if (repeatGroup !== undefined && repeatIndex !== undefined) {
      return values[repeatValueKey(repeatGroup, repeatIndex, fieldName)] || '';
    }
    return values[fieldName] || '';
  };
  const setFieldValue = (
    fieldName: string,
    val: string,
    repeatGroup?: string,
    repeatIndex?: number
  ) => {
    const key =
      repeatGroup !== undefined && repeatIndex !== undefined
        ? repeatValueKey(repeatGroup, repeatIndex, fieldName)
        : fieldName;
    setValues((p) => ({ ...p, [key]: val }));
  };

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
      if (q.type === 'begin_repeat') {
        currentRepeat = q.name;
        continue;
      }
      if (q.type === 'hidden') continue;
      if (!q.name) continue;
      if (currentRepeat) q._repeatGroup = currentRepeat;
      result.push(q);
    }
    return result;
  }, [survey]);



  const filteredFields = useMemo(() => {
    const displayList: any[] = [];
    let processedRepeat: string | null = null;
    for (const q of fields) {
      if (q._repeatGroup) {
        if (processedRepeat !== q._repeatGroup) {
          processedRepeat = q._repeatGroup;
          displayList.push({ _isRepeatGroup: true, _repeatGroup: q._repeatGroup });
        }
        const count = repeatGroups[q._repeatGroup] || 0;
        if (count === 0) continue;
        for (let instanceIdx = 0; instanceIdx < count; instanceIdx++) {
          const instanceEntry = { ...q, _repeatInstance: instanceIdx };
          if (!q.relevant) {
            displayList.push(instanceEntry);
            continue;
          }
          const m = q.relevant.match(/\$\{(\w+)\}\s*=\s*['"](\w+)['"]/);
          const actualValue = getFieldValue(m?.[1] || '', q._repeatGroup, instanceIdx);
          if (m ? actualValue === m[2] : true) displayList.push(instanceEntry);
        }
        continue;
      }
      processedRepeat = null;
      if (!q.relevant) {
        displayList.push(q);
        continue;
      }
      const m = q.relevant.match(/\$\{(\w+)\}\s*=\s*['"](\w+)['"]/);
      if (m ? values[m[1]] === m[2] : true) displayList.push(q);
    }
    return displayList;
  }, [fields, values, repeatGroups]);

  const currentEntry = filteredFields[currentIndex];
  const isOnRepeatGroup = currentEntry?._isRepeatGroup === true;
  const isRepeatInstance = currentEntry?._repeatInstance !== undefined;
  const repeatFieldGroup = currentEntry?._repeatGroup || '';
  const repeatFieldIndex = currentEntry?._repeatInstance;

  const currentField = !isOnRepeatGroup && !isRepeatInstance ? filteredFields[currentIndex] : null;
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === filteredFields.length - 1;
  const totalVisible = filteredFields.length;
  const visibleRegularCount = filteredFields.filter(
    (e: any) => !e._isRepeatGroup && !e._virtualField
  ).length;

  useEffect(() => {
    if (isOnRepeatGroup || isRepeatInstance || !currentField || !voice.enabled) return;
    const isReq = currentField.required === 'yes' || currentField.required === true;
    const label = currentField.label || currentField.name;
    const num = currentIndex + 1;
    voice.speakNow(
      `Question ${num} sur ${totalVisible}. ${label}${isReq ? ', champ obligatoire' : ''}.`
    );
  }, [currentIndex, voice.enabled, isOnRepeatGroup, isRepeatInstance]);

  const goTo = useCallback(
    (index: number) => {
      Animated.timing(translateX, {
        toValue: index > currentIndex ? -SCREEN_WIDTH * 0.3 : SCREEN_WIDTH * 0.3,
        duration: 0,
        useNativeDriver: true,
      }).start(() => {
        setCurrentIndex(index);
        Animated.spring(translateX, {
          toValue: 0,
          speed: 16,
          bounciness: 4,
          useNativeDriver: true,
        }).start();
      });
    },
    [currentIndex, translateX]
  );

  const next = useCallback(() => {
    if (currentIndex < filteredFields.length - 1) {
      const current = filteredFields[currentIndex];
      if (current && voice.enabled) {
        const isReq = current.required === 'yes' || current.required === true;
        const val = values[current.name];
        if (isReq && (!val || val.trim() === '')) {
          voice.speakNow(
            `Attention, la question "${current.label || current.name}" est obligatoire et n'a pas été renseignée.`
          );
          return;
        }
      }
      hapticLight();
      goTo(currentIndex + 1);
    }
  }, [currentIndex, filteredFields, goTo, values, voice]);

  const prev = useCallback(() => {
    if (currentIndex > 0) goTo(currentIndex - 1);
  }, [currentIndex, goTo]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gs) =>
          Math.abs(gs.dx) > 20 && Math.abs(gs.dx) > Math.abs(gs.dy),
        onPanResponderRelease: (_, gs) => {
          if (gs.dx < -80) next();
          else if (gs.dx > 80) prev();
        },
      }),
    [next, prev]
  );

  const validate = useCallback((): string[] => {
    const errors: string[] = [];
    for (const q of filteredFields) {
      if (!q.name || q._isRepeatGroup) continue;
      const isReq = q.required === 'yes' || q.required === true;
      const val =
        q._repeatInstance !== undefined
          ? values[repeatValueKey(q._repeatGroup, q._repeatInstance, q.name)] || ''
          : values[q.name] || '';
      if (isReq && (!val || val.trim() === '')) {
        const prefix =
          q._repeatInstance !== undefined
            ? `[${q._repeatGroup} #${(q._repeatInstance || 0) + 1}] `
            : '';
        errors.push(`${prefix}${q.label || q.name} est requis`);
      }
      if (val && q.type === 'integer' && q.constraint === '. > 0' && Number(val) <= 0) {
        errors.push(`${q.label || q.name} doit être > 0`);
      }
    }
    return errors;
  }, [filteredFields, values]);

  const [audioRecording, setAudioRecording] = useState(false);
  const [audioPath, setAudioPath] = useState<string | null>(null);
  const [speechTarget, setSpeechTarget] = useState<string | null>(null);
  const [nfcReading, setNfcReading] = useState(false);

  const takePhoto = useCallback(async (fieldName: string) => {
    const r = await MediaService.capturePhoto();
    if (r?.uri) setPhotos((p) => ({ ...p, [fieldName]: [...(p[fieldName] || []), r.uri] }));
  }, []);

  const pickPhoto = useCallback(async (fieldName: string) => {
    const r = await MediaService.pickPhoto();
    if (r?.uri) setPhotos((p) => ({ ...p, [fieldName]: [...(p[fieldName] || []), r.uri] }));
  }, []);

  const captureVideo = useCallback(async (fieldName: string) => {
    const r = await MediaService.captureVideo();
    if (r?.uri) setPhotos((p) => ({ ...p, [fieldName]: [...(p[fieldName] || []), r.uri] }));
  }, []);

  const pickVideo = useCallback(async (fieldName: string) => {
    const r = await MediaService.pickVideo();
    if (r?.uri) setPhotos((p) => ({ ...p, [fieldName]: [...(p[fieldName] || []), r.uri] }));
  }, []);

  const toggleAudioRecording = useCallback(async () => {
    if (audioRecording) {
      const result = await MediaService.stopAudioRecording();
      if (result?.uri) {
        setAudioPath(result.uri);
        Toast.show({ type: 'success', text1: 'Audio enregistré', text2: result.fileName });
      }
      setAudioRecording(false);
    } else {
      const path = await MediaService.startAudioRecording();
      if (path) {
        setAudioRecording(true);
        Toast.show({ type: 'info', text1: 'Enregistrement...', text2: 'Appuyez pour arrêter' });
      }
    }
  }, [audioRecording]);

  const playAudio = useCallback(async (uri: string) => {
    await MediaService.playAudio(uri);
  }, []);

  const openQRScanner = useCallback(
    (fieldKey: string) => {
      navigation.navigate('QRScanner', {
        onScan: (value: string) => {
          hapticSuccess();
          hv(fieldKey, value);
        },
      });
    },
    [navigation, hv]
  );

  const startDictation = useCallback(async (fieldKey: string) => {
    setSpeechTarget(fieldKey);
    Toast.show({ type: 'info', text1: 'Dictée...', text2: 'Parlez clairement' });
    await startSpeechToText();
  }, []);

  const stopDictation = useCallback(async () => {
    const text = await stopSpeechToText();
    if (text && speechTarget) {
      hv(speechTarget, text);
      hapticSuccess();
      Toast.show({ type: 'success', text1: 'Texte dicté', text2: text.substring(0, 50) });
    }
    setSpeechTarget(null);
  }, [speechTarget, hv]);

  useEffect(() => {
    if (!speechTarget) return;
    const unsub = onSpeechResults((text) => {
      if (speechTarget) hv(speechTarget, text);
    });
    return unsub;
  }, [speechTarget, hv]);

  const startNfcScan = useCallback(async () => {
    setNfcReading(true);
    Toast.show({ type: 'info', text1: 'NFC', text2: 'Approchez un badge/tag' });
    const tagId = await readNfcTag(15000);
    setNfcReading(false);
    if (tagId) {
      hapticSuccess();
      const match = currentField?.name;
      if (match) hv(match, tagId);
      Toast.show({ type: 'success', text1: 'Tag NFC lu', text2: tagId.substring(0, 40) });
    } else {
      hapticError();
      Toast.show({ type: 'error', text1: 'NFC', text2: 'Aucun tag détecté' });
    }
  }, [currentField, hv]);

  const attachDocument = useCallback(async () => {
    const doc = await pickDocument();
    if (doc && currentField?.name) {
      hv(currentField.name, doc.uri);
      hapticSuccess();
      Toast.show({ type: 'success', text1: 'Document attaché', text2: doc.name });
    }
  }, [currentField, hv]);

  const refreshAltitude = useCallback(async () => {
    const { altitude: alt, heading: hdg } = await getAltitudeAndHeading();
    if (alt !== null) setAltitude(Math.round(alt));
    if (hdg !== null) setHeading(Math.round(hdg));
  }, []);

  const getLocation = useCallback(async (latKey: string, lngKey: string) => {
    setGpsLoading(true);
    try {
      if (Platform.OS === 'android')
        await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
      const pos = await new Promise<{ latitude: number; longitude: number; accuracy: number }>(
        (res, rej) =>
          Geolocation.getCurrentPosition(
            (p) =>
              res({
                latitude: p.coords.latitude,
                longitude: p.coords.longitude,
                accuracy: p.coords.accuracy || 0,
              }),
            rej,
            { enableHighAccuracy: true, timeout: 15000 }
          )
      );
      setGpsAccuracy(pos.accuracy);
      setValues((v) => ({
        ...v,
        [latKey]: pos.latitude.toFixed(6),
        [lngKey]: pos.longitude.toFixed(6),
      }));
      Toast.show({
        type: 'success',
        text1: 'Position obtenue',
        text2: `Précision: ${pos.accuracy.toFixed(0)}m`,
      });
    } catch {
      Toast.show({ type: 'error', text1: 'Erreur GPS', text2: "Impossible d'obtenir la position" });
    } finally {
      setGpsLoading(false);
    }
  }, []);

  // Geotrace / Geoshape drawing functions
  const addGeoPointToDrawing = useCallback(async () => {
    setGpsLoading(true);
    try {
      if (Platform.OS === 'android')
        await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
      const pos = await new Promise<{ latitude: number; longitude: number; accuracy: number }>(
        (res, rej) =>
          Geolocation.getCurrentPosition(
            (p) =>
              res({
                latitude: p.coords.latitude,
                longitude: p.coords.longitude,
                accuracy: p.coords.accuracy || 0,
              }),
            rej,
            { enableHighAccuracy: true, timeout: 15000 }
          )
      );
      setGpsAccuracy(pos.accuracy);
      const newCoord: Coordinate = { latitude: pos.latitude, longitude: pos.longitude };
      setCurrentGeoCoords((prev) => [...prev, newCoord]);
      hapticLight();
      Toast.show({
        type: 'success',
        text1: 'Point ajouté',
        text2: `Total: ${currentGeoCoords.length + 1} point(s)`,
      });
    } catch {
      Toast.show({ type: 'error', text1: 'Erreur GPS', text2: "Impossible d'obtenir la position" });
    } finally {
      setGpsLoading(false);
    }
  }, []);

  const startGeotraceDrawing = useCallback(
    (key: string) => {
      setCurrentGeoCoords([]);
      setIsDrawingGeotrace(true);
      hv(key, '');
      Toast.show({
        type: 'info',
        text1: 'Mode tracé (geotrace)',
        text2: 'Ajoutez des points un par un',
      });
    },
    [hv]
  );

  const startGeoshapeDrawing = useCallback(
    (key: string) => {
      setCurrentGeoCoords([]);
      setIsDrawingGeoshape(true);
      hv(key, '');
      Toast.show({
        type: 'info',
        text1: 'Mode polygone (geoshape)',
        text2: 'Ajoutez au moins 3 points pour calculer la surface',
      });
    },
    [hv]
  );

  const stopGeoDrawing = useCallback(
    (key: string) => {
      const coords = currentGeoCoords;
      if (isDrawingGeoshape && coords.length < 3) {
        Toast.show({
          type: 'error',
          text1: 'Polygone invalide',
          text2: 'Il faut au moins 3 points pour un geoshape',
        });
        return;
      }
      if (isDrawingGeotrace && coords.length < 2) {
        Toast.show({
          type: 'error',
          text1: 'Tracé invalide',
          text2: 'Il faut au moins 2 points pour un geotrace',
        });
        return;
      }
      const serialized = serializeXFormGeo(coords);
      hv(key, serialized);
      setIsDrawingGeotrace(false);
      setIsDrawingGeoshape(false);
      setCurrentGeoCoords([]);
      hapticSuccess();
      if (isDrawingGeoshape) {
        const area = calculatePolygonArea(coords);
        Toast.show({ type: 'success', text1: 'Polygone enregistré', text2: formatArea(area) });
      } else {
        const length = calculatePathLength(coords);
        Toast.show({ type: 'success', text1: 'Tracé enregistré', text2: formatLength(length) });
      }
    },
    [currentGeoCoords, isDrawingGeoshape, isDrawingGeotrace, hv]
  );



  const onDate = useCallback(
    (name: string, _: any, d?: Date) => {
      setShowDatePicker(null);
      if (d) handleValue(name, d.toISOString().split('T')[0]);
    },
    [handleValue]
  );

  const onTime = useCallback(
    (name: string, _: any, d?: Date) => {
      setShowTimePicker(null);
      if (d)
        handleValue(name, d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
    },
    [handleValue]
  );

  const buildRepeatValues = useCallback(() => {
    const result: Record<string, any[]> = {};
    for (const name of repeatGroupNames) {
      const count = repeatGroups[name] || 0;
      if (count === 0) continue;
      const instances: any[] = [];
      const rFields = repeatFieldsMap[name] || [];
      for (let i = 0; i < count; i++) {
        const instance: any = {};
        for (const rf of rFields) {
          const v = values[repeatValueKey(name, i, rf.name)];
          if (v !== undefined) instance[rf.name] = v;
        }
        if (Object.keys(instance).length > 0) instances.push(instance);
      }
      if (instances.length > 0) result[name] = instances;
    }
    return result;
  }, [repeatGroupNames, repeatGroups, repeatFieldsMap, values]);

  const saveDraft = useCallback(async () => {
    const id = draft?.id || `${formKey}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const repeatVals = buildRepeatValues();
    await saveSubmission({
      id,
      formKey,
      formVersion: serverVersion || '1.0',
      savedVersion: serverVersion,
      clientSubmissionId: id,
      status: 'draft',
      values: { ...values, ...repeatVals },
      photos,
      metadata: {
        deviceId: 'gedcollect-mobile',
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
      },
    });
    Toast.show({ type: 'success', text1: draft ? 'Brouillon mis à jour' : 'Brouillon sauvegardé' });
    navigation.goBack();
  }, [formKey, values, photos, navigation, draft, serverVersion, buildRepeatValues]);

  const handleSubmit = useCallback(async () => {
    const errors = validate();
    const quality = evaluateQuality(values, photos, gpsAccuracy, filteredFields);
    const qualityMsg = `Qualité du formulaire : ${quality.score}%.`;
    const detailLines = quality.checks
      .filter((c) => !c.ok)
      .map((c) => `  • ${c.label} : ${c.detail || 'Manquant'}`);
    if (errors.length > 0) {
      const msg = `${errors.length} champ(s) obligatoire(s) manquant(s). ${errors.join('. ')}\n\n${qualityMsg}\n${detailLines.join('\n')}`;
      if (voice.enabled)
        voice.speakNow(
          `Attention. ${errors.length} champs obligatoires manquants. Qualité ${quality.score} pour cent.`
        );
      Alert.alert('Validation', msg);
      return;
    }
    if (quality.score < 70) {
      const msg = `${qualityMsg}\n\nRecommandations :\n${detailLines.join('\n')}\n\nVoulez-vous envoyer quand même ?`;
      const ok = await new Promise((res) =>
        Alert.alert('Qualité faible', msg, [
          { text: 'Compléter', style: 'cancel', onPress: () => res(false) },
          { text: 'Envoyer', onPress: () => res(true) },
        ])
      );
      if (!ok) return;
    }
    const photoCount = Object.values(photos).reduce((s, p) => s + p.length, 0);
    const hasGps = Object.keys(values).some(
      (k) => k.includes('latitude') || k.includes('longitude')
    );
    const fieldsFilled = Object.keys(values).filter((k) => values[k] && values[k].trim()).length;

    const repeatVals = buildRepeatValues();
    if (voice.enabled) {
      voice.speakNow(
        `Formulaire terminé. ${fieldsFilled} champs remplis, ${photoCount} photo(s)${hasGps ? ', localisation GPS enregistrée' : ''}. Prêt à être envoyé. Qualité ${quality.score} pour cent.`
      );
    }

    // Stop autosave before starting submission to prevent race on unmount
    if (autoSaveTimer.current) {
      clearInterval(autoSaveTimer.current);
      autoSaveTimer.current = null;
    }

    setIsSaving(true);
    try {
      const id = draft?.id || `${formKey}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const finalValues = { ...values, ...repeatVals };
      await saveSubmission({
        id,
        formKey,
        formVersion: serverVersion || '1.0',
        clientSubmissionId: id,
        status: 'pending',
        values: finalValues,
        photos,
        metadata: {
          deviceId: 'gedcollect-mobile',
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
        },
      });
      const pending = (await loadSubmissions()).filter((s) => s.status === 'pending');
      let syncOk = true;
      for (const s of pending) {
        try {
          await submitFormData({
            formKey: s.formKey,
            formVersion: s.formVersion || '1.0',
            clientSubmissionId: s.clientSubmissionId,
            status: 'submitted',
            values: s.values,
            metadata: s.metadata,
            photos: s.photos,
          });
          await updateSubmission(s.id, { status: 'synced' });
        } catch {
          await updateSubmission(s.id, { status: 'pending' });
          syncOk = false;
          break;
        }
      }
      if (syncOk) {
        Toast.show({ type: 'success', text1: 'Soumission envoyée' });
      } else {
        Toast.show({
          type: 'info',
          text1: "Mise en file d'attente",
          text2: 'Sync auto quand connecté',
        });
      }
      navigation.goBack();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Erreur', text2: e.message || 'Échec de la soumission' });
      setIsSaving(false);
    }
  }, [formKey, values, photos, navigation, validate, draft, serverVersion, buildRepeatValues]);

  const renderRepeatGroupHeader = () => {
    if (!isOnRepeatGroup) return null;
    const entry: any = currentEntry;
    const name = entry._repeatGroup;
    const count = repeatGroups[name] || 0;
    const label =
      survey?.find((s: any) => s.type === 'begin_repeat' && s.name === name)?.label || name;
    return (
      <View style={styles.fieldPage}>
        <View style={styles.repeatHeaderIcon}>
          <Text style={styles.repeatHeaderIconText}>🔁</Text>
        </View>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.hint}>
          Groupe répétable — {count} instance{count !== 1 ? 's' : ''}
        </Text>
        <View style={styles.repeatGroupControls}>
          {count > 0 ? (
            <View style={styles.instanceList}>
              {Array.from({ length: count }, (_, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.instanceChip}
                  onPress={() => {
                    const idx = filteredFields.findIndex(
                      (e: any) => e._repeatGroup === name && e._repeatInstance === i
                    );
                    if (idx >= 0) goTo(idx);
                  }}
                  activeOpacity={0.6}
                >
                  <Text style={styles.instanceChipLabel}>#{i + 1}</Text>
                  <TouchableOpacity
                    onPress={() => {
                      const newCount = count - 1;
                      const newGroups = { ...repeatGroups, [name]: newCount };
                      setRepeatGroups(newGroups);
                      const keysToRemove = Object.keys(values).filter(
                        (k) =>
                          k.startsWith(`${name}::${i}::`) ||
                          k.startsWith(`${name}::${parseInt(String(i), 10) + 1}::`)
                      );
                      setValues((p) => {
                        const next = { ...p };
                        let remainingFields: string[] = [];
                        for (let ri = i; ri < count; ri++) {
                          for (const rf of repeatFieldsMap[name] || []) {
                            remainingFields.push(repeatValueKey(name, ri + 1, rf.name));
                          }
                        }
                        const reindexed: Record<string, string> = {};
                        for (const k of Object.keys(next)) {
                          const match = k.match(new RegExp(`^${name}::(\\d+)::(.+)$`));
                          if (match) {
                            const idx = parseInt(match[1], 10);
                            if (idx === i) {
                              delete next[k];
                              continue;
                            }
                            if (idx > i) {
                              const newKey = repeatValueKey(name, idx - 1, match[2]);
                              reindexed[newKey] = next[k];
                              delete next[k];
                            }
                          }
                        }
                        return { ...next, ...reindexed };
                      });
                    }}
                    style={styles.instanceRemoveBtn}
                  >
                    <Text style={styles.instanceRemoveText}>✕</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={styles.noInstancesText}>Aucune instance. Ajoutez-en une.</Text>
          )}
          <TouchableOpacity
            style={styles.addInstanceBtn}
            onPress={() => setRepeatGroups((p) => ({ ...p, [name]: (p[name] || 0) + 1 }))}
            activeOpacity={0.6}
          >
            <Text style={styles.addInstanceBtnText}>+ Ajouter</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderField = () => {
    if (isOnRepeatGroup) return renderRepeatGroupHeader();
    if (!currentField) return null;
    const q = currentField;
    const key = q.name;
    const isReq = q.required === 'yes' || q.required === true;
    const repeatBadge =
      q._repeatInstance !== undefined
        ? `[${q._repeatGroup} #${(q._repeatInstance || 0) + 1}] `
        : '';
    const label = `${repeatBadge}${q.label || key}${isReq ? ' *' : ''}`;
    const rGroup = q._repeatGroup;
    const rIndex = q._repeatInstance;

    const sharedInputStyle = [styles.input, viewOnly && styles.inputReadOnly];
    const rv = (fieldKey: string) => getFieldValue(fieldKey, rGroup, rIndex);
    const hv = (fieldKey: string, val: string) => handleValue(fieldKey, val, rGroup, rIndex);

    if (q.type === 'select_one' || q.type === 'select_one_external') {
      const listName =
        q.type === 'select_one_external' ? q.name : q.type.match(/select_one (.+)/)?.[1] || q.name;
      const opts = choicesByList[listName] || choicesByList[q.name] || [];
      const filtered = searchText
        ? opts.filter((o: any) =>
            (o.label || o.name).toLowerCase().includes(searchText.toLowerCase())
          )
        : opts;
      return (
        <View style={styles.fieldPage}>
          <Text style={styles.label}>{label}</Text>
          {q.hint ? <Text style={styles.hint}>{q.hint}</Text> : null}
          {opts.length > 5 ? (
            <TextInput
              style={[styles.input, { marginBottom: 12, fontSize: 16 }]}
              placeholder="🔍 Rechercher..."
              placeholderTextColor="#64748b"
              value={searchText}
              onChangeText={setSearchText}
            />
          ) : null}
          <View style={styles.chipsWrap}>
            {filtered.map((opt: any) => {
              const sel = rv(key) === opt.name;
              return (
                <TouchableOpacity
                  key={opt.name}
                  style={[styles.chip, sel && styles.chipSel]}
                  onPress={() => {
                    if (!viewOnly) hv(key, opt.name);
                  }}
                  activeOpacity={0.6}
                >
                  <Text style={[styles.chipText, sel && styles.chipTextSel]}>
                    {opt.label || opt.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {filtered.length === 0 ? (
              <Text style={{ color: '#64748b', fontSize: 14 }}>Aucun résultat</Text>
            ) : null}
          </View>
        </View>
      );
    }

    if (q.type === 'select_multiple' || q.type === 'select_multiple_external') {
      const listName =
        q.type === 'select_multiple_external'
          ? q.name
          : q.type.match(/select_multiple (.+)/)?.[1] || q.name;
      const opts = choicesByList[listName] || choicesByList[q.name] || [];
      const selected = (rv(key) || '').split(/\s+/).filter(Boolean);
      const toggle = (optName: string) => {
        const set = new Set(selected);
        if (set.has(optName)) set.delete(optName);
        else set.add(optName);
        hv(key, Array.from(set).join(' '));
        hapticLight();
      };
      return (
        <View style={styles.fieldPage}>
          <Text style={styles.label}>{label}</Text>
          {q.hint ? <Text style={styles.hint}>{q.hint}</Text> : null}
          <View style={styles.chipsWrap}>
            {opts.map((opt: any) => {
              const sel = selected.includes(opt.name);
              return (
                <TouchableOpacity
                  key={opt.name}
                  style={[
                    styles.chip,
                    sel && styles.chipSel,
                    { borderStyle: sel ? 'solid' : 'dashed' },
                  ]}
                  onPress={() => {
                    if (!viewOnly) toggle(opt.name);
                  }}
                  activeOpacity={0.6}
                >
                  <Text style={[styles.chipText, sel && styles.chipTextSel]}>
                    {sel ? '✓ ' : ''}
                    {opt.label || opt.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {opts.length === 0 ? (
              <Text style={{ color: '#64748b', fontSize: 14 }}>Aucune option</Text>
            ) : null}
          </View>
        </View>
      );
    }

    if (q.type === 'range') {
      const rangeVal = rv(key) || '';
      const min = Number(q.parameters?.range_min ?? q.appearance?.match(/min=(\d+)/)?.[1] ?? 0);
      const max = Number(q.parameters?.range_max ?? q.appearance?.match(/max=(\d+)/)?.[1] ?? 100);
      const step = Number(q.parameters?.range_step ?? q.appearance?.match(/step=(\d+)/)?.[1] ?? 1);
      const current = rangeVal ? Number(rangeVal) : Math.floor((min + max) / 2);
      return (
        <View style={styles.fieldPage}>
          <Text style={styles.label}>{label}</Text>
          {q.hint ? <Text style={styles.hint}>{q.hint}</Text> : null}
          <View style={styles.rangeContainer}>
            <Text style={styles.rangeValue}>{current}</Text>
            <View style={styles.rangeTrack}>
              {Array.from({ length: Math.min(max - min + 1, 11) }, (_, i) => {
                const val = min + Math.round((max - min) * (i / Math.min(max - min, 10)));
                return (
                  <TouchableOpacity
                    key={val}
                    style={[styles.rangeDot, val <= current && styles.rangeDotActive]}
                    onPress={() => {
                      if (!viewOnly) {
                        hv(key, String(val));
                        hapticLight();
                      }
                    }}
                    activeOpacity={0.6}
                  >
                    <View
                      style={[styles.rangeDotInner, val <= current && styles.rangeDotInnerActive]}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.rangeLabels}>
              <Text style={styles.rangeLabel}>{min}</Text>
              <Text style={styles.rangeLabel}>{max}</Text>
            </View>
          </View>
        </View>
      );
    }

    if (q.type === 'file') {
      return (
        <View style={styles.fieldPage}>
          <Text style={styles.label}>{label}</Text>
          {q.hint ? <Text style={styles.hint}>{q.hint}</Text> : null}
          <View style={styles.fileBox}>
            {rv(key) ? (
              <View style={styles.fileAttachedRow}>
                <Text style={styles.fileIcon}>📎</Text>
                <Text style={styles.fileName} numberOfLines={1}>
                  {rv(key).split('/').pop() || rv(key).substring(0, 40)}
                </Text>
                {!viewOnly ? (
                  <TouchableOpacity onPress={() => hv(key, '')} style={styles.audioDelBtn}>
                    <Text style={styles.audioDelText}>✕</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : (
              <View style={styles.filePlaceholder}>
                <Text style={styles.filePlaceholderIcon}>📄</Text>
                <Text style={styles.filePlaceholderText}>Aucun fichier attaché</Text>
              </View>
            )}
            {!viewOnly ? (
              <TouchableOpacity
                style={styles.filePickBtn}
                onPress={async () => {
                  await attachDocument();
                  hapticMedium();
                }}
                activeOpacity={0.6}
              >
                <Text style={styles.filePickBtnText}>📎 Attacher un fichier</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      );
    }

    if (q.type === 'nfc') {
      return (
        <View style={styles.fieldPage}>
          <Text style={styles.label}>{label}</Text>
          {q.hint ? <Text style={styles.hint}>{q.hint}</Text> : null}
          <View style={styles.nfcBox}>
            {rv(key) ? (
              <View style={styles.fileAttachedRow}>
                <Text style={styles.fileIcon}>📡</Text>
                <Text style={styles.fileName} numberOfLines={1}>
                  {rv(key)}
                </Text>
                {!viewOnly ? (
                  <TouchableOpacity onPress={() => hv(key, '')} style={styles.audioDelBtn}>
                    <Text style={styles.audioDelText}>✕</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
            {!viewOnly ? (
              <TouchableOpacity
                style={[styles.photoBtn, { marginTop: 12 }]}
                onPress={startNfcScan}
                disabled={nfcReading}
                activeOpacity={0.6}
              >
                {nfcReading ? (
                  <ActivityIndicator size="small" color="#e8edf5" />
                ) : (
                  <Text style={styles.photoBtnText}>📡 Lire badge NFC</Text>
                )}
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      );
    }

    if (q.type === 'acknowledge') {
      const acknowledged = rv(key) === 'yes' || rv(key) === 'true';
      return (
        <View style={styles.fieldPage}>
          <Text style={styles.label}>{label}</Text>
          {q.hint ? <Text style={styles.hint}>{q.hint}</Text> : null}
          <TouchableOpacity
            style={[styles.ackBox, acknowledged && styles.ackBoxActive]}
            onPress={() => {
              if (!viewOnly) {
                hv(key, acknowledged ? '' : 'yes');
                hapticSuccess();
              }
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.ackIcon}>{acknowledged ? '✅' : '⬜'}</Text>
            <Text style={[styles.ackText, acknowledged && styles.ackTextActive]}>
              {acknowledged ? 'Confirmé' : 'Appuyez pour confirmer'}
            </Text>
          </TouchableOpacity>
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
                  <TouchableOpacity
                    onPress={() =>
                      setPhotos((p) => ({
                        ...p,
                        [key]: (p[key] || []).filter((_, idx) => idx !== i),
                      }))
                    }
                    style={styles.photoDel}
                  >
                    <Text style={styles.photoDelText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoPlaceholderIcon}>📷</Text>
              <Text style={styles.photoPlaceholderText}>
                {imgs.length === 0 ? 'Appuyez pour ajouter des photos' : `${imgs.length} photo(s)`}
              </Text>
            </View>
          )}
          {!viewOnly ? (
            <View style={styles.photoRow}>
              <TouchableOpacity
                style={styles.photoBtn}
                onPress={() => takePhoto(key)}
                activeOpacity={0.6}
              >
                <Text style={styles.photoBtnText}>📸 Prendre</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.photoBtn}
                onPress={() => pickPhoto(key)}
                activeOpacity={0.6}
              >
                <Text style={styles.photoBtnText}>
                  🖼️ {imgs.length > 0 ? 'Ajouter' : 'Galerie'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      );
    }

    if (q.type === 'video') {
      const vids = photos[key] || [];
      return (
        <View style={styles.fieldPage}>
          <Text style={styles.label}>{label}</Text>
          {q.hint ? <Text style={styles.hint}>{q.hint}</Text> : null}
          {vids.length > 0 ? (
            <View style={styles.multiPhotoWrap}>
              {vids.map((uri, i) => (
                <View key={i} style={styles.videoBox}>
                  <Text style={styles.videoIcon}>🎬</Text>
                  <Text style={styles.videoName} numberOfLines={1}>
                    {uri.split('/').pop()}
                  </Text>
                  <TouchableOpacity
                    onPress={() =>
                      setPhotos((p) => ({
                        ...p,
                        [key]: (p[key] || []).filter((_, idx) => idx !== i),
                      }))
                    }
                    style={styles.photoDel}
                  >
                    <Text style={styles.photoDelText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoPlaceholderIcon}>🎬</Text>
              <Text style={styles.photoPlaceholderText}>Appuyez pour ajouter une vidéo</Text>
            </View>
          )}
          {!viewOnly ? (
            <View style={styles.photoRow}>
              <TouchableOpacity
                style={styles.photoBtn}
                onPress={() => captureVideo(key)}
                activeOpacity={0.6}
              >
                <Text style={styles.photoBtnText}>🎥 Filmer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.photoBtn}
                onPress={() => pickVideo(key)}
                activeOpacity={0.6}
              >
                <Text style={styles.photoBtnText}>🎞️ Galerie</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      );
    }

    if (q.type === 'date') {
      const dVal = rv(key);
      return (
        <View style={styles.fieldPage}>
          <Text style={styles.label}>{label}</Text>
          {q.hint ? <Text style={styles.hint}>{q.hint}</Text> : null}
          <TouchableOpacity
            style={styles.input}
            onPress={() => {
              if (!viewOnly) setShowDatePicker(key);
            }}
          >
            <Text style={[styles.inputText, !dVal && { color: '#64748b' }]}>
              {dVal || 'Appuyez pour choisir une date'}
            </Text>
          </TouchableOpacity>
          {showDatePicker === key ? (
            <DateTimePicker
              value={new Date()}
              mode="date"
              display="default"
              onChange={(e, d) => onDate(key, e, d)}
              locale="fr-FR"
            />
          ) : null}
        </View>
      );
    }

    if (q.type === 'time') {
      const tVal = rv(key);
      return (
        <View style={styles.fieldPage}>
          <Text style={styles.label}>{label}</Text>
          {q.hint ? <Text style={styles.hint}>{q.hint}</Text> : null}
          <TouchableOpacity
            style={styles.input}
            onPress={() => {
              if (!viewOnly) setShowTimePicker(key);
            }}
          >
            <Text style={[styles.inputText, !tVal && { color: '#64748b' }]}>
              {tVal || 'Appuyez pour choisir une heure'}
            </Text>
          </TouchableOpacity>
          {showTimePicker === key ? (
            <DateTimePicker
              value={new Date()}
              mode="time"
              display="default"
              onChange={(e, d) => onTime(key, e, d)}
              locale="fr-FR"
            />
          ) : null}
        </View>
      );
    }

    if (q.type === 'datetime') {
      const dKey = `${key}_date`;
      const tKey = `${key}_time`;
      const dVal = rv(dKey);
      const tVal = rv(tKey);
      return (
        <View style={styles.fieldPage}>
          <Text style={styles.label}>{label}</Text>
          {q.hint ? <Text style={styles.hint}>{q.hint}</Text> : null}
          <View style={styles.geoRow}>
            <TouchableOpacity
              style={[styles.input, styles.geoIn]}
              onPress={() => {
                if (!viewOnly) setShowDatePicker(dKey);
              }}
            >
              <Text style={[styles.inputText, !dVal && { color: '#64748b' }]}>
                {dVal || 'Date'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.input, styles.geoIn]}
              onPress={() => {
                if (!viewOnly) setShowTimePicker(tKey);
              }}
            >
              <Text style={[styles.inputText, !tVal && { color: '#64748b' }]}>
                {tVal || 'Heure'}
              </Text>
            </TouchableOpacity>
          </View>
          {showDatePicker === dKey ? (
            <DateTimePicker
              value={new Date()}
              mode="date"
              display="default"
              onChange={(e, d) => onDate(dKey, e, d)}
              locale="fr-FR"
            />
          ) : null}
          {showTimePicker === tKey ? (
            <DateTimePicker
              value={new Date()}
              mode="time"
              display="default"
              onChange={(e, d) => onTime(tKey, e, d)}
              locale="fr-FR"
            />
          ) : null}
        </View>
      );
    }

    if (q.type === 'geopoint') {
      const latKey = `${key}_latitude`;
      const lngKey = `${key}_longitude`;
      const lat = rv(latKey);
      const lng = rv(lngKey);
      const hasCoords = lat && lng;
      const accMsg = gpsAccuracy !== null ? `Précision GPS : ${gpsAccuracy.toFixed(0)} m` : null;
      const accColor =
        gpsAccuracy !== null
          ? gpsAccuracy < 10
            ? '#22c55e'
            : gpsAccuracy < 50
              ? '#f59e0b'
              : '#ff4757'
          : '#64748b';
      return (
        <View style={styles.fieldPage}>
          <Text style={styles.label}>{label}</Text>
          {q.hint ? <Text style={styles.hint}>{q.hint}</Text> : null}
          {hasCoords ? (
            <TouchableOpacity
              style={styles.mapPreview}
              onPress={() => {
                const url = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=16`;
                Linking.openURL(url).catch(() =>
                  Alert.alert('Erreur', "Impossible d'ouvrir la carte.")
                );
              }}
              activeOpacity={0.7}
            >
              <View style={styles.mapPreviewContent}>
                <Text style={styles.mapPreviewIcon}>🗺️</Text>
                <View style={styles.mapPreviewTextWrap}>
                  <Text style={styles.mapPreviewCoords}>
                    {lat}, {lng}
                  </Text>
                  <Text style={styles.mapPreviewHint}>Appuyez pour voir sur OpenStreetMap</Text>
                </View>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.mapEmpty}>
              <Text style={styles.mapEmptyIcon}>📍</Text>
              <Text style={styles.mapEmptyText}>Position non définie</Text>
            </View>
          )}
          <View style={styles.geoRow}>
            <TextInput
              style={[styles.input, styles.geoIn, viewOnly && styles.inputReadOnly]}
              placeholder="Latitude"
              placeholderTextColor="#64748b"
              value={lat || ''}
              onChangeText={(v) => hv(latKey, v)}
              keyboardType="decimal-pad"
              editable={!viewOnly}
            />
            <TextInput
              style={[styles.input, styles.geoIn, viewOnly && styles.inputReadOnly]}
              placeholder="Longitude"
              placeholderTextColor="#64748b"
              value={lng || ''}
              onChangeText={(v) => hv(lngKey, v)}
              keyboardType="decimal-pad"
              editable={!viewOnly}
            />
          </View>
          {!viewOnly ? (
            <TouchableOpacity
              style={[styles.photoBtn, { marginTop: 10, flexDirection: 'row', gap: 8 }]}
              onPress={() => getLocation(latKey, lngKey)}
              disabled={gpsLoading}
              activeOpacity={0.6}
            >
              {gpsLoading ? (
                <ActivityIndicator size="small" color="#e8edf5" />
              ) : (
                <Text style={{ fontSize: 16 }}>📍</Text>
              )}
              <Text style={styles.photoBtnText}>
                {gpsLoading ? 'Localisation...' : 'Obtenir ma position'}
              </Text>
            </TouchableOpacity>
          ) : null}
          <View style={styles.geoExtraRow}>
            {gpsAccuracy !== null ? (
              <View style={[styles.accBadge, { borderColor: accColor }]}>
                <Text style={[styles.accBadgeText, { color: accColor }]}>
                  📡 {gpsAccuracy.toFixed(0)} m
                </Text>
              </View>
            ) : null}
            {!viewOnly ? (
              <TouchableOpacity
                style={styles.geoExtraBtn}
                onPress={() => {
                  refreshAltitude();
                  hapticLight();
                }}
              >
                <Text style={styles.geoExtraBtnText}>📐</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {altitude !== null ? (
            <View style={styles.altRow}>
              <Text style={styles.altText}>🗻 {altitude} m</Text>
              {heading !== null ? <Text style={styles.altText}>🧭 {heading}°</Text> : null}
            </View>
          ) : null}
        </View>
      );
    }

    if (q.type === 'geotrace') {
      const geoString = rv(key);
      const coords = parseXFormGeoString(geoString);
      const length = calculatePathLength(coords);
      const hasCoords = coords.length > 0;
      return (
        <View style={styles.fieldPage}>
          <Text style={styles.label}>{label}</Text>
          {q.hint ? <Text style={styles.hint}>{q.hint}</Text> : null}
          {hasCoords ? (
            <View style={styles.mapPreview}>
              <View style={styles.mapPreviewContent}>
                <Text style={styles.mapPreviewIcon}>📍</Text>
                <View style={styles.mapPreviewTextWrap}>
                  <Text style={styles.mapPreviewCoords}>
                    {coords.length} points — {formatLength(length)}
                  </Text>
                  <Text style={styles.mapPreviewHint}>Tracé enregistré</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.mapEmpty}>
              <Text style={styles.mapEmptyIcon}>📍</Text>
              <Text style={styles.mapEmptyText}>Aucun tracé</Text>
            </View>
          )}
          {!viewOnly ? (
            <View style={styles.geoExtraRow}>
              {isDrawingGeotrace ? (
                <>
                  <TouchableOpacity
                    style={[
                      styles.geoExtraBtn,
                      { backgroundColor: '#22c55e30', borderColor: '#22c55e' },
                    ]}
                    onPress={() => addGeoPointToDrawing()}
                    disabled={gpsLoading}
                  >
                    {gpsLoading ? (
                      <ActivityIndicator size="small" color="#22c55e" />
                    ) : (
                      <Text style={styles.geoExtraBtnText}>📍 + Point</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.geoExtraBtn,
                      { backgroundColor: '#4f8cff30', borderColor: '#4f8cff' },
                    ]}
                    onPress={() => stopGeoDrawing(key)}
                  >
                    <Text style={styles.geoExtraBtnText}>✅ Finir</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.geoExtraBtn,
                      { backgroundColor: '#ff475730', borderColor: '#ff4757' },
                    ]}
                    onPress={() => {
                      setIsDrawingGeotrace(false);
                      setCurrentGeoCoords([]);
                      hv(key, '');
                    }}
                  >
                    <Text style={styles.geoExtraBtnText}>❌ Annuler</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={styles.geoExtraBtn}
                  onPress={() => startGeotraceDrawing(key)}
                >
                  <Text style={styles.geoExtraBtnText}>✏️ Tracer</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}
        </View>
      );
    }

    if (q.type === 'geoshape') {
      const geoString = rv(key);
      const coords = parseXFormGeoString(geoString);
      const area = calculatePolygonArea(coords);
      const hasCoords = coords.length >= 3;
      return (
        <View style={styles.fieldPage}>
          <Text style={styles.label}>{label}</Text>
          {q.hint ? <Text style={styles.hint}>{q.hint}</Text> : null}
          {hasCoords ? (
            <View style={styles.mapPreview}>
              <View style={styles.mapPreviewContent}>
                <Text style={styles.mapPreviewIcon}>🗻</Text>
                <View style={styles.mapPreviewTextWrap}>
                  <Text style={styles.mapPreviewCoords}>
                    {coords.length} points — {formatArea(area)}
                  </Text>
                  <Text style={styles.mapPreviewHint}>Polygone enregistré</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.mapEmpty}>
              <Text style={styles.mapEmptyIcon}>🗻</Text>
              <Text style={styles.mapEmptyText}>Aucun polygone</Text>
            </View>
          )}
          {!viewOnly ? (
            <View style={styles.geoExtraRow}>
              {isDrawingGeoshape ? (
                <>
                  <TouchableOpacity
                    style={[
                      styles.geoExtraBtn,
                      { backgroundColor: '#22c55e30', borderColor: '#22c55e' },
                    ]}
                    onPress={() => addGeoPointToDrawing()}
                    disabled={gpsLoading}
                  >
                    {gpsLoading ? (
                      <ActivityIndicator size="small" color="#22c55e" />
                    ) : (
                      <Text style={styles.geoExtraBtnText}>📍 + Point</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.geoExtraBtn,
                      { backgroundColor: '#4f8cff30', borderColor: '#4f8cff' },
                    ]}
                    onPress={() => stopGeoDrawing(key)}
                  >
                    <Text style={styles.geoExtraBtnText}>✅ Finir</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.geoExtraBtn,
                      { backgroundColor: '#ff475730', borderColor: '#ff4757' },
                    ]}
                    onPress={() => {
                      setIsDrawingGeoshape(false);
                      setCurrentGeoCoords([]);
                      hv(key, '');
                    }}
                  >
                    <Text style={styles.geoExtraBtnText}>❌ Annuler</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={styles.geoExtraBtn}
                  onPress={() => startGeoshapeDrawing(key)}
                >
                  <Text style={styles.geoExtraBtnText}>✏️ Tracer</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}
        </View>
      );
    }

    if (q.type === 'note') {
      return (
        <View style={styles.fieldPage}>
          <View style={styles.noteCard}>
            <Text style={styles.noteText}>{q.label || key}</Text>
            {q.hint ? <Text style={styles.noteHint}>{q.hint}</Text> : null}
          </View>
        </View>
      );
    }

    if (q.type === 'audio') {
      const recordedUri = audioPath || rv(key);
      return (
        <View style={styles.fieldPage}>
          <Text style={styles.label}>{label}</Text>
          {q.hint ? <Text style={styles.hint}>{q.hint}</Text> : null}
          <View style={styles.audioBox}>
            {recordedUri ? (
              <View style={styles.audioPlayRow}>
                <TouchableOpacity
                  onPress={() => playAudio(recordedUri)}
                  style={styles.audioPlayBtn}
                  activeOpacity={0.6}
                >
                  <Text style={styles.audioPlayIcon}>▶️</Text>
                </TouchableOpacity>
                <Text style={styles.audioFileName} numberOfLines={1}>
                  {recordedUri.split('/').pop()}
                </Text>
                {!viewOnly ? (
                  <TouchableOpacity
                    onPress={() => {
                      setAudioPath(null);
                      hv(key, '');
                    }}
                    style={styles.audioDelBtn}
                  >
                    <Text style={styles.audioDelText}>✕</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
            {!viewOnly ? (
              <TouchableOpacity
                style={[styles.audioRecordBtn, audioRecording && styles.audioRecordingActive]}
                onPress={() => {
                  toggleAudioRecording().then(() => {
                    if (audioPath) hv(key, audioPath);
                  });
                }}
                activeOpacity={0.6}
              >
                <Text style={styles.audioRecordIcon}>{audioRecording ? '⏹️' : '🎤'}</Text>
                <Text style={styles.audioRecordText}>
                  {audioRecording ? 'Arrêter' : 'Enregistrer'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      );
    }

    if (q.type === 'barcode' || q.type === 'scan') {
      return (
        <View style={styles.fieldPage}>
          <Text style={styles.label}>{label}</Text>
          {q.hint ? <Text style={styles.hint}>{q.hint}</Text> : null}
          <TextInput
            style={[...sharedInputStyle, { fontSize: 22, letterSpacing: 2 }]}
            placeholder="Code-barres"
            placeholderTextColor="#64748b"
            value={rv(key) || ''}
            onChangeText={(v) => hv(key, v)}
            editable={!viewOnly}
            autoCapitalize="characters"
          />
          {!viewOnly ? (
            <View style={styles.photoRow}>
              <TouchableOpacity
                style={[styles.photoBtn, { marginTop: 12, flex: 1 }]}
                onPress={() => takePhoto(key)}
                activeOpacity={0.6}
              >
                <Text style={styles.photoBtnText}>📸 Scan via photo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.photoBtn, { marginTop: 12, flex: 1 }]}
                onPress={() =>
                  Alert.alert(
                    'Scan avancé',
                    'Le scan temps réel sera disponible après installation de react-native-vision-camera (npm install + rebuild).',
                    [{ text: 'OK' }]
                  )
                }
                activeOpacity={0.6}
              >
                <Text style={styles.photoBtnText}>📱 Scan direct</Text>
              </TouchableOpacity>
            </View>
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
            {rv(key) ? (
              <View>
                <Text style={styles.signatureText}>✓ Signé</Text>
                <TouchableOpacity onPress={() => hv(key, '')} style={{ marginTop: 6 }}>
                  <Text style={{ color: '#ff4757', fontSize: 13, fontWeight: '600' }}>Effacer</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => {
                  if (!viewOnly)
                    Alert.alert('Signature', 'Tracez votre signature au doigt', [
                      { text: 'Signer', onPress: () => hv(key, new Date().toISOString()) },
                      { text: 'Annuler' },
                    ]);
                }}
                style={styles.signatureArea}
              >
                <Text style={styles.signaturePlaceholder}>___________________</Text>
                <Text style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>
                  Appuyez pour signer
                </Text>
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
          value={rv(key) || ''}
          onChangeText={(v) => {
            hv(key, v);
            hapticLight();
          }}
          keyboardType={
            q.type === 'integer' ? 'number-pad' : q.type === 'decimal' ? 'decimal-pad' : 'default'
          }
          editable={!viewOnly && q.type !== 'calculate'}
        />
        {!viewOnly ? (
          <View style={styles.textActions}>
            <TouchableOpacity
              style={styles.textActionBtn}
              onPress={() => {
                openQRScanner(key);
                hapticMedium();
              }}
            >
              <Text style={styles.textActionText}>📷 QR</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.textActionBtn, speechTarget === key && styles.textActionActive]}
              onPress={() => (speechTarget === key ? stopDictation() : startDictation(key))}
            >
              <Text style={styles.textActionText}>
                {speechTarget === key ? '⏹️ Dictée' : '🎤 Dicter'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.textActionBtn}
              onPress={() => {
                startNfcScan();
                hapticMedium();
              }}
            >
              <Text style={styles.textActionText}>📡 NFC</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.textActionBtn}
              onPress={() => {
                attachDocument();
                hapticMedium();
              }}
            >
              <Text style={styles.textActionText}>📎 Doc</Text>
            </TouchableOpacity>
          </View>
        ) : null}
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
          <Text style={styles.headerTitle} numberOfLines={1}>
            {formTitle}
          </Text>
          {totalVisible > 0 ? (
            <Text style={styles.headerCounter}>
              {currentIndex + 1} / {totalVisible}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity onPress={() => setShowHelp(true)} style={styles.headerBtn}>
          <Text style={[styles.headerBtnText, { color: '#4f8cff' }]}>?</Text>
        </TouchableOpacity>
        {!viewOnly ? (
          <TouchableOpacity
            onPress={voice.toggle}
            style={[
              styles.headerBtn,
              voice.enabled && { backgroundColor: '#22c55e20', borderColor: '#22c55e' },
            ]}
          >
            <Text
              style={[
                styles.headerBtnText,
                voice.enabled ? { color: '#22c55e' } : { color: '#64748b' },
              ]}
            >
              🎤
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Progress bar */}
      <View style={styles.progressBg}>
        <View
          style={[
            styles.progressFill,
            { width: totalVisible > 0 ? `${((currentIndex + 1) / totalVisible) * 100}%` : '0%' },
          ]}
        />
      </View>

      {/* Field content */}
      <View style={styles.body} {...panResponder.panHandlers}>
        {currentField || isOnRepeatGroup ? (
          <Animated.View style={[styles.fieldWrap, { transform: [{ translateX }] }]}>
            {!isOnRepeatGroup ? (
              <View style={styles.fieldNumber}>
                <Text style={styles.fieldNumberText}>{currentIndex + 1}</Text>
              </View>
            ) : null}
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
        <TouchableOpacity
          style={[styles.navBtn, isFirst && styles.navBtnDisabled]}
          onPress={prev}
          disabled={isFirst}
          activeOpacity={0.6}
        >
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
                <TouchableOpacity
                  style={[styles.submitBtn, isSaving && { opacity: 0.5 }]}
                  onPress={handleSubmit}
                  disabled={isSaving}
                  activeOpacity={0.6}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.submitBtnText}>Envoyer</Text>
                  )}
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#000',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1f3a',
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#141832',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1e2a4a',
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4f8cff20',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#4f8cff40',
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
    borderWidth: 2,
    borderColor: '#1e2a4a',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  inputText: { color: '#fff', fontSize: 20, fontWeight: '600' },
  inputReadOnly: { backgroundColor: '#0d1130', borderColor: '#1a1f3a', color: '#94a3b8' },

  // Signature
  signatureBox: {
    backgroundColor: '#141832',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#1e2a4a',
    padding: 20,
    alignItems: 'center',
  },
  signatureArea: { alignItems: 'center', paddingVertical: 20 },
  signaturePlaceholder: { color: '#64748b', fontSize: 24, letterSpacing: 4 },
  signatureText: { color: '#22c55e', fontSize: 20, fontWeight: '800', textAlign: 'center' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    backgroundColor: '#141832',
    borderWidth: 2,
    borderColor: '#1e2a4a',
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  chipSel: { backgroundColor: '#4f8cff25', borderColor: '#4f8cff' },
  chipText: { color: '#94a3b8', fontSize: 17, fontWeight: '600' },
  chipTextSel: { color: '#4f8cff' },

  // Photos
  photoBox: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#1e2a4a',
    width: '48%',
  },
  multiPhotoWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  photo: { width: '100%', height: 200, borderRadius: 12 },
  photoDel: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#ff4757dd',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  photoDelText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  photoPlaceholder: {
    height: 200,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#1e2a4a',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0d1130',
    marginBottom: 12,
  },
  photoPlaceholderIcon: { fontSize: 48 },
  photoPlaceholderText: { color: '#64748b', fontSize: 15, marginTop: 8, fontWeight: '500' },
  photoRow: { flexDirection: 'row', gap: 10 },
  photoBtn: {
    flex: 1,
    backgroundColor: '#141832',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1e2a4a',
    paddingVertical: 16,
    alignItems: 'center',
  },
  photoBtnText: { color: '#e8edf5', fontSize: 16, fontWeight: '700' },

  // Note
  noteCard: {
    backgroundColor: '#1a2040',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#4f8cff40',
    padding: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#4f8cff',
  },
  noteText: { color: '#e8edf5', fontSize: 18, fontWeight: '700', lineHeight: 26 },
  noteHint: { color: '#94a3b8', fontSize: 15, marginTop: 10, lineHeight: 22 },

  // Audio
  audioBox: {
    backgroundColor: '#141832',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e2a4a',
    padding: 16,
  },
  audioPlayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
    backgroundColor: '#0d1130',
    borderRadius: 12,
    padding: 12,
  },
  audioPlayBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4f8cff25',
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioPlayIcon: { fontSize: 20 },
  audioFileName: { color: '#94a3b8', fontSize: 13, fontWeight: '600', flex: 1 },
  audioDelBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ff475720',
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioDelText: { color: '#ff4757', fontSize: 14, fontWeight: '700' },
  audioRecordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4f8cff25',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#4f8cff',
    paddingVertical: 14,
  },
  audioRecordingActive: { backgroundColor: '#ff475720', borderColor: '#ff4757' },
  audioRecordIcon: { fontSize: 20 },
  audioRecordText: { color: '#e8edf5', fontSize: 15, fontWeight: '700' },

  // Video
  videoBox: {
    width: '48%',
    backgroundColor: '#141832',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e2a4a',
    padding: 16,
    alignItems: 'center',
  },
  videoIcon: { fontSize: 32, marginBottom: 8 },
  videoName: { color: '#94a3b8', fontSize: 11, fontWeight: '600', textAlign: 'center' },

  // Geopoint
  geoRow: { flexDirection: 'row', gap: 10 },
  geoIn: { flex: 1 },
  mapPreview: {
    backgroundColor: '#141832',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#4f8cff40',
    padding: 16,
    marginBottom: 12,
  },
  mapPreviewContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mapPreviewIcon: { fontSize: 32 },
  mapPreviewTextWrap: { flex: 1 },
  mapPreviewCoords: { color: '#e8edf5', fontSize: 16, fontWeight: '700', fontFamily: 'monospace' },
  mapPreviewHint: { color: '#4f8cff', fontSize: 13, marginTop: 4, fontWeight: '600' },
  mapEmpty: {
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: '#0d1130',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e2a4a',
    borderStyle: 'dashed',
    marginBottom: 12,
  },
  mapEmptyIcon: { fontSize: 36 },
  mapEmptyText: { color: '#64748b', fontSize: 14, marginTop: 8 },
  accBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: '#141832',
  },
  accBadgeText: { fontSize: 13, fontWeight: '700' },
  geoExtraRow: { flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' },
  geoExtraBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#141832',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1e2a4a',
  },
  geoExtraBtnText: { fontSize: 16 },
  altRow: { flexDirection: 'row', gap: 16, marginTop: 8 },
  altText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },

  // Text field action bar
  textActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  textActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#141832',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e2a4a',
    paddingVertical: 12,
    gap: 4,
  },
  textActionActive: { backgroundColor: '#4f8cff25', borderColor: '#4f8cff' },
  textActionText: { color: '#e8edf5', fontSize: 13, fontWeight: '700' },

  // Range
  rangeContainer: {
    backgroundColor: '#141832',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e2a4a',
    padding: 20,
    alignItems: 'center',
  },
  rangeValue: { color: '#fff', fontSize: 32, fontWeight: '800', marginBottom: 20 },
  rangeTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: '100%',
    justifyContent: 'center',
  },
  rangeDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0d1130',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#1e2a4a',
  },
  rangeDotActive: { borderColor: '#4f8cff', backgroundColor: '#4f8cff20' },
  rangeDotInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#1e2a4a' },
  rangeDotInnerActive: { backgroundColor: '#4f8cff' },
  rangeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 12,
  },
  rangeLabel: { color: '#64748b', fontSize: 13, fontWeight: '600' },

  // File
  fileBox: {
    backgroundColor: '#141832',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e2a4a',
    padding: 16,
  },
  fileAttachedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#0d1130',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  fileIcon: { fontSize: 20 },
  fileName: { color: '#94a3b8', fontSize: 13, fontWeight: '600', flex: 1 },
  filePlaceholder: { alignItems: 'center', paddingVertical: 30 },
  filePlaceholderIcon: { fontSize: 36 },
  filePlaceholderText: { color: '#64748b', fontSize: 14, marginTop: 8 },
  filePickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4f8cff25',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#4f8cff',
    paddingVertical: 14,
  },
  filePickBtnText: { color: '#4f8cff', fontSize: 15, fontWeight: '700' },

  // NFC
  nfcBox: {
    backgroundColor: '#141832',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e2a4a',
    padding: 16,
  },

  // Acknowledge
  ackBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#141832',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#1e2a4a',
    padding: 24,
  },
  ackBoxActive: { borderColor: '#22c55e', backgroundColor: '#22c55e10' },
  ackIcon: { fontSize: 28 },
  ackText: { color: '#94a3b8', fontSize: 18, fontWeight: '700', flex: 1 },
  ackTextActive: { color: '#22c55e' },

  // Repeat groups
  repeatHeaderIcon: { alignItems: 'center', marginBottom: 16 },
  repeatHeaderIconText: { fontSize: 40 },
  repeatGroupControls: { gap: 12 },
  instanceList: { gap: 8 },
  instanceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#141832',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1e2a4a',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  instanceChipLabel: { color: '#e8edf5', fontSize: 17, fontWeight: '700' },
  instanceRemoveBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ff475720',
    alignItems: 'center',
    justifyContent: 'center',
  },
  instanceRemoveText: { color: '#ff4757', fontSize: 14, fontWeight: '700' },
  noInstancesText: { color: '#64748b', fontSize: 15, textAlign: 'center', marginVertical: 20 },
  addInstanceBtn: {
    backgroundColor: '#4f8cff25',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#4f8cff',
    paddingVertical: 16,
    alignItems: 'center',
  },
  addInstanceBtnText: { color: '#4f8cff', fontSize: 17, fontWeight: '800' },

  // Empty
  emptyBody: { alignItems: 'center', padding: 40 },
  emptyTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 8 },
  emptySub: { color: '#64748b', fontSize: 15, textAlign: 'center' },

  // Footer nav
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#1a1f3a',
    backgroundColor: '#000',
    gap: 10,
  },
  navBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#141832',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1e2a4a',
    paddingVertical: 16,
    gap: 6,
  },
  navBtnDisabled: { opacity: 0.3 },
  navBtnText: { color: '#fff', fontSize: 20, fontWeight: '800' },
  navBtnLabel: { color: '#94a3b8', fontSize: 14, fontWeight: '700' },
  navBtnTextDisabled: { color: '#475569' },

  // Submit area
  submitRow: { flex: 1, flexDirection: 'row', gap: 10 },
  draftBtn: {
    backgroundColor: '#141832',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1e2a4a',
    width: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  draftBtnText: { fontSize: 24 },
  submitBtn: {
    flex: 1,
    backgroundColor: '#22c55e',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: { color: '#fff', fontSize: 18, fontWeight: '800' },
});

export default FormScreen;
