import { BusyTexConfig, CompileResult, FileInput } from './types';
import { Logger } from '../utils/logger';
import { ErrorHandler } from '../utils/error-handler';

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
            engineMode: config.engineMode ?? 'combined'
        };
        this.logger = new Logger(this.config.verbose);
    }

    async initialize(useWorker: boolean = true): Promise<void> {
        if (this.initialized) return;

        this.logger.info('Initializing BusyTeX...');

        try {
            if (useWorker) {
                await this.initializeWorker();
            } else {
                await this.initializeDirect();
            }
            this.initialized = true;
            this.logger.info('BusyTeX initialized successfully');
        } catch (error) {
            throw ErrorHandler.handle(error, 'Failed to initialize BusyTeX');
        }
    }

    private async initializeWorker(): Promise<void> {
        return new Promise((resolve, reject) => {
            const workerPath = `${this.config.busytexBasePath}/busytex_worker.js`;
            this.worker = new Worker(workerPath);

            const timeout = setTimeout(() => {
                reject(new Error('Timeout waiting for BusyTeX worker to initialize'));
            }, 120000);

            this.worker.onmessage = ({ data }) => {
                if (data.initialized) {
                    clearTimeout(timeout);
                    this.logger.debug('BusyTeX worker initialized:', data.initialized);
                    resolve();
                } else if (data.exception) {
                    clearTimeout(timeout);
                    reject(new Error(data.exception));
                }
            };

            this.worker.onerror = (error) => {
                clearTimeout(timeout);
                reject(new Error(`Worker error: ${error.message}`));
            };

            const { jsFile, wasmFile } = this.getEngineAssetNames();
            const busytexJs = `${this.config.busytexBasePath}/${jsFile}`;
            const busytexWasm = `${this.config.busytexBasePath}/${wasmFile}`;
            console.log('[BusyTexRunner] initializeWorker engineMode:', this.config.engineMode, 'js:', busytexJs, 'wasm:', busytexWasm);
            const texliveBasic = `${this.config.busytexBasePath}/texlive-basic.js`;
            const texliveExtras = `${this.config.busytexBasePath}/texlive-extra.js`;
            this.worker.postMessage({
                busytex_js: busytexJs,
                busytex_wasm: busytexWasm,
                // preload_data_packages_js: [texliveBasic, texliveExtras],
                // data_packages_js: [texliveBasic],
                // Replace with previous lines to include basic
                preload_data_packages_js: [texliveExtras],
                data_packages_js: [],
                //
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
        const texliveBasic = `${this.config.busytexBasePath}/texlive-basic.js`;
        const texliveExtras = `${this.config.busytexBasePath}/texlive-extra.js`;
        this.busytexPipeline = new BusytexPipeline(
            busytexJs,
            busytexWasm,
            // [texliveBasic, texliveExtras],
            // [texliveBasic],
            // Replace with previous lines to include basic
            [texliveExtras],
            [],
            //
            [],
            (msg: string) => this.logger.debug(msg),
            (versions: any) => this.logger.debug('Applet versions:', versions),
            true,
            BusytexPipeline.ScriptLoaderDocument
        );

        await this.busytexPipeline.on_initialized_promise;
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
        verbose: 'silent' | 'info' | 'debug' = 'silent',
        driver: 'xetex_bibtex8_dvipdfmx' | 'pdftex_bibtex8' | 'luahbtex_bibtex8' | 'luatex_bibtex8' = 'xetex_bibtex8_dvipdfmx',
        dataPackagesJs: string[] | null = null,
        remoteEndpoint?: string
    ): Promise<CompileResult> {
        if (!this.initialized) {
            throw new Error('BusyTeX not initialized. Call initialize() first.');
        }

        this.logger.info(`Compiling ${mainTexPath}...`);

        const busytexFiles = this.convertFilesToBusyTexFormat(files);

        if (this.worker) {
            return this.compileWithWorker(busytexFiles, mainTexPath, bibtex, verbose, driver, dataPackagesJs, remoteEndpoint);
        } else {
            return this.compileDirect(busytexFiles, mainTexPath, bibtex, verbose, driver, dataPackagesJs, remoteEndpoint);
        }
    }

    private async compileWithWorker(
        files: any[],
        mainTexPath: string,
        bibtex: boolean | null,
        verbose: string,
        driver: string,
        dataPackagesJs: string[] | null,
        remoteEndpoint?: string
    ): Promise<CompileResult> {
        return new Promise((resolve, reject) => {
            if (!this.worker) {
                reject(new Error('Worker not initialized'));
                return;
            }

            const timeout = setTimeout(() => {
                reject(new Error('Compilation timeout'));
            }, 120000);

            this.worker.onmessage = ({ data }) => {
                if (data.print) {
                    this.logger.debug(data.print);
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

            this.worker.postMessage({
                files,
                main_tex_path: mainTexPath,
                bibtex,
                verbose,
                driver,
                data_packages_js: dataPackagesJs,
                remote_endpoint: remoteEndpoint
            });
        });
    }

    private async compileDirect(
        files: any[],
        mainTexPath: string,
        bibtex: boolean | null,
        verbose: string,
        driver: string,
        dataPackagesJs: string[] | null,
        remoteEndpoint?: string
    ): Promise<CompileResult> {
        const result = await this.busytexPipeline.compile(
            files,
            mainTexPath,
            bibtex,
            verbose,
            driver,
            dataPackagesJs,
            remoteEndpoint
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

    async writeTexliveRemoteFiles(files: FileInput[]): Promise<void> {
        const payload = files.map(f => ({ path: f.path, contents: f.content }));
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