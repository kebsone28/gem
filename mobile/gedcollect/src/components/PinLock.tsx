import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PIN_KEY = '@gedcollect/pin';
const LOCK_TIMEOUT = 300000;

interface PinLockProps {
  appState: string;
  children: React.ReactNode;
}

export const PinLockProvider: React.FC<PinLockProps> = ({ appState, children }) => {
  const [pin, setPin] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [input, setInput] = useState('');
  const lastActive = useRef(Date.now());
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AsyncStorage.getItem(PIN_KEY).then(setPin);
  }, []);

  useEffect(() => {
    if (appState === 'active') {
      const elapsed = Date.now() - lastActive.current;
      if (pin && elapsed > LOCK_TIMEOUT) setLocked(true);
      lastActive.current = Date.now();
    }
    if (appState === 'background') lastActive.current = Date.now();
  }, [appState, pin]);

  const handlePinSubmit = useCallback(() => {
    if (input === pin) {
      setLocked(false);
      setInput('');
    } else {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
      setInput('');
    }
  }, [input, pin, shakeAnim]);

  const setUserPin = useCallback(async (newPin: string) => {
    await AsyncStorage.setItem(PIN_KEY, newPin);
    setPin(newPin);
  }, []);

  if (locked) {
    return (
      <View style={styles.overlay}>
        <Animated.View style={[styles.box, { transform: [{ translateX: shakeAnim }] }]}>
          <Text style={styles.lockIcon}>🔒</Text>
          <Text style={styles.title}>Session verrouillée</Text>
          <Text style={styles.subtitle}>Entrez votre code PIN</Text>
          <View style={styles.dots}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={[styles.dot, input.length > i && styles.dotFull]} />
            ))}
          </View>
          <View style={styles.keypad}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '⌫'].map((k, i) => (
              k === '' ? <View key={i} style={styles.keyBtn} /> :
              <TouchableOpacity key={i} style={styles.keyBtn} onPress={() => {
                if (k === '⌫') setInput((p) => p.slice(0, -1));
                else if (input.length < 4) {
                  const next = input + k;
                  setInput(next);
                  if (next.length === 4) setTimeout(() => handlePinSubmit(), 200);
                }
              }}>
                <Text style={styles.keyText}>{k}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      </View>
    );
  }

  return <>{children}</>;
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0a0e27',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  box: {
    backgroundColor: '#141832',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    width: '85%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#1e2a4a',
  },
  lockIcon: {
    fontSize: 40,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#e8edf5',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#8899aa',
    marginBottom: 24,
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 32,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#1e2a4a',
    backgroundColor: 'transparent',
  },
  dotFull: {
    backgroundColor: '#4f8cff',
    borderColor: '#4f8cff',
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: '100%',
    gap: 16,
  },
  keyBtn: {
    width: '28%',
    aspectRatio: 1,
    borderRadius: 40,
    backgroundColor: '#0d1130',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e2a4a',
  },
  keyText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#e8edf5',
  },
});

