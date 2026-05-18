import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Droplets, Leaf, Sprout } from 'lucide-react';

export interface FieldAnalytics {
  fieldId: string;
  yieldPrediction?: {
    predictedYieldPerHa: number;
    totalPredictedYield: number;
    confidenceScore: number;
  };
  waterRequirements?: {
    dailyWaterNeedLiters: number;
    recommendation: string;
  };
  fertilizerNeeds?: {
    totalRequirementsKg: { Nitrogen: number; Phosphorus: number; Potassium: number };
    recommendedMix: string;
  };
  pestAndDiseaseRisk?: {
    riskLevel: string;
    identifiedThreats: string[];
    surveillanceRecommendation: string;
  };
}

export interface SmartFieldCardProps {
  field: any;
  analytics?: FieldAnalytics | null;
}

const CROP_ICONS: Record<string, string> = {
  corn: '🌽', tomato: '🍅', chili: '🌶️', bell_pepper: '🫑',
  onion: '🧅', cucumber: '🥒', watermelon: '🍉', peanut: '🥜',
  rice: '🌾', wheat: '🌾', cassava: '🥔', yam: '🥔', sweet_potato: '🍠',
  cotton: '☁️', cocoa: '🍫', coffee: '☕', papaya: '🍈'
};

export const SmartFieldCard: React.FC<SmartFieldCardProps> = ({ field, analytics }) => {
  const cropType = field.domainData?.cropType?.toLowerCase() || 'unknown';
  const icon = CROP_ICONS[cropType] || '🌱';

  const riskLevel = analytics?.pestAndDiseaseRisk?.riskLevel || 'Low';
  const isHighRisk = riskLevel === 'High';

  return (
    <motion.div 
      className="smart-field-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      whileHover={{ y: -5 }}
    >
      <div className="sfc-header">
        <div className="sfc-title-group">
          <div className="sfc-icon">{icon}</div>
          <div>
            <h3 className="sfc-title">{field.name}</h3>
            <span className="sfc-subtitle">{field.domainData?.area} Ha • {field.domainData?.soilType}</span>
          </div>
        </div>
        <div className={`sfc-status ${field.status}`}>
          {field.status}
        </div>
      </div>

      <div className="sfc-indicators">
        {/* Yield Prediction */}
        <div className="sfc-indicator-row">
          <span className="sfc-indicator-label">
            <Sprout size={16} color="#10b981"/> Rendement Est.
          </span>
          <span className="sfc-indicator-value">
            {analytics?.yieldPrediction?.totalPredictedYield 
              ? `${analytics.yieldPrediction.totalPredictedYield.toFixed(1)} T` 
              : 'Calcul...'}
          </span>
        </div>
        {analytics?.yieldPrediction && (
          <div className="sfc-progress-bg">
            <motion.div 
              className="sfc-progress-fill" 
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (analytics.yieldPrediction.totalPredictedYield / (field.domainData.area * 5)) * 100)}%` }}
              transition={{ duration: 1, delay: 0.2 }}
            />
          </div>
        )}

        {/* Water Requirement */}
        <div className="sfc-indicator-row" style={{ marginTop: '0.5rem' }}>
          <span className="sfc-indicator-label">
            <Droplets size={16} color="#3b82f6"/> Besoin en Eau
          </span>
          <span className="sfc-indicator-value">
            {analytics?.waterRequirements?.dailyWaterNeedLiters 
              ? `${Math.round(analytics.waterRequirements.dailyWaterNeedLiters).toLocaleString()} L/j` 
              : 'N/A'}
          </span>
        </div>

        {/* NPK Needs */}
        <div className="sfc-indicator-row">
          <span className="sfc-indicator-label">
            <Leaf size={16} color="#8b5cf6"/> Engrais NPK
          </span>
          <span className="sfc-indicator-value" style={{ fontSize: '0.75rem', maxWidth: '120px', textAlign: 'right' }}>
            {analytics?.fertilizerNeeds?.totalRequirementsKg 
              ? `${analytics.fertilizerNeeds.totalRequirementsKg.Nitrogen}N - ${analytics.fertilizerNeeds.totalRequirementsKg.Phosphorus}P - ${analytics.fertilizerNeeds.totalRequirementsKg.Potassium}K` 
              : 'N/A'}
          </span>
        </div>
      </div>

      {/* Threats / Alerts */}
      <AnimatePresence>
        {isHighRisk && analytics?.pestAndDiseaseRisk?.identifiedThreats && (
          <motion.div 
            className="sfc-alert"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
          >
            <AlertTriangle className="sfc-alert-icon" />
            <div className="sfc-alert-text">
              Alerte: {analytics.pestAndDiseaseRisk.identifiedThreats.join(', ')}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
