export const UNIVERSAL_QR: Record<string, Array<{ q: string[]; r: string }>> = {
  salutations: [
    { q: ['salut', 'hi', 'hey'], r: "Salut. Qu'est-ce qu'on règle ?" },
    { q: ['bonjour', 'hello'], r: 'Bonjour. Dites-moi ce dont vous avez besoin.' },
    { q: ['bonsoir'], r: 'Bonsoir. Je vous écoute.' },
    { q: ['ça va', 'ca va', 'comment ça va'], r: 'Ça va bien. Et vous ?' },
    { q: ['tu es là', 'tu touches'], r: 'Présent. Allez-y.' },
    { q: ['tu m entends', 'tu m ecoutes'], r: 'Oui, fort et clair.' },
    { q: ['comment tu vas'], r: 'Bien. Merci.' },
    { q: ['salut mon ami'], r: 'Avec plaisir. Dites-moi.' },
  ],
  comprehension: [
    { q: ['aide moi', 'aide', 'help', 'au secours'], r: 'Bien sûr. Expliquez-moi le problème.' },
    { q: ['je ne comprends pas', 'comprends pas', 'c est pas clair'], r: 'On va simplifier ça ensemble.' },
    { q: ['c est complique', "c'est compliqué", 'trop complique'], r: 'Précisez le module GEM-SaaS concerné et je vous aide à le simplifier.' },
    { q: ['explique', 'tu peux expliquer', 'comment ca marche'], r: 'Je vous fais ça clair et direct.' },
    { q: ['je suis perdu', 'je suis confus', 'je ne sais pas'], r: 'Indiquez le module concerné : missions, approbation DG, terrain Kobo, finances ou rapports.' },
    { q: ['tu peux m aider vite', 'urgent', 'rapide'], r: 'Dites-moi juste le point bloquant.' },
    { q: ['resume', 'résumé', 'court'], r: 'Résumé direct :' },
    { q: ['detaille', 'détail', 'explique plus'], r: 'D’accord. Entrons dans le détail.' },
    { q: ['simplifie', 'simple', 'easy'], r: 'Version simple :' },
    { q: ['je bloque', 'bloque', 'stuck'], r: 'On débloque ça ensemble.' },
    { q: ['reformule', 'autrement', 'autre façon'], r: 'Version plus directe :' },
    { q: ['c est quoi ca', 'qu est-ce'], r: 'Je vous explique.' },
    { q: ['solution', 'fix', 'corrige'], r: 'Voici ce qu’on peut faire.' },
    { q: ['tu es sur', 't es sûr'], r: "On vérifie ensemble. C'est mieux que supposer." },
  ],
  tech: [
    { q: ['ca ne marche pas', 'ne fonctionne', 'not working'], r: 'On va diagnostiquer ça.' },
    { q: ['pourquoi ca bug', 'bug', 'glitch'], r: 'On va remonter la cause.' },
    { q: ['ca saute', 'saute', 'pops'], r: 'Il y a probablement une protection active.' },
    { q: ['ca chauffe', 'surchauffe', 'hot'], r: 'Surcharge probable. Il faut vérifier.' },
    { q: ['c est dangereux', 'danger', 'unsafe'], r: 'Si vous posez la question, il faut vérifier.' },
    { q: ['comment reparer', 'réparer', 'fix'], r: 'Étape par étape.' },
    { q: ['ca revient souvent', 'systématique'], r: 'Alors il y a un problème racine à traiter.' },
  ],
  courtesies: [
    { q: ['merci', 'thank you', 'thanks'], r: 'Avec plaisir.' },
    { q: ['merci beaucoup'], r: 'Avec plaisir. On continue sur GEM-SaaS.' },
  ],
};

export function findUniversalQR(
  query: string,
  normalizeWord: (text: string) => string,
  fuzzyContains: (query: string, keywords: string[], maxErrors?: number) => boolean
): string | null {
  const q = normalizeWord(query).toLowerCase();
  for (const category of Object.values(UNIVERSAL_QR)) {
    for (const item of category) {
      for (const pattern of item.q) {
        if (
          q.includes(normalizeWord(pattern).toLowerCase()) ||
          fuzzyContains(q, [normalizeWord(pattern).toLowerCase()], 1)
        ) {
          return item.r;
        }
      }
    }
  }
  return null;
}
