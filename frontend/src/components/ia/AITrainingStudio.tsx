import React, { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  BookOpen,
  CheckCircle2,
  Columns2,
  Copy,
  Loader2,
  Rows3,
  Save,
  Search,
  X,
} from 'lucide-react';
import type { AIResponse, RegionalSummary } from '../../services/ai/MissionSageService';
import { missionSageService } from '../../services/ai/MissionSageService';
import {
  mentorTrainingService,
  type MentorTrainingEntry,
} from '../../services/ai/mentorTrainingService';
import {
  missionSageLearningLogService,
  type MissionSageLearningLog,
} from '../../services/ai/missionSageLearningLogService';
import type { MissionStats } from '../../services/missionStatsService';
import type { AuditLog, Household, Team } from '../../utils/types';
import AIPremiumMessage from './AIPremiumMessage';

interface Props {
  user: any;
  stats: MissionStats | null;
  auditLogs: AuditLog[];
  households: Household[];
  teams: Team[];
  regionalSummaries: RegionalSummary[];
  onClose: () => void;
}

interface DiffRow {
  id: string;
  current: string;
  reference: string;
}

type EditorLayoutMode = 'stacked' | 'split';
type DesktopSidebarMode = 'wide' | 'compact' | 'rail';

function normalizeComparableText(value = ''): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function toComparableLines(value = ''): string[] {
  return String(value || '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function buildDiffRows(current = '', reference = ''): DiffRow[] {
  const currentLines = toComparableLines(current);
  const referenceLines = toComparableLines(reference);
  const maxLength = Math.max(currentLines.length, referenceLines.length);

  return Array.from({ length: maxLength }, (_, index) => ({
    id: `diff-${index}`,
    current: currentLines[index] || '',
    reference: referenceLines[index] || '',
  }));
}

const WORKFLOW_STEPS = [
  'Générer la réponse actuelle',
  'Reprendre la réponse comme base',
  'Mémoriser la correction',
  'Tester le remplacement',
];

export default function AITrainingStudio({
  user,
  stats,
  auditLogs,
  households,
  teams,
  regionalSummaries,
  onClose,
}: Props) {
  const aiState = useMemo(
    () => ({
      stats,
      auditLogs,
      households,
      teams,
      regionalSummaries,
    }),
    [stats, auditLogs, households, teams, regionalSummaries]
  );

  const [question, setQuestion] = useState('');
  const [currentResponse, setCurrentResponse] = useState<AIResponse | null>(null);
  const [referenceAnswer, setReferenceAnswer] = useState('');
  const [entries, setEntries] = useState<MentorTrainingEntry[]>([]);
  const [unresolvedLogs, setUnresolvedLogs] = useState<MissionSageLearningLog[]>([]);
  const [scopeRedirectLogs, setScopeRedirectLogs] = useState<MissionSageLearningLog[]>([]);
  const [search, setSearch] = useState('');
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [editorLayout, setEditorLayout] = useState<EditorLayoutMode>('stacked');
  const [desktopSidebarMode, setDesktopSidebarMode] = useState<DesktopSidebarMode>('wide');
  const [isDesktopViewport, setIsDesktopViewport] = useState(false);
  const [isEntriesPanelOpen, setIsEntriesPanelOpen] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingReplacement, setIsTestingReplacement] = useState(false);
  const [isLoadingEntries, setIsLoadingEntries] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isEntryClosed = (entry: MentorTrainingEntry) =>
    entry.lifecycleStatus === 'closed' || entry.active === false;
  const isEntryAccepted = (entry: MentorTrainingEntry) => entry.lifecycleStatus === 'accepted';

  const visibleEntries = useMemo(
    () => entries.filter((entry) => !isEntryAccepted(entry) && !isEntryClosed(entry)),
    [entries]
  );

  const activeEntriesCount = visibleEntries.length;

  const desktopLeftInset = useMemo(() => {
    if (!isDesktopViewport) return 0;

    if (desktopSidebarMode === 'rail') return 132;
    if (desktopSidebarMode === 'compact') return 352;
    return 424;
  }, [desktopSidebarMode, isDesktopViewport]);

  const filteredEntries = useMemo(() => {
    const token = search.trim().toLowerCase();
    if (!token) return visibleEntries;

    return visibleEntries.filter(
      (entry) =>
        entry.question.toLowerCase().includes(token) || entry.answer.toLowerCase().includes(token)
    );
  }, [visibleEntries, search]);

  const diffRows = useMemo(
    () => buildDiffRows(currentResponse?.message || '', referenceAnswer),
    [currentResponse?.message, referenceAnswer]
  );

  const changedDiffRows = useMemo(
    () =>
      diffRows.filter(
        (row) => normalizeComparableText(row.current) !== normalizeComparableText(row.reference)
      ),
    [diffRows]
  );

  async function loadEntries() {
    setIsLoadingEntries(true);
    setError(null);
    try {
      const data = await mentorTrainingService.listEntries();
      setEntries(data);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Impossible de charger les règles mémorisées.');
    } finally {
      setIsLoadingEntries(false);
    }
  }

  async function loadUnresolvedLogs() {
    try {
      const data = await missionSageLearningLogService.listUnresolved(12);
      setUnresolvedLogs(data);
    } catch {
      setUnresolvedLogs([]);
    }
  }

  async function loadScopeRedirectLogs() {
    try {
      const data = await missionSageLearningLogService.listByContexts(
        ['scope_redirect', 'work_redirect'],
        12
      );
      setScopeRedirectLogs(data);
    } catch {
      setScopeRedirectLogs([]);
    }
  }

  useEffect(() => {
    loadEntries();
    loadUnresolvedLogs();
    loadScopeRedirectLogs();
  }, []);

  useEffect(() => {
    const syncViewportAndSidebar = () => {
      if (typeof window === 'undefined') return;

      setIsDesktopViewport(window.innerWidth >= 1024);

      const datasetMode = document.documentElement.dataset.gemSidebarMode;
      const storedMode = window.localStorage.getItem('gem-sidebar-mode');
      const resolvedMode =
        datasetMode === 'wide' || datasetMode === 'compact' || datasetMode === 'rail'
          ? datasetMode
          : storedMode === 'wide' || storedMode === 'compact' || storedMode === 'rail'
            ? storedMode
            : 'wide';

      setDesktopSidebarMode(resolvedMode);
    };

    const handleSidebarModeChange = (event: Event) => {
      const mode = (event as CustomEvent<{ mode?: DesktopSidebarMode }>).detail?.mode;
      if (mode === 'wide' || mode === 'compact' || mode === 'rail') {
        setDesktopSidebarMode(mode);
        return;
      }

      syncViewportAndSidebar();
    };

    syncViewportAndSidebar();
    window.addEventListener('resize', syncViewportAndSidebar);
    window.addEventListener(
      'gem:sidebar-mode-change',
      handleSidebarModeChange as EventListener
    );

    return () => {
      window.removeEventListener('resize', syncViewportAndSidebar);
      window.removeEventListener(
        'gem:sidebar-mode-change',
        handleSidebarModeChange as EventListener
      );
    };
  }, []);

  async function requestMentorResponse(targetQuestion: string): Promise<AIResponse> {
    return missionSageService.processQuery(targetQuestion, user, aiState);
  }

  async function handlePreview(targetQuestion = question) {
    if (!targetQuestion.trim()) return;
    setIsPreviewing(true);
    setFeedback(null);
    setError(null);
    try {
      const response = await requestMentorResponse(targetQuestion.trim());
      setCurrentResponse(response);
    } catch (err: any) {
      setError(err?.message || 'Impossible de générer la réponse actuelle.');
    } finally {
      setIsPreviewing(false);
    }
  }

  async function handleTestReplacement(
    targetQuestion = question,
    expectedAnswer = referenceAnswer
  ) {
    if (!targetQuestion.trim() || !expectedAnswer.trim()) return;

    setIsTestingReplacement(true);
    setFeedback(null);
    setError(null);
    try {
      const response = await requestMentorResponse(targetQuestion.trim());
      setCurrentResponse(response);

      if (
        normalizeComparableText(response.message) === normalizeComparableText(expectedAnswer.trim())
      ) {
        setFeedback(
          'Test validé. Le mentor renvoie bien la réponse mémorisée pour cette question.'
        );
      } else {
        setError(
          "Le mentor n'affiche pas encore exactement la réponse mémorisée. Vérifiez la question ou la correction."
        );
      }
    } catch (err: any) {
      setError(err?.message || 'Impossible de tester le remplacement.');
    } finally {
      setIsTestingReplacement(false);
    }
  }

  function handleUseCurrentAsBase() {
    if (!currentResponse?.message) return;
    setReferenceAnswer(currentResponse.message);
    setFeedback("La réponse actuelle a été injectée dans le champ de correction.");
    setError(null);
  }

  async function handleSave() {
    if (!question.trim() || !referenceAnswer.trim()) return;

    setIsSaving(true);
    setFeedback(null);
    setError(null);
    try {
      const saved = await mentorTrainingService.saveEntry({
        question: question.trim(),
        answer: referenceAnswer.trim(),
      });

      setEntries((prev) => [saved, ...prev.filter((entry) => entry.id !== saved.id)]);
      setSelectedEntryId(saved.id);
      setFeedback(
        "Réponse mémorisée. Le mentor remplacera désormais sa réponse pour cette question exacte."
      );
      await loadUnresolvedLogs();
      await loadScopeRedirectLogs();
      await handleTestReplacement(saved.question, saved.answer);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Impossible d'enregistrer cette réponse de référence.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleClose(entry: MentorTrainingEntry) {
    const confirmClose = window.confirm(
      "Clôturer cette réponse mémorisée ? Elle restera historisée côté backend et disparaîtra de l'interface."
    );
    if (!confirmClose) return;

    setError(null);
    setFeedback(null);
    try {
      const closedEntry = await mentorTrainingService.closeEntry(entry.id);
      setEntries((prev) => prev.map((item) => (item.id === closedEntry.id ? closedEntry : item)));

      if (selectedEntryId === closedEntry.id) {
        setSelectedEntryId(null);
        setQuestion('');
        setReferenceAnswer('');
        setCurrentResponse(null);
      }

      setFeedback(
        "Réponse clôturée. Elle reste historisée côté backend et disparaît désormais de l'interface."
      );
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Clôture impossible.');
    }
  }

  async function handleAccept(entry: MentorTrainingEntry) {
    const confirmAccept = window.confirm(
      "Accepter définitivement cette réponse ? Elle restera active côté backend, continuera à remplacer le mentor, et disparaîtra de cette interface."
    );
    if (!confirmAccept) return;

    setError(null);
    setFeedback(null);
    try {
      const acceptedEntry = await mentorTrainingService.acceptEntry(entry.id);
      setEntries((prev) => prev.map((item) => (item.id === acceptedEntry.id ? acceptedEntry : item)));

      if (selectedEntryId === acceptedEntry.id) {
        setSelectedEntryId(null);
        setQuestion('');
        setReferenceAnswer('');
        setCurrentResponse(null);
      }

      setFeedback(
        "Réponse acceptée définitivement. Elle reste active côté backend et n'apparaît plus dans cette interface."
      );
    } catch (err: any) {
      setError(err?.response?.data?.error || "Acceptation définitive impossible.");
    }
  }

  function handleSelectEntry(entry: MentorTrainingEntry) {
    setSelectedEntryId(entry.id);
    setQuestion(entry.question);
    setReferenceAnswer(entry.answer);
    setIsEntriesPanelOpen(false);
    setFeedback("Réponse mémorisée chargée dans l'éditeur.");
    setError(null);
    void handleTestReplacement(entry.question, entry.answer);
  }

  function handleSelectUnresolved(log: MissionSageLearningLog) {
    setSelectedEntryId(null);
    setQuestion(log.query);
    setReferenceAnswer('');
    setCurrentResponse(null);
    setIsEntriesPanelOpen(false);
    setFeedback('Question non résolue chargée. Rédigez la réponse de référence puis mémorisez-la.');
    setError(null);
  }

  const renderEntriesPanel = (mobile = false) => (
    <>
      <div className="border-b border-white/6 px-5 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BookOpen size={16} className="text-slate-300" />
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-300">
              Réponses mémorisées
            </p>
          </div>
          {mobile && (
            <button
              onClick={() => setIsEntriesPanelOpen(false)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/8 bg-white/5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
              title="Fermer le panneau"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-emerald-200">
            {activeEntriesCount} active(s)
          </span>
        </div>
        <div className="relative mt-4">
          <Search
            size={14}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-500"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une question mémorisée"
            className="w-full rounded-2xl border border-white/8 bg-slate-900/70 py-3 pr-4 pl-9 text-sm font-medium text-white outline-none placeholder:text-slate-500 focus:border-white/15"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        {unresolvedLogs.length > 0 && (
          <div className="mb-5 rounded-[1.5rem] border border-amber-400/15 bg-amber-400/10 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-100">
                Questions non résolues
              </p>
              <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-amber-100">
                {unresolvedLogs.length}
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {unresolvedLogs.map((log) => (
                <button
                  key={`${log.id || log.query}-${String(log.timestamp)}`}
                  onClick={() => handleSelectUnresolved(log)}
                  className="block w-full rounded-2xl border border-amber-300/10 bg-slate-950/35 px-3 py-3 text-left text-xs font-semibold leading-5 text-amber-50 transition-colors hover:bg-slate-950/55"
                  title="Charger cette question dans l'éditeur"
                >
                  {log.query}
                </button>
              ))}
            </div>
          </div>
        )}

        {scopeRedirectLogs.length > 0 && (
          <div className="mb-5 rounded-[1.5rem] border border-cyan-400/15 bg-cyan-400/10 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100">
                Questions recadrées
              </p>
              <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-cyan-100">
                {scopeRedirectLogs.length}
              </span>
            </div>
            <p className="mt-2 text-[11px] font-semibold leading-5 text-cyan-50/80">
              Ces questions étaient hors périmètre ou trop générales. Chargez-les seulement si une
              vraie règle métier doit être ajoutée.
            </p>
            <div className="mt-3 space-y-2">
              {scopeRedirectLogs.map((log) => (
                <button
                  key={`${log.id || log.query}-${String(log.timestamp)}`}
                  onClick={() => handleSelectUnresolved(log)}
                  className="block w-full rounded-2xl border border-cyan-300/10 bg-slate-950/35 px-3 py-3 text-left text-xs font-semibold leading-5 text-cyan-50 transition-colors hover:bg-slate-950/55"
                  title="Charger cette question recadrée dans l'éditeur"
                >
                  <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.16em] text-cyan-200/80">
                    {log.context === 'work_redirect' ? 'Priorisation travail' : 'Hors périmètre'}
                  </span>
                  {log.query}
                </button>
              ))}
            </div>
          </div>
        )}

        {isLoadingEntries ? (
          <div className="flex items-center justify-center py-12 text-sm font-semibold text-slate-400">
            <Loader2 size={16} className="mr-2 animate-spin" />
            Chargement des réponses mémorisées...
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-white/10 px-5 py-10 text-center text-sm leading-7 text-slate-500">
            Aucune réponse mémorisée pour le moment.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredEntries.map((entry) => (
              <div
                key={entry.id}
                role="button"
                tabIndex={0}
                onClick={() => handleSelectEntry(entry)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleSelectEntry(entry);
                  }
                }}
                className={`cursor-pointer rounded-[1.5rem] border p-4 transition-colors ${
                  selectedEntryId === entry.id
                    ? 'border-cyan-400/30 bg-cyan-400/10'
                    : 'border-white/8 bg-white/[0.03] hover:bg-white/[0.05]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-black leading-6 text-white">{entry.question}</p>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Mise à jour {new Date(entry.updatedAt).toLocaleString()}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-emerald-200">
                        Override actif
                      </span>
                      <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-cyan-200">
                        Match exact
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleAccept(entry);
                      }}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-400/15 bg-emerald-400/10 text-emerald-200 transition-colors hover:bg-emerald-400/15"
                      title="Accepter définitivement"
                    >
                      <CheckCircle2 size={14} />
                    </button>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleClose(entry);
                      }}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-amber-400/15 bg-amber-400/10 text-amber-200 transition-colors hover:bg-amber-400/15"
                      title="Clôturer cette réponse mémorisée"
                    >
                      <Archive size={14} />
                    </button>
                  </div>
                </div>
                <div className="mt-3 rounded-2xl border border-white/6 bg-slate-950/50 px-3 py-3">
                  <p className="line-clamp-4 text-[12.5px] font-medium leading-6 text-slate-200/90 whitespace-pre-wrap">
                    {entry.answer}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/70 p-2 backdrop-blur-md sm:p-4 lg:py-6 lg:pr-6"
      style={{ '--inset-left': desktopLeftInset ? `${desktopLeftInset}px` : undefined } as React.CSSProperties}
    >
      <div className="relative flex h-[95vh] w-full max-w-[1520px] flex-col overflow-hidden rounded-[1.5rem] border border-white/10 bg-slate-950 shadow-[0_50px_120px_-24px_rgba(0,0,0,0.6)] sm:rounded-[2rem]">
        <div className="flex items-start justify-between gap-4 border-b border-white/6 bg-slate-900/80 px-4 py-4 sm:px-7 sm:py-5">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
              Entraînement supervisé
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-white sm:text-3xl">
              Studio d&apos;apprentissage MissionSage
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400 sm:text-[15px]">
              Posez une question, observez la réponse actuelle du mentor, puis saisissez la réponse
              correcte pour qu&apos;elle soit mémorisée côté serveur et réutilisée ensuite.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEntriesPanelOpen(true)}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200 transition-colors hover:bg-cyan-400/15 xl:hidden"
              title="Afficher les réponses mémorisées"
            >
              <BookOpen size={14} />
              Réponses
            </button>
            <button
              onClick={onClose}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/8 bg-white/5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
              title="Fermer le studio"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="relative grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_23rem]">
          <div className="min-h-0 overflow-y-auto xl:border-r xl:border-white/6">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6">
              <section className="rounded-[1.5rem] border border-white/8 bg-white/[0.025] p-4 sm:p-5">
                <div className="grid gap-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                      Question de test
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200">
                        Override actif
                      </span>
                      <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200">
                        Correspondance exacte
                      </span>
                    </div>
                  </div>
                  <textarea
                    value={question}
                    onChange={(e) => {
                      setQuestion(e.target.value);
                      setSelectedEntryId(null);
                    }}
                    rows={3}
                    placeholder="Ex : Le coffret compteur est posé à l’intérieur de la concession. Est-ce certifiable ?"
                    className="w-full bg-slate-900 dark:bg-slate-900 border border-slate-800 dark:border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />

                  <div className="rounded-[1.25rem] border border-white/8 bg-slate-900/55 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                      Parcours conseillé
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      {WORKFLOW_STEPS.map((step, index) => (
                        <div
                          key={step}
                          className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-3"
                        >
                          <div className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-cyan-400/20 bg-cyan-400/10 text-[10px] font-black text-cyan-100">
                            {index + 1}
                          </div>
                          <p className="mt-2 text-xs leading-6 text-slate-300">{step}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      onClick={() => handlePreview()}
                      disabled={!question.trim() || isPreviewing}
                      className="inline-flex w-full items-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-cyan-200 transition-colors hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-300/10 text-[10px] font-black text-cyan-100">
                        1
                      </span>
                      {isPreviewing ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                      Réponse actuelle
                    </button>
                    <button
                      onClick={handleUseCurrentAsBase}
                      disabled={!currentResponse?.message}
                      className="inline-flex w-full items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-200 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/10 bg-white/10 text-[10px] font-black text-white">
                        2
                      </span>
                      <Copy size={14} />
                      Reprendre la réponse actuelle
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={!question.trim() || !referenceAnswer.trim() || isSaving}
                      className="inline-flex w-full items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-emerald-200 transition-colors hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-emerald-300/20 bg-emerald-300/10 text-[10px] font-black text-emerald-100">
                        3
                      </span>
                      {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      Mémoriser la correction
                    </button>
                    <button
                      onClick={() => handleTestReplacement()}
                      disabled={!question.trim() || !referenceAnswer.trim() || isTestingReplacement}
                      className="p-4 bg-slate-950/40 dark:bg-slate-900/50 rounded-xl border border-slate-800 dark:border-slate-800 inline-flex w-full items-center gap-2 rounded-2xl border border-blue-400/20 bg-blue-400/10 px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-blue-200 transition-colors hover:bg-blue-400/15 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-blue-300/20 bg-blue-300/10 text-[10px] font-black text-blue-100">
                        4
                      </span>
                      {isTestingReplacement ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <BookOpen size={14} />
                      )}
                      Tester le remplacement
                    </button>
                  </div>

                  {feedback && (
                    <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-100">
                      {feedback}
                    </div>
                  )}
                  {error && (
                    <div className="rounded-2xl border border-rose-400/15 bg-rose-400/10 px-4 py-3 text-sm font-semibold text-rose-100">
                      {error}
                    </div>
                  )}
                  <p className="text-xs leading-6 text-slate-500">
                    Le remplacement s&apos;applique actuellement sur la question normalisée exacte.
                    Les formulations proches restent indépendantes.
                  </p>
                </div>
              </section>

              <section className="rounded-[1.5rem] border border-white/8 bg-white/[0.02]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/6 px-4 py-4 sm:px-5">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                      Zone de travail
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      Travaillez sur une zone centrale plus respirante, puis ouvrez la mémoire à droite si nécessaire.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setEditorLayout('stacked')}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] transition-colors ${
                        editorLayout === 'stacked'
                          ? 'border-cyan-400/20 bg-cyan-400/10 text-cyan-200'
                          : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                      }`}
                      title="Empiler les deux fenêtres"
                    >
                      <Rows3 size={12} />
                      Empilé
                    </button>
                    <button
                      onClick={() => setEditorLayout('split')}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] transition-colors ${
                        editorLayout === 'split'
                          ? 'border-cyan-400/20 bg-cyan-400/10 text-cyan-200'
                          : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                      }`}
                      title="Afficher les deux fenêtres côte à côte"
                    >
                      <Columns2 size={12} />
                      Double panneau
                    </button>
                  </div>
                </div>

                <div
                  className={`grid grid-cols-1 ${
                    editorLayout === 'split' ? 'xl:grid-cols-[minmax(0,0.96fr)_minmax(0,1.04fr)]' : ''
                  }`}
                >
                  <div
                    className={`border-b border-white/6 p-4 sm:p-5 ${
                      editorLayout === 'split' ? 'xl:border-r xl:border-b-0' : ''
                    }`}
                  >
                    <div className="mb-4 flex flex-wrap items-center gap-3">
                      <span className="rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-blue-200">
                        Réponse actuelle du mentor
                      </span>
                      {currentResponse?._engine && (
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-300">
                          Moteur {currentResponse._engine}
                        </span>
                      )}
                      {currentResponse?.type && (
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-300">
                          Type {currentResponse.type}
                        </span>
                      )}
                    </div>
                    <div
                      className={`overflow-y-auto rounded-[1.5rem] border border-white/8 bg-[#0b1627] p-4 sm:p-5 ${
                        editorLayout === 'split'
                          ? 'min-h-[22rem] xl:min-h-[30rem]'
                          : 'min-h-[15rem] sm:min-h-[18rem]'
                      }`}
                    >
                      {currentResponse ? (
                        <div className="space-y-4">
                          <AIPremiumMessage message={currentResponse.message} />
                        </div>
                      ) : (
                        <div className="flex h-full items-center justify-center text-center text-sm font-semibold leading-7 text-slate-500">
                          Lancez un test pour voir la réponse actuelle du mentor.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-4 sm:p-5">
                    <div className="mb-4 flex flex-wrap items-center gap-3">
                      <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200">
                        Bonne réponse à mémoriser
                      </span>
                      {selectedEntryId && (
                        <span className="rounded-full border border-emerald-400/15 bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-100">
                          Règle existante chargée
                        </span>
                      )}
                    </div>
                    <textarea
                      value={referenceAnswer}
                      onChange={(e) => setReferenceAnswer(e.target.value)}
                      placeholder="Rédigez ici la réponse de référence. Elle remplacera la réponse actuelle sur cette question."
                      className={`w-full resize-none rounded-[1.5rem] border border-white/8 bg-slate-900/70 px-4 py-4 text-sm font-medium leading-7 text-white outline-none transition-colors placeholder:text-slate-500 focus:border-emerald-400/30 ${
                        editorLayout === 'split'
                          ? 'min-h-[22rem] xl:min-h-[30rem]'
                          : 'min-h-[15rem] sm:min-h-[18rem]'
                      }`}
                    />
                  </div>
                </div>
              </section>

              <section className="rounded-[1.5rem] border border-white/8 bg-white/[0.02] p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-fuchsia-200">
                      Diff visuel
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-300">
                      {changedDiffRows.length === 0 && currentResponse && referenceAnswer
                        ? 'Réponses identiques'
                        : `${changedDiffRows.length} écart(s) détecté(s)`}
                    </span>
                  </div>
                  <p className="text-xs leading-6 text-slate-500">
                    La colonne de gauche montre l&apos;avant. Celle de droite montre la correction retenue.
                  </p>
                </div>

                <div className="mt-4">
                  {!currentResponse || !referenceAnswer.trim() ? (
                    <div className="p-4 rounded-xl bg-slate-900/40 dark:bg-slate-900/50 border border-slate-800 dark:border-slate-800 flex items-center gap-4 text-sm leading-7 text-slate-500">
                      Le diff apparaîtra dès qu&apos;une réponse actuelle et une correction seront disponibles.
                    </div>
                  ) : changedDiffRows.length === 0 ? (
                    <div className="rounded-[1.5rem] border border-emerald-400/15 bg-emerald-400/10 px-5 py-8 text-center text-sm font-semibold leading-7 text-emerald-100">
                      Aucune différence détectée. La réponse courante est déjà alignée sur la correction mémorisée.
                    </div>
                  ) : (
                    <div className="max-h-[20rem] space-y-3 overflow-y-auto pr-1">
                      {changedDiffRows.map((row, index) => (
                        <div key={row.id} className="grid gap-3 xl:grid-cols-2">
                          <div className="rounded-[1.25rem] border border-rose-400/15 bg-rose-400/10 px-4 py-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-rose-200">
                              Réponse actuelle · ligne {index + 1}
                            </p>
                            <p className="mt-2 text-sm font-medium leading-7 text-rose-50/95 whitespace-pre-wrap">
                              {row.current || '—'}
                            </p>
                          </div>
                          <div className="rounded-[1.25rem] border border-emerald-400/15 bg-emerald-400/10 px-4 py-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200">
                              Correction retenue · ligne {index + 1}
                            </p>
                            <p className="mt-2 text-sm font-medium leading-7 text-emerald-50/95 whitespace-pre-wrap">
                              {row.reference || '—'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>

          <aside className="hidden min-h-0 flex-col bg-slate-950/65 xl:flex">
            {renderEntriesPanel(false)}
          </aside>

          {isEntriesPanelOpen && (
            <>
              <button
                className="absolute inset-0 z-10 bg-black/55 xl:hidden"
                onClick={() => setIsEntriesPanelOpen(false)}
                aria-label="Fermer le panneau des réponses mémorisées"
              />
              <div className="absolute top-0 right-0 z-20 flex h-full w-[88vw] max-w-sm flex-col border-l border-white/10 bg-slate-950 shadow-[-24px_0_60px_-28px_rgba(0,0,0,0.8)] xl:hidden">
                {renderEntriesPanel(true)}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
