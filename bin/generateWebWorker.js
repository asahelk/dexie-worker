#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import esbuild from 'esbuild';
import {readFile} from 'fs/promises';

(async () => {
  const args = process.argv.slice(2);
  const operationsPath = args[0];
  let dexieVersion = args[1];

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const packageDexieWorkerPath = path.resolve(__dirname, '..', 'dist', 'dexieWorker.js');
  const publicFilderExists = fs.existsSync(path.resolve(process.cwd(), 'public'));
  const destDexieWorkerPath = publicFilderExists
    ? path.resolve(process.cwd(), 'public', 'dexieWorker.js')
    : path.resolve(process.cwd(), 'dexieWorker.js');

  // Create a temporary entry file that imports dexieWorker.js and operations.js
  const tempEntryFile = path.resolve(process.cwd(), 'tempDexieWorkerEntry.js');

  let entryFileContent = '';

  // Import the operations module if provided
  if (operationsPath) {
    const operationsFullPath = path.resolve(process.cwd(), operationsPath);

    const operationsImportPath = operationsFullPath.replace(/\\/g, '/');

    entryFileContent += `import operationsModule from '${operationsImportPath}';\n`;
    entryFileContent += `const operations = operationsModule.default || operationsModule;\n`;
  } else {
    entryFileContent += `const operations = [];\n`;
  }

  // Import dexieWorker.js content
  let dexieWorkerContent = fs.readFileSync(packageDexieWorkerPath, 'utf-8');

  // Retrieve Dexie version from the package.json
  if (!dexieVersion) {
    try {
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      const data = await readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(data);
      dexieVersion = packageJson.dependencies?.dexie || packageJson.devDependencies?.dexie;
    } catch (e) {
      console.log(e)
      // package.json retrieval error
    }
  }

  // Replace the detected version with the default version
  if (dexieVersion) {
    dexieWorkerContent = dexieWorkerContent.replace(`3.2.2`, dexieVersion.replace(/[\^v~*xX><=\-\|\&\s]/g, ''))
  }

  entryFileContent += dexieWorkerContent;

  // Write the entry file
  fs.writeFileSync(tempEntryFile, entryFileContent);

  // Bundle the entry file
  const result = await esbuild.build({
    entryPoints: [tempEntryFile],
    bundle: true,
    write: false,
    format: 'iife', // Use IIFE to produce a self-contained script
    platform: 'browser',
    target: ['es2018'],
    loader: {'.js': 'js'},
  });

  // Get the bundled code
  const bundledCode = result.outputFiles[0].text;

  // Write the final dexieWorker.js
  fs.writeFileSync(destDexieWorkerPath, bundledCode);

  // Clean up the temporary entry file
  fs.unlinkSync(tempEntryFile);

  console.log(`dexieWorker.js generated successfully${publicFilderExists ? ' at /public/dexieWorker.js' : ''}.`);
})();
