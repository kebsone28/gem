import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface FormCardProps {
  title: string;
  version: string;
  downloadedAt: string;
  submissionCount: number;
  pendingCount: number;
  isOnline: boolean;
  onPress: () => void;
  onDelete: () => void;
  onDownload?: () => void;
  isDownloaded?: boolean;
}

const FormCard: React.FC<FormCardProps> = ({
  title,
  version,
  downloadedAt,
  submissionCount,
  pendingCount,
  onPress,
  onDelete,
}) => {
  const dateStr = new Date(downloadedAt).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>📋</Text>
        </View>
        <View style={styles.titleArea}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          <Text style={styles.version}>v{version}</Text>
        </View>
        <TouchableOpacity onPress={onDelete} style={styles.deleteBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.deleteIcon}>🗑</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.meta}>
        <Text style={styles.metaText}>📅 {dateStr}</Text>
        <Text style={styles.metaText}>📤 {submissionCount} soumission(s)</Text>
      </View>

      {pendingCount > 0 && (
        <View style={styles.pendingBadge}>
          <Text style={styles.pendingText}>
            ⏳ {pendingCount} en attente de synchronisation
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  icon: {
    fontSize: 22,
  },
  titleArea: {
    flex: 1,
  },
  title: {
    color: '#f1f5f9',
    fontSize: 16,
    fontWeight: '700',
  },
  version: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  deleteBtn: {
    padding: 4,
  },
  deleteIcon: {
    fontSize: 18,
    opacity: 0.6,
  },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  metaText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '500',
  },
  pendingBadge: {
    marginTop: 8,
    backgroundColor: '#f59e0b20',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  pendingText: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '600',
  },
});

export default FormCard;
