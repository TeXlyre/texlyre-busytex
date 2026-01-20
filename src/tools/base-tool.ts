import { BusyTexRunner } from '../core/busytex-runner';
import { CompileResult, CompileOptions, FileInput } from '../core/types';
import { Logger } from '../utils/logger';

export abstract class BaseTool {
    protected runner: BusyTexRunner;
    protected logger: Logger;

    constructor(runner: BusyTexRunner, verbose: boolean = false) {
        this.runner = runner;
        this.logger = new Logger(verbose);
    }

    protected abstract getDriver(): 'xetex_bibtex8_dvipdfmx' | 'pdftex_bibtex8' | 'luahbtex_bibtex8' | 'luatex_bibtex8';

    async compile(options: CompileOptions): Promise<CompileResult> {
        if (!this.runner.isInitialized()) {
            await this.runner.initialize();
        }

        const mainTexPath = this.getMainTexPath(options);
        const files: FileInput[] = this.prepareFiles(options, mainTexPath);

        return this.runner.compile(
            files,
            mainTexPath,
            options.bibtex ?? null,
            options.verbose ?? 'silent',
            options.driver ?? this.getDriver(),
            options.dataPackagesJs ?? null
        );
    }

    private getMainTexPath(options: CompileOptions): string {
        if (options.additionalFiles && options.additionalFiles.length > 0) {
            const mainFile = options.additionalFiles.find(f => f.path === 'main.tex');
            if (mainFile) {
                return 'main.tex';
            }
        }
        return 'main.tex';
    }

    private prepareFiles(options: CompileOptions, mainTexPath: string): FileInput[] {
        const files: FileInput[] = [];

        files.push({ path: mainTexPath, content: options.input });

        if (options.additionalFiles) {
            files.push(...options.additionalFiles);
        }

        return files;
    }
}