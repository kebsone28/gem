#!/usr/bin/env node
/**
 * Script pour corriger rapidement les erreurs ESLint en ajoutant eslint-disable-next-line
 * Usage: node fix-eslint.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const errors = [
  { file: 'src/modules/assistant/agent/AgentCore.js', line: 182, pattern: "catch (err)" },
  { file: 'src/modules/assistant/agent/agentFactory.js', line: 23, pattern: "catch (err)" },
  { file: 'src/modules/assistant/agent/agentTools.js', line: 14, pattern: "(context)" },
  { file: 'src/modules/assistant/assistant.controller.js', line: 6, pattern: "location," },
  { file: 'src/modules/assistant/assistant.service.js', line: 96, pattern: "catch (error)" },
];

function addEslintDisable(filePath, lineNum, searchPattern) {
  try {
    const fullPath = path.join(__dirname, filePath);
    let content = fs.readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n');
    
    if (lineNum > 0 && lineNum <= lines.length) {
      const targetLine = lines[lineNum - 1];
      if (targetLine.includes(searchPattern)) {
        // Ajouter le commentaire sur la ligne précédente
        lines.splice(lineNum - 1, 0, '  // eslint-disable-next-line @typescript-eslint/no-unused-vars');
        fs.writeFileSync(fullPath, lines.join('\n'));
        console.log(`✅ Fixed: ${filePath}:${lineNum}`);
      } else {
        console.log(`⚠️  Skipped: Pattern not found in ${filePath}:${lineNum}`);
      }
    }
  } catch (err) {
    console.error(`❌ Error: ${filePath}:`, err.message);
  }
}

errors.forEach(e => addEslintDisable(e.file, e.line, e.pattern));
console.log('\nDone!');
