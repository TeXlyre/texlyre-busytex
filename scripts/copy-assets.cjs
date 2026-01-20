const fs = require('fs');
const path = require('path');

async function copyAssets(destination = './public/core') {
    const source = path.join(__dirname, '../assets/core');
    const dest = path.resolve(process.cwd(), destination);

    if (!fs.existsSync(source)) {
        throw new Error(`Source directory not found: ${source}`);
    }

    console.log(`Copying BusyTeX assets to ${dest}...`);

    try {
        await copyRecursive(source, dest);
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