# TeXlyre BusyTeX

Run LaTeX compilation directly in your browser using WebAssembly. Supports XeLaTeX, PdfLaTeX, and LuaLaTeX with BibTeX integration.

[![npm version](https://img.shields.io/npm/v/texlyre-busytex.svg)](https://www.npmjs.com/package/texlyre-busytex)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[Live Demo](https://texlyre.github.io/texlyre-busytex/) | [GitHub](https://github.com/TeXlyre/texlyre-busytex)

## Features

- **XeLaTeX**: Compile with XeTeX engine + bibtex8 + dvipdfmx
- **PdfLaTeX**: Compile with PdfTeX engine + bibtex8
- **LuaLaTeX**: Compile with LuaHBTeX engine + bibtex8
- **Multi-file Support**: Handle complex projects with multiple .tex and .bib files
- **SyncTeX**: Generate SyncTeX files for editor synchronization
- **Browser-based**: All compilation runs entirely in the browser with no server required
- **Web Worker Support**: Non-blocking compilation using Web Workers

## Installation
```bash
npm install texlyre-busytex
```

### Download Assets

BusyTeX requires WASM files (~175MB) that are hosted on GitHub Releases:
```bash
# Download to default location (./public/core)
npx texlyre-busytex download-assets

# Or specify custom location
npx texlyre-busytex download-assets ./static/wasm
npx texlyre-busytex download-assets ./public/assets
```

Assets will be downloaded to `<destination>/busytex/` directory.

## Usage

### Basic Example
```javascript
import { BusyTexRunner, XeLatex } from 'texlyre-busytex';

const runner = new BusyTexRunner({
  busytexBasePath: '/core/busytex'
});

await runner.initialize();

const xelatex = new XeLatex(runner);
const result = await xelatex.compile({
  input: `\\documentclass{article}
\\usepackage{amsmath}

\\begin{document}
\\section{Introduction}
Hello, LaTeX!

\\begin{equation}
E = mc^2
\\end{equation}
\\end{document}`
});

if (result.success && result.pdf) {
  const blob = new Blob([result.pdf], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  window.open(url);
}
```

### With BibTeX
```javascript
const result = await xelatex.compile({
  input: `\\documentclass{article}
\\begin{document}
\\cite{sample2023}
\\bibliographystyle{plain}
\\bibliography{references}
\\end{document}`,
  bibtex: true,
  additionalFiles: [
    {
      path: 'references.bib',
      content: `@article{sample2023,
  title={Sample Article},
  author={Author, John},
  year={2023}
}`
    }
  ]
});
```

### Multi-file Projects
```javascript
const result = await xelatex.compile({
  input: `\\documentclass{article}
\\begin{document}
\\input{chapter1.tex}
\\input{chapter2.tex}
\\end{document}`,
  additionalFiles: [
    {
      path: 'chapter1.tex',
      content: '\\section{Chapter 1}\nContent...'
    },
    {
      path: 'chapter2.tex',
      content: '\\section{Chapter 2}\nContent...'
    }
  ]
});
```

### Using PdfLaTeX or LuaLaTeX
```javascript
import { PdfLatex, LuaLatex } from 'texlyre-busytex';

const pdflatex = new PdfLatex(runner);
const result = await pdflatex.compile({ input: '...' });

const lualatex = new LuaLatex(runner);
const result2 = await lualatex.compile({ input: '...' });
```

### With Web Worker
```javascript
const runner = new BusyTexRunner({
  busytexBasePath: '/core/busytex',
  verbose: true
});

await runner.initialize(true); // true = use Web Worker
```

### SyncTeX Support
```javascript
const result = await xelatex.compile({ input: '...' });

if (result.synctex) {
  const blob = new Blob([result.synctex], { type: 'application/gzip' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = 'main.synctex.gz';
  link.click();
}
```

## API Reference

### `BusyTexRunner`
```typescript
constructor(config?: BusyTexConfig)
```

**Config Options:**
- `busytexBasePath`: Path to BusyTeX assets (default: `'/core/busytex'`)
- `verbose`: Enable verbose logging (default: `false`)

**Methods:**
- `initialize(useWorker?: boolean): Promise<void>` - Initialize the runner
- `isInitialized(): boolean` - Check if initialized
- `terminate(): void` - Clean up resources

### `XeLatex`, `PdfLatex`, `LuaLatex`
```typescript
constructor(runner: BusyTexRunner, verbose?: boolean)
compile(options: CompileOptions): Promise<CompileResult>
```

**CompileOptions:**
- `input`: Main LaTeX document content
- `bibtex?`: Enable BibTeX compilation (default: `false`)
- `verbose?`: Verbosity level - `'silent'`, `'info'`, or `'debug'` (default: `'silent'`)
- `additionalFiles?`: Array of `{ path: string, content: string }`

**CompileResult:**
- `success`: Compilation succeeded
- `pdf?`: PDF output as Uint8Array
- `synctex?`: SyncTeX output as Uint8Array
- `log`: Compilation log
- `exitCode`: Process exit code
- `logs`: Detailed log entries

## Development

### Clone and Setup
```bash
git clone https://github.com/TeXlyre/texlyre-busytex.git
cd texlyre-busytex
npm install
npm run download-assets
npm run build
```

### Run Example
```bash
npm run example
```

Then open http://localhost:3000

### Upload Assets (Maintainers)
```bash
# Create archive and upload to GitHub Releases
npm run upload-assets
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Workflow

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Download assets: `npm run download-assets`
4. Make your changes
5. Build: `npm run build`
6. Test with example: `npm run example`
7. Commit your changes (`git commit -m 'Add amazing feature'`)
8. Push to the branch (`git push origin feature/amazing-feature`)
9. Open a Pull Request

# Limitations

This is an experimental build of [TeXLive 2025](https://ctan.org/pkg/texlive) with the intent of integration into [TeXlyre](https://texlyre.org). Sustained work on this package is not guaranteed and major changes may be introduced at any time.

Besides bibtex8, pdftex, luatex, xetex, dvipdf, other packages are not included. Additionally, some fonts, as well as external scripts called through `shell-escape` are not available. 

## License

MIT License © [Fares Abawi](https://abawi.me)

This project uses BusyTeX WASM, which is licensed under the MIT license.

## Acknowledgments

Built with [BusyTeX](https://github.com/busytex/busytex) - A WebAssembly port of TeX Live.