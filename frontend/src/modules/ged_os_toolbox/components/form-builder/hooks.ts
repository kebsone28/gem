/**
 * Hooks et utilitaires du Form Builder Ged OS Toolbox
 * Extraits de ToolboxSubmissions.tsx pour modularité
 */
import { useMemo } from 'react';
import type { BuilderLanguage, BuilderQuestion, BuilderQuestionType, BuilderAuditIssue, ProjectDraft } from './types';
import { builderFieldPalette, builderLanguages, builderQuestionLibrary, builderChoiceTypes, builderInlineChoiceTypes, builderQuestionTypeLabel } from './constants';
import { INTERNAL_GED_OS_CHOICES, INTERNAL_GED_OS_SECTIONS } from '@modules/terrain/components/toolboxFormDefinition';

// ── Génération d'ID ──

export const makeQuestionId = () => `q_${Date.now()}_${Math.random().toString(16).slice(2)}`;

// ── Normalisation ──

export const normalizeBuilderName = (value: string, fallback: string) => {
  if (!value) return fallback;
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_+$/g, '');
  return (normalized || fallback).slice(0, 48);
};

// ── Langues ──

export const getBuilderLanguageMeta = (language: BuilderLanguage) =>
  builderLanguages.find((item) => item.id === language) || builderLanguages[0];

export const getBuilderQuestionLabel = (question: BuilderQuestion, language: BuilderLanguage) =>
  question.labels?.[language] || question.label || question.name;

export const getBuilderQuestionHint = (question: BuilderQuestion, language: BuilderLanguage) =>
  question.hints?.[language] || question.hint || '';

// ── Questions ──

export const getBlankBuilderQuestions = (): BuilderQuestion[] => [
  {
    id: makeQuestionId(),
    type: 'integer',
    name: 'Numero_ordre',
    label: 'Numero ordre',
    hint: 'Identifiant menage relie a la base VPS',
    required: true,
  },
  {
    id: makeQuestionId(),
    type: 'text',
    name: 'nom_key',
    label: 'Prenom et Nom',
    calculation: "pulldata('Thies','nom','code_key',${Numero_ordre})",
    required: true,
  },
  {
    id: makeQuestionId(),
    type: 'select_one',
    name: 'role',
    label: 'Votre role',
    listName: 'roles',
    required: true,
  },
];

export const getTemplateBuilderQuestions = (): BuilderQuestion[] => [
  ...getBlankBuilderQuestions(),
  {
    id: makeQuestionId(),
    type: 'select_one',
    name: 'kit_disponible_macon',
    label: 'Le kit est-il disponible et complet ?',
    listName: 'oui_non',
    required: true,
    relevant: "${role} = 'macon'",
  },
  {
    id: makeQuestionId(),
    type: 'text',
    name: 'notes_generales',
    label: 'Notes generales',
    required: true,
  },
];

export const getInternalGemBuilderQuestions = (): BuilderQuestion[] => {
  const questions: BuilderQuestion[] = [];
  const usedNames = new Set<string>();

  INTERNAL_GED_OS_SECTIONS.forEach((section: any) => {
    section.fields.forEach((field: any) => {
      const typePart = field.type.split(' ')[0];
      const validTypes: BuilderQuestionType[] = [
        'select_one', 'select_multiple', 'rank', 'text', 'integer', 'decimal',
        'note', 'geopoint', 'image', 'signature', 'file', 'date', 'datetime', 'calculate', 'hidden',
      ];
      const type = (validTypes.includes(typePart as BuilderQuestionType) ? typePart : 'text') as BuilderQuestionType;

      let name = field.name;
      if (
        usedNames.has(name) &&
        !['Numero_ordre', 'nom_key', 'telephone_key', 'latitude_key', 'longitude_key', 'region_key', 'role'].includes(name)
      ) {
        name = `${name}_${section.id}`;
      }
      usedNames.add(name);

      const listName =
        field.listName || (field.type.includes(' ') ? field.type.split(' ')[1] : undefined);

      const choices =
        listName && (INTERNAL_GED_OS_CHOICES as any)[listName]
          ? (INTERNAL_GED_OS_CHOICES as any)[listName].map((c: any) => ({
              name: c.name,
              label: c.label,
            }))
          : undefined;

      questions.push({
        id: makeQuestionId(),
        type,
        name,
        label: field.label,
        hint: field.hint,
        required: field.required,
        listName,
        choices,
        relevant: field.relevant,
        readOnly: field.readOnly,
      });
    });
  });
  return questions;
};

export const getBuilderTypeForSurvey = (question: BuilderQuestion) => {
  if (question.type === 'select_one') return `select_one ${question.listName || 'oui_non'}`;
  if (question.type === 'select_multiple') return `select_multiple ${question.listName || 'oui_non'}`;
  if (question.type === 'select_one_from_file') return `select_one_from_file ${question.listName || 'external_choices.csv'}`;
  if (question.type === 'select_multiple_from_file') return `select_multiple_from_file ${question.listName || 'external_choices.csv'}`;
  if (question.type === 'rank') return 'text';
  if (question.type === 'acknowledge') return 'trigger';
  if (question.type === 'xml_external') return 'xml-external';
  return question.type;
};

export const createBuilderQuestion = (type: BuilderQuestionType, index: number): BuilderQuestion => {
  const paletteItem = builderFieldPalette.find((item) => item.type === type);
  const baseName = normalizeBuilderName(`${type}_${index}`, `question_${index}`);
  return {
    id: makeQuestionId(),
    type,
    name: baseName,
    label: paletteItem?.label || `Question ${index}`,
    hint: paletteItem?.description || '',
    labels: { fr: paletteItem?.label || `Question ${index}` },
    hints: paletteItem?.description ? { fr: paletteItem.description } : undefined,
    listName: paletteItem?.defaultListName,
    choices: paletteItem?.defaultChoices,
    appearance: paletteItem?.appearance,
    required: false,
  };
};

export const cloneBuilderQuestion = (
  question: BuilderQuestion,
  options: { preserveId?: boolean; name?: string; label?: string } = {}
): BuilderQuestion => ({
  ...question,
  id: options.preserveId ? question.id : makeQuestionId(),
  name: options.name ?? question.name,
  label: options.label ?? question.label,
  labels: question.labels ? { ...question.labels } : undefined,
  hints: question.hints ? { ...question.hints } : undefined,
  choices: question.choices?.map((choice) => ({ ...choice })),
});

export const cloneBuilderQuestions = (questions: BuilderQuestion[]) =>
  questions.map((question) => cloneBuilderQuestion(question, { preserveId: true }));

export const getUniqueBuilderQuestionName = (baseName: string, questions: BuilderQuestion[]) => {
  const normalizedBase = normalizeBuilderName(baseName, 'question');
  let candidate = normalizedBase;
  let index = 2;
  while (questions.some((question) => question.name === candidate)) {
    candidate = normalizeBuilderName(`${normalizedBase}_${index}`, `question_${index}`);
    index += 1;
  }
  return candidate;
};

// ── Audit ──

export const auditBuilderProject = (
  projectDraft: ProjectDraft,
  questions: BuilderQuestion[]
): BuilderAuditIssue[] => {
  const issues: BuilderAuditIssue[] = [];
  const names = questions.map((question) => question.name.trim()).filter(Boolean);
  const duplicateNames = names.filter((name, index) => names.indexOf(name) !== index);

  Array.from(new Set(duplicateNames)).forEach((name) => {
    issues.push({
      level: 'warning',
      title: `Champ duplique: ${name}`,
      detail: 'Ce champ sera automatiquement renomme avant sauvegarde pour eviter les collisions.',
    });
  });

  const normalizedRoleNames = new Set(INTERNAL_GED_OS_CHOICES.roles.map((role: any) => role.name));

  if (!projectDraft.title.trim()) {
    issues.push({
      level: 'error',
      title: 'Nom du projet manquant',
      detail: 'Kobo exige un titre avant de sauvegarder ou deployer un formulaire.',
    });
  }

  if (!questions.length) {
    issues.push({
      level: 'error',
      title: 'Aucun champ dans le formulaire',
      detail: 'Ajoutez au moins une question avant de creer un brouillon VPS.',
    });
  }

  if (!projectDraft.allowedRoles.length) {
    issues.push({
      level: 'error',
      title: 'Aucun role autorise',
      detail: 'Definissez les roles ou equipes autorises avant la collecte terrain.',
    });
  }

  if (!projectDraft.languages.includes(projectDraft.defaultLanguage)) {
    issues.push({
      level: 'error',
      title: 'Langue par defaut inactive',
      detail: 'La langue par defaut doit faire partie des langues XLSForm activees.',
    });
  }

  questions.forEach((question, index) => {
    const label = question.label.trim();
    const name = question.name.trim();

    if (!name) {
      issues.push({
        level: 'error',
        title: `Champ ${index + 1}: nom vide`,
        detail: 'Le nom technique est obligatoire dans la feuille survey.',
        questionId: question.id,
      });
    }

    if (!label && question.type !== 'hidden' && question.type !== 'xml_external') {
      issues.push({
        level: 'error',
        title: `Champ ${name || index + 1}: libelle vide`,
        detail: 'Un libelle lisible est requis pour les agents terrain.',
        questionId: question.id,
      });
    }

    if (builderChoiceTypes.has(question.type) && !question.listName?.trim()) {
      issues.push({
        level: 'error',
        title: `Liste de choix manquante: ${name || label}`,
        detail: 'Les questions de choix doivent pointer vers une liste XLSForm.',
        questionId: question.id,
      });
    }

    if (builderInlineChoiceTypes.has(question.type)) {
      const choices = question.choices || [];
      if (!choices.length) {
        issues.push({
          level: 'error',
          title: `Choix vides: ${name || label}`,
          detail: 'Ajoutez les options possibles ou utilisez un choix depuis fichier CSV.',
          questionId: question.id,
        });
      }
      const choiceNames = choices.map((choice) => choice.name.trim()).filter(Boolean);
      const duplicateChoices = choiceNames.filter(
        (choiceName, choiceIndex) => choiceNames.indexOf(choiceName) !== choiceIndex
      );
      if (duplicateChoices.length) {
        issues.push({
          level: 'error',
          title: `Valeur de choix dupliquee: ${name || label}`,
          detail: 'Deux choix ne peuvent pas avoir la meme valeur technique.',
          questionId: question.id,
        });
      }
      if (question.type === 'rank' && choices.length < 2) {
        issues.push({
          level: 'warning',
          title: `Classement trop court: ${name || label}`,
          detail: 'Un champ rank est utile avec au moins deux options a ordonner.',
          questionId: question.id,
        });
      }
    }

    if (
      (question.type === 'select_one_from_file' || question.type === 'select_multiple_from_file') &&
      !String(question.listName || '').includes('.csv')
    ) {
      issues.push({
        level: 'warning',
        title: `CSV externe a verifier: ${name || label}`,
        detail: 'Kobo attend generalement le nom du fichier externe, par exemple choix.csv.',
        questionId: question.id,
      });
    }

    if (question.type === 'calculate' && !question.calculation?.trim()) {
      issues.push({
        level: 'warning',
        title: `Calcul vide: ${name || label}`,
        detail: 'Un champ calculate doit contenir une expression XLSForm.',
        questionId: question.id,
      });
    }

    if (question.type === 'hidden' && !question.defaultValue?.trim() && !question.calculation?.trim()) {
      issues.push({
        level: 'warning',
        title: `Champ cache sans valeur: ${name || label}`,
        detail: 'Definissez une valeur par defaut ou un calcul pour que le champ cache soit utile.',
        questionId: question.id,
      });
    }

    if (question.type === 'range' && !question.parameters?.trim()) {
      issues.push({
        level: 'warning',
        title: `Curseur sans bornes: ${name || label}`,
        detail: 'Ajoutez des parametres start/end/step pour cadrer la saisie terrain.',
        questionId: question.id,
      });
    }

    projectDraft.languages.forEach((language) => {
      if (language === projectDraft.defaultLanguage) return;
      if (!question.labels?.[language]?.trim() && label) {
        issues.push({
          level: 'warning',
          title: `Traduction ${getBuilderLanguageMeta(language).label} manquante`,
          detail: `${label} utilisera le libelle principal si la langue est activee.`,
          questionId: question.id,
        });
      }
    });
  });

  const numeroQuestion = questions.find((question) => question.name === 'Numero_ordre');
  if (!numeroQuestion) {
    issues.push({
      level: 'error',
      title: 'Numero ordre absent',
      detail: 'Le rattachement menage VPS ne peut pas fonctionner sans ce champ.',
    });
  } else if (!numeroQuestion.required) {
    issues.push({
      level: 'warning',
      title: 'Numero ordre non obligatoire',
      detail: 'Il devrait rester requis pour garantir la liaison avec la base menage.',
      questionId: numeroQuestion.id,
    });
  }

  const roleQuestion = questions.find((question) => question.name === 'role');
  if (!roleQuestion) {
    issues.push({
      level: 'error',
      title: 'Passage role absent',
      detail: 'La logique metier GED OS/Kobo depend du champ role pour ouvrir les etapes.',
    });
  } else {
    if (roleQuestion.type !== 'select_one' || roleQuestion.listName !== 'roles') {
      issues.push({
        level: 'warning',
        title: 'Role non aligne sur la liste officielle',
        detail: 'Utilisez select_one roles pour conserver les branchements existants.',
        questionId: roleQuestion.id,
      });
    }
    const roleChoices = (roleQuestion.choices || INTERNAL_GED_OS_CHOICES.roles).map(
      (choice: any) => choice.name
    );
    if (!roleChoices.some((role) => normalizedRoleNames.has(role))) {
      issues.push({
        level: 'warning',
        title: 'Choix role non reconnus',
        detail: 'Les raccourcis metier attendent les roles Livreur, Macon, Reseau, Installateur, Controleur.',
        questionId: roleQuestion.id,
      });
    }
  }

  if (!questions.some((question) =>
    ['image', 'signature', 'file', 'audio', 'video'].includes(question.type)
  )) {
    issues.push({
      level: 'warning',
      title: 'Aucune preuve media',
      detail: 'Ajoutez photo, signature ou fichier pour rapprocher la collecte de KoboCollect.',
    });
  }

  if (projectDraft.requireLatestVersion && projectDraft.draftMigrationMode === 'preserve') {
    issues.push({
      level: 'warning',
      title: 'Politique version contradictoire',
      detail: 'Version recente requise et preservation ancienne version peuvent bloquer certains brouillons.',
    });
  }

  return issues.slice(0, 40);
};

// ── Hook pour filtrer la bibliothèque ──

export const useFilteredQuestionLibrary = (query: string) =>
  useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return builderQuestionLibrary;
    return builderQuestionLibrary.filter((block) =>
      `${block.title} ${block.description}`.toLowerCase().includes(q)
    );
  }, [query]);

// ── Hook pour l'audit ──

export const useBuilderAudit = (projectDraft: ProjectDraft, questions: BuilderQuestion[]) =>
  useMemo(() => {
    const issues = auditBuilderProject(projectDraft, questions);
    const errors = issues.filter((i) => i.level === 'error');
    const warnings = issues.filter((i) => i.level === 'warning');
    const score = Math.max(0, Math.min(100, Math.round(100 - errors.length * 18 - warnings.length * 5)));
    return { issues, errors, warnings, score };
  }, [projectDraft, questions]);
