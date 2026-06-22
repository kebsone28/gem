/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { useState, useMemo, useCallback } from 'react';
import { HardHat } from 'lucide-react';
import { useAuth } from '@contexts/AuthContext';
import { useProject } from '@contexts/ProjectContext';
import { usePermissions } from '@hooks/usePermissions';
import { exportCahiersToWord } from '@utils/word_engine';
import type { CahierTask } from '@utils/types';

import {
  DEFAULT_CONTRACT_TEMPLATES,
} from '@/data/contractTemplates';
import {
  DEFAULT_OPERATIONAL_STRATEGY,
} from '@/data/operationalStrategyTemplates';
import { DEFAULT_TASK_LIBRARY } from '@/data/cahierTaskLibrary';
import './Cahier.css';

import {
  serializeTaskLibrary,
  sanitizeTaskForCahier,
  getFilteredRolesToDisplay,
  buildContractTemplateFromText,
  buildStrategyTemplateFromText,
} from './Cahier/utils/cahierUtils';
import {
  exportContractToWord,
  exportStrategyToWord,
} from './Cahier/utils/cahierExportUtils';

import { useCahierState } from './Cahier/hooks/useCahierState';
import { useCahierForm } from './Cahier/hooks/useCahierForm';

import { CahierHeader } from './Cahier/components/CahierHeader';
import { CahierNavigation } from './Cahier/components/CahierNavigation';
import { CahierTechnicalView } from './Cahier/components/CahierTechnicalView';
import { CahierContractView } from './Cahier/components/CahierContractView';
import { CahierStrategyView } from './Cahier/components/CahierStrategyView';

import { PageContainer, PageHeader, ContentArea } from '@components';
import { TableRowSkeleton, CardSkeleton } from '@components/common/Skeleton';

type CahierDocumentMode = 'cahier' | 'contrat' | 'strategie';

export default function Cahier() {
  const { user } = useAuth();
  const { peut, PERMISSIONS } = usePermissions();
  const isAdmin = peut(PERMISSIONS.SYSTEM_CONFIG);
  const { project } = useProject();

  const {
    customLibrary,
    setCustomLibrary,
    contractLibrary,
    setContractLibrary,
    operationalStrategy,
    setOperationalStrategy,
    persistCahierConfig,
    getAutomatedRate,
    isSaving,
  } = useCahierState(project?.id, isAdmin);

  const [documentMode, setDocumentMode] = useState<CahierDocumentMode>(() => {
    if (peut(PERMISSIONS.CAHIER_TECHNICAL)) return 'cahier';
    if (peut(PERMISSIONS.CAHIER_CONTRACTS)) return 'contrat';
    if (peut(PERMISSIONS.CAHIER_STRATEGY)) return 'strategie';
    return 'cahier';
  });

  const [selectedRole, setSelectedRole] = useState('Électricien');
  const [selectedContractLot, setSelectedContractLot] = useState('LOT A');
  const [isContractEditing, setIsContractEditing] = useState(false);
  const [isStrategyEditing, setIsStrategyEditing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showAdvancedSections, setShowAdvancedSections] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const currentTask = useMemo(() => {
    const task = customLibrary[selectedRole];
    const defaultTask = DEFAULT_TASK_LIBRARY[selectedRole] || DEFAULT_TASK_LIBRARY[Object.keys(DEFAULT_TASK_LIBRARY)[0]];
    
    if (task) {
      return {
        ...task,
        technicalImages: task.technicalImages || defaultTask.technicalImages,
      };
    }
    
    return sanitizeTaskForCahier(selectedRole, defaultTask);
  }, [customLibrary, selectedRole]);

  const automatedRate = useMemo(() => getAutomatedRate(selectedRole), [getAutomatedRate, selectedRole]);

  const { editData, setEditData } = useCahierForm(currentTask, customLibrary, automatedRate, isEditing);

  const currentContract = contractLibrary[selectedContractLot] || DEFAULT_CONTRACT_TEMPLATES[selectedContractLot];
  const [contractDraft, setContractDraft] = useState(currentContract.content.join('\n'));
  const [strategyDraft, setStrategyDraft] = useState(operationalStrategy.content.join('\n'));

  const handleRoleChange = useCallback((role: string) => {
    setSelectedRole(role);
    setIsEditing(false);
  }, []);

  const handleSave = async () => {
    const updatedLibrary = { ...customLibrary };
    updatedLibrary[selectedRole] = {
      ...currentTask,
      introduction: editData.introduction,
      missions: editData.missions.split('\n').filter(Boolean),
      materials: editData.materials.split('\n').filter(Boolean),
      hse: editData.hse.split('\n').filter(Boolean),
    } as CahierTask;

    setCustomLibrary(updatedLibrary);
    const saved = await persistCahierConfig({ cahierLibrary: serializeTaskLibrary(updatedLibrary) });
    if (saved) setIsEditing(false);
  };

  const handleSaveContract = async () => {
    const updated = {
      ...contractLibrary,
      [selectedContractLot]: buildContractTemplateFromText(currentContract, contractDraft),
    };
    setContractLibrary(updated);
    const saved = await persistCahierConfig({ contractLibrary: updated });
    if (saved) setIsContractEditing(false);
  };

  const handleResetContract = async () => {
    if (!confirm(`Restaurer le modèle ${selectedContractLot} par défaut ?`)) return;
    const updated = { ...contractLibrary, [selectedContractLot]: DEFAULT_CONTRACT_TEMPLATES[selectedContractLot] };
    setContractLibrary(updated);
    setContractDraft(updated[selectedContractLot].content.join('\n'));
    await persistCahierConfig({ contractLibrary: updated });
  };

  const handleSaveStrategy = async () => {
    const updated = buildStrategyTemplateFromText(operationalStrategy, strategyDraft);
    setOperationalStrategy(updated);
    const saved = await persistCahierConfig({ operationalStrategy: updated });
    if (saved) setIsStrategyEditing(false);
  };

  const finalRolesToDisplay = useMemo(() => getFilteredRolesToDisplay(customLibrary, user, isAdmin), [customLibrary, user, isAdmin]);

  if (!project) {
    return (
      <PageContainer>
        <PageHeader title="Chargement..." subtitle="Préparation de la norme projet" icon={HardHat} />
        <ContentArea className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6"><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>
          <div className="space-y-4"><TableRowSkeleton /><TableRowSkeleton /><TableRowSkeleton /></div>
        </ContentArea>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="overflow-x-hidden !bg-slate-950 relative min-h-screen">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-6 relative z-10">
        <div className="flex flex-col gap-6">

          {/* ⬆️ Workspace Header (Top Panel) */}
          <CahierHeader
            projectName={project.name}
            isSaving={isSaving}
            selectedRole={selectedRole}
            documentMode={documentMode}
            isEditing={isEditing || isContractEditing || isStrategyEditing}
            hasUnsavedChanges={false}
            showAdvancedSections={showAdvancedSections}
            showHistory={showHistory}
            setShowHistory={setShowHistory}
            setShowAdvancedSections={setShowAdvancedSections}
            onSave={documentMode === 'cahier' ? handleSave : documentMode === 'contrat' ? handleSaveContract : handleSaveStrategy}
            onReset={documentMode === 'cahier' ? () => handleRoleChange(selectedRole) : documentMode === 'contrat' ? handleResetContract : () => setOperationalStrategy(DEFAULT_OPERATIONAL_STRATEGY)}
            onExportWord={documentMode === 'cahier' ? () => exportCahiersToWord([{ ...currentTask, role: selectedRole, responsible: user?.name || '' } as any], false, []) : documentMode === 'contrat' ? () => exportContractToWord(['LOT A', 'LOT B', 'LOT C'].map(lot => ({
              lotName: lot,
              content: (contractLibrary[lot] || DEFAULT_CONTRACT_TEMPLATES[lot]).content.join('\n'),
            }))) : () => exportStrategyToWord(operationalStrategy, strategyDraft)}
            onEditToggle={() => {
              if (documentMode === 'cahier') setIsEditing(!isEditing);
              else if (documentMode === 'contrat') setIsContractEditing(!isContractEditing);
              else if (documentMode === 'strategie') setIsStrategyEditing(!isStrategyEditing);
            }}
          />

          {/* ⏸️ Workspace Navigation (Middle Panel) */}
          <CahierNavigation
            taskLibrary={customLibrary}
            selectedRole={selectedRole}
            setSelectedRole={handleRoleChange}
            selectedContractLot={selectedContractLot}
            setSelectedContractLot={setSelectedContractLot}
            documentMode={documentMode}
            setDocumentMode={setDocumentMode}
            isEditing={isEditing || isContractEditing || isStrategyEditing}
            onEditToggle={() => {
              if (documentMode === 'cahier') setIsEditing(!isEditing);
              else if (documentMode === 'contrat') setIsContractEditing(!isContractEditing);
              else if (documentMode === 'strategie') setIsStrategyEditing(!isStrategyEditing);
            }}
            onSave={documentMode === 'cahier' ? handleSave : documentMode === 'contrat' ? handleSaveContract : handleSaveStrategy}
          />

          {/* ⬇️ Workspace Editor Area (Bottom Panel) */}
          <main className="flex-1 min-w-0 flex flex-col">
            {/* Vues de l'éditeur avec fond contrasté */}
            <div className="w-full bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-[2.5rem] shadow-2xl shadow-black/40 overflow-hidden relative min-h-[60vh] p-1">
              {documentMode === 'cahier' && (
                <CahierTechnicalView
                  currentTask={currentTask}
                  isEditing={isEditing}
                  editData={editData}
                  setEditData={setEditData}
                  showAdvancedSections={showAdvancedSections}
                  automatedRate={automatedRate}
                  handleExportWord={() => exportCahiersToWord([{ ...currentTask, role: selectedRole, responsible: user?.name || '' } as any], false, [])}
                  selectedRole={selectedRole}
                />
              )}

              {documentMode === 'contrat' && (
                <CahierContractView
                  contractLibrary={contractLibrary}
                  selectedContractLot={selectedContractLot}
                  isEditing={isContractEditing}
                  editData={{ ...editData, contractContent: contractDraft } as any}
                  setEditData={(updater: any) => {
                    const newVal = typeof updater === 'function' ? updater({ contractContent: contractDraft }).contractContent : updater.contractContent;
                    setContractDraft(newVal);
                  }}
                />
              )}

              {documentMode === 'strategie' && (
                <CahierStrategyView
                  operationalStrategy={operationalStrategy}
                  isEditing={isStrategyEditing}
                  editData={{ ...editData, strategyContent: strategyDraft } as any}
                  setEditData={(updater: any) => {
                    const newVal = typeof updater === 'function' ? updater({ strategyContent: strategyDraft }).strategyContent : updater.strategyContent;
                    setStrategyDraft(newVal);
                  }}
                />
              )}
            </div>
          </main>
        </div>
      </div>
    </PageContainer>
  );
}
