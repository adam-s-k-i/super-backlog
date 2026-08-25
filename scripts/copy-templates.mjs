import { cpSync, mkdirSync } from 'node:fs';
mkdirSync('dist/templates', { recursive: true });
cpSync('src/templates', 'dist/templates', { recursive: true });
console.log('copied src/templates -> dist/templates');
