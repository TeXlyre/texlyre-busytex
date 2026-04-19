export type CollectionId = 'basic' | 'recommended' | 'extra';

export interface CollectionDef {
    id: CollectionId;
    label: string;
    jsFile: string;
    contains: CollectionId[];
}

export const COLLECTIONS: Record<CollectionId, CollectionDef> = {
    basic: { id: 'basic', label: 'TeX Live Basic (~90 MB)', jsFile: 'texlive-basic.js', contains: [] },
    recommended: { id: 'recommended', label: 'TeX Live Recommended (~ 200 MB)', jsFile: 'texlive-recommended.js', contains: ['basic'] },
    extra: { id: 'extra', label: 'TeX Live Extra (~340 MB)', jsFile: 'texlive-extra.js', contains: ['recommended'] }
};

export function listCollections(): CollectionDef[] {
    return Object.values(COLLECTIONS);
}

function expandTransitive(ids: CollectionId[]): Set<CollectionId> {
    const result = new Set<CollectionId>();
    const visit = (id: CollectionId) => {
        if (result.has(id)) return;
        result.add(id);
        COLLECTIONS[id].contains.forEach(visit);
    };
    ids.forEach(visit);
    return result;
}

export function subsume(ids: CollectionId[]): CollectionId[] {
    const selected = new Set(ids);
    return Array.from(selected).filter(id =>
        !Array.from(selected).some(other => other !== id && expandTransitive([other]).has(id))
    );
}

export function collectionJsUrl(basePath: string, id: CollectionId): string {
    return `${basePath}/${COLLECTIONS[id].jsFile}`;
}

export function resolvePreload(basePath: string, ids: CollectionId[]): string[] {
    return subsume(ids).map(id => collectionJsUrl(basePath, id));
}