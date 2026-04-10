import { GEM_MINT_KNOWLEDGE_BASE } from './GEM_MINT_KNOWLEDGE_BASE.js';

/**
 * SYSTÈME D'AMÉLIORATION DES RÉPONSES STATIQUES
 * Basé sur l'analyse des réponses IA cohérentes
 */

export class StaticResponseImprover {

  constructor() {
    this.improvedResponses = new Map();
    this.responsePatterns = {
      // Patterns de réponses réussies observés
      workflow: {
        structure: "Étape 1 → Étape 2 → Étape 3",
        include_roles: true,
        add_context: "en tant que [ROLE]"
      },
      technique: {
        structure: "• Règle 1\n• Règle 2\n• Règle 3",
        include_normes: "NS 01-001",
        add_examples: true
      },
      securite: {
        structure: "Protection: description",
        include_technologies: true,
        add_durees: true
      }
    };
  }

  // AMÉLIORATIONS BASÉES SUR LES RÉPONSES IA RÉUSSIES

  improveWorkflowResponses() {
    // Amélioration du workflow missions
    this.improvedResponses.set('workflow_missions', {
      original: "Créer mission → Valider → Approuver",
      improved: `Workflow complet des missions OM:

1. **Création** (ADMIN_PROQUELEC)
   - Saisie numéro OM, zone, budget
   - Définition équipes et équipements

2. **Validation Technique** (CHEF_PROJET)
   - Vérification conformité NS 01-001
   - Validation budgétaire et planning

3. **Certification Finale** (DIRECTEUR)
   - Approbation stratégique
   - Autorisation paiement indemnités

4. **Exécution Terrain** (TECHNICIENS)
   - Collecte Kobo Collect
   - Synchronisation données

5. **Contrôle & Paiement**
   - Validation conformité
   - Indemnisation ménages`,

      improvements: [
        "Structure numérotée claire",
        "Rôles explicites entre parenthèses",
        "Contexte technique ajouté",
        "Étapes détaillées avec actions spécifiques"
      ]
    });
  }

  improveTechnicalResponses() {
    // Amélioration des réponses techniques
    this.improvedResponses.set('regles_branchement', {
      original: "Coffret à 1.60m, câbles enterrés",
      improved: `Règles techniques branchement Senelec (NS 01-001):

**📍 Coffret Compteur:**
• Position: En limite propriété
• Hauteur hublot: 1.60m du sol
• Accessibilité: Sans outils spéciaux

**🪢 Câblage:**
• Enterrement: 0.5m sous grillage rouge
• Protection: PVC obligatoire
• Hauteur: ≥4m (ruelles), ≥6m (routes)
• Sections standard: 1.5mm², 2.5mm², 4mm²

**⚡ Protection Électrique:**
• DDR: Dispositif coupure fuite terre (obligatoire)
• PE: Prise terre vert/jaune
• Interdictions: Poteaux bois pourris, barrettes terre extérieures

**🔧 Terminologie:**
• Partie active: Conducteur sous tension (phase, neutre)
• Masse: Pièce touchable pouvant être sous tension`,

      improvements: [
        "Format visuel avec emojis",
        "Sections organisées logiquement",
        "Détails techniques précis",
        "Terminologie claire avec définitions"
      ]
    });
  }

  improveSecurityResponses() {
    // Amélioration des réponses sécurité
    this.improvedResponses.set('authentification', {
      original: "JWT avec refresh token",
      improved: `Architecture de sécurité GEM-MINT:

**🔐 Authentification JWT:**
• Access Token: 15 minutes (sub, email, role, organizationId)
• Refresh Token: 7 jours (stocké DB, rotation possible)
• Logout: Revocation refresh token

**🛡️ Protections Implémentées:**
• XSS: DOMPurify, no innerHTML
• CSRF: SameSite cookies, validation CORS
• Injection SQL: Prisma ORM uniquement
• Brute Force: Lockout après 5 échecs
• Rate Limiting: 5req/s (login), 20req/s (API)

**🔧 Middleware Sécurité:**
• Helmet: HSTS, CSP, X-Frame-Options
• CORS: Gestion multi-origines
• Compression: Gzip automatique
• Morgan: Logging requêtes
• AuthProtect: Vérification JWT
• AuthorizationMiddleware: Contrôle accès rôles`,

      improvements: [
        "Durées explicites",
        "Liste complète des protections",
        "Middleware détaillés",
        "Contexte technique précis"
      ]
    });
  }

  improveKoboResponses() {
    // Amélioration des réponses Kobo
    this.improvedResponses.set('sync_kobo', {
      original: "Sync par numeroordre",
      improved: `Synchronisation Kobo Collect:

**🎯 Stratégie de Matching:**
• Identifiant métier: numeroordre (clé UNIQUE)
• Logique: UPDATE si existe, CREATE sinon
• Format: String human-readable (ex: MEN-XXXX)

**📊 Extraction de Champs:**
• numeroordre/numero_ordre: Identifiant unique
• coordinates: Latitude/Longitude (formats multiples)
• owner: Prénom+Nom, Téléphone
• regional: Région/Département/Commune/Village
• status: Checkpoints validation

**🔄 Formats GPS Supportés:**
• "lat lon" ou "lon lat"
• GeoJSON Point [longitude, latitude]
• Séparateur décimal: . ou ,

**⚡ Validation Statut:**
1. Priorité: "Situation du Ménage" (non_eligible)
2. Fallback: Checkpoints validation
3. Default: "Non débuté"

**🚫 Prévention Doublons:**
• Contrainte UNIQUE sur numeroordre
• Résolution conflits: version + updatedAt
• Master local prioritaire`,

      improvements: [
        "Stratégie de matching claire",
        "Formats supportés détaillés",
        "Logique de validation expliquée",
        "Solutions anti-doublons"
      ]
    });
  }

  generateImprovedResponseBank() {
    this.improveWorkflowResponses();
    this.improveTechnicalResponses();
    this.improveSecurityResponses();
    this.improveKoboResponses();

    return this.improvedResponses;
  }

  // ANALYSEUR DE RÉPONSES POUR AMÉLIORATIONS FUTURES
  analyzeResponseQuality(question, response) {
    const analysis = {
      question,
      response,
      score: 0,
      strengths: [],
      weaknesses: [],
      suggestions: []
    };

    // Analyse de structure
    if (response.includes('•') || response.includes('1.') || response.includes('**')) {
      analysis.score += 2;
      analysis.strengths.push('Structure organisée');
    } else {
      analysis.weaknesses.push('Structure peut être améliorée');
      analysis.suggestions.push('Ajouter listes à puces ou numérotation');
    }

    // Analyse de précision technique
    const technicalTerms = ['NS 01-001', 'JWT', 'numeroordre', 'coffret', 'DDR'];
    const foundTerms = technicalTerms.filter(term =>
      response.toLowerCase().includes(term.toLowerCase())
    );
    analysis.score += foundTerms.length;
    if (foundTerms.length > 0) {
      analysis.strengths.push(`Termes techniques utilisés: ${foundTerms.join(', ')}`);
    }

    // Analyse de contexte métier
    if (response.toLowerCase().includes('proquelec') ||
        response.toLowerCase().includes('gem-mint')) {
      analysis.score += 1;
      analysis.strengths.push('Contexte métier présent');
    } else {
      analysis.weaknesses.push('Contexte métier peut être renforcé');
    }

    // Analyse de longueur et détail
    if (response.length > 200) {
      analysis.score += 1;
      analysis.strengths.push('Réponse détaillée');
    } else if (response.length < 100) {
      analysis.weaknesses.push('Réponse peut être plus détaillée');
    }

    return analysis;
  }
}

// EXPORT POUR UTILISATION
export const staticImprover = new StaticResponseImprover();
export const improvedResponses = staticImprover.generateImprovedResponseBank();