/**
 * 🤖 AutoTrainingPanel - Interface de gestion de l'auto-entraînement IA
 * Affiche les suggestions d'entraînement et les métriques d'apprentissage
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Brain,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  BookOpen,
  Lightbulb,
  BarChart3,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import {
  autoTrainingSystem,
  userFeedbackService,
  learningMetricsService,
  type TrainingSuggestion,
  type LearningMetric,
} from '../../../services/ai/autoTrainingSystem';
import type { AIResponse } from '../../../services/ai/MissionSageService';

interface AutoTrainingPanelProps {
  canManageAI?: boolean;
}

export default function AutoTrainingPanel({ canManageAI = false }: AutoTrainingPanelProps) {
  const [suggestions, setSuggestions] = useState<TrainingSuggestion[]>([]);
  const [metrics, setMetrics] = useState<LearningMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'suggestions' | 'metrics' | 'feedback'>('suggestions');
  const [learningStatus, setLearningStatus] = useState({
    totalFeedbacks: 0,
    negativeFeedbacks: 0,
    satisfactionRate: 0,
    patternsDetected: 0,
    pendingSuggestions: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allSuggestions, weeklyMetrics, status] = await Promise.all([
        autoTrainingSystem.generateAllSuggestions(),
        learningMetricsService.getWeeklyTrends(),
        autoTrainingSystem.getLearningStatus(),
      ]);
      setSuggestions(allSuggestions);
      setMetrics(weeklyMetrics);
      setLearningStatus(status);
    } catch (err) {
      console.error('[AutoTrainingPanel] Failed to load data', err);
    } finally {
      setLoading(false);
    }
  };

  const getSourceIcon = (source: TrainingSuggestion['source']) => {
    switch (source) {
      case 'user_feedback':
        return ThumbsDown;
      case 'pattern_detection':
        return Lightbulb;
      case 'cross_validation':
        return RefreshCw;
      case 'referential_mining':
        return BookOpen;
      default:
        return Brain;
    }
  };

  const getSourceColor = (source: TrainingSuggestion['source']) => {
    switch (source) {
      case 'user_feedback':
        return 'rose';
      case 'pattern_detection':
        return 'amber';
      case 'cross_validation':
        return 'blue';
      case 'referential_mining':
        return 'emerald';
      default:
        return 'slate';
    }
  };

  const getPriorityColor = (priority: TrainingSuggestion['priority']) => {
    switch (priority) {
      case 'high':
        return 'rose';
      case 'medium':
        return 'amber';
      case 'low':
        return 'sky';
      default:
        return 'slate';
    }
  };

  const handleAcceptSuggestion = async (suggestion: TrainingSuggestion) => {
    if (!canManageAI) return;
    // TODO: Implémenter l'acceptation de la suggestion
    console.log('Accept suggestion:', suggestion);
  };

  const handleRejectSuggestion = async (suggestionId: string) => {
    if (!canManageAI) return;
    setSuggestions(suggestions.filter((s) => s.id !== suggestionId));
  };

  const SatisfactionBadge = ({ rate }: { rate: number }) => {
    const percentage = Math.round(rate * 100);
    const color = percentage >= 70 ? 'emerald' : percentage >= 50 ? 'amber' : 'rose';
    
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-${color}-500/10 border border-${color}-500/20`}>
        <ThumbsUp size={14} className={`text-${color}-400`} />
        <span className={`text-xs font-bold text-${color}-300`}>{percentage}%</span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-blue-400" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête avec métriques globales */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            Feedbacks
          </p>
          <p className="text-xl font-bold text-white mt-1">{learningStatus.totalFeedbacks}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            Négatifs
          </p>
          <p className="text-xl font-bold text-rose-400 mt-1">{learningStatus.negativeFeedbacks}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            Satisfaction
          </p>
          <SatisfactionBadge rate={learningStatus.satisfactionRate} />
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            Patterns
          </p>
          <p className="text-xl font-bold text-amber-400 mt-1">{learningStatus.patternsDetected}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            Suggestions
          </p>
          <p className="text-xl font-bold text-emerald-400 mt-1">{learningStatus.pendingSuggestions}</p>
        </div>
      </div>

      {/* Onglets de navigation */}
      <div className="flex gap-2 border-b border-white/10">
        <button
          onClick={() => setSelectedTab('suggestions')}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
            selectedTab === 'suggestions'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          Suggestions ({suggestions.length})
        </button>
        <button
          onClick={() => setSelectedTab('metrics')}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
            selectedTab === 'metrics'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          Métriques
        </button>
        <button
          onClick={() => setSelectedTab('feedback')}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
            selectedTab === 'feedback'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          Feedbacks
        </button>
      </div>

      {/* Contenu des onglets */}
      {selectedTab === 'suggestions' && (
        <div className="space-y-3">
          {suggestions.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Brain size={48} className="mx-auto mb-4 opacity-30" />
              <p className="text-sm font-medium">Aucune suggestion d'entraînement</p>
              <p className="text-xs mt-2">L'IA générera automatiquement des suggestions basées sur les interactions utilisateur</p>
            </div>
          ) : (
            suggestions.map((suggestion, idx) => {
              const SourceIcon = getSourceIcon(suggestion.source);
              const sourceColor = getSourceColor(suggestion.source);
              const priorityColor = getPriorityColor(suggestion.priority);
              
              return (
                <motion.div
                  key={suggestion.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="rounded-xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg bg-${sourceColor}-500/10 border border-${sourceColor}-500/20`}>
                        <SourceIcon size={16} className={`text-${sourceColor}-400`} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          {suggestion.source.replace('_', ' ')}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-${priorityColor}-500/10 border border-${priorityColor}-500/20 text-${priorityColor}-300`}>
                            {suggestion.priority}
                          </span>
                          <span className="text-[9px] text-slate-500">
                            Confiance: {Math.round(suggestion.confidence * 100)}%
                          </span>
                        </div>
                      </div>
                    </div>
                    {canManageAI && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRejectSuggestion(suggestion.id)}
                          className="p-1.5 rounded-lg hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 transition-colors"
                          title="Rejeter"
                        >
                          <XCircle size={14} />
                        </button>
                        <button
                          onClick={() => handleAcceptSuggestion(suggestion)}
                          className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-400 transition-colors"
                          title="Accepter"
                        >
                          <CheckCircle size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <div className="rounded-lg bg-slate-950/50 p-3">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                        Question
                      </p>
                      <p className="text-sm font-semibold text-slate-100">{suggestion.question}</p>
                    </div>
                    
                    {suggestion.suggestedAnswer && (
                      <div className="rounded-lg bg-slate-950/50 p-3">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                          Réponse suggérée
                        </p>
                        <p className="text-sm text-slate-300">{suggestion.suggestedAnswer}</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      )}

      {selectedTab === 'metrics' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <BarChart3 size={16} className="text-blue-400" />
                  Tendance hebdomadaire
                </h3>
                <div className="space-y-3">
                  {metrics.map((metric, idx) => (
                    <div key={idx} className="grid grid-cols-4 gap-3 text-xs border-b border-white/5 pb-3 last:border-0 last:pb-0">
                      <div className="text-slate-400">{metric.date}</div>
                      <div className="text-emerald-400 font-semibold">{metric.totalQueries} requêtes</div>
                      <div className="text-amber-400 font-semibold">{metric.fallbackCount} fallbacks</div>
                      <div className="text-blue-400 font-semibold">{Math.round(metric.userSatisfaction * 100)}% satisfaction</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Graphique de satisfaction */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <TrendingUp size={16} className="text-emerald-400" />
                  Taux de satisfaction
                </h3>
                <div className="flex items-end gap-2 h-32">
                  {metrics.map((metric, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                      <div
                        className="w-full bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-sm transition-all hover:from-emerald-500 hover:to-emerald-300"
                        style={{ height: `${metric.userSatisfaction * 100}%` }}
                        title={`${Math.round(metric.userSatisfaction * 100)}%`}
                      />
                      <span className="text-[9px] text-slate-500 rotate-[-45deg] origin-left">
                        {metric.date.split('-').slice(1).join('/')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Statistiques globales */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Total requêtes
                  </p>
                  <p className="text-xl font-bold text-white mt-1">
                    {metrics.reduce((sum, m) => sum + m.totalQueries, 0)}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Moyenne satisfaction
                  </p>
                  <p className="text-xl font-bold text-emerald-400 mt-1">
                    {Math.round(
                      (metrics.reduce((sum, m) => sum + m.userSatisfaction, 0) / metrics.length) * 100
                    )}
                    %
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Total fallbacks
                  </p>
                  <p className="text-xl font-bold text-amber-400 mt-1">
                    {metrics.reduce((sum, m) => sum + m.fallbackCount, 0)}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Taux de succès
                  </p>
                  <p className="text-xl font-bold text-blue-400 mt-1">
                    {Math.round(
                      ((metrics.reduce((sum, m) => sum + m.totalQueries, 0) -
                        metrics.reduce((sum, m) => sum + m.fallbackCount, 0)) /
                        metrics.reduce((sum, m) => sum + m.totalQueries, 0)) * 100
                    )}
                    %
                  </p>
                </div>
              </div>
            </div>
          )}

      {selectedTab === 'feedback' && (
        <div className="space-y-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
              <AlertTriangle size={16} className="text-rose-400" />
              Feedbacks négatifs récents
            </h3>
            <p className="text-xs text-slate-400">
              Les feedbacks négatifs sont analysés pour générer automatiquement des suggestions d'amélioration
            </p>
          </div>
          
          {/* Liste des feedbacks négatifs */}
          <div className="space-y-3">
            {learningStatus.negativeFeedbacks > 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {learningStatus.negativeFeedbacks} feedbacks négatifs
                  </p>
                  <span className="text-[9px] text-rose-400 font-semibold">
                    À analyser
                  </span>
                </div>
                <div className="text-center py-4 text-slate-500">
                  <ThumbsDown size={24} className="mx-auto mb-2 opacity-30" />
                  <p className="text-xs">
                    Les feedbacks détaillés seront affichés ici après synchronisation avec la base de données
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle size={20} className="text-emerald-400" />
                  <div>
                    <p className="text-sm font-bold text-emerald-300">
                      Aucun feedback négatif
                    </p>
                    <p className="text-xs text-emerald-200/70 mt-1">
                      Le système fonctionne bien, continuez comme ça !
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Statistiques de feedback */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
              <ThumbsUp size={16} className="mx-auto text-emerald-400 mb-1" />
              <p className="text-lg font-bold text-emerald-400">
                {Math.round(learningStatus.satisfactionRate * 100)}%
              </p>
              <p className="text-[9px] text-slate-500 uppercase tracking-wider">
                Satisfaction
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
              <ThumbsDown size={16} className="mx-auto text-rose-400 mb-1" />
              <p className="text-lg font-bold text-rose-400">
                {learningStatus.negativeFeedbacks}
              </p>
              <p className="text-[9px] text-slate-500 uppercase tracking-wider">
                Négatifs
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
              <Brain size={16} className="mx-auto text-blue-400 mb-1" />
              <p className="text-lg font-bold text-blue-400">
                {learningStatus.totalFeedbacks}
              </p>
              <p className="text-[9px] text-slate-500 uppercase tracking-wider">
                Total
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Bouton de rafraîchissement */}
      <div className="flex justify-center pt-4">
        <button
          onClick={loadData}
          className="px-4 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-wider hover:bg-blue-500/20 transition-colors flex items-center gap-2"
        >
          <RefreshCw size={14} />
          Rafraîchir
        </button>
      </div>
    </div>
  );
}
