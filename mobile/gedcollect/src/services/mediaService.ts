import { launchCamera, launchImageLibrary, ImagePickerResponse } from 'react-native-image-picker';
import RNFS from 'react-native-fs';
import { Platform, PermissionsAndroid, Alert } from 'react-native';

let AudioRecord: any = null;
try {
  AudioRecord = require('react-native-audio-recorder-player');
} catch {}

const audioRecorder = AudioRecord ? new AudioRecord.default() : null;

export type MediaType = 'photo' | 'video' | 'audio' | 'barcode';

export interface MediaCaptureResult {
  uri: string;
  type: MediaType;
  mimeType: string;
  fileName: string;
  fileSize?: number;
  duration?: number;
  thumbnail?: string;
}

async function requestCameraPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }
  return true;
}

async function requestAudioPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }
  return true;
}

function pickerToResult(response: ImagePickerResponse, type: MediaType): MediaCaptureResult | null {
  const asset = response.assets?.[0];
  if (!asset?.uri) return null;
  return {
    uri: asset.uri,
    type,
    mimeType: asset.type || (type === 'video' ? 'video/mp4' : 'image/jpeg'),
    fileName: asset.fileName || `${type}_${Date.now()}.${type === 'video' ? 'mp4' : 'jpg'}`,
    fileSize: asset.fileSize,
    duration: asset.duration,
  };
}

export const MediaService = {
  async capturePhoto(): Promise<MediaCaptureResult | null> {
    const ok = await requestCameraPermission();
    if (!ok) { Alert.alert('Permission', 'Permission caméra requise'); return null; }
    const response = await launchCamera({ mediaType: 'photo', quality: 0.8, maxWidth: 2048, maxHeight: 2048 });
    return pickerToResult(response, 'photo');
  },

  async pickPhoto(): Promise<MediaCaptureResult | null> {
    const response = await launchImageLibrary({ mediaType: 'photo', quality: 0.8, selectionLimit: 1 });
    return pickerToResult(response, 'photo');
  },

  async captureVideo(): Promise<MediaCaptureResult | null> {
    const ok = await requestCameraPermission();
    if (!ok) { Alert.alert('Permission', 'Permission caméra requise'); return null; }
    const response = await launchCamera({ mediaType: 'video', videoQuality: 'high', durationLimit: 120 });
    return pickerToResult(response, 'video');
  },

  async pickVideo(): Promise<MediaCaptureResult | null> {
    const response = await launchImageLibrary({ mediaType: 'video', selectionLimit: 1 });
    return pickerToResult(response, 'video');
  },

  async startAudioRecording(): Promise<string | null> {
    if (!audioRecorder) {
      Alert.alert('Indisponible', 'react-native-audio-recorder-player non installé. Rebuild requis.');
      return null;
    }
    const ok = await requestAudioPermission();
    if (!ok) { Alert.alert('Permission', 'Permission microphone requise'); return null; }
    const path = `${RNFS.DocumentDirectoryPath}/audio_${Date.now()}.m4a`;
    try {
      await audioRecorder.startRecorder(path);
      return path;
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de démarrer l\'enregistrement audio');
      return null;
    }
  },

  async stopAudioRecording(): Promise<MediaCaptureResult | null> {
    if (!audioRecorder) return null;
    try {
      const result = await audioRecorder.stopRecorder();
      const path = typeof result === 'string' ? result : result?.path || result?.audioFile || '';
      if (!path) return null;
      return {
        uri: path,
        type: 'audio',
        mimeType: 'audio/m4a',
        fileName: path.split('/').pop() || `audio_${Date.now()}.m4a`,
      };
    } catch {
      return null;
    }
  },

  async playAudio(uri: string): Promise<void> {
    if (!audioRecorder) return;
    try { await audioRecorder.startPlayer(uri); } catch {}
  },

  async stopAudio(): Promise<void> {
    if (!audioRecorder) return;
    try { await audioRecorder.stopPlayer(); } catch {}
  },

  fileToDataUrl: async (uri: string): Promise<string> => {
    const base64 = await RNFS.readFile(uri, 'base64');
    const ext = (uri.split('.').pop() || 'bin').toLowerCase();
    const mimeMap: Record<string, string> = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
      webp: 'image/webp', gif: 'image/gif', mp4: 'video/mp4',
      m4a: 'audio/m4a', mp3: 'audio/mp3', wav: 'audio/wav',
    };
    return `data:${mimeMap[ext] || 'application/octet-stream'};base64,${base64}`;
  },
};
