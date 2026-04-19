const EM_CACHE_DB = 'EM_PRELOAD_CACHE';
const PACKAGES_STORE = 'PACKAGES';
const METADATA_STORE = 'METADATA';

function dataFileName(packageJsUrl: string): string {
    const name = packageJsUrl.split('/').pop() || '';
    return name.replace(/\.js$/, '.data');
}

function openEmCache(): Promise<IDBDatabase | null> {
    return new Promise(resolve => {
        if (typeof indexedDB === 'undefined') return resolve(null);
        const request = indexedDB.open(EM_CACHE_DB);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
        request.onupgradeneeded = () => {
            try { request.transaction?.abort(); } catch { }
            resolve(null);
        };
    });
}

async function findMetadataKey(db: IDBDatabase, dataFile: string): Promise<IDBValidKey | null> {
    if (!db.objectStoreNames.contains(METADATA_STORE)) return null;
    return await new Promise<IDBValidKey | null>(resolve => {
        const tx = db.transaction(METADATA_STORE, 'readonly');
        const req = tx.objectStore(METADATA_STORE).getAllKeys();
        req.onsuccess = () => {
            const keys = req.result as IDBValidKey[];
            const match = keys.find(k => String(k).endsWith(`/${dataFile}`));
            resolve(match ?? null);
        };
        req.onerror = () => resolve(null);
    });
}

export async function isPackageCached(packageJsUrl: string): Promise<boolean> {
    const db = await openEmCache();
    if (!db) return false;
    try {
        const key = await findMetadataKey(db, dataFileName(packageJsUrl));
        return key !== null;
    } finally {
        db.close();
    }
}

export async function deletePackageCache(packageJsUrl: string): Promise<void> {
    const db = await openEmCache();
    if (!db) return;
    const dataFile = dataFileName(packageJsUrl);

    try {
        const metadataKey = await findMetadataKey(db, dataFile);
        if (!metadataKey) return;

        const stores: string[] = [METADATA_STORE];
        if (db.objectStoreNames.contains(PACKAGES_STORE)) stores.push(PACKAGES_STORE);

        await new Promise<void>(resolve => {
            const tx = db.transaction(stores, 'readwrite');
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
            tx.onabort = () => resolve();

            tx.objectStore(METADATA_STORE).delete(metadataKey);

            if (stores.includes(PACKAGES_STORE)) {
                const pkgPrefix = String(metadataKey).replace(/^metadata\//, 'package/');
                const store = tx.objectStore(PACKAGES_STORE);
                const cursorReq = store.openKeyCursor();
                cursorReq.onsuccess = () => {
                    const cursor = cursorReq.result;
                    if (!cursor) return;
                    const k = String(cursor.key);
                    if (k.startsWith(pkgPrefix + '/')) store.delete(cursor.key);
                    cursor.continue();
                };
            }
        });
    } finally {
        db.close();
    }
}

export async function clearAllPackageCache(): Promise<void> {
    if (typeof indexedDB === 'undefined') return;
    await new Promise<void>(resolve => {
        const req = indexedDB.deleteDatabase(EM_CACHE_DB);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
    });
}