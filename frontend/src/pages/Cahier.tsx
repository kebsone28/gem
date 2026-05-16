/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { useState, useMemo, useCallback } from 'react';
import { HardHat } from 'lucide-react';
import { useAuth } from '@contexts/AuthContext';
import { useProject } from '@contexts/ProjectContext';
import { usePermissions } from '../hooks/usePermissions';
import { exportCahiersToWord } from '@utils/word_engine';
import type { CahierTask } from '@utils/types';

import {
  DEFAULT_CONTRACT_TEMPLATES,
} from '../data/contractTemplates';
import {
  DEFAULT_OPERATIONAL_STRATEGY,
} from '../data/operationalStrategyTemplates';
import { DEFAULT_TASK_LIBRARY } from '../data/cahierTaskLibrary';
import './Cahier.css';

import {
  serializeTaskLibrary,
  sanitizeTaskForCahier,
  getFilteredRolesToDisplay,
  buildContractTemplateFromText,
  buildStrategyTemplateFromText,
} from './cahier/utils/cahierUtils';
import {
  exportContractToWord,
  exportStrategyToWord,
} from './cahier/utils/cahierExportUtils';

import { useCahierState } from './cahier/hooks/useCahierState';
import { useCahierForm } from './cahier/hooks/useCahierForm';

import { CahierHeader } from './cahier/components/CahierHeader';
import { CahierNavigation } from './cahier/components/CahierNavigation';
import { CahierTechnicalView } from './cahier/components/CahierTechnicalView';
import { CahierContractView } from './cahier/components/CahierContractView';
import { CahierStrategyView } from './cahier/components/CahierStrategyView';

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
    return customLibrary[selectedRole] || sanitizeTaskForCahier(selectedRole, DEFAULT_TASK_LIBRARY[Object.keys(DEFAULT_TASK_LIBRARY)[0]]);
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
    <PageContainer className="overflow-x-hidden !bg-slate-950">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8">
        <CahierHeader
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
          onExportWord={documentMode === 'cahier' ? () => exportCahiersToWord([{ ...currentTask, role: selectedRole, responsible: user?.name || '' } as any], false, []) : documentMode === 'contrat' ? () => exportContractToWord(selectedContractLot, contractDraft) : () => exportStrategyToWord(operationalStrategy, strategyDraft)}
          onEditToggle={() => {
            if (documentMode === 'cahier') setIsEditing(!isEditing);
            else if (documentMode === 'contrat') setIsContractEditing(!isContractEditing);
            else if (documentMode === 'strategie') setIsStrategyEditing(!isStrategyEditing);
          }}
        />

        <CahierNavigation
          taskLibrary={customLibrary}
          selectedRole={selectedRole}
          setSelectedRole={handleRoleChange}
          documentMode={documentMode}
          setDocumentMode={setDocumentMode}
        />

        <main className="mt-2 md:mt-6">
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
              selectedRole={selectedRole}
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
        </main>
      </div>
    </PageContainer>
  );
}
