import React from 'react';
import { motion } from 'framer-motion';
import { Sprout, Activity, AlertCircle, FolderHeart, RefreshCw, Database, Info } from 'lucide-react';
import '../styles/agriculture.css';
import { SmartFieldCard } from '../components/SmartFieldCard';
import { useProject } from '../../../contexts/ProjectContext';
import { useFieldsData } from '../hooks/useFieldsData';

export const Fields: React.FC = () => {
  const { project, projects, setActiveProjectId } = useProject();
  const { fields, analytics, isLoading, isLoadingAnalytics, error, isMock, refresh } = useFieldsData(project?.id);

  const totalArea = fields.reduce((acc, f) => acc + (f.domainData?.area || 0), 0);
  const totalYield = Object.values(analytics).reduce((acc, a) => acc + (a.yieldPrediction?.totalPredictedYield || 0), 0);
  const criticalThreatsCount = Object.values(analytics).filter(a => a.pestAndDiseaseRisk?.riskLevel === 'High').length;

  // ── État : Aucun projet sélectionné ──────────────────────────────────────
  if (!project) {
    return (
      <div className="agri-dashboard">
        <div className="agri-header">
          <h1 className="agri-header-title">
            <Sprout size={32} color="#10b981" />
            Tableau de Bord Agronomique
          </h1>
        </div>

        <motion.div
          className="agri-project-selection-required"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="agri-required-icon-box">
            <FolderHeart size={32} />
          </div>
          <h2 className="agri-required-title">Aucun projet actif sélectionné</h2>
          <p className="agri-required-desc">
            Pour visualiser le tableau de bord agronomique (alertes, calculs NPK, besoins en eau
            et prévisions de rendement), veuillez d'abord sélectionner un projet actif :
          </p>
          <div className="agri-required-action-container">
            <label className="agri-required-select-label" htmlFor="required-project-select">
              Sélectionnez un projet de supervision
            </label>
            <select
              id="required-project-select"
              className="agri-required-select"
              defaultValue=""
              onChange={(e) => { if (e.target.value) setActiveProjectId(e.target.value); }}
            >
              <option value="" disabled>-- Choisir un projet --</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.client ? ` (${p.client})` : ''}
                </option>
              ))}
            </select>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Skeleton loader ───────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="agri-dashboard">
        <div className="agri-header">
          <h1 className="agri-header-title">
            <Sprout size={32} color="#10b981" />
            Tableau de Bord Agronomique
          </h1>
        </div>
        <div className="agri-loading-overlay">
          <motion.div
            className="agri-loading-spinner"
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          >
            <RefreshCw size={32} color="#10b981" />
          </motion.div>
          <p className="agri-loading-label">Chargement des parcelles de <strong>{project.name}</strong>…</p>
        </div>
      </div>
    );
  }

  // ── Dashboard principal ───────────────────────────────────────────────────
  return (
    <div className="agri-dashboard">
      {/* Header avec switcher de projet */}
      <div className="agri-header">
        <h1 className="agri-header-title">
          <Sprout size={32} color="#10b981" />
          Tableau de Bord Agronomique
        </h1>

        <div className="agri-header-actions">
          {/* Bouton Refresh */}
          <motion.button
            className="agri-refresh-btn"
            onClick={refresh}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="Actualiser les données"
          >
            <RefreshCw size={16} />
          </motion.button>

          {/* Switcher projet */}
          <div className="agri-project-selector-dropdown-wrapper">
            <span className="agri-project-selector-label">Projet :</span>
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
      </div>

      {/* Bandeau projet actif */}
      <div className="agri-project-selector-wrapper">
        <div className="agri-project-active-badge">
          <FolderHeart size={16} color="#10b981" />
          <span>Supervision agronomique : <strong>{project.name}</strong></span>
        </div>

        {/* Badge "Données de démonstration" si mock */}
        {isMock && (
          <motion.div
            className="agri-mock-badge"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <Database size={13} />
            <span>Données de démonstration — Aucune parcelle enregistrée pour ce projet</span>
          </motion.div>
        )}

        {/* Alerte erreur réseau non bloquante */}
        {error && !isMock && (
          <motion.div className="agri-error-badge" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Info size={13} />
            <span>{error}</span>
          </motion.div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="agri-stats-grid">
        <motion.div
          className="agri-stat-card"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="agri-stat-label">Surface Cultivée (Total)</div>
          <div className="agri-stat-value">
            {totalArea} <span className="agri-stat-unit"> Hectares</span>
          </div>
        </motion.div>

        <motion.div
          className="agri-stat-card"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <div className="agri-stat-label">
            Récolte Prévisionnelle
            {isLoadingAnalytics && <span className="agri-stat-loading">…</span>}
          </div>
          <div className="agri-stat-value">
            {totalYield.toLocaleString()} <span className="agri-stat-unit"> Tonnes</span>
          </div>
          <Activity size={24} color="#10b981" style={{ position: 'absolute', right: 24, top: 24, opacity: 0.2 }} />
        </motion.div>

        <motion.div
          className="agri-stat-card warning"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <div className="agri-stat-label">Alertes Phytosanitaires (High)</div>
          <div className="agri-stat-value" style={{ color: '#d97706' }}>
            {criticalThreatsCount} <span className="agri-stat-unit" style={{ color: '#d97706', opacity: 0.8 }}> parcelles menacées</span>
          </div>
          <AlertCircle size={24} color="#d97706" style={{ position: 'absolute', right: 24, top: 24, opacity: 0.2 }} />
        </motion.div>
      </div>

      {/* Liste des parcelles */}
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
        Suivi des Parcelles en Temps Réel
        <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: '0.75rem' }}>
          ({fields.length} parcelle{fields.length !== 1 ? 's' : ''})
        </span>
      </h2>

      <div className="agri-fields-grid">
        {fields.map((field, idx) => (
          <motion.div
            key={field.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: idx * 0.08 }}
          >
            <SmartFieldCard
              field={field}
              analytics={analytics[field.id] || null}
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Fields;
