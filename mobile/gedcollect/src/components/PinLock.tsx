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
