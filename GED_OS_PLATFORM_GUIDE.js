/**
 * BASE DE CONNAISSANCES COMPLÈTE GED OS
 * Compilation de toutes les connaissances métier, techniques et procédurales
 */

export const GED_OS_KNOWLEDGE_BASE = {
  // CONTEXTE GÉNÉRAL
  contexte_general: {
    entreprise: "GED OS - Gestionnaire d'Écosystème Digital",
    application: "GED OS - Système d'Exploitation Métier Souverain",
    objectif: "Pilotage et automatisation d'écosystèmes numériques multidomaines",
    normes: "NS 01-001 (Électricité) et standards de gouvernance numérique"
  },

  // ARCHITECTURE TECHNIQUE
  architecture: {
    frontend: "React 19 + TypeScript + TailwindCSS 4 + Vite + MapLibre GL JS",
    backend: "Node.js ESM + Express + Prisma 7 + PostgreSQL 16 + PostGIS",
    infra: "Docker + Railway.app + Nginx + Redis",
    stockage: "IndexedDB (frontend) + PostgreSQL (backend)",
    cartographie: "MapLibre GL JS avec Supercluster pour clustering haute performance (200k+ pts)"
  },

  // WORKFLOW MÉTIER PRINCIPAL
  workflow_missions: {
    etapes: [
      "Création mission OM par ADMIN",
      "Validation par CHEF_PROJET",
      "Certification par DIRECTEUR (DG)",
      "Assignation équipes terrain",
      "Collecte données via GED OS Collect (Kobo)",
      "Synchronisation et validation en temps réel",
      "Paiement et clôture workflow"
    ],
    roles: {
      ADMIN: "Gestionnaire système et sécurité",
      CHEF_PROJET: "Pilotage opérationnel et budgétaire",
      TECHNICIEN: "Opérateur terrain et collecte de données",
      DG: "Certification stratégique et approbation finale"
    },
    statuts_metier: [
      "Initialisé",
      "En cours d'exécution",
      "En attente de contrôle",
      "Contrôle conforme",
      "Clôturé",
      "Incident / Blocage",
      "Rejeté"
    ]
  },

  // RÈGLES TECHNIQUES (EXEMPLE ÉLECTRICITÉ)
  regles_techniques: {
    domaine_application: "Infrastructures BT ≤1000V et systèmes multidomaines",
    principes_fondamentaux: [
      "Souveraineté des données",
      "Automatisation des workflows",
      "Traçabilité immuable",
      "Intelligence augmentée"
    ],
    limites_systeme: {
      concurrence: "Haute performance (Architecture Event-Driven)",
      securite: "Isolation multi-tenant stricte",
      scalabilite: "Support massif (jusqu'à 500k entités)"
    }
  },

  // SYNCHRONISATION KOBO / FIELD DATA
  field_data_sync: {
    outil: "Kobo Collect / GED OS Engine",
    identifiant_metier: "numeroordre (clé unique business)",
    champs_extraction: [
      "numeroordre",
      "coordinates (lat/lon)",
      "owner",
      "metadata (sync_timestamp)",
      "checkpoints"
    ],
    strategie_merge: "Upsert intelligent basé sur l'empreinte temporelle",
    formats_gps: ["Smart Selection (C2/C4)", "lat lon", "lon lat"],
    monitoring: "Détection automatique d'anomalies par IA"
  },

  // BASE DE DONNÉES
  schema_db: {
    tables_principales: {
      Organizations: "Multi-tenant root",
      Projects: "Projets isolés",
      Households: "Entités métier (Ménages/Points)",
      Teams: "Ressources humaines terrain",
      Missions: "Workflows d'ordres de mission",
      AuditLogs: "Journalisation système",
      SyncMetadata: "Gestion du mode déconnecté"
    }
  },

  // SÉCURITÉ
  securite: {
    jwt_flow: {
      access_token: "15min (payload sécurisé)",
      refresh_token: "7d (rotation auto)",
      impersonation: "God Mode avec traçabilité"
    },
    protections: [
      "CORS Whitelist strictly enforced",
      "Prisma ORM (SQLi Protection)",
      "2FA (Double Authentification)",
      "Bcrypt Hashing"
    ]
  },

  // QUESTIONS FRÉQUENTES
  faq: [
    {
      question: "Qu'est-ce que GED OS ?",
      reponse: "C'est un gestionnaire d'écosystème digital conçu pour piloter des projets complexes (énergie, santé, agriculture) avec une supervision en temps réel."
    },
    {
      question: "Comment fonctionne l'IA dans GED OS ?",
      reponse: "L'IA analyse les données serveur pour fournir des pré-diagnostics, automatiser les PV et assister la prise de décision DG."
    },
    {
      question: "Le système supporte-t-il le mode hors-ligne ?",
      reponse: "Oui, via GED OS Collect et le Master Local qui synchronisent les données dès qu'une connexion est disponible."
    }
  ]
};

// EXPORT POUR L'ASSISTANT IA
export const getContextePrompt = (user, state) => `
Tu es GED OS AI, l'assistant expert souverain du système GED OS.

BASE DE CONNAISSANCES GED OS:

CONTEXTE GÉNÉRAL:
- Entreprise: ${GED_OS_KNOWLEDGE_BASE.contexte_general.entreprise}
- Système: ${GED_OS_KNOWLEDGE_BASE.contexte_general.application}
- Vision: ${GED_OS_KNOWLEDGE_BASE.contexte_general.objectif}

UTILISATEUR:
- Rôle: ${user?.role || 'Inconnu'}

ÉTAT DU SYSTÈME:
- Projets actifs: ${state?.stats?.activeProjects || 0}
- Entités collectées: ${state?.stats?.totalHouseholds || 0}

ARCHITECTURE:
- Stack: ${GED_OS_KNOWLEDGE_BASE.architecture.frontend} / ${GED_OS_KNOWLEDGE_BASE.architecture.backend}
- Sécurité: ${GED_OS_KNOWLEDGE_BASE.securite.protections.join(', ')}

INSTRUCTION: Réponds en tant que système d'exploitation métier GED OS. Utilise un ton premium, précis et orienté expertise opérationnelle.
`;