/**
 * Page Alertes - Centre de Gestion des Alertes en Temps Réel
 * Affichage, gestion et escalade des alertes du projet
 */

import React, { useState } from 'react';
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

interface AlertConfig {
  stockCritical: number;
  budgetThreshold: number;
  teamCapacity: number;
  electricityMin: number;
  delayThreshold: number;
  escalationDelay: number;
  enableSMS: boolean;
  enableEmail: boolean;
}

export default function AlertsPage() {
  const { project } = useProject();
  const [showConfig, setShowConfig] = useState(false);

  return (
    <PageContainer>
      <PageHeader
        title="Centre des Alertes"
        subtitle="Gestion centralisée des alertes en temps réel"
        icon={Bell}
        actions={
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-all"
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
        <div>
          <h2 className="text-lg font-black text-white mb-4 flex items-center gap-2">
            <Bell size={20} />
            Alertes du Projet
          </h2>
          {project?.id && <AlertDashboard />}
        </div>

        {/* Alert Configuration Section */}
        {showConfig && (
          <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-2xl p-8 space-y-8">
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
                    defaultValue={5}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-blue-500 outline-none"
                    placeholder="Nombre d'alertes"
                  />
                  <p className="text-[9px] text-slate-500 mt-2">Nombre d'alertes stock avant déclenchement</p>
                </div>

                {/* Budget Threshold */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Seuil Budget Épuisé
                  </label>
                  <input
                    type="number"
                    defaultValue={90}
                    min={0}
                    max={100}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-blue-500 outline-none"
                    placeholder="Pourcentage"
                  />
                  <p className="text-[9px] text-slate-500 mt-2">Pourcentage d'utilisation du budget</p>
                </div>

                {/* Team Capacity */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Capacité Équipes
                  </label>
                  <input
                    type="number"
                    defaultValue={85}
                    min={0}
                    max={100}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-blue-500 outline-none"
                    placeholder="Pourcentage"
                  />
                  <p className="text-[9px] text-slate-500 mt-2">Pourcentage de saturation des équipes</p>
                </div>

                {/* Electricity Min */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Électricité Minimum
                  </label>
                  <input
                    type="number"
                    defaultValue={50}
                    min={0}
                    max={100}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-blue-500 outline-none"
                    placeholder="Pourcentage"
                  />
                  <p className="text-[9px] text-slate-500 mt-2">Pourcentage minimum d'accès électricité</p>
                </div>

                {/* Delay Threshold */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Seuil Retard
                  </label>
                  <input
                    type="number"
                    defaultValue={5}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-blue-500 outline-none"
                    placeholder="Jours"
                  />
                  <p className="text-[9px] text-slate-500 mt-2">Nombre de jours avant alerte retard</p>
                </div>

                {/* Escalation Delay */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Délai d'Escalade
                  </label>
                  <input
                    type="number"
                    defaultValue={3600}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-blue-500 outline-none"
                    placeholder="Secondes"
                  />
                  <p className="text-[9px] text-slate-500 mt-2">Temps avant escalade automatique (en secondes)</p>
                </div>
              </div>
            </div>

            {/* Notification Channels */}
            <div>
              <h4 className="text-sm font-black text-white mb-4">Canaux de Notification</h4>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
                  <span className="text-sm text-slate-300">Activer SMS</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
                  <span className="text-sm text-slate-300">Activer Email</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded" />
                  <span className="text-sm text-slate-300">Activer Push Notifications</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded" />
                  <span className="text-sm text-slate-300">Activer WhatsApp</span>
                </label>
              </div>
            </div>

            <button className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl font-black uppercase text-sm transition-all">
              Enregistrer la Configuration
            </button>
          </div>
        )}
      </ContentArea>
    </PageContainer>
  );
}
