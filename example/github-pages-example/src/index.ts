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