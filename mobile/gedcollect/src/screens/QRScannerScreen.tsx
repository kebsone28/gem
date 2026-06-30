import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, StatusBar, TouchableOpacity,
  ActivityIndicator, Alert, Linking,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@types/index';
import { hapticSuccess, hapticError } from '@services/nativeCapabilities';

let Camera: any = null;
try { Camera = require('react-native-vision-camera').Camera; } catch {}

type Props = NativeStackScreenProps<RootStackParamList, 'QRScanner'>;

const QRScannerScreen: React.FC<Props> = ({ route, navigation }) => {
  const onScan = route.params?.onScan;
  const [hasPermission, setHasPermission] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [devices, setDevices] = useState<any[]>([]);

  useEffect(() => {
    if (!Camera) { setHasPermission(false); return; }
    (async () => {
      try {
        const { Camera: Cam } = require('react-native-vision-camera');
        const perm = await Cam.requestCameraPermission();
        setHasPermission(perm === 'granted');
        const avail = await Cam.getAvailableCameraDevices();
        setDevices(avail.filter((d: any) => d.position === 'back'));
      } catch { setHasPermission(false); }
    })();
  }, []);

  const handleCode = useCallback((value: string) => {
    if (scanned) return;
    setScanned(true);
    hapticSuccess();
    if (onScan) {
      onScan(value);
      navigation.goBack();
    }
  }, [scanned, onScan, navigation]);

  const fallbackScan = useCallback(async () => {
    const { launchCamera } = require('react-native-image-picker');
    const { default: RNFS } = require('react-native-fs');
    const r = await launchCamera({ mediaType: 'photo', quality: 0.6 });
    if (r.assets?.[0]?.uri) {
      Alert.alert('QR Code', 'Reconnaissance photo. Appuyez sur "Saisir manuellement" si non détecté.\n\nChemin : ' + r.assets[0].uri, [
        { text: 'Annuler', onPress: () => setScanned(false) },
        { text: 'Saisir', onPress: () => {
          Alert.prompt('Code', 'Entrez le code scanné :', (val) => { if (val) handleCode(val); });
        }},
      ]);
    }
  }, [handleCode]);

  const backCamera = devices[0];

  if (!Camera || !hasPermission) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Scanner</Text>
          <View style={styles.backBtn} />
        </View>
        <View style={styles.center}>
          <Text style={styles.errorIcon}>📷</Text>
          <Text style={styles.errorText}>Scanner indisponible</Text>
          <Text style={styles.errorSub}>Installez react-native-vision-camera et rebuild</Text>
          <TouchableOpacity style={styles.fallbackBtn} onPress={fallbackScan}>
            <Text style={styles.fallbackBtnText}>📸 Scanner via photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.fallbackBtn} onPress={() => {
            Alert.prompt('Code QR', 'Entrez le code manuellement :', (val) => { if (val) handleCode(val); });
          }}>
            <Text style={styles.fallbackBtnText}>⌨️ Saisir manuellement</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <Camera
        style={StyleSheet.absoluteFill}
        device={backCamera}
        isActive={!scanned}
        codeScanner={{
          codeTypes: ['qr', 'ean-13', 'ean-8', 'code-128', 'code-39', 'pdf-417', 'aztec', 'data-matrix'],
          onCodeScanned: (codes: any[]) => {
            if (codes.length > 0) handleCode(codes[0].value || codes[0].data || '');
          },
        }}
      />
      <View style={styles.scanOverlay}>
        <View style={styles.scanFrame}>
          <View style={styles.scanCornerTL} />
          <View style={styles.scanCornerTR} />
          <View style={styles.scanCornerBL} />
          <View style={styles.scanCornerBR} />
        </View>
        <Text style={styles.scanHint}>Placez le code dans le cadre</Text>
      </View>
      <View style={styles.scanFooter}>
        <TouchableOpacity style={styles.scanCloseBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.scanCloseText}>✕ Annuler</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.scanManualBtn} onPress={() => {
          Alert.prompt('Code QR', 'Entrez le code manuellement :', (val) => { if (val) handleCode(val); });
        }}>
          <Text style={styles.scanManualText}>⌨️ Saisir</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#000',
    borderBottomWidth: 1, borderBottomColor: '#1a1f3a',
  },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#141832', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#1e2a4a' },
  backBtnText: { color: '#e8edf5', fontSize: 20, fontWeight: '800' },
  title: { color: '#fff', fontSize: 18, fontWeight: '800' },
  errorIcon: { fontSize: 48, marginBottom: 12 },
  errorText: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 6 },
  errorSub: { color: '#64748b', fontSize: 14, textAlign: 'center', marginBottom: 20 },
  fallbackBtn: {
    backgroundColor: '#141832', borderRadius: 14, borderWidth: 1, borderColor: '#1e2a4a',
    paddingVertical: 16, paddingHorizontal: 24, marginTop: 10, width: '100%', alignItems: 'center',
  },
  fallbackBtnText: { color: '#e8edf5', fontSize: 16, fontWeight: '700' },
  scanOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scanFrame: {
    width: 250, height: 250, borderRadius: 20, position: 'relative',
    borderWidth: 0, overflow: 'hidden',
  },
  scanCornerTL: { position: 'absolute', top: 0, left: 0, width: 40, height: 40, borderTopWidth: 4, borderLeftWidth: 4, borderColor: '#4f8cff', borderTopLeftRadius: 12 },
  scanCornerTR: { position: 'absolute', top: 0, right: 0, width: 40, height: 40, borderTopWidth: 4, borderRightWidth: 4, borderColor: '#4f8cff', borderTopRightRadius: 12 },
  scanCornerBL: { position: 'absolute', bottom: 0, left: 0, width: 40, height: 40, borderBottomWidth: 4, borderLeftWidth: 4, borderColor: '#4f8cff', borderBottomLeftRadius: 12 },
  scanCornerBR: { position: 'absolute', bottom: 0, right: 0, width: 40, height: 40, borderBottomWidth: 4, borderRightWidth: 4, borderColor: '#4f8cff', borderBottomRightRadius: 12 },
  scanHint: { color: '#94a3b8', fontSize: 15, fontWeight: '600', marginTop: 24 },
  scanFooter: {
    flexDirection: 'row', justifyContent: 'center', gap: 20,
    paddingVertical: 30, backgroundColor: '#000',
  },
  scanCloseBtn: { backgroundColor: '#ff475720', borderRadius: 14, borderWidth: 1, borderColor: '#ff4757', paddingVertical: 14, paddingHorizontal: 24 },
  scanCloseText: { color: '#ff4757', fontSize: 16, fontWeight: '700' },
  scanManualBtn: { backgroundColor: '#141832', borderRadius: 14, borderWidth: 1, borderColor: '#1e2a4a', paddingVertical: 14, paddingHorizontal: 24 },
  scanManualText: { color: '#e8edf5', fontSize: 16, fontWeight: '700' },
});

export default QRScannerScreen;
