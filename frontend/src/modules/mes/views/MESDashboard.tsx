import React, { useState, useEffect, useCallback } from 'react';
import {
  Zap,
  ClipboardList,
  MapPin,
  Users,
  Truck,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  Calendar,
  Filter,
  Download,
  Upload,
  Plus,
  Search,
  RefreshCw,
  FileText,
  ShieldCheck,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { PageContainer, PageHeader, ContentArea } from '../../../components/layout';
import toast from 'react-hot-toast';

// Types pour le module MES
type MESStatus = 'RECU' | 'PROGRAMME' | 'EN_COURS' | 'REALISE' | 'CONTROLE' | 'VALIDE' | 'FACTURE' | 'PAYE';
type MESType = 'MONO' | 'TRI';
type MESNature = 'POSE' | 'BRANCHEMENT_POSE';

interface MESRecord {
  id: string;
  avisNumber: string;
  meterNumber: string;
  poste: string;
  zone: string;
  type: MESType;
  nature: MESNature;
  cable?: string;
  ct70?: boolean;
  pa?: boolean;
  agent: string;
  date: string;
  observations?: string;
  status: MESStatus;
  prestataire: 'PROQUELEC' | 'UMSAT' | 'AUTRE';
  photos?: string[];
  gps?: { lat: number; lng: number };
  clientSignature?: string;
}

interface MESStats {
  total: number;
  poseMono: number;
  poseTri: number;
  branchementPoseMono: number;
  branchementPoseTri: number;
  enCours: number;
  realises: number;
  controles: number;
  valides: number;
  tauxConformite: number;
}

const MESDashboard: React.FC = () => {
  const [records, setRecords] = useState<MESRecord[]>([]);
  const [stats, setStats] = useState<MESStats>({
    total: 0,
    poseMono: 0,
    poseTri: 0,
    branchementPoseMono: 0,
    branchementPoseTri: 0,
    enCours: 0,
    realises: 0,
    controles: 0,
    valides: 0,
    tauxConformite: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedPrestataire, setSelectedPrestataire] = useState<'ALL' | 'PROQUELEC' | 'UMSAT'>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<MESStatus | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('2026-04');

  // Charger les données MES
  const loadMESData = useCallback(async () => {
    setLoading(true);
    try {
      // Simulation de chargement des données depuis l'API
      // En production, ceci serait remplacé par un appel API réel
      const mockData: MESRecord[] = [
        {
          id: '1',
          avisNumber: 'AV-001',
          meterNumber: 'CT-12345',
          poste: 'POSTE-01',
          zone: 'Patte d\'Oie',
          type: 'MONO',
          nature: 'POSE',
          cable: '2x16',
          ct70: true,
          agent: 'Agent 1',
          date: '2026-04-01',
          status: 'REALISE',
          prestataire: 'PROQUELEC',
        },
        {
          id: '2',
          avisNumber: 'AV-002',
          meterNumber: 'CT-12346',
          poste: 'POSTE-02',
          zone: 'Médina',
          type: 'TRI',
          nature: 'BRANCHEMENT_POSE',
          cable: '4x16',
          ct70: true,
          pa: true,
          agent: 'Agent 2',
          date: '2026-04-02',
          status: 'VALIDE',
          prestataire: 'PROQUELEC',
        },
      ];

      setRecords(mockData);

      // Calculer les statistiques
      const newStats: MESStats = {
        total: mockData.length,
        poseMono: mockData.filter(r => r.type === 'MONO' && r.nature === 'POSE').length,
        poseTri: mockData.filter(r => r.type === 'TRI' && r.nature === 'POSE').length,
        branchementPoseMono: mockData.filter(r => r.type === 'MONO' && r.nature === 'BRANCHEMENT_POSE').length,
        branchementPoseTri: mockData.filter(r => r.type === 'TRI' && r.nature === 'BRANCHEMENT_POSE').length,
        enCours: mockData.filter(r => r.status === 'EN_COURS').length,
        realises: mockData.filter(r => r.status === 'REALISE').length,
        controles: mockData.filter(r => r.status === 'CONTROLE').length,
        valides: mockData.filter(r => r.status === 'VALIDE').length,
        tauxConformite: mockData.length > 0 ? (mockData.filter(r => r.status === 'VALIDE').length / mockData.length) * 100 : 0,
      };

      setStats(newStats);
    } catch (error) {
      toast.error('Erreur lors du chargement des données MES');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMESData();
  }, [loadMESData]);

  // Filtrer les enregistrements
  const filteredRecords = records.filter(record => {
    const matchPrestataire = selectedPrestataire === 'ALL' || record.prestataire === selectedPrestataire;
    const matchStatus = selectedStatus === 'ALL' || record.status === selectedStatus;
    const matchSearch = searchQuery === '' || 
      record.avisNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.meterNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.zone.toLowerCase().includes(searchQuery.toLowerCase());
    return matchPrestataire && matchStatus && matchSearch;
  });

  // Obtenir la couleur du statut
  const getStatusColor = (status: MESStatus) => {
    const colors: Record<MESStatus, string> = {
      RECU: 'bg-blue-500/10 border-blue-500/50 text-blue-400',
      PROGRAMME: 'bg-yellow-500/10 border-yellow-500/50 text-yellow-400',
      EN_COURS: 'bg-orange-500/10 border-orange-500/50 text-orange-400',
      REALISE: 'bg-purple-500/10 border-purple-500/50 text-purple-400',
      CONTROLE: 'bg-cyan-500/10 border-cyan-500/50 text-cyan-400',
      VALIDE: 'bg-green-500/10 border-green-500/50 text-green-400',
      FACTURE: 'bg-indigo-500/10 border-indigo-500/50 text-indigo-400',
      PAYE: 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400',
    };
    return colors[status];
  };

  // Obtenir le libellé du statut
  const getStatusLabel = (status: MESStatus) => {
    const labels: Record<MESStatus, string> = {
      RECU: 'Reçu',
      PROGRAMME: 'Programmé',
      EN_COURS: 'En cours',
      REALISE: 'Réalisé',
      CONTROLE: 'Contrôlé',
      VALIDE: 'Validé',
      FACTURE: 'Facturé',
      PAYE: 'Payé',
    };
    return labels[status];
  };

  return (
    <PageContainer className="min-h-screen bg-slate-950 py-8">
      <PageHeader
        backLink={{ to: '/admin/hub', label: 'Retour au Centre de Contrôle' }}
        title="GED OS MES"
        subtitle="Système de gestion des mises en service électriques"
        icon={<Zap size={24} />}
      />

      <ContentArea className="space-y-8 p-8 bg-slate-950 border-slate-800">
        <div className="max-w-7xl mx-auto space-y-8">

          {/* Statistiques globales */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-6 bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-500/20 rounded-2xl">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                  <ClipboardList className="text-blue-400" size={20} />
                </div>
                <span className="text-blue-400 text-sm font-medium">Total MES</span>
              </div>
              <p className="text-2xl font-black text-white">{stats.total}</p>
              <p className="text-xs text-blue-400">Interventions</p>
            </div>

            <div className="p-6 bg-gradient-to-br from-green-500/10 to-green-600/10 border border-green-500/20 rounded-2xl">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
                  <CheckCircle2 className="text-green-400" size={20} />
                </div>
                <span className="text-green-400 text-sm font-medium">Validées</span>
              </div>
              <p className="text-2xl font-black text-white">{stats.valides}</p>
              <p className="text-xs text-green-400">Conformité {stats.tauxConformite.toFixed(1)}%</p>
            </div>

            <div className="p-6 bg-gradient-to-br from-orange-500/10 to-orange-600/10 border border-orange-500/20 rounded-2xl">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center">
                  <Clock className="text-orange-400" size={20} />
                </div>
                <span className="text-orange-400 text-sm font-medium">En cours</span>
              </div>
              <p className="text-2xl font-black text-white">{stats.enCours}</p>
              <p className="text-xs text-orange-400">Interventions actives</p>
            </div>

            <div className="p-6 bg-gradient-to-br from-purple-500/10 to-purple-600/10 border border-purple-500/20 rounded-2xl">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
                  <TrendingUp className="text-purple-400" size={20} />
                </div>
                <span className="text-purple-400 text-sm font-medium">Pose Mono</span>
              </div>
              <p className="text-2xl font-black text-white">{stats.poseMono}</p>
              <p className="text-xs text-purple-400">Monophasé</p>
            </div>
          </div>

          {/* Détail par type */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-900/50 border border-slate-700/60 rounded-2xl">
              <p className="text-slate-400 text-xs font-medium mb-1">Pose Mono</p>
              <p className="text-xl font-black text-white">{stats.poseMono}</p>
            </div>
            <div className="p-4 bg-slate-900/50 border border-slate-700/60 rounded-2xl">
              <p className="text-slate-400 text-xs font-medium mb-1">Pose Tri</p>
              <p className="text-xl font-black text-white">{stats.poseTri}</p>
            </div>
            <div className="p-4 bg-slate-900/50 border border-slate-700/60 rounded-2xl">
              <p className="text-slate-400 text-xs font-medium mb-1">Branchement + Pose Mono</p>
              <p className="text-xl font-black text-white">{stats.branchementPoseMono}</p>
            </div>
            <div className="p-4 bg-slate-900/50 border border-slate-700/60 rounded-2xl">
              <p className="text-slate-400 text-xs font-medium mb-1">Branchement + Pose Tri</p>
              <p className="text-xl font-black text-white">{stats.branchementPoseTri}</p>
            </div>
          </div>

          {/* Filtres */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-slate-400" />
              <span className="text-slate-400 text-sm font-medium">Filtres:</span>
            </div>
            
            <select
              value={selectedPrestataire}
              onChange={(e) => setSelectedPrestataire(e.target.value as 'ALL' | 'PROQUELEC' | 'UMSAT')}
              className="px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-xl text-sm text-white"
            >
              <option value="ALL">Tous prestataires</option>
              <option value="PROQUELEC">PROQUELEC</option>
              <option value="UMSAT">UMSAT</option>
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as MESStatus | 'ALL')}
              className="px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-xl text-sm text-white"
            >
              <option value="ALL">Tous statuts</option>
              <option value="RECU">Reçu</option>
              <option value="PROGRAMME">Programmé</option>
              <option value="EN_COURS">En cours</option>
              <option value="REALISE">Réalisé</option>
              <option value="CONTROLE">Contrôlé</option>
              <option value="VALIDE">Validé</option>
              <option value="FACTURE">Facturé</option>
              <option value="PAYE">Payé</option>
            </select>

            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-xl text-sm text-white"
            />

            <div className="flex-1">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Rechercher (avis, compteur, zone...)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500"
                />
              </div>
            </div>

            <button
              onClick={loadMESData}
              className="px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-xl text-sm text-white hover:bg-slate-800 transition-all flex items-center gap-2"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Actualiser
            </button>

            <button className="px-4 py-2 bg-blue-600/20 border border-blue-500/30 rounded-xl text-sm text-blue-400 hover:bg-blue-600/30 transition-all flex items-center gap-2">
              <Upload size={16} />
              Importer Excel
            </button>

            <button className="px-4 py-2 bg-green-600/20 border border-green-500/30 rounded-xl text-sm text-green-400 hover:bg-green-600/30 transition-all flex items-center gap-2">
              <Download size={16} />
              Exporter
            </button>
          </div>

          {/* Tableau des enregistrements */}
          <div className="rounded-2xl border border-slate-700/60 bg-slate-900/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700/60">
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Avis</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Compteur</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Poste</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Zone</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Nature</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Agent</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Prestataire</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record) => (
                    <tr key={record.id} className="border-b border-slate-700/30 hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 text-sm text-white font-medium">{record.avisNumber}</td>
                      <td className="px-4 py-3 text-sm text-slate-300">{record.meterNumber}</td>
                      <td className="px-4 py-3 text-sm text-slate-300">{record.poste}</td>
                      <td className="px-4 py-3 text-sm text-slate-300">{record.zone}</td>
                      <td className="px-4 py-3 text-sm text-slate-300">{record.type}</td>
                      <td className="px-4 py-3 text-sm text-slate-300">{record.nature === 'POSE' ? 'Pose' : 'Branchement + Pose'}</td>
                      <td className="px-4 py-3 text-sm text-slate-300">{record.agent}</td>
                      <td className="px-4 py-3 text-sm text-slate-300">{record.date}</td>
                      <td className="px-4 py-3 text-sm text-slate-300">{record.prestataire}</td>
                      <td className="px-4 py-3">
                        <span className={`px-3 py-1 rounded-lg text-xs font-bold ${getStatusColor(record.status)}`}>
                          {getStatusLabel(record.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredRecords.length === 0 && (
              <div className="p-8 text-center">
                <ClipboardList size={48} className="text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 text-sm">Aucun enregistrement trouvé</p>
              </div>
            )}
          </div>

          {/* Actions rapides */}
          <div className="flex justify-center gap-4">
            <button className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-all flex items-center gap-2">
              <Plus size={16} />
              Nouvelle MES
            </button>
            <button className="px-6 py-3 bg-slate-800/50 text-slate-400 rounded-xl hover:text-white transition-all flex items-center gap-2">
              <MapPin size={16} />
              Cartographie
            </button>
            <button className="px-6 py-3 bg-slate-800/50 text-slate-400 rounded-xl hover:text-white transition-all flex items-center gap-2">
              <BarChart3 size={16} />
              Rapports
            </button>
            <button className="px-6 py-3 bg-slate-800/50 text-slate-400 rounded-xl hover:text-white transition-all flex items-center gap-2">
              <ShieldCheck size={16} />
              Contrôle Qualité
            </button>
          </div>

        </div>
      </ContentArea>
    </PageContainer>
  );
};

export default MESDashboard;
