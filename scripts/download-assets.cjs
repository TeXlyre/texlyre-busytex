const fs = require('fs');
const path = require('path');
const https = require('https');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const packageJson = require('../package.json');
const VERSION = `v${packageJson.version}`;
const REPO = 'TeXlyre/texlyre-busytex';
const RELEASE_TAG = `assets-${VERSION}`;
const ARCHIVE_NAME = 'busytex-assets.tar.gz';
const DOWNLOAD_URL = `https://github.com/${REPO}/releases/download/${RELEASE_TAG}/${ARCHIVE_NAME}`;

async function downloadAssets(destination = './public/core') {
    const dest = path.resolve(process.cwd(), destination);
    const busytexDir = path.join(dest, 'busytex');

    if (fs.existsSync(busytexDir) && fs.readdirSync(busytexDir).length > 0) {
        console.log('✓ BusyTeX assets already exist');
        return;
    }

    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    const archivePath = path.join(dest, ARCHIVE_NAME);

    console.log('Downloading BusyTeX assets from GitHub Releases...');
    console.log(`Version: ${VERSION}`);
    console.log(`Release: ${RELEASE_TAG}\n`);

    await downloadFile(DOWNLOAD_URL, archivePath);
    await extractArchive(archivePath, dest);

    fs.unlinkSync(archivePath);
    console.log('\n✓ BusyTeX assets ready');
}

function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destPath);

        const request = https.get(url, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                file.close();
                fs.unlinkSync(destPath);

                https.get(response.headers.location, (redirectResponse) => {
                    const totalBytes = parseInt(redirectResponse.headers['content-length'] || '0', 10);
                    let downloadedBytes = 0;

                    console.log(`Downloading ${ARCHIVE_NAME}...`);

                    redirectResponse.on('data', (chunk) => {
                        downloadedBytes += chunk.length;
                        if (totalBytes > 0) {
                            const percent = ((downloadedBytes / totalBytes) * 100).toFixed(1);
                            const mb = (downloadedBytes / 1024 / 1024).toFixed(2);
                            const totalMb = (totalBytes / 1024 / 1024).toFixed(2);
                            process.stdout.write(`\rProgress: ${percent}% (${mb}/${totalMb} MB)`);
                        }
                    });

                    const newFile = fs.createWriteStream(destPath);
                    redirectResponse.pipe(newFile);

                    newFile.on('finish', () => {
                        newFile.close();
                        if (totalBytes > 0) process.stdout.write('\n');
                        console.log('✓ Download complete');
                        resolve();
                    });

                    newFile.on('error', (err) => {
                        fs.unlink(destPath, () => { });
                        reject(err);
                    });
                });
            } else if (response.statusCode === 200) {
                const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
                let downloadedBytes = 0;

                console.log(`Downloading ${ARCHIVE_NAME}...`);

                response.on('data', (chunk) => {
                    downloadedBytes += chunk.length;
                    if (totalBytes > 0) {
                        const percent = ((downloadedBytes / totalBytes) * 100).toFixed(1);
                        const mb = (downloadedBytes / 1024 / 1024).toFixed(2);
                        const totalMb = (totalBytes / 1024 / 1024).toFixed(2);
                        process.stdout.write(`\rProgress: ${percent}% (${mb}/${totalMb} MB)`);
                    }
                });

                response.pipe(file);

                file.on('finish', () => {
                    file.close();
                    if (totalBytes > 0) process.stdout.write('\n');
                    console.log('✓ Download complete');
                    resolve();
                });
            } else {
                file.close();
                fs.unlink(destPath, () => { });
                reject(new Error(`Download failed: HTTP ${response.statusCode}`));
            }
        });

        request.on('error', (err) => {
            file.close();
            fs.unlink(destPath, () => { });
            reject(err);
        });
    });
}

async function extractArchive(archivePath, destDir) {
    console.log('Extracting assets...');

    try {
        const tar = require('tar');
        await tar.x({
            file: archivePath,
            cwd: destDir
        });
        console.log('✓ Extraction complete');
    } catch (err) {
        if (process.platform === 'win32') {
            await execAsync(`tar -xzf "${archivePath}" -C "${destDir}"`);
        } else {
            await execAsync(`tar -xzf "${archivePath}" -C "${destDir}"`);
        }
        console.log('✓ Extraction complete');
    }
}

if (require.main === module) {
    const dest = process.argv[2];
    downloadAssets(dest).catch(err => {
        console.error('\n✗ Download failed:', err.message);
        console.error('\nPlease ensure:');
        console.error(`1. Release ${RELEASE_TAG} exists`);
        console.error('2. Archive is uploaded to the release');
        console.error('3. You have internet connection');
        process.exit(1);
    });
}

module.exports = { downloadAssets };