import { fileURLToPath } from 'url';
console.log('--- Path Discovery ---');
console.log('import.meta.url:', import.meta.url);
console.log('fileURLToPath(import.meta.url):', fileURLToPath(import.meta.url));
console.log('process.cwd():', process.cwd());
