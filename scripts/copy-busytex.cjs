const fs = require('fs');
const path = require('path');

const SOURCE_DIR = path.join(__dirname, '../public/core/busytex');
const DEST_DIR = path.join(__dirname, '../assets/core/busytex');

function copyBusyTexAssets() {
    console.log('Preparing package assets...');

    if (!fs.existsSync(SOURCE_DIR)) {
        console.log('⊘ Source directory not found, skipping asset preparation');
        console.log('  (This is normal in CI environments)');
        return;
    }

    const parentDir = path.dirname(DEST_DIR);
    if (fs.existsSync(DEST_DIR)) {
        fs.rmSync(DEST_DIR, { recursive: true, force: true });
    }

    if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
    }

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