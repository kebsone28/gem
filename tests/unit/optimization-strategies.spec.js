import { describe, it, expect, beforeEach, vi } from 'vitest';

let GreedyOptimizationStrategy;
let GeneticAlgorithmStrategy;
let CostMinimizationStrategy;
let Zone;
let Team;
let TeamType;

describe('OptimizationStrategies (unit)', () => {

    beforeEach(async () => {
        // attach domain primitives so modules load without ReferenceError
        const enums = await import('../../src/shared/constants/enums.js');
        TeamType = enums.TeamType;
        global.TeamType = TeamType;
        global.DEFAULT_PRODUCTIVITY = enums.DEFAULT_PRODUCTIVITY;

        const E = await import('../../src/domain/entities/Entity.js');
        global.Entity = E.default || E.Entity || E;

        const T = await import('../../src/domain/entities/Team.js');
        Team = T.default || T.Team || T;
        global.Team = Team;

        const Z = await import('../../src/domain/entities/Zone.js');
        Zone = Z.default || Z.Zone || Z;
        global.Zone = Zone;

        // ProductivityRate value object required by Team constructor
        const PR = await import('../../src/domain/value-objects/ProductivityRate.js');
        const ProductivityRate = PR.default || PR.ProductivityRate || PR;
        global.ProductivityRate = ProductivityRate;

        const mod = await import('../../src/domain/services/OptimizationStrategies.js');
        GreedyOptimizationStrategy = mod.GreedyOptimizationStrategy;
        GeneticAlgorithmStrategy = mod.GeneticAlgorithmStrategy;
        CostMinimizationStrategy = mod.CostMinimizationStrategy;
    });

    it('Greedy: allocates teams prioritizing zones with more houses', () => {
        const zones = [
            new Zone('z1', 'Small', 10),
            new Zone('z2', 'Large', 100)
        ];

        // 2 teams available, one of each type
        const teams = [
            new Team('t1', 'Team 1', TeamType.RESEAU),
            new Team('t2', 'Team 2', TeamType.MACONS)
        ];

        const strategy = new GreedyOptimizationStrategy();
        const allocation = strategy.optimize(zones, teams);

        expect(allocation instanceof Map).toBe(true);
        const allocatedLarge = allocation.get(zones[1]);
        expect(Array.isArray(allocatedLarge)).toBe(true);
        expect(allocatedLarge.length).toBeGreaterThan(0);

        const assignedTeams = Array.from(allocation.values()).flat();
        const unique = new Set(assignedTeams);
        expect(unique.size).toBe(assignedTeams.length);
    });

    it('CostMinimization: respects budget when assigning teams', () => {
        const zones = [new Zone('z3', 'Z3', 20)];

        const cheap = new Team('cheap', 'Cheap Team', TeamType.PREPARATEURS);
        const expensive = new Team('exp', 'Expensive Team', TeamType.RESEAU);
        const teams = [cheap, expensive];

        const service = new CostMinimizationStrategy();
        const allocation = service.optimize(zones, teams, { maxBudget: { amount: 60000 } });

        expect(allocation instanceof Map).toBe(true);
        const assigned = allocation.get(zones[0]);
        expect(assigned.some(t => t.id === 'cheap')).toBe(true);
    });

    it('Genetic: returns a Map-like allocation and can be configured to be deterministic', () => {
        const zones = [new Zone('g1', 'G1', 5), new Zone('g2', 'G2', 7)];
        const teams = [
            new Team('a1', 'A1', TeamType.RESEAU),
            new Team('a2', 'A2', TeamType.MACONS),
            new Team('a3', 'A3', TeamType.PREPARATEURS)
        ];

        const rnd = vi.spyOn(Math, 'random').mockImplementation(() => 0.1);

        const strategy = new GeneticAlgorithmStrategy({ populationSize: 4, generations: 2, mutationRate: 0 });
        const result = strategy.optimize(zones, teams, {});

        expect(result instanceof Map).toBe(true);

        rnd.mockRestore();
    });
});
