/**
 * useFieldsData — Hook de données agronomiques avec connexion API réelle.
 * Supporte le fallback sur des données mock si le projet n'a pas encore
 * de parcelles créées en base.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import apiClient from '../../../api/client';
import type { FieldAnalytics } from '../components/SmartFieldCard';

export interface Field {
  id: string;
  name: string;
  status: string;
  projectId?: string;
  organizationId?: string;
  domainData: {
    cropType?: string;
    area?: number;
    soilType?: string;
    waterSource?: string;
    [key: string]: any;
  };
}

export interface FieldsDataState {
  fields: Field[];
  analytics: Record<string, FieldAnalytics>;
  isLoading: boolean;
  isLoadingAnalytics: boolean;
  error: string | null;
  isMock: boolean;
  refresh: () => void;
}

// Données mock de démonstration (fallback si 0 parcelles en DB)
const MOCK_FIELDS: Field[] = [
  {
    id: 'mock-f1',
    name: 'Parcelle Nord - Tomates',
    status: 'growing',
    domainData: { cropType: 'tomato', area: 2.5, soilType: 'sandy', waterSource: 'irrigation_drip' }
  },
  {
    id: 'mock-f2',
    name: 'Champ Principal - Maïs',
    status: 'growing',
    domainData: { cropType: 'corn', area: 10, soilType: 'clay', waterSource: 'rainfed' }
  },
  {
    id: 'mock-f3',
    name: 'Contre-saison - Oignons',
    status: 'prepared',
    domainData: { cropType: 'onion', area: 1.5, soilType: 'loam', waterSource: 'irrigation_drip' }
  },
  {
    id: 'mock-f4',
    name: 'Rente - Cacao',
    status: 'growing',
    domainData: { cropType: 'cocoa', area: 5, soilType: 'clay', waterSource: 'rainfed' }
  }
];

const MOCK_ANALYTICS: Record<string, FieldAnalytics> = {
  'mock-f1': {
    fieldId: 'mock-f1',
    yieldPrediction: { predictedYieldPerHa: 30, totalPredictedYield: 75, confidenceScore: 0.9 },
    waterRequirements: { dailyWaterNeedLiters: 112500, recommendation: '' },
    fertilizerNeeds: { totalRequirementsKg: { Nitrogen: 360, Phosphorus: 240, Potassium: 450 }, recommendedMix: '' },
    pestAndDiseaseRisk: { riskLevel: 'High', identifiedThreats: ['Tuta absoluta', 'Mouches blanches'], surveillanceRecommendation: '' }
  },
  'mock-f2': {
    fieldId: 'mock-f2',
    yieldPrediction: { predictedYieldPerHa: 4.5, totalPredictedYield: 45, confidenceScore: 0.8 },
    waterRequirements: { dailyWaterNeedLiters: 450000, recommendation: '' },
    fertilizerNeeds: { totalRequirementsKg: { Nitrogen: 1080, Phosphorus: 540, Potassium: 720 }, recommendedMix: '' },
    pestAndDiseaseRisk: { riskLevel: 'High', identifiedThreats: ['Chenille Légionnaire'], surveillanceRecommendation: '' }
  },
  'mock-f3': {
    fieldId: 'mock-f3',
    yieldPrediction: { predictedYieldPerHa: 30, totalPredictedYield: 45, confidenceScore: 0.85 },
    waterRequirements: { dailyWaterNeedLiters: 67500, recommendation: '' },
    fertilizerNeeds: { totalRequirementsKg: { Nitrogen: 150, Phosphorus: 90, Potassium: 150 }, recommendedMix: '' },
    pestAndDiseaseRisk: { riskLevel: 'Medium', identifiedThreats: ["Thrips de l'oignon"], surveillanceRecommendation: '' }
  },
  'mock-f4': {
    fieldId: 'mock-f4',
    yieldPrediction: { predictedYieldPerHa: 0.8, totalPredictedYield: 4, confidenceScore: 0.75 },
    waterRequirements: { dailyWaterNeedLiters: 225000, recommendation: '' },
    fertilizerNeeds: { totalRequirementsKg: { Nitrogen: 225, Phosphorus: 135, Potassium: 360 }, recommendedMix: '' },
    pestAndDiseaseRisk: { riskLevel: 'High', identifiedThreats: ['Pourriture brune des cabosses'], surveillanceRecommendation: '' }
  }
};

export function useFieldsData(projectId: string | null | undefined): FieldsDataState {
  const [fields, setFields] = useState<Field[]>([]);
  const [analytics, setAnalytics] = useState<Record<string, FieldAnalytics>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMock, setIsMock] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const fetchFields = useCallback(async () => {
    if (!projectId) return;

    // Cancel previous in-flight request
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.get('/fields', {
        params: { projectId },
        signal: abortRef.current.signal,
      });

      const apiFields: Field[] = response.data || [];

      if (apiFields.length === 0) {
        // Aucune parcelle en DB → on tombe sur les mocks de démo
        setFields(MOCK_FIELDS);
        setAnalytics(MOCK_ANALYTICS);
        setIsMock(true);
        return;
      }

      setFields(apiFields);
      setIsMock(false);

      // Charger les analytics pour chaque parcelle en parallèle (max 4 simultanés)
      setIsLoadingAnalytics(true);
      const BATCH = 4;
      const analyticsMap: Record<string, FieldAnalytics> = {};

      for (let i = 0; i < apiFields.length; i += BATCH) {
        const batch = apiFields.slice(i, i + BATCH);
        const results = await Promise.allSettled(
          batch.map((f) =>
            apiClient
              .get(`/fields/${f.id}/analytics`)
              .then((r) => ({ id: f.id, data: r.data as FieldAnalytics }))
          )
        );

        for (const r of results) {
          if (r.status === 'fulfilled') {
            analyticsMap[r.value.id] = r.value.data;
          }
        }
      }

      setAnalytics(analyticsMap);
    } catch (err: any) {
      if (err?.code === 'ERR_CANCELED') return; // ignore abort
      // En cas d'erreur réseau (ex: module agriculture non activé), on tombe sur les mocks
      setFields(MOCK_FIELDS);
      setAnalytics(MOCK_ANALYTICS);
      setIsMock(true);
      setError(err?.response?.data?.error || err?.message || 'Erreur de chargement des parcelles');
    } finally {
      setIsLoading(false);
      setIsLoadingAnalytics(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchFields();
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchFields]);

  return { fields, analytics, isLoading, isLoadingAnalytics, error, isMock, refresh: fetchFields };
}
