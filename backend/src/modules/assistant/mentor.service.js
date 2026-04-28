import { config } from '../../core/config/config.js';
import logger from '../../utils/logger.js';
import { queryOllama } from './ollama.client.js';

const DEFAULT_PROVIDER = config.ai.provider || 'PUBLIC_POLLINATIONS';
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

  return `Tu es GEM-MINT, assistant expert PROQUELEC.
Réponds en français.
Sois exact, sobre, utile.
Quand l'information manque, dis-le clairement.
Pour les sujets techniques, parle comme un contrôleur électrotechnique.

Utilisateur
- Nom: ${user?.displayName || user?.name || 'Utilisateur'}
- Role: ${user?.role || 'inconnu'}

Contexte serveur
${buildStateSummary(state)}

Historique recent
${historyText || 'Aucun historique recent.'}

Question
${query}`;
}

function buildVisionPrompt(query, user, state) {
  return `Tu es un contrôleur électrotechnique PROQUELEC.
Analyse l'image d'installation électrique fournie.

Utilisateur
- Nom: ${user?.displayName || user?.name || 'Utilisateur'}
- Role: ${user?.role || 'Technicien'}

Contexte serveur
${buildStateSummary(state)}

Consignes
- Détecter uniquement ce qui est visible.
- Ne jamais inventer un détail absent.
- Si le cliché est insuffisant, le dire explicitement.
- Employer une formulation de contrôle terrain.

FORMAT OBLIGATOIRE:
1. Observation
2. Verdict: Conforme / Non conforme / A verifier
3. Gravite: critique / majeure / mineure
4. Regle de reference: Senelec ou NS 01-001
5. Risque principal
6. Action corrective immediate

Question
${query || "Analyse visuelle de cette installation."}`;
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
          'Tu es GEM-MINT, assistant IA expert PROQUELEC. Réponds en français. Sois précis, traçable et opérationnel. Si les données sont insuffisantes, dis-le explicitement.',
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
      _engine: DEFAULT_PROVIDER === 'LOCAL_OLLAMA' ? 'CLAUDE_FALLBACK' : 'CLAUDE',
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
