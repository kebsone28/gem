
const xlsx = require('xlsx');
const fs = require('fs');

const path = 'c:/Mes-Sites-Web/GEM_SAAS/archive/Liste/aEYZwPujJiFBTNb6mxMGCB.xlsx';

try {
    const workbook = xlsx.readFile(path);
    const surveySheet = workbook.Sheets['survey'];
    const survey = xlsx.utils.sheet_to_json(surveySheet);
    
    // Extract metadata including skip logic (relevant column)
    const logicMap = survey.filter(r => r.name).map(r => ({
        name: r.name,
        label: r.label,
        relevant: r.relevant, // THIS IS KEY
        type: r.type
    }));
    
    // Specifically look for OBSERVATIONS fields and their triggers
    const observations = logicMap.filter(r => r.name.toLowerCase().includes('observation'));
    
    console.log('Observation Logic Mapping:', JSON.stringify(observations, null, 2));

    // Also look for the earth resistance field
    const earth = logicMap.find(r => r.name.toLowerCase().includes('resistance_de_ter'));
    console.log('Earth Resistance Metadata:', JSON.stringify(earth, null, 2));

} catch (e) {
    console.error('Error:', e.message);
}
