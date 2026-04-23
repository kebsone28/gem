export type FormationExpertActionId =
  | 'set_start_date_today'
  | 'select_seed_regions'
  | 'seed_region_participants'
  | 'select_default_modules'
  | 'seed_trainers'
  | 'seed_rooms'
  | 'set_equipment_default'
  | 'generate_plan';

export interface FormationExpertSnapshot {
  startDate: string;
  maxParticipantsPerSession: number;
  includeSaturday: boolean;
  equipmentPool: number;
  deliveryModeConfigured: boolean;
  deliveryMode: 'single' | 'multiple' | null;
  selectedRegionsCount: number;
  participantsPlanned: number;
  prioritizedRegionsCount: number;
  selectedModuleCount: number;
  totalModuleDays: number;
  activeTrainerCount: number;
  activeRoomCount: number;
  roomCapacityMax: number;
  blockedDatesCount: number;
  previewSessionCount: number;
  previewAlertCount: number;
}

export interface FormationExpertRecommendation {
  id: FormationExpertActionId;
  label: string;
  reason: string;
  priority: 'critical' | 'high' | 'medium';
}

export interface FormationExpertReplyOption {
  id: string;
  label: string;
  tone: 'primary' | 'secondary' | 'neutral';
  actionId?: FormationExpertActionId;
  responseTitle: string;
  responseBody: string;
}

export interface FormationExpertQuestion {
  id: string;
  prompt: string;
  why: string;
  blocking: boolean;
  answer: string;
  targetSection: string;
  suggestedActionId?: FormationExpertActionId;
  replyOptions: FormationExpertReplyOption[];
}

export interface FormationExpertGuideStep {
  id: string;
  title: string;
  status: 'done' | 'active' | 'pending';
  description: string;
  question: string;
  answer: string;
  actionId?: FormationExpertActionId;
}

export interface FormationExpertEvaluation {
  readinessScore: number;
  status: 'empty' | 'needs_input' | 'ready_to_generate' | 'generated_with_alerts' | 'healthy';
  headline: string;
  summary: string;
  missingItems: string[];
  strengths: string[];
  alerts: string[];
  nextQuestion: FormationExpertQuestion | null;
  recommendations: FormationExpertRecommendation[];
  guidedFlow: FormationExpertGuideStep[];
}

function boundedScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function evaluateFormationExpert(
  snapshot: FormationExpertSnapshot
): FormationExpertEvaluation {
  const missingItems: string[] = [];
  const strengths: string[] = [];
  const alerts: string[] = [];
  const recommendations: FormationExpertRecommendation[] = [];

  let score = 0;

  if (snapshot.startDate) {
    score += 10;
    strengths.push('Date de démarrage définie');
  } else {
    missingItems.push('Date de démarrage globale');
    recommendations.push({
      id: 'set_start_date_today',
      label: "Définir aujourd'hui",
      reason: 'Le planning ne peut pas être généré sans point de départ.',
      priority: 'critical',
    });
  }

  if (snapshot.selectedRegionsCount > 0) {
    score += 15;
    strengths.push(`${snapshot.selectedRegionsCount} région(s) ciblée(s)`);
  } else {
    missingItems.push('Régions à planifier');
    recommendations.push({
      id: 'select_seed_regions',
      label: 'Préremplir 3 régions',
      reason: 'Le moteur a besoin d’un périmètre géographique initial.',
      priority: 'critical',
    });
  }

  if (snapshot.participantsPlanned > 0) {
    score += 15;
    strengths.push(`${snapshot.participantsPlanned} stagiaire(s) estimé(s)`);
  } else {
    missingItems.push('Effectifs de stagiaires par région');
    recommendations.push({
      id: 'seed_region_participants',
      label: 'Injecter un exemple d’effectifs',
      reason: 'Sans effectif, aucune session ne peut être calculée.',
      priority: 'critical',
    });
  }

  if (snapshot.selectedModuleCount > 0 && snapshot.totalModuleDays > 0) {
    score += 15;
    strengths.push(`${snapshot.selectedModuleCount} module(s) retenu(s)`);
  } else {
    missingItems.push('Modules de formation');
    recommendations.push({
      id: 'select_default_modules',
      label: 'Sélectionner les modules par défaut',
      reason: 'La durée pédagogique manque encore.',
      priority: 'critical',
    });
  }

  if (snapshot.activeTrainerCount > 0) {
    score += 10;
    strengths.push(`${snapshot.activeTrainerCount} formateur(s) actif(s)`);
  } else {
    missingItems.push('Formateurs disponibles');
    recommendations.push({
      id: 'seed_trainers',
      label: 'Ajouter des formateurs',
      reason: 'Aucune session ne peut être affectée sans ressource pédagogique.',
      priority: 'high',
    });
  }

  if (snapshot.activeRoomCount > 0) {
    score += 10;
    strengths.push(`${snapshot.activeRoomCount} salle(s) active(s)`);
  } else {
    missingItems.push('Salles disponibles');
    recommendations.push({
      id: 'seed_rooms',
      label: 'Ajouter des salles',
      reason: 'Le moteur doit pouvoir attribuer un lieu à chaque session.',
      priority: 'high',
    });
  }

  if (snapshot.equipmentPool > 0) {
    score += 10;
    strengths.push(`Stock équipement configuré (${snapshot.equipmentPool})`);
  } else {
    missingItems.push("Stock d'équipements");
    recommendations.push({
      id: 'set_equipment_default',
      label: "Appliquer un stock de base",
      reason: 'Le contrôle logistique a besoin d’un seuil initial.',
      priority: 'high',
    });
  }

  if (snapshot.prioritizedRegionsCount > 0) {
    score += 5;
    strengths.push('Priorités régionales renseignées');
  } else if (snapshot.selectedRegionsCount > 1) {
    alerts.push('Aucune priorité régionale nette: le séquencement sera moins pilotable.');
  }

  if (snapshot.activeRoomCount > 0 && snapshot.roomCapacityMax < snapshot.maxParticipantsPerSession) {
    alerts.push(
      `La plus grande salle (${snapshot.roomCapacityMax}) est inférieure à la capacité cible (${snapshot.maxParticipantsPerSession}).`
    );
  }

  if (snapshot.blockedDatesCount === 0) {
    alerts.push('Aucune date bloquée ni jour férié renseigné.');
  } else {
    score += 5;
  }

  let nextQuestion: FormationExpertQuestion | null = null;
  if (snapshot.selectedRegionsCount === 0 || snapshot.participantsPlanned === 0) {
    nextQuestion = {
      id: 'regional_volumes',
      prompt: 'Combien de stagiaires faut-il former dans chaque région concernée ?',
      why: 'Le planning commence par le périmètre réel: régions actives et volumes à former.',
      blocking: true,
      answer:
        snapshot.selectedRegionsCount === 0
          ? 'Aucune région avec effectif n’est encore définie. Sélectionnez les régions utiles et saisissez le nombre de stagiaires pour chacune.'
          : 'Certaines régions sont déjà choisies, mais les effectifs restent incomplets. Le moteur a besoin des volumes par région pour calculer les sessions.',
      targetSection: 'Régions et effectifs',
      replyOptions: [
        {
          id: 'regional_volumes_manual',
          label: 'Passer en mode manuel',
          tone: 'secondary',
          responseTitle: 'Réponse utilisateur',
          responseBody: 'Je préfère renseigner les régions et les effectifs dans le mode manuel.',
        },
      ],
    };
  } else if (snapshot.selectedModuleCount === 0) {
    nextQuestion = {
      id: 'modules',
      prompt: 'Quels modules doivent composer la formation ?',
      why: 'Le moteur a besoin du contenu pédagogique pour calculer la durée réelle de chaque session.',
      blocking: true,
      answer: 'Aucun module n’est actuellement retenu. Sélectionnez les modules à enseigner pour que la durée du planning puisse être calculée.',
      targetSection: 'Modules',
      replyOptions: [
        {
          id: 'modules_manual',
          label: 'Passer en mode manuel',
          tone: 'secondary',
          responseTitle: 'Réponse utilisateur',
          responseBody: 'Je préfère choisir les modules depuis le mode manuel.',
        },
      ],
    };
  } else if (!snapshot.startDate) {
    nextQuestion = {
      id: 'start_date',
      prompt: 'Quelle est la date de démarrage du planning de formation ?',
      why: 'La date de démarrage sert de point de départ à tout le calendrier.',
      blocking: true,
      answer: 'La date de lancement n’est pas encore définie. Saisissez la date à partir de laquelle le moteur doit commencer à positionner les sessions.',
      targetSection: 'Date de démarrage',
      replyOptions: [
        {
          id: 'start_date_manual',
          label: 'Passer en mode manuel',
          tone: 'secondary',
          responseTitle: 'Réponse utilisateur',
          responseBody: 'Je préfère définir la date de démarrage dans le mode manuel.',
        },
      ],
    };
  } else if (!snapshot.deliveryModeConfigured) {
    nextQuestion = {
      id: 'delivery_mode',
      prompt: 'La formation sera-t-elle animée par un seul formateur ou par plusieurs en parallèle ?',
      why: 'Ce choix détermine si le moteur planifie des sessions séquentielles ou plusieurs sessions en parallèle sur plusieurs salles.',
      blocking: true,
      answer: 'Choisissez le mode de déploiement pédagogique. Un seul formateur produit un déroulé séquentiel. Plusieurs formateurs ouvrent la possibilité de sessions parallèles sur plusieurs salles.',
      targetSection: 'Ressources pédagogiques',
      replyOptions: [
        {
          id: 'delivery_mode_manual',
          label: 'Passer en mode manuel',
          tone: 'secondary',
          responseTitle: 'Réponse utilisateur',
          responseBody: 'Je préfère configurer les formateurs et les salles dans le mode manuel.',
        },
      ],
    };
  } else if (snapshot.activeTrainerCount === 0 || snapshot.activeRoomCount === 0) {
    nextQuestion = {
      id: 'resources',
      prompt: 'Quelles ressources réelles sont disponibles: formateurs et salles ?',
      why: 'Le moteur vérifie les conflits et l’affectation avant génération.',
      blocking: true,
      answer: 'Les ressources sont insuffisantes. Il faut au moins un formateur actif et une salle active pour générer un planning cohérent.',
      targetSection: 'Ressources',
      suggestedActionId:
        snapshot.activeTrainerCount === 0 ? 'seed_trainers' : 'seed_rooms',
      replyOptions: [
        {
          id: 'resources_apply',
          label: 'Oui, compléter les ressources',
          tone: 'primary',
          actionId: snapshot.activeTrainerCount === 0 ? 'seed_trainers' : 'seed_rooms',
          responseTitle: 'Réponse utilisateur',
          responseBody: 'Oui, ajoute une base de ressources pour débloquer la planification.',
        },
        {
          id: 'resources_manual',
          label: 'Corriger manuellement',
          tone: 'secondary',
          responseTitle: 'Réponse utilisateur',
          responseBody: 'Je vais corriger manuellement les ressources terrain.',
        },
        {
          id: 'resources_later',
          label: 'Plus tard',
          tone: 'neutral',
          responseTitle: 'Réponse utilisateur',
          responseBody: 'Je reporte la mise à jour des ressources.',
        },
      ],
    };
  } else if (snapshot.previewSessionCount === 0) {
    nextQuestion = {
      id: 'generate',
      prompt: 'Le cadrage est prêt. Voulez-vous générer le planning automatique maintenant ?',
      why: 'Le moteur a assez d’informations pour produire un premier scénario.',
      blocking: false,
      answer: 'Le cadrage minimal est complet. Vous pouvez lancer la génération automatique pour obtenir un premier planning réaliste.',
      targetSection: 'Validation',
      suggestedActionId: 'generate_plan',
      replyOptions: [
        {
          id: 'generate_apply',
          label: 'Oui, générer le planning',
          tone: 'primary',
          actionId: 'generate_plan',
          responseTitle: 'Réponse utilisateur',
          responseBody: 'Oui, lance la génération automatique maintenant.',
        },
        {
          id: 'generate_review',
          label: 'Vérifier manuellement',
          tone: 'secondary',
          responseTitle: 'Réponse utilisateur',
          responseBody: 'Je préfère vérifier les paramètres une dernière fois avant génération.',
        },
        {
          id: 'generate_later',
          label: 'Plus tard',
          tone: 'neutral',
          responseTitle: 'Réponse utilisateur',
          responseBody: 'Je reporte la génération à plus tard.',
        },
      ],
    };
    recommendations.push({
      id: 'generate_plan',
      label: 'Générer maintenant',
      reason: 'Le paramétrage minimal est prêt pour un premier planning.',
      priority: 'high',
    });
  } else if (snapshot.previewAlertCount > 0) {
    nextQuestion = {
      id: 'resolve_alerts',
      prompt: 'Faut-il corriger les alertes avant validation finale ?',
      why: 'Le planning existe déjà, mais il reste des contraintes à résoudre.',
      blocking: false,
      answer: 'Le planning est généré mais contient encore des alertes. Il faut maintenant arbitrer les capacités, ressources ou dates bloquées.',
      targetSection: 'Alertes et validation',
      replyOptions: [
        {
          id: 'alerts_fix',
          label: 'Oui, corriger les alertes',
          tone: 'primary',
          responseTitle: 'Réponse utilisateur',
          responseBody: 'Oui, je veux traiter les alertes avant validation finale.',
        },
        {
          id: 'alerts_review',
          label: 'Pourquoi ?',
          tone: 'secondary',
          responseTitle: 'Réponse utilisateur',
          responseBody: 'Explique-moi précisément pourquoi ces alertes bloquent la validation.',
        },
        {
          id: 'alerts_later',
          label: 'Plus tard',
          tone: 'neutral',
          responseTitle: 'Réponse utilisateur',
          responseBody: 'Je note ces alertes mais je les traite plus tard.',
        },
      ],
    };
  }

  if (snapshot.previewSessionCount > 0 && snapshot.previewAlertCount === 0) {
    score += 10;
    strengths.push('Planning généré sans alerte bloquante');
  }

  let status: FormationExpertEvaluation['status'] = 'needs_input';
  let headline = 'Assistant métier en attente de cadrage';
  let summary = 'Le moteur identifie les paramètres encore manquants avant planification.';

  if (score === 0) {
    status = 'empty';
    headline = 'Aucun cadrage formation exploitable';
    summary = 'Le moteur n’a pas encore assez d’éléments pour raisonner.';
  } else if (snapshot.previewSessionCount > 0 && snapshot.previewAlertCount === 0) {
    status = 'healthy';
    headline = 'Planning cohérent et exploitable';
    summary = 'Le scénario actuel est suffisamment complet pour être validé ou exporté.';
  } else if (snapshot.previewSessionCount > 0 && snapshot.previewAlertCount > 0) {
    status = 'generated_with_alerts';
    headline = 'Planning généré avec points de vigilance';
    summary = 'Le moteur a produit un scénario, mais certaines contraintes restent à traiter.';
  } else if (
    snapshot.startDate &&
    snapshot.selectedRegionsCount > 0 &&
    snapshot.participantsPlanned > 0 &&
    snapshot.selectedModuleCount > 0 &&
    snapshot.activeTrainerCount > 0 &&
    snapshot.activeRoomCount > 0
  ) {
    status = 'ready_to_generate';
    headline = 'Prêt pour une génération automatique';
    summary = 'Les informations minimales sont présentes pour lancer le planning.';
  }

  return {
    readinessScore: boundedScore(score),
    status,
    headline,
    summary,
    missingItems,
    strengths,
    alerts,
    nextQuestion,
    recommendations: recommendations
      .sort((a, b) => priorityWeight(b.priority) - priorityWeight(a.priority))
      .slice(0, 4),
    guidedFlow: buildGuidedFlow(snapshot),
  };
}

function buildGuidedFlow(snapshot: FormationExpertSnapshot): FormationExpertGuideStep[] {
  const isGenerated = snapshot.previewSessionCount > 0;

  return [
    {
      id: 'step_regions',
      title: '1. Régions et effectifs',
      status:
        snapshot.selectedRegionsCount > 0
          ? snapshot.participantsPlanned > 0
            ? 'done'
            : 'active'
          : 'active',
      description: 'Régions ciblées, priorités et effectifs.',
      question: 'Le moteur sait-il où former et combien de personnes planifier ?',
      answer:
        snapshot.selectedRegionsCount === 0
          ? 'Non. Aucune région n’est encore activée.'
          : snapshot.participantsPlanned === 0
            ? `Partiellement. ${snapshot.selectedRegionsCount} région(s) sont ciblée(s), mais les effectifs sont vides.`
            : `Oui. ${snapshot.selectedRegionsCount} région(s) et ${snapshot.participantsPlanned} stagiaire(s) sont déjà cadrés.`,
      actionId: undefined,
    },
    {
      id: 'step_pedagogy',
      title: '2. Modules',
      status:
        snapshot.selectedModuleCount > 0 && snapshot.totalModuleDays > 0
          ? 'done'
          : snapshot.participantsPlanned > 0
            ? 'active'
            : 'pending',
      description: 'Modules, durée totale et capacité par session.',
      question: 'Le contenu et la durée des sessions sont-ils déjà définis ?',
      answer:
        snapshot.selectedModuleCount > 0
          ? `Oui. ${snapshot.selectedModuleCount} module(s) sont retenu(s) pour ${snapshot.totalModuleDays} jour(s) de formation.`
          : 'Non. Aucun module n’a encore été sélectionné.',
      actionId: undefined,
    },
    {
      id: 'step_cadrage',
      title: '3. Date de démarrage',
      status: snapshot.startDate ? 'done' : snapshot.selectedModuleCount > 0 ? 'active' : 'pending',
      description: 'Date de lancement du planning.',
      question: 'Le point de départ du planning est-il clairement fixé ?',
      answer: snapshot.startDate
        ? `Oui. Le planning démarre le ${snapshot.startDate}.`
        : 'Non. La date de démarrage globale manque encore.',
      actionId: undefined,
    },
    {
      id: 'step_resources',
      title: '4. Organisation formateurs',
      status:
        snapshot.deliveryModeConfigured && snapshot.activeTrainerCount > 0 && snapshot.activeRoomCount > 0
          ? 'done'
          : snapshot.startDate
            ? 'active'
            : 'pending',
      description: 'Un seul formateur ou plusieurs en parallèle.',
      question: 'L’organisation pédagogique permet-elle de générer un planning réaliste ?',
      answer:
        !snapshot.deliveryModeConfigured
          ? 'Non. Le mode un seul formateur ou plusieurs en parallèle n’est pas encore défini.'
          : snapshot.activeTrainerCount > 0 && snapshot.activeRoomCount > 0
            ? `Oui. Mode ${snapshot.deliveryMode === 'multiple' ? 'plusieurs formateurs' : 'un seul formateur'}, ${snapshot.activeTrainerCount} formateur(s), ${snapshot.activeRoomCount} salle(s).`
            : 'Non. Il manque encore des ressources actives pour affecter les sessions.',
      actionId: undefined,
    },
    {
      id: 'step_generation',
      title: '5. Génération et contrôle',
      status:
        isGenerated && snapshot.previewAlertCount === 0
          ? 'done'
          : snapshot.activeTrainerCount > 0 && snapshot.activeRoomCount > 0
            ? 'active'
            : 'pending',
      description: 'Création du planning et lecture des alertes.',
      question: 'Le planning a-t-il été généré et validé sans alerte majeure ?',
      answer:
        !isGenerated
          ? 'Pas encore. Le moteur est prêt à produire un premier scénario dès validation du cadrage.'
          : snapshot.previewAlertCount > 0
            ? `Le planning est généré, mais ${snapshot.previewAlertCount} alerte(s) restent à traiter.`
            : 'Oui. Le planning généré est cohérent et prêt à être validé.',
      actionId: !isGenerated ? 'generate_plan' : undefined,
    },
  ];
}

function priorityWeight(priority: FormationExpertRecommendation['priority']) {
  switch (priority) {
    case 'critical':
      return 3;
    case 'high':
      return 2;
    default:
      return 1;
  }
}
