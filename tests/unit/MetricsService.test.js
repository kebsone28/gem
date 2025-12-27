/**
 * Tests unitaires pour MetricsService
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Import du service
// import { MetricsService } from '../../src/domain/services/MetricsService.js';

// Charger le service via globalThis (exporté par le service)
import '../../src/domain/services/MetricsService.js';

describe('MetricsService', () => {
    let service;

    beforeEach(async () => {
        // Mock des dépendances
        vi.mock('../../src/infrastructure/events/EventEmitter.js', () => ({
            EventEmitter: vi.fn().mockImplementation(() => ({
                emit: vi.fn(),
                on: vi.fn(),
                off: vi.fn()
            }))
        }));

        vi.mock('../../src/infrastructure/logging/Logger.js', () => ({
            Logger: vi.fn().mockImplementation(() => ({
                info: vi.fn(),
                error: vi.fn(),
                warn: vi.fn()
            }))
        }));

        // Charger dynamiquement le service
        const MS = await import('../../src/domain/services/MetricsService.js');
        const MetricsService = globalThis.MetricsService || MS.MetricsService || MS.default || MS;
        service = new MetricsService();
    });

    describe('mean', () => {
        it('should calculate the arithmetic mean of an array of numbers', () => {
            const data = [10, 20, 30, 40, 50];
            const result = service.mean(data);
            expect(result).toBe(30);
        });

        it('should handle single element array', () => {
            const data = [42];
            const result = service.mean(data);
            expect(result).toBe(42);
        });

        it('should handle empty array', () => {
            const data = [];
            const result = service.mean(data);
            expect(result).toBe(0);
        });

        it('should handle decimal numbers', () => {
            const data = [1.5, 2.5, 3.5];
            const result = service.mean(data);
            expect(result).toBe(2.5);
        });
    });

    describe('linearRegression', () => {
        it('should calculate linear regression for a simple increasing sequence', () => {
            const yValues = [2, 4, 6, 8, 10];
            const result = service.linearRegression(yValues);

            expect(result).toHaveProperty('slope');
            expect(result).toHaveProperty('intercept');
            expect(typeof result.slope).toBe('number');
            expect(typeof result.intercept).toBe('number');

            // Pour y = 2x + 0, la pente devrait être proche de 2
            expect(result.slope).toBeCloseTo(2, 1);
        });

        it('should handle constant values', () => {
            const yValues = [5, 5, 5, 5, 5];
            const result = service.linearRegression(yValues);

            expect(result.slope).toBeCloseTo(0, 1);
            expect(result.intercept).toBeCloseTo(5, 1);
        });

        it('should handle decreasing sequence', () => {
            const yValues = [10, 8, 6, 4, 2];
            const result = service.linearRegression(yValues);

            expect(result.slope).toBeLessThan(0);
        });

        it('should handle single point', () => {
            const yValues = [42];
            const result = service.linearRegression(yValues);

            expect(result.slope).toBe(0);
            expect(result.intercept).toBe(42);
        });
    });

    describe('median', () => {
        it('should calculate median for odd number of elements', () => {
            const data = [1, 3, 5, 7, 9];
            const result = service.median(data);
            expect(result).toBe(5);
        });

        it('should calculate median for even number of elements', () => {
            const data = [1, 3, 5, 7];
            const result = service.median(data);
            expect(result).toBe(4); // (3 + 5) / 2
        });

        it('should handle single element', () => {
            const data = [42];
            const result = service.median(data);
            expect(result).toBe(42);
        });

        it('should handle empty array', () => {
            const data = [];
            const result = service.median(data);
            expect(result).toBe(0);
        });
    });

    describe('standardDeviation', () => {
        it('should calculate standard deviation', () => {
            const data = [2, 4, 6, 8, 10];
            const result = service.standardDeviation(data);
            expect(result).toBeGreaterThan(0);
            expect(typeof result).toBe('number');
        });

        it('should return 0 for constant values', () => {
            const data = [5, 5, 5, 5, 5];
            const result = service.standardDeviation(data);
            expect(result).toBe(0);
        });

        it('should handle single element', () => {
            const data = [42];
            const result = service.standardDeviation(data);
            expect(result).toBe(0);
        });
    });

    describe('percentile', () => {
        it('should calculate 50th percentile (median)', () => {
            const data = [1, 2, 3, 4, 5];
            const result = service.percentile(data, 50);
            expect(result).toBe(3);
        });

        it('should calculate 25th percentile', () => {
            const data = [1, 2, 3, 4, 5];
            const result = service.percentile(data, 25);
            expect(result).toBe(2);
        });

        it('should calculate 75th percentile', () => {
            const data = [1, 2, 3, 4, 5];
            const result = service.percentile(data, 75);
            expect(result).toBe(4);
        });
    });

    describe('correlation', () => {
        it('should calculate perfect positive correlation', () => {
            const x = [1, 2, 3, 4, 5];
            const y = [2, 4, 6, 8, 10];
            const result = service.correlation(x, y);
            expect(result).toBeCloseTo(1, 1);
        });

        it('should calculate perfect negative correlation', () => {
            const x = [1, 2, 3, 4, 5];
            const y = [10, 8, 6, 4, 2];
            const result = service.correlation(x, y);
            expect(result).toBeCloseTo(-1, 1);
        });

        it('should calculate zero correlation for unrelated data', () => {
            const x = [1, 2, 3, 4, 5];
            const y = [5, 5, 5, 5, 5];
            const result = service.correlation(x, y);
            expect(result).toBeCloseTo(0, 1);
        });
    });

    describe('movingAverage', () => {
        it('should calculate simple moving average', () => {
            const data = [1, 2, 3, 4, 5];
            const result = service.movingAverage(data, 3);
            expect(result).toEqual([2, 3, 4]); // (1+2+3)/3=2, (2+3+4)/3=3, (3+4+5)/3=4
        });

        it('should handle window size larger than data', () => {
            const data = [1, 2, 3];
            const result = service.movingAverage(data, 5);
            expect(result).toEqual([]);
        });
    });
});