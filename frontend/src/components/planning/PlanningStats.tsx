import React, { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  Home,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
} from 'lucide-react';

interface PlanningStatsProps {
  totalTasks: number;
  completedTasks: number;
  delayedTasks: number;
  activeTeams: number;
  workingDays: number;
  efficiency?: number;
  isLoading?: boolean;
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  isLoading?: boolean;
}

// Optimisation : Composant de carte de statistique mémoïsé
const StatCard = memo(({ title, value, icon, color, trend, isLoading }: StatCardProps) => {
  const displayValue = useMemo(() => {
    if (isLoading) return '...';
    return typeof value === 'number' ? value.toLocaleString('fr-FR') : value;
  }, [value, isLoading]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      className={`${color} rounded-xl p-6 text-white relative overflow-hidden`}
    >
      {/* Arrière-plan animé */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="p-2 bg-white/20 rounded-lg">
            {icon}
          </div>
          {trend && (
            <div className={`flex items-center gap-1 text-sm ${
              trend.isPositive ? 'text-green-200' : 'text-red-200'
            }`}>
              <TrendingUp className={`w-4 h-4 ${!trend.isPositive ? 'rotate-180' : ''}`} />
              {Math.abs(trend.value)}%
            </div>
          )}
        </div>
        
        <div className="space-y-1">
          <div className="text-2xl font-bold">
            {displayValue}
          </div>
          <div className="text-sm opacity-80">
            {title}
          </div>
        </div>
      </div>
    </motion.div>
  );
});

StatCard.displayName = 'StatCard';

// Optimisation : Calcul des pourcentages et tendances
const useStatsCalculations = (
  totalTasks: number,
  completedTasks: number,
  delayedTasks: number,
  activeTeams: number,
  workingDays: number
) => {
  return useMemo(() => {
    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    const delayRate = totalTasks > 0 ? (delayedTasks / totalTasks) * 100 : 0;
    const efficiency = activeTeams > 0 ? (completionRate / activeTeams) * 100 : 0;
    const productivity = workingDays > 0 ? (completedTasks / workingDays) : 0;

    return {
      completionRate: Math.round(completionRate),
      delayRate: Math.round(delayRate),
      efficiency: Math.round(efficiency),
      productivity: Math.round(productivity * 10) / 10,
    };
  }, [totalTasks, completedTasks, delayedTasks, activeTeams, workingDays]);
};

export const PlanningStats = memo(({
  totalTasks,
  completedTasks,
  delayedTasks,
  activeTeams,
  workingDays,
  efficiency,
  isLoading = false,
}: PlanningStatsProps) => {
  const calculations = useStatsCalculations(
    totalTasks,
    completedTasks,
    delayedTasks,
    activeTeams,
    workingDays
  );

  // Optimisation : Configuration des cartes avec animations différées
  const statsConfig = useMemo(() => [
    {
      title: 'Tâches totales',
      value: totalTasks,
      icon: <Home className="w-6 h-6" />,
      color: 'bg-gradient-to-br from-blue-500 to-blue-600',
      trend: {
        value: 5,
        isPositive: true,
      },
    },
    {
      title: 'Tâches complétées',
      value: completedTasks,
      icon: <CheckCircle2 className="w-6 h-6" />,
      color: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
      trend: {
        value: calculations.completionRate,
        isPositive: calculations.completionRate > 50,
      },
    },
    {
      title: 'Tâches en retard',
      value: delayedTasks,
      icon: <AlertTriangle className="w-6 h-6" />,
      color: 'bg-gradient-to-br from-amber-500 to-amber-600',
      trend: {
        value: calculations.delayRate,
        isPositive: calculations.delayRate < 20,
      },
    },
    {
      title: 'Équipes actives',
      value: activeTeams,
      icon: <Users className="w-6 h-6" />,
      color: 'bg-gradient-to-br from-purple-500 to-purple-600',
    },
    {
      title: 'Jours travaillés',
      value: workingDays,
      icon: <Clock className="w-6 h-6" />,
      color: 'bg-gradient-to-br from-cyan-500 to-cyan-600',
    },
    {
      title: 'Efficacité',
      value: `${efficiency || calculations.efficiency}%`,
      icon: <TrendingUp className="w-6 h-6" />,
      color: 'bg-gradient-to-br from-indigo-500 to-indigo-600',
      trend: {
        value: 8,
        isPositive: (efficiency || calculations.efficiency) > 70,
      },
    },
  ], [
    totalTasks,
    completedTasks,
    delayedTasks,
    activeTeams,
    workingDays,
    efficiency,
    calculations,
  ]);

  return (
    <div className="space-y-6">
      {/* Titre avec indicateur de chargement */}
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold text-white">Statistiques du planning</h2>
        {isLoading && (
          <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {/* Grille de statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statsConfig.map((config, index) => (
          <motion.div
            key={config.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <StatCard
              {...config}
              isLoading={isLoading}
            />
          </motion.div>
        ))}
      </div>

      {/* Barre de progression globale */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.6 }}
        className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Progression globale</h3>
            <span className="text-2xl font-bold text-white">
              {calculations.completionRate}%
            </span>
          </div>
          
          <div className="relative h-4 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${calculations.completionRate}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full"
            />
            
            {/* Indicateurs de seuils */}
            <div className="absolute inset-0 flex items-center justify-between px-2">
              <div className="w-0.5 h-2 bg-white/30" style={{ left: '25%' }} />
              <div className="w-0.5 h-2 bg-white/30" style={{ left: '50%' }} />
              <div className="w-0.5 h-2 bg-white/30" style={{ left: '75%' }} />
            </div>
          </div>
          
          <div className="flex justify-between text-sm text-white/70">
            <span>Début</span>
            <span>25%</span>
            <span>50%</span>
            <span>75%</span>
            <span>Complété</span>
          </div>
        </div>
      </motion.div>

      {/* Indicateurs de performance clés */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="text-sm text-white/70">Productivité</div>
              <div className="text-lg font-semibold text-white">
                {calculations.productivity} tâches/jour
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="text-sm text-white/70">Taux de retard</div>
              <div className="text-lg font-semibold text-white">
                {calculations.delayRate}%
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="text-sm text-white/70">Efficacité équipe</div>
              <div className="text-lg font-semibold text-white">
                {calculations.efficiency}%
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
});

PlanningStats.displayName = 'PlanningStats';
