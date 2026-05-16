
import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Columns2,
  Rows3,
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
import TrainingEditor from './AITrainingStudio/TrainingEditor';
import EntriesList from './AITrainingStudio/EntriesList';
import DiffViewer from './AITrainingStudio/DiffViewer';

interface Props {
  user: any;
  stats: MissionStats | null;
  auditLogs: AuditLog[];
  households: Household[];
  teams: Team[];
  regionalSummaries: RegionalSummary[];
  onClose: () => void;
}

type EditorLayoutMode = 'stacked' | 'split';
type DesktopSidebarMode = 'wide' | 'compact' | 'rail';

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

      const datasetMode = document.documentElement.dataset.gedOsSidebarMode;
      const storedMode = window.localStorage.getItem('ged-os-sidebar-mode');
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
      'ged-os:sidebar-mode-change',
      handleSidebarModeChange as EventListener
    );

    return () => {
      window.removeEventListener('resize', syncViewportAndSidebar);
      window.removeEventListener(
        'ged-os:sidebar-mode-change',
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
              <TrainingEditor
                question={question}
                onQuestionChange={(value) => {
                  setQuestion(value);
                  setSelectedEntryId(null);
                }}
                referenceAnswer={referenceAnswer}
                onReferenceAnswerChange={setReferenceAnswer}
                currentResponse={currentResponse}
                isPreviewing={isPreviewing}
                isSaving={isSaving}
                isTestingReplacement={isTestingReplacement}
                feedback={feedback}
                error={error}
                onPreview={() => void handlePreview()}
                onUseCurrentAsBase={handleUseCurrentAsBase}
                onSave={() => void handleSave()}
                onTestReplacement={() => void handleTestReplacement()}
              />

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
                <DiffViewer
                  current={currentResponse?.message}
                  reference={referenceAnswer}
                  className="mt-4"
                />
              </section>
            </div>
          </div>

          <aside className="hidden min-h-0 flex-col bg-slate-950/65 xl:flex">
            <EntriesList
              entries={entries}
              unresolvedLogs={unresolvedLogs}
              scopeRedirectLogs={scopeRedirectLogs}
              isLoading={isLoadingEntries}
              search={search}
              onSearchChange={setSearch}
              selectedEntryId={selectedEntryId}
              onSelectEntry={handleSelectEntry}
              onSelectUnresolved={handleSelectUnresolved}
              onCloseEntry={handleClose}
              onAcceptEntry={handleAccept}
            />
          </aside>

          {isEntriesPanelOpen && (
            <>
              <div className="fixed inset-0 z-[1101] bg-black/60 backdrop-blur-sm xl:hidden" onClick={() => setIsEntriesPanelOpen(false)} />
              <div className="fixed inset-x-0 bottom-0 top-[5.5rem] z-[1102] bg-slate-950 xl:hidden overflow-hidden flex flex-col">
                <EntriesList
                  entries={entries}
                  unresolvedLogs={unresolvedLogs}
                  scopeRedirectLogs={scopeRedirectLogs}
                  isLoading={isLoadingEntries}
                  search={search}
                  onSearchChange={setSearch}
                  selectedEntryId={selectedEntryId}
                  onSelectEntry={handleSelectEntry}
                  onSelectUnresolved={handleSelectUnresolved}
                  onCloseEntry={handleClose}
                  onAcceptEntry={handleAccept}
                  mobile
                  onClose={() => setIsEntriesPanelOpen(false)}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
