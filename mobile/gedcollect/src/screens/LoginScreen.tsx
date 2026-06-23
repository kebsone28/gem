import React, { useState, useRef } from 'react';
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
import { sendOtp, verifyOtp } from '@services/api';

interface Props {
  onLoginSuccess: () => void;
}

export default function LoginScreen({ onLoginSuccess }: Props) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const codeInputRef = useRef<TextInput>(null);

  const formatPhone = (v: string) => {
    const digits = v.replace(/\D/g, '');
    if (digits.length <= 3) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
    if (digits.length <= 8) return `${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5)}`;
    return `${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)}`;
  };

  const handleSendOtp = async () => {
    const raw = phone.replace(/\s/g, '');
    if (raw.length < 8) {
      setError('Numéro de téléphone invalide');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await sendOtp(raw);
      setStep('otp');
      setTimeout(() => codeInputRef.current?.focus(), 300);
    } catch (e: any) {
      setError(e.message || 'Erreur lors de l\'envoi du code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (code.length < 4) {
      setError('Code invalide');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const raw = phone.replace(/\s/g, '');
      await verifyOtp(raw, code);
      onLoginSuccess();
    } catch (e: any) {
      setError(e.message || 'Code incorrect');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep('phone');
    setCode('');
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
          {step === 'phone' ? (
            <>
              <Text style={styles.title}>Connexion</Text>
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
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleSendOtp}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Envoyer le code</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
                <Text style={styles.backText}>← Modifier le numéro</Text>
              </TouchableOpacity>
              <Text style={styles.title}>Code de vérification</Text>
              <Text style={styles.label}>
                Entrez le code reçu au {phone}
              </Text>
              <TextInput
                ref={codeInputRef}
                style={[styles.input, styles.codeInput]}
                placeholder="1234"
                placeholderTextColor="#666"
                keyboardType="number-pad"
                value={code}
                onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                editable={!loading}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleVerifyOtp}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Vérifier</Text>
                )}
              </TouchableOpacity>
            </>
          )}
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
  codeInput: { fontSize: 28, letterSpacing: 8 },
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
  backBtn: { marginBottom: 16 },
  backText: { color: '#4f8cff', fontSize: 14, fontWeight: '600' },
});
