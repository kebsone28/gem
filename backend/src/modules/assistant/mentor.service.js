import { config } from '../../core/config/config.js';
import logger from '../../utils/logger.js';
import { queryOllama } from './ollama.client.js';
import { buildSystemPrompt, AI_REGISTRY } from '../../core/config/ai_registry.js';

function normalizeProvider(provider) {
  const normalized = String(provider || '').trim().toUpperCase();
  if (normalized === 'OLLAMA' || normalized === 'LOCAL_OLLAMA' || normalized === 'OLLAMA_LOCAL') {
    return 'LOCAL_OLLAMA';
  }
  if (normalized === 'ANTHROPIC' || normalized === 'CLAUDE' || normalized === 'CLAUDE_ANTHROPIC') {
    return 'CLAUDE_ANTHROPIC';
  }
  if (normalized === 'POLLINATIONS' || normalized === 'PUBLIC_POLLINATIONS') {
    return 'PUBLIC_POLLINATIONS';
  }
  return 'LOCAL_OLLAMA';
}

const DEFAULT_PROVIDER = normalizeProvider(config.ai.provider);
const MAX_HISTORY_TURNS = 12;

function trimText(value, maxLength = 300) {
  if (!value) return '';
  const normalized = String(value).replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}

function summarizeStats(stats = null) {
  if (!stats) return 'Statistiques non disponibles.';

  return [
    `Missions totales=${stats.totalMissions ?? 0}`,
    `Certifiees=${stats.totalCertified ?? 0}`,
    `En attente=${stats.pendingMissions ?? 0}`,
    `Problemes=${stats.problemMissions ?? 0}`,
    `Indemnites=${stats.totalIndemnities ?? 0} FCFA`,
  ].join(' | ');
}

function summarizeRegions(regionalSummaries = []) {
  if (!Array.isArray(regionalSummaries) || regionalSummaries.length === 0) {
    return 'Aucun resume regional.';
  }

  return regionalSummaries
    .slice(0, 8)
    .map(region => {
      const assignedTrades = Object.entries(region.teamsAssigned || {})
        .map(([trade, count]) => `${trade}:${count}`)
        .join(', ');
      return `${region.region}: ${region.delayedHouseholds}/${region.totalHouseholds} en retard${
        assignedTrades ? ` | equipes ${assignedTrades}` : ''
      }`;
    })
    .join('\n');
}

function summarizeAuditLogs(auditLogs = []) {
  if (!Array.isArray(auditLogs) || auditLogs.length === 0) {
    return 'Aucune activite recente.';
  }

  return auditLogs
    .slice(0, 10)
    .map(log => {
      const label = trimText(log.action || log.message || log.title || 'Activite');
      const moduleName = trimText(log.moduleName || log.module || '', 40);
      const severity = trimText(log.severity || 'info', 20);
      return `- [${severity}] ${label}${moduleName ? ` (${moduleName})` : ''}`;
    })
    .join('\n');
}

function buildStateSummary(state = {}) {
  return [
    `Projet courant`,
    `- Stats: ${summarizeStats(state.stats)}`,
    `- Menages visibles: ${state.householdsCount ?? state.households?.length ?? 0}`,
    `- Equipes visibles: ${state.teamsCount ?? state.teams?.length ?? 0}`,
    `- Regions:\n${summarizeRegions(state.regionalSummaries)}`,
    `- Activite recente:\n${summarizeAuditLogs(state.auditLogs || state.recentAuditLogs)}`,
  ].join('\n');
}

function buildConversationHistory(history = []) {
  if (!Array.isArray(history) || history.length === 0) {
    return [];
  }

  return history
    .filter(entry => entry?.role && entry?.content)
    .slice(-MAX_HISTORY_TURNS)
    .map(entry => ({
      role: entry.role === 'assistant' ? 'assistant' : 'user',
      content: trimText(entry.content, 2000),
    }));
}

function buildPublicPrompt(query, user, state, history = []) {
  const historyText = buildConversationHistory(history)
    .map(entry => `${entry.role === 'assistant' ? 'Assistant' : 'Utilisateur'}: ${entry.content}`)
    .join('\n');

  const sysPrompt = buildSystemPrompt(user?.organizationName || 'GED OS', user?.projectSector || 'elec_bt');
  
  return `${sysPrompt}

// Référentiel technique injecté via buildSystemPrompt

4. STATUTS MÉNAGES (VALEURS LÉGALES) :
   - Non encore installée, Murs, Réseau, Intérieur, Contrôle conforme, Ménage non éligible, Problème.

--- 🗣️ SUPPORT WOLOF CRITIQUE ---
Pour les agents sur le terrain, utilise ces formules pour la sécurité :
- "Bul teg barrette terre ci biti" (Pas de barrette terre dehors).
- "Cutter ngay dieul, bul couper ak pince" (Utilise le cutter pour dénuder).
- "Ranger le fitt ci biir PVC" (Fils dans le tube PVC).

--- 🚫 INTERDICTIONS ---
- NE JAMAIS dire que la NF C 18-510 est spécifique à l'électrification rurale.
- NE JAMAIS inventer des chiffres ou des dates.
- NE JAMAIS suggérer une action qui contourne la validation du Chef de Projet.

Utilisateur actuel:
- Nom: ${user?.displayName || user?.name || 'Utilisateur'}
- Rôle: ${user?.role || 'inconnu'}

Données Serveur (Vérité Terrain):
${buildStateSummary(state)}

Historique de conversation:
${historyText || 'Aucun historique récent.'}

Question de l'utilisateur:
${query}`;
}

function buildVisionPrompt(query, user, state) {
  const orgName = user?.organizationName || 'GED OS';
  return `Tu es ${AI_REGISTRY.IDENTITY.name}, le contrôleur expert de ${orgName}. 
Analyse l'image fournie avec une précision chirurgicale.

--- 📜 RÉFÉRENTIEL DE CONTRÔLE VISUEL ---
1. BRANCHEMENT : Coffret en limite de propriété ? Hublot à 1.60m ? Câble à 4m/6m ? Protection PVC présente ?
2. INTÉRIEUR : Disjoncteur en zone couverte ? Câbles armés enterrés ? Pas de fils visibles (utilisation cutter) ?
3. ANOMALIES : Barrette terre externe interdite. Poteaux bois interdits.

--- 🗣️ SUPPORT MULTILINGUE ---
Si l'utilisateur est un 'Agent', tu peux ajouter une brève explication en Wolof pour les consignes de sécurité critiques (ex: "Bul teg barrette terre ci biti" pour "Ne pas mettre la barrette de terre à l'extérieur").

--- 🧠 CONSIGNES D'ANALYSE ---
- Détecte uniquement ce qui est RÉELLEMENT visible.
- Si un doute subsiste sur une mesure (ex: hauteur), demande une photo avec un mètre ruban.
- Ne jamais inventer de détails.

FORMAT OBLIGATOIRE:
1. Observation détaillée
2. Verdict: Conforme / Non conforme / A vérifier
3. Gravité: Critique / Majeure / Mineure
4. Règle de référence (Senelec / NS 01-001)
5. Risque identifié
6. Action corrective (en Français + Wolof si Agent)

Question: ${query || "Analyse visuelle de cette installation."}`;
}

async function callPollinations(prompt, image) {
  const endpoint = image
    ? `https://text.pollinations.ai/${encodeURIComponent(prompt)}?model=${encodeURIComponent(config.ai.pollinationsModel)}&image=${encodeURIComponent(image)}`
    : `https://text.pollinations.ai/${encodeURIComponent(prompt)}?model=${encodeURIComponent(config.ai.pollinationsModel)}`;

  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`Pollinations error ${response.status}`);
  }

  return (await response.text()).trim();
}

async function callAnthropic(query, user, state, history = []) {
  if (!config.ai.anthropicKey) {
    throw new Error('ANTHROPIC_API_KEY manquante sur le serveur.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.ai.anthropicTimeoutMs);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.ai.anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.ai.anthropicModel,
        max_tokens: config.ai.maxTokens,
        system:
          `Tu es ${AI_REGISTRY.IDENTITY.name}, assistant IA expert pour ${user?.organizationName || 'GED OS'}. Réponds en français. Sois précis, traçable et opérationnel. Si les données sont insuffisantes, dis-le explicitement.`,
        messages: [
          ...buildConversationHistory(history),
          {
            role: 'user',
            content: buildPublicPrompt(query, user, state, []),
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Anthropic error ${response.status}: ${body}`);
    }

    const data = await response.json();
    return data?.content?.[0]?.text?.trim() || '';
  } finally {
    clearTimeout(timer);
  }
}

async function callTextProvider(query, user, state, history = []) {
  const provider = DEFAULT_PROVIDER;
  const prompt = buildPublicPrompt(query, user, state, history);

  if (provider === 'LOCAL_OLLAMA') {
    return await queryOllama(prompt);
  }

  if (provider === 'CLAUDE_ANTHROPIC') {
    return await callAnthropic(query, user, state, history);
  }

  return await callPollinations(prompt);
}

export async function processMentorAI({ query, user, state = {}, history = [], image }) {
  try {
    if (image) {
      const text = await callPollinations(buildVisionPrompt(query, user, state), image);
      return {
        message: text,
        type: 'warning',
        _engine: 'VISION',
      };
    }

    const text = await callTextProvider(query, user, state, history);

    return {
      message: text || "Je n'ai pas pu produire une réponse exploitable.",
      type: 'info',
      _engine: DEFAULT_PROVIDER === 'LOCAL_OLLAMA' ? 'LOCAL_OLLAMA' : DEFAULT_PROVIDER,
    };
  } catch (error) {
    logger.error('[mentor.service] AI provider call failed', {
      error: error.message,
      provider: DEFAULT_PROVIDER,
    });

    return {
      message: image
        ? "L'analyse visuelle a échoué côté serveur. Vérifiez la qualité du cliché ou la disponibilité du moteur IA."
        : `Le moteur IA serveur est indisponible pour le moment. ${error.message || ''}`.trim(),
      type: 'error',
      _engine: image ? 'VISION_ERROR' : 'CLAUDE_FALLBACK',
    };
  }
}
