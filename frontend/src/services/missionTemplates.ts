 
import type { MissionOrderData, MissionMember } from '../pages/mission/core/missionTypes';

export const MISSION_TEMPLATES = {
  electrification: {
    name: 'Électrification Rurale',
    description: 'Prospection et préparation électrification villages',
    template: {
      purpose: 'Préparation mission électrification - Prospection, audit social et relevés GPS',
      itineraryAller: 'Dakar -> Région cible',
      itineraryRetour: 'Région cible -> Dakar',
      transport: 'Véhicule 4x4 - Pick-up',
      planning: [
        "Jour 1 : Mobilisation & Briefing\n• Départ matinal depuis Dakar\n• Installation bases vie\n• Préparation des axes avec l'équipe locale",
        'Jour 2 : Prospection\n• Repérage des grappes\n• Audit accès routier\n• Photos état initial des sites\n• Identification lieux stockage\n• Sensibilisation chefs villages\n• Mesures distances axes routiers\n• Repérage lieu de Formation\n• Diagnostic des typologies d’habitation',
        'Jour 3 : Prospection\n• Repérage des grappes\n• Audit accès routier\n• Photos état initial des sites\n• Identification lieux stockage\n• Sensibilisation chefs villages\n• Mesures distances axes routiers\n• Documentation contraintes terrain\n• Diagnostic des typologies d’habitation',
        "Jour 4 : Négociations Entrepreneurs et électricien\n• Séance d'imprégnation sur le projet\n• Clarifier normes qualité et cahier de charge\n• Recueil des engagements",
        'Jour 5 : Consolidation & Finalisation Terrain\n• Upload des données SIG et photos\n• Séance de synthèse avec les autorités locales\n• Préparation des documents de synthèse',
        'Jour 6 : Repli vers Dakar\n• Inventaire final\n• Débriefing direction\n• Préparation rapport',
      ],
    } as Partial<MissionOrderData>,
  },
  audit_social: {
    name: 'Audit Social Communauté',
    description: 'Enquête socio-économique et consultation communautaire',
    template: {
      purpose: 'Audit social et consultation des communautés pour évaluation inclusivité du projet',
      itineraryAller: 'Dakar -> Zone projet',
      itineraryRetour: 'Zone projet -> Dakar',
      transport: 'Véhicule tout terrain',
      planning: [
        'Jour 1 : Accueil & Mobilisation\n• Arrivée et installation\n• Rencontre autorités/chefs villages\n• Présentation objectifs audit\n• Restitution calendrier prévu',
        'Jour 2 : Entretiens Ménages (Lot 1)\n• Visite 30-40 ménages\n• Questionnaire socio-économique\n• Photographie caractéristiques habitat\n• Documentation accès électricité actuelle',
        'Jour 3 : Entretiens Ménages (Lot 2)\n• Visite supplémentaires zones périphériques\n• Identification ménages vulnérables\n• Enquête sur besoins énergétiques\n• Collect contacts référents communautaires',
        "Jour 4 : Focus Groups & Sensibilisation\n• Groupes discussion femmes & jeunes\n• Sensibilisation tarification/paiement\n• Rôle système d'exploitation\n• Genre et droits fonciers",
        'Jour 5 : Synthèse & Recommandation\n• Consolidation données collectées\n• Analyse résultats audit\n• Proposition mesures inclusivité\n• Restitution préliminaire communautés',
        'Jour 6 : Finalisation & Retour\n• Compilation rapports finaux\n• Upload données serveur\n• Débriefing management\n• Trajet retour Dakar',
      ],
    } as Partial<MissionOrderData>,
  },
  supervision_travaux: {
    name: 'Supervision Travaux',
    description: "Supervision et contrôle qualité des travaux d'installation",
    template: {
      purpose:
        "Supervision des travaux d'installation infrastructure électrique - Contrôle qualité et respect délais",
      itineraryAller: 'Dakar -> Sites travaux',
      itineraryRetour: 'Sites travaux -> Dakar',
      transport: 'Véhicule léger + équipement mesure',
      planning: [
        'Jour 1 : Installation & Reconnaissance\n• Arrivée sites travaux\n• Tour de reconnaissance équipes exécution\n• Rencontre chef chantier\n• Revue planning travaux et normes',
        'Jour 2 : Contrôle Fondations & Génie Civil\n• Inspection fondations poteaux\n• Mesure profondeurs fouilles\n• Vérification qualité béton\n• Documentation non-conformités identifiées',
        'Jour 3 : Inspection Installation Électrique\n• Vérification câblage et jonctions\n• Test continuité circuits\n• Mesure isolement et tensions\n• Photos documentation travaux en cours',
        'Jour 4 : Tests & Mise sous Tension\n• Essais de charge circuits\n• Vérification protections différentielles\n• Mesure puissance distribuée\n• Test stabilité tension',
        'Jour 5 : Formation Utilisateurs & Clôture\n• Formation exploitation techniciens\n• Transmission clés comptes clients\n• Constitution dossier as-built\n• Signature PV acceptation travaux',
        'Jour 6 : Retour & Rapportage\n• Compilation rapport supervision\n• Upload photos et mesures\n• Débriefing équipe direction\n• Trajet retour',
      ],
    } as Partial<MissionOrderData>,
  },
  formation_technique: {
    name: 'Formation Technique',
    description: 'Formation des équipes locales opérations et maintenance',
    template: {
      purpose: 'Formation technique des techniciens locaux - Opération maintenance et dépannage',
      itineraryAller: 'Dakar -> Centre formation',
      itineraryRetour: 'Centre formation -> Dakar',
      transport: 'Véhicule formation roulant',
      planning: [
        'Jour 1 : Accueil & Appréciation Besoins\n• Tour technique installation existante\n• Entretien avec responsables locaux\n• Test connaissances initiales stagiaires\n• Définition programme adapté',
        "Jour 2 : Théorie Électricité Générale\n• Fondamentaux sécurité électrique\n• Circuits CC et CA\n• Loi d'Ohm et puissance\n• Réglementation électricité Sénégal",
        'Jour 3 : Théorie Systèmes Solaires & Batterie\n• Architecture systèmes PV\n• Fonctionnement modules et onduleurs\n• Gestion batteries lithium-plomb\n• Monitoring et métrologie',
        'Jour 4 : Travaux Pratiques Installation\n• Montage démontage équipements\n• Mesure et câblage sous supervision\n• Tests sous charge\n• Pratique maintenance préventive',
        'Jour 5 : Dépannage & Cas Pratiques\n• Diagnostic pannes courantes\n• Résolution cas problématiques\n• Réglage protections\n• Utilisation outils diagnostic',
        'Jour 6 : Certification & Retour\n• Examen pratique et théorique\n• Remise certification.\n• Distribution matériels sensibilisation\n• Trajet retour',
      ],
    } as Partial<MissionOrderData>,
  },
};

export type TemplateKey = keyof typeof MISSION_TEMPLATES;

export const getTemplates = () => {
  return Object.entries(MISSION_TEMPLATES).map(([key, value]) => ({
    id: key,
    name: value.name,
    description: value.description,
  }));
};

export const getTemplateById = (templateId: TemplateKey) => {
  return MISSION_TEMPLATES[templateId];
};

export const createMissionFromTemplate = (
  templateId: TemplateKey,
  overrides?: Partial<MissionOrderData>
): {
  formData: Partial<MissionOrderData>;
  members: MissionMember[];
} => {
  const template = getTemplateById(templateId);
  if (!template) {
    throw new Error(`Template ${templateId} not found`);
  }

  const formData: Partial<MissionOrderData> = {
    ...template.template,
    orderNumber: `${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${String(new Date().getDate()).padStart(2, '0')}`,
    date: new Date().toLocaleDateString('fr-FR'),
    region: 'Sénégal',
    startDate: new Date().toLocaleDateString('fr-FR'),
    endDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR'),
    ...overrides,
  };

  const members: MissionMember[] = [];

  return { formData, members };
};

export const duplicateMission = (
  originalData: Partial<MissionOrderData>,
  originalMembers: MissionMember[]
): {
  formData: Partial<MissionOrderData>;
  members: MissionMember[];
} => {
  // Incrémenter le numéro d'ordre
  const oldOrderNumber = originalData.orderNumber || '01/2026';
  const [num, year] = oldOrderNumber.split('/');
  const newNum = (parseInt(num) + 1).toString().padStart(2, '0');
  const newOrderNumber = `${newNum}/${year}`;

  // Copier et réinitialiser les champs de rapport
  const formData: Partial<MissionOrderData> = {
    ...originalData,
    orderNumber: newOrderNumber,
    date: new Date().toLocaleDateString('fr-FR'),
    startDate: new Date().toLocaleDateString('fr-FR'),
    endDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR'),
    reportDays: undefined, // Nettoyer rapport
    reportObservations: undefined,
    signatureImage: undefined,
    isCertified: false,
    expenses: undefined,
    inventory: undefined,
  };

  // Copier les membres
  const members = originalMembers.map((m) => ({ ...m }));

  return { formData, members };
};

export const exportMissionAsJSON = (
  data: Partial<MissionOrderData>,
  members: MissionMember[],
  filename?: string
): void => {
  const missionExport = {
    formatVersion: '1.0',
    exportDate: new Date().toISOString(),
    mission: { ...data },
    members,
  };

  const json = JSON.stringify(missionExport, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `mission_${data.orderNumber?.replace('/', '_')}_${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
};

export const importMissionFromJSON = async (
  file: File
): Promise<{
  data: Partial<MissionOrderData>;
  members: MissionMember[];
}> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const imported = JSON.parse(content);
        resolve({
          data: imported.mission,
          members: imported.members || [],
        });
      } catch {
        reject(new Error('Erreur lecture fichier JSON'));
      }
    };
    reader.onerror = () => reject(new Error('Erreur lecture fichier'));
    reader.readAsText(file);
  });
};
