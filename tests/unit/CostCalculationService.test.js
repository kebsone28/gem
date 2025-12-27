/**
 * Tests unitaires pour CostCalculationService
 */
import { describe, it, expect, beforeEach } from 'vitest';

// Mock des dépendances globales pour les tests
global.TeamType = {
    PREPARATEURS: 'preparateurs',
    LIVRAISON: 'livraison',
    MACONS: 'macons',
    RESEAU: 'reseau',
    INTERIEUR_TYPE1: 'interieur_type1',
    CONTROLE: 'controle'
};

global.DEFAULT_COSTS = {
    DAILY_RATES: {
        preparateur: 5000,
        livreur: 6000,
        macon: 8000,
        reseau: 10000,
        interieur_type1: 9000,
        interieur_type2: 11000,
        controleur: 7000,
        superviseur: 15000,
        chauffeur: 6000,
        agent_livraison: 5500,
        chef_projet: 50000
    }
};

global.Cost = class Cost {
    constructor(amount, currency = 'EUR') {
        this.amount = amount;
        this.currency = currency;
    }

    toJSON() {
        return { amount: this.amount, currency: this.currency };
    }
};

global.Team = class Team {
    constructor(id, type, members = []) {
        this.id = id;
        this.type = type;
        this.members = members;
    }
};

global.Zone = class Zone {
    constructor(id, name, totalHouses) {
        this.id = id;
        this.name = name;
        this.totalHouses = totalHouses;
    }
};

global.Project = class Project {
    constructor(id, name, totalHouses) {
        this.id = id;
        this.name = name;
        this.totalHouses = totalHouses;
    }
};

// Import du service après les mocks
// import { CostCalculationService } from '../../src/domain/services/CostCalculationService.js';

// Charger le service via globalThis (exporté par le service)
import '../../src/domain/services/CostCalculationService.js';

describe('CostCalculationService', () => {
    let service;

    beforeEach(async () => {
        // Charger dynamiquement le service
        const CS = await import('../../src/domain/services/CostCalculationService.js');
        const CostCalculationService = globalThis.CostCalculationService || CS.CostCalculationService || CS.default || CS;
        service = new CostCalculationService();
    });

    describe('getDailyRateForTeam', () => {
        it('should return a positive number for valid team type', () => {
            const rate = service.getDailyRateForTeam(TeamType.MACONS);
            expect(typeof rate).toBe('number');
            expect(rate).toBeGreaterThan(0);
        });

        it('should return different rates for different team types', () => {
            const maconsRate = service.getDailyRateForTeam(TeamType.MACONS);
            const reseauRate = service.getDailyRateForTeam(TeamType.RESEAU);
            expect(maconsRate).not.toBe(reseauRate);
        });
    });

    describe('calculateTeamCost', () => {
        it('should calculate cost for a team over given duration', () => {
            const mockTeam = {
                type: TeamType.MACONS,
                members: [{ id: 1 }, { id: 2 }]
            };
            const duration = 30;
            const paymentMode = 'daily';

            const result = service.calculateTeamCost(mockTeam, duration, paymentMode);

            expect(result).toBeDefined();
            expect(typeof result.amount).toBe('number');
            expect(result.amount).toBeGreaterThan(0);
        });

        it('should handle different payment modes', () => {
            const mockTeam = {
                type: TeamType.MACONS,
                members: [{ id: 1 }]
            };
            const duration = 30;

            const dailyResult = service.calculateTeamCost(mockTeam, duration, 'daily');
            const monthlyResult = service.calculateTeamCost(mockTeam, duration, 'monthly');

            expect(dailyResult.amount).not.toBe(monthlyResult.amount);
        });
    });

    describe('calculateMaterialCost', () => {
        it('should calculate material cost based on number of houses', () => {
            const totalHouses = 100;
            const params = {};

            const result = service.calculateMaterialCost(totalHouses, params);

            expect(result).toBeDefined();
            expect(typeof result.amount).toBe('number');
            expect(result.amount).toBeGreaterThan(0);
        });

        it('should scale with number of houses', () => {
            const smallProject = service.calculateMaterialCost(50, {});
            const largeProject = service.calculateMaterialCost(100, {});

            expect(largeProject.amount).toBeGreaterThan(smallProject.amount);
        });
    });

    describe('calculateLaborCost', () => {
        it('should calculate total labor cost for multiple teams', () => {
            const mockTeams = [
                { type: TeamType.MACONS, members: [{ id: 1 }, { id: 2 }] },
                { type: TeamType.PREPARATEURS, members: [{ id: 3 }] }
            ];
            const duration = 30;
            const params = {};
            const totalHouses = 100;

            const result = service.calculateLaborCost(mockTeams, duration, params, totalHouses);

            expect(result).toBeDefined();
            expect(typeof result.amount).toBe('number');
            expect(result.amount).toBeGreaterThan(0);
        });

        it('should increase with more teams', () => {
            const singleTeam = [{ type: TeamType.MACONS, members: [{ id: 1 }] }];
            const multipleTeams = [
                { type: TeamType.MACONS, members: [{ id: 1 }] },
                { type: TeamType.RESEAU, members: [{ id: 2 }] }
            ];

            const singleCost = service.calculateLaborCost(singleTeam, 30, {}, 50);
            const multipleCost = service.calculateLaborCost(multipleTeams, 30, {}, 50);

            expect(multipleCost.amount).toBeGreaterThan(singleCost.amount);
        });
    });

    describe('calculateTotalCost', () => {
        it('should calculate total project cost including materials and labor', () => {
            const mockTeams = [
                { type: TeamType.MACONS, members: [{ id: 1 }] }
            ];
            const totalHouses = 50;
            const duration = 30;
            const params = {};

            const result = service.calculateTotalCost(mockTeams, totalHouses, duration, params);

            expect(result).toBeDefined();
            expect(typeof result.amount).toBe('number');
            expect(result.amount).toBeGreaterThan(0);
        });
    });
});
