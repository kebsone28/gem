/**
 * HealthDashboard — Module Santé du GED OS
 * Calqué sur le pattern agriculture, avec des données de démonstration
 * et prêt à se brancher sur /api/health-centers une fois le backend déployé.
 */
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  HeartPulse, Users, Activity, AlertCircle,
  FolderHeart, Syringe, RefreshCw
} from 'lucide-react';
import '../styles/health.css';
import { HealthCenterCard } from '../components/HealthCenterCard';
import type { HealthCenterData } from '../components/HealthCenterCard';
import { useProject } from '../../../contexts/ProjectContext';

// ── Mock data de démonstration ────────────────────────────────────────────
const MOCK_CENTERS: HealthCenterData[] = [
  {
    id: 'hc-1',
    name: 'Centre de Santé Pikine',
    type: 'clinic',
    status: 'operational',
    beds: 45,
    staff: [
      { name: 'Dr. Fatou Diallo', role: 'Médecin chef' },
      { name: 'Aicha Ba', role: 'Infirmière' },
      { name: 'Mamadou Sy', role: 'Aide-soignant' },
    ],
    location: { lat: 14.762, lng: -17.405 },
  },
  {
    id: 'hc-2',
    name: 'Hôpital Régional de Kaolack',
    type: 'hospital',
    status: 'understaffed',
    beds: 180,
    staff: [
      { name: 'Dr. Ibrahima Ndiaye', role: 'Chirurgien' },
      { name: 'Marème Sarr', role: 'Sage-femme' },
    ],
    location: { lat: 14.152, lng: -16.073 },
  },
  {
    id: 'hc-3',
    name: 'Maternité de Ziguinchor',
    type: 'maternity',
    status: 'operational',
    beds: 30,
    staff: [
      { name: 'Dr. Binta Diouf', role: 'Gynécologue' },
      { name: 'Rokhaya Fall', role: 'Sage-femme' },
      { name: 'Ndéye Thiaw', role: 'Infirmière' },
      { name: 'Coumba Gaye', role: 'Aide-soignante' },
    ],
    location: { lat: 12.556, lng: -16.271 },
  },
  {
    id: 'hc-4',
    name: 'Dispensaire Rural Tambacounda',
    type: 'dispensary',
    status: 'closed',
    beds: 8,
    staff: [],
    location: { lat: 13.770, lng: -13.667 },
  },
];

const MOCK_CAMPAIGNS = [
  { id: 'c1', name: 'Vaccination Polio 2026', type: 'vaccination', disease: 'Polio', target: 12000, vaccinated: 9840 },
  { id: 'c2', name: 'Dépistage VIH/Sida', type: 'screening', disease: 'VIH', target: 5000, vaccinated: 3200 },
  { id: 'c3', name: 'Campagne Paludisme', type: 'treatment', disease: 'Paludisme', target: 8000, vaccinated: 7200 },
];

const MOCK_PATIENT_COUNTS: Record<string, number> = {
  'hc-1': 32, 'hc-2': 145, 'hc-3': 22, 'hc-4': 0,
};

const MOCK_OCCUPANCY: Record<string, number> = {
  'hc-1': 0.71, 'hc-2': 0.80, 'hc-3': 0.73, 'hc-4': 0,
};

// ── Component ──────────────────────────────────────────────────────────────
export const HealthDashboard: React.FC = () => {
  const { project, projects, setActiveProjectId } = useProject();
  const [centers] = useState<HealthCenterData[]>(MOCK_CENTERS);
  const [campaigns] = useState(MOCK_CAMPAIGNS);

  const totalBeds = centers.reduce((acc, c) => acc + (c.beds ?? 0), 0);
  const totalPatients = Object.values(MOCK_PATIENT_COUNTS).reduce((a, b) => a + b, 0);
  const closedCount = centers.filter(c => c.status === 'closed').length;
  const understaffedCount = centers.filter(c => c.status === 'understaffed').length;

  // ── Aucun projet sélectionné ─────────────────────────────────────────────
  if (!project) {
    return (
      <div className="health-dashboard">
        <div className="health-header">
          <h1 className="health-header-title">
            <HeartPulse size={30} color="#3b82f6" />
            Tableau de Bord Santé
          </h1>
        </div>
        <motion.div
          className="health-project-selection-required"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="health-required-icon-box">
            <FolderHeart size={32} />
          </div>
          <h2 className="health-required-title">Aucun projet actif sélectionné</h2>
          <p className="health-required-desc">
            Sélectionnez un projet pour visualiser le tableau de bord santé (structures, campagnes, couverture vaccinale).
          </p>
          <select
            className="health-required-select"
            defaultValue=""
            onChange={(e) => { if (e.target.value) setActiveProjectId(e.target.value); }}
          >
            <option value="" disabled>-- Choisir un projet --</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}{p.client ? ` (${p.client})` : ''}</option>
            ))}
          </select>
        </motion.div>
      </div>
    );
  }

  // ── Dashboard principal ──────────────────────────────────────────────────
  return (
    <div className="health-dashboard">
      {/* Header */}
      <div className="health-header">
        <h1 className="health-header-title">
          <HeartPulse size={30} color="#3b82f6" />
          Tableau de Bord Santé
        </h1>
        <div className="health-header-actions">
          <motion.button
            className="agri-refresh-btn"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="Actualiser"
          >
            <RefreshCw size={16} />
          </motion.button>
          <select
            className="agri-project-select"
            value={project.id}
            onChange={(e) => setActiveProjectId(e.target.value)}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Badge projet actif */}
      <div className="health-project-active-badge">
        <FolderHeart size={14} color="#3b82f6" />
        <span>Supervision santé : <strong>{project.name}</strong></span>
      </div>

      {/* KPI Cards */}
      <div className="health-stats-grid">
        <motion.div className="health-stat-card success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}>
          <div className="health-stat-label">Structures de Santé</div>
          <div className="health-stat-value">
            {centers.length} <span className="health-stat-unit"> sites</span>
          </div>
          <HeartPulse size={24} color="#10b981" style={{ position: 'absolute', right: 24, top: 24, opacity: 0.2 }} />
        </motion.div>

        <motion.div className="health-stat-card" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3, delay: 0.08 }}>
          <div className="health-stat-label">Lits Disponibles (Total)</div>
          <div className="health-stat-value">
            {totalBeds} <span className="health-stat-unit"> lits</span>
          </div>
          <Activity size={24} color="#3b82f6" style={{ position: 'absolute', right: 24, top: 24, opacity: 0.2 }} />
        </motion.div>

        <motion.div className="health-stat-card" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3, delay: 0.12 }}>
          <div className="health-stat-label">Patients en Cours</div>
          <div className="health-stat-value">
            {totalPatients.toLocaleString()} <span className="health-stat-unit"> patients</span>
          </div>
          <Users size={24} color="#8b5cf6" style={{ position: 'absolute', right: 24, top: 24, opacity: 0.2 }} />
        </motion.div>

        <motion.div className="health-stat-card alert" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3, delay: 0.16 }}>
          <div className="health-stat-label">Alertes Opérationnelles</div>
          <div className="health-stat-value" style={{ color: '#dc2626' }}>
            {closedCount + understaffedCount}
            <span className="health-stat-unit" style={{ color: '#dc2626', opacity: 0.8 }}> structures</span>
          </div>
          <AlertCircle size={24} color="#ef4444" style={{ position: 'absolute', right: 24, top: 24, opacity: 0.2 }} />
        </motion.div>
      </div>

      {/* Grille des structures */}
      <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--text-primary)' }}>
        Structures de Santé Supervisées
        <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: '0.75rem' }}>
          ({centers.length} sites)
        </span>
      </h2>
      <div className="health-centers-grid">
        {centers.map((center, idx) => (
          <motion.div
            key={center.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: idx * 0.08 }}
          >
            <HealthCenterCard
              center={center}
              patientCount={MOCK_PATIENT_COUNTS[center.id] ?? 0}
              occupancyRate={MOCK_OCCUPANCY[center.id] ?? 0}
            />
          </motion.div>
        ))}
      </div>

      {/* Campagnes de santé */}
      <div className="health-campaigns-section">
        <h2 className="health-campaigns-title">
          <Syringe size={20} color="#3b82f6" />
          Campagnes de Santé Publique
        </h2>
        <div className="health-campaigns-grid">
          {campaigns.map((camp, idx) => {
            const rate = camp.vaccinated / camp.target;
            return (
              <motion.div
                key={camp.id}
                className="health-campaign-card"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: idx * 0.1 }}
              >
                <div className="hccamp-name">{camp.name}</div>
                <div className="hccamp-type">{camp.type} — {camp.disease}</div>
                <div className="hccamp-progress-label">
                  <span>{camp.vaccinated.toLocaleString()} / {camp.target.toLocaleString()}</span>
                  <span style={{ fontWeight: 700, color: rate >= 0.8 ? '#10b981' : rate >= 0.5 ? '#f59e0b' : '#ef4444' }}>
                    {Math.round(rate * 100)}%
                  </span>
                </div>
                <div className="hccamp-progress-bar-bg">
                  <motion.div
                    className="hccamp-progress-bar-fill"
                    style={{
                      background: rate >= 0.8
                        ? 'linear-gradient(90deg, #10b981, #34d399)'
                        : rate >= 0.5
                        ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                        : 'linear-gradient(90deg, #ef4444, #f87171)',
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, rate * 100)}%` }}
                    transition={{ duration: 1.2, delay: 0.4 + idx * 0.1 }}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default HealthDashboard;
