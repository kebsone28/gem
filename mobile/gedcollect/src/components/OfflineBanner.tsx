import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface OfflineBannerProps {
  visible: boolean;
}

const OfflineBanner: React.FC<OfflineBannerProps> = ({ visible }) => {
  if (!visible) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>📵 Mode hors ligne — Les soumissions seront synchronisées plus tard</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#f59e0b',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  text: {
    color: '#1e293b',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
});

export default OfflineBanner;
