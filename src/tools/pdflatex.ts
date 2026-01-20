import { BaseTool } from './base-tool';
import { PdfLatexOptions, CompileResult } from '../core/types';

export class PdfLatex extends BaseTool {
    protected getDriver(): 'pdftex_bibtex8' {
        return 'pdftex_bibtex8';
    }

    async compile(options: PdfLatexOptions): Promise<CompileResult> {
        return super.compile({ ...options, driver: this.getDriver() });
    }
}