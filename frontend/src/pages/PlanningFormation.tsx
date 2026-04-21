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
}

interface FormationSession {
  id: string;
  moduleId: string;
  module?: FormationModule;
  region: string;
  salle: string;
  maxParticipants: number;
  startDate: string;
  endDate?: string;
  durationDays: number;
  workSaturday: boolean;
  workSunday: boolean;
  status: string;
  participants: FormationParticipant[];
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

const formationApi = {
  getModules: () => fetch(`${API_BASE}/modules`).then(r => r.json()),
  getSessions: (filters?: Record<string, string>) => {
    const params = new URLSearchParams(filters);
    return fetch(`${API_BASE}/sessions?${params}`).then(r => r.json());
  },
  createSession: (data: Partial<FormationSession>) => 
    fetch(`${API_BASE}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json()),
  updateSession: (id: string, data: Partial<FormationSession>) =>
    fetch(`${API_BASE}/sessions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json()),
  deleteSession: (id: string) =>
    fetch(`${API_BASE}/sessions/${id}`, { method: 'DELETE' }).then(r => r.json()),
  addParticipant: (sessionId: string, data: Partial<FormationParticipant>) =>
    fetch(`${API_BASE}/sessions/${sessionId}/participants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json()),
  removeParticipant: (id: string) =>
    fetch(`${API_BASE}/participants/${id}`, { method: 'DELETE' }).then(r => r.json()),
  getPlanning: (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    return fetch(`${API_BASE}/planning?${params}`).then(r => r.json());
  },
  getStats: () => fetch(`${API_BASE}/stats`).then(r => r.json()),
};

export default function PlanningFormation() {
  useAuth();
  
  // State
  const [modules, setModules] = useState<FormationModule[]>([]);
  const [sessions, setSessions] = useState<FormationSession[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'planning' | 'modules' | 'stats'>('planning');
  
  // Filtres
  const [filterRegion, setFilterRegion] = useState('ALL');
  const [filterModule, setFilterModule] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  
  // Modal création session
  const [showModal, setShowModal] = useState(false);
  const [editingSession, setEditingSession] = useState<FormationSession | null>(null);
  
  // Formulaire nouvelle session
  const [formData, setFormData] = useState({
    moduleId: '',
    region: 'Dakar',
    salle: '',
    maxParticipants: 20,
    startDate: '',
    durationDays: 3,
    workSaturday: false,
    workSunday: false,
  });

  // Charger les données
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [mods, sess, st] = await Promise.all([
        formationApi.getModules(),
        formationApi.getSessions(),
        formationApi.getStats()
      ]);
      setModules(mods);
      setSessions(sess);
      setStats(st);
    } catch (error) {
      console.error('Erreur chargement données:', error);
      toast.error('Erreur lors du chargement des données');
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
      if (filterModule !== 'ALL' && s.moduleId !== filterModule) return false;
      if (filterStatus !== 'ALL' && s.status !== filterStatus) return false;
      return true;
    });
  }, [sessions, filterRegion, filterModule, filterStatus]);

  // Créer une session
  const handleCreateSession = async () => {
    try {
      const endDate = calculateEndDate(
        formData.startDate, 
        formData.durationDays, 
        formData.workSaturday, 
        formData.workSunday
      );
      
      const session = await formationApi.createSession({
        ...formData,
        startDate: formData.startDate,
        endDate
      });
      
      setSessions([...sessions, session]);
      setShowModal(false);
      resetForm();
      toast.success('Session créée avec succès');
      loadData();
    } catch (error) {
      toast.error('Erreur lors de la création');
    }
  };

  // Supprimer une session
  const handleDeleteSession = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette session?')) return;
    
    try {
      await formationApi.deleteSession(id);
      setSessions(sessions.filter(s => s.id !== id));
      toast.success('Session supprimée');
      loadData();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  // Réinitialiser le formulaire
  const resetForm = () => {
    setFormData({
      moduleId: '',
      region: 'Dakar',
      salle: '',
      maxParticipants: 20,
      startDate: '',
      durationDays: 3,
      workSaturday: false,
      workSunday: false,
    });
    setEditingSession(null);
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
          <td class="module">${s.module?.name || 'Module'}</td>
          <td class="salle">${s.salle}</td>
          <td>${start}</td>
          <td>${end}</td>
          <td>${s.durationDays}j${s.workSaturday ? ' (sam)' : ''}${s.workSunday ? ' (dim)' : ''}</td>
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
            onClick={handleExportWord}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg"
          >
            <Download className="w-4 h-4" />
            Exporter
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
          className={`px-4 py-2 rounded-lg font-medium ${
            activeTab === 'planning' 
              ? 'bg-blue-600 text-white' 
              : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <Calendar className="w-4 h-4 inline mr-2" />
          Planning
        </button>
        <button
          onClick={() => setActiveTab('modules')}
          className={`px-4 py-2 rounded-lg font-medium ${
            activeTab === 'modules' 
              ? 'bg-blue-600 text-white' 
              : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <BookOpen className="w-4 h-4 inline mr-2" />
          Modules
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`px-4 py-2 rounded-lg font-medium ${
            activeTab === 'stats' 
              ? 'bg-blue-600 text-white' 
              : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <BarChart3 className="w-4 h-4 inline mr-2" />
          Statistiques
        </button>
      </div>

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
              {modules.map(m => (
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
                  {filteredSessions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        Aucune session trouvée
                      </td>
                    </tr>
                  ) : (
                    filteredSessions.map((session, idx) => (
                      <tr key={session.id} className="border-t border-slate-800 hover:bg-slate-800/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 text-white">
                            <MapPin className="w-4 h-4 text-slate-500" />
                            {session.region}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-white font-medium">{session.module?.name}</div>
                          <div className="text-slate-500 text-sm">{session.durationDays} jours</div>
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
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            session.status === 'PLANIFIEE' ? 'bg-blue-500/20 text-blue-400' :
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map(module => (
            <div key={module.id} className="bg-slate-900 rounded-xl p-4 border border-slate-800">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-white font-semibold text-lg">{module.name}</h3>
                  <p className="text-slate-400 text-sm mt-1">{module.description}</p>
                </div>
                <div className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded text-sm">
                  {module.duration} jours
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-slate-500 text-sm">
                <Clock className="w-4 h-4" />
                Durée: {module.duration} jour{module.duration > 1 ? 's' : ''}
              </div>
            </div>
          ))}
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
              {/* Module */}
              <div>
                <label className="block text-sm text-slate-400 mb-1">Module de formation *</label>
                <select
                  value={formData.moduleId}
                  onChange={(e) => setFormData({ ...formData, moduleId: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2"
                  required
                >
                  <option value="">Sélectionner un module</option>
                  {modules.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.duration} jours)
                    </option>
                  ))}
                </select>
              </div>

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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Durée (jours) *</label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={formData.durationDays}
                    onChange={(e) => setFormData({ ...formData, durationDays: parseInt(e.target.value) || 1 })}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2"
                  />
                </div>
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

              {/* Options jours travaillés */}
              <div className="bg-slate-800/50 rounded-lg p-4">
                <label className="block text-sm text-slate-400 mb-3">Jours travaillés</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-white">
                    <input
                      type="checkbox"
                      checked={formData.workSaturday}
                      onChange={(e) => setFormData({ ...formData, workSaturday: e.target.checked })}
                      className="w-4 h-4 rounded bg-slate-700 border-slate-600"
                    />
                    Samedi travaillé
                  </label>
                  <label className="flex items-center gap-2 text-white">
                    <input
                      type="checkbox"
                      checked={formData.workSunday}
                      onChange={(e) => setFormData({ ...formData, workSunday: e.target.checked })}
                      className="w-4 h-4 rounded bg-slate-700 border-slate-600"
                    />
                    Dimanche travaillé
                  </label>
                </div>
              </div>
            </div>

            {/* Boutons */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
              >
                Annuler
              </button>
              <button
                onClick={handleCreateSession}
                disabled={!formData.moduleId || !formData.salle || !formData.startDate}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
              >
                <Save className="w-4 h-4 inline mr-2" />
                Créer la session
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