#!/usr/bin/env node

const { copyAssets } = require('./copy-assets.cjs');

const command = process.argv[2];
const args = process.argv.slice(3);

async function main() {
    if (command === 'copy-assets') {
        await copyAssets(args[0]);
    } else {
        printHelp();
    }
}

function printHelp() {
    console.log('texlyre-busytex CLI\n');
    console.log('Usage:');
    console.log('  texlyre-busytex copy-assets [destination]\n');
    console.log('Commands:');
    console.log('  copy-assets [dest]  Copy BusyTeX WASM assets to destination');
    console.log('                      Default destination: ./public/core\n');
    console.log('Examples:');
    console.log('  texlyre-busytex copy-assets');
    console.log('  texlyre-busytex copy-assets ./static/wasm');
    console.log('  texlyre-busytex copy-assets ./public/my-assets');
}

main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});