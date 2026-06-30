/**
 * QuestionSettings — Panneau de configuration d'une question sélectionnée
 * Extrait de ToolboxSubmissions.tsx
 */
import React from 'react';
import { MoreHorizontal } from 'lucide-react';
import type { BuilderLanguage, BuilderQuestion, BuilderQuestionType, BuilderSettingsTab, BuilderAuditIssue } from './types';
import { builderFieldPalette, builderLanguages, builderQuestionTypeLabel } from './constants';
import { getBuilderQuestionLabel, getBuilderQuestionHint, normalizeBuilderName } from './hooks';

interface QuestionSettingsProps {
  question: BuilderQuestion | null;
  builderLanguage: BuilderLanguage;
  settingsTab: BuilderSettingsTab;
  auditIssues: BuilderAuditIssue[];
  onUpdateQuestion: (id: string, patch: Partial<BuilderQuestion>) => void;
  onChangeTab: (tab: BuilderSettingsTab) => void;
  onAddChoice: (questionId: string) => void;
  onUpdateChoice: (questionId: string, choiceIndex: number, patch: Partial<{ name: string; label: string }>) => void;
  onDeleteChoice: (questionId: string, choiceIndex: number) => void;
}

export const QuestionSettings: React.FC<QuestionSettingsProps> = ({
  question,
  builderLanguage,
  settingsTab,
  auditIssues,
  onUpdateQuestion,
  onChangeTab,
  onAddChoice,
  onUpdateChoice,
  onDeleteChoice,
}) => {
  return (
    <aside className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
            Parametres de question
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Options, branchements conditionnels, validation.
          </p>
        </div>
        <MoreHorizontal size={16} className="text-slate-400" />
      </div>

      {question ? (
        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-3 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-blue-700">
            Question active
          </p>
          <p className="mt-1 truncate text-sm font-black text-slate-950">
            {getBuilderQuestionLabel(question, builderLanguage) || question.name}
          </p>
          <p className="mt-1 truncate text-[11px] font-semibold text-slate-500">
            {question.name} - {builderQuestionTypeLabel[question.type]}
          </p>
        </div>
      ) : null}

      {auditIssues.length > 0 ? (
        <div className="mt-3 space-y-2">
          {auditIssues.map((issue) => (
            <div
              key={`${issue.level}-${issue.title}`}
              className={`rounded-xl border px-3 py-2 ${
                issue.level === 'error'
                  ? 'border-rose-200 bg-rose-50 text-rose-900'
                  : 'border-amber-200 bg-amber-50 text-amber-900'
              }`}
            >
              <p className="text-[10px] font-black uppercase tracking-[0.12em]">
                {issue.level === 'error' ? 'Erreur Kobo' : 'Alerte Kobo'}
              </p>
              <p className="mt-1 text-xs font-black">{issue.title}</p>
              <p className="mt-1 text-[11px] font-semibold leading-snug text-slate-600">
                {issue.detail}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {/* Tabs */}
      <div className="mt-4 space-y-1 rounded-xl bg-slate-100 p-1">
        {([
          ['options', 'Options des questions', 'Nom, libelle, type, choix et valeur par defaut'],
          ['languages', 'Traductions', 'Libelles et aides par langue XLSForm'],
          ['branching', 'Branchement conditionnel', 'Afficher uniquement selon une expression XLSForm'],
          ['validation', 'Criteres de validation', 'Contraintes, message d erreur et calculs'],
        ] as const).map(([id, label, desc]) => (
          <button
            key={id}
            type="button"
            onClick={() => onChangeTab(id as BuilderSettingsTab)}
            className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
              settingsTab === id
                ? 'bg-white text-blue-800 shadow-sm'
                : 'text-slate-500 hover:bg-white/50 hover:text-slate-900'
            }`}
          >
            <span
              className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                settingsTab === id ? 'bg-blue-600' : 'bg-slate-300'
              }`}
            />
            <span className="min-w-0">
              <span className="block text-[11px] font-black uppercase tracking-[0.08em]">
                {label}
              </span>
              <span className="mt-0.5 block text-[10px] font-semibold leading-snug text-slate-500">
                {desc}
              </span>
            </span>
          </button>
        ))}
      </div>

      {question ? (
        <div className="mt-4 space-y-3">
          {settingsTab === 'options' && (
            <OptionsPanel question={question} builderLanguage={builderLanguage} onUpdate={onUpdateQuestion} onAddChoice={onAddChoice} onUpdateChoice={onUpdateChoice} onDeleteChoice={onDeleteChoice} />
          )}
          {settingsTab === 'languages' && (
            <LanguagesPanel question={question} onUpdate={onUpdateQuestion} />
          )}
          {settingsTab === 'branching' && (
            <BranchingPanel question={question} onUpdate={onUpdateQuestion} />
          )}
          {settingsTab === 'validation' && (
            <ValidationPanel question={question} onUpdate={onUpdateQuestion} />
          )}
        </div>
      ) : (
        <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 py-8">
          <MoreHorizontal size={28} className="text-slate-300" />
          <p className="mt-2 text-xs font-bold text-slate-400">
            Selectionnez une question dans le formulaire
          </p>
        </div>
      )}
    </aside>
  );
};

// ── Sous-panneaux ──

const OptionsPanel: React.FC<{
  question: BuilderQuestion;
  builderLanguage: BuilderLanguage;
  onUpdate: (id: string, patch: Partial<BuilderQuestion>) => void;
  onAddChoice: (questionId: string) => void;
  onUpdateChoice: (questionId: string, choiceIndex: number, patch: Partial<{ name: string; label: string }>) => void;
  onDeleteChoice: (questionId: string, choiceIndex: number) => void;
}> = ({ question, builderLanguage, onUpdate, onAddChoice, onUpdateChoice, onDeleteChoice }) => {
  const isChoiceType = ['select_one', 'select_multiple', 'rank'].includes(question.type);

  return (
    <>
      <label className="block">
        <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Libelle</span>
        <input
          value={question.label}
          onChange={(event) =>
            onUpdate(question.id, {
              label: event.target.value,
              labels: { ...(question.labels || {}), [builderLanguage]: event.target.value },
            })
          }
          className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-950 outline-none focus:border-blue-500"
        />
      </label>
      <label className="block">
        <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Nom du champ</span>
        <input
          value={question.name}
          onChange={(event) =>
            onUpdate(question.id, {
              name: normalizeBuilderName(event.target.value, question.name),
            })
          }
          className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-950 outline-none focus:border-blue-500"
        />
      </label>
      <label className="block">
        <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Type</span>
        <select
          value={question.type}
          onChange={(event) => {
            const nextType = event.target.value as BuilderQuestionType;
            const paletteItem = builderFieldPalette.find((item) => item.type === nextType);
            const needsChoices = (['select_one', 'select_multiple', 'select_one_from_file', 'select_multiple_from_file', 'rank'] as BuilderQuestionType[]).includes(nextType);
            onUpdate(question.id, {
              type: nextType,
              listName: needsChoices ? question.listName || paletteItem?.defaultListName || `${question.name}_choices` : undefined,
              choices: needsChoices ? (question.choices?.length ? question.choices : paletteItem?.defaultChoices) : undefined,
            });
          }}
          className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-950 outline-none focus:border-blue-500"
        >
          {builderFieldPalette.map((item) => (
            <option key={item.type} value={item.type}>{item.label}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Instruction supplementaire</span>
        <textarea
          value={question.hint || ''}
          onChange={(event) =>
            onUpdate(question.id, {
              hint: event.target.value,
              hints: { ...(question.hints || {}), [builderLanguage]: event.target.value },
            })
          }
          rows={3}
          className="mt-1 w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500"
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Defaut</span>
          <input
            value={question.defaultValue || ''}
            onChange={(event) => onUpdate(question.id, { defaultValue: event.target.value })}
            className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-950 outline-none focus:border-blue-500"
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Apparence</span>
          <input
            value={question.appearance || ''}
            onChange={(event) => onUpdate(question.id, { appearance: event.target.value })}
            className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-950 outline-none focus:border-blue-500"
          />
        </label>
      </div>
      {question.listName ? (
        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Liste de choix</span>
          <input
            value={question.listName}
            onChange={(event) => onUpdate(question.id, { listName: event.target.value })}
            className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-950 outline-none focus:border-blue-500"
          />
        </label>
      ) : null}
      {isChoiceType && question.choices ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Choix</span>
            <button
              type="button"
              onClick={() => onAddChoice(question.id)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-blue-700 hover:bg-blue-50"
            >
              + Ajouter
            </button>
          </div>
          {question.choices.map((choice, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                value={choice.name}
                onChange={(event) => onUpdateChoice(question.id, index, { name: event.target.value })}
                placeholder="valeur"
                className="h-9 w-1/2 rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-950 outline-none focus:border-blue-500"
              />
              <input
                value={choice.label}
                onChange={(event) => onUpdateChoice(question.id, index, { label: event.target.value })}
                placeholder="libelle"
                className="h-9 w-1/2 rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-950 outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => onDeleteChoice(question.id, index)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
                aria-label="Supprimer ce choix"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      ) : null}
      <label className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
        <span className="text-[10px] font-black text-slate-600">Requis</span>
        <input
          type="checkbox"
          checked={question.required || false}
          onChange={(event) => onUpdate(question.id, { required: event.target.checked })}
          className="h-4 w-4 accent-blue-600"
        />
      </label>
      <label className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
        <span className="text-[10px] font-black text-slate-600">Lecture seule</span>
        <input
          type="checkbox"
          checked={question.readOnly || false}
          onChange={(event) => onUpdate(question.id, { readOnly: event.target.checked })}
          className="h-4 w-4 accent-blue-600"
        />
      </label>
    </>
  );
};

const LanguagesPanel: React.FC<{
  question: BuilderQuestion;
  onUpdate: (id: string, patch: Partial<BuilderQuestion>) => void;
}> = ({ question, onUpdate }) => (
  <>
    {builderLanguages.map((lang) => (
      <div key={lang.id} className="space-y-2">
        <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">{lang.label}</p>
        <input
          value={question.labels?.[lang.id] || ''}
          onChange={(event) =>
            onUpdate(question.id, {
              labels: { ...(question.labels || {}), [lang.id]: event.target.value },
            })
          }
          placeholder={`Libelle en ${lang.label}`}
          className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-950 outline-none focus:border-blue-500"
        />
        <textarea
          value={question.hints?.[lang.id] || ''}
          onChange={(event) =>
            onUpdate(question.id, {
              hints: { ...(question.hints || {}), [lang.id]: event.target.value },
            })
          }
          rows={2}
          placeholder={`Aide en ${lang.label}`}
          className="mt-1 w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 outline-none focus:border-blue-500"
        />
      </div>
    ))}
  </>
);

const BranchingPanel: React.FC<{
  question: BuilderQuestion;
  onUpdate: (id: string, patch: Partial<BuilderQuestion>) => void;
}> = ({ question, onUpdate }) => (
  <>
    <label className="block">
      <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
        Condition d affichage (relevant)
      </span>
      <textarea
        value={question.relevant || ''}
        onChange={(event) => onUpdate(question.id, { relevant: event.target.value })}
        rows={3}
        placeholder="ex: ${role} = 'macon'"
        className="mt-1 w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold font-mono text-slate-900 outline-none focus:border-blue-500"
      />
      <p className="mt-1 text-[10px] font-semibold text-slate-400">
        Expression XLSForm. La question n apparait que si la condition est vraie.
      </p>
    </label>
    <label className="block">
      <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
        Filtre de choix (choice_filter)
      </span>
      <input
        value={question.choiceFilter || ''}
        onChange={(event) => onUpdate(question.id, { choiceFilter: event.target.value })}
        placeholder="ex: ${role} = 'macon'"
        className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold font-mono text-slate-950 outline-none focus:border-blue-500"
      />
    </label>
  </>
);

const ValidationPanel: React.FC<{
  question: BuilderQuestion;
  onUpdate: (id: string, patch: Partial<BuilderQuestion>) => void;
}> = ({ question, onUpdate }) => (
  <>
    <label className="block">
      <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Contrainte</span>
      <textarea
        value={question.constraint || ''}
        onChange={(event) => onUpdate(question.id, { constraint: event.target.value })}
        rows={2}
        placeholder="ex: . > 0"
        className="mt-1 w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold font-mono text-slate-950 outline-none focus:border-blue-500"
      />
    </label>
    <label className="block">
      <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Message d erreur</span>
      <textarea
        value={question.constraintMessage || ''}
        onChange={(event) => onUpdate(question.id, { constraintMessage: event.target.value })}
        rows={2}
        placeholder="ex: La valeur doit etre superieure a 0"
        className="mt-1 w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500"
      />
    </label>
    <label className="block">
      <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Calcul</span>
      <textarea
        value={question.calculation || ''}
        onChange={(event) => onUpdate(question.id, { calculation: event.target.value })}
        rows={2}
        placeholder="ex: concat(${prenom}, ' ', ${nom})"
        className="mt-1 w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold font-mono text-slate-950 outline-none focus:border-blue-500"
      />
    </label>
    <label className="block">
      <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Parametres</span>
      <input
        value={question.parameters || ''}
        onChange={(event) => onUpdate(question.id, { parameters: event.target.value })}
        placeholder="ex: start=0 end=100 step=10"
        className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold font-mono text-slate-950 outline-none focus:border-blue-500"
      />
    </label>
  </>
);
