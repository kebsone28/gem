import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sprout, Activity, AlertCircle, FolderHeart } from 'lucide-react';
import '../styles/agriculture.css';
import { SmartFieldCard } from '../components/SmartFieldCard';
import type { FieldAnalytics } from '../components/SmartFieldCard';
import { useAuth } from '../../../contexts/AuthContext';
import { useProject } from '../../../contexts/ProjectContext';

// Services ou hooks hypothétiques (mockés ici pour l'intégration visuelle rapide)
// Dans une implémentation réelle, on utiliserait le token d'AuthContext pour fetcher `/api/fields`
const mockFields = [
  {
    id: 'f1',
    name: 'Parcelle Nord - Tomates',
    status: 'growing',
    domainData: { cropType: 'tomato', area: 2.5, soilType: 'sandy', waterSource: 'irrigation_drip' }
  },
  {
    id: 'f2',
    name: 'Champ Principal - Maïs',
    status: 'growing',
    domainData: { cropType: 'corn', area: 10, soilType: 'clay', waterSource: 'rainfed' }
  },
  {
    id: 'f3',
    name: 'Contre-saison - Oignons',
    status: 'prepared',
    domainData: { cropType: 'onion', area: 1.5, soilType: 'loam', waterSource: 'irrigation_drip' }
  },
  {
    id: 'f4',
    name: 'Rente - Cacao',
    status: 'growing',
    domainData: { cropType: 'cocoa', area: 5, soilType: 'clay', waterSource: 'rainfed' }
  }
];

const mockAnalytics: Record<string, FieldAnalytics> = {
  'f1': {
    fieldId: 'f1',
    yieldPrediction: { predictedYieldPerHa: 30, totalPredictedYield: 75, confidenceScore: 0.9 },
    waterRequirements: { dailyWaterNeedLiters: 112500, recommendation: '' },
    fertilizerNeeds: { totalRequirementsKg: { Nitrogen: 360, Phosphorus: 240, Potassium: 450 }, recommendedMix: '' },
    pestAndDiseaseRisk: { riskLevel: 'High', identifiedThreats: ['Tuta absoluta', 'Mouches blanches'], surveillanceRecommendation: '' }
  },
  'f2': {
    fieldId: 'f2',
    yieldPrediction: { predictedYieldPerHa: 4.5, totalPredictedYield: 45, confidenceScore: 0.8 },
    waterRequirements: { dailyWaterNeedLiters: 450000, recommendation: '' },
    fertilizerNeeds: { totalRequirementsKg: { Nitrogen: 1080, Phosphorus: 540, Potassium: 720 }, recommendedMix: '' },
    pestAndDiseaseRisk: { riskLevel: 'High', identifiedThreats: ['Chenille Légionnaire'], surveillanceRecommendation: '' }
  },
  'f3': {
    fieldId: 'f3',
    yieldPrediction: { predictedYieldPerHa: 30, totalPredictedYield: 45, confidenceScore: 0.85 },
    waterRequirements: { dailyWaterNeedLiters: 67500, recommendation: '' },
    fertilizerNeeds: { totalRequirementsKg: { Nitrogen: 150, Phosphorus: 90, Potassium: 150 }, recommendedMix: '' },
    pestAndDiseaseRisk: { riskLevel: 'Medium', identifiedThreats: ['Thrips de l\'oignon'], surveillanceRecommendation: '' }
  },
  'f4': {
    fieldId: 'f4',
    yieldPrediction: { predictedYieldPerHa: 0.8, totalPredictedYield: 4, confidenceScore: 0.75 },
    waterRequirements: { dailyWaterNeedLiters: 225000, recommendation: '' },
    fertilizerNeeds: { totalRequirementsKg: { Nitrogen: 225, Phosphorus: 135, Potassium: 360 }, recommendedMix: '' },
    pestAndDiseaseRisk: { riskLevel: 'High', identifiedThreats: ['Pourriture brune des cabosses'], surveillanceRecommendation: '' }
  }
};

export const Fields: React.FC = () => {
  const { user } = useAuth();
  const { project, projects, setActiveProjectId } = useProject();
  const [fields, setFields] = useState(mockFields);
  const [analytics, setAnalytics] = useState(mockAnalytics);
  const [isLoading, setIsLoading] = useState(false);

  const totalArea = fields.reduce((acc, f) => acc + (f.domainData.area || 0), 0);
  const totalYield = Object.values(analytics).reduce((acc, a) => acc + (a.yieldPrediction?.totalPredictedYield || 0), 0);
  const criticalThreatsCount = Object.values(analytics).filter(a => a.pestAndDiseaseRisk?.riskLevel === 'High').length;

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
            Pour visualiser le tableau de bord agronomique (alertes, calculs NPK, besoins en eau et prévisions de rendement), 
            veuillez d'abord sélectionner un projet actif dans la liste ci-dessous :
          </p>

          <div className="agri-required-action-container">
            <label className="agri-required-select-label" htmlFor="required-project-select">
              Sélectionnez un projet de supervision
            </label>
            <select
              id="required-project-select"
              className="agri-required-select"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  setActiveProjectId(e.target.value);
                }
              }}
            >
              <option value="" disabled>-- Choisir un projet --</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.client ? `(${p.client})` : ''}
                </option>
              ))}
            </select>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="agri-dashboard">
      <div className="agri-header">
        <h1 className="agri-header-title">
          <Sprout size={32} color="#10b981" /> 
          Tableau de Bord Agronomique
        </h1>
        
        <div className="agri-project-selector-dropdown-wrapper">
          <span className="agri-project-selector-label">Projet :</span>
          <select
            className="agri-project-select"
            value={project.id}
            onChange={(e) => setActiveProjectId(e.target.value)}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="agri-project-selector-wrapper">
        <div className="agri-project-active-badge">
          <FolderHeart size={16} color="#10b981" />
          <span>Projet en cours de supervision agronomique : <strong>{project.name}</strong></span>
        </div>
      </div>

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
          <div className="agri-stat-label">Récolte Prévisionnelle</div>
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

      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
        Suivi des Parcelles en Temps Réel
      </h2>

      <div className="agri-fields-grid">
        {fields.map((field, idx) => (
          <motion.div 
            key={field.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: idx * 0.1 }}
          >
            <SmartFieldCard 
              field={field} 
              analytics={analytics[field.id]} 
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Fields;
