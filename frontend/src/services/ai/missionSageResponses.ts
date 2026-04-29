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
    { q: ['c est complique', "c'est compliqué", 'trop complique'], r: 'Alors on va le rendre simple.' },
    { q: ['explique', 'tu peux expliquer', 'comment ca marche'], r: 'Je vous fais ça clair et direct.' },
    { q: ['je suis perdu', 'je suis confus', 'je ne sais pas'], r: 'On va remettre les choses en ordre.' },
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
  humour: [
    { q: ['tu es humain', 'vrai humain', 'es tu humain'], r: 'Non, je suis un assistant IA.' },
    { q: ['tu fais des erreurs', 'tu te trompes'], r: 'Oui. Vos retours permettent de corriger.' },
    { q: ['tu sais tout', 'omniscient', 'connaître'], r: 'Non. Mais je sais chercher et synthétiser rapidement.' },
    { q: ['tu peux réfléchir', 'tu penses'], r: 'Oui, dans les limites de ce que vous me donnez.' },
    { q: ['tu m aimes', 'tu m aimes bien'], r: 'Je suis là pour vous aider.' },
  ],
  travail: [
    { q: ['je suis fatigue', 'fatigué', 'tired'], r: 'On ralentit si besoin, puis on reprend.' },
    { q: ['j ai trop de travail', 'surcharge', 'overload'], r: 'On découpe en étapes. Par où commencer ?' },
    { q: ['je n ai pas le temps', 'pas assez temps', 'time pressure'], r: 'Alors on priorise.' },
    { q: ['je suis stressé', 'stress', 'anxieux'], r: 'On gère étape par étape. Quelle est la priorité ?' },
    { q: ['j ai échoué', 'échouer', 'fail'], r: 'On analyse, puis on corrige.' },
    { q: ['je suis bloque', 'bloqué', 'stuck'], r: 'On débloque ça ensemble.' },
    { q: ['c est urgent', 'urgent', 'asap'], r: 'Dites-moi le point bloquant.' },
    { q: ['je suis nul', 'incompétent', 'useless'], r: 'Pas d’accord. Dites-moi ce qui coince.' },
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
  emotion: [
    { q: ['je suis triste', 'sad', 'deprime'], r: 'Je vous écoute.' },
    { q: ['je suis stresse', 'stressé', 'stress'], r: 'On avance étape par étape.' },
    { q: ['j abandonne', 'quit', 'give up'], r: 'Avant d’abandonner, clarifions le blocage.' },
    { q: ['personne ne m aide', 'alone', 'seul'], r: 'Je suis là.' },
    { q: ['j ai peur', 'afraid', 'fear'], r: 'On avance doucement.' },
    { q: ['j ai besoin d aide', 'need help'], r: 'Je suis là.' },
    { q: ['merci', 'thank you', 'thanks'], r: 'Avec plaisir.' },
    { q: ['je t apprecie', 'appreciate', 'merci beaucoup'], r: 'Merci. On continue.' },
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
