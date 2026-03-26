export interface BusyTexConfig {
    busytexBasePath?: string;
    verbose?: boolean;
    engineMode?: EngineMode;
    preloadDataPackages?: string[];
    catalogDataPackages?: string[];
}

export type EngineMode = 'combined' | 'pdftex' | 'xetex' | 'luahbtex';

export interface CompileOptions {
    input: string;
    mainTexPath?: string;
    bibtex?: boolean;
    makeindex?: boolean;
    rerun?: boolean;
    verbose?: 'silent' | 'info' | 'debug';
    driver?: 'xetex_bibtex8_dvipdfmx' | 'pdftex_bibtex8' | 'luahbtex_bibtex8' | 'luatex_bibtex8';
    dataPackagesJs?: string[];
    additionalFiles?: FileInput[];
    remoteEndpoint?: string;
}

export interface FileInput {
    path: string;
    content: string | Uint8Array;
}

export interface TexliveRemoteFile {
    name: string;
    format?: number;
    content: Uint8Array | string;
}

export interface CompileResult {
    success: boolean;
    pdf?: Uint8Array;
    synctex?: Uint8Array;
    log: string;
    exitCode: number;
    logs: LogEntry[];
}

export interface LogEntry {
    cmd: string;
    texmflog: string;
    missfontlog: string;
    log: string;
    aux: string;
    stdout: string;
    stderr: string;
    exit_code: number;
}

export interface PdfLatexOptions extends CompileOptions { }
export interface XeLatexOptions extends CompileOptions { }
export interface LuaLatexOptions extends CompileOptions { }