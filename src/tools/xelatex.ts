import { BaseTool } from './base-tool';
import { XeLatexOptions, CompileResult } from '../core/types';

export class XeLatex extends BaseTool {
    protected getDriver(): 'xetex_bibtex8_dvipdfmx' {
        return 'xetex_bibtex8_dvipdfmx';
    }

    async compile(options: XeLatexOptions): Promise<CompileResult> {
        return super.compile({ ...options, driver: this.getDriver() });
    }
}