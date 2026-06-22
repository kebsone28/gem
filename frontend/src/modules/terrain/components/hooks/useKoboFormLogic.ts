import { useMemo } from 'react';
import {
  applyXlsFormRuntimeCalculations,
  buildXlsFormRuntimePages,
  validateXlsFormRuntime,
  type XlsFormDefinition,
} from '../xlsFormMobileRuntime';
import { validateInternalGemFields, type InternalGemField } from '../internalKoboFormDefinition';
import type { RuntimeIssueView } from '../internal-kobo-form/ValidationAssistantPanel';

export const useKoboFormLogic = (
  xlsFormDefinition: XlsFormDefinition | null,
  values: Record<string, unknown>,
  query: string
) => {
  const runtimeCalculation = useMemo(
    () => xlsFormDefinition ? applyXlsFormRuntimeCalculations(xlsFormDefinition, values) : { values, calculated: {} },
    [xlsFormDefinition, values]
  );
  
  const runtimeValues = runtimeCalculation.values;
  
  const runtimeAllPages = useMemo(
    () => xlsFormDefinition ? buildXlsFormRuntimePages(xlsFormDefinition, runtimeValues) : [],
    [xlsFormDefinition, runtimeValues]
  );
  
  const runtimePages = useMemo(
    () => xlsFormDefinition ? buildXlsFormRuntimePages(xlsFormDefinition, runtimeValues, query) : [],
    [xlsFormDefinition, runtimeValues, query]
  );
  
  const runtimeValidation = useMemo(
    () => xlsFormDefinition ? validateXlsFormRuntime(xlsFormDefinition, runtimeValues, runtimeAllPages) : null,
    [runtimeAllPages, runtimeValues, xlsFormDefinition]
  );

  const validationIssues = useMemo<RuntimeIssueView[]>(() => {
    if (!runtimeValidation) return validateInternalGemFields(values) as unknown as RuntimeIssueView[];
    return runtimeValidation.issues.map((issue) => ({
      field: {
        name: issue.field.name,
        type: issue.field.type === 'note' ? 'note' : 'text',
        label: issue.field.label || issue.field.name,
        required: issue.type === 'required',
      } as InternalGemField,
      type: issue.type,
      message: issue.message,
      runtimeIssue: issue,
    }));
  }, [runtimeValidation, values]);

  const constraintIssues = useMemo(
    () => validationIssues.filter((issue) => issue.type === 'constraint'),
    [validationIssues]
  );
  
  const missingRequired = useMemo(
    () => validationIssues.filter((issue) => issue.type === 'required'),
    [validationIssues]
  );

  return {
    runtimeValues,
    runtimeCalculated: runtimeCalculation.calculated,
    runtimeAllPages,
    runtimePages,
    runtimeValidation,
    validationIssues,
    constraintIssues,
    missingRequired,
  };
};
