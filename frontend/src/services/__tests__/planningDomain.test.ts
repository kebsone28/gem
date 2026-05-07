import {
  getHouseholdPhase,
  getEstimatedDuration,
  getAvailablePlanningRegions,
  computeTheoreticalNeeds,
  buildWorkflowStages,
  buildPlanningTasks,
  buildTeamPlannings,
  buildPlanningStats,
  hasHouseholdDeliveryEvidence,
} from '../planningDomain';

import type { Household, Team, ProjectConfig } from '../../utils/types';

// Mock data pour les tests
const mockHouseholds: Household[] = [
  {
    id: 'hh1',
    name: 'Ménage 1',
    numeroordre: 'LOT001',
    village: 'Dakar',
    region: 'Dakar',
    koboSync: {
      livraisonDate: '2024-01-15',
      maconOk: true,
      reseauOk: false,
      interieurOk: false,
      controleOk: false,
    },
  },
  {
    id: 'hh2',
    name: 'Ménage 2',
    numeroordre: 'LOT002',
    village: 'Thiès',
    region: 'Thiès',
    koboSync: {
      livraisonDate: '2024-01-20',
      maconOk: true,
      reseauOk: true,
      interieurOk: false,
      controleOk: false,
    },
  },
  {
    id: 'hh3',
    name: 'Ménage 3',
    numeroordre: 'LOT003',
    village: 'Kaolack',
    region: 'Kaolack',
    koboSync: {
      livraisonDate: '2024-01-25',
      maconOk: true,
      reseauOk: true,
      interieurOk: true,
      controleOk: false,
    },
  },
];

const mockTeams: Team[] = [
  {
    id: 'team1',
    name: 'Équipe Maçonnerie A',
    projectId: 'proj1',
    organizationId: 'org1',
    level: 1,
    role: 'INSTALLATION',
    tradeKey: 'macons',
    capacity: 5,
    status: 'active',
    region: { id: 'region1', name: 'Dakar' },
  },
  {
    id: 'team2',
    name: 'Équipe Réseau B',
    projectId: 'proj1',
    organizationId: 'org1',
    level: 1,
    role: 'INSTALLATION',
    tradeKey: 'reseau',
    capacity: 8,
    status: 'active',
    region: { id: 'region2', name: 'Thiès' },
  },
];

const mockProjectConfig: ProjectConfig = {
  productionRates: {
    livraison: 12,
    macons: 5,
    reseau: 8,
    interieur_type1: 6,
    controle: 15,
  },
  warehouses: [
    {
      id: 'wh1',
      name: 'Entrepôt Dakar',
      regionId: 'region1',
      region: 'Dakar',
      deletedAt: null,
    },
  ],
};

describe('planningDomain', () => {
  describe('getHouseholdPhase', () => {
    it('devrait retourner LIVRAISON pour un ménage sans sync', () => {
      const household: Household = {
        id: 'hh1',
        name: 'Test',
        koboSync: null,
      };

      const result = getHouseholdPhase(household);
      expect(result.phase).toBe('LIVRAISON');
      expect(result.progress).toBe(0);
    });

    it('devrait retourner TERMINE pour un ménage avec contrôle OK', () => {
      const household: Household = {
        id: 'hh1',
        name: 'Test',
        koboSync: {
          livraisonDate: '2024-01-15',
          maconOk: true,
          reseauOk: true,
          interieurOk: true,
          controleOk: true,
        },
      };

      const result = getHouseholdPhase(household);
      expect(result.phase).toBe('TERMINE');
      expect(result.progress).toBe(100);
    });

    it('devrait retourner CONTROLE pour un ménage avec intérieur OK', () => {
      const household: Household = {
        id: 'hh1',
        name: 'Test',
        koboSync: {
          livraisonDate: '2024-01-15',
          maconOk: true,
          reseauOk: true,
          interieurOk: true,
          controleOk: false,
        },
      };

      const result = getHouseholdPhase(household);
      expect(result.phase).toBe('CONTROLE');
      expect(result.progress).toBe(80);
    });

    it('devrait retourner INTERIEUR pour un ménage avec réseau OK', () => {
      const household: Household = {
        id: 'hh1',
        name: 'Test',
        koboSync: {
          livraisonDate: '2024-01-15',
          maconOk: true,
          reseauOk: true,
          interieurOk: false,
          controleOk: false,
        },
      };

      const result = getHouseholdPhase(household);
      expect(result.phase).toBe('INTERIEUR');
      expect(result.progress).toBe(60);
    });

    it('devrait retourner RESEAU pour un ménage avec maçonnerie OK', () => {
      const household: Household = {
        id: 'hh1',
        name: 'Test',
        koboSync: {
          livraisonDate: '2024-01-15',
          maconOk: true,
          reseauOk: false,
          interieurOk: false,
          controleOk: false,
        },
      };

      const result = getHouseholdPhase(household);
      expect(result.phase).toBe('RESEAU');
      expect(result.progress).toBe(40);
    });

    it('devrait retourner MACONNERIE pour un ménage avec livraison', () => {
      const household: Household = {
        id: 'hh1',
        name: 'Test',
        koboSync: {
          livraisonDate: '2024-01-15',
          maconOk: false,
          reseauOk: false,
          interieurOk: false,
          controleOk: false,
        },
      };

      const result = getHouseholdPhase(household);
      expect(result.phase).toBe('MACONNERIE');
      expect(result.progress).toBe(25);
    });
  });

  describe('getEstimatedDuration', () => {
    it('devrait retourner les durées correctes pour chaque phase', () => {
      expect(getEstimatedDuration('PREPARATION')).toBe(3);
      expect(getEstimatedDuration('LIVRAISON')).toBe(4);
      expect(getEstimatedDuration('MACONNERIE')).toBe(5);
      expect(getEstimatedDuration('RESEAU')).toBe(4);
      expect(getEstimatedDuration('INTERIEUR')).toBe(3);
      expect(getEstimatedDuration('CONTROLE')).toBe(2);
      expect(getEstimatedDuration('TERMINE')).toBe(0);
    });

    it('devrait retourner 3 pour une phase inconnue', () => {
      expect(getEstimatedDuration('UNKNOWN' as any)).toBe(3);
    });
  });

  describe('getAvailablePlanningRegions', () => {
    it('devrait retourner les régions uniques triées', () => {
      const regions = getAvailablePlanningRegions(mockHouseholds);
      expect(regions).toEqual(['Dakar', 'Kaolack', 'Thiès']);
    });

    it('devrait gérer les régions vides ou nulles', () => {
      const householdsWithEmptyRegion = [
        ...mockHouseholds,
        { id: 'hh4', name: 'Test', region: '' },
        { id: 'hh5', name: 'Test', region: null as any },
      ];

      const regions = getAvailablePlanningRegions(householdsWithEmptyRegion);
      expect(regions).toEqual(['Dakar', 'Kaolack', 'Thiès']);
    });

    it('devrait retourner un tableau vide pour aucun ménage', () => {
      const regions = getAvailablePlanningRegions([]);
      expect(regions).toEqual([]);
    });
  });

  describe('hasHouseholdDeliveryEvidence', () => {
    it('devrait retourner vrai pour un ménage avec koboSync.livreurDate', () => {
      const household: Household = {
        id: 'hh1',
        name: 'Test',
        koboSync: {
          livreurDate: '2024-01-15',
        },
      };

      expect(hasHouseholdDeliveryEvidence(household)).toBe(true);
    });

    it('devrait retourner vrai pour un ménage avec delivery.date', () => {
      const household: Household = {
        id: 'hh1',
        name: 'Test',
        delivery: {
          date: '2024-01-15',
        },
      };

      expect(hasHouseholdDeliveryEvidence(household)).toBe(true);
    });

    it('devrait retourner vrai pour un statut de livraison valide', () => {
      const household: Household = {
        id: 'hh1',
        name: 'Test',
        deliveryStatus: 'livré',
      };

      expect(hasHouseholdDeliveryEvidence(household)).toBe(true);
    });

    it('devrait retourner faux pour un ménage sans preuve de livraison', () => {
      const household: Household = {
        id: 'hh1',
        name: 'Test',
      };

      expect(hasHouseholdDeliveryEvidence(household)).toBe(false);
    });
  });

  describe('computeTheoreticalNeeds', () => {
    it('devrait calculer les besoins théoriques correctement', () => {
      const needs = computeTheoreticalNeeds({
        households: mockHouseholds,
        teams: mockTeams,
        targetMonths: 6,
        selectedRegion: 'ALL',
        productionRates: mockProjectConfig.productionRates,
      });

      expect(needs).not.toBeNull();
      expect(needs!.workingDays).toBe(132); // 6 mois * 22 jours
      expect(needs!.workDaysPerWeek).toBe(5);
      expect(needs!.livraison).toBeGreaterThan(0);
      expect(needs!.macons).toBeGreaterThan(0);
      expect(needs!.reseau).toBeGreaterThan(0);
      expect(needs!.interieur).toBeGreaterThan(0);
      expect(needs!.controle).toBeGreaterThan(0);
    });

    it('devrait retourner null pour des données invalides', () => {
      const needs1 = computeTheoreticalNeeds({
        households: [],
        teams: mockTeams,
        targetMonths: 6,
        selectedRegion: 'ALL',
      });

      const needs2 = computeTheoreticalNeeds({
        households: mockHouseholds,
        teams: mockTeams,
        targetMonths: 0,
        selectedRegion: 'ALL',
      });

      expect(needs1).toBeNull();
      expect(needs2).toBeNull();
    });

    it('devrait calculer les besoins par région spécifique', () => {
      const needs = computeTheoreticalNeeds({
        households: mockHouseholds,
        teams: mockTeams,
        targetMonths: 6,
        selectedRegion: 'Dakar',
        productionRates: mockProjectConfig.productionRates,
      });

      expect(needs).not.toBeNull();
      // Seul le ménage de Dakar est compté
      expect(needs!.livraison).toBe(Math.ceil(1 / (132 * 12))); // 1 ménage / (jours * taux)
    });
  });

  describe('buildWorkflowStages', () => {
    it('devrait construire les étapes de workflow correctement', () => {
      const stages = buildWorkflowStages({
        households: mockHouseholds,
        teams: mockTeams,
        projectConfig: mockProjectConfig,
        targetMonths: 6,
        selectedRegion: 'ALL',
      });

      expect(stages).toHaveLength(6); // 6 phases principales
      expect(stages[0].key).toBe('FORMATION');
      expect(stages[1].key).toBe('LIVRAISON');
      expect(stages[2].key).toBe('MACONNERIE');
      expect(stages[3].key).toBe('RESEAU');
      expect(stages[4].key).toBe('INSTALLATION');
      expect(stages[5].key).toBe('CONTROLE');
    });

    it('devrait calculer correctement les progressions', () => {
      const stages = buildWorkflowStages({
        households: mockHouseholds,
        teams: mockTeams,
        projectConfig: mockProjectConfig,
        targetMonths: 6,
        selectedRegion: 'ALL',
      });

      const livraisonStage = stages.find(s => s.key === 'LIVRAISON');
      const masonryStage = stages.find(s => s.key === 'MACONNERIE');
      const networkStage = stages.find(s => s.key === 'RESEAU');

      expect(livraisonStage?.completedCount).toBe(3); // 3 ménages livrés
      expect(masonryStage?.completedCount).toBe(3); // 3 ménages maçonnés
      expect(networkStage?.completedCount).toBe(2); // 2 ménages avec réseau OK
    });

    it('devrait identifier les risques et blocages', () => {
      const stages = buildWorkflowStages({
        households: mockHouseholds,
        teams: [], // Pas d'équipes
        projectConfig: mockProjectConfig,
        targetMonths: 6,
        selectedRegion: 'ALL',
      });

      stages.forEach(stage => {
        if (stage.key !== 'FORMATION') {
          expect(stage.atRisk).toBe(true);
          expect(stage.isBlocked).toBe(true);
        }
      });
    });
  });

  describe('buildPlanningTasks', () => {
    it('devrait construire les tâches de planning correctement', () => {
      const allocationPlan = new Map([
        ['hh1', { team: mockTeams[0], source: 'configured' }],
        ['hh2', { team: mockTeams[1], source: 'balanced' }],
        ['hh3', { team: mockTeams[0], source: 'manual' }],
      ]);

      const tasks = buildPlanningTasks({
        households: mockHouseholds.map(h => ({ ...h, assignedTeamId: allocationPlan.get(h.id)?.team?.id })),
        allocationPlanByHousehold: allocationPlan,
      });

      expect(tasks).toHaveLength(3);
      expect(tasks[0].householdId).toBe('hh1');
      expect(tasks[0].teamId).toBe('team1');
      expect(tasks[0].allocationSource).toBe('configured');
    });

    it('devrait calculer les retards correctement', () => {
      const oldDate = new Date('2024-01-01');
      const allocationPlan = new Map();

      const tasks = buildPlanningTasks({
        households: [{
          id: 'hh1',
          name: 'Test',
          koboSync: {
            livraisonDate: '2024-01-15',
            maconOk: false,
          },
          createdAt: oldDate.toISOString(),
        }],
        allocationPlanByHousehold: allocationPlan,
        now: new Date('2024-02-01'),
      });

      expect(tasks[0].isDelayed).toBe(true);
      expect(tasks[0].delayDays).toBeGreaterThan(0);
    });
  });

  describe('buildTeamPlannings', () => {
    it('devrait construire les plannings d équipe correctement', () => {
      const tasks = [
        {
          id: 'task1',
          householdId: 'hh1',
          teamId: 'team1',
          phase: 'MACONNERIE' as any,
          phaseProgress: 50,
          plannedDuration: 5,
          isDelayed: false,
          delayDays: 0,
        },
        {
          id: 'task2',
          householdId: 'hh2',
          teamId: 'team1',
          phase: 'MACONNERIE' as any,
          phaseProgress: 75,
          plannedDuration: 5,
          isDelayed: false,
          delayDays: 0,
        },
      ];

      const teamPlannings = buildTeamPlannings(tasks, mockTeams);

      expect(teamPlannings).toHaveLength(2); // team1 + UNASSIGNED
      expect(teamPlannings[0].team.id).toBe('team1');
      expect(teamPlannings[0].tasks).toHaveLength(2);
      expect(teamPlannings[0].utilization).toBe(40); // 2 tâches / 5 capacité
      expect(teamPlannings[0].status).toBe('busy');
    });

    it('devrait inclure les tâches non assignées', () => {
      const tasks = [
        {
          id: 'task1',
          householdId: 'hh1',
          phase: 'MACONNERIE' as any,
          phaseProgress: 50,
          plannedDuration: 5,
          isDelayed: false,
          delayDays: 0,
        },
      ];

      const teamPlannings = buildTeamPlannings(tasks, mockTeams);

      expect(teamPlannings).toHaveLength(2); // team1 + UNASSIGNED
      const unassignedPlanning = teamPlannings.find(p => p.team.id === 'UNASSIGNED');
      expect(unassignedPlanning?.tasks).toHaveLength(1);
    });
  });

  describe('buildPlanningStats', () => {
    it('devrait calculer les statistiques correctement', () => {
      const tasks = [
        {
          id: 'task1',
          phase: 'LIVRAISON' as any,
          region: 'Dakar',
        },
        {
          id: 'task2',
          phase: 'MACONNERIE' as any,
          region: 'Dakar',
        },
        {
          id: 'task3',
          phase: 'TERMINE' as any,
          region: 'Dakar',
        },
        {
          id: 'task4',
          phase: 'RESEAU' as any,
          region: 'Thiès',
          isDelayed: true,
        },
      ];

      const stats = buildPlanningStats(tasks, 'ALL');

      expect(stats.total).toBe(4);
      expect(stats.byPhase.LIVRAISON).toBe(1);
      expect(stats.byPhase.MACONNERIE).toBe(1);
      expect(stats.byPhase.TERMINE).toBe(1);
      expect(stats.byPhase.RESEAU).toBe(1);
      expect(stats.completed).toBe(1);
      expect(stats.delayed).toBe(1);
    });

    it('devrait filtrer par région spécifique', () => {
      const tasks = [
        {
          id: 'task1',
          phase: 'LIVRAISON' as any,
          region: 'Dakar',
        },
        {
          id: 'task2',
          phase: 'MACONNERIE' as any,
          region: 'Thiès',
        },
      ];

      const stats = buildPlanningStats(tasks, 'Dakar');

      expect(stats.total).toBe(1);
      expect(stats.byPhase.LIVRAISON).toBe(1);
      expect(stats.byPhase.MACONNERIE).toBeUndefined();
    });
  });
});
