/**
 * Composant AlertDashboard - Dashboard des Alertes en Temps Réel
 * Affiche toutes les alertes du projet avec gestion (acknowledge, resolve)
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Clock,
  X,
  ChevronDown,
  Bell,
  TrendingUp,
  Eye,
  CheckSquare,
  Archive,
} from 'lucide-react';
import alertsAPI from '../../services/alertsAPI';
import { useProject } from '../../contexts/ProjectContext';
import toast from 'react-hot-toast';

interface Alert {
  id: string;
  type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'ESCALATED';
  title: string;
  description?: string;
  createdAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  escalationLevel?: number;
}

interface AlertStats {
  byStatus: Record<string, number>;
  totalCritical: number;
}

export const AlertDashboard: React.FC = () => {
  const { project } = useProject();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState<AlertStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>('OPEN');
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);

  const projectId = project?.id;

  useEffect(() => {
    if (!projectId) return;

    const fetchAlertsAndStats = async () => {
      try {
        setLoading(true);
        const [alertsData, statsData] = await Promise.all([
          alertsAPI.getProjectAlerts(projectId, { status: selectedStatus, limit: 100 }),
          alertsAPI.getAlertStats(projectId),
        ]);
        setAlerts(alertsData || []);
        setStats(statsData);
      } catch (err) {
        console.error('Error fetching alerts:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAlertsAndStats();

    // Refresh tous les 30 secondes
    const interval = setInterval(fetchAlertsAndStats, 30000);
    return () => clearInterval(interval);
  }, [projectId, selectedStatus]);

  const handleAcknowledge = async (alertId: string) => {
    try {
      await alertsAPI.acknowledgeAlert(alertId);
      setAlerts(alerts.map(a => (a.id === alertId ? { ...a, status: 'ACKNOWLEDGED' } : a)));
      toast.success('Alerte reconnue');
    } catch (err) {
      toast.error('Erreur lors de la reconnaissance');
    }
  };

  const handleResolve = async (alertId: string) => {
    try {
      await alertsAPI.resolveAlert(alertId, '');
      setAlerts(alerts.map(a => (a.id === alertId ? { ...a, status: 'RESOLVED' } : a)));
      toast.success('Alerte résolue');
    } catch (err) {
      toast.error('Erreur lors de la résolution');
    }
  };

  const severityConfig = {
    CRITICAL: { color: 'red', icon: AlertTriangle, label: 'Critique' },
    HIGH: { color: 'orange', icon: AlertCircle, label: 'Élevée' },
    MEDIUM: { color: 'amber', icon: Clock, label: 'Moyenne' },
    LOW: { color: 'blue', icon: CheckCircle, label: 'Basse' },
  };

  const statusColors = {
    OPEN: 'red',
    ACKNOWLEDGED: 'orange',
    RESOLVED: 'green',
    ESCALATED: 'purple',
  };

  return (
    <div className="space-y-6">
      {/* Header avec stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-red-500/10 to-red-500/5 border border-red-500/20 rounded-2xl p-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-red-400 uppercase tracking-widest">Critique</p>
              <p className="text-2xl font-black text-red-300 mt-1">{stats?.totalCritical || 0}</p>
            </div>
            <AlertTriangle className="text-red-500" size={28} />
          </div>
        </motion.div>

        {['OPEN', 'ACKNOWLEDGED', 'RESOLVED'].map((status) => (
          <motion.div
            key={status}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`bg-gradient-to-br from-${statusColors[status as keyof typeof statusColors]}-500/10 to-${statusColors[status as keyof typeof statusColors]}-500/5 border border-${statusColors[status as keyof typeof statusColors]}-500/20 rounded-2xl p-4`}
          >
            <div>
              <p className={`text-[10px] font-black text-${statusColors[status as keyof typeof statusColors]}-400 uppercase tracking-widest`}>
                {status}
              </p>
              <p className={`text-2xl font-black text-${statusColors[status as keyof typeof statusColors]}-300 mt-1`}>
                {stats?.byStatus?.[status] || 0}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filter buttons */}
      <div className="flex gap-2 flex-wrap">
        {['OPEN', 'ACKNOWLEDGED', 'RESOLVED'].map((status) => (
          <button
            key={status}
            onClick={() => setSelectedStatus(status)}
            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${
              selectedStatus === status
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-8 text-slate-400">Chargement des alertes...</div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-8 text-slate-400">Aucune alerte pour ce statut</div>
        ) : (
          <AnimatePresence>
            {alerts.map((alert) => {
              const severity = severityConfig[alert.severity];
              const SeverityIcon = severity.icon;

              return (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-2xl p-4"
                >
                  <div
                    onClick={() => setExpandedAlertId(expandedAlertId === alert.id ? null : alert.id)}
                    className="flex items-start justify-between cursor-pointer"
                  >
                    <div className="flex items-start gap-4 flex-1">
                      <div className={`p-2 rounded-xl bg-${severity.color}-500/20`}>
                        <SeverityIcon className={`text-${severity.color}-400`} size={20} />
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-black text-white">{alert.title}</h3>
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase bg-${severity.color}-500/20 text-${severity.color}-300`}>
                            {alert.severity}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase bg-slate-800 text-slate-300`}>
                            {alert.status}
                          </span>
                        </div>
                        {alert.description && (
                          <p className="text-[10px] text-slate-400 line-clamp-1">{alert.description}</p>
                        )}
                        <p className="text-[9px] text-slate-500 mt-1">
                          {new Date(alert.createdAt).toLocaleString('fr-FR')}
                        </p>
                      </div>
                    </div>

                    <ChevronDown
                      className={`text-slate-400 transition-transform ${
                        expandedAlertId === alert.id ? 'rotate-180' : ''
                      }`}
                      size={20}
                    />
                  </div>

                  {/* Expanded actions */}
                  <AnimatePresence>
                    {expandedAlertId === alert.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-4 pt-4 border-t border-white/5 space-y-2"
                      >
                        {alert.status === 'OPEN' && (
                          <>
                            <button
                              onClick={() => handleAcknowledge(alert.id)}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-500/20 text-orange-300 hover:bg-orange-500/30 transition-all text-[10px] font-black uppercase"
                            >
                              <Eye size={14} />
                              Reconnaître
                            </button>
                            <button
                              onClick={() => handleResolve(alert.id)}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/20 text-green-300 hover:bg-green-500/30 transition-all text-[10px] font-black uppercase"
                            >
                              <CheckSquare size={14} />
                              Résoudre
                            </button>
                          </>
                        )}
                        {alert.status === 'ACKNOWLEDGED' && (
                          <button
                            onClick={() => handleResolve(alert.id)}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/20 text-green-300 hover:bg-green-500/30 transition-all text-[10px] font-black uppercase"
                          >
                            <CheckSquare size={14} />
                            Résoudre
                          </button>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

export default AlertDashboard;
