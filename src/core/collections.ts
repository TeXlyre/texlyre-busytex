import { CollectionDef, CollectionId } from './types';

export const COLLECTIONS: Record<CollectionId, CollectionDef> = {
    basic: { id: 'basic', label: 'TeX Live Basic', jsFile: 'texlive-basic.js', contains: [] },
    recommended: { id: 'recommended', label: 'TeX Live Recommended', jsFile: 'texlive-recommended.js', contains: ['basic'] },
    extra: { id: 'extra', label: 'TeX Live Extra', jsFile: 'texlive-extra.js', contains: ['recommended'] }
};

export function listCollections(): CollectionDef[] {
    return Object.values(COLLECTIONS);
}

export function expandTransitive(ids: CollectionId[]): Set<CollectionId> {
    const result = new Set<CollectionId>();
    const visit = (id: CollectionId) => {
        if (result.has(id)) return;
        const def = COLLECTIONS[id];
        if (!def) return;
        result.add(id);
        def.contains.forEach(visit);
    };
    ids.forEach(visit);
    return result;
}

export function subsume(ids: CollectionId[]): CollectionId[] {
    const selected = new Set(ids);
    const result: CollectionId[] = [];
    for (const id of selected) {
        const dominated = Array.from(selected).some(other =>
            other !== id && expandTransitive([other]).has(id)
        );
        if (!dominated) result.push(id);
    }
    return result;
}

export function collectionJsUrl(basePath: string, id: CollectionId): string {
    return `${basePath}/${COLLECTIONS[id].jsFile}`;
}

export function collectionDataUrl(basePath: string, id: CollectionId): string {
    return `${basePath}/${COLLECTIONS[id].jsFile.replace('.js', '.data')}`;
}

export function resolveSelection(basePath: string, ids: CollectionId[]): {
    preload: string[];
    catalog: string[];
} {
    const preload = subsume(ids).map(id => collectionJsUrl(basePath, id));
    const catalog = listCollections().map(c => collectionJsUrl(basePath, c.id));
    return { preload, catalog };
}