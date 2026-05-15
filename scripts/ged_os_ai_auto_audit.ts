import fs from 'node:fs/promises';
import path from 'node:path';
import {
  buildOverrideCatalog,
  compareAnswerPair,
  formatOverrideModule,
  generateDeepAuditQuestions,
  normalizeAuditQuestion,
  type DeepAuditQuestion,
} from '../frontend/src/services/ai/MissionSageAuditReferential.ts';

type AuditMode = 'live' | 'reference-only';

interface CliOptions {
  mode: AuditMode;
  baseUrl: string;
  login?: string;
  password?: string;
  twoFactor?: string;
  limit: number;
  delayMs: number;
  applyOverrides: boolean;
  outputDir: string;
  docPaths: string[];
}

interface AuditResultRow {
  id: string;
  domain: string;
  question: string;
  aiAnswer: string;
  referenceAnswer: string;
  aiScore: number;
  referenceScore: number;
  preferredAnswer: 'ai' | 'reference';
  aiIssues: string[];
  referenceIssues: string[];
  aiEngine?: string;
  durationMs: number;
  error?: string;
}

const DEFAULT_BASE_URL = 'http://localhost:5005/api';
const DEFAULT_DOCS = [
  'MISSION_SAGE_INTEGRATION_README.md',
  'TERRAIN_KNOWLEDGE_BASE.md',
  'ASSISTANTS_AI_GUIDE.md',
  'AI_INTEGRATION_GUIDE.md',
];

const DEFAULT_CONTEXT = {
  stats: {
    totalMissions: 184,
    totalCertified: 142,
    totalIndemnities: 26500000,
  },
  householdsCount: 3536,
  teamsCount: 6,
  regionalSummaries: [
    {
      region: 'Dakar',
      totalHouseholds: 1220,
      delayedHouseholds: 88,
      teamsAssigned: { livraison: 1, reseau: 1, interieur: 1 },
    },
    {
      region: 'Thiès',
      totalHouseholds: 846,
      delayedHouseholds: 41,
      teamsAssigned: { maconnerie: 1, reseau: 1 },
    },
    {
      region: 'Saint-Louis',
      totalHouseholds: 1470,
      delayedHouseholds: 133,
      teamsAssigned: { formation: 1, controle: 1 },
    },
  ],
  auditLogs: [
    {
      action: 'CERTIFICATION_MISSION',
      moduleName: 'Mission',
      severity: 'info',
      createdAt: new Date().toISOString(),
    },
    {
      action: 'ALERTE_RETARD_REGION',
      moduleName: 'Planning',
      severity: 'warning',
      createdAt: new Date().toISOString(),
    },
    {
      action: 'ANOMALIE_TERRAIN_CRITIQUE',
      moduleName: 'Terrain',
      severity: 'critical',
      createdAt: new Date().toISOString(),
    },
  ],
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    mode: 'live',
    baseUrl: DEFAULT_BASE_URL,
    limit: 1200,
    delayMs: 250,
    applyOverrides: false,
    outputDir: path.resolve(process.cwd(), 'reports', 'mission-sage-audit'),
    docPaths: DEFAULT_DOCS.map((docPath) => path.resolve(process.cwd(), docPath)),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    switch (arg) {
      case '--mode':
        if (next === 'live' || next === 'reference-only') options.mode = next;
        index += 1;
        break;
      case '--base-url':
        options.baseUrl = next;
        index += 1;
        break;
      case '--login':
        options.login = next;
        index += 1;
        break;
      case '--password':
        options.password = next;
        index += 1;
        break;
      case '--two-factor':
        options.twoFactor = next;
        index += 1;
        break;
      case '--limit':
        options.limit = Number.parseInt(next || '1200', 10) || 1200;
        index += 1;
        break;
      case '--delay-ms':
        options.delayMs = Number.parseInt(next || '250', 10) || 250;
        index += 1;
        break;
      case '--apply-overrides':
        options.applyOverrides = true;
        break;
      case '--output-dir':
        options.outputDir = path.resolve(process.cwd(), next);
        index += 1;
        break;
      case '--docs':
        options.docPaths = (next || '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
          .map((item) => path.resolve(process.cwd(), item));
        index += 1;
        break;
      default:
        break;
    }
  }

  return options;
}

function ensureApiBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, '');
  return /\/api$/i.test(trimmed) ? trimmed : `${trimmed}/api`;
}

async function safeFetchJson(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  const text = await response.text();

  try {
    return { ok: response.ok, status: response.status, data: JSON.parse(text) };
  } catch {
    return { ok: response.ok, status: response.status, data: { raw: text } };
  }
}

async function loginToMentor(apiBaseUrl: string, options: CliOptions): Promise<string> {
  if (!options.login || !options.password) {
    throw new Error('Mode live: fournissez --login et --password.');
  }

  const loginUrl = `${apiBaseUrl}/auth/login`;
  const firstAttempt = await safeFetchJson(loginUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: options.login, password: options.password }),
  });

  if (firstAttempt.ok && firstAttempt.data?.accessToken) {
    return firstAttempt.data.accessToken;
  }

  if (firstAttempt.ok && firstAttempt.data?.user?.requires2FA) {
    if (!options.twoFactor) {
      throw new Error('Le compte demande un code 2FA: fournissez --two-factor.');
    }

    const secondAttempt = await safeFetchJson(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: options.login,
        password: options.password,
        twoFactorCode: options.twoFactor,
      }),
    });

    if (secondAttempt.ok && secondAttempt.data?.accessToken) {
      return secondAttempt.data.accessToken;
    }

    throw new Error(
      secondAttempt.data?.error || `Échec de connexion 2FA (${secondAttempt.status}).`
    );
  }

  throw new Error(firstAttempt.data?.error || `Échec de connexion (${firstAttempt.status}).`);
}

async function callMentor(
  apiBaseUrl: string,
  token: string,
  question: DeepAuditQuestion
): Promise<{ message: string; engine?: string }> {
  const response = await safeFetchJson(`${apiBaseUrl}/ai/mentor/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: question.question,
      context: DEFAULT_CONTEXT,
      history: [],
    }),
  });

  if (!response.ok) {
    throw new Error(response.data?.error || `Mentor query failed (${response.status}).`);
  }

  return {
    message: response.data?.message || '',
    engine: response.data?._engine,
  };
}

function extractDocSections(content: string): Array<{ heading: string; anchors: string[] }> {
  const lines = content.split(/\r?\n/);
  const sections: Array<{ heading: string; anchors: string[] }> = [];

  for (let index = 0; index < lines.length; index += 1) {
    const headingMatch = lines[index].match(/^#{1,4}\s+(.+)$/);
    if (!headingMatch) continue;

    const heading = headingMatch[1].trim();
    const anchors: string[] = [];

    for (let cursor = index + 1; cursor < lines.length && anchors.length < 3; cursor += 1) {
      const line = lines[cursor].trim();
      if (!line) continue;
      if (/^#{1,4}\s+/.test(line)) break;
      if (/^[-*]\s+/.test(line)) {
        anchors.push(line.replace(/^[-*]\s+/, '').trim());
        continue;
      }
      if (line.length > 40) {
        anchors.push(line);
      }
    }

    if (anchors.length > 0) {
      sections.push({ heading, anchors });
    }
  }

  return sections;
}

async function loadDocumentationQuestions(docPaths: string[]): Promise<DeepAuditQuestion[]> {
  const questions: DeepAuditQuestion[] = [];

  for (const docPath of docPaths) {
    try {
      const content = await fs.readFile(docPath, 'utf8');
      const fileName = path.basename(docPath);
      const sections = extractDocSections(content).slice(0, 12);

      sections.forEach((section, index) => {
        const referenceAnswer = [
          `**${section.heading}**`,
          '',
          `Selon ${fileName}, ce sujet doit être compris à travers les points suivants.`,
          '',
          `**Points essentiels**`,
          ...section.anchors.map((anchor, anchorIndex) => `${anchorIndex + 1}. ${anchor}`),
          '',
          `**Référence**`,
          `- ${fileName}`,
        ].join('\n');

        questions.push({
          id: `doc:${fileName}:${index + 1}`,
          domain: 'documentation',
          question: `Que faut-il retenir de "${section.heading}" dans ${fileName} ?`,
          expectedAnchors: section.anchors,
          expectedReferences: [fileName],
          referenceAnswer,
          allowAutomaticOverride: false,
        });
      });
    } catch (error) {
      console.warn(`[doc-scan] Impossible de lire ${docPath}: ${String(error)}`);
    }
  }

  const seen = new Set<string>();
  return questions.filter((question) => {
    const key = normalizeAuditQuestion(question.question);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function writeJson(filePath: string, data: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function mergeUniqueQuestions(questions: DeepAuditQuestion[], limit: number): DeepAuditQuestion[] {
  const merged: DeepAuditQuestion[] = [];
  const seen = new Set<string>();

  for (const question of questions) {
    const key = normalizeAuditQuestion(question.question);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(question);
    if (merged.length >= limit) break;
  }

  return merged;
}

function buildSummaryMarkdown(
  options: CliOptions,
  rows: AuditResultRow[],
  questionCount: number,
  overrideCount: number
): string {
  const withErrors = rows.filter((row) => row.error);
  const withoutErrors = rows.filter((row) => !row.error);
  const preferredReference = withoutErrors.filter((row) => row.preferredAnswer === 'reference');
  const avgAiScore =
    withoutErrors.length > 0
      ? Math.round(withoutErrors.reduce((sum, row) => sum + row.aiScore, 0) / withoutErrors.length)
      : 0;
  const avgReferenceScore =
    withoutErrors.length > 0
      ? Math.round(
          withoutErrors.reduce((sum, row) => sum + row.referenceScore, 0) / withoutErrors.length
        )
      : 0;
  const avgDuration =
    withoutErrors.length > 0
      ? Math.round(withoutErrors.reduce((sum, row) => sum + row.durationMs, 0) / withoutErrors.length)
      : 0;

  const weakRows = preferredReference
    .slice(0, 15)
    .map(
      (row, index) =>
        `${index + 1}. ${row.question}\n   Score IA: ${row.aiScore} | Score référence: ${row.referenceScore}\n   Faiblesses: ${row.aiIssues.slice(0, 2).join(' / ')}`
    )
    .join('\n');

  return [
    '# Audit MissionSage',
    '',
    `- Mode: ${options.mode}`,
    `- Questions totales: ${questionCount}`,
    `- Réponses traitées: ${rows.length}`,
    `- Réponses en erreur: ${withErrors.length}`,
    `- Réponses remplacables par la référence: ${preferredReference.length}`,
    `- Overrides générés: ${overrideCount}`,
    `- Score IA moyen: ${avgAiScore}`,
    `- Score référence moyen: ${avgReferenceScore}`,
    `- Temps moyen par question: ${avgDuration} ms`,
    '',
    '## Points faibles prioritaires',
    weakRows || 'Aucun écart critique détecté sur cet échantillon.',
  ].join('\n');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const apiBaseUrl = ensureApiBaseUrl(options.baseUrl);
  const outputDir = options.outputDir;
  const docQuestions = await loadDocumentationQuestions(options.docPaths);
  const coreQuestions = generateDeepAuditQuestions(options.limit + docQuestions.length + 50);
  const allQuestions = mergeUniqueQuestions([...coreQuestions, ...docQuestions], options.limit);

  let token = '';
  let liveMode: AuditMode = options.mode;

  if (options.mode === 'live') {
    try {
      token = await loginToMentor(apiBaseUrl, options);
      console.log(`[audit] Connexion mentor OK via ${apiBaseUrl}`);
    } catch (error) {
      console.warn(`[audit] Mode live indisponible: ${String(error)}`);
      console.warn('[audit] Bascule automatique en mode reference-only.');
      liveMode = 'reference-only';
    }
  }

  console.log(`[audit] Questions préparées: ${allQuestions.length}`);
  console.log(`[audit] Mode effectif: ${liveMode}`);

  const rows: AuditResultRow[] = [];
  const comparisons = [];

  for (let index = 0; index < allQuestions.length; index += 1) {
    const question = allQuestions[index];
    const startedAt = Date.now();
    console.log(`[${index + 1}/${allQuestions.length}] ${question.question}`);

    try {
      const aiPayload =
        liveMode === 'live'
          ? await callMentor(apiBaseUrl, token, question)
          : { message: question.referenceAnswer, engine: 'REFERENCE_ONLY' };
      const comparison = compareAnswerPair(question, aiPayload.message);
      comparisons.push(comparison);

      rows.push({
        id: question.id,
        domain: question.domain,
        question: question.question,
        aiAnswer: aiPayload.message,
        referenceAnswer: question.referenceAnswer,
        aiScore: comparison.aiEvaluation.totalScore,
        referenceScore: comparison.referenceEvaluation.totalScore,
        preferredAnswer: comparison.preferredAnswer,
        aiIssues: comparison.aiEvaluation.issues,
        referenceIssues: comparison.referenceEvaluation.issues,
        aiEngine: aiPayload.engine,
        durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      rows.push({
        id: question.id,
        domain: question.domain,
        question: question.question,
        aiAnswer: '',
        referenceAnswer: question.referenceAnswer,
        aiScore: 0,
        referenceScore: 0,
        preferredAnswer: 'reference',
        aiIssues: ['Erreur d’exécution côté audit.'],
        referenceIssues: [],
        durationMs: Date.now() - startedAt,
        error: String(error),
      });
    }

    if ((index + 1) % 25 === 0 || index === allQuestions.length - 1) {
      await writeJson(path.join(outputDir, 'results.partial.json'), rows);
    }

    if (liveMode === 'live' && options.delayMs > 0) {
      await sleep(options.delayMs);
    }
  }

  const overrideCatalog =
    liveMode === 'live' ? buildOverrideCatalog(comparisons, 72) : {};
  const summaryMarkdown = buildSummaryMarkdown(
    { ...options, mode: liveMode },
    rows,
    allQuestions.length,
    Object.keys(overrideCatalog).length
  );

  await writeJson(path.join(outputDir, 'results.json'), rows);
  await writeJson(path.join(outputDir, 'override-catalog.json'), overrideCatalog);
  await fs.writeFile(path.join(outputDir, 'summary.md'), summaryMarkdown, 'utf8');

  if (options.applyOverrides && liveMode === 'live') {
    const overrideModulePath = path.resolve(
      process.cwd(),
      'frontend',
      'src',
      'services',
      'ai',
      'generatedMissionSageOverrides.ts'
    );
    await fs.writeFile(overrideModulePath, formatOverrideModule(overrideCatalog), 'utf8');
    console.log(`[audit] Overrides écrits dans ${overrideModulePath}`);
  }

  console.log(`[audit] Terminé. Rapport: ${path.join(outputDir, 'summary.md')}`);
}

main().catch((error) => {
  console.error('[audit] Échec critique:', error);
  process.exitCode = 1;
});
