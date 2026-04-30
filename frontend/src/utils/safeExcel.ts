import readExcelFile from 'read-excel-file/browser';
import writeExcelFile from 'write-excel-file/browser';

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

function normalizeCellValue(value: unknown): CellValue {
  if (value == null) return undefined;
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'object') {
    if ('text' in value && typeof value.text === 'string') return value.text;
    if ('result' in value) return normalizeCellValue(value.result);
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText
        .map(part => (typeof part === 'object' && part && 'text' in part ? part.text || '' : ''))
        .join('');
    }
    if ('hyperlink' in value && 'text' in value) return String(value.text || value.hyperlink || '');
    return String(value);
  }
  return undefined;
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
  const buffer =
    typeof input === 'string'
      ? binaryStringToArrayBuffer(input)
      : input instanceof Uint8Array
        ? input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength)
        : input;

  const sheets = await readExcelFile(buffer as ArrayBuffer);

  const safeWorkbook: SafeWorkbook = { SheetNames: [], Sheets: {} };
  sheets.forEach(sheet => {
    const rows = (sheet.data || []).map(row => row.map(normalizeCellValue));
    utils.book_append_sheet(safeWorkbook, { rows }, sheet.sheet);
  });

  void options;
  return safeWorkbook;
}

export async function writeFile(workbook: SafeWorkbook, filename: string): Promise<void> {
  const sheets = workbook.SheetNames.map(name => ({
    data: workbook.Sheets[name]?.rows || [],
    sheet: name || 'Sheet1',
  }));

  if (sheets.length <= 1) {
    const [sheet = { data: [], sheet: 'Sheet1' }] = sheets;
    await writeExcelFile(sheet.data, { sheet: sheet.sheet, dateFormat: 'dd/mm/yyyy' }).toFile(
      filename
    );
    return;
  }

  await writeExcelFile(sheets).toFile(filename);
}
