const fs = require('fs');
const path = require('path');

async function copyAssets(destination = './public/core') {
    const publicSource = path.join(__dirname, '../public/core/busytex');
    const assetsSource = path.join(__dirname, '../assets/core/busytex');

    let source = publicSource;
    if (!fs.existsSync(publicSource) && fs.existsSync(assetsSource)) {
        source = assetsSource;
        console.log('Using assets directory (public not found)');
    }

    if (!fs.existsSync(source)) {
        console.error('No source directory found.');
        console.log('Run: npm run download-assets');
        process.exit(1);
    }

    const dest = path.resolve(process.cwd(), destination);
    const busytexDest = path.join(dest, 'busytex');

    console.log(`Copying BusyTeX assets to ${busytexDest}...`);

    try {
        await copyRecursive(source, busytexDest);
        console.log('✓ Assets copied successfully\n');
        printConfiguration(destination);
    } catch (error) {
        throw new Error(`Failed to copy assets: ${error.message}`);
    }
}

async function copyRecursive(src, dest) {
    const stats = fs.statSync(src);

    if (stats.isDirectory()) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }

        const entries = fs.readdirSync(src);
        for (const entry of entries) {
            await copyRecursive(path.join(src, entry), path.join(dest, entry));
        }
    } else {
        fs.copyFileSync(src, dest);
    }
}

function getWebPath(fsPath) {
    const normalized = fsPath.replace(/\\/g, '/');
    const match = normalized.match(/\/?(?:public|static)?\/?(.+)$/);
    return '/' + (match ? match[1] : normalized.replace(/^\.\//, ''));
}

function printConfiguration(destination) {
    const webPath = getWebPath(destination);

    console.log('Configure BusyTexRunner with:');
    console.log('');
    console.log('new BusyTexRunner({');
    console.log(`  busytexBasePath: '${webPath}/busytex'`);
    console.log('});');
}

module.exports = { copyAssets };