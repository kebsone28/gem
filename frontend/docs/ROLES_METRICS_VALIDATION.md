# Validation des Rôles et Métriques - Dashboard GEM SAAS

## 🔍 Analyse des Rôles Actuels

### ❌ Problèmes Identifiés

#### 1. **Doublons de Rôles**
```typescript
// DOUBLONS IDENTIFIÉS
DG: 'DG_PROQUELEC',           // Rôle principal
DG_ALT: 'DIRECTION GÉNÉRALE', // Alternative
DIRECTEUR: 'DIRECTEUR',        // DOUBLON avec DG !

CHEF_PROJET: 'CHEF_PROJET',           // Rôle principal
CHEF_PROJET_ALT: 'CHEF DE PROJET',    // Alternative

CHEF_EQUIPE: 'CHEF_EQUIPE',     // Rôle principal
CHEF_CHANTIER: 'CHEF DE CHANTIER', // Alternative
CHEF: 'CHEF',                   // DOUBLON avec CHEF_EQUIPE !
```

#### 2. **Alias Conflictuels**
```typescript
// Dans ROLE_ALIASES
'DIRECTION GÉNÉRALE': ROLES.DG,  // OK
DIRECTEUR: ROLES.DG,             // CONFLIT avec ROLES.DIRECTEUR

'CHEF DE CHANTIER': ROLES.CHEF_EQUIPE,  // OK
CHEF: ROLES.CHEF_EQUIPE,                // CONFLIT avec ROLES.CHEF
```

## 🎯 Rôles Unifiés et Métriques Attendues

### 1. **ADMIN_PROQUELEC** (Admin Système)
**Responsabilités** :
- Administration complète du système
- Gestion des utilisateurs et permissions
- Maintenance technique et sécurité

**Métriques Essentielles** :
- **Système** : CPU, mémoire, API response time
- **Sécurité** : Tentatives d'intrusion, logs d'audit
- **Utilisateurs** : Nombre d'utilisateurs actifs, permissions
- **Performance** : Uptime, taux d'erreur, cache hit rate

**Permissions Clés** :
- `GERER_UTILISATEURS`, `VOIR_AUDIT_LOGS`, `ACCES_GOD_MODE`
- `VOIR_DIAGNOSTIC`, `GENERER_CLES_API`

---

### 2. **DG_PROQUELEC** (Direction Générale)
**Responsabilités** :
- Vision stratégique globale
- Décisions budgétaires
- Supervision de tous les projets

**Métriques Essentielles** :
- **Stratégie** : Progression globale, ROI, rentabilité
- **Financier** : Budget utilisé, burn rate, projections
- **Opérationnel** : Performance globale, KPIs principaux
- **Risques** : Risques critiques, plans de mitigation

**Permissions Clés** :
- `VOIR_FINANCES`, `APPROUVER_MISSION`, `VOIR_SIMULATION`
- `DIFFUSER_MESSAGE_SYSTEME`, `EXPORTER_DONNEES`

---

### 3. **CHEF_PROJET** (Chef de Projet)
**Responsabilités** :
- Coordination multi-équipes
- Gestion des délais et budgets
- Communication avec stakeholders

**Métriques Essentielles** :
- **Projet** : Progression, timeline adherence, qualité
- **Équipes** : Performance, allocation, dépendances
- **Risques** : Identification, mitigation, contingence
- **Rapports** : Reporting aux stakeholders, KPIs

**Permissions Clés** :
- `GERER_PLANNING`, `VOIR_EQUIPES`, `MODIFIER_PROJET`
- `VOIR_RAPPORTS_TERRAIN`, `GERER_CONFLITS`

---

### 4. **CHEF_EQUIPE** (Chef d'Équipe/Brigade)
**Responsabilités** :
- Supervision d'une équipe technique
- Exécution des tâches terrain
- Rapportage de progression

**Métriques Essentielles** :
- **Équipe** : Performance individuelle, taux de réussite
- **Opérationnel** : Tâches complétées, temps moyen
- **Logistique** : Matériel disponible, efficacité
- **Qualité** : Taux de conformité, retours clients

**Permissions Clés** :
- `VOIR_MISSIONS`, `ACCES_TERMINAL_KOBO`, `VOIR_CARTE`
- `VOIR_RAPPORTS_TERRAIN`, `VOIR_ALERTES`

---

### 5. **COMPTABLE** (Gestion Financière)
**Responsabilités** :
- Suivi budgétaire et comptabilité
- Rapports financiers
- Validation des dépenses

**Métriques Essentielles** :
- **Budget** : Dépenses, prévisions, écarts
- **Trésorerie** : Cash flow, solde, projections
- **Rapports** : Bilans, comptes de résultat
- **Audit** : Conformité, validations, contrôles

**Permissions Clés** :
- `VOIR_FINANCES`, `VOIR_PAIEMENTS`, `EXPORTER_COMPTABILITE`
- `GERER_LOGISTIQUE`, `VOIR_LOGISTIQUE`

---

### 6. **CLIENT_LSE** (Partenaire Institutionnel)
**Responsabilités** :
- Suivi de l'avancement
- Validation des livrables
- Communication avec l'équipe projet

**Métriques Essentielles** :
- **Progression** : Sites raccordés, délais de livraison
- **Qualité** : Conformité, scores de satisfaction
- **Impact** : Bénéfices sociaux, réduction CO₂
- **Communication** : Rapports, mises à jour

**Permissions Clés** :
- `VOIR_CARTE`, `VOIR_RAPPORTS_TERRAIN`, `VOIR_MISSIONS`
- `ACCES_CHAT`

---

## 🔧 Corrections Recommandées

### 1. **Nettoyage des Rôles**
```typescript
// RÔLES CORRIGÉS
export const ROLES = {
  ADMIN: 'ADMIN_PROQUELEC',
  DG: 'DG_PROQUELEC',
  CHEF_PROJET: 'CHEF_PROJET',
  CHEF_EQUIPE: 'CHEF_EQUIPE',
  COMPTABLE: 'COMPTABLE',
  CLIENT_LSE: 'CLIENT_LSE',
} as const;

// SUPPRESSION DES DOUBLONS
// - DG_ALT: 'DIRECTION GÉNÉRALE'
// - CHEF_PROJET_ALT: 'CHEF DE PROJET'
// - CHEF_CHANTIER: 'CHEF DE CHANTIER'
// - CHEF: 'CHEF'
// - DIRECTEUR: 'DIRECTEUR'
```

### 2. **Alias Simplifiés**
```typescript
export const ROLE_ALIASES: Record<string, UserRole> = {
  // Admin
  ADMIN_PROQUELEC: ROLES.ADMIN,
  ADMINISTRATEUR: ROLES.ADMIN,
  ADMIN: ROLES.ADMIN,
  
  // DG
  DG_PROQUELEC: ROLES.DG,
  'DIRECTION GÉNÉRALE': ROLES.DG,
  DIRECTEUR: ROLES.DG,  // Redirection vers DG
  
  // Chef de Projet
  CHEF_PROJET: ROLES.CHEF_PROJET,
  'CHEF DE PROJET': ROLES.CHEF_PROJET,
  CP: ROLES.CHEF_PROJET,
  
  // Chef d'Équipe
  CHEF_EQUIPE: ROLES.CHEF_EQUIPE,
  'CHEF DE CHANTIER': ROLES.CHEF_EQUIPE,
  CHEF: ROLES.CHEF_EQUIPE,
  
  // Autres
  COMPTABLE: ROLES.COMPTABLE,
  CLIENT_LSE: ROLES.CLIENT_LSE,
};
```

### 3. **Dashboards par Rôle**
```typescript
// MAPPING DASHBOARD → RÔLE
const DASHBOARD_MAPPING: Record<UserRole, string> = {
  [ROLES.ADMIN]: 'AdminDashboard',
  [ROLES.DG]: 'AdminDashboard',      // Même dashboard avec permissions limitées
  [ROLES.CHEF_PROJET]: 'ProjectManagerDashboard',
  [ROLES.CHEF_EQUIPE]: 'TeamDashboard',
  [ROLES.COMPTABLE]: 'AccountingDashboard',  // À créer
  [ROLES.CLIENT_LSE]: 'ClientDashboard',
};
```

## 📊 Métriques par Dashboard

### **AdminDashboard** (Admin + DG)
```typescript
interface AdminDashboardMetrics {
  // Vue Admin complète
  systemHealth: SystemHealthMetrics;
  securityAlerts: SecurityMetrics;
  userManagement: UserMetrics;
  
  // Vue DG limitée
  strategicKPIs: StrategicMetrics;
  financialOverview: FinancialMetrics;
  riskManagement: RiskMetrics;
}
```

### **ProjectManagerDashboard** (Chef de Projet)
```typescript
interface ProjectManagerMetrics {
  projectOversight: ProjectMetrics;
  teamCoordination: TeamCoordinationMetrics;
  riskManagement: RiskManagementMetrics;
  stakeholderReporting: ReportingMetrics;
}
```

### **TeamDashboard** (Chef d'Équipe)
```typescript
interface TeamMetrics {
  teamPerformance: TeamPerformanceMetrics;
  operationalKPIs: OperationalMetrics;
  resourceManagement: ResourceMetrics;
  qualityControl: QualityMetrics;
}
```

### **ClientDashboard** (Client LSE)
```typescript
interface ClientMetrics {
  projectProgress: ProgressMetrics;
  deliveryMetrics: DeliveryMetrics;
  qualityMetrics: QualityMetrics;
  impactMetrics: ImpactMetrics;
}
```

### **AccountingDashboard** (Comptable) - À CRÉER
```typescript
interface AccountingMetrics {
  budgetTracking: BudgetMetrics;
  cashFlow: CashFlowMetrics;
  financialReports: ReportMetrics;
  complianceAudit: ComplianceMetrics;
}
```

## ✅ Validation Checklist

### **Pour chaque rôle, vérifier** :
- [ ] **Unicité** : Pas de doublons dans les définitions
- [ ] **Pertinence** : Métriques adaptées aux responsabilités
- [ ] **Permissions** : Droits d'accès cohérents
- [ ] **Dashboard** : Interface dédiée ou partagée
- [ ] **Formation** : Documentation utilisateur

### **Pour le système global** :
- [ ] **Cohérence** : Alias sans conflits
- [ ] **Scalabilité** : Ajout facile de nouveaux rôles
- [ ] **Maintenance** : Code clair et documenté
- [ ] **Sécurité** : Pas de permission en trop

## 🎯 Plan d'Action Immédiat

### **Phase 0** (Correction critique) :
1. **Nettoyer les rôles** : Supprimer les doublons
2. **Unifier les alias** : Éliminer les conflits
3. **Valider les permissions** : Vérifier la cohérence

### **Phase 1** (Validation métriques) :
1. **Valider chaque rôle** avec les responsables métier
2. **Définir les KPIs** spécifiques par rôle
3. **Créer les dashboards** manquants (Comptable)

### **Phase 2** (Implémentation) :
1. **Déployer les corrections** de rôles
2. **Tester les dashboards** avec utilisateurs réels
3. **Former les équipes** aux nouvelles interfaces

---

Cette validation garantit que chaque type d'utilisateur aura accès aux métriques pertinentes pour ses responsabilités, sans confusion ni doublons dans le système de rôles.
