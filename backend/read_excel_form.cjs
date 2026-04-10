
const xlsx = require('xlsx');
const fs = require('fs');

const path = 'c:/Mes-Sites-Web/GEM_SAAS/archive/Liste/aEYZwPujJiFBTNb6mxMGCB.xlsx';

try {
    const workbook = xlsx.readFile(path);
    console.log('Sheets:', workbook.SheetNames);
    
    const surveySheet = workbook.Sheets['survey'] || workbook.Sheets[workbook.SheetNames[0]];
    const survey = xlsx.utils.sheet_to_json(surveySheet);
    
    // Filter for rows with labels (real questions)
    const questions = survey.filter(r => r.label && r.name).map(r => ({
        name: r.name,
        label: r.label,
        type: r.type,
        hint: r.hint,
        required: r.required
    }));
    
    console.log('Questions:', JSON.stringify(questions, null, 2));

    const choicesSheet = workbook.Sheets['choices'];
    if (choicesSheet) {
        const choices = xlsx.utils.sheet_to_json(choicesSheet);
        console.log('Choices Sample:', JSON.stringify(choices.slice(0, 10), null, 2));
    }
} catch (e) {
    console.error('Error:', e.message);
}
