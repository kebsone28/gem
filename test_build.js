const { build } = require('vite');
const path = require('path');

async function main() {
  try {
    const result = await build({
      root: path.resolve(__dirname, 'frontend'),
      configFile: path.resolve(__dirname, 'frontend/vite.config.ts'),
      build: {
        lib: false,
        outDir: 'dist-test',
        write: false,
      },
      logLevel: 'error',
    });
    console.log('BUILD SUCCESS');
  } catch (err) {
    console.error('BUILD FAILED:', err.message);
    if (err.errors) {
      err.errors.forEach(e => console.error(e.message));
    }
  }
}

main();
