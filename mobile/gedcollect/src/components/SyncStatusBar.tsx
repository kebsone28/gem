import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import type { SyncStatus } from '@types/index';

interface SyncStatusBarProps {
  status: SyncStatus;
  isOnline: boolean;
  pendingCount: number;
  onSync: () => void;
  message?: string;
}

const SyncStatusBar: React.FC<SyncStatusBarProps> = ({ status, isOnline, pendingCount, onSync, message }) => {
  const statusColors: Record<SyncStatus, string> = {
    idle: '#64748b',
    syncing: '#3b82f6',
    success: '#22c55e',
    error: '#ef4444',
  };

  const statusLabels: Record<SyncStatus, string> = {
    idle: 'À jour',
    syncing: 'Synchronisation...',
    success: 'Synchronisé',
    error: message || 'Erreur de synchronisation',
  };

  return (
    <View style={[styles.container, { borderColor: statusColors[status] + '40' }]}>
      <View style={styles.left}>
        {status === 'syncing' ? (
          <ActivityIndicator size="small" color="#3b82f6" />
        ) : (
          <View style={[styles.dot, { backgroundColor: statusColors[status] }]} />
        )}
        <Text style={[styles.statusText, { color: statusColors[status] }]}>
          {statusLabels[status]}
        </Text>
        {!isOnline && (
          <View style={styles.offlineBadge}>
            <Text style={styles.offlineText}>📵 Hors ligne</Text>
          </View>
        )}
      </View>
      <View style={styles.right}>
        {pendingCount > 0 && (
          <Text style={styles.pendingCount}>{pendingCount} en attente</Text>
        )}
        {isOnline && (
          <TouchableOpacity
            style={[styles.syncBtn, status === 'syncing' && styles.syncBtnDisabled]}
            onPress={onSync}
            disabled={status === 'syncing'}
          >
            <Text style={styles.syncBtnText}>
              {status === 'syncing' ? '...' : 'Sync'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  offlineBadge: {
    backgroundColor: '#f59e0b20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  offlineText: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '700',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pendingCount: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '600',
  },
  syncBtn: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  syncBtnDisabled: {
    opacity: 0.5,
  },
  syncBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});

export default SyncStatusBar;
