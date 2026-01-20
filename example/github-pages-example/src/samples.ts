export const sampleLatex = `\\documentclass{article}
\\usepackage{amsmath}

\\begin{document}

\\section{Introduction}
This is a sample LaTeX document compiled with BusyTeX.

\\subsection{Math Example}
Here is an equation:
\\begin{equation}
E = mc^2
\\end{equation}

\\end{document}`;

export const multiFileSample = `\\documentclass{article}
\\usepackage{amsmath}

\\title{Multi-File Document Example}
\\author{Demo Author}

\\begin{document}

\\maketitle

\\input{introduction.tex}
\\input{methods.tex}

\\section{Results}
The results are shown in the following sections.

\\input{results.tex}

\\section{Conclusion}
This demonstrates multi-file compilation with BusyTeX.
As shown by Author et al.~\\cite{sample2023}, this approach is effective.
The methodology follows established practices~\\cite{example2022}.

\\bibliographystyle{plain}
\\bibliography{references}

\\end{document}`;

export const introductionSample = `\\section{Introduction}
LaTeX is a document preparation system for high-quality typesetting.
It is most often used for medium-to-large technical or scientific documents.
Previous work by Author and Writer~\\cite{sample2023} has shown this to be effective.

\\subsection{Background}
This section provides background information about the topic.
The content here demonstrates how included files are counted separately.`;

export const methodsSample = `\\section{Methods}
This section describes the methodology used in the research.

\\subsection{Experimental Setup}
We designed a controlled experiment with the following parameters.
Multiple measurements were taken to ensure accuracy, following the guidelines in~\\cite{example2022}.

\\subsection{Data Collection}
Data was collected over a period of six months using automated tools.`;

export const resultsSample = `\\subsection{Statistical Analysis}
The results show a significant correlation between variables, as predicted by~\\cite{sample2023}.
Table 1 summarizes the key findings from our analysis.

\\subsection{Discussion}
These findings suggest that the hypothesis is supported by the data.
Further research is needed to validate these results.`;

export const referencesSample = `@article{sample2023,
  title={Sample Article Title},
  author={Author, John and Writer, Jane},
  journal={Journal of Examples},
  volume={42},
  pages={123--145},
  year={2023}
}

@book{example2022,
  title={Example Book on Documentation},
  author={Editor, Alice},
  publisher={Academic Press},
  year={2022}
}`;