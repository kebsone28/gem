import type { CahierTask, TaskLibrary, CahierGuideBlock } from '@utils/types';
import type { ContractTemplate, ContractTemplateLibrary } from '@/data/contractTemplates';
import type { OperationalStrategyTemplate } from '@/data/operationalStrategyTemplates';
import { DEFAULT_TASK_LIBRARY } from '@/data/cahierTaskLibrary';
import { DEFAULT_CONTRACT_TEMPLATES } from '@/data/contractTemplates';

const CONTRACTUAL_TEXT_PATTERN =
  /p[eé]nalit|paiement|caution|factur|r[eé]siliation|juridiction|contract|sous-trait|honoraire|montant du lot|retenue|faute grave|responsabilit[eé] civile|poursuite|blocage des paiements|exclusion du march[eé]/i;

export function isContractHeading(line: string): boolean {
  return /^Article\s+\d+/i.test(line) || /^\d+\.\d+/.test(line) || line === line.toUpperCase();
}

export function buildContractTemplateFromText(
  template: ContractTemplate,
  rawContent: string
): ContractTemplate {
  const content = rawContent
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return {
    ...template,
    content,
  };
}

export function mergeContractLibraryWithDefaults(saved: ContractTemplateLibrary): ContractTemplateLibrary {
  const merged: ContractTemplateLibrary = { ...DEFAULT_CONTRACT_TEMPLATES, ...saved };

  Object.keys(DEFAULT_CONTRACT_TEMPLATES).forEach((lot) => {
    const savedTemplate = saved[lot];
    const hasPlaceholder =
      !savedTemplate ||
      savedTemplate.content.length <= 3 ||
      savedTemplate.content.some((line) => /MOD[EÈ]LE\s+[ÀA]\s+COMPL[EÉ]TER/i.test(line));
    const hasOutdatedLotSplit =
      (lot === 'LOT B' &&
        savedTemplate?.content?.some((line) =>
          /pose de potelets, supports ext[eé]rieurs/i.test(line)
        )) ||
      (lot === 'LOT C' &&
        savedTemplate?.content?.some((line) =>
          /pose ou v[eé]rification des supports, potelets/i.test(line)
        ));

    if (hasPlaceholder || hasOutdatedLotSplit) {
      merged[lot] = DEFAULT_CONTRACT_TEMPLATES[lot];
    }
  });

  return merged;
}

export function restoreTaskLibraryIcons(library: TaskLibrary): TaskLibrary {
  const restored = { ...library };
  Object.keys(restored).forEach((key) => {
    if (DEFAULT_TASK_LIBRARY[key]) {
      restored[key] = {
        ...DEFAULT_TASK_LIBRARY[key],
        ...restored[key],
        icon: DEFAULT_TASK_LIBRARY[key].icon,
      };
    }
  });
  return sanitizeTaskLibraryForCahier(restored);
}

export function serializeTaskLibrary(library: TaskLibrary): TaskLibrary {
  const sanitizedLibrary = sanitizeTaskLibraryForCahier(library);
  return Object.fromEntries(
    Object.entries(sanitizedLibrary).map(([key, task]) => {
      const { icon: _icon, ...serializableTask } = task as any;
      return [key, serializableTask];
    })
  ) as TaskLibrary;
}

export function removeContractualSentences(text: string): string {
  return text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !CONTRACTUAL_TEXT_PATTERN.test(sentence))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function cleanTechnicalLine(line: string): string {
  const cleaned = removeContractualSentences(line)
    .replace(/\s*Le non-respect.*$/i, '')
    .replace(/\s*Leur absence.*$/i, '')
    .replace(/\s*L'absence.*$/i, '')
    .replace(/\s*Les infractions.*$/i, '')
    .replace(/\s*Tout dommage.*$/i, '')
    .replace(/\s*Toute omission.*$/i, '')
    .replace(/\s*Tout défaut.*$/i, '')
    .replace(/\s*Les fouilles non sécurisées.*$/i, '')
    .replace(/\s*Ces données constituent.*$/i, '')
    .replace(/\s*Ce PV est une condition.*$/i, '')
    .replace(/\s*Il doit souscrire.*$/i, '')
    .trim();

  if (!cleaned) return '';
  return cleaned.endsWith('.') || cleaned.endsWith(':') ? cleaned : `${cleaned}.`;
}

export function buildTechnicalIntroduction(roleName: string, fallback: string): string {
  const introByRole: Record<string, string> = {
    Électricien:
      'Référentiel technique pour l’installation intérieure des ménages : tableau, protections, circuits, mise à la terre, essais et traçabilité terrain selon NS 01-001, NF C 15-100 et prescriptions PROQUELEC.',
    Maçonnerie:
      'Référentiel technique pour les ouvrages du Lot B : mur support, scellements, potelet, coffret de comptage, tranchées et finitions nécessaires à une pose stable, contrôlable et durable.',
    'Réseau Extérieur':
      'Référentiel technique pour le branchement extérieur : reconnaissance réseau, tirage du câble préassemblé, protections mécaniques liées au câble, entrée coffret et contrôles avant mise sous tension.',
    Logistique:
      'Référentiel opérationnel pour les flux de matériel : préparation, traçabilité, transport sécurisé, bordereaux, livraison terrain et gestion des rebuts.',
    'Audit & Contrôle Qualité (PROQUELEC)':
      'Référentiel de contrôle PROQUELEC : vérifications terrain, essais, photos géolocalisées, constats de conformité et réserves techniques avant validation.',
  };

  return roleName in introByRole ? introByRole[roleName] : cleanTechnicalLine(fallback);
}

export function sanitizeKoboGuideBlock(block: CahierGuideBlock): CahierGuideBlock {
  return {
    ...block,
    intro: block.intro ? cleanTechnicalLine(block.intro) : undefined,
    checks: block.checks.map(cleanTechnicalLine).filter(Boolean),
    blockers: (block.blockers || []).map(cleanTechnicalLine).filter(Boolean),
    completion: (block.completion || []).map(cleanTechnicalLine).filter(Boolean),
  };
}

export function sanitizeTaskForCahier(roleName: string, task: CahierTask): CahierTask {
  return {
    ...task,
    introduction: buildTechnicalIntroduction(roleName, task.introduction),
    missions: task.missions.map(cleanTechnicalLine).filter(Boolean),
    koboGuide: (task.koboGuide || []).map(sanitizeKoboGuideBlock).filter((block) => {
      return (
        block.checks.length > 0 ||
        (block.blockers || []).length > 0 ||
        (block.completion || []).length > 0
      );
    }),
    executionGuide: task.executionGuide,
    qualityChecklist: task.qualityChecklist,
    technicalImages: task.technicalImages,
    hse: task.hse.map(cleanTechnicalLine).filter(Boolean),
    subcontracting: [],
    finances: [],
    legal: [],
    pricing: undefined,
  };
}

export function sanitizeTaskLibraryForCahier(library: TaskLibrary): TaskLibrary {
  return Object.fromEntries(
    Object.entries(library).map(([roleName, task]) => [
      roleName,
      sanitizeTaskForCahier(roleName, task),
    ])
  ) as TaskLibrary;
}

export function buildStrategyTemplateFromText(
  template: OperationalStrategyTemplate,
  rawContent: string
): OperationalStrategyTemplate {
  const content = rawContent
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return {
    ...template,
    content,
  };
}

export function isStrategyHeading(line: string): boolean {
  return (
    /^\d+\.\s+/.test(line) ||
    /^ZONE\s+/i.test(line) ||
    /^Grappe\s+/i.test(line) ||
    /^LOT\s+[A-C]/i.test(line) ||
    /^Étape\s+\d+/i.test(line) ||
    /^[A-C]\.\s+/.test(line)
  );
}

export function getFilteredRolesToDisplay(
  customLibrary: TaskLibrary,
  user: any,
  isAdmin: boolean
): [string, CahierTask][] {
  const filtered = Object.entries(customLibrary).filter(([name]) => {
    if (isAdmin) return true;
    const userSearch = (
      user?.name + ' ' + user?.role + ' ' + (user as any)?.displayName || ''
    ).toLowerCase();
    const roleKey = name.toLowerCase();

    return (
      userSearch.includes(roleKey) ||
      roleKey.includes(userSearch.split(' ')[0].toLowerCase()) ||
      (name.includes('Maçonnerie') &&
        (userSearch.includes('macon') || userSearch.includes('maçon'))) ||
      (name.includes('Électricien') &&
        (userSearch.includes('elect') || userSearch.includes('élec'))) ||
      (name.includes('Réseau') && (userSearch.includes('res') || userSearch.includes('élec'))) ||
      (name.includes('Logistique') &&
        (userSearch.includes('log') || userSearch.includes('livr'))) ||
      (name.includes('Audit') && (userSearch.includes('audit') || userSearch.includes('contr')))
    );
  });
  return filtered.length > 0 ? filtered : (Object.entries(customLibrary) as [string, CahierTask][]);
}
