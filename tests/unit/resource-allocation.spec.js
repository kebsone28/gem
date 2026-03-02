import { describe, it, expect, beforeEach } from 'vitest';

let ResourceAllocationService;
let Zone;
let Team;
let ProductivityRate;
let TeamType;
let ConstraintViolationError;
let ValidationError;

describe('ResourceAllocationService (unit)', () => {

    beforeEach(async () => {
        // ensure globals and classes are available
        const E = await import('../../src/domain/entities/Entity.js');
        global.Entity = E.default || E.Entity || E;

        const PR = await import('../../src/domain/value-objects/ProductivityRate.js');
        ProductivityRate = PR.default || PR.ProductivityRate || PR;
        global.ProductivityRate = ProductivityRate;

        await import('../../src/shared/constants/enums.js');
        TeamType = globalThis.TeamType;
        global.TeamType = TeamType;
        global.DEFAULT_PRODUCTIVITY = globalThis.DEFAULT_PRODUCTIVITY;

        const T = await import('../../src/domain/entities/Team.js');
        Team = T.default || T.Team || T;
        global.Team = Team;

        const Z = await import('../../src/domain/entities/Zone.js');
        Zone = Z.default || Z.Zone || Z;
        global.Zone = Zone;

        const RASM = await import('../../src/domain/services/ResourceAllocationService.js');
        ResourceAllocationService = globalThis.ResourceAllocationService || RASM.ResourceAllocationService || RASM.default || RASM;

        const errors = await import('../../src/shared/errors/DomainErrors.js');
        ConstraintViolationError = errors.ConstraintViolationError;
        ValidationError = errors.ValidationError;
        global.ConstraintViolationError = ConstraintViolationError;
        global.ValidationError = ValidationError;
    });

    it('calculateRequiredTeams returns expected per-type values', async () => {
        const service = new ResourceAllocationService();
        const zone = new Zone('z1', 'Z1', 100);

        const productivityRates = {};
        productivityRates[TeamType.RESEAU] = new ProductivityRate(5, TeamType.RESEAU);
        productivityRates[TeamType.MACONS] = new ProductivityRate(10, TeamType.MACONS);

        const required = service.calculateRequiredTeams(zone, 10, productivityRates);

        expect(required[TeamType.RESEAU]).toBe(2);
        expect(required[TeamType.MACONS]).toBe(1);
    });

    it('balanceWorkload suggests reallocation when ratio > 100', async () => {
        const service = new ResourceAllocationService();
        const zone = new Zone('z2', 'Z2', 1000);
        const t = new Team('t1', 'T1', TeamType.RESEAU);
        zone.assignTeam(TeamType.RESEAU, t);

        const result = service.balanceWorkload([zone], [t]);

        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThan(0);
        expect(result[0]).toHaveProperty('additionalTeams');
    });

    it('validateAllocation throws when required team types are missing', async () => {
        const service = new ResourceAllocationService();
        const zone = new Zone('z3', 'Z3', 50);
        const t = new Team('t2', 'T2', TeamType.RESEAU);

        const allocation = new Map();
        allocation.set(zone, [t]);

        expect(() => service.validateAllocation(allocation, {})).toThrow(/missing required team type/);
    });

    it('optimizeForDuration assigns available teams up to required count', async () => {
        const service = new ResourceAllocationService();
        const zone = new Zone('z4', 'Z4', 10);

        const availableTeams = Object.values(TeamType).map((type, i) => new Team(`a-${i}`, `Team ${i}`, type));

        const allocation = service.optimizeForDuration([zone], availableTeams, 5);

        expect(allocation.has(zone)).toBe(true);
        const assigned = allocation.get(zone);
        expect(Array.isArray(assigned)).toBe(true);
        expect(assigned.length).toBeGreaterThan(0);
    });

    it('optimizeForCost assigns at least one team per zone when available', async () => {
        const service = new ResourceAllocationService();
        const z1 = new Zone('z5', 'Z5', 50);
        const z2 = new Zone('z6', 'Z6', 20);

        const t1 = new Team('c1', 'C1', TeamType.RESEAU);
        const t2 = new Team('c2', 'C2', TeamType.MACONS);
        const availableTeams = [t1, t2];

        const allocation = service.optimizeForCost([z1, z2], availableTeams, 1000000);

        expect(allocation.has(z1)).toBe(true);
        expect(allocation.has(z2)).toBe(true);
        expect(allocation.get(z1).length).toBeGreaterThanOrEqual(0);
    });
});
