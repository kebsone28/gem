/**
 * HealthCenter Card — Composant carte pour les structures de santé
 */
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BedDouble, Users, Stethoscope, AlertTriangle } from 'lucide-react';

export interface HealthCenterData {
  id: string;
  name: string;
  type: string; // "clinic" | "hospital" | "maternity"
  status: string; // "operational" | "understaffed" | "closed"
  location?: { lat: number; lng: number } | null;
  beds?: number;
  staff?: { name: string; role: string }[];
  equipment?: Record<string, boolean>;
  medications?: Record<string, number>;
  domainData?: Record<string, any>;
}

const CENTER_ICONS: Record<string, string> = {
  clinic: '🏥',
  hospital: '🏨',
  maternity: '👶',
  dispensary: '💊',
  laboratory: '🔬',
  pharmacy: '⚕️',
};

const STATUS_LABELS: Record<string, string> = {
  operational: 'Opérationnel',
  understaffed: 'Sous-effectif',
  closed: 'Fermé',
};

interface HealthCenterCardProps {
  center: HealthCenterData;
  patientCount?: number;
  occupancyRate?: number; // 0 to 1
}

export const HealthCenterCard: React.FC<HealthCenterCardProps> = ({
  center,
  patientCount = 0,
  occupancyRate = 0,
}) => {
  const icon = CENTER_ICONS[center.type?.toLowerCase()] || '🏥';
  const isAlert = center.status === 'understaffed' || center.status === 'closed';
  const staffCount = center.staff?.length ?? 0;

  return (
    <motion.div
      className="health-center-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      whileHover={{ y: -4 }}
    >
      {/* Header */}
      <div className="hcc-header">
        <div className="hcc-title-group">
          <div className="hcc-icon">{icon}</div>
          <div>
            <h3 className="hcc-title">{center.name}</h3>
            <span className="hcc-subtitle">{center.type} — {center.location ? `${center.location.lat.toFixed(3)}, ${center.location.lng.toFixed(3)}` : 'Localisation inconnue'}</span>
          </div>
        </div>
        <div className={`hcc-status ${center.status}`}>
          {STATUS_LABELS[center.status] || center.status}
        </div>
      </div>

      {/* Metrics */}
      <div className="hcc-metrics">
        <div className="hcc-metric-row">
          <span className="hcc-metric-label">
            <BedDouble size={15} color="#3b82f6" /> Lits disponibles
          </span>
          <span className="hcc-metric-value">{center.beds ?? 'N/A'}</span>
        </div>
        <div className="hcc-metric-row">
          <span className="hcc-metric-label">
            <Users size={15} color="#8b5cf6" /> Patients (en cours)
          </span>
          <span className="hcc-metric-value">{patientCount.toLocaleString()}</span>
        </div>
        <div className="hcc-metric-row">
          <span className="hcc-metric-label">
            <Stethoscope size={15} color="#10b981" /> Personnel médical
          </span>
          <span className="hcc-metric-value">{staffCount} agents</span>
        </div>

        {/* Taux d'occupation */}
        {center.beds && (
          <div style={{ marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              <span>Taux d'occupation</span>
              <span style={{ fontWeight: 700 }}>{Math.round(occupancyRate * 100)}%</span>
            </div>
            <div className="hccamp-progress-bar-bg">
              <motion.div
                className="hccamp-progress-bar-fill"
                style={{
                  background: occupancyRate > 0.85
                    ? 'linear-gradient(90deg, #ef4444, #f87171)'
                    : occupancyRate > 0.65
                    ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                    : 'linear-gradient(90deg, #3b82f6, #60a5fa)',
                }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, occupancyRate * 100)}%` }}
                transition={{ duration: 1, delay: 0.3 }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Alerte si problème */}
      <AnimatePresence>
        {isAlert && (
          <motion.div
            style={{
              display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
              background: 'rgba(239, 68, 68, 0.05)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: 'var(--radius-md)',
              padding: '0.75rem',
              fontSize: '0.75rem',
              color: '#b91c1c',
              fontWeight: 600,
            }}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
          >
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              {center.status === 'closed'
                ? 'Structure fermée — intervention requise'
                : 'Sous-effectif — renfort médical nécessaire'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
