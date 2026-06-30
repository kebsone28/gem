import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { registerPin, loginWithPin } from '@services/api';

interface Props {
  onLoginSuccess: () => void;
}

export default function LoginScreen({ onLoginSuccess }: Props) {
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const pinInputRef = useRef<TextInput>(null);

  const formatPhone = (v: string) => {
    const digits = v.replace(/\D/g, '');
    if (digits.length <= 3) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
    if (digits.length <= 8) return `${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5)}`;
    return `${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)}`;
  };

  const handleSubmit = async () => {
    const raw = phone.replace(/\s/g, '');
    if (raw.length < 8) {
      setError('Numéro de téléphone invalide');
      return;
    }
    if (pin.length < 4) {
      setError('Le PIN doit contenir au moins 4 chiffres');
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (isRegistering) {
        await registerPin(raw, pin);
      }
      await loginWithPin(raw, pin);
      onLoginSuccess();
    } catch (e: any) {
      const msg = e.message || '';
      if (msg.includes('Aucun PIN configuré') || msg.includes('Un PIN est déjà défini')) {
        setIsRegistering(!isRegistering);
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsRegistering(!isRegistering);
    setError('');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Image
            source={require('../assets/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.logoText}>GedCollect</Text>
          <Text style={styles.subtitle}>Collecte de données terrain</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>
            {isRegistering ? 'Créer votre PIN' : 'Connexion'}
          </Text>
          <Text style={styles.label}>Numéro de téléphone</Text>
          <TextInput
            style={styles.input}
            placeholder="77 123 45 67"
            placeholderTextColor="#666"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={(v) => setPhone(formatPhone(v))}
            maxLength={14}
            editable={!loading}
          />
          <Text style={styles.label}>
            {isRegistering ? 'Nouveau PIN (4 à 6 chiffres)' : 'Votre PIN'}
          </Text>
          <TextInput
            ref={pinInputRef}
            style={[styles.input, styles.pinInput]}
            placeholder="****"
            placeholderTextColor="#666"
            keyboardType="number-pad"
            secureTextEntry
            value={pin}
            onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 6))}
            maxLength={6}
            editable={!loading}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {isRegistering ? 'Enregistrer et connecter' : 'Se connecter'}
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleMode} style={styles.toggleBtn}>
            <Text style={styles.toggleText}>
              {isRegistering
                ? 'Déjà un PIN ? Connectez-vous'
                : 'Première fois ? Créez votre PIN'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e27' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 40 },
  logoImage: {
    width: 100,
    height: 100,
    marginBottom: 12,
  },
  logoText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#4f8cff',
    letterSpacing: 1,
  },
  subtitle: { fontSize: 14, color: '#8899aa', marginTop: 6 },
  card: {
    backgroundColor: '#141832',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1e2a4a',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#e8edf5',
    marginBottom: 20,
    textAlign: 'center',
  },
  label: {
    fontSize: 13,
    color: '#8899aa',
    marginBottom: 8,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#0d1130',
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    color: '#e8edf5',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#1e2a4a',
    marginBottom: 16,
  },
  pinInput: { fontSize: 28, letterSpacing: 8 },
  button: {
    backgroundColor: '#4f8cff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  error: { color: '#ff4757', fontSize: 13, textAlign: 'center', marginBottom: 12 },
  toggleBtn: { marginTop: 16, alignItems: 'center' },
  toggleText: { color: '#4f8cff', fontSize: 13, fontWeight: '600' },
});
