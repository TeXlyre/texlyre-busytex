// src/core/busytex-runner.ts
import { Logger } from '../utils/logger';
import { ErrorHandler } from '../utils/error-handler';
import { BusyTexConfig, CompileResult, DownloadProgress, FileInput, TexliveRemoteFile } from './types';
import { isPackageCached, deletePackageCache, clearAllPackageCache, ensureCacheVersion } from './package-cache';

const DOWNLOAD_PROGRESS_PATTERN = /^(?:Preparing|Downloading data)\.\.\. \((\d+)\/(\d+)\)$/;

function parseDownloadProgress(message: string): DownloadProgress | null {
    if (message === 'All downloads complete.') return { loaded: 1, total: 1, percent: 100 };
    const match = DOWNLOAD_PROGRESS_PATTERN.exec(message);
    if (!match) return null;
    const loaded = Number(match[1]);
    const total = Number(match[2]);
    return { loaded, total, percent: total > 0 ? Math.round((loaded / total) * 100) : 0 };
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export class BusyTexRunner {
    private config: Required<BusyTexConfig>;
    private logger: Logger;
    private initialized: boolean = false;
    private worker: Worker | null = null;
    private busytexPipeline: any = null;

    constructor(config: BusyTexConfig = {}) {
        this.config = {
            busytexBasePath: config.busytexBasePath || '/core/busytex',
            verbose: config.verbose ?? false,
            engineMode: config.engineMode ?? 'combined',
            preloadDataPackages: config.preloadDataPackages ?? [],
            catalogDataPackages: config.catalogDataPackages ?? [],
            initRetries: config.initRetries ?? 2,
            initRetryDelayMs: config.initRetryDelayMs ?? 1500,
            onDownloadProgress: config.onDownloadProgress ?? (() => { })
        };
        this.logger = new Logger(this.config.verbose);
    }

    async initialize(useWorker: boolean = true): Promise<void> {
        if (this.initialized) return;

        await ensureCacheVersion();
        this.logger.info('Initializing BusyTeX...');

        const maxAttempts = this.config.initRetries + 1;
        let lastError: unknown;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                if (useWorker) {
                    await this.initializeWorker();
                } else {
                    await this.initializeDirect();
                }
                this.initialized = true;
                this.logger.info('BusyTeX initialized successfully');
                return;
            } catch (error) {
                lastError = error;
                this.terminate();
                if (attempt === maxAttempts) break;

                await this.clearPreloadDataPackageCache();
                this.logger.debug(`BusyTeX initialization attempt ${attempt} failed, retrying...`, error);
                await delay(this.config.initRetryDelayMs * attempt);
            }
        }

        throw ErrorHandler.handle(lastError, 'Failed to initialize BusyTeX');
    }

    private async clearPreloadDataPackageCache(): Promise<void> {
        for (const packageUrl of this.config.preloadDataPackages) {
            try {
                await deletePackageCache(packageUrl);
            } catch (error) {
                this.logger.debug(`Failed to clear preload data package cache for ${packageUrl}`, error);
            }
        }
    }

    private async initializeWorker(): Promise<void> {
        return new Promise((resolve, reject) => {
            const workerPath = `${this.config.busytexBasePath}/busytex_worker.js`;
            this.worker = new Worker(workerPath);

            let settled = false;
            let timeout: ReturnType<typeof setTimeout>;

            const settle = (callback: () => void): void => {
                if (settled) return;
                settled = true;
                clearTimeout(timeout);
                callback();
            };

            const resetTimeout = (): void => {
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    settle(() => reject(new Error('Timeout waiting for BusyTeX worker to initialize')));
                }, 120000);
            };

            resetTimeout();

            this.worker.onmessage = ({ data }) => {
                if (settled) return;

                if (data.initialized) {
                    settle(() => {
                        this.logger.debug('BusyTeX worker initialized:', data.initialized);
                        resolve();
                    });
                } else if (data.exception) {
                    settle(() => reject(new Error(data.exception)));
                } else if (data.print) {
                    if (this.reportDownloadProgress(data.print)) resetTimeout();
                }
            };

            this.worker.onerror = (error) => {
                error.preventDefault();
                settle(() => reject(new Error('BusyTeX worker failed to initialize')));
            };

            const { jsFile, wasmFile } = this.getEngineAssetNames();
            const busytexJs = `${this.config.busytexBasePath}/${jsFile}`;
            const busytexWasm = `${this.config.busytexBasePath}/${wasmFile}`;

            this.worker.postMessage({
                busytex_js: busytexJs,
                busytex_wasm: busytexWasm,
                preload_data_packages_js: this.config.preloadDataPackages,
                data_packages_js: this.config.catalogDataPackages,
                texmf_local: [],
                preload: true
            });
        });
    }

    private async initializeDirect(): Promise<void> {
        const pipelineScript = `${this.config.busytexBasePath}/busytex_pipeline.js`;

        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = pipelineScript;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });

        const BusytexPipeline = (window as any).BusytexPipeline;
        const { jsFile, wasmFile } = this.getEngineAssetNames();
        const busytexJs = `${this.config.busytexBasePath}/${jsFile}`;
        const busytexWasm = `${this.config.busytexBasePath}/${wasmFile}`;

        this.busytexPipeline = new BusytexPipeline(
            busytexJs,
            busytexWasm,
            this.config.preloadDataPackages,
            this.config.catalogDataPackages,
            [],
            (msg: string) => { this.logger.debug(msg); this.reportDownloadProgress(msg); },
            (versions: any) => this.logger.debug('Applet versions:', versions),
            true,
            BusytexPipeline.ScriptLoaderDocument
        );

        await this.busytexPipeline.on_initialized_promise;
    }

    private reportDownloadProgress(message: string): DownloadProgress | null {
        const progress = parseDownloadProgress(message);
        if (progress) this.config.onDownloadProgress(progress);
        return progress;
    }

    private getEngineAssetNames(): { jsFile: string; wasmFile: string } {
        const mode = this.config.engineMode;
        if (mode === 'combined') {
            return { jsFile: 'busytex.js', wasmFile: 'busytex.wasm' };
        }
        return { jsFile: `${mode}.js`, wasmFile: `${mode}.wasm` };
    }

    private convertFilesToBusyTexFormat(files: FileInput[]): any[] {
        return files.map(f => ({
            path: f.path,
            contents: f.content
        }));
    }

    async compile(
        files: FileInput[],
        mainTexPath: string,
        bibtex: boolean | null = null,
        makeindex: boolean | null = null,
        rerun: boolean | null = null,
        verbose: 'silent' | 'info' | 'debug' = 'silent',
        driver: 'xetex_bibtex8_dvipdfmx' | 'pdftex_bibtex8' | 'luahbtex_bibtex8' | 'luatex_bibtex8' = 'xetex_bibtex8_dvipdfmx',
        dataPackagesJs: string[] | null = null,
        remoteEndpoint?: string,
        shellEscape: boolean = false,
        shellHandlerScripts: string[] = []
    ): Promise<CompileResult> {
        if (!this.initialized) {
            throw new Error('BusyTeX not initialized. Call initialize() first.');
        }

        this.logger.info(`Compiling ${mainTexPath}...`);

        const busytexFiles = this.convertFilesToBusyTexFormat(files);

        if (this.worker) {
            return this.compileWithWorker(busytexFiles, mainTexPath, bibtex, makeindex, rerun, verbose, driver, dataPackagesJs, remoteEndpoint, shellEscape, shellHandlerScripts);
        } else {
            return this.compileDirect(busytexFiles, mainTexPath, bibtex, makeindex, rerun, verbose, driver, dataPackagesJs, remoteEndpoint, shellEscape);
        }
    }

    private async compileWithWorker(
        files: any[],
        mainTexPath: string,
        bibtex: boolean | null,
        makeindex: boolean | null = null,
        rerun: boolean | null = null,
        verbose: string,
        driver: string,
        dataPackagesJs: string[] | null,
        remoteEndpoint?: string,
        shellEscape: boolean = false,
        shellHandlerScripts: string[] = []
    ): Promise<CompileResult> {
        return new Promise((resolve, reject) => {
            if (!this.worker) {
                reject(new Error('Worker not initialized'));
                return;
            }

            const timeout = setTimeout(() => {
                reject(new Error('Compilation timeout'));
            }, 180000);

            const startCompile = () => {
                this.worker!.postMessage({
                    files,
                    main_tex_path: mainTexPath,
                    bibtex,
                    verbose,
                    driver,
                    data_packages_js: dataPackagesJs,
                    remote_endpoint: remoteEndpoint,
                    makeindex,
                    rerun,
                    shell_escape: shellEscape
                });
            };

            let loadedHandlerScripts = 0;
            const expectedHandlerScripts = shellHandlerScripts.length;

            this.worker.onmessage = ({ data }) => {
                if (data.print) {
                    this.logger.debug(data.print);
                    this.reportDownloadProgress(data.print);
                } else if (data.shell_handler_script_loaded !== undefined) {
                    loadedHandlerScripts++;
                    if (loadedHandlerScripts === expectedHandlerScripts) {
                        startCompile();
                    }
                } else if (data.pdf !== undefined) {
                    clearTimeout(timeout);
                    resolve({
                        success: data.exit_code === 0,
                        pdf: data.pdf,
                        synctex: data.synctex,
                        log: data.log,
                        exitCode: data.exit_code,
                        logs: data.logs
                    });
                } else if (data.exception) {
                    clearTimeout(timeout);
                    reject(new Error(data.exception));
                }
            };

            if (expectedHandlerScripts > 0) {
                for (const script of shellHandlerScripts) {
                    this.worker.postMessage({ load_shell_handler_script: script });
                }
            } else {
                startCompile();
            }
        });
    }

    private async compileDirect(
        files: any[],
        mainTexPath: string,
        bibtex: boolean | null,
        makeindex: boolean | null = null,
        rerun: boolean | null = null,
        verbose: string,
        driver: string,
        dataPackagesJs: string[] | null,
        remoteEndpoint?: string,
        shellEscape: boolean = false,
    ): Promise<CompileResult> {
        const result = await this.busytexPipeline.compile(
            files,
            mainTexPath,
            bibtex,
            makeindex,
            rerun,
            verbose,
            driver,
            dataPackagesJs,
            remoteEndpoint,
            shellEscape
        );

        return {
            success: result.exit_code === 0,
            pdf: result.pdf,
            synctex: result.synctex,
            log: result.log,
            exitCode: result.exit_code,
            logs: result.logs
        };
    }

    async readProjectFiles(dir?: string): Promise<FileInput[]> {
        if (this.worker) {
            return new Promise((resolve, reject) => {
                this.worker!.onmessage = ({ data }) => {
                    if (data.project_files !== undefined) resolve(data.project_files.map((f: any) => ({ path: f.path, content: f.contents })));
                    else if (data.exception) reject(new Error(data.exception));
                };
                this.worker!.postMessage({ read_project_files: dir ? { dir } : true });
            });
        }
        const files = await this.busytexPipeline.read_project_files(dir ?? null);
        return files.map((f: any) => ({ path: f.path, content: f.contents }));
    }

    async writeTexliveRemoteFiles(files: TexliveRemoteFile[]): Promise<void> {
        const payload = files.map(f => ({ name: f.name, format: f.format, contents: f.content }));
        if (this.worker) {
            return new Promise((resolve, reject) => {
                this.worker!.onmessage = ({ data }) => {
                    if (data.texlive_remote_written) resolve();
                    else if (data.exception) reject(new Error(data.exception));
                };
                this.worker!.postMessage({ write_texlive_remote_files: payload });
            });
        }
        await this.busytexPipeline.write_texlive_remote_files(payload);
    }

    async writeTexliveRemoteMisses(keys: string[]): Promise<void> {
        if (this.worker) {
            return new Promise((resolve, reject) => {
                this.worker!.onmessage = ({ data }) => {
                    if (data.texlive_remote_misses_written) resolve();
                    else if (data.exception) reject(new Error(data.exception));
                };
                this.worker!.postMessage({ write_texlive_remote_misses: keys });
            });
        }
        await this.busytexPipeline.write_texlive_remote_misses(keys);
    }

    async isPackageCached(packageJsUrl: string): Promise<boolean> {
        return isPackageCached(packageJsUrl);
    }

    async deletePackageCache(packageJsUrl: string): Promise<void> {
        await deletePackageCache(packageJsUrl);
        if (this.initialized) this.terminate();
    }

    async clearAllPackageCache(): Promise<void> {
        await clearAllPackageCache();
        if (this.initialized) this.terminate();
    }

    terminate(): void {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        if (this.busytexPipeline) {
            this.busytexPipeline.terminate();
            this.busytexPipeline = null;
        }
        this.initialized = false;
        this.logger.info('BusyTeX terminated');
    }

    isInitialized(): boolean {
        return this.initialized;
    }

    getConfig(): Required<BusyTexConfig> {
        return { ...this.config };
    }
}
