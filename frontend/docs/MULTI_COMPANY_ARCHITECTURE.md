# Architecture Multi-Entreprises - GEM SAAS

## 🏢 Structure Organisationnelle Complète

### 1. **Client Final (LSE - Société Nationale d'Électricité)**
- **Rôle** : Bénéficiaire final du projet
- **Accès** : Vue de suivi, validation, rapports
- **Métriques** : Progression, qualité, impact

### 2. **Maître d'Œuvre (PROQUELEC/GEM)**
- **Rôle** : Gestionnaire principal du projet
- **Personnel** : Direction, administrateurs, équipes terrain
- **Accès** : Contrôle complet du système

### 3. **Superviseur National (SENELEC)**
- **Rôle** : Contrôle technique et réglementaire
- **Accès** : Supervision, audit, validation technique

### 4. **Sous-Traitants**
- **Rôle** : Exécution des travaux terrain
- **Accès** : Soumission, suivi des missions, rapports terrain

---

## 🎯 Redéfinition des Rôles par Entreprise

### **ENTREPRISE CLIENT (LSE)**

#### `CLIENT_LSE_SUPERVISEUR`
- **Profil** : Direction LSE, superviseurs projet
- **Responsabilités** : Validation stratégique, suivi KPIs
- **Dashboard** : Vue client avec métriques d'impact

#### `CLIENT_LSE_TECHNIQUE`
- **Profil** : Équipe technique LSE
- **Responsabilités** : Validation technique, conformité
- **Dashboard** : Vue technique avec métriques de qualité

---

### **ENTREPRISE MAÎTRE D'ŒUVRE (PROQUELEC/GEM)**

#### `PROQUELEC_ADMIN`
- **Profil** : Administrateur système GEM
- **Responsabilités** : Maintenance, sécurité, gestion utilisateurs
- **Dashboard** : AdminDashboard complet

#### `PROQUELEC_DG`
- **Profil** : Direction Générale Proquelec
- **Responsabilités** : Vision stratégique, décisions budgétaires
- **Dashboard** : AdminDashboard limité au stratégique

#### `PROQUELEC_CHEF_PROJET`
- **Profil** : Chef de Projet principal
- **Responsabilités** : Coordination multi-équipes, reporting
- **Dashboard** : ProjectManagerDashboard

#### `PROQUELEC_DIRECTION`
- **Profil** : Direction opérationnelle
- **Responsabilités** : Supervision, validation, reporting
- **Dashboard** : Vue directionnelle

#### `PROQUELEC_COMPTABLE`
- **Profil** : Service comptabilité
- **Responsabilités** : Budget, trésorerie, rapports financiers
- **Dashboard** : AccountingDashboard

#### `PROQUELEC_PATRIMOINE`
- **Profil** : Gestionnaire patrimoine
- **Responsabilités** : Suivi actifs, maintenance, inventaire
- **Dashboard** : Vue patrimoniale

#### `PROQUELEC_EMPLOYE`
- **Profil** : Personnel administratif
- **Responsabilités** : Saisie, suivi, reporting interne
- **Dashboard** : Vue employé simplifiée

---

### **ENTREPRISE SUPERVISEUR (SENELEC)**

#### `SENELEC_SUPERVISEUR`
- **Profil** : Superviseur technique SENELEC
- **Responsabilités** : Audit technique, validation normes
- **Dashboard** : Vue supervision technique

#### `SENELEC_CONTROLEUR`
- **Profil** : Contrôleur qualité SENELEC
- **Responsabilités** : Inspection, conformité, rapports
- **Dashboard** : Vue contrôle qualité

---

### **ENTREPRISE SOUS-TRAITANT**

#### `SOUS_TRAITANT_DIRECTEUR`
- **Profil** : Direction sous-traitant
- **Responsabilités** : Coordination équipes, reporting client
- **Dashboard** : Vue directionnelle sous-traitant

#### `SOUS_TRAITANT_EMPLOYE`
- **Profil** : Employés terrain sous-traitant
- **Responsabilités** : Soumission missions, rapports terrain
- **Dashboard** : Vue terrain simplifiée

---

## 🔐 Matrice de Permissions par Entreprise

### **Permissions CLIENT_LSE**
```typescript
CLIENT_LSE_PERMISSIONS = [
  'voir_progression_globale',
  'voir_rapports_financiers',
  'voir_conformite',
  'valider_livrables',
  'exporter_rapports_client',
  'acces_chat_projet',
];
```

### **Permissions PROQUELEC**
```typescript
PROQUELEC_PERMISSIONS = {
  ADMIN: ALL_PERMISSIONS, // Accès complet
  
  DG: [
    'voir_finances', 'approuver_budget', 'voir_rapports_strategiques',
    'gerer_projets', 'valider_missions_critiques', 'diffuser_messages',
  ],
  
  CHEF_PROJET: [
    'gerer_planning', 'voir_equipes', 'modifier_projets',
    'voir_rapports_terrain', 'gerer_conflits', 'utiliser_ia',
  ],
  
  COMPTABLE: [
    'voir_finances', 'voir_paiements', 'exporter_comptabilite',
    'gerer_logistique', 'voir_rapports_financiers',
  ],
  
  PATRIMOINE: [
    'voir_actifs', 'gerer_inventaire', 'voir_maintenance',
    'exporter_rapports_patrimoine', 'gerer_amortissements',
  ],
};
```

### **Permissions SENELEC**
```typescript
SENELEC_PERMISSIONS = [
  'voir_conformite_technique',
  'valider_normes_electriques',
  'voir_rapports_inspection',
  'auditer_travaux',
  'exporter_rapports_supervision',
];
```

### **Permissions SOUS_TRAITANT**
```typescript
SOUS_TRAITANT_PERMISSIONS = {
  DIRECTEUR: [
    'voir_equipes_sous_traitant',
    'soumettre_rapports',
    'voir_planning_sous_traitant',
    'gerer_personnel_sous_traitant',
  ],
  
  EMPLOYE: [
    'soumettre_missions',
    'voir_taches_assignees',
    'rapporter_progression',
    'acces_terminal_kobo_soumis',
  ],
};
```

---

## 📊 Spécifications des Dashboards

### **Dashboard Client LSE**
```typescript
interface ClientLSEMetrics {
  // Vue stratégique
  progressionGlobale: number;
  impactEconomique: ImpactMetrics;
  conformiteReglementaire: ComplianceMetrics;
  
  // Vue technique
  sitesRaccordes: number;
  qualiteService: QualityMetrics;
  delaisLivraison: DeliveryMetrics;
  
  // Communication
  rapportsPeriodiques: ReportMetrics;
  alertesCritiques: AlertMetrics;
}
```

### **Dashboard SENELEC**
```typescript
interface SenelecMetrics {
  // Supervision technique
  conformiteNormes: number;
  inspectionsRealisees: number;
  nonConformites: number;
  
  // Qualité
  scoreQualiteGlobal: number;
  auditsRealises: AuditMetrics;
  rapportsValidation: ValidationMetrics;
  
  // Réglementaire
  autorisationsDelivrees: number;
  proceduresConformes: number;
  risquesIdentifies: RiskMetrics;
}
```

### **Dashboard Sous-Traitant**
```typescript
interface SousTraitantMetrics {
  // Performance
  missionsCompletees: number;
  qualiteTravaux: QualityMetrics;
  delaisRespectes: number;
  
  // Équipes
  personnelActif: number;
  performanceEquipes: TeamMetrics;
  formationNecessaire: TrainingMetrics;
  
  // Reporting
  rapportsSoumis: number;
  validationsClient: number;
  correctionsRequises: number;
}
```

---

## 🔄 Flux de Données Multi-Entreprises

### **Architecture de Ségrégation**
```typescript
interface MultiTenantData {
  // Données partagées (lecture seule pour certains)
  projetGlobal: ProjectData;
  progressionPublique: ProgressData;
  
  // Données par entreprise
  clientLSE: {
    rapportsPrivés: ClientReport[];
    validations: ValidationData[];
  };
  
  proquelec: {
    donneesCompletes: FullProjectData[];
    finances: FinancialData[];
    personnel: EmployeeData[];
  };
  
  senelec: {
    audits: AuditData[];
    inspections: InspectionData[];
    conformites: ComplianceData[];
  };
  
  sousTraitants: {
    missions: MissionData[];
    rapports: ReportData[];
    personnel: StaffData[];
  };
}
```

### **Règles d'Accès**
```typescript
const ACCESS_RULES = {
  // Client LSE : Vue en lecture seule + validation
  CLIENT_LSE: {
    canRead: ['progression', 'rapports', 'conformite'],
    canWrite: ['validation_livrables', 'commentaires'],
    cannotAccess: ['finances_detaillees', 'personnel'],
  },
  
  // Proquelec : Accès complet
  PROQUELEC: {
    canRead: ['*'],
    canWrite: ['*'],
    cannotAccess: [],
  },
  
  // SENELEC : Supervision technique
  SENELEC: {
    canRead: ['conformite', 'technique', 'rapports_inspection'],
    canWrite: ['validation_normes', 'rapports_audit'],
    cannotAccess: ['finances', 'personnel_interne'],
  },
  
  // Sous-Traitant : Vue limitée
  SOUS_TRAITANT: {
    canRead: ['missions_assignees', 'equipe_propre'],
    canWrite: ['rapports_mission', 'progression_taches'],
    cannotAccess: ['finances', 'autres_equipes', 'donnees_clients'],
  },
};
```

---

## 🚀 Plan d'Implémentation

### **Phase 1** : Restructuration des Rôles
1. **Mettre à jour les rôles** dans permissions.ts
2. **Créer les nouveaux dashboards** (SENELEC, Sous-Traitant)
3. **Adapter les dashboards existants** (Client LSE, Proquelec)

### **Phase 2** : Ségrégation des Données
1. **Implémenter le multi-tenancy** dans la base de données
2. **Créer les filtres par entreprise** dans les hooks
3. **Sécuriser les API** par entreprise

### **Phase 3** : Déploiement Progressif
1. **Tester par entreprise** avec utilisateurs réels
2. **Former les équipes** par entité
3. **Déployer en production** par vagues

---

Cette architecture garantit une séparation claire des responsabilités tout en permettant une collaboration efficace entre toutes les parties prenantes du projet.
