import { useState, useCallback, useRef, useEffect } from 'react';
import Tts from 'react-native-tts';

export type VoiceState = 'idle' | 'speaking' | 'paused';

export function useVoiceAssistant() {
  const [enabled, setEnabled] = useState(false);
  const [state, setState] = useState<VoiceState>('idle');
  const queueRef = useRef<string[]>([]);
  const speakingRef = useRef(false);

  useEffect(() => {
    Tts.setDefaultLanguage('fr-FR');
    Tts.setDefaultRate(0.45);
    Tts.setDefaultPitch(1.0);
    const onFinish = () => {
      speakingRef.current = false;
      setState('idle');
      processQueue();
    };
    Tts.addEventListener('finish', onFinish);
    return () => { Tts.removeEventListener('finish', onFinish); };
  }, []);

  const processQueue = useCallback(() => {
    if (queueRef.current.length === 0 || !enabled) return;
    const text = queueRef.current.shift()!;
    speakingRef.current = true;
    setState('speaking');
    Tts.speak(text);
  }, [enabled]);

  const speak = useCallback((text: string) => {
    if (!enabled) return;
    queueRef.current.push(text);
    if (!speakingRef.current) processQueue();
  }, [enabled, processQueue]);

  const speakNow = useCallback((text: string) => {
    if (!enabled) return;
    Tts.stop();
    queueRef.current = [];
    speakingRef.current = true;
    setState('speaking');
    Tts.speak(text);
  }, [enabled]);

  const stop = useCallback(() => {
    Tts.stop();
    queueRef.current = [];
    speakingRef.current = false;
    setState('idle');
  }, []);

  const pause = useCallback(() => {
    Tts.stop();
    setState('paused');
  }, []);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      if (prev) { stop(); }
      return !prev;
    });
  }, [stop]);

  return { enabled, state, speak, speakNow, stop, pause, toggle, setEnabled };
}
