import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMemory, isValidMemory, saveMemory } from '../src/services/ai/missionSageMemory';

describe('missionSageMemory', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    vi.restoreAllMocks();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => {
        storage.clear();
      },
    });
  });

  it('validates memory shape', () => {
    expect(
      isValidMemory({
        history: [],
        contextHistory: [],
        lastUpdated: Date.now(),
      })
    ).toBe(true);
    expect(isValidMemory({ history: [], lastUpdated: Date.now() })).toBe(false);
  });

  it('returns empty memory when stored data is corrupted', () => {
    localStorage.setItem('gem_mint_memory_user-1', '{bad-json');
    const memory = getMemory('user-1');
    expect(memory.history).toEqual([]);
    expect(memory.contextHistory).toEqual([]);
  });

  it('expires old memory', () => {
    localStorage.setItem(
      'gem_mint_memory_user-2',
      JSON.stringify({
        history: ['old'],
        contextHistory: [],
        lastUpdated: Date.now() - 3_700_000,
      })
    );

    expect(getMemory('user-2').history).toEqual([]);
  });

  it('trims saved memory', () => {
    const memory = {
      history: Array.from({ length: 60 }, (_, index) => `q-${index}`),
      contextHistory: Array.from({ length: 40 }, (_, index) => ({
        role: index % 2 === 0 ? ('user' as const) : ('assistant' as const),
        content: `turn-${index}`,
      })),
      lastUpdated: Date.now(),
    };

    saveMemory('user-3', memory);
    const saved = JSON.parse(localStorage.getItem('gem_mint_memory_user-3') || '{}');
    expect(saved.history).toHaveLength(50);
    expect(saved.contextHistory.length).toBeLessThanOrEqual(30);
  });
});
