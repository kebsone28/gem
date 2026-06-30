import React, { useState, useEffect, useCallback } from 'react';
import logger from '@services/logger';
import mesAPI, { type MESRecord, type MESStats } from '@services/mesAPI';
import MESForm from '../components/MESForm';
import MESControlModal from '../components/MESControlModal';
import MESValidationModal from '../components/MESValidationModal';
import MESDetailsModal from '../components/MESDetailsModal';
import MESMap from '../components/MESMap';
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
  Edit,
  Trash2,
  Eye,
  X,
} from 'lucide-react';
import { PageContainer, PageHeader, ContentArea } from '@components/layout';
import { ModuleStatePanel } from '@components/common/ModuleStatePanel';
import { useProject } from '@contexts/ProjectContext';
import { useAuth } from '@contexts/AuthContext';
import toast from 'react-hot-toast';

type MESStatus = 'RECU' | 'PROGRAMME' | 'EN_COURS' | 'REALISE' | 'CONTROLE' | 'VALIDE' | 'FACTURE' | 'PAYE';

const MESDashboard: React.FC = () => {
  const { activeProjectId, isLoading: isProjectLoading } = useProject();
  const { user } = useAuth();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isControlModalOpen, setIsControlModalOpen] = useState(false);
  const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<MESRecord | null>(null);
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
      const filters = {
        prestataire: selectedPrestataire === 'ALL' ? undefined : selectedPrestataire,
        status: selectedStatus === 'ALL' ? undefined : selectedStatus,
        month: selectedMonth,
        search: searchQuery || undefined,
      };

      const { records: recordsData } = await mesAPI.getRecords(filters);
      setRecords(recordsData);

      const statsData = await mesAPI.getStats(filters);
      setStats(statsData);
    } catch (error) {
      toast.error('Erreur lors du chargement des données MES');
      logger.error(error);
    } finally {
      setLoading(false);
    }
  }, [selectedPrestataire, selectedStatus, selectedMonth, searchQuery]);

  useEffect(() => {
    loadMESData();
  }, [loadMESData]);

  // Handlers pour les modals
  const handleOpenForm = (record?: MESRecord) => {
    setSelectedRecord(record || null);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setSelectedRecord(null);
  };

  const handleOpenControl = (record: MESRecord) => {
    setSelectedRecord(record);
    setIsControlModalOpen(true);
  };

  const handleCloseControl = () => {
    setIsControlModalOpen(false);
    setSelectedRecord(null);
  };

  const handleOpenValidation = (record: MESRecord) => {
    setSelectedRecord(record);
    setIsValidationModalOpen(true);
  };

  const handleCloseValidation = () => {
    setIsValidationModalOpen(false);
    setSelectedRecord(null);
  };

  const handleOpenDetails = (record: MESRecord) => {
    setSelectedRecord(record);
    setIsDetailsModalOpen(true);
  };

  const handleCloseDetails = () => {
    setIsDetailsModalOpen(false);
    setSelectedRecord(null);
  };

  const handleDelete = async (record: MESRecord) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer l'enregistrement ${record.avisNumber} ?`)) {
      return;
    }

    try {
      await mesAPI.deleteRecord(record.id);
      toast.success('Enregistrement MES supprimé avec succès');
      loadMESData();
    } catch (error) {
      toast.error('Erreur lors de la suppression de l\'enregistrement MES');
      console.error(error);
    }
  };

  const handleImport = async () => {
    if (!importFile) {
      toast.error('Veuillez sélectionner un fichier Excel');
      return;
    }

    setImporting(true);
    try {
      const result = await mesAPI.importFromExcel(importFile);
      toast.success(`Import réussi: ${result.imported} enregistrements importés, ${result.errors} erreurs`);
      if (result.errors > 0 && result.details.length > 0) {
        console.log('Import details:', result.details);
      }
      loadMESData();
      setIsImportModalOpen(false);
      setImportFile(null);
    } catch (error) {
      toast.error('Erreur lors de l\'import Excel');
      console.error(error);
    } finally {
      setImporting(false);
    }
  };

  const handleExport = async () => {
    try {
      const filters = {
        prestataire: selectedPrestataire === 'ALL' ? undefined : selectedPrestataire,
        status: selectedStatus === 'ALL' ? undefined : selectedStatus,
        month: selectedMonth,
      };

      const blob = await mesAPI.exportToExcel(filters);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mes_export_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Export Excel réussi');
    } catch (error) {
      toast.error('Erreur lors de l\'export Excel');
      console.error(error);
    }
  };

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

  if (isProjectLoading) {
    return (
      <PageContainer>
        <ModuleStatePanel
          tone="loading"
          title="Chargement du projet"
          description="Le contexte projet est en cours d'initialisation pour le système MES."
        />
      </PageContainer>
    );
  }

  if (!activeProjectId) {
    return (
      <PageContainer>
        <ModuleStatePanel
          title="Aucun projet actif"
          description="Le système MES est rattaché à un projet. Sélectionnez un projet pour gérer les mises en service électriques."
          actionLabel="Choisir un projet"
          actionTo="/projects"
        />
      </PageContainer>
    );
  }

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

            <button
              onClick={() => setIsImportModalOpen(true)}
              className="px-4 py-2 bg-blue-600/20 border border-blue-500/30 rounded-xl text-sm text-blue-400 hover:bg-blue-600/30 transition-all flex items-center gap-2"
            >
              <Upload size={16} />
              Importer Excel
            </button>

            <button
              onClick={handleExport}
              className="px-4 py-2 bg-green-600/20 border border-green-500/30 rounded-xl text-sm text-green-400 hover:bg-green-600/30 transition-all flex items-center gap-2"
            >
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
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
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
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleOpenDetails(record)}
                            className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
                            title="Voir détails"
                          >
                            <Eye size={16} className="text-slate-400" />
                          </button>
                          <button
                            onClick={() => handleOpenForm(record)}
                            className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
                            title="Modifier"
                          >
                            <Edit size={16} className="text-slate-400" />
                          </button>
                          {record.status === 'REALISE' && (
                            <button
                              onClick={() => handleOpenControl(record)}
                              className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
                              title="Contrôle qualité"
                            >
                              <ShieldCheck size={16} className="text-cyan-400" />
                            </button>
                          )}
                          {(record.status === 'CONTROLE' || record.status === 'REALISE') && (
                            <button
                              onClick={() => handleOpenValidation(record)}
                              className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
                              title="Valider"
                            >
                              <CheckCircle2 size={16} className="text-green-400" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(record)}
                            className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 size={16} className="text-red-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {records.length === 0 && (
              <div className="p-8 text-center">
                <ClipboardList size={48} className="text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 text-sm">Aucun enregistrement trouvé</p>
              </div>
            )}
          </div>

          {/* Actions rapides */}
          <div className="flex justify-center gap-4">
            <button
              onClick={() => handleOpenForm()}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-all flex items-center gap-2"
            >
              <Plus size={16} />
              Nouvelle MES
            </button>
            <button
              onClick={() => setIsMapOpen(true)}
              className="px-6 py-3 bg-slate-800/50 text-slate-400 rounded-xl hover:text-white transition-all flex items-center gap-2"
            >
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

      {/* Modals */}
      <MESForm
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        record={selectedRecord}
        onSuccess={loadMESData}
      />
      <MESControlModal
        isOpen={isControlModalOpen}
        onClose={handleCloseControl}
        record={selectedRecord}
        onSuccess={loadMESData}
      />
      <MESValidationModal
        isOpen={isValidationModalOpen}
        onClose={handleCloseValidation}
        record={selectedRecord}
        onSuccess={loadMESData}
      />
      <MESDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={handleCloseDetails}
        record={selectedRecord}
      />

      {/* Map Modal */}
      <MESMap
        isOpen={isMapOpen}
        onClose={() => setIsMapOpen(false)}
      />

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Importer Excel</h2>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="text-slate-400" size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center">
                <Upload className="text-slate-400 mx-auto mb-4" size={32} />
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={e => setImportFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer text-sm text-slate-300 hover:text-white"
                >
                  {importFile ? importFile.name : 'Cliquez pour sélectionner un fichier Excel'}
                </label>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setImportFile(null);
                  }}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleImport}
                  disabled={!importFile || importing}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {importing ? 'Importation...' : 'Importer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
};

export default MESDashboard;
