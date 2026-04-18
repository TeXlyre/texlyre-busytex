import { zip as fflateZip, unzip as fflateUnzip } from 'fflate';
import { EditorState } from '@codemirror/state';
import { basicSetup } from 'codemirror';
import { EditorView, keymap } from '@codemirror/view';
import { historyKeymap } from '@codemirror/commands';
import { searchKeymap } from '@codemirror/search';
import { latex } from 'codemirror-lang-latex';
import { samples, Sample } from './samples';
import { BusyTexRunner, XeLatex, PdfLatex, LuaLatex, CompileOptions, TexliveRemoteFile } from '../../../src';

import './styles.css';

interface FileTab {
    name: string;
    content: string;
    isMain: boolean;
}

interface PackageBundle {
    name: string;
    url: string;
    packages: Set<string>;
}

const basePath = document.querySelector('base')?.getAttribute('href') || '';

class BusyTexDemo {
    private inputEditor: EditorView;
    private outputView: HTMLElement;
    private pdfPreview: HTMLIFrameElement;
    private runner: BusyTexRunner | null = null;
    private xelatex: XeLatex | null = null;
    private pdflatex: PdfLatex | null = null;
    private lualatex: LuaLatex | null = null;
    private currentTool: 'xelatex' | 'pdflatex' | 'lualatex' = 'xelatex';
    private engineMode: 'combined' | 'pdftex' | 'xetex' | 'luahbtex' = 'combined';
    private files: Map<string, FileTab> = new Map();
    private activeFile: string = 'main.tex';
    private useWorker: boolean = true;
    private availablePackages: Map<string, PackageBundle> = new Map();
    private packageBundles: PackageBundle[] = [];
    private cachedRemoteFiles: TexliveRemoteFile[] = [];
    private cachedMisses: string[] = [];
    private currentSample: Sample = samples[0];
    private binaryFiles: { path: string; content: Uint8Array }[] = [];

    constructor() {
        this.inputEditor = this.createInputEditor();
        this.outputView = document.getElementById('output-display')!;
        this.pdfPreview = document.getElementById('pdf-preview') as HTMLIFrameElement;

        this.setupEventListeners();
        this.loadSample(samples[0]);
        this.loadAvailablePackages();
    }

    private async loadAvailablePackages(): Promise<void> {
        const corePackages = [
            // {
            //     name: 'texlive-basic',
            //     url: `${basePath}core/busytex/texlive-basic.js`,
            //     listFile: `${basePath}core/busytex/texlive-basic.js.providespackage.txt`
            // },
            {
                name: 'texlive-extra',
                url: `${basePath}core/busytex/texlive-extra.js`,
                listFile: `${basePath}core/busytex/texlive-extra.js.providespackage.txt`
            }
        ];

        for (const file of corePackages) {
            await this.loadPackageList(file);
        }

        this.populatePackageDatalist();
        this.setStatus(`Loaded ${this.availablePackages.size} available packages from ${this.packageBundles.length} bundles`, 'info');
    }

    private async loadPackageList(file: { name: string; url: string; listFile: string; }): Promise<void> {
        try {
            const response = await fetch(file.listFile);
            const text = await response.text();

            const packages = text.split('\n')
                .map(line => {
                    const match = line.match(/\\Provides(?:Expl)?(?:Package|Class|File)\{([^}]+)\}/);
                    return match ? match[1] : null;
                })
                .filter(pkg => pkg !== null) as string[];

            const bundle: PackageBundle = {
                name: file.name,
                url: file.url,
                packages: new Set(packages)
            };

            this.packageBundles.push(bundle);

            packages.forEach(pkg => {
                if (pkg && !this.availablePackages.has(pkg)) {
                    this.availablePackages.set(pkg, bundle);
                }
            });
        } catch (error) {
            console.warn(`Could not load package list from ${file.listFile}:`, error);
        }
    }

    private populatePackageDatalist(): void {
        const datalist = document.getElementById('package-datalist') as HTMLDataListElement;
        if (!datalist) return;

        datalist.innerHTML = '';
        Array.from(this.availablePackages.keys()).sort().forEach(pkg => {
            const option = document.createElement('option');
            option.value = pkg;
            datalist.appendChild(option);
        });
    }

    private createInputEditor(): EditorView {
        const state = EditorState.create({
            doc: '',
            extensions: [
                basicSetup,
                latex({
                    autoCloseTags: true,
                    enableLinting: true,
                    enableTooltips: true,
                    enableAutocomplete: true,
                    autoCloseBrackets: true
                }),
                EditorView.lineWrapping
            ]
        });

        return new EditorView({
            state,
            parent: document.getElementById('input-editor')!
        });
    }

    private setupEventListeners(): void {
        document.querySelectorAll('input[name="tool"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const target = e.target as HTMLInputElement;
                this.currentTool = target.value as 'xelatex' | 'pdflatex' | 'lualatex';
            });
        });

        document.getElementById('worker-toggle')!.addEventListener('change', (e) => {
            this.useWorker = (e.target as HTMLInputElement).checked;
        });

        document.getElementById('run-compile')!.addEventListener('click', () => {
            this.runCompilation();
        });

        document.getElementById('add-file-btn')!.addEventListener('click', () => {
            this.addNewFile();
        });

        document.getElementById('sample-select')!.addEventListener('change', (e) => {
            const idx = parseInt((e.target as HTMLSelectElement).value);
            this.loadSample(samples[idx]);
        });

        document.getElementById('upload-remote-btn')!.addEventListener('change', (e) => {
            this.uploadTexliveRemoteFiles(e);
        });
    }

    private renderFileTabs(): void {
        const tabsContainer = document.getElementById('file-tabs')!;
        tabsContainer.innerHTML = '';

        this.files.forEach((file, filename) => {
            const tab = document.createElement('div');
            tab.className = `file-tab ${filename === this.activeFile ? 'active' : ''}`;

            const tabName = document.createElement('span');
            tabName.textContent = filename;
            tabName.addEventListener('click', () => this.switchToFile(filename));
            tab.appendChild(tabName);

            if (!file.isMain) {
                const closeBtn = document.createElement('button');
                closeBtn.className = 'close-tab';
                closeBtn.textContent = '×';
                closeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.removeFile(filename);
                });
                tab.appendChild(closeBtn);
            }

            tabsContainer.appendChild(tab);
        });

        this.binaryFiles.forEach(file => {
            const tab = document.createElement('div');
            tab.className = 'file-tab binary-tab';
            const tabName = document.createElement('span');
            tabName.textContent = file.path + ' 📎';
            tab.appendChild(tabName);
            tab.addEventListener('click', () => this.showBinaryPlaceholder(file.path));
            tabsContainer.appendChild(tab);
        });
    }

    private showBinaryPlaceholder(filename: string): void {
        this.saveCurrentFile();
        this.activeFile = '';
        this.inputEditor.dispatch({
            changes: { from: 0, to: this.inputEditor.state.doc.length, insert: `[Binary file: ${filename}]` }
        });
        document.querySelectorAll('.file-tab').forEach(t => t.classList.remove('active'));
        const tabs = document.querySelectorAll('.binary-tab span');
        tabs.forEach(t => { if (t.textContent === filename + ' 📎') t.closest('.file-tab')?.classList.add('active'); });
    }

    private switchToFile(filename: string): void {
        this.saveCurrentFile();
        this.activeFile = filename;
        const file = this.files.get(filename);
        if (file) {
            this.inputEditor.dispatch({
                changes: { from: 0, to: this.inputEditor.state.doc.length, insert: file.content }
            });
        }
        this.renderFileTabs();
    }

    private saveCurrentFile(): void {
        const currentContent = this.inputEditor.state.doc.toString();
        const file = this.files.get(this.activeFile);
        if (file) file.content = currentContent;
    }

    private addNewFile(): void {
        const filename = prompt('Enter filename (e.g., chapter1.tex):');
        if (!filename) return;

        const normalizedName = filename.endsWith('.tex') || filename.endsWith('.bib') ? filename : filename + '.tex';

        if (this.files.has(normalizedName)) {
            alert('File already exists!');
            return;
        }

        this.saveCurrentFile();
        this.files.set(normalizedName, { name: normalizedName, content: '', isMain: false });
        this.activeFile = normalizedName;
        this.inputEditor.dispatch({
            changes: { from: 0, to: this.inputEditor.state.doc.length, insert: '' }
        });
        this.renderFileTabs();
        this.setStatus(`Created new file: ${normalizedName}`, 'success');
    }

    private removeFile(filename: string): void {
        if (this.files.get(filename)?.isMain) return;

        this.files.delete(filename);
        if (this.activeFile === filename) {
            this.activeFile = 'main.tex';
            const mainFile = this.files.get('main.tex');
            if (mainFile) {
                this.inputEditor.dispatch({
                    changes: { from: 0, to: this.inputEditor.state.doc.length, insert: mainFile.content }
                });
            }
        }
        this.renderFileTabs();
    }

    private loadSample(sample: Sample): void {
        this.files.clear();
        this.binaryFiles = [];
        for (const f of sample.files) {
            if (f.content instanceof Uint8Array) {
                this.binaryFiles.push({ path: f.path, content: f.content });
            } else {
                this.files.set(f.path, { name: f.path, content: f.content as string, isMain: f.path === 'main.tex' });
            }
        }
        this.activeFile = 'main.tex';
        if (this.inputEditor) {
            this.inputEditor.dispatch({
                changes: { from: 0, to: this.inputEditor.state.doc.length, insert: this.files.get('main.tex')!.content }
            });
        }
        this.renderFileTabs();
        const radio = document.querySelector(`input[name="tool"][value="${sample.compiler}"]`) as HTMLInputElement;
        if (radio) { radio.checked = true; this.currentTool = sample.compiler; }
        const hasBib = sample.files.some(f => f.path.endsWith('.bib'));
        (document.getElementById('bibtex') as HTMLInputElement).checked = hasBib;
        this.currentSample = sample;
    }

    private getRequiredEngineMode(): 'combined' | 'pdftex' | 'xetex' | 'luahbtex' {
        const useSplit = (document.getElementById('split-engines') as HTMLInputElement)?.checked ?? false;
        if (!useSplit) return 'combined';
        const toolMap: Record<string, 'pdftex' | 'xetex' | 'luahbtex'> = {
            pdflatex: 'pdftex',
            xelatex: 'xetex',
            lualatex: 'luahbtex'
        };
        return toolMap[this.currentTool] ?? 'combined';
    }

    private triggerDownload(data: Uint8Array, filename: string, mime: string): void {
        const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
        const url = URL.createObjectURL(new Blob([buffer], { type: mime }));
        Object.assign(document.createElement('a'), { href: url, download: filename }).click();
        URL.revokeObjectURL(url);
    }

    private async runCompilation(): Promise<void> {
        this.saveCurrentFile();

        const requiredMode = this.getRequiredEngineMode();

        if (this.runner && this.runner.isInitialized() && requiredMode !== this.engineMode) {
            this.runner.terminate();
            this.runner = null;
            this.xelatex = null;
            this.pdflatex = null;
            this.lualatex = null;
        }

        if (!this.runner) {
            this.engineMode = requiredMode;
            this.runner = new BusyTexRunner({
                busytexBasePath: `${basePath}core/busytex`,
                verbose: true,
                engineMode: this.engineMode
            });
            this.xelatex = new XeLatex(this.runner, true);
            this.pdflatex = new PdfLatex(this.runner, true);
            this.lualatex = new LuaLatex(this.runner, true);
        }

        if (!this.runner.isInitialized()) {
            const endpointInput = document.getElementById('remote-endpoint') as HTMLInputElement;
            endpointInput.disabled = true;
            this.setStatus('Initializing BusyTeX...', 'info');
            try {
                await this.runner.initialize(this.useWorker);
            } catch (error) {
                this.setStatus(`Initialization failed: ${error}`, 'error');
                return;
            }
        }

        if (this.cachedRemoteFiles.length > 0) {
            await this.runner.writeTexliveRemoteFiles(this.cachedRemoteFiles);
        }
        if (this.cachedMisses.length > 0) {
            await this.runner.writeTexliveRemoteMisses(this.cachedMisses);
        }


        this.setStatus(`Compiling with ${this.currentTool}...`, 'info');

        try {
            const mainFile = this.files.get('main.tex');
            if (!mainFile) throw new Error('Main file not found');

            const additionalFiles = [
                ...Array.from(this.files.values())
                    .filter(f => f.name !== 'main.tex')
                    .map(f => ({ path: f.name, content: f.content })),
                ...this.binaryFiles
            ];

            const dataPackages = this.getAllLoadedDataPackages();

            const bibtexEnabled = (document.getElementById('bibtex') as HTMLInputElement).checked;
            const makeindexEnabled = (document.getElementById('makeindex') as HTMLInputElement).checked;
            const rerunEnabled = (document.getElementById('rerun') as HTMLInputElement).checked;

            const options: CompileOptions = {
                input: mainFile.content,
                bibtex: bibtexEnabled,
                makeindex: makeindexEnabled,
                rerun: rerunEnabled,
                verbose: (document.getElementById('verbose') as HTMLSelectElement).value as any,
                additionalFiles: additionalFiles.length > 0 ? additionalFiles : undefined,
                dataPackagesJs: dataPackages.length > 0 ? dataPackages : undefined,
                remoteEndpoint: (document.getElementById('remote-endpoint') as HTMLInputElement).value || undefined
            };

            const startTime = performance.now();
            let result;

            if (this.currentTool === 'xelatex') result = await this.xelatex!.compile(options);
            else if (this.currentTool === 'pdflatex') result = await this.pdflatex!.compile(options);
            else result = await this.lualatex!.compile(options);

            const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
            await this.runner.writeTexliveRemoteMisses([]);

            if (result.success && result.pdf) {
                this.displayPDF(result.pdf);
                const activeFeatures = [
                    bibtexEnabled && 'BibTeX',
                    makeindexEnabled && 'MakeIndex',
                    rerunEnabled && 'multiple runs'
                ].filter(Boolean);
                const passesInfo = activeFeatures.length > 0 ? ` (${activeFeatures.join(', ')})` : '';
                this.setStatus(`Compilation successful in ${elapsed}s${passesInfo}`, 'success', result.synctex, this.runner ?? undefined);
            } else {
                this.displayOutput(result.log, true);
                this.setStatus('Compilation failed', 'error');
            }

            this.displayOutput(result.log, !result.success);
        } catch (error) {
            console.error('Compilation error:', error);
            this.setStatus(`Error: ${error}`, 'error');
            this.displayOutput(`Error: ${error}`, true);
        }
    }

    private getAllLoadedDataPackages(): string[] {
        const baseUrl = `${basePath}core/busytex/`;
        const packages: string[] = [];

        // Always include basic and/or extra
        // packages.push(`${baseUrl}texlive-basic.js`);
        packages.push(`${baseUrl}texlive-extra.js`);

        return packages;
    }

    private setStatus(message: string, type: 'info' | 'success' | 'error' | 'warning', synctex?: Uint8Array, runner?: BusyTexRunner): void {
        const statusEl = document.getElementById('status')!;
        statusEl.innerHTML = '';
        statusEl.className = `status ${type}`;

        const messageSpan = document.createElement('span');
        messageSpan.textContent = message;
        statusEl.appendChild(messageSpan);

        if (synctex && synctex.length > 0) {
            const button = document.createElement('button');
            button.className = 'secondary-button';
            button.style.marginLeft = '1rem';
            button.innerHTML = '📥 Download SyncTeX';
            button.onclick = () => this.triggerDownload(synctex.slice(), 'main.synctex.gz', 'application/gzip');
            statusEl.appendChild(button);
        }

        if (runner) {
            const workBtn = document.createElement('button');
            workBtn.className = 'secondary-button';
            workBtn.style.marginLeft = '1rem';
            workBtn.innerHTML = '📁 Download Work Dir ZIP';
            workBtn.onclick = async () => {
                const files = await runner.readProjectFiles();
                const input = Object.fromEntries(files.map(f => [
                    f.path,
                    typeof f.content === 'string' ? new TextEncoder().encode(f.content) : f.content as Uint8Array
                ]));
                fflateZip(input, (err, data) => {
                    if (err) { this.setStatus(`Zip failed: ${err}`, 'error'); return; }
                    this.triggerDownload(data, 'workdir.zip', 'application/zip');
                });
            };
            statusEl.appendChild(workBtn);

            const remoteBtn = document.createElement('button');
            remoteBtn.className = 'secondary-button';
            remoteBtn.style.marginLeft = '1rem';
            remoteBtn.innerHTML = '📁 Download Remote Package ZIP';
            remoteBtn.onclick = async () => {
                const files = await runner.readProjectFiles('/tmp/texlive_remote');
                if (!files.length) {
                    const msg = document.createElement('span');
                    msg.textContent = 'No files in /tmp/texlive_remote';
                    msg.style.marginLeft = '1rem';
                    remoteBtn.insertAdjacentElement('afterend', msg);
                    setTimeout(() => msg.remove(), 1500);
                    return;
                }
                const input = Object.fromEntries(files.map(f => [
                    f.path,
                    typeof f.content === 'string' ? new TextEncoder().encode(f.content) : f.content as Uint8Array
                ]));
                fflateZip(input, (err, data) => {
                    if (err) { this.setStatus(`Zip failed: ${err}`, 'error'); return; }
                    this.triggerDownload(data, 'texlive_remote.zip', 'application/zip');
                });
            };
            statusEl.appendChild(remoteBtn);
        }
    }

    private async uploadTexliveRemoteFiles(e: Event): Promise<void> {
        const input = e.target as HTMLInputElement;
        if (!input.files?.length) return;
        const arrayBuffer = await input.files[0].arrayBuffer();
        fflateUnzip(new Uint8Array(arrayBuffer), async (err, files) => {
            if (err) { this.setStatus(`Unzip failed: ${err}`, 'error'); return; }

            let missesKeys: string[] = [];
            this.cachedRemoteFiles = [];

            for (const [path, contents] of Object.entries(files)) {
                if (path.endsWith('/')) continue;
                const base = path.slice(path.lastIndexOf('/') + 1);
                if (base === '.misses.json') {
                    try {
                        const parsed = JSON.parse(new TextDecoder().decode(contents));
                        if (Array.isArray(parsed)) missesKeys = parsed;
                    } catch { }
                    continue;
                }
                const m = base.match(/^(\d+)_(.+)$/);
                this.cachedRemoteFiles.push(
                    m ? { name: m[2], format: parseInt(m[1], 10), content: contents }
                        : { name: base, content: contents }
                );
            }

            this.cachedMisses = missesKeys;

            if (this.runner?.isInitialized()) {
                try {
                    if (this.cachedRemoteFiles.length > 0)
                        await this.runner.writeTexliveRemoteFiles(this.cachedRemoteFiles);
                    if (this.cachedMisses.length > 0)
                        await this.runner.writeTexliveRemoteMisses(this.cachedMisses);
                } catch (err) {
                    this.setStatus(`Failed to write remote files: ${err}`, 'error');
                    return;
                }
            }

            this.setStatus(`Loaded ${this.cachedRemoteFiles.length} files and ${this.cachedMisses.length} misses into /tmp/texlive_remote`, 'success');
        });
    }

    private displayPDF(pdf: Uint8Array): void {
        const blob = new Blob([pdf.slice()], { type: 'application/pdf' });
        this.pdfPreview.src = URL.createObjectURL(blob);
    }

    private displayOutput(text: string, isError: boolean = false): void {
        const verbose = (document.getElementById('verbose') as HTMLSelectElement).value;
        let displayText = text;

        if (verbose === 'silent' && !isError) {
            const lines = text.split('\n');
            const errorLines = lines.filter(line =>
                line.includes('Error') ||
                line.includes('Warning') ||
                line.includes('!') ||
                line.includes('EXITCODE:')
            );
            displayText = errorLines.join('\n') || 'Compilation completed successfully.';
        } else if (verbose === 'info' && !isError) {
            const lines = text.split('\n');
            const relevantLines = lines.filter(line =>
                !line.includes('LaTeX Font Info:') &&
                !line.includes('entering extended mode') &&
                !line.trim().startsWith('(')
            );
            displayText = relevantLines.join('\n');
        }

        this.outputView.innerHTML = '';
        const pre = document.createElement('pre');
        pre.className = isError ? 'error-output' : 'normal-output';
        pre.textContent = displayText;
        this.outputView.appendChild(pre);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new BusyTexDemo();
});
