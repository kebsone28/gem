const LOCAL_KNOWLEDGE = [
  {
    patterns: [/\bbonjour\b|\bsalut\b|\bhello\b|\bhey\b/i],
    response: 'Bonjour ! Je suis Mission Sage, ton assistant terrain PROQUELEC. Dis-moi comment je peux t’aider aujourd’hui.'
  },
  {
    patterns: [/\bcomment ça va\b|\bça va\b|\bcomment vas[- ]tu\b/i],
    response: 'Ça va bien, merci ! Je suis prêt à t’accompagner sur ton chantier et tes ordres de mission.'
  },
  {
    patterns: [/\bquel est ton nom\b|\bcomment tu t appel(le)?\b|\bton nom\b/i],
    response: 'Je suis Mission Sage, ton assistant terrain électrique PROQUELEC.'
  },
  {
    patterns: [/\bquelle heure\b|\bheure est[- ]il\b/i],
    response: () => {
      const date = new Date();
      return `Il est ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.`;
    }
  },
  {
    patterns: [/\bquelle date\b|\bjour sommes[- ]nous\b|\baujourd'hui\b/i],
    response: () => {
      const date = new Date();
      return `Nous sommes ${date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.`;
    }
  },
  {
    patterns: [/\bmerci\b|\bthank you\b|\bthanks\b/i],
    response: 'Avec plaisir ! Si tu as besoin de plus de détails, je suis là pour toi.'
  }
];

function normalizeMessage(message) {
  return String(message || '').trim().toLowerCase();
}

export class MissionSageService {
  answer(message) {
    const text = normalizeMessage(message);

    for (const item of LOCAL_KNOWLEDGE) {
      if (item.patterns.some((pattern) => pattern.test(text))) {
        if (typeof item.response === 'function') {
          return item.response();
        }
        return item.response;
      }
    }

    if (/\burgence\b|\bimmédiat\b|\barrêt\b/i.test(text)) {
      return 'En cas d’urgence, vérifie d’abord l’arrêt de tous les circuits et contacte ton chef de chantier. Explique-moi le détail si tu veux que je t’aide à prioriser.';
    }

    return 'Je n’ai pas de réponse locale précise pour cette demande. Donne-moi un peu plus de contexte ou je peux te proposer une piste technique simple.';
  }
}
