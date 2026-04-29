import ExcelJS from 'exceljs';

type CellValue = string | number | boolean | Date | null | undefined;
type SheetRow = CellValue[];

interface SafeWorksheet {
  rows: SheetRow[];
  [key: string]: unknown;
}

interface SafeWorkbook {
  SheetNames: string[];
  Sheets: Record<string, SafeWorksheet>;
}

function normalizeCellValue(value: ExcelJS.CellValue): CellValue {
  if (value == null) return undefined;
  if (value instanceof Date) return value;
  if (typeof value === 'object') {
    if ('text' in value && typeof value.text === 'string') return value.text;
    if ('result' in value) return normalizeCellValue(value.result as ExcelJS.CellValue);
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map(part => part.text || '').join('');
    }
    if ('hyperlink' in value && 'text' in value) return String(value.text || value.hyperlink || '');
    return String(value);
  }
  return value;
}

function binaryStringToArrayBuffer(binary: string): ArrayBuffer {
  const buffer = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i += 1) {
    view[i] = binary.charCodeAt(i) & 0xff;
  }
  return buffer;
}

function collectJsonHeaders(rows: Record<string, unknown>[]): string[] {
  const headers = new Set<string>();
  rows.forEach(row => Object.keys(row || {}).forEach(key => headers.add(key)));
  return Array.from(headers);
}

export const utils = {
  book_new(): SafeWorkbook {
    return { SheetNames: [], Sheets: {} };
  },

  book_append_sheet(workbook: SafeWorkbook, worksheet: SafeWorksheet, name: string): void {
    const safeName = name || `Sheet${workbook.SheetNames.length + 1}`;
    workbook.SheetNames.push(safeName);
    workbook.Sheets[safeName] = worksheet;
  },

  json_to_sheet(data: Record<string, unknown>[]): SafeWorksheet {
    const rows = Array.isArray(data) ? data : [];
    const headers = collectJsonHeaders(rows);
    return {
      rows: [
        headers,
        ...rows.map(row => headers.map(header => row?.[header] as CellValue)),
      ],
    };
  },

  aoa_to_sheet(rows: SheetRow[]): SafeWorksheet {
    return { rows: Array.isArray(rows) ? rows : [] };
  },

  sheet_to_json<T = Record<string, unknown>>(
    worksheet: SafeWorksheet,
    options: { header?: 1 } = {}
  ): T[] {
    const rows = worksheet?.rows || [];
    if (options.header === 1) return rows as T[];
    const [headerRow = [], ...dataRows] = rows;
    const headers = headerRow.map((header, index) => String(header || `Column${index + 1}`));

    return dataRows
      .filter(row => row.some(value => value !== undefined && value !== null && value !== ''))
      .map(row => {
        const item: Record<string, CellValue> = {};
        headers.forEach((header, index) => {
          item[header] = row[index];
        });
        return item as T;
      });
  },
};

export async function read(
  input: ArrayBuffer | Uint8Array | string,
  options: { type?: 'array' | 'binary' } = {}
): Promise<SafeWorkbook> {
  const workbook = new ExcelJS.Workbook();
  const buffer =
    typeof input === 'string'
      ? binaryStringToArrayBuffer(input)
      : input instanceof Uint8Array
        ? input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength)
        : input;

  await workbook.xlsx.load(buffer as any);

  const safeWorkbook: SafeWorkbook = { SheetNames: [], Sheets: {} };
  workbook.worksheets.forEach(sheet => {
    const rows: SheetRow[] = [];
    sheet.eachRow({ includeEmpty: false }, row => {
      const values = Array.isArray(row.values) ? row.values.slice(1) : [];
      rows.push(values.map(value => normalizeCellValue(value as ExcelJS.CellValue)));
    });
    utils.book_append_sheet(safeWorkbook, { rows }, sheet.name);
  });

  void options;
  return safeWorkbook;
}

export async function writeFile(workbook: SafeWorkbook, filename: string): Promise<void> {
  const excelWorkbook = new ExcelJS.Workbook();

  workbook.SheetNames.forEach(name => {
    const sourceSheet = workbook.Sheets[name];
    const targetSheet = excelWorkbook.addWorksheet(name);
    (sourceSheet?.rows || []).forEach(row => targetSheet.addRow(row));
  });

  const buffer = await excelWorkbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
