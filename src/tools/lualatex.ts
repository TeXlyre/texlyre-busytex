// src/tools/lualatex.ts
import { LuaLatexOptions, CompileResult } from '../core/types';
import { BaseTool } from './base-tool';

export class LuaLatex extends BaseTool {
    protected getDriver(): 'luahbtex_bibtex8' {
        return 'luahbtex_bibtex8';
    }

    async compile(options: LuaLatexOptions): Promise<CompileResult> {
        return super.compile({ ...options, driver: this.getDriver() });
    }
}