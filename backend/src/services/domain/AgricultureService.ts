import prisma from '../../core/utils/prisma.js';
import { DomainConfigService } from './DomainConfigService.js';
import { DomainAdapterFactory } from '../../domain-adapters/DomainAdapterFactory.js';
import eventBus from '../../core/utils/eventBus.js';

export class AgricultureService {
  /**
   * Complex Yield Prediction Logic
   * Calcule le rendement prédictif d'une parcelle en fonction de ses paramètres
   */
  static async calculatePredictedYield(fieldId: string): Promise<any> {
    const field = await prisma.field.findUnique({ where: { id: fieldId } });
    if (!field) throw new Error('Field not found');

    const d = field.domainData as any;
    if (!d || !d.cropType || !d.area) return null;

    // Constantes agronomiques fictives pour le modèle
    const cropYieldPotential: Record<string, number> = {
      // Céréales
      'corn': 4.5,     // Tonnes/Ha (Ajusté Afrique: 3 à 6 t/ha)
      'wheat': 4.2,    // Blé
      'rice': 5.5,     // Riz (Ajusté: 4 à 7 t/ha)
      'sorghum': 2.5,  // Sorgho
      'millet': 1.8,   // Mil
      // Tubercules & Racines
      'cassava': 22.5, // Manioc (Ajusté: 15 à 30 t/ha)
      'yam': 15.0,     // Igname
      'sweet_potato': 12.0, // Patate douce
      // Légumineuses
      'soybean': 3.1,  // Soja
      'peanut': 2.0,   // Arachide (Ajusté: 1.5 à 2.5 t/ha)
      'cowpea': 1.5,   // Niébé (Ajusté: 1 à 2 t/ha)
      // Maraîchage (Nouveau)
      'chili': 7.5,    // Piment (5 à 10 t/ha)
      'okra': 11.5,    // Gombo (8 à 15 t/ha)
      'tomato': 30.0,  // Tomate (20 à 40 t/ha)
      'onion': 30.0,   // Oignon (25 à 35 t/ha)
      'cucumber': 20.0,// Concombre (15 à 25 t/ha)
      'bell_pepper': 16.0, // Poivron (12 à 20 t/ha)
      // Fruits & Cultures de Rente (Cash Crops)
      'cotton': 1.2,   // Coton
      'cocoa': 0.8,    // Cacao
      'coffee': 1.0,   // Café
      'cashew': 0.6,   // Anacarde (noix)
      'sesame': 0.8,   // Sésame
      'plantain': 18.0,// Banane Plantain
      'papaya': 40.0,  // Papaye (30 à 50 t/ha)
      'watermelon': 27.5 // Pastèque (20 à 35 t/ha)
    };

    const baseYield = cropYieldPotential[d.cropType.toLowerCase()] || 3.0;
    
    // Facteurs de réduction/augmentation basés sur la qualité du sol et l'eau
    let soilFactor = 1.0;
    if (d.soilType === 'clay') soilFactor = 1.1;
    if (d.soilType === 'sandy') soilFactor = 0.8;

    let waterFactor = 1.0;
    if (d.waterSource === 'irrigation_drip') waterFactor = 1.2;
    if (d.waterSource === 'rainfed') waterFactor = 0.7;

    // Calcul du rendement total estimé
    const predictedYieldPerHa = baseYield * soilFactor * waterFactor;
    const totalPredictedYield = predictedYieldPerHa * d.area;

    // Mise à jour de l'entité
    const updatedDomainData = {
      ...d,
      predictedYieldPerHa,
      totalPredictedYield,
      yieldCalculationDate: new Date().toISOString()
    };

    await prisma.field.update({
      where: { id: fieldId },
      data: { domainData: updatedDomainData }
    });

    return {
      predictedYieldPerHa,
      totalPredictedYield,
      confidenceScore: 0.85
    };
  }

  /**
   * Calcul des besoins en eau (Evapotranspiration)
   */
  static async calculateWaterRequirements(fieldId: string): Promise<any> {
    const field = await prisma.field.findUnique({ where: { id: fieldId } });
    if (!field) throw new Error('Field not found');
    const d = field.domainData as any;

    const baseETc = 4.5; // mm/jour en moyenne
    const cropCoefficient = d.cropType === 'rice' ? 1.2 : 0.8;
    
    const dailyWaterNeedMM = baseETc * cropCoefficient;
    const dailyWaterNeedLiters = dailyWaterNeedMM * (d.area * 10000); // 1mm sur 1m² = 1 litre

    return {
      dailyWaterNeedMM,
      dailyWaterNeedLiters,
      recommendation: `Appliquer ${Math.round(dailyWaterNeedLiters)} L d'eau par jour pour la surface totale.`
    };
  }

  /**
   * Recommandation de rotation des cultures (Crop Rotation)
   */
  static async getCropRotationRecommendations(fieldId: string): Promise<any> {
    const field = await prisma.field.findUnique({ where: { id: fieldId } });
    if (!field) throw new Error('Field not found');
    const d = field.domainData as any;

    const rotationLogic: Record<string, string[]> = {
      'corn': ['soybean', 'cowpea', 'peanut'], // Fixateurs d'azote après le maïs
      'sorghum': ['cowpea', 'peanut', 'sesame'], // Sorgho suivi de légumineuses locales
      'millet': ['cowpea', 'peanut'], // Mil suivi de niébé ou arachide
      'wheat': ['mustard', 'canola', 'legumes'],
      'peanut': ['corn', 'sorghum', 'millet', 'cotton', 'watermelon'], // Prépare le sol
      'cowpea': ['corn', 'sorghum', 'millet', 'okra'], // Niébé enrichit
      'soybean': ['corn', 'cotton'],
      'rice': ['vegetables', 'soybean', 'cowpea', 'onion'], // Riz suivi de maraîchage
      'cassava': ['peanut', 'cowpea', 'corn'], // Repos du sol après le manioc
      'yam': ['sorghum', 'corn', 'legumes'],
      'cotton': ['corn', 'sorghum', 'peanut'], // Coton est très épuisant
      'sesame': ['sorghum', 'millet', 'peanut'],
      'tomato': ['onion', 'corn', 'cowpea'], // Ne pas faire suivre de poivron ou pomme de terre (Solanacées)
      'chili': ['onion', 'okra', 'corn'], // Idem tomate
      'bell_pepper': ['onion', 'okra', 'corn'],
      'onion': ['tomato', 'chili', 'bell_pepper', 'rice'], // Excellent précédent
      'cucumber': ['corn', 'cowpea', 'okra'],
      'okra': ['tomato', 'onion', 'chili'],
      'watermelon': ['peanut', 'cowpea', 'corn'] // Bonne rotation avec légumineuses
    };

    const currentCrop = d.cropType ? d.cropType.toLowerCase() : null;
    const nextBestCrops = currentCrop ? rotationLogic[currentCrop] || ['legumes'] : ['any'];

    return {
      currentCrop,
      recommendedNextCrops: nextBestCrops,
      reasoning: 'Alternance fixateurs/consommateurs d\'azote pour préserver la santé des sols et rompre le cycle parasitaire.'
    };
  }

  /**
   * Recommandation d'engrais intelligents (Smart Fertilizer NPK Recommendation)
   */
  static async calculateFertilizerNeeds(fieldId: string): Promise<any> {
    const field = await prisma.field.findUnique({ where: { id: fieldId } });
    if (!field) throw new Error('Field not found');
    const d = field.domainData as any;

    if (!d.cropType || !d.area) return null;

    // Besoins NPK standards (kg / hectare) - Adaptés aux sols africains (moyennes)
    const npkRequirements: Record<string, {N: number, P: number, K: number}> = {
      'corn': { N: 120, P: 60, K: 80 },
      'sorghum': { N: 80, P: 40, K: 40 },
      'millet': { N: 60, P: 30, K: 30 },
      'wheat': { N: 120, P: 50, K: 90 },
      'rice': { N: 100, P: 40, K: 80 },
      'cassava': { N: 80, P: 30, K: 100 }, // Manioc demande beaucoup de potassium (K)
      'yam': { N: 90, P: 50, K: 120 },     // Igname gourmande en potassium
      'sweet_potato': { N: 60, P: 40, K: 100 },
      'soybean': { N: 20, P: 60, K: 80 }, // Fixateur, peu d'azote
      'peanut': { N: 15, P: 40, K: 50 },  // Fixateur (Arachide)
      'cowpea': { N: 10, P: 30, K: 30 },  // Fixateur très efficace (Niébé)
      // Maraîchage
      'tomato': { N: 120, P: 80, K: 150 }, // Tomate très gourmande
      'onion': { N: 100, P: 60, K: 100 },
      'chili': { N: 110, P: 70, K: 120 },
      'bell_pepper': { N: 110, P: 70, K: 120 },
      'cucumber': { N: 90, P: 50, K: 100 },
      'okra': { N: 80, P: 40, K: 60 },
      'watermelon': { N: 80, P: 40, K: 120 }, // Potassium essentiel pour les fruits
      // Cultures de Rente
      'cotton': { N: 100, P: 50, K: 80 }, // Coton très exigeant
      'cocoa': { N: 50, P: 30, K: 80 },
      'coffee': { N: 80, P: 30, K: 100 },
      'plantain': { N: 150, P: 50, K: 200 }, // Plantain très gourmand en K
      'papaya': { N: 130, P: 50, K: 160 },
    };

    const cropReq = npkRequirements[d.cropType.toLowerCase()] || { N: 100, P: 50, K: 50 };
    
    // Ajustement selon le type de sol
    let soilRetention = 1.0;
    if (d.soilType === 'sandy') soilRetention = 1.2; // Lessivage rapide, besoin accru
    if (d.soilType === 'clay') soilRetention = 0.9;  // Bonne rétention

    const totalN = cropReq.N * d.area * soilRetention;
    const totalP = cropReq.P * d.area * soilRetention;
    const totalK = cropReq.K * d.area * soilRetention;

    return {
      totalRequirementsKg: {
        Nitrogen: Math.round(totalN),
        Phosphorus: Math.round(totalP),
        Potassium: Math.round(totalK)
      },
      recommendedMix: `Utiliser un engrais NPK type ${Math.round(cropReq.N/10)}-${Math.round(cropReq.P/10)}-${Math.round(cropReq.K/10)} adapté pour ${d.area} hectares.`,
      warning: d.soilType === 'sandy' ? "Appliquer en plusieurs fractions pour éviter le lessivage." : "Application standard."
    };
  }

  /**
   * Analyse des risques de maladies et ravageurs (Pest & Disease Risk)
   */
  static async assessDiseaseRisk(fieldId: string): Promise<any> {
    const field = await prisma.field.findUnique({ where: { id: fieldId } });
    if (!field) throw new Error('Field not found');
    const d = field.domainData as any;

    let riskLevel = 'Low';
    let threats: string[] = [];
    
    // Exemples de règles expertes adaptées à l'Afrique
    if (d.cropType?.toLowerCase() === 'corn' || d.cropType?.toLowerCase() === 'sorghum') {
      threats.push('Chenille Légionnaire d\'Automne (Fall Armyworm)');
      riskLevel = 'High';
    }
    
    if (d.cropType?.toLowerCase() === 'rice' && d.status === 'growing') {
      threats.push('Pyriculariose (Rice Blast)', 'Cécidomyie du riz (Rice Gall Midge)');
      riskLevel = 'Medium';
    }

    if (d.cropType?.toLowerCase() === 'cassava') {
      threats.push('Mosaïque du Manioc (CMD)', 'Cochenille Farineuse (Cassava Mealybug)');
      riskLevel = 'Medium';
    }

    if (d.cropType?.toLowerCase() === 'cocoa') {
      threats.push('Pourriture brune des cabosses (Black Pod Disease)', 'Swollen Shoot');
      riskLevel = 'High';
    }

    if (d.cropType?.toLowerCase() === 'cotton') {
      threats.push('Ver de la capsule (Bollworm)', 'Pucerons (Aphids)');
      riskLevel = 'High';
    }

    if (d.cropType?.toLowerCase() === 'cowpea' || d.cropType?.toLowerCase() === 'peanut') {
      threats.push('Pucerons (Aphis craccivora)', 'Foreur des gousses (Maruca vitrata)');
      riskLevel = 'Medium';
    }

    if (d.cropType?.toLowerCase() === 'tomato' || d.cropType?.toLowerCase() === 'bell_pepper' || d.cropType?.toLowerCase() === 'chili') {
      threats.push('Tuta absoluta', 'Mouches blanches (Whiteflies)', 'Nématodes à galles');
      riskLevel = 'High';
    }

    if (d.cropType?.toLowerCase() === 'onion') {
      threats.push('Thrips de l\'oignon', 'Mildiou');
      riskLevel = 'Medium';
    }

    if (d.cropType?.toLowerCase() === 'watermelon' || d.cropType?.toLowerCase() === 'cucumber') {
      threats.push('Oïdium', 'Mildiou (Downy Mildew)', 'Mouches des fruits');
      riskLevel = 'Medium';
    }

    if (d.cropType?.toLowerCase() === 'papaya') {
      threats.push('Cochenille de la papaye', 'Virus des taches en anneaux (PRSV)');
      riskLevel = 'Medium';
    }

    return {
      riskLevel,
      identifiedThreats: threats,
      surveillanceRecommendation: riskLevel === 'High' ? "Scouting hebdomadaire obligatoire." : "Surveillance mensuelle."
    };
  }

  /**
   * Créer une parcelle via l'Adapter (Uniformité)
   */
  static async createField(organizationId: string, projectId: string, rawData: any) {
    const adapter = DomainAdapterFactory.getAdapter('agriculture');
    const normalized = await adapter.normalizeEntity(rawData);
    
    const validationErrors = adapter.validateEntity(normalized);
    if (validationErrors.length > 0) {
      throw new Error(`Validation failed: ${JSON.stringify(validationErrors)}`);
    }

    const alerts = adapter.generateAlerts(normalized);
    const status = adapter.deriveStatus(normalized);

    const field = await prisma.field.create({
      data: {
        id: normalized.id,
        organizationId,
        projectId,
        name: normalized.name,
        location: normalized.location,
        domainData: normalized.domainData,
        status: status,
        alerts: alerts,
      }
    });

    eventBus.emit('agriculture:field_created', field);

    // Lancer les calculs asynchrones post-création si la culture est définie
    if (normalized.domainData.cropType && normalized.domainData.area) {
      setTimeout(() => {
        this.calculatePredictedYield(field.id).catch(console.error);
      }, 1000);
    }

    return field;
  }
}
