
const ExcelJS = require('exceljs');

const path = 'c:/Mes-Sites-Web/GEM_SAAS/archive/Liste/aEYZwPujJiFBTNb6mxMGCB.xlsx';

const worksheetToJson = (worksheet) => {
    const rows = [];
    worksheet.eachRow({ includeEmpty: false }, row => rows.push(row.values.slice(1)));
    const [headers = [], ...dataRows] = rows;
    return dataRows.map(row => Object.fromEntries(headers.map((header, index) => [header, row[index]])));
};

(async () => {
try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(path);
    console.log('Sheets:', workbook.worksheets.map(sheet => sheet.name));
    
    const surveySheet = workbook.getWorksheet('survey') || workbook.worksheets[0];
    const survey = worksheetToJson(surveySheet);
    
    // Filter for rows with labels (real questions)
    const questions = survey.filter(r => r.label && r.name).map(r => ({
        name: r.name,
        label: r.label,
        type: r.type,
        hint: r.hint,
        required: r.required
    }));
    
    console.log('Questions:', JSON.stringify(questions, null, 2));

    const choicesSheet = workbook.getWorksheet('choices');
    if (choicesSheet) {
        const choices = worksheetToJson(choicesSheet);
        console.log('Choices Sample:', JSON.stringify(choices.slice(0, 10), null, 2));
    }
} catch (e) {
    console.error('Error:', e.message);
}
})();
