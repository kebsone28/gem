/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  TrendingUp,
  Settings,
  Bell,
  CheckCircle,
  Clock,
  Zap,
} from 'lucide-react';
import { PageContainer, PageHeader, ContentArea } from '@components';
import AlertDashboard from '../components/alerts/AlertDashboard';
import { useProject } from '../contexts/ProjectContext';
import alertsAPI from '../services/alertsAPI';
import toast from 'react-hot-toast';

interface AlertConfig {
  stockCritical: number;
  budgetThreshold: number;
  teamCapacity: number;
  electricityMin: number;
  delayThreshold: number;
  escalationDelay: number;
  enableSMS: boolean;
  enableEmail: boolean;
  enablePush: boolean;
  enableWhatsApp: boolean;
}

export default function AlertsPage() {
  const { project } = useProject();
  const [showConfig, setShowConfig] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<AlertConfig>({
    stockCritical: 5,
    budgetThreshold: 90,
    teamCapacity: 85,
    electricityMin: 50,
    delayThreshold: 5,
    escalationDelay: 3600,
    enableSMS: true,
    enableEmail: true,
    enablePush: false,
    enableWhatsApp: false,
  });

  // Charger la configuration existante
  useEffect(() => {
    if (showConfig) {
      fetchConfig();
    }
  }, [showConfig]);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const data = await alertsAPI.getAlertConfig();
      if (data) {
        setConfig({
          stockCritical: data.stockCritical ?? 5,
          budgetThreshold: data.budgetThreshold ?? 90,
          teamCapacity: data.teamCapacity ?? 85,
          electricityMin: data.electricityMin ?? 50,
          delayThreshold: data.delayThreshold ?? 5,
          escalationDelay: data.escalationDelay ?? 3600,
          enableSMS: data.enableSMS ?? true,
          enableEmail: data.enableEmail ?? true,
          enablePush: data.enablePush ?? false,
          enableWhatsApp: data.enableWhatsApp ?? false,
        });
      }
    } catch (err) {
      console.error('Error fetching alert config:', err);
      toast.error('Erreur lors du chargement de la configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    try {
      setSaving(true);
      await alertsAPI.updateAlertConfig(config as any);
      toast.success('Configuration mise à jour avec succès');
      // On garde le panneau ouvert ou on le ferme selon préférence, ici on le laisse
    } catch (err) {
      console.error('Error saving alert config:', err);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof AlertConfig, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  return (
    <PageContainer>
      <PageHeader
        title="Centre des Alertes"
        subtitle="Gestion centralisée des alertes en temps réel"
        icon={Bell}
        actions={
          <button
            onClick={() => setShowConfig(!showConfig)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              showConfig ? 'bg-blue-600' : 'bg-slate-800 hover:bg-slate-700'
            }`}
          >
            <Settings size={18} />
            <span className="text-sm font-black uppercase">Configuration</span>
          </button>
        }
      />

      <ContentArea className="space-y-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-red-500/10 to-transparent border border-red-500/20 rounded-2xl p-6 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-red-500/20">
              <AlertTriangle className="text-red-400" size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Alertes Critiques</p>
              <p className="text-2xl font-black text-white">0</p>
              <p className="text-[9px] text-slate-500 mt-1">Requièrent une action immédiate</p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-500/10 to-transparent border border-orange-500/20 rounded-2xl p-6 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-orange-500/20">
              <AlertCircle className="text-orange-400" size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Élevées</p>
              <p className="text-2xl font-black text-white">0</p>
              <p className="text-[9px] text-slate-500 mt-1">À traiter rapidement</p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-500/10 to-transparent border border-green-500/20 rounded-2xl p-6 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-green-500/20">
              <CheckCircle className="text-green-400" size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Résolues</p>
              <p className="text-2xl font-black text-white">0</p>
              <p className="text-[9px] text-slate-500 mt-1">Cette semaine</p>
            </div>
          </div>
        </div>

        {/* Main Alert Dashboard */}
        {!showConfig && (
          <div>
            <h2 className="text-lg font-black text-white mb-4 flex items-center gap-2">
              <Bell size={20} />
              Alertes du Projet
            </h2>
            {project?.id && <AlertDashboard />}
          </div>
        )}

        {/* Alert Configuration Section */}
        {showConfig && (
          <div className={`bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-2xl p-8 space-y-8 transition-all ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
            <div>
              <h3 className="text-base font-black text-white mb-6 flex items-center gap-2">
                <Settings size={20} />
                Configuration des Seuils d'Alertes
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Stock Critical */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Seuil de Stock Critique
                  </label>
                  <input
                    type="number"
                    value={config.stockCritical}
                    onChange={(e) => handleChange('stockCritical', parseInt(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-blue-500 outline-none"
                    placeholder="Nombre d'alertes"
                  />
                  <p className="text-[9px] text-slate-500 mt-2">Seuil de vigilance stock. Une valeur trop basse prévient une rupture de matériel qui bloquerait les équipes.</p>
                </div>

                {/* Budget Threshold */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Seuil Budget Épuisé
                  </label>
                  <input
                    type="number"
                    value={config.budgetThreshold}
                    onChange={(e) => handleChange('budgetThreshold', parseInt(e.target.value))}
                    min={0}
                    max={100}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-blue-500 outline-none"
                    placeholder="Pourcentage"
                  />
                  <p className="text-[9px] text-slate-500 mt-2">Alerte de consommation budgétaire. Permet d'anticiper les demandes de rallonges auprès des partenaires.</p>
                </div>

                {/* Team Capacity */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Capacité Équipes
                  </label>
                  <input
                    type="number"
                    value={config.teamCapacity}
                    onChange={(e) => handleChange('teamCapacity', parseInt(e.target.value))}
                    min={0}
                    max={100}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-blue-500 outline-none"
                    placeholder="Pourcentage"
                  />
                  <p className="text-[9px] text-slate-500 mt-2">Indice de saturation. Prévient les risques de retard ou d'épuisement des équipes par surcharge de travail.</p>
                </div>

                {/* Electricity Min */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Électricité Minimum
                  </label>
                  <input
                    type="number"
                    value={config.electricityMin}
                    onChange={(e) => handleChange('electricityMin', parseInt(e.target.value))}
                    min={0}
                    max={100}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-blue-500 outline-none"
                    placeholder="Pourcentage"
                  />
                  <p className="text-[9px] text-slate-500 mt-2">Objectif de succès. Une valeur inférieure génère une alerte de "Performance Faible" pour la zone concernée.</p>
                </div>

                {/* Delay Threshold */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Seuil Retard
                  </label>
                  <input
                    type="number"
                    value={config.delayThreshold}
                    onChange={(e) => handleChange('delayThreshold', parseInt(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-blue-500 outline-none"
                    placeholder="Jours"
                  />
                  <p className="text-[9px] text-slate-500 mt-2">Délai avant marquage "En Souffrance". Identifie les missions bloquées nécessitant un arbitrage rapide.</p>
                </div>

                {/* Escalation Delay */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Délai d'Escalade
                  </label>
                  <input
                    type="number"
                    value={config.escalationDelay}
                    onChange={(e) => handleChange('escalationDelay', parseInt(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-blue-500 outline-none"
                    placeholder="Secondes"
                  />
                  <p className="text-[9px] text-slate-500 mt-2">Temps sans traitement avant que l'alerte n'escalade automatiquement vers la Direction Générale.</p>
                </div>
              </div>
            </div>

            {/* Notification Channels */}
            <div>
              <h4 className="text-sm font-black text-white mb-4">Canaux de Notification</h4>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={config.enableSMS}
                    onChange={(e) => handleChange('enableSMS', e.target.checked)}
                    className="w-4 h-4 rounded accent-blue-600"
                  />
                  <span className="text-sm text-slate-300 group-hover:text-white transition-colors">Activer SMS</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={config.enableEmail}
                    onChange={(e) => handleChange('enableEmail', e.target.checked)}
                    className="w-4 h-4 rounded accent-blue-600"
                  />
                  <span className="text-sm text-slate-300 group-hover:text-white transition-colors">Activer Email</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={config.enablePush}
                    onChange={(e) => handleChange('enablePush', e.target.checked)}
                    className="w-4 h-4 rounded accent-blue-600"
                  />
                  <span className="text-sm text-slate-300 group-hover:text-white transition-colors">Activer Push Notifications</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={config.enableWhatsApp}
                    onChange={(e) => handleChange('enableWhatsApp', e.target.checked)}
                    className="w-4 h-4 rounded accent-blue-600"
                  />
                  <span className="text-sm text-slate-300 group-hover:text-white transition-colors">Activer WhatsApp</span>
                </label>
              </div>
            </div>

            <button
              onClick={handleSaveConfig}
              disabled={saving}
              className={`w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl font-black uppercase text-sm transition-all flex items-center justify-center gap-2 ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Sauvegarde...
                </>
              ) : (
                'Enregistrer la Configuration'
              )}
            </button>
          </div>
        )}
      </ContentArea>
    </PageContainer>
  );
}
