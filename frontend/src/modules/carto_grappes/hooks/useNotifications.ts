import { useState, useEffect, useCallback, useRef } from 'react';

interface NotificationState {
  supported: boolean;
  permission: NotificationPermission;
  enabled: boolean;
}

export function useNotifications(computeAlertsFn?: () => Array<{ severity: string; region: string; grappe: string; msg: string; key: string }>) {
  const [state, setState] = useState<NotificationState>({
    supported: typeof Notification !== 'undefined',
    permission: typeof Notification !== 'undefined' ? Notification.permission : 'denied',
    enabled: false,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('proquelec_notif_enabled');
      if (stored === 'true' && state.permission === 'granted') {
        setState(prev => ({ ...prev, enabled: true }));
      }
    } catch { /* ignore */ }
  }, [state.permission]);

  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') {
      alert('Les notifications ne sont pas supportées sur ce navigateur.');
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      setState(prev => ({ ...prev, permission: perm, enabled: perm === 'granted' }));
      if (perm === 'granted') {
        localStorage.setItem('proquelec_notif_enabled', 'true');
        alert('✓ Notifications activées ! Vous recevrez des alertes PROQUELEC.');
      } else {
        alert('Notifications refusées. Vous pouvez les activer dans les paramètres du navigateur.');
      }
    } catch { /* ignore */ }
  }, []);

  const disableNotifications = useCallback(() => {
    localStorage.setItem('proquelec_notif_enabled', 'false');
    setState(prev => ({ ...prev, enabled: false }));
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const sendNotification = useCallback((title: string, body: string) => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    try {
      new Notification(title, {
        body,
        tag: 'proquelec-alert',
        icon: '/favicon.ico',
        badge: '/favicon.ico',
      });
    } catch { /* ignore */ }
  }, []);

  // Schedule periodic check every 30 minutes
  useEffect(() => {
    if (!state.enabled || !computeAlertsFn) return;

    const check = () => {
      try {
        const alerts = computeAlertsFn();
        const highs = alerts.filter(a => a.severity === 'high');
        if (highs.length > 0) {
          sendNotification(
            `🔴 PROQUELEC — ${highs.length} alerte(s) critique(s)`,
            highs.slice(0, 3).map(a => `${a.region} G${a.grappe} : ${a.msg}`).join('\n'),
          );
        }
      } catch { /* ignore */ }
    };

    // Initial check after 5 seconds
    const timeout = setTimeout(check, 5000);
    // Then every 30 minutes
    intervalRef.current = setInterval(check, 30 * 60 * 1000);

    return () => {
      clearTimeout(timeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [state.enabled, computeAlertsFn, sendNotification]);

  return {
    ...state,
    requestPermission,
    disableNotifications,
    sendNotification,
  };
}
