/**
 * Page Planning Formation - Gestion des formations d'électriciens
 * Modules, sessions, participants, planification par région
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar, Users, MapPin, Clock, FileText, Download,
  Plus, Trash2, Edit2, Check, X, ChevronDown, Save
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

// Les 14 régions du Sénégal
const SENEGAL_REGIONS = [
  'Dakar', 'Diourbel', 'Fatick', 'Kaffrine', 'Kaolack',
  'Kedougou', 'Kolda', 'Louga', 'Matam', 'Saint-Louis',
  'Sedhiou', 'Tambacounda', 'Thies', 'Ziguinchor'
];

// Types
interface FormationModule {
  id: string;
  name: string;
  description: string | null;
  duration: number;
  order: number;
  isActive?: boolean;
}

interface SessionModule {
  id: string;
  sessionId: string;
  moduleId: string;
  duration: number | null;
  orderIndex: number;
  notes: string | null;
  module: FormationModule;
}

interface FormationSession {
  id: string;
  region: string;
  salle: string;
  maxParticipants: number;
  startDate: string;
  endDate?: string;
  workSaturday: boolean;
  workSunday: boolean;
  status: string;
  notes?: string | null;
  sessionModules: SessionModule[];
  participants: FormationParticipant[];
  totalDays?: number;
  moduleCount?: number;
  participantCount?: number;
  availableSlots?: number;
}

interface FormationParticipant {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  attendance: boolean;
}

// API functions
const API_BASE = '/api/formations';

/**
 * Helper centralisé pour intercepter les erreurs HTTP (500, 401)
 */
const handleResponse = async (r: Response) => {
  if (!r.ok) {
    const errorData = await r.json().catch(() => ({}));
    throw new Error(errorData.message || `Erreur serveur (${r.status})`);
  }
  return r.json();
};

const formationApi = {
  // Modules
  getModules: () => fetch(`${API_BASE}/modules`).then(handleResponse),
  createModule: (data: Partial<FormationModule>) =>
    fetch(`${API_BASE}/modules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(handleResponse),
  updateModule: (id: string, data: Partial<FormationModule>) =>
    fetch(`${API_BASE}/modules/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(handleResponse),
  deleteModule: (id: string) =>
    fetch(`${API_BASE}/modules/${id}`, { method: 'DELETE' }).then(handleResponse),

  // Sessions
  getSessions: (filters?: Record<string, string>) => {
    const params = new URLSearchParams(filters);
    return fetch(`${API_BASE}/sessions?${params}`).then(handleResponse);
  },
  createSession: (data: { region: string; salle: string; maxParticipants: number; startDate: string; workSaturday: boolean; workSunday: boolean; notes?: string; modules: { moduleId: string; duration?: number; notes?: string }[] }) =>
    fetch(`${API_BASE}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(handleResponse),
  updateSession: (id: string, data: Partial<FormationSession> & { modules?: { moduleId: string; duration?: number; notes?: string }[] }) =>
    fetch(`${API_BASE}/sessions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(handleResponse),
  deleteSession: (id: string) =>
    fetch(`${API_BASE}/sessions/${id}`, { method: 'DELETE' }).then(handleResponse),

  // Session modules
  addModuleToSession: (sessionId: string, moduleId: string, duration?: number, notes?: string) =>
    fetch(`${API_BASE}/sessions/${sessionId}/modules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moduleId, duration, notes })
    }).then(handleResponse),
  removeModuleFromSession: (sessionId: string, moduleId: string) =>
    fetch(`${API_BASE}/sessions/${sessionId}/modules/${moduleId}`, { method: 'DELETE' }).then(handleResponse),

  // Participants
  addParticipant: (sessionId: string, data: Partial<FormationParticipant>) =>
    fetch(`${API_BASE}/sessions/${sessionId}/participants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(handleResponse),
  removeParticipant: (id: string) =>
    fetch(`${API_BASE}/participants/${id}`, { method: 'DELETE' }).then(handleResponse),

  // Planning & Stats
  getPlanning: (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    return fetch(`${API_BASE}/planning?${params}`).then(handleResponse);
  },
  getStats: () => fetch(`${API_BASE}/stats`).then(handleResponse),
};

export default function PlanningFormation() {
  useAuth();

  // State - données
  const [modules, setModules] = useState<FormationModule[]>([]);
  const [sessions, setSessions] = useState<FormationSession[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'planning' | 'modules' | 'stats'>('planning');

  // State - chargement pendant les opérations CRUD
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewPlan, setPreviewPlan] = useState<any | null>(null);
  const [showRegionConfig, setShowRegionConfig] = useState(false);
  const [regionConfig, setRegionConfig] = useState(() => SENEGAL_REGIONS.map(r => ({ region: r, count: 10, preferredSize: 20 })));
  const [includeWeekends, setIncludeWeekends] = useState(false);
  const [globalPreferredSize, setGlobalPreferredSize] = useState(20);

  // Filtres
  const [filterRegion, setFilterRegion] = useState('ALL');
  const [filterModule, setFilterModule] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Modal création session
  const [showModal, setShowModal] = useState(false);
  const [editingSession, setEditingSession] = useState<FormationSession | null>(null);

  // Modal création/modification module
  const [showModuleModal, setShowModuleModal] = useState(false);
  const [editingModule, setEditingModule] = useState<FormationModule | null>(null);

  // Formulaire nouvelle session - multi-modules
  const [formData, setFormData] = useState({
    region: 'Dakar',
    salle: '',
    maxParticipants: 20,
    startDate: '',
    endDate: '',
    workSaturday: false,
    workSunday: false,
    notes: '',
    selectedModules: [] as { moduleId: string; duration: number; notes: string }[],
  });

  // Formulaire module
  const [moduleFormData, setModuleFormData] = useState({
    name: '',
    description: '',
    duration: 1,
    order: 0,
  });

  // Validation du formulaire de session
  const validateSessionForm = (): string | null => {
    if (formData.selectedModules.length === 0) {
      return 'Sélectionnez au moins un module';
    }
    if (!formData.salle.trim()) {
      return 'Le nom de la salle est requis';
    }
    if (!formData.startDate) {
      return 'La date de début est requise';
    }
    if (formData.maxParticipants < 1 || formData.maxParticipants > 50) {
      return 'Le nombre de participants doit être entre 1 et 50';
    }
    if (formData.endDate && formData.startDate) {
      if (new Date(formData.endDate) < new Date(formData.startDate)) {
        return 'La date de fin ne peut pas être antérieure à la date de début';
      }
    }
    return null;
  };

  // Validation du formulaire de module
  const validateModuleForm = (): string | null => {
    if (!moduleFormData.name.trim()) {
      return 'Le nom du module est requis';
    }
    if (moduleFormData.duration < 1 || moduleFormData.duration > 30) {
      return 'La durée doit être entre 1 et 30 jours';
    }
    return null;
  };

  // Charger les données
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [mods, sess, st] = await Promise.all([
        formationApi.getModules(),
        formationApi.getSessions(),
        formationApi.getStats()
      ]);
      // Ensure we always have arrays (guard against null/undefined)
      setModules(Array.isArray(mods) ? mods : []);
      setSessions(Array.isArray(sess) ? sess : []);
      setStats(st && typeof st === 'object' ? st : null);
    } catch (error) {
      console.error('Erreur chargement données:', error);
      setError('Erreur lors du chargement des données. Veuillez rafraîchir la page.');
      toast.error('Erreur lors du chargement des données');
      // Initialize with empty arrays on error
      setModules([]);
      setSessions([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  // Calculer la date de fin
  const calculateEndDate = (start: string, days: number, workSat: boolean, workSun: boolean): string => {
    const date = new Date(start);
    let added = 0;
    while (added < days) {
      date.setDate(date.getDate() + 1);
      const day = date.getDay();
      const isWorking = day !== 0 && (day !== 6 || workSat);
      const isSunday = day === 0;
      if (!isSunday || (isSunday && workSun)) added++;
    }
    return date.toISOString().split('T')[0];
  };

  // Sessions filtrées
  const filteredSessions = useMemo(() => {
    return sessions.filter(s => {
      if (filterRegion !== 'ALL' && s.region !== filterRegion) return false;
      if (filterStatus !== 'ALL' && s.status !== filterStatus) return false;
      // Filter by module if any session module matches
      if (filterModule !== 'ALL') {
        const hasModule = s.sessionModules?.some(sm => sm.moduleId === filterModule);
        if (!hasModule) return false;
      }
      return true;
    });
  }, [sessions, filterRegion, filterModule, filterStatus]);

  // Créer une session avec plusieurs modules
  const handleCreateSession = async () => {
    // Validation
    const validationError = validateSessionForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const session = await formationApi.createSession({
        region: formData.region,
        salle: formData.salle.trim(),
        maxParticipants: formData.maxParticipants,
        startDate: formData.startDate,
        workSaturday: formData.workSaturday,
        workSunday: formData.workSunday,
        notes: formData.notes?.trim() || undefined,
        modules: formData.selectedModules.map((m, idx) => ({
          moduleId: m.moduleId,
          duration: m.duration,
          notes: m.notes?.trim() || undefined,
          orderIndex: idx,
        })),
      });

      setSessions(prev => [...prev, session].filter(Boolean));
      setShowModal(false);
      resetForm();
      toast.success('Session créée avec succès');
      loadData();
    } catch (error) {
      console.error('Erreur création session:', error);
      toast.error('Erreur lors de la création de la session');
    } finally {
      setSubmitting(false);
    }
  };

  // Créer/modifier un module
  const handleSaveModule = async () => {
    // Validation
    const validationError = validateModuleForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const data = {
        name: moduleFormData.name.trim(),
        description: moduleFormData.description?.trim() || undefined,
        duration: moduleFormData.duration,
        order: moduleFormData.order,
      };

      if (editingModule) {
        await formationApi.updateModule(editingModule.id, data);
        toast.success('Module mis à jour');
      } else {
        await formationApi.createModule(data);
        toast.success('Module créé');
      }
      setShowModuleModal(false);
      setModuleFormData({ name: '', description: '', duration: 1, order: 0 });
      setEditingModule(null);
      loadData();
    } catch (error) {
      console.error('Erreur enregistrement module:', error);
      toast.error('Erreur lors de l\'enregistrement du module');
    } finally {
      setSubmitting(false);
    }
  };

  // Supprimer un module
  const handleDeleteModule = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce module?')) return;

    setSubmitting(true);
    try {
      const result = await formationApi.deleteModule(id);
      if (result.deactivated) {
        toast.success('Module désactivé (utilisé dans des sessions)');
      } else {
        toast.success('Module supprimé');
      }
      loadData();
    } catch (error) {
      console.error('Erreur suppression module:', error);
      toast.error('Erreur lors de la suppression du module');
    } finally {
      setSubmitting(false);
    }
  };

  // Ajouter un module à la session en cours de création
  const addModuleToForm = (moduleId: string) => {
    const module = modules.find(m => m.id === moduleId);
    if (!module) return;

    if (formData.selectedModules.find(m => m.moduleId === moduleId)) {
      toast.error('Module déjà ajouté');
      return;
    }

    setFormData({
      ...formData,
      selectedModules: [...formData.selectedModules, { moduleId, duration: module.duration, notes: '' }],
    });
  };

  // Retirer un module de la session en cours de création
  const removeModuleFromForm = (moduleId: string) => {
    setFormData({
      ...formData,
      selectedModules: formData.selectedModules.filter(m => m.moduleId !== moduleId),
    });
  };

  // Mettre à jour la durée d'un module dans le formulaire
  const updateModuleDuration = (moduleId: string, duration: number) => {
    setFormData({
      ...formData,
      selectedModules: formData.selectedModules.map(m =>
        m.moduleId === moduleId ? { ...m, duration } : m
      ),
    });
  };

  // Supprimer une session
  const handleDeleteSession = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette session?')) return;

    setSubmitting(true);
    try {
      await formationApi.deleteSession(id);
      setSessions(prev => prev.filter(s => s && s.id !== id));
      toast.success('Session supprimée');
      loadData();
    } catch (error) {
      console.error('Erreur suppression session:', error);
      toast.error('Erreur lors de la suppression de la session');
    } finally {
      setSubmitting(false);
    }
  };

  // Réinitialiser le formulaire
  const resetForm = () => {
    setFormData({
      region: 'Dakar',
      salle: '',
      maxParticipants: 20,
      startDate: '',
      endDate: '',
      workSaturday: false,
      workSunday: false,
      notes: '',
      selectedModules: [],
    });
    setEditingSession(null);
  };

  // Réinitialiser le formulaire module
  const resetModuleForm = () => {
    setModuleFormData({ name: '', description: '', duration: 1, order: 0 });
    setEditingModule(null);
  };

  // Exporter en Word (simulation - génère un HTML imprimable)
  const handleExportWord = () => {
    const content = generatePlanningHTML();
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `planning_formations_${new Date().toISOString().split('T')[0]}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Planning exporté');
  };

  // Générer un planning automatique (exemple: 10 personnes par région)
  const handleGeneratePlan = async (perRegionCount?: number) => {
    try {
      setSubmitting(true);
      const regionsPayload = regionConfig.map(rc => ({ region: rc.region, count: Number(rc.count || perRegionCount || 10), preferredSize: Number(rc.preferredSize || globalPreferredSize) }));
      const resp = await fetch(`${API_BASE}/planify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ regions: regionsPayload, options: { includeWeekends } })
      });
      if (!resp.ok) throw new Error('Erreur génération planning');
      const plan = await resp.json();
      setPreviewPlan(plan);
      toast.success('Planning généré (prévisualisation)');
    } catch (e) {
      console.error(e);
      toast.error('Impossible de générer le planning');
    } finally {
      setSubmitting(false);
    }
  };

  // Exporter PDF via backend export endpoint (utilise le plan de prévisualisation si présent)
  const handleExportPdf = async () => {
    try {
      setSubmitting(true);
      const body: any = {};
      if (previewPlan) body.plan = previewPlan;
      body.format = 'pdf';
      const resp = await fetch(`${API_BASE}/planify/export`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!resp.ok) throw new Error('Export failed');
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `plan_formation_${new Date().toISOString().split('T')[0]}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export PDF téléchargé');
    } catch (e) {
      console.error(e);
      toast.error('Erreur lors de l\'export PDF');
    } finally {
      setSubmitting(false);
    }
  };

  // Exporter DOCX via backend export endpoint
  const handleExportDocx = async () => {
    try {
      setSubmitting(true);
      const body: any = {};
      if (previewPlan) body.plan = previewPlan;
      body.format = 'docx';
      const resp = await fetch(`${API_BASE}/planify/export`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!resp.ok) throw new Error('Export failed');
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `plan_formation_${new Date().toISOString().split('T')[0]}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export DOCX téléchargé');
    } catch (e) {
      console.error(e);
      toast.error('Erreur lors de l\'export DOCX');
    } finally {
      setSubmitting(false);
    }
  };

  // Persister le plan en base
  const handleCommitPlan = async () => {
    if (!previewPlan) return toast.error('Aucun plan à sauvegarder');
    try {
      setSubmitting(true);
      const resp = await fetch(`${API_BASE}/planify/commit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: previewPlan }) });
      if (!resp.ok) throw new Error('Commit failed');
      const data = await resp.json();
      toast.success(`${data.count || 0} sessions créées en base`);
      setPreviewPlan(null);
      loadData();
    } catch (e) {
      console.error(e);
      toast.error('Erreur lors de la sauvegarde du plan');
    } finally {
      setSubmitting(false);
    }
  };

  // Générer HTML pour export
  const generatePlanningHTML = () => {
    const groupedByRegion = filteredSessions.reduce((acc, s) => {
      if (!acc[s.region]) acc[s.region] = [];
      acc[s.region].push(s);
      return acc;
    }, {} as Record<string, FormationSession[]>);

    let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Planning des Formations - GEM</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    h1 { color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 10px; }
    h2 { color: #1e293b; margin-top: 30px; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; }
    th { background: #f1f5f9; }
    .module { font-weight: bold; color: #1e40af; }
    .salle { color: #475569; }
    .status { padding: 3px 8px; border-radius: 4px; font-size: 12px; }
    .PLANIFIEE { background: #dbeafe; color: #1e40af; }
    .EN_COURS { background: #dcfce7; color: #166534; }
    .TERMINEE { background: #f1f5f9; color: #475569; }
    .ANNULEE { background: #fee2e2; color: #991b1b; }
    .footer { margin-top: 30px; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <h1>📚 Planning des Formations - GEM</h1>
  <p>Généré le: ${new Date().toLocaleDateString('fr-FR')}</p>
  <p>Total sessions: ${filteredSessions.length}</p>
`;

    Object.entries(groupedByRegion).forEach(([region, regionSessions]) => {
      html += `<h2>🏛️ ${region}</h2>`;
      html += `<table>
        <tr>
          <th>Module</th>
          <th>Salle</th>
          <th>Début</th>
          <th>Fin</th>
          <th>Jours</th>
          <th>Participants</th>
          <th>Status</th>
        </tr>`;

      regionSessions.forEach(s => {
        const start = new Date(s.startDate).toLocaleDateString('fr-FR');
        const end = s.endDate ? new Date(s.endDate).toLocaleDateString('fr-FR') : '-';
        html += `<tr>
          <td class="module">${s.sessionModules?.[0]?.module?.name || 'Module'}</td>
          <td class="salle">${s.salle}</td>
          <td>${start}</td>
          <td>${end}</td>
          <td>${s.totalDays || 0}j${s.workSaturday ? ' (sam)' : ''}${s.workSunday ? ' (dim)' : ''}</td>
          <td>${s.participants?.length || 0}/${s.maxParticipants}</td>
          <td><span class="status ${s.status}">${s.status}</span></td>
        </tr>`;
      });

      html += '</table>';
    });

    html += `
  <div class="footer">
    <p> GEM - Gestion des Missions et Électriciens </p>
  </div>
</body>
</html>`;

    return html;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 bg-slate-950 min-h-screen">
      {/* Message d'erreur global */}
      {error && (
        <div className="mb-4 p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-300 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={loadData} className="px-3 py-1 bg-red-500 hover:bg-red-600 rounded text-sm">
            Réessayer
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <GraduationCap className="w-8 h-8 text-blue-400" />
            Planning des Formations
          </h1>
          <p className="text-slate-400 mt-1">
            Gestion des formations d'électriciens par région
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => handleGeneratePlan(10)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
            title="Générer un planning automatique (10 pers/région)"
          >
            <Calendar className="w-4 h-4" />
            Générer planning
          </button>
          <button
            onClick={() => setShowRegionConfig(!showRegionConfig)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
            title="Configurer les effectifs par région"
            aria-pressed={showRegionConfig}
          >
            <MapPin className="w-4 h-4" />
            Configurer régions
          </button>
          <button
            onClick={handleExportPdf}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg"
            title="Exporter le dernier planning en PDF"
          >
            <Download className="w-4 h-4" />
            Exporter PDF
          </button>
          <button
            onClick={handleExportDocx}
            className="flex items-center gap-2 px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-lg"
            title="Exporter le dernier planning en .docx"
          >
            <FileText className="w-4 h-4" />
            Exporter DOCX
          </button>
          <button
            onClick={handleCommitPlan}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
            title="Sauvegarder le plan généré en base"
          >
            <Save className="w-4 h-4" />
            Sauvegarder plan
          </button>
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            <Plus className="w-4 h-4" />
            Nouvelle Session
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('planning')}
          className={`px-4 py-2 rounded-lg font-medium ${activeTab === 'planning'
            ? 'bg-blue-600 text-white'
            : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
        >
          <Calendar className="w-4 h-4 inline mr-2" />
          Planning
        </button>
        <button
          onClick={() => setActiveTab('modules')}
          className={`px-4 py-2 rounded-lg font-medium ${activeTab === 'modules'
            ? 'bg-blue-600 text-white'
            : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
        >
          <BookOpen className="w-4 h-4 inline mr-2" />
          Modules
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`px-4 py-2 rounded-lg font-medium ${activeTab === 'stats'
            ? 'bg-blue-600 text-white'
            : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
        >
          <BarChart3 className="w-4 h-4 inline mr-2" />
          Statistiques
        </button>
      </div>

      {/* Config régionale (toggle) */}
      {showRegionConfig && (
        <div className="mb-6 p-4 bg-slate-800 rounded-lg" aria-live="polite">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-white font-semibold">Configurer les effectifs par région</h3>
            <div className="flex items-center gap-2">
              <label className="text-slate-300 mr-2">Inclure week‑ends</label>
              <input aria-label="Inclure week-ends" title="Inclure week-ends" type="checkbox" checked={includeWeekends} onChange={e => setIncludeWeekends(e.target.checked)} />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-64 overflow-auto">
            {regionConfig.map((rc, idx) => (
              <div key={rc.region} className="p-2 bg-slate-900 rounded">
                <label className="text-slate-300 block text-sm">{rc.region}</label>
                <input aria-label={`Effectif ${rc.region}`} title={`Effectif ${rc.region}`} placeholder="Nombre" type="number" min={0} value={rc.count}
                  onChange={e => setRegionConfig(prev => { const copy = [...prev]; copy[idx] = { ...copy[idx], count: Number(e.target.value || 0) }; return copy; })}
                  className="w-full mt-1 p-2 rounded bg-slate-800 text-white" />
                <input aria-label={`Taille préférée ${rc.region}`} title={`Taille préférée ${rc.region}`} placeholder="Taille groupe" type="number" min={1} value={rc.preferredSize}
                  onChange={e => setRegionConfig(prev => { const copy = [...prev]; copy[idx] = { ...copy[idx], preferredSize: Number(e.target.value || 20) }; return copy; })}
                  className="w-full mt-1 p-2 rounded bg-slate-800 text-white" />
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={() => handleGeneratePlan()} className="px-4 py-2 bg-emerald-600 text-white rounded" title="Générer avec cette configuration">Générer</button>
            <button onClick={() => { setShowRegionConfig(false); }} className="px-4 py-2 bg-slate-700 text-white rounded" title="Fermer">Fermer</button>
          </div>
        </div>
      )}

      {/* Contenu selon onglet */}
      {activeTab === 'planning' && (
        <>
          {/* Filtres */}
          <div className="flex flex-wrap gap-3 mb-6">
            <select
              value={filterRegion}
              onChange={(e) => setFilterRegion(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2"
            >
              <option value="ALL">Toutes les régions</option>
              {SENEGAL_REGIONS.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>

            <select
              value={filterModule}
              onChange={(e) => setFilterModule(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2"
            >
              <option value="ALL">Tous les modules</option>
              {(modules || []).map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2"
            >
              <option value="ALL">Tous les statuts</option>
              <option value="PLANIFIEE">Planifiée</option>
              <option value="EN_COURS">En cours</option>
              <option value="TERMINEE">Terminée</option>
              <option value="ANNULEE">Annulée</option>
            </select>
          </div>

          {/* Tableau planning */}
          <div className="bg-slate-900 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-slate-400 font-medium">Région</th>
                    <th className="px-4 py-3 text-left text-slate-400 font-medium">Module</th>
                    <th className="px-4 py-3 text-left text-slate-400 font-medium">Salle</th>
                    <th className="px-4 py-3 text-left text-slate-400 font-medium">Dates</th>
                    <th className="px-4 py-3 text-left text-slate-400 font-medium">Participants</th>
                    <th className="px-4 py-3 text-left text-slate-400 font-medium">Status</th>
                    <th className="px-4 py-3 text-left text-slate-400 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(!filteredSessions || filteredSessions.length === 0) ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        Aucune session trouvée
                      </td>
                    </tr>
                  ) : (
                    filteredSessions.map((session) => (
                      <tr key={session?.id} className="border-t border-slate-800 hover:bg-slate-800/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 text-white">
                            <MapPin className="w-4 h-4 text-slate-500" />
                            {session.region}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-white font-medium">
                            {session.sessionModules?.map(sm => sm.module?.name).join(', ') || 'Aucun module'}
                          </div>
                          <div className="text-slate-500 text-sm">
                            {session.totalDays || session.sessionModules?.reduce((sum, sm) => sum + (sm.duration || sm.module?.duration || 1), 0)} jours • {session.sessionModules?.length || 0} module(s)
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-300">{session.salle}</td>
                        <td className="px-4 py-3">
                          <div className="text-white text-sm">
                            {new Date(session.startDate).toLocaleDateString('fr-FR')}
                          </div>
                          {session.endDate && (
                            <div className="text-slate-500 text-xs">
                              → {new Date(session.endDate).toLocaleDateString('fr-FR')}
                            </div>
                          )}
                          <div className="text-slate-500 text-xs">
                            {session.workSaturday && 'Sam. '}{session.workSunday && 'Dim.'}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-slate-500" />
                            <span className="text-white">
                              {session.participants?.length || 0}/{session.maxParticipants}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${session.status === 'PLANIFIEE' ? 'bg-blue-500/20 text-blue-400' :
                            session.status === 'EN_COURS' ? 'bg-green-500/20 text-green-400' :
                              session.status === 'TERMINEE' ? 'bg-slate-500/20 text-slate-400' :
                                'bg-red-500/20 text-red-400'
                            }`}>
                            {session.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleDeleteSession(session.id)}
                              className="p-1 text-red-400 hover:text-red-300"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'modules' && (
        <div className="space-y-4">
          {/* Bouton ajouter module */}
          <div className="flex justify-end">
            <button
              onClick={() => { resetModuleForm(); setShowModuleModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            >
              <Plus className="w-4 h-4" />
              Nouveau Module
            </button>
          </div>

          {/* Liste des modules */}
          {(!modules || modules.length === 0) ? (
            <div className="text-center py-12 text-slate-500">
              <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Aucun module de formation créé.</p>
              <p className="text-sm mt-2">Cliquez sur "Nouveau Module" pour en créer un.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(modules || []).filter(m => m && m.isActive !== false).map(module => (
              <div key={module.id} className="bg-slate-900 rounded-xl p-4 border border-slate-800">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-white font-semibold text-lg">{module.name}</h3>
                    <p className="text-slate-400 text-sm mt-1">{module.description}</p>
                  </div>
                  <div className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded text-sm">
                    {module.duration} jours
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-500 text-sm">
                    <Clock className="w-4 h-4" />
                    Durée: {module.duration} jour{module.duration > 1 ? 's' : ''}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setEditingModule(module); setModuleFormData({ name: module.name, description: module.description || '', duration: module.duration, order: module.order }); setShowModuleModal(true); }}
                      className="p-1 text-blue-400 hover:text-blue-300"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteModule(module.id)}
                      className="p-1 text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            </div>
          )}

          {/* Modules désactivés */}
          {(modules || []).filter(m => m && m.isActive === false).length > 0 && (
            <div className="mt-6">
              <h3 className="text-slate-400 font-medium mb-3">Modules désactivés</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-60">
                {(modules || []).filter(m => m && m.isActive === false).map(module => (
                  <div key={module.id} className="bg-slate-900 rounded-xl p-4 border border-slate-800">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-white font-semibold text-lg">{module.name}</h3>
                        <p className="text-slate-400 text-sm mt-1">{module.description}</p>
                      </div>
                      <div className="bg-slate-500/20 text-slate-400 px-2 py-1 rounded text-sm">
                        {module.duration} jours
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'stats' && stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
            <div className="text-slate-400 text-sm">Total Sessions</div>
            <div className="text-3xl font-bold text-white mt-1">{stats.totalSessions}</div>
          </div>
          <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
            <div className="text-slate-400 text-sm">Total Participants</div>
            <div className="text-3xl font-bold text-white mt-1">{stats.totalParticipants}</div>
          </div>
          <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
            <div className="text-slate-400 text-sm">Régions</div>
            <div className="text-3xl font-bold text-white mt-1">{stats.byRegion?.length || 0}</div>
          </div>
          <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
            <div className="text-slate-400 text-sm">Modules</div>
            <div className="text-3xl font-bold text-white mt-1">{stats.byModule?.length || 0}</div>
          </div>
        </div>
      )}

      {/* Modal création session */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">
                {editingSession ? 'Modifier la session' : 'Nouvelle session de formation'}
              </h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="text-slate-400">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Sélection des modules */}
              <div>
                <label className="block text-sm text-slate-400 mb-2">Modules de formation *</label>
                {(!modules || modules.filter(m => m && m.isActive !== false).length === 0) ? (
                  <div className="text-slate-500 text-sm p-4 bg-slate-800 rounded-lg text-center">
                    Aucun module disponible. Créez d'abord des modules dans l'onglet "Modules".
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {(modules || []).filter(m => m && m.isActive !== false).map(module => {
                    const isSelected = formData.selectedModules.some(m => m.moduleId === module.id);
                    return (
                      <div key={module.id} className="flex items-center gap-3 p-2 bg-slate-800 rounded-lg">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => isSelected ? removeModuleFromForm(module.id) : addModuleToForm(module.id)}
                          className="w-4 h-4 rounded bg-slate-700 border-slate-600"
                        />
                        <div className="flex-1">
                          <div className="text-white">{module.name}</div>
                          <div className="text-slate-500 text-xs">{module.duration} jours</div>
                        </div>
                        {isSelected && (
                          <input
                            type="number"
                            min="1"
                            max="30"
                            value={formData.selectedModules.find(m => m.moduleId === module.id)?.duration || module.duration}
                            onChange={(e) => updateModuleDuration(module.id, parseInt(e.target.value) || 1)}
                            className="w-16 bg-slate-700 border border-slate-600 text-white text-sm rounded px-2 py-1"
                            placeholder="Jours"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
                )}
              </div>

              {formData.selectedModules.length > 0 && (
                <div className="mt-2 text-sm text-blue-400">
                  {formData.selectedModules.length} module(s) sélectionné(s) • Total: {formData.selectedModules.reduce((sum, m) => sum + m.duration, 0)} jours
                </div>
              )}

              {/* Région */}
              <div>
                <label className="block text-sm text-slate-400 mb-1">Région *</label>
                <select
                  value={formData.region}
                  onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2"
                >
                  {SENEGAL_REGIONS.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {/* Salle */}
              <div>
                <label className="block text-sm text-slate-400 mb-1">Nom de la salle *</label>
                <input
                  type="text"
                  value={formData.salle}
                  onChange={(e) => setFormData({ ...formData, salle: e.target.value })}
                  placeholder="Ex: Salle A - Centre de formation Dakar"
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2"
                  required
                />
              </div>

              {/* Date de début */}
              <div>
                <label className="block text-sm text-slate-400 mb-1">Date de début *</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2"
                  required
                />
              </div>

              {/* Durée et participants */}
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Max participants</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={formData.maxParticipants}
                    onChange={(e) => setFormData({ ...formData, maxParticipants: parseInt(e.target.value) || 20 })}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm text-slate-400 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Notes optionnelles..."
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2"
                  rows={2}
                />
              </div>
            </div>

            {/* Boutons */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleCreateSession}
                disabled={submitting || formData.selectedModules.length === 0 || !formData.salle.trim() || !formData.startDate}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Création...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Créer la session
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal création/modification module */}
      {showModuleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">
                {editingModule ? 'Modifier le module' : 'Nouveau module'}
              </h2>
              <button onClick={() => { setShowModuleModal(false); resetModuleForm(); }} className="text-slate-400">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Nom du module *</label>
                <input
                  type="text"
                  value={moduleFormData.name}
                  onChange={(e) => setModuleFormData({ ...moduleFormData, name: e.target.value })}
                  placeholder="Ex: Habilitation électrique"
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Description</label>
                <textarea
                  value={moduleFormData.description}
                  onChange={(e) => setModuleFormData({ ...moduleFormData, description: e.target.value })}
                  placeholder="Description du module..."
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Durée par défaut (jours)</label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={moduleFormData.duration}
                  onChange={(e) => setModuleFormData({ ...moduleFormData, duration: parseInt(e.target.value) || 1 })}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Ordre d'affichage</label>
                <input
                  type="number"
                  min="0"
                  value={moduleFormData.order}
                  onChange={(e) => setModuleFormData({ ...moduleFormData, order: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowModuleModal(false); resetModuleForm(); }}
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveModule}
                disabled={submitting || !moduleFormData.name.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {editingModule ? 'Mettre à jour' : 'Créer'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Icônes manquantes
function GraduationCap(props: any) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </svg>
  );
}

function BookOpen(props: any) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

function BarChart3(props: any) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3v18h18" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </svg>
  );
}