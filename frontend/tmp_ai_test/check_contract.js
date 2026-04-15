const query = 'cahier de charge';
const q = query
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9\s]/g, '')
  .trim();
console.log(q);
console.log(q.includes('cahier de charge'));
