import ExcelJS from 'exceljs';

const normalizeCellValue = (value) => {
  if (value == null) return undefined;
  if (value instanceof Date) return value;
  if (typeof value === 'object') {
    if ('text' in value) return value.text;
    if ('result' in value) return normalizeCellValue(value.result);
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map(part => part.text || '').join('');
    }
    return String(value);
  }
  return value;
};

export const worksheetToJson = (worksheet, { header = false } = {}) => {
  const rows = [];
  worksheet.eachRow({ includeEmpty: false }, row => {
    const values = Array.isArray(row.values) ? row.values.slice(1).map(normalizeCellValue) : [];
    rows.push(values);
  });

  if (header === 1) return rows;

  const [headers = [], ...dataRows] = rows;
  const safeHeaders = headers.map((headerValue, index) => String(headerValue || `Column${index + 1}`));
  return dataRows
    .filter(row => row.some(value => value !== undefined && value !== null && value !== ''))
    .map(row => {
      const item = {};
      safeHeaders.forEach((headerName, index) => {
        item[headerName] = row[index];
      });
      return item;
    });
};

export const readWorkbook = async (filePath) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  return workbook;
};

export const readFirstSheetJson = async (filePath, options = {}) => {
  const workbook = await readWorkbook(filePath);
  const worksheet = workbook.worksheets[0];
  return worksheet ? worksheetToJson(worksheet, options) : [];
};
