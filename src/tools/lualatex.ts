import { BaseTool } from './base-tool';
import { LuaLatexOptions, CompileResult } from '../core/types';

export class LuaLatex extends BaseTool {
    protected getDriver(): 'luahbtex_bibtex8' {
        return 'luahbtex_bibtex8';
    }

    async compile(options: LuaLatexOptions): Promise<CompileResult> {
        return super.compile({ ...options, driver: this.getDriver() });
    }
}