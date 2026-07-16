// Minimal type check for carto_grappes
const ts = require('typescript');
const fs = require('fs');
const path = require('path');

try {
  const cfgPath = path.resolve(__dirname, 'frontend/tsconfig.app.json');
  const cfgFile = ts.readConfigFile(cfgPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(
    cfgFile.config,
    ts.sys,
    path.resolve(__dirname, 'frontend')
  );
  const cartoFiles = parsed.fileNames.filter((f) => f.includes('carto_grappes'));

  const program = ts.createProgram(cartoFiles, {
    ...parsed.options,
    noEmit: true,
    skipLibCheck: true,
    moduleDetection: ts.ModuleDetectionKind.Force,
  });

  const allDiags = ts.getPreEmitDiagnostics(program);
  const cartoDiags = allDiags.filter((d) => d.file && d.file.fileName.includes('carto_grappes'));

  const output = [];
  for (const d of cartoDiags) {
    const loc = ts.getLineAndCharacterOfPosition(d.file, d.start);
    const relPath = d.file.fileName.replace(/.*carto_grappes/, 'carto_grappes');
    const msg = ts.flattenDiagnosticMessageText(d.messageText, '\n').split('\n')[0];
    output.push(`${relPath}:${loc.line + 1}: ${msg}`);
  }

  fs.writeFileSync('type_errors.txt', output.join('\n') || 'NO ERRORS');
} catch (err) {
  fs.writeFileSync('type_errors.txt', 'SCRIPT ERROR: ' + err.message);
}
