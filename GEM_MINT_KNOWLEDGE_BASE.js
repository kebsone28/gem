/**
 * BASE DE CONNAISSANCES COMPLÈTE GEM-MINT / PROQUELEC
 * Compilation de toutes les connaissances métier, techniques et procédurales
 */

export const GEM_MINT_KNOWLEDGE_BASE = {
  // CONTEXTE GÉNÉRAL
  contexte_general: {
    entreprise: "PROQUELEC - Société sénégalaise d'électrification de masse",
    application: "GEM-MINT - Gestion Électrification de Masse - Application Bureau",
    objectif: "Électrification nationale via gestion des Ordres de Mission (OM)",
    normes: "NS 01-001 pour installations BT ≤1000V"
  },

  // ARCHITECTURE TECHNIQUE
  architecture: {
    frontend: "React 19 + TypeScript + TailwindCSS 4 + Vite + MapLibre GL JS",
    backend: "Node.js ESM + Express + Prisma 6 + PostgreSQL 16 + PostGIS",
    infra: "Docker + Railway.app + Nginx + Redis",
    stockage: "IndexedDB (frontend) + PostgreSQL (backend)",
    cartographie: "MapLibre GL JS avec Supercluster pour clustering haute performance"
  },

  // WORKFLOW MÉTIER PRINCIPAL
  workflow_missions: {
    etapes: [
      "Création mission OM par ADMIN_PROQUELEC",
      "Validation par CHEF_PROJET",
      "Certification par DIRECTEUR (DG)",
      "Assignation équipes terrain",
      "Collecte données via Kobo Collect",
      "Synchronisation et validation",
      "Paiement indemnités"
    ],
    roles: {
      ADMIN_PROQUELEC: "Création et gestion missions",
      CHEF_PROJET: "Validation technique et budgétaire",
      TECHNICIEN: "Collecte terrain avec Kobo",
      DG: "Certification finale et approbation"
    },
    statuts_menage: [
      "Non débuté",
      "Murs (construction murs)",
      "Réseau (tirage réseau)",
      "Intérieur (installation intérieure)",
      "Contrôle conforme",
      "Ménage non éligible",
      "Problème"
    ]
  },

  // RÈGLES TECHNIQUES (NS 01-001)
  regles_techniques: {
    domaine_application: "Installations BT ≤1000V (alternatif) et ≤1500V (continu)",
    exclusions: [
      "Matériels de traction électrique",
      "Installations à bord (navires, aéronefs)",
      "Installations minières",
      "Clôtures électriques et paratonnerres"
    ],
    principes_fondamentaux: [
      "Sécurité personnes, animaux et biens",
      "Continuité de service",
      "Maintenance facilitée",
      "Protection contre la foudre"
    ],
    limites_installations: {
      tension: "≤1000V alternatif, ≤1500V continu",
      courant: "Selon section câble et protection",
      puissance: "Selon usage (habitation, commercial, industriel)"
    }
  },

  // NORMES BRANCHEMENTS
  normes_branchement: {
    coffret_compteur: {
      position: "En limite propriété",
      hauteur_hublot: "1.60m du sol",
      accessibilite: "Accessible sans outils spéciaux"
    },
    cablage: {
      enterre: "0.5m sous grillage rouge",
      protection: "PVC obligatoire",
      hauteur: "≥4m dans ruelles, ≥6m sur routes",
      section_standard: ["1.5mm²", "2.5mm²", "4mm²", "6mm²"]
    },
    protection: {
      ddr: "Dispositif de coupure fuite terre obligatoire",
      pe: "Prise terre vert/jaune (DDR vert/jaune/rouge)",
      interdictions: ["Poteaux bois pourris", "Barrettes terre extérieures"]
    },
    partie_active: "Conducteur sous tension (phase, neutre)",
    masse: "Pièce touchable pouvant être sous tension"
  },

  // SYNCHRONISATION KOBO
  kobo_sync: {
    outil: "Kobo Collect pour collecte terrain",
    identifiant_metier: "numeroordre (clé unique business)",
    champs_extraction: [
      "numeroordre/numero_ordre",
      "coordinates (lat/lon)",
      "owner (prénom+nom, téléphone)",
      "region/departement/commune/village",
      "status (checkpoints validation)"
    ],
    strategie_merge: "UPDATE si numeroordre existe, CREATE sinon",
    formats_gps: ["lat lon", "lon lat", "GeoJSON Point"],
    validation: "Checkpoints: murs, réseau, intérieur, contrôle"
  },

  // BASE DE DONNÉES
  schema_db: {
    tables_principales: {
      Organizations: "Isolation multi-tenant",
      Users: "Authentification (email, role, organizationId)",
      Projects: "Projets (budget, durée, config JSON)",
      Zones: "Zones géographiques (metadata JSON)",
      Households: "Ménages (location PostGIS, status, koboData)",
      Teams: "Équipes (type, count, config équipement)",
      KPI_Snapshots: "Métriques analytics",
      AuditLogs: "Traçabilité actions",
      SyncMetadata: "Support offline"
    },
    indexes_performance: [
      "idx_users_email (authentification)",
      "idx_households_location_gis (requêtes spatiales)",
      "idx_households_project_status (filtrage)",
      "idx_kpi_project_timestamp (analytics)"
    ],
    contraintes: {
      numeroordre: "UNIQUE (clé métier)",
      organizationId: "Isolation tenant",
      soft_delete: "deletedAt nullable"
    }
  },

  // SÉCURITÉ & AUTHENTIFICATION
  securite: {
    jwt_flow: {
      access_token: "15min, payload: sub, email, role, organizationId",
      refresh_token: "7d, stocké DB, rotation possible",
      logout: "Revoke refresh token"
    },
    protections: [
      "XSS: No innerHTML, DOMPurify",
      "CSRF: SameSite cookies, CORS validation",
      "SQL Injection: Prisma ORM uniquement",
      "Brute Force: Lockout après 5 échecs",
      "Rate Limiting: 5req/s login, 20req/s API"
    ],
    middleware: [
      "helmet (HSTS, CSP, X-Frame-Options)",
      "cors (multi-origin)",
      "compression gzip",
      "morgan logging",
      "authProtect (JWT verification)",
      "authorizationMiddleware (RBAC)"
    ]
  },

  // API ENDPOINTS CRITIQUES
  api_endpoints: {
    auth: {
      "POST /api/auth/login": "Email + password → JWT tokens",
      "POST /api/auth/refresh": "Refresh token → New access token",
      "POST /api/auth/logout": "Revoke refresh token"
    },
    households: {
      "GET /households?bbox=lng1,lat1,lng2,lat2": "Ménages dans bounding box (PostGIS)",
      "POST /households/sync": "Sync Kobo → DB",
      "PUT /households/:id/status": "Update statut ménage"
    },
    missions: {
      "POST /missions": "Créer mission OM",
      "GET /missions/:id/approval-history": "Workflow approbation",
      "PUT /missions/:id/approve": "Approuver étape"
    },
    analytics: {
      "GET /kpi/:projectId": "Métriques projet",
      "GET /audit/logs": "Logs audit trail"
    }
  },

  // QUESTIONS FRÉQUENTES
  faq: [
    {
      question: "Comment créer une nouvelle mission OM?",
      reponse: "1. Se connecter avec rôle ADMIN_PROQUELEC\n2. Accéder interface missions\n3. Remplir numéro OM, zone, budget\n4. Soumettre pour approbation CHEF_PROJET"
    },
    {
      question: "Quelles sont les règles pour un branchement Senelec?",
      reponse: "• Coffret compteur en limite propriété, hublot à 1.60m\n• Câbles enterrés 0.5m sous grillage rouge\n• Protection PVC ≥4m ruelles/≥6m routes\n• DDR obligatoire, PE vert/jaune"
    },
    {
      question: "Comment synchroniser les données Kobo?",
      reponse: "1. Collecte terrain avec Kobo Collect\n2. Export données (CSV/JSON)\n3. Upload via interface GEM-MINT\n4. Sync automatique par numeroordre\n5. Validation et merge DB"
    },
    {
      question: "Quels sont les statuts possibles d'un ménage?",
      reponse: "Non débuté → Murs → Réseau → Intérieur → Contrôle conforme\nOu: Ménage non éligible, Problème"
    },
    {
      question: "Comment fonctionne l'approbation des missions?",
      reponse: "Workflow: ADMIN_PROQUELEC → CHEF_PROJET → DG\nChaque étape nécessite approbation explicite\nCommentaires obligatoires pour rejet"
    }
  ],

  // ERREURS COURANTES & SOLUTIONS
  erreurs_courantes: {
    doublons_kobo: "Vérifier numeroordre UNIQUE, utiliser UPDATE si existe",
    statut_ignore: "Priorité: 'Situation du Ménage' > checkpoints validation > fallback 'Non débuté'",
    memoire_carte: "Supercluster pour clustering, limit 5000 points par requête bbox",
    sync_conflits: "version + updatedAt pour résolution, master local gagne",
    auth_expire: "Auto-refresh token, fallback login si refresh expiré"
  },

  // MÉTRIQUES & KPIs
  kpis: {
    objectifs: {
      access_electricite: "X% ménages électrifiés",
      budget_consomme: "X% budget utilisé",
      delai_moyen: "X jours par ménage"
    },
    calculs: {
      taux_electrification: "(ménages_électrifiés / total_ménages) * 100",
      rendement_equipe: "ménages/jour/équipe",
      cout_moyen: "budget_total / ménages_électrifiés"
    }
  }
};

// EXPORT POUR UTILISATION DANS LES SCRIPTS DE TEST
export const getContextePrompt = (user, state) => `
Tu es MissionSage, l'assistant IA expert de GEM-MINT / PROQUELEC.

BASE DE CONNAISSANCES COMPLÈTE:

CONTEXTE GÉNÉRAL:
- ${GEM_MINT_KNOWLEDGE_BASE.contexte_general.entreprise}
- ${GEM_MINT_KNOWLEDGE_BASE.contexte_general.application}
- Objectif: ${GEM_MINT_KNOWLEDGE_BASE.contexte_general.objectif}
- Normes: ${GEM_MINT_KNOWLEDGE_BASE.contexte_general.normes}

UTILISATEUR ACTUEL:
- Rôle: ${user?.role || 'Inconnu'}
- Nom: ${user?.displayName || user?.name || 'Utilisateur'}
- Email: ${user?.email || 'N/A'}

STATISTIQUES SYSTÈME:
- Total missions: ${state?.stats?.totalMissions || 0}
- Missions certifiées: ${state?.stats?.totalCertified || 0}
- Ménages collectés: ${state?.stats?.totalHouseholds || 0}
- Indemnités totales: ${state?.stats?.totalIndemnities ? new Intl.NumberFormat('fr-FR').format(state.stats.totalIndemnities) + ' FCFA' : 'N/A'}

ARCHITECTURE TECHNIQUE:
- Frontend: ${GEM_MINT_KNOWLEDGE_BASE.architecture.frontend}
- Backend: ${GEM_MINT_KNOWLEDGE_BASE.architecture.backend}
- Stockage: ${GEM_MINT_KNOWLEDGE_BASE.architecture.stockage}

WORKFLOW MISSIONS:
${GEM_MINT_KNOWLEDGE_BASE.workflow_missions.etapes.map(etape => `- ${etape}`).join('\n')}

RÈGLES TECHNIQUES (NS 01-001):
- Domaine: ${GEM_MINT_KNOWLEDGE_BASE.regles_techniques.domaine_application}
- Principes: ${GEM_MINT_KNOWLEDGE_BASE.regles_techniques.principes_fondamentaux.join(', ')}
- Exclusions: ${GEM_MINT_KNOWLEDGE_BASE.regles_techniques.exclusions.join(', ')}

NORMES BRANCHEMENTS:
- Coffret: ${GEM_MINT_KNOWLEDGE_BASE.normes_branchement.coffret_compteur.position}, hublot ${GEM_MINT_KNOWLEDGE_BASE.normes_branchement.coffret_compteur.hauteur_hublot}
- Câblage: ${GEM_MINT_KNOWLEDGE_BASE.normes_branchement.cablage.enterre}, protection ${GEM_MINT_KNOWLEDGE_BASE.normes_branchement.cablage.protection}
- Sections: ${GEM_MINT_KNOWLEDGE_BASE.normes_branchement.cablage.section_standard.join(', ')}

SYNCHRONISATION KOBO:
- Identifiant: ${GEM_MINT_KNOWLEDGE_BASE.kobo_sync.identifiant_metier}
- Stratégie: ${GEM_MINT_KNOWLEDGE_BASE.kobo_sync.strategie_merge}
- Champs: ${GEM_MINT_KNOWLEDGE_BASE.kobo_sync.champs_extraction.join(', ')}

SÉCURITÉ:
- JWT: Access ${GEM_MINT_KNOWLEDGE_BASE.securite.jwt_flow.access_token}, Refresh ${GEM_MINT_KNOWLEDGE_BASE.securite.jwt_flow.refresh_token}
- Protections: ${GEM_MINT_KNOWLEDGE_BASE.securite.protections.join(', ')}

INSTRUCTION: Réponds en expert PROQUELEC, utilise TOUTES les connaissances disponibles, sois précis et professionnel.
`;