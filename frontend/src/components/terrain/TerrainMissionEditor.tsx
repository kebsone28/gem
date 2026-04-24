/**
 * Composant de rédaction de mission terrain
 * Contextes: équipe, household, région, date, budget, matériaux
 */
import React, { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  MapPin, 
  Calendar, 
  DollarSign, 
  Package, 
  FileText,
  CheckCircle,
  ChevronRight,
  Save,
  Send,
  Camera,
  Trash2,
  Image as ImageIcon,
  Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { uploadFile } from '../../services/uploadService';
import { KAFFRINE_TEMPLATE } from '../../pages/mission/core/missionTypes';
import logger from '../../utils/logger';
import { useProject } from '../../contexts/ProjectContext';
import { useTeams } from '../../hooks/useTeams';
import {
  getRegionPreferredTeamOrder,
  isTeamAvailableForAllocation,
  sortTeamsByCanonicalPriority,
  teamMatchesPlanningRegion,
  type PlanningAllocationSource,
} from '../../services/planningAllocation';

interface MissionContext {
  // Équipe
  teamId?: string;
  teamName?: string;
  teamMembers?: { id: string; name: string; role: string }[];
  
  // Localisation
  regionId?: string;
  regionName?: string;
  zoneIds?: string[];
  
  // Période
  startDate?: string;
  endDate?: string;
  
  // Budget
  budget?: number;
  budgetJustification?: string;
  
  // Matériaux
  materials?: { name: string; quantity: number; unit: string }[];
  
  // Ménages cibles
  householdIds?: string[];
  householdCount?: number;
}

interface TerrainMissionEditorProps {
  context: MissionContext;
  onSave: (mission: MissionLike) => void;
  onSubmit: (mission: MissionLike) => void;
  isLoading?: boolean;
}

type MissionLike = {
  title?: string;
  status?: string;
  teamId?: string;
  teamName?: string;
  teamMembers?: { id: string; name: string; role: string }[];
  regionName?: string;
  startDate?: string;
  budget?: number;
};

export const TerrainMissionEditor: React.FC<TerrainMissionEditorProps> = ({
  context,
  onSave,
  onSubmit,
  isLoading = false
}) => {
  const { project } = useProject();
  const { teams, fetchTeams, isLoading: isTeamsLoading } = useTeams(project?.id);
  const [formData, setFormData] = useState({
    // Informations de base
    title: '',
    description: '',
    
    // Équipe
    teamId: context.teamId || '',
    teamMembers: context.teamMembers || [],
    
    // Localisation
    regionId: context.regionId || '',
    regionName: context.regionName || '',
    zones: context.zoneIds || [],
    
    // Dates
    startDate: context.startDate || '',
    endDate: context.endDate || '',
    
    // Budget
    budget: context.budget || 0,
    budgetJustification: context.budgetJustification || '',
    
    // Matériaux
    materials: context.materials || [],
    additionalMaterials: '',
    
    // Ménages
    householdIds: context.householdIds || [],
    householdCount: context.householdCount || 0,
    
    // Notes terrain / Reporting
    notes: '',
    photos: [] as { id: string; url: string; comment?: string; timestamp: string }[],
    reportingMode: 'daily' as 'daily' | 'narrative',
    narrativeReport: KAFFRINE_TEMPLATE,
    priority: 'normal',
  });

  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(1);
  const steps = [
    { id: 1, title: 'Général', icon: <FileText className="w-4 h-4" /> },
    { id: 2, title: 'Équipe', icon: <Users className="w-4 h-4" /> },
    { id: 3, title: 'Localisation', icon: <MapPin className="w-4 h-4" /> },
    { id: 4, title: 'Budget', icon: <DollarSign className="w-4 h-4" /> },
    { id: 5, title: 'Matériaux', icon: <Package className="w-4 h-4" /> },
  ];

  useEffect(() => {
    void fetchTeams();
  }, [fetchTeams]);

  const missionRegionName = formData.regionName || context.regionName || '';
  const preferredTeamOrder = useMemo(
    () => getRegionPreferredTeamOrder(project?.config, missionRegionName),
    [project?.config, missionRegionName]
  );

  const activeTeams = useMemo(
    () => teams.filter(isTeamAvailableForAllocation),
    [teams]
  );

  const canonicalTeamOptions = useMemo(() => {
    const regionMatchedTeams = activeTeams.filter((team) =>
      teamMatchesPlanningRegion(team, missionRegionName)
    );
    return sortTeamsByCanonicalPriority(
      regionMatchedTeams.length > 0 ? regionMatchedTeams : activeTeams,
      new Map<string, number>(),
      preferredTeamOrder
    );
  }, [activeTeams, missionRegionName, preferredTeamOrder]);

  const selectedTeamRecord = useMemo(
    () =>
      canonicalTeamOptions.find((team) => team.id === formData.teamId) ||
      activeTeams.find((team) => team.id === formData.teamId),
    [activeTeams, canonicalTeamOptions, formData.teamId]
  );

  const recommendedTeam = useMemo(
    () =>
      (context.teamId && activeTeams.find((team) => team.id === context.teamId)) ||
      canonicalTeamOptions[0],
    [activeTeams, canonicalTeamOptions, context.teamId]
  );

  const recommendedSource: PlanningAllocationSource | null = useMemo(() => {
    if (!recommendedTeam) return null;
    if (context.teamId && recommendedTeam.id === context.teamId) return 'manual';
    return preferredTeamOrder.has(recommendedTeam.id) ? 'configured' : 'balanced';
  }, [context.teamId, preferredTeamOrder, recommendedTeam]);

  const resolvedTeamMembers = useMemo(() => {
    if (formData.teamMembers.length > 0) return formData.teamMembers;
    if (selectedTeamRecord?.leader) {
      return [
        {
          id: selectedTeamRecord.leader.id,
          name: selectedTeamRecord.leader.name,
          role: "Chef d'équipe",
        },
      ];
    }
    return [];
  }, [formData.teamMembers, selectedTeamRecord]);

  useEffect(() => {
    if (!recommendedTeam) return;

    setFormData((prev) => {
      const hasValidSelection = !!prev.teamId && activeTeams.some((team) => team.id === prev.teamId);
      if (hasValidSelection) return prev;

      return {
        ...prev,
        teamId: recommendedTeam.id,
        teamMembers:
          prev.teamMembers.length > 0
            ? prev.teamMembers
            : recommendedTeam.leader
              ? [
                  {
                    id: recommendedTeam.leader.id,
                    name: recommendedTeam.leader.name,
                    role: "Chef d'équipe",
                  },
                ]
              : prev.teamMembers,
      };
    });
  }, [activeTeams, recommendedTeam]);

  const handleTeamChange = (teamId: string) => {
    const nextTeam = activeTeams.find((team) => team.id === teamId);
    setFormData((prev) => ({
      ...prev,
      teamId,
      teamMembers: nextTeam?.leader
        ? [{ id: nextTeam.leader.id, name: nextTeam.leader.name, role: "Chef d'équipe" }]
        : [],
    }));
  };

  // Validation par étape
  const validation = useMemo(() => {
    return {
      1: !!formData.title && !!formData.description,
      2: !!formData.teamId,
      3: !!formData.regionId && !!formData.startDate && !!formData.endDate,
      4: formData.budget > 0,
      5: formData.materials.length > 0 || formData.additionalMaterials,
    };
  }, [formData]);

  const handleNext = () => {
    if (validation[step as keyof typeof validation]) {
      setStep(Math.min(step + 1, 5));
    } else {
      toast.error('Veuillez compléter tous les champs obligatoires');
    }
  };

  const handleBack = () => {
    setStep(Math.max(step - 1, 1));
  };

  const handleSubmit = async (asDraft: boolean = false) => {
    const mission = {
      ...formData,
      status: asDraft ? 'draft' : 'soumise',
      teamId: selectedTeamRecord?.id || formData.teamId,
      teamName: selectedTeamRecord?.name || context.teamName,
      teamMembers: resolvedTeamMembers,
      regionName: missionRegionName,
      context: {
        ...context,
        createdAt: new Date().toISOString(),
      }
    };
    
    if (asDraft) {
      await onSave(mission);
    } else {
      await onSubmit(mission);
    }
  };

  const addMaterial = () => {
    if (formData.additionalMaterials) {
      setFormData(prev => ({
        ...prev,
        materials: [...prev.materials, { 
          name: formData.additionalMaterials, 
          quantity: 1, 
          unit: 'unité' 
        }],
        additionalMaterials: ''
      }));
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const result = await uploadFile(file);
      if (result) {
        setFormData(prev => ({
          ...prev,
          photos: [
            ...prev.photos,
            {
              id: result.key,
              url: result.url,
              comment: '',
              timestamp: new Date().toISOString()
            }
          ]
        }));
        toast.success('Photo ajoutée au rapport');
      }
    } catch (e) {
      logger.error('[TerrainMissionEditor] Upload failed', e);
      toast.error('Erreur lors de l\'upload');
    } finally {
      setIsUploading(false);
    }
  };

  const removePhoto = (id: string) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos.filter(p => p.id !== id)
    }));
  };

  const updatePhotoComment = (id: string, comment: string) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos.map(p => p.id === id ? { ...p, comment } : p)
    }));
  };

  return (
    <div className="bg-slate-800 rounded-xl p-4 max-w-md mx-auto">
      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-6">
        {steps.map((s, i) => (
          <React.Fragment key={s.id}>
            <button
              onClick={() => validation[step as keyof typeof validation] && setStep(s.id)}
              disabled={!validation[step as keyof typeof validation] && s.id > step}
              className={`flex flex-col items-center gap-1 ${
                step === s.id 
                  ? 'text-blue-400' 
                  : step > s.id 
                    ? 'text-green-400' 
                    : 'text-slate-500'
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step === s.id 
                  ? 'bg-blue-500/20 border-2 border-blue-500' 
                  : step > s.id 
                    ? 'bg-green-500/20 border-2 border-green-500' 
                    : 'bg-slate-700 border-2 border-slate-600'
              }`}>
                {step > s.id ? <CheckCircle className="w-4 h-4" /> : s.icon}
              </div>
              <span className="text-xs hidden md:block">{s.title}</span>
            </button>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 ${step > s.id ? 'bg-green-500' : 'bg-slate-700'}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step Content */}
      <div className="space-y-4">
        {step === 1 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h3 className="text-lg font-semibold text-white mb-4">Informations générales</h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Titre de la mission *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Ex: Installation Kit Phase 2 - Tambacounda"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-1">Description *</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Décrivez l'objectif de la mission..."
                  rows={3}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Priorité</label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  title="Priorité de la mission"
                >
                  <option value="low">Basse</option>
                  <option value="normal">Normale</option>
                  <option value="high">Haute</option>
                  <option value="urgent">Urgente</option>
                </select>
              </div>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h3 className="text-lg font-semibold text-white mb-4">Équipe terrain</h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Équipe *</label>
                <select
                  value={formData.teamId}
                  onChange={(e) => handleTeamChange(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  title="Sélectionnez une équipe"
                >
                  <option value="">Sélectionner une équipe</option>
                  {canonicalTeamOptions.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                      {team.region?.name ? ` • ${team.region.name}` : ''}
                    </option>
                  ))}
                </select>
                {recommendedTeam ? (
                  <p className="mt-2 text-xs text-slate-400">
                    Suggestion canonique :
                    <span className="ml-1 font-semibold text-slate-200">{recommendedTeam.name}</span>
                    <span className="ml-2 rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      {recommendedSource === 'manual'
                        ? 'Contexte terrain'
                        : recommendedSource === 'configured'
                          ? 'Config region'
                          : 'Equilibre'}
                    </span>
                  </p>
                ) : null}
              </div>

              <div className="bg-slate-700/50 rounded-lg p-3">
                <h4 className="text-sm text-slate-400 mb-2">
                  {resolvedTeamMembers.length > 0 ? "Responsables d'équipe" : "Équipe terrain"}
                </h4>
                {isTeamsLoading ? (
                  <p className="text-slate-500 text-sm">Chargement des équipes...</p>
                ) : resolvedTeamMembers.length > 0 ? (
                  <div className="space-y-2">
                    {resolvedTeamMembers.map((member, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-white">{member.name}</span>
                        <span className="text-slate-400">{member.role}</span>
                      </div>
                    ))}
                  </div>
                ) : selectedTeamRecord ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-white">{selectedTeamRecord.name}</span>
                      <span className="text-slate-400">
                        {selectedTeamRecord.tradeKey || selectedTeamRecord.role}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Aucun membre nominatif disponible, mais l'équipe peut être soumise telle quelle.
                    </p>
                  </div>
                ) : (
                  <p className="text-slate-500 text-sm">Aucune équipe disponible pour cette région</p>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h3 className="text-lg font-semibold text-white mb-4">Localisation & Dates</h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Région *</label>
                <input
                  type="text"
                  value={formData.regionName}
                  onChange={(e) => setFormData(prev => ({ ...prev, regionName: e.target.value, regionId: e.target.value }))}
                  placeholder="Ex: Tambacounda"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Date début *</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    title="Date de début de la mission"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Date fin *</label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    title="Date de fin de la mission"
                  />
                </div>
              </div>

              <div className="bg-slate-700/50 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Ménages ciblés</span>
                  <span className="text-white font-medium">{formData.householdCount || context.householdCount || 0}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {step === 4 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h3 className="text-lg font-semibold text-white mb-4">Budget</h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Budget estimé (FCFA) *</label>
                <input
                  type="number"
                  value={formData.budget}
                  onChange={(e) => setFormData(prev => ({ ...prev, budget: parseInt(e.target.value) || 0 }))}
                  placeholder="0"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Justification du budget</label>
                <textarea
                  value={formData.budgetJustification}
                  onChange={(e) => setFormData(prev => ({ ...prev, budgetJustification: e.target.value }))}
                  placeholder="Expliquez les postes de dépenses..."
                  rows={2}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                />
              </div>
            </div>
          </motion.div>
        )}

        {step === 5 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h3 className="text-lg font-semibold text-white mb-4">Matériaux</h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Matériaux requis</label>
                {formData.materials.length > 0 ? (
                  <div className="space-y-2 mb-3">
                    {formData.materials.map((mat, i) => (
                      <div key={i} className="flex items-center justify-between bg-slate-700/50 rounded-lg px-3 py-2">
                        <span className="text-white">{mat.name}</span>
                        <span className="text-slate-400">{mat.quantity} {mat.unit}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 text-sm mb-3">Aucun matériau ajouté</p>
                )}

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.additionalMaterials}
                    onChange={(e) => setFormData(prev => ({ ...prev, additionalMaterials: e.target.value }))}
                    placeholder="Ajouter un matériau..."
                    className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                  <button
                    onClick={addMaterial}
                    title="Ajouter le matériau"
                    aria-label="Ajouter matériau"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <div className="flex gap-2 p-1 bg-slate-900/50 rounded-lg mb-4">
                  <button
                    onClick={() => setFormData(prev => ({ ...prev, reportingMode: 'daily' }))}
                    className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-all ${
                      formData.reportingMode === 'daily'
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Suivi Journalier
                  </button>
                  <button
                    onClick={() => setFormData(prev => ({ ...prev, reportingMode: 'narrative' }))}
                    className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-all ${
                      formData.reportingMode === 'narrative'
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Rapport Global
                  </button>
                </div>

                {formData.reportingMode === 'daily' ? (
                  <>
                    <label className="block text-sm text-slate-400 mb-1">Notes terrain (Jalons)</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Observations, recommandations par étape..."
                      rows={3}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white mb-4"
                    />
                  </>
                ) : (
                  <>
                    <label className="block text-sm text-slate-400 mb-1">Synthèse narrative épurée</label>
                    <textarea
                      value={formData.narrativeReport}
                      onChange={(e) => setFormData(prev => ({ ...prev, narrativeReport: e.target.value }))}
                      placeholder="Rédigez votre rapport global ici..."
                      rows={8}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white font-mono text-xs mb-4"
                    />
                  </>
                )}

                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-slate-400">Photos Illustratives ({formData.photos.length})</label>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded flex items-center gap-1"
                  >
                    {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
                    Ajouter
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                    accept="image/*"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {formData.photos.map((photo) => (
                    <div key={photo.id} className="relative group bg-slate-700 rounded-lg overflow-hidden border border-slate-600">
                      <img 
                        src={photo.url} 
                        alt="Mission" 
                        className="w-full h-24 object-cover"
                      />
                      <button
                        onClick={() => removePhoto(photo.id)}
                        title="Supprimer la photo"
                        aria-label={`Supprimer la photo ${photo.id}`}
                        className="absolute top-1 right-1 p-1 bg-red-600 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                      <div className="p-1">
                        <input
                          type="text"
                          value={photo.comment || ''}
                          onChange={(e) => updatePhotoComment(photo.id, e.target.value)}
                          placeholder="Légende..."
                          className="w-full bg-transparent text-[10px] text-slate-300 outline-none"
                        />
                      </div>
                    </div>
                  ))}
                  {formData.photos.length === 0 && !isUploading && (
                    <div className="col-span-2 py-6 border-2 border-dashed border-slate-700 rounded-lg flex flex-col items-center justify-center text-slate-500">
                      <ImageIcon className="w-8 h-8 mb-1 opacity-20" />
                      <span className="text-xs">Aucune photo pour le moment</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-6 pt-4 border-t border-slate-700">
        <button
          onClick={handleBack}
          disabled={step === 1}
          className="px-4 py-2 text-slate-400 hover:text-white disabled:opacity-50"
        >
          ← Retour
        </button>
        
        <div className="flex gap-2">
          <button
            onClick={() => handleSubmit(true)}
            disabled={isLoading}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Sauvegarder
          </button>
          
          {step < 5 ? (
            <button
              onClick={handleNext}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"
            >
              Suivant
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => handleSubmit(false)}
              disabled={isLoading}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              Soumettre
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Résumé de mission pour affichage rapide
 */
export const MissionSummary: React.FC<{ mission: MissionLike }> = ({ mission }) => {
  return (
    <div className="bg-slate-800 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-white font-medium">{mission.title || 'Mission sans titre'}</h4>
        <span className={`px-2 py-1 rounded text-xs ${
          mission.status === 'draft' ? 'bg-slate-600 text-slate-300' :
          mission.status === 'soumise' ? 'bg-yellow-600 text-white' :
          'bg-green-600 text-white'
        }`}>
          {mission.status}
        </span>
      </div>
      
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="flex items-center gap-1 text-slate-400">
          <Users className="w-3 h-3" />
          {mission.teamName || 'Équipe non définie'}
        </div>
        <div className="flex items-center gap-1 text-slate-400">
          <MapPin className="w-3 h-3" />
          {mission.regionName || 'Région non définie'}
        </div>
        <div className="flex items-center gap-1 text-slate-400">
          <Calendar className="w-3 h-3" />
          {mission.startDate ? new Date(mission.startDate).toLocaleDateString() : '-'}
        </div>
        <div className="flex items-center gap-1 text-slate-400">
          <DollarSign className="w-3 h-3" />
          {mission.budget?.toLocaleString() || 0} FCA
        </div>
      </div>
    </div>
  );
};
