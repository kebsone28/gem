import React, { useCallback } from 'react';

/* ── Conversion helpers ── */

/** dd/MM/yyyy → yyyy-MM-dd (pour l'input HTML) */
const toInputDate = (ddmmyyyy: string): string => {
  if (!ddmmyyyy) return '';
  const parts = ddmmyyyy.split('/');
  if (parts.length !== 3) return ddmmyyyy; // déjà dans un autre format, on passe tel quel
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
};

/** yyyy-MM-dd → dd/MM/yyyy (pour l'affichage via onChange) */
const toDisplayDate = (inputValue: string): string => {
  if (!inputValue) return '';
  const parts = inputValue.split('-');
  if (parts.length !== 3) return inputValue;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

/* ── Interface ── */

interface DatePickerFieldProps {
  /** Valeur au format dd/MM/yyyy */
  value: string;
  /** Retourne la valeur au format dd/MM/yyyy */
  onChange: (value: string) => void;
  readOnly?: boolean;
  required?: boolean;
  className?: string;
  label?: string;
  placeholder?: string;
  title?: string;
}

/* ── Composant ── */

const DatePickerField: React.FC<DatePickerFieldProps> = ({
  value,
  onChange,
  readOnly = false,
  required = false,
  className = '',
  label,
  placeholder,
  title,
}) => {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (readOnly) return;
      const raw = e.target.value; // yyyy-MM-dd depuis l'input HTML
      onChange(toDisplayDate(raw));
    },
    [onChange, readOnly]
  );

  const inputValue = toInputDate(value || '');

  return (
    <div className="relative">
      <input
        type="date"
        value={inputValue}
        onChange={handleChange}
        readOnly={readOnly}
        required={required}
        placeholder={placeholder}
        title={title}
        className={className}
      />
      {label && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 pointer-events-none select-none">
          {label}
        </span>
      )}
    </div>
  );
};

export default DatePickerField;
