// src/tools/pdflatex.ts
import { PdfLatexOptions, CompileResult } from '../core/types';
import { BaseTool } from './base-tool';

export class PdfLatex extends BaseTool {
    protected getDriver(): 'pdftex_bibtex8' {
        return 'pdftex_bibtex8';
    }

    async compile(options: PdfLatexOptions): Promise<CompileResult> {
        return super.compile({ ...options, driver: this.getDriver() });
    }
}