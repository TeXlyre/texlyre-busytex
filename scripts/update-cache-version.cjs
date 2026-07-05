const fs = require('fs');
const path = require('path');

const packageJson = require('../package.json');
const [major, minor] = packageJson.version.split('.');
const outputPath = path.join(__dirname, '../src/core/version.ts');

fs.writeFileSync(outputPath, `export const PACKAGE_VERSION = '${major}.${minor}';\n`);