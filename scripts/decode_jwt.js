const t = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjAyMGI5ZWJhLTU1Y2EtNGM1NC04ZTU1LTYwNWQ1NDk5M2NlMiIsImVtYWlsIjoiYWRtaW5nZW0iLCJvcmdhbml6YXRpb25JZCI6ImMwYjE4MzYxLTQ0MWMtNDNlZi1iNGU2LTcyMTMwZWZjNTIxZSIsInJvbGUiOiJBRE1JTl9QUk9RVUVMRUMiLCJwZXJtaXNzaW9ucyI6W10sImlhdCI6MTc3NzEzNjk4NCwiZXhwIjoxNzc3MTM3ODg0fQ.YkGUn26pWwYW0FW1ecKNrChTNnHcaq4ruUnQGEn1wt4';
const [h,p] = t.split('.');
const dec = s => Buffer.from(s.replace(/-/g,'+').replace(/_/g,'/'), 'base64').toString('utf8');
console.log('HEADER:\n' + dec(h));
console.log('\nPAYLOAD:\n' + dec(p));
