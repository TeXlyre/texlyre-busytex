const fs = require('fs');
const path = require('path');

const SOURCE_DIR = path.join(__dirname, '../public/core');
const DEST_DIR = path.join(__dirname, '../assets/core');

function copyBusyTexAssets() {
    console.log('Preparing package assets...');

    if (!fs.existsSync(SOURCE_DIR)) {
        console.error(`Source directory not found: ${SOURCE_DIR}`);
        console.error('Please ensure public/ directory exists with BusyTeX assets');
        process.exit(1);
    }

    if (fs.existsSync(DEST_DIR)) {
        fs.rmSync(DEST_DIR, { recursive: true, force: true });
    }

    fs.mkdirSync(DEST_DIR, { recursive: true });

    copyRecursive(SOURCE_DIR, DEST_DIR);

    console.log('✓ Assets prepared for packaging');
}

function copyRecursive(src, dest) {
    const stats = fs.statSync(src);

    if (stats.isDirectory()) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }

        const entries = fs.readdirSync(src);
        for (const entry of entries) {
            copyRecursive(
                path.join(src, entry),
                path.join(dest, entry)
            );
        }
    } else {
        fs.copyFileSync(src, dest);
    }
}

if (require.main === module) {
    copyBusyTexAssets();
}

module.exports = { copyBusyTexAssets };