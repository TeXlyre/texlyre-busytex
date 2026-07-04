self.handler_ready = (async () => {
    importScripts('https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js');

    const pyodide = await loadPyodide();
    await pyodide.loadPackage('pygments');
    await pyodide.runPythonAsync(`
from pygments import highlight
from pygments.lexers import get_lexer_by_name
from pygments.formatters import LatexFormatter
`);

    const readText = path => new TextDecoder().decode(self.FS.readFile(path));
    const writeText = (path, text) => self.FS.writeFile(path, new TextEncoder().encode(text));

    register_shell_handler('pygmentize', (argv, cwd, FS, PATH) => {
        self.FS = FS;

        let language = 'text';
        let formatter = 'latex';
        let output = null;
        let style = null;
        let input = null;
        const options = {};

        for (let i = 1; i < argv.length; i++) {
            const arg = argv[i];
            if ((arg === '-l' || arg === '--lexer') && argv[i + 1]) language = argv[++i];
            else if ((arg === '-f' || arg === '--formatter') && argv[i + 1]) formatter = argv[++i];
            else if ((arg === '-o' || arg === '--outfile') && argv[i + 1]) output = argv[++i];
            else if (arg === '-S' && argv[i + 1]) style = argv[++i];
            else if (arg === '-P' && argv[i + 1]) {
                const value = argv[++i];
                const idx = value.indexOf('=');
                options[idx === -1 ? value : value.slice(0, idx)] = idx === -1 ? true : value.slice(idx + 1);
            }
            else if (!arg.startsWith('-')) input = arg;
        }

        if (formatter !== 'latex') return 1;
        if (style) options.style = style;

        pyodide.globals.set('pygments_language', language);
        pyodide.globals.set('pygments_options', options);

        let result;
        if (style && !input) {
            result = pyodide.runPython(`LatexFormatter(**pygments_options).get_style_defs()`);
        } else {
            if (!input) return 1;
            const inputPath = PATH.isAbs(input) ? input : PATH.join(cwd, input);
            pyodide.globals.set('pygments_code', readText(inputPath));
            result = pyodide.runPython(`highlight(pygments_code, get_lexer_by_name(pygments_language), LatexFormatter(**pygments_options))`);
        }

        if (output) {
            const outputPath = PATH.isAbs(output) ? output : PATH.join(cwd, output);
            writeText(outputPath, result);
        }

        return { exit_code: 0 };
    });
})();
