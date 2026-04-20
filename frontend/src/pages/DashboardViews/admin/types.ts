/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
import type { MissionStats } from '../../../services/missionStatsService';

export interface PipelineData {
  murs: number;
  reseau: number;
  interieur: number;
  validated: number;
}

export interface PerformanceData {
  avgPerDay: number;
  daysWorked: number;
  avgcâblePerHouse: number;
  efficiencyRate: number;
}

export interface LogisticsData {
  kitPrepared: number;
  kitLoaded: number;
  gap: number;
}

export interface DashboardMetrics {
  totalHouseholds: number;
  electrifiedHouseholds: number;
  progressPercent: number;
  igppScore: number;
  problemHouseholds: number;
  incidentsHSE: number;
  pvRetard: number;
  totalPV: number;
  totalArchived: number;
  pvnc: number;
  pvr: number;
  pvhse: number;
  nonConforme: number;
  conforme: number;
  actionRequired: number;
  syncHealth?: 'healthy' | 'degraded' | 'critical';
  pipeline: PipelineData;
  performance: PerformanceData;
  logistics: LogisticsData;
  technical: { totalConsumption: number };
  breakdown: {
    byZone: any[];
    byTeam: any[];
  };
}

export interface Activity {
  id: string;
  type: 'success' | 'warning' | 'danger' | 'info';
  message: string;
  time: string;
}

export type { MissionStats };
