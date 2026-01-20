import { EditorState } from '@codemirror/state';
import { EditorView, lineNumbers, highlightActiveLine, keymap } from '@codemirror/view';
import { defaultKeymap } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';

import { BusyTexRunner, XeLatex, PdfLatex, LuaLatex, CompileOptions } from '../../../src';
import { sampleLatex, multiFileSample, introductionSample, methodsSample, resultsSample, referencesSample } from './samples';

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
    private runner: BusyTexRunner;
    private xelatex: XeLatex;
    private pdflatex: PdfLatex;
    private lualatex: LuaLatex;
    private currentTool: 'xelatex' | 'pdflatex' | 'lualatex' = 'xelatex';
    private files: Map<string, FileTab> = new Map();
    private activeFile: string = 'main.tex';
    private useWorker: boolean = true;
    private availablePackages: Map<string, PackageBundle> = new Map();
    private packageBundles: PackageBundle[] = [];
    private loadedPackages: Set<string> = new Set();

    constructor() {
        this.runner = new BusyTexRunner({
            busytexBasePath: `${basePath}core/busytex`,
            verbose: true
        });

        this.xelatex = new XeLatex(this.runner, true);
        this.pdflatex = new PdfLatex(this.runner, true);
        this.lualatex = new LuaLatex(this.runner, true);

        this.files.set('main.tex', { name: 'main.tex', content: sampleLatex, isMain: true });

        this.inputEditor = this.createInputEditor();
        this.outputView = document.getElementById('output-display')!;
        this.pdfPreview = document.getElementById('pdf-preview') as HTMLIFrameElement;

        this.setupEventListeners();
        this.renderFileTabs();
        this.loadAvailablePackages();
        this.updateLoadedPackagesList();
    }

    private async loadAvailablePackages(): Promise<void> {
        const packageFiles = [
            {
                name: 'texlive-basic',
                url: `${basePath}core/busytex/texlive-basic.js`,
                listFile: `${basePath}core/busytex/texlive-basic.js.providespackage.txt`
            },
            {
                name: 'texlive-latex-base_texlive-latex-recommended_texlive-science_texlive-fonts-recommended',
                url: `${basePath}core/busytex/texlive-latex-base_texlive-latex-recommended_texlive-science_texlive-fonts-recommended.js`,
                listFile: `${basePath}core/busytex/texlive-latex-base_texlive-latex-recommended_texlive-science_texlive-fonts-recommended.js.providespackage.txt`
            },
            {
                name: 'texlive-latex-extra',
                url: `${basePath}core/busytex/texlive-latex-extra.js`,
                listFile: `${basePath}core/busytex/texlive-latex-extra.js.providespackage.txt`
            }
        ];

        for (const file of packageFiles) {
            try {
                const response = await fetch(file.listFile);
                const text = await response.text();

                const packages = text.split('\n')
                    .map(line => {
                        const match = line.match(/\\ProvidesPackage\{([^}]+)\}/);
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
                    if (pkg) {
                        this.availablePackages.set(pkg, bundle);
                    }
                });
            } catch (error) {
                console.warn(`Could not load package list from ${file.listFile}:`, error);
            }
        }

        this.populatePackageDatalist();
        this.setStatus(`Loaded ${this.availablePackages.size} available packages`, 'success');
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
            doc: sampleLatex,
            extensions: [
                lineNumbers(),
                highlightActiveLine(),
                syntaxHighlighting(defaultHighlightStyle),
                keymap.of(defaultKeymap),
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

        document.querySelectorAll('.load-multifile-example').forEach(button => {
            button.addEventListener('click', () => {
                this.loadMultiFileExample();
            });
        });

        document.getElementById('add-package-from-search')!.addEventListener('click', () => {
            this.addPackageFromSearch();
        });

        const packageSearch = document.getElementById('package-search') as HTMLInputElement;
        packageSearch.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter') {
                this.addPackageFromSearch();
            }
        });

        packageSearch.addEventListener('input', (ev) => {
            this.updatePackageInfo((ev.target as HTMLInputElement).value);
        });
    }

    private updatePackageInfo(packageName: string): void {
        const infoDiv = document.getElementById('package-info')!;

        if (!packageName.trim()) {
            infoDiv.innerHTML = '';
            return;
        }

        const bundle = this.availablePackages.get(packageName);

        if (bundle) {
            infoDiv.innerHTML = `<small>Found in: <strong>${bundle.name}</strong></small>`;
            infoDiv.style.color = 'green';
        } else {
            const suggestions = this.findSimilarPackages(packageName);
            if (suggestions.length > 0) {
                infoDiv.innerHTML = `<small>Did you mean: ${suggestions.slice(0, 3).join(', ')}?</small>`;
                infoDiv.style.color = 'orange';
            } else {
                infoDiv.innerHTML = `<small>Package not found</small>`;
                infoDiv.style.color = 'red';
            }
        }
    }

    private findSimilarPackages(query: string): string[] {
        const lowerQuery = query.toLowerCase();
        return Array.from(this.availablePackages.keys())
            .filter(pkg => pkg.toLowerCase().includes(lowerQuery))
            .slice(0, 5);
    }

    private async addPackageFromSearch(): Promise<void> {
        const input = document.getElementById('package-search') as HTMLInputElement;
        const packageName = input.value.trim();

        if (!packageName) {
            this.setStatus('Please enter a package name', 'warning');
            return;
        }

        const bundle = this.availablePackages.get(packageName);

        if (!bundle) {
            this.setStatus(`Package "${packageName}" not found in available packages`, 'error');
            return;
        }

        if (!this.runner.isInitialized()) {
            this.setStatus('BusyTeX not initialized yet', 'error');
            return;
        }

        await this.installPackage(packageName, bundle);
    }

    private async installPackage(packageName: string, bundle: PackageBundle): Promise<void> {
        this.setStatus(`Installing package: ${packageName} from ${bundle.name}...`, 'info');

        const requiredPackages = this.getRequiredDataPackages(bundle);

        const mainFile = this.files.get('main.tex');
        if (!mainFile) {
            this.setStatus('Main file not found', 'error');
            return;
        }

        const options: CompileOptions = {
            input: mainFile.content,
            dataPackagesJs: requiredPackages,
            verbose: 'info'
        };

        try {
            const startTime = performance.now();
            let result;

            if (this.currentTool === 'xelatex') result = await this.xelatex.compile(options);
            else if (this.currentTool === 'pdflatex') result = await this.pdflatex.compile(options);
            else result = await this.lualatex.compile(options);

            const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);

            if (result.success) {
                this.loadedPackages.add(packageName);
                this.updateLoadedPackagesList();
                this.setStatus(`Package ${packageName} loaded successfully in ${elapsed}s`, 'success');
                (document.getElementById('package-search') as HTMLInputElement).value = '';
                document.getElementById('package-info')!.innerHTML = '';
            } else {
                this.setStatus(`Failed to load package: ${packageName}`, 'error');
                this.displayOutput(result.log, true);
            }
        } catch (error) {
            this.setStatus(`Failed to install package: ${error}`, 'error');
        }
    }

    private getRequiredDataPackages(targetBundle: PackageBundle): string[] {
        const baseUrl = `${basePath}core/busytex/`;
        const packages: string[] = [`${baseUrl}texlive-basic.js`];

        const bundleOrder = [
            'texlive-latex-base_texlive-latex-recommended_texlive-science_texlive-fonts-recommended',
            'texlive-latex-extra'
        ];

        for (const bundleName of bundleOrder) {
            const bundle = this.packageBundles.find(b => b.name === bundleName);
            if (bundle) {
                packages.push(bundle.url);
                if (bundle.name === targetBundle.name) {
                    break;
                }
            }
        }

        return packages;
    }

    private updateLoadedPackagesList(): void {
        const listContainer = document.getElementById('loaded-packages-list')!;
        const countSpan = document.getElementById('loaded-count')!;

        countSpan.textContent = this.loadedPackages.size.toString();

        if (this.loadedPackages.size === 0) {
            listContainer.innerHTML = '<p class="no-packages">No packages loaded yet</p>';
            return;
        }

        listContainer.innerHTML = '';

        const sortedPackages = Array.from(this.loadedPackages).sort();

        sortedPackages.forEach(pkg => {
            const bundle = this.availablePackages.get(pkg);

            const packageItem = document.createElement('div');
            packageItem.className = 'package-item';

            const packageName = document.createElement('span');
            packageName.className = 'package-name';
            packageName.textContent = pkg;

            const bundleInfo = document.createElement('span');
            bundleInfo.className = 'bundle-info';
            bundleInfo.textContent = bundle ? bundle.name.split('_')[0] : 'unknown';

            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-package';
            removeBtn.textContent = '×';
            removeBtn.title = 'Remove from list';
            removeBtn.onclick = () => {
                this.loadedPackages.delete(pkg);
                this.updateLoadedPackagesList();
                this.setStatus(`Removed ${pkg} from loaded packages list`, 'info');
            };

            packageItem.appendChild(packageName);
            packageItem.appendChild(bundleInfo);
            packageItem.appendChild(removeBtn);

            listContainer.appendChild(packageItem);
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

    private loadMultiFileExample(): void {
        this.files.clear();
        this.files.set('main.tex', { name: 'main.tex', content: multiFileSample, isMain: true });
        this.files.set('introduction.tex', { name: 'introduction.tex', content: introductionSample, isMain: false });
        this.files.set('methods.tex', { name: 'methods.tex', content: methodsSample, isMain: false });
        this.files.set('results.tex', { name: 'results.tex', content: resultsSample, isMain: false });
        this.files.set('references.bib', { name: 'references.bib', content: referencesSample, isMain: false });

        this.activeFile = 'main.tex';
        this.inputEditor.dispatch({
            changes: { from: 0, to: this.inputEditor.state.doc.length, insert: multiFileSample }
        });

        this.renderFileTabs();

        (document.getElementById('bibtex') as HTMLInputElement).checked = true;

        this.setStatus('Multi-file example loaded with BibTeX enabled. Click "Compile LaTeX" to build.', 'success');
    }

    private async runCompilation(): Promise<void> {
        this.saveCurrentFile();

        if (!this.runner.isInitialized()) {
            this.setStatus('Initializing BusyTeX...', 'info');
            try {
                await this.runner.initialize(this.useWorker);
            } catch (error) {
                this.setStatus(`Initialization failed: ${error}`, 'error');
                return;
            }
        }

        const bibtexEnabled = (document.getElementById('bibtex') as HTMLInputElement).checked;

        this.setStatus(`Compiling with ${this.currentTool}...`, 'info');

        try {
            const mainFile = this.files.get('main.tex');
            if (!mainFile) throw new Error('Main file not found');

            const additionalFiles = Array.from(this.files.values())
                .filter(f => f.name !== 'main.tex')
                .map(f => ({ path: f.name, content: f.content }));

            const options: CompileOptions = {
                input: mainFile.content,
                bibtex: bibtexEnabled,
                verbose: (document.getElementById('verbose') as HTMLSelectElement).value as any,
                additionalFiles: additionalFiles.length > 0 ? additionalFiles : undefined
            };

            const startTime = performance.now();
            let result;

            if (this.currentTool === 'xelatex') result = await this.xelatex.compile(options);
            else if (this.currentTool === 'pdflatex') result = await this.pdflatex.compile(options);
            else result = await this.lualatex.compile(options);

            const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);

            if (result.success && result.pdf) {
                this.displayPDF(result.pdf);

                const passesInfo = bibtexEnabled ? ' (multiple passes for BibTeX)' : '';
                this.setStatus(`Compilation successful in ${elapsed}s${passesInfo}`, 'success', result.synctex);
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

    private setStatus(message: string, type: 'info' | 'success' | 'error' | 'warning', synctex?: Uint8Array): void {
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
            button.onclick = () => {
                const blob = new Blob([synctex], { type: 'application/gzip' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'main.synctex.gz';
                link.click();
                URL.revokeObjectURL(url);
            };
            statusEl.appendChild(button);
        }
    }

    private displayPDF(pdf: Uint8Array): void {
        const blob = new Blob([pdf], { type: 'application/pdf' });
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