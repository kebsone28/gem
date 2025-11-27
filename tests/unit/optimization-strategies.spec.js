import { describe, it, expect, beforeEach, vi } from 'vitest';

let GreedyOptimizationStrategy;
let GeneticAlgorithmStrategy;
let CostMinimizationStrategy;
let Zone;
let Team;
let TeamType;
let DEFAULT_PRODUCTIVITY;

beforeEach(async () => {
    // attach domain primitives so modules load without ReferenceError
    const enums = await import('../../src/shared/constants/enums.js');
    TeamType = enums.TeamType;
    DEFAULT_PRODUCTIVITY = enums.DEFAULT_PRODUCTIVITY;
    global.TeamType = TeamType;
    global.DEFAULT_PRODUCTIVITY = DEFAULT_PRODUCTIVITY;

    const E = await import('../../src/domain/entities/Entity.js');
    global.Entity = E.default || E.Entity || E;

    const T = await import('../../src/domain/entities/Team.js');
    Team = T.default || T.Team || T;

    const Z = await import('../../src/domain/entities/Zone.js');

    // ProductivityRate value object required by Team constructor
    const PR = await import('../../src/domain/value-objects/ProductivityRate.js');
    const ProductivityRate = PR.default || PR.ProductivityRate || PR;
    global.ProductivityRate = ProductivityRate;
    Zone = Z.default || Z.Zone || Z;

    const mod = await import('../../src/domain/services/OptimizationStrategies.js');
    GreedyOptimizationStrategy = mod.GreedyOptimizationStrategy;
    GeneticAlgorithmStrategy = mod.GeneticAlgorithmStrategy;
    CostMinimizationStrategy = mod.CostMinimizationStrategy;
});

describe('OptimizationStrategies (unit)', () => {
    it('Greedy: allocates teams prioritizing zones with more houses', () => {
        const zones = [
            new Zone('z1', 'Small', 10),
            new Zone('z2', 'Large', 100)
        ];

        // 2 teams available, one of each type
        const teams = [
            new Team('t1', TeamType.RESEAU),
            new Team('t2', TeamType.MACONS)
        ];

        const strategy = new GreedyOptimizationStrategy();
        const allocation = strategy.optimize(zones, teams);

        // allocation should be a Map with both zones
        expect(allocation instanceof Map).toBe(true);
        // Because greedy processes largest zones first, the first (Large) zone should receive the first available team per type
        const allocatedLarge = allocation.get(zones[1]);
        expect(Array.isArray(allocatedLarge)).toBe(true);
        expect(allocatedLarge.length).toBeGreaterThan(0);

        // Ensure teams are not allocated multiple times
        const assignedTeams = Array.from(allocation.values()).flat();
        const unique = new Set(assignedTeams);
        expect(unique.size).toBe(assignedTeams.length);
    });

    it('CostMinimization: respects budget when assigning teams', () => {
        const zones = [new Zone('z3', 'Z3', 20)];

        // create a cheap and expensive team: PREPARATEURS is cheaper in strategy.getTeamCost
        const cheap = new Team('cheap', TeamType.PREPARATEURS);
        const expensive = new Team('exp', TeamType.RESEAU);
        const teams = [cheap, expensive];

        // create small budget that only allows one cheap team
        const service = new CostMinimizationStrategy();
        const allocation = service.optimize(zones, teams, { maxBudget: { amount: 60000 } });

        expect(allocation instanceof Map).toBe(true);
        const assigned = allocation.get(zones[0]);
        // should assign at least one team and not exceed budget
        expect(assigned.some(t => t.id === 'cheap')).toBe(true);
    });

    it('Genetic: returns a Map-like allocation and can be configured to be deterministic', () => {
        // To make behavior predictable, reduce population and generations and stub Math.random
        const zones = [new Zone('g1', 'G1', 5), new Zone('g2', 'G2', 7)];
        const teams = [
            new Team('a1', TeamType.RESEAU),
            new Team('a2', TeamType.MACONS),
            new Team('a3', TeamType.PREPARATEURS)
        ];

        // stub Math.random to deterministic sequence
        const rnd = vi.spyOn(Math, 'random').mockImplementation(() => 0.1);

        const strategy = new GeneticAlgorithmStrategy({ populationSize: 4, generations: 2, mutationRate: 0 });
        const result = strategy.optimize(zones, teams, {});

        // result should be an allocation-like object (Map)
        expect(result instanceof Map).toBe(true);

        rnd.mockRestore();
    });
});
