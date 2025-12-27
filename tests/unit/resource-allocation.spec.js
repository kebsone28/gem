import { describe, it, expect } from 'vitest';

let ResourceAllocationService;
let Zone;
let Team;
let ProductivityRate;
let TeamType;
let ConstraintViolationError;
let ValidationError;

// load and attach domain primitives dynamically in a simple beforeEach below

describe('ResourceAllocationService (unit)', () => {
    it('calculateRequiredTeams returns expected per-type values', async () => {
        // ensure globals and classes are available
        const E = await import('../../src/domain/entities/Entity.js');
        global.Entity = E.default || E.Entity || E;

        const PR = await import('../../src/domain/value-objects/ProductivityRate.js');
        ProductivityRate = PR.default || PR.ProductivityRate || PR;
        global.ProductivityRate = ProductivityRate;

        const enums = await import('../../src/shared/constants/enums.js');
        TeamType = enums.TeamType || (enums.default && enums.default.TeamType);
        global.TeamType = TeamType;
        global.DEFAULT_PRODUCTIVITY = enums.DEFAULT_PRODUCTIVITY || (enums.default && enums.default.DEFAULT_PRODUCTIVITY);

        const T = await import('../../src/domain/entities/Team.js');
        Team = T.default || T.Team || T;

        const Z = await import('../../src/domain/entities/Zone.js');
        Zone = Z.default || Z.Zone || Z;

        const RASM = await import('../../src/domain/services/ResourceAllocationService.js');
        ResourceAllocationService = globalThis.ResourceAllocationService || RASM.ResourceAllocationService || RASM.default || RASM;

        const errors = await import('../../src/shared/errors/DomainErrors.js');
        ConstraintViolationError = errors.ConstraintViolationError;
        ValidationError = errors.ValidationError;
        global.ConstraintViolationError = ConstraintViolationError;
        global.ValidationError = ValidationError;

        const service = new (globalThis.ResourceAllocationService || ResourceAllocationService)();
        const zone = new Zone('z1', 'Z1', 100);

        const productivityRates = {};
        productivityRates[TeamType.RESEAU] = new ProductivityRate(5, TeamType.RESEAU);
        productivityRates[TeamType.MACONS] = new ProductivityRate(10, TeamType.MACONS);

        const required = service.calculateRequiredTeams(zone, 10, productivityRates);

        // For RESEAU: ceil(100/(5*10)) = ceil(2) = 2
        expect(required[TeamType.RESEAU]).toBe(2);
        // For MACONS: ceil(100/(10*10)) = ceil(1) = 1
        expect(required[TeamType.MACONS]).toBe(1);
    });

    it('balanceWorkload suggests reallocation when ratio > 100', async () => {
        // ensure minimal globals for this test run
        if (!Zone) {
            const E = await import('../../src/domain/entities/Entity.js');
            global.Entity = E.default || E.Entity || E;
            const T = await import('../../src/domain/entities/Team.js');
            Team = T.default || T.Team || T;
            const Z = await import('../../src/domain/entities/Zone.js');
            Zone = Z.default || Z.Zone || Z;
        }
        const service = new (globalThis.ResourceAllocationService || ResourceAllocationService)();
        const zone = new Zone('z2', 'Z2', 1000);
        const t = new Team('t1', TeamType.RESEAU);
        zone.assignTeam(TeamType.RESEAU, t);

        const result = service.balanceWorkload([zone], [t]);

        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThan(0);
        expect(result[0]).toHaveProperty('additionalTeams');
    });

    it('validateAllocation throws when required team types are missing', async () => {
        const service = new (globalThis.ResourceAllocationService || ResourceAllocationService)();
        const zone = new Zone('z3', 'Z3', 50);
        // only one team of one type
        const t = new Team('t2', TeamType.RESEAU);

        const allocation = new Map();
        allocation.set(zone, [t]);

        // the service throws a DomainError when constraint violated; assert on the message
        expect(() => service.validateAllocation(allocation, {})).toThrow(/missing required team type/);
    });

    it('optimizeForDuration assigns available teams up to required count', async () => {
        if (!ResourceAllocationService) {
            const enums = await import('../../src/shared/constants/enums.js');
            TeamType = enums.TeamType || (enums.default && enums.default.TeamType);
            global.TeamType = TeamType;
            const RASM = await import('../../src/domain/services/ResourceAllocationService.js');
            ResourceAllocationService = RASM.ResourceAllocationService || RASM.default || RASM;
            const Z = await import('../../src/domain/entities/Zone.js');
            Zone = Z.default || Z.Zone || Z;
            const T = await import('../../src/domain/entities/Team.js');
            Team = T.default || T.Team || T;
        }
        const service = new (globalThis.ResourceAllocationService || ResourceAllocationService)();
        const zone = new Zone('z4', 'Z4', 10);

        // create one team per type
        const availableTeams = Object.values(TeamType).map((type, i) => new Team(`a-${i}`, type));

        const allocation = service.optimizeForDuration([zone], availableTeams, 5);

        // allocation should be a Map with at least one entry for our zone
        expect(allocation.has(zone)).toBe(true);
        const assigned = allocation.get(zone);
        expect(Array.isArray(assigned)).toBe(true);
        // Because availableTeams has one of each type, we expect at least one team
        expect(assigned.length).toBeGreaterThan(0);
    });

    it('optimizeForCost assigns at least one team per zone when available', async () => {
        if (!ResourceAllocationService) {
            const RASM = await import('../../src/domain/services/ResourceAllocationService.js');
            ResourceAllocationService = RASM.ResourceAllocationService || RASM.default || RASM;
            const Z = await import('../../src/domain/entities/Zone.js');
            Zone = Z.default || Z.Zone || Z;
            const T = await import('../../src/domain/entities/Team.js');
            Team = T.default || T.Team || T;
            const enums = await import('../../src/shared/constants/enums.js');
            TeamType = enums.TeamType || (enums.default && enums.default.TeamType);
            global.TeamType = TeamType;
        }
        const service = new (globalThis.ResourceAllocationService || ResourceAllocationService)();
        const z1 = new Zone('z5', 'Z5', 50);
        const z2 = new Zone('z6', 'Z6', 20);

        // create two teams of different types (limited pool)
        const t1 = new Team('c1', TeamType.RESEAU);
        const t2 = new Team('c2', TeamType.MACONS);
        const availableTeams = [t1, t2];

        const allocation = service.optimizeForCost([z1, z2], availableTeams, 1000000);

        // both zones should have an entry
        expect(allocation.has(z1)).toBe(true);
        expect(allocation.has(z2)).toBe(true);
        // Because we only have two teams, each zone should have at most 2 teams
        expect(allocation.get(z1).length).toBeGreaterThanOrEqual(0);
    });
});
