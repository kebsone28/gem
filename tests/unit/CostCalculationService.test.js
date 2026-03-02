/**
 * Tests unitaires pour CostCalculationService
 */
import { describe, it, expect, beforeEach } from 'vitest';

// Import du service après les mocks
import '../../src/domain/services/CostCalculationService.js';

describe('CostCalculationService', () => {
    let service;
    let TeamType;

    beforeEach(async () => {
        // Load real enums to avoid global pollution issues
        const enums = await import('../../src/shared/constants/enums.js');
        TeamType = enums.TeamType;
        global.TeamType = TeamType;
        global.DEFAULT_COSTS = enums.DEFAULT_COSTS;

        // Mock other dependencies needed by the service
        global.Cost = class Cost {
            constructor(amount, currency = 'XOF') {
                this.amount = amount;
                this.currency = currency;
            }
            static zero(currency = 'XOF') { return new Cost(0, currency); }
            add(other) { return new Cost(this.amount + other.amount, this.currency); }
            toJSON() { return { amount: this.amount, currency: this.currency }; }
        };

        global.Project = class Project {
            constructor(id, name, totalHouses) {
                this.id = id;
                this.name = name;
                this.totalHouses = totalHouses;
                this.parameters = {};
            }
            getAllTeams() { return []; }
        };

        // Resolve service
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
    });

    describe('calculateLaborCost', () => {
        it('should calculate total labor cost for multiple teams', () => {
            const mockTeams = [
                { type: TeamType.MACONS, members: [{ id: 1 }, { id: 2 }] },
                { type: TeamType.PREPARATEURS, members: [{ id: 3 }] }
            ];
            const duration = 30;

            const result = service.calculateLaborCost(mockTeams, duration);

            expect(result).toBeDefined();
            expect(typeof result.amount).toBe('number');
            expect(result.amount).toBeGreaterThan(0);
        });
    });
});
