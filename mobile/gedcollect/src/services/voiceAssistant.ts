/**
 * Voice Assistant – Text‑to‑Speech for accessibility
 *
 * Wraps react-native-tts so FormScreen can speak questions aloud.
 * Gracefully falls back to a no‑op when the module is unavailable.
 */
import { useCallback, useMemo, useState } from 'react';

// ─── SAFE REQUIRE HELPER ───────────────────────────────────────────────
function safeRequire(name: string): any {
  try {
    const mod = require(name);
    // Both ESM interop ({ __esModule, default }) and RN native module wrappers
    // ({ default: NativeImpl }) expose the API under .default
    if (mod && typeof mod === 'object' && 'default' in mod) {
      return mod.default;
    }
    return mod;
  } catch (e) {
    if (__DEV__) {
      console.warn(`[voiceAssistant] Module "${name}" not available:`, e);
    }
    return null;
  }
}

const TtsModule = safeRequire('react-native-tts');
const Tts = TtsModule?.default ?? TtsModule;

// Initialise once at module level
let didInit = false;
function ensureInit() {
  if (!Tts || didInit) return;
  didInit = true;
  try {
    Tts.setDefaultLanguage('fr-FR');
    Tts.setDefaultRate(0.45);
  } catch {}
}

export interface VoiceAssistant {
  enabled: boolean;
  speakNow: (text: string) => void;
  toggle: () => void;
}

export function useVoiceAssistant(): VoiceAssistant {
  const [enabled, setEnabled] = useState(() => !!Tts);

  const speakNow = useCallback(
    (text: string) => {
      if (!Tts || !enabled || !text) return;
      ensureInit();
      try {
        Tts.stop();
        Tts.speak(text);
      } catch {
        // TTS unavailable – silently ignore
      }
    },
    [enabled]
  );

  const toggle = useCallback(() => {
    setEnabled((prev) => !prev);
  }, []);

  return { enabled, speakNow, toggle };
}
