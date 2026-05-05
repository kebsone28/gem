import fs from 'fs';

const data = JSON.parse(fs.readFileSync('kobo_form.json', 'utf8'));

// Extract full path names for all fields
function extractFields(survey) {
  let fields = [];
  let groupStack = [];
  
  for (const row of survey) {
    if (row.type === 'begin_group') {
      groupStack.push(row.name);
    } else if (row.type === 'end_group') {
      groupStack.pop();
    } else {
      const prefix = groupStack.length > 0 ? groupStack.join('/') + '/' : '';
      fields.push({
        type: row.type,
        originalName: row.name,
        fullName: prefix + row.name,
        label: row.label?.[0] || row.label
      });
    }
  }
  return fields;
}

const fields = extractFields(data.content?.survey || []);
fs.writeFileSync('kobo_fields_mapped.json', JSON.stringify(fields, null, 2));
console.log('Saved to kobo_fields_mapped.json');
