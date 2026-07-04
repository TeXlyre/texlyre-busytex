import Prism from 'prismjs';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-javascript';

declare function register_shell_handler(
    command: string,
    handler: (argv: string[], cwd: string, FS: any, PATH: any, Module: any) => { exit_code: number; files?: { path: string; contents: string | Uint8Array }[] } | void
): void;

interface EmscriptenFS {
    readFile(path: string, opts: { encoding: 'utf8' }): string;
}

const TOKEN_COLORS: Record<string, string> = {
    keyword: '0000FF',
    boolean: '0000FF',
    string: 'A31515',
    'template-string': 'A31515',
    comment: '008000',
    number: '098658',
    function: '795E26',
    'class-name': '267F99',
    builtin: '267F99',
    property: '001080'
};

function escapeLatex(text: string): string {
    return text
        .replace(/\\/g, '\\textbackslash{}')
        .replace(/([{}$&#^_~%])/g, '\\$1');
}

function formatSegment(text: string): string {
    return escapeLatex(text)
        .replace(/ /g, '\\ ')
        .replace(/\n/g, '\\\\\n');
}

function tokensToLatex(tokens: (string | Prism.Token)[]): string {
    return tokens.map(token => {
        if (typeof token === 'string') return formatSegment(token);
        const content = token.content;
        if (typeof content === 'string') return wrapColor(token.type, formatSegment(content));
        const items = Array.isArray(content) ? content : [content];
        return wrapColor(token.type, tokensToLatex(items));
    }).join('');
}

function wrapColor(type: string, text: string): string {
    const color = TOKEN_COLORS[type];
    return color ? `\\textcolor[HTML]{${color}}{${text}}` : text;
}

function highlight(argv: string[], _cwd: string, FS: EmscriptenFS) {
    const [, lang, inputPath, outputPath] = argv;
    const grammar = lang ? Prism.languages[lang] : undefined;
    if (!grammar || !inputPath || !outputPath) return { exit_code: 1 };

    const source = FS.readFile(inputPath, { encoding: 'utf8' });
    const body = tokensToLatex(Prism.tokenize(source, grammar));
    const contents = `{\\ttfamily\n${body}\n\\par}\n`;

    return { exit_code: 0, files: [{ path: outputPath, contents }] };
}

register_shell_handler('texlyre-highlight', highlight);