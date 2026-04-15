import basicMain from './basic/main.tex';
import multilingualMain from './multilingual/main.tex';
import olmultilingualMain from './ol-multilingual/main.tex';
import pymultilingualMain from './py-multilingual/main.tex';
import ltxTalkMain from './ltx-talk/main.tex';
import parabola from './ltx-talk/parabola.pdf';
import multifileMain from './multifile/main.tex';
import multifileIntroduction from './multifile/introduction.tex';
import multifileMethods from './multifile/methods.tex';
import multifileResults from './multifile/results.tex';
import multifileReferences from './multifile/references.bib';
import figureMain from './figure/main.tex';
import texlyrePng from './figure/TeXlyre.png';
import makeindex from './makeindex/main.tex'
import borders from './borders/main.tex'

function base64ToUint8Array(dataUrl: string): Uint8Array {
    const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
    const raw = atob(base64);
    const arr = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
}

export interface SampleFile {
    path: string;
    content: string | Uint8Array;
}

export interface Sample {
    name: string;
    compiler: 'xelatex' | 'pdflatex' | 'lualatex';
    files: SampleFile[];
    options?: {
        bibtex?: boolean;
        makeindex?: boolean;
        rerun?: boolean;
    };
}

export const samples: Sample[] = [
    {
        name: 'Basic',
        compiler: 'xelatex',
        files: [{ path: 'main.tex', content: basicMain }]
    },
    {
        name: 'Multilingual (pdfTeX)',
        compiler: 'pdflatex',
        files: [{ path: 'main.tex', content: multilingualMain }]
    },
    {
        name: 'Overleaf Multilingual (XeTeX|LuaTeX)',
        compiler: 'xelatex',
        files: [{ path: 'main.tex', content: olmultilingualMain }]
    },
    {
        name: 'Polyglossia Multilingual (XeTeX)',
        compiler: 'xelatex',
        files: [{ path: 'main.tex', content: pymultilingualMain }]
    },
    {
        name: 'LTX Talk (LuaTeX)',
        compiler: 'lualatex',
        files: [
            { path: 'main.tex', content: ltxTalkMain },
            { path: 'parabola.pdf', content: base64ToUint8Array(parabola) }
        ],
        options: { rerun: true }
    },
    {
        name: 'Multi-File with BibTeX',
        compiler: 'xelatex',
        files: [
            { path: 'main.tex', content: multifileMain },
            { path: 'introduction.tex', content: multifileIntroduction },
            { path: 'methods.tex', content: multifileMethods },
            { path: 'results.tex', content: multifileResults },
            { path: 'references.bib', content: multifileReferences }
        ],
        options: { bibtex: true, rerun: true }
    },
    {
        name: 'Figure',
        compiler: 'pdflatex',
        files: [
            { path: 'main.tex', content: figureMain },
            { path: 'TeXlyre.png', content: base64ToUint8Array(texlyrePng) }
        ]
    },
    {
        name: 'Make Index',
        compiler: 'pdflatex',
        files: [
            { path: 'main.tex', content: makeindex }
        ],
        options: { makeindex: true, rerun: true }
    },
    {
        name: 'Beautiful Design Borders (pdfTeX|LuaTeX)',
        compiler: 'pdflatex',
        files: [
            { path: 'main.tex', content: borders }
        ],
        options: { rerun: true }
    },
];
