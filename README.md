# TeXlyre BusyTeX

Run LaTeX compilation (pdflatex, xelatex, lualatex) directly in your browser using WebAssembly. This package bundles BusyTeX WASM for complete LaTeX document compilation without server-side dependencies.

## Features

- **XeLaTeX**: Compile LaTeX documents with XeTeX engine + bibtex8 + dvipdfmx
- **PdfLaTeX**: Compile LaTeX documents with PdfTeX engine + bibtex8
- **LuaLaTeX**: Compile LaTeX documents with LuaHBTeX engine + bibtex8
- **Multi-file Support**: Handle complex projects with multiple .tex and .bib files
- **SyncTeX Support**: Generate SyncTeX files for editor synchronization
- **BibTeX Integration**: Automatic bibliography processing

All compilation runs entirely in the browser with no server required.

## Installation
```bash
npm install texlyre-busytex
```

## Setup

Copy the required WASM and BusyTeX assets to your public directory:
```bash
npx texlyre-busytex copy-assets
```

This copies WebAssembly files and BusyTeX scripts to `./public/core/` by default.

For a custom location:
```bash
npx texlyre-busytex copy-assets ./static/wasm
```

## Usage

### Basic Example
```typescript
import { BusyTexRunner, XeLatex } from 'texlyre-busytex';

// Initialize the BusyTeX runner
const runner = new BusyTexRunner();
await runner.initialize();

// Compile a LaTeX document with XeLaTeX
const xelatex = new XeLatex(runner);
const result = await xelatex.compile({
  input: '\\documentclass{article}\n\\begin{document}\nHello World\n\\end{document}'
});

if (result.success && result.pdf) {
  // Display PDF
  const blob = new Blob([result.pdf], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  document.getElementById('preview').src = url;
}
```

### Configuration

If you copied assets to a custom location, configure the paths:
```typescript
const runner = new BusyTexRunner({
  busytexBasePath: '/wasm/busytex',
  verbose: true
});
```

### Multi-File LaTeX Projects
```typescript
const xelatex = new XeLatex(runner);

const result = await xelatex.compile({
  input: mainFileContent,
  bibtex: true,
  verbose: 'info',
  additionalFiles: [
    { path: 'chapter1.tex', content: chapter1Content },
    { path: 'chapter2.tex', content: chapter2Content },
    { path: 'references.bib', content: bibContent }
  ]
});

if (result.success) {
  console.log('PDF generated successfully');
  if (result.synctex) {
    console.log('SyncTeX file available');
  }
}
```

### Using Different Engines
```typescript
import { PdfLatex, XeLatex, LuaLatex } from 'texlyre-busytex';

// PdfLaTeX
const pdflatex = new PdfLatex(runner);
const pdfResult = await pdflatex.compile({
  input: latexContent,
  bibtex: true
});

// XeLaTeX
const xelatex = new XeLatex(runner);
const xeResult = await xelatex.compile({
  input: latexContent
});

// LuaLaTeX
const lualatex = new LuaLatex(runner);
const luaResult = await lualatex.compile({
  input: latexContent
});
```

### Compile Options
```typescript
const result = await xelatex.compile({
  input: string;                    // Main LaTeX content
  bibtex?: boolean;                 // Enable BibTeX processing
  verbose?: 'silent' | 'info' | 'debug';  // Verbosity level
  driver?: 'xetex_bibtex8_dvipdfmx' | 'pdftex_bibtex8' | 'luahbtex_bibtex8' | 'luatex_bibtex8';
  dataPackagesJs?: string[];        // Additional TeX Live packages
  additionalFiles?: {               // Additional .tex and .bib files
    path: string;
    content: string;
  }[];
});
```

### Worker vs Direct Mode
```typescript
// Use Web Worker (recommended for production)
await runner.initialize(true);

// Use direct mode (useful for debugging)
await runner.initialize(false);
```

## API Reference

### BusyTexRunner

The core runner for BusyTeX compilation.
```typescript
const runner = new BusyTexRunner({
  busytexBasePath?: string;  // Default: '/core/busytex'
  verbose?: boolean;         // Default: false
});

await runner.initialize(useWorker?: boolean);  // Default: true
```

### XeLatex

Compile LaTeX documents with XeTeX engine.
```typescript
const xelatex = new XeLatex(runner, verbose?);

const result = await xelatex.compile({
  input: string;
  bibtex?: boolean;
  verbose?: 'silent' | 'info' | 'debug';
  additionalFiles?: { path: string; content: string }[];
});
```

### PdfLatex

Compile LaTeX documents with PdfTeX engine.
```typescript
const pdflatex = new PdfLatex(runner, verbose?);

const result = await pdflatex.compile({
  input: string;
  bibtex?: boolean;
  verbose?: 'silent' | 'info' | 'debug';
  additionalFiles?: { path: string; content: string }[];
});
```

### LuaLatex

Compile LaTeX documents with LuaHBTeX engine.
```typescript
const lualatex = new LuaLatex(runner, verbose?);

const result = await lualatex.compile({
  input: string;
  bibtex?: boolean;
  verbose?: 'silent' | 'info' | 'debug';
  additionalFiles?: { path: string; content: string }[];
});
```

### Compile Result
```typescript
interface CompileResult {
  success: boolean;
  pdf?: Uint8Array;          // Compiled PDF
  synctex?: Uint8Array;      // SyncTeX file (if generated)
  log: string;               // Complete compilation log
  exitCode: number;          // Exit code
  logs: LogEntry[];          // Individual command logs
}
```

## Framework Integration

### Next.js
```bash
npx texlyre-busytex copy-assets ./public/core
```
```typescript
// pages/index.tsx or app/page.tsx
'use client'; // For App Router

import { BusyTexRunner, XeLatex } from 'texlyre-busytex';
import { useEffect, useState } from 'react';

export default function Page() {
  const [runner, setRunner] = useState<BusyTexRunner | null>(null);

  useEffect(() => {
    const initRunner = async () => {
      const r = new BusyTexRunner();
      await r.initialize();
      setRunner(r);
    };
    initRunner();
  }, []);

  // Use runner...
}
```

### Vite
```bash
npx texlyre-busytex copy-assets ./public/core
```
```typescript
import { BusyTexRunner, XeLatex } from 'texlyre-busytex';

const runner = new BusyTexRunner();
await runner.initialize();
```

### Create React App
```bash
npx texlyre-busytex copy-assets ./public/core
```

Same usage as Vite example above.

### Custom Setup

For custom static file servers, copy assets to your static directory and configure paths:
```bash
npx texlyre-busytex copy-assets ./static/latex-tools
```
```typescript
const runner = new BusyTexRunner({
  busytexBasePath: '/latex-tools/busytex'
});
```

## Building from Source
```bash
git clone https://github.com/TeXlyre/texlyre-busytex.git
cd texlyre-busytex
npm install
npm run build
```

## Examples

### Running the Demo

To run the interactive demo locally:
```bash
npm install
npm run build
npm run example
```

Then open `http://localhost:3000` in your browser.

### GitHub Pages Demo

To run the GitHub Pages example:
```bash
npm run build:pages-example
npm run pages-example
```

## Asset Management

### Copy Command
```bash
# Default location (./public/core)
npx texlyre-busytex copy-assets

# Custom location
npx texlyre-busytex copy-assets ./static/wasm

# In package.json scripts
{
  "scripts": {
    "postinstall": "texlyre-busytex copy-assets"
  }
}
```

### Asset Structure

After running `copy-assets`, your directory will contain:
```
public/core/
└── busytex/
    ├── busytex.js
    ├── busytex.wasm
    ├── busytex_pipeline.js
    ├── busytex_worker.js
    ├── texlive-basic.js
    ├── texlive-basic.data
    └── (additional TeXLive packages)
```

## Performance Considerations

- **First Load**: BusyTeX WASM initialization takes 2-5 seconds
- **Subsequent Compilations**: Fast (seconds for typical documents)
- **Large Documents**: Multi-file projects process efficiently
- **Memory**: Each compilation uses temporary WASM filesystem
- **Worker Mode**: Recommended for production to avoid blocking main thread

## Troubleshooting

### Assets Not Found (404)

Ensure you've run the copy command and configured paths correctly:
```bash
npx texlyre-busytex copy-assets
```

### CORS Errors

Make sure your development server serves the assets directory. Most frameworks handle this automatically for the `public/` directory.

### Timeout Errors

For very large documents, compilation may take longer. The default timeout is 120 seconds.

### Memory Issues

BusyTeX runs in WASM with limited memory. For very large projects, consider splitting into smaller compilations.

### Compilation Errors

Check the `log` field in the result for detailed error messages:
```typescript
if (!result.success) {
  console.error('Compilation failed:');
  console.error(result.log);
}
```

## Acknowledgments

- [BusyTeX](https://github.com/aslushnikov/busytex) - LaTeX compiled to WebAssembly
- [TeX Live](https://tug.org/texlive/) - Comprehensive TeX distribution

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

AGPL-3.0 License © 2025 [Fares Abawi](https://abawi.me)