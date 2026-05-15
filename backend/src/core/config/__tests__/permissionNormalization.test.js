import { describe, expect, it } from 'vitest';
import {
  ALL_FRONTEND_ATOMS,
  normalizePermissionsToAtoms,
} from '../permissionNormalization.js';

describe('permissionNormalization', () => {
  it('maps voir_missions to missions.read', () => {
    expect(normalizePermissionsToAtoms(['voir_missions'])).toEqual(['missions.read']);
  });

  it('maps project.template.create to modules.manage', () => {
    expect(normalizePermissionsToAtoms(['project.template.create'])).toEqual(['modules.manage']);
  });

  it('expands * to the full atom list (canonical order)', () => {
    const out = normalizePermissionsToAtoms(['*']);
    expect(out.length).toBe(ALL_FRONTEND_ATOMS.length);
    expect(new Set(out).size).toBe(ALL_FRONTEND_ATOMS.length);
    expect(out).toEqual([...ALL_FRONTEND_ATOMS]);
  });
});
