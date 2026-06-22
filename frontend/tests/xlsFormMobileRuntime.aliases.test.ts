import { describe, expect, it } from 'vitest';
import { isXlsFormRuntimeFieldVisible } from '../src/modules/terrain/components/xlsFormMobileRuntime';

describe('xlsFormMobileRuntime field aliases', () => {
  it('resolves relevant expressions with a leaf field name from a grouped value path', () => {
    expect(
      isXlsFormRuntimeFieldVisible(
        { name: 'Situation_du_M_nage', type: 'select_one', relevant: "${role} = 'livreur'" },
        { 'TYPE_DE_VISITE/role': 'livreur' }
      )
    ).toBe(true);
  });

  it('resolves relevant expressions with a grouped reference from a leaf value name', () => {
    expect(
      isXlsFormRuntimeFieldVisible(
        { name: 'Situation_du_M_nage', type: 'select_one', relevant: "${TYPE_DE_VISITE/role} = 'livreur'" },
        { role: 'livreur' }
      )
    ).toBe(true);
  });
});
