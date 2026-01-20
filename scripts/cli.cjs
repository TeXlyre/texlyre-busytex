#!/usr/bin/env node

const { downloadAssets } = require('./download-assets.cjs');

const command = process.argv[2];
const args = process.argv.slice(3);

async function main() {
    if (command === 'download-assets') {
        await downloadAssets(args[0]);
    } else {
        printHelp();
    }
}

function printHelp() {
    console.log('texlyre-busytex CLI\n');
    console.log('Usage:');
    console.log('  texlyre-busytex download-assets [destination]\n');
    console.log('Commands:');
    console.log('  download-assets [dest]  Download BusyTeX assets from GitHub Releases');
    console.log('                          Default: ./public/core\n');
    console.log('Examples:');
    console.log('  texlyre-busytex download-assets');
    console.log('  texlyre-busytex download-assets ./static/wasm');
    console.log('  texlyre-busytex download-assets ./my-custom-path');
}

main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});