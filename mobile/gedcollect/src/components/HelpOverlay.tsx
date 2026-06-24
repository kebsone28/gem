import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';

const STEPS = [
  {
    icon: '📱',
    title: '1. Connexion',
    desc: 'Entrez votre numéro de téléphone. Un code de vérification vous sera envoyé par SMS pour vous connecter.',
  },
  {
    icon: '📋',
    title: '2. Choisir un formulaire',
    desc: 'La liste des formulaires qui vous sont assignés s\'affiche. Appuyez sur un formulaire pour commencer la collecte.',
  },
  {
    icon: '✏️',
    title: '3. Remplir le formulaire',
    desc: 'Répondez aux questions, prenez des photos, saisissez les coordonnées GPS. Les champs obligatoires sont marqués d\'un *.',
  },
  {
    icon: '💾',
    title: '4. Sauvegarder un brouillon',
    desc: 'Vous pouvez sauvegarder votre travail à tout moment en appuyant sur "Sauvegarder brouillon". Le brouillon sera conservé sur votre appareil.',
  },
  {
    icon: '📤',
    title: '5. Soumettre',
    desc: 'Quand le formulaire est complet, appuyez sur "Soumettre". Les données seront envoyées au serveur automatiquement.',
  },
  {
    icon: '📡',
    title: '6. Synchronisation',
    desc: 'Si vous êtes hors-ligne, les soumissions sont mises en file d\'attente. Elles seront envoyées dès que la connexion sera rétablie.',
  },
  {
    icon: '⚙️',
    title: '7. Paramètres',
    desc: 'Vous pouvez modifier l\'URL du serveur, activer la synchronisation automatique et vous déconnecter depuis l\'écran Paramètres (icône ⚙️).',
  },
];

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface HelpOverlayProps {
  visible: boolean;
  onClose: () => void;
}

const HelpOverlay: React.FC<HelpOverlayProps> = ({ visible, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const isLast = currentStep === STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      setCurrentStep(0);
      onClose();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep((prev) => prev - 1);
  };

  const step = STEPS[currentStep];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.stepIcon}>{step.icon}</Text>
            <Text style={styles.stepTitle}>{step.title}</Text>
            <Text style={styles.stepDesc}>{step.desc}</Text>

            <View style={styles.dots}>
              {STEPS.map((_, i) => (
                <View key={i} style={[styles.dot, i === currentStep && styles.dotActive]} />
              ))}
            </View>
          </ScrollView>

          <View style={styles.actions}>
            {currentStep > 0 ? (
              <TouchableOpacity style={styles.prevBtn} onPress={handlePrev}>
                <Text style={styles.prevText}>← Précédent</Text>
              </TouchableOpacity>
            ) : <View style={{ flex: 1 }} />}
            <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
              <Text style={styles.nextText}>{isLast ? 'Compris !' : 'Suivant →'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#141832',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1e2a4a',
    width: '100%',
    maxHeight: SCREEN_HEIGHT * 0.7,
    overflow: 'hidden',
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 16,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1e2a4a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: '#8899aa', fontSize: 16, fontWeight: '700' },
  content: { alignItems: 'center', padding: 32, paddingTop: 40 },
  stepIcon: { fontSize: 56, marginBottom: 16 },
  stepTitle: { color: '#e8edf5', fontSize: 20, fontWeight: '800', marginBottom: 12, textAlign: 'center' },
  stepDesc: { color: '#8899aa', fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 24 },
  dots: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1e2a4a' },
  dotActive: { backgroundColor: '#4f8cff', width: 24 },
  actions: { flexDirection: 'row', padding: 16, paddingTop: 0, gap: 10 },
  prevBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#1e2a4a',
    alignItems: 'center',
  },
  prevText: { color: '#8899aa', fontSize: 14, fontWeight: '700' },
  nextBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#4f8cff',
    alignItems: 'center',
  },
  nextText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});

export default HelpOverlay;
