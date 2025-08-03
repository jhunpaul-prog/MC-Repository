import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.js?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export const extractPdfText = async (
  file: File
): Promise<{
  title: string;
  authors: string;
  doi: string;
  rawText: string;
  pageCount: number;
}> => {
  const reader = new FileReader();

  return new Promise((resolve, reject) => {
    reader.onload = async () => {
      try {
        const typedArray = new Uint8Array(reader.result as ArrayBuffer);
        const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;

        let extractedText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const strings = content.items.map((item: any) => item.str);
          extractedText += strings.join('\n') + '\n';
        }

        // Generalized title extraction
        const lines = extractedText.split('\n').map((line) => line.trim()).filter(Boolean);
        const abstractIndex = lines.findIndex((l) => /abstract/i.test(l));
        const preAbstractLines = lines.slice(0, abstractIndex === -1 ? 5 : abstractIndex);


        let title = 'Unknown Title';

        // Try to guess title: usually first line that's long and before "Abstract"
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const nextLine = lines[i + 1] || '';
          const isBeforeAbstract = !/abstract/i.test(line) && !/abstract/i.test(nextLine);

          if (line.length > 15 && line.length < 300 && /^[A-Z\s\d:,"'-]+$/i.test(line) && isBeforeAbstract) {
            title = line;
            break;
          }
        }

        // Author extraction: lines before Abstract that look like names
        const authorsBlock = lines.slice(0, lines.findIndex((l) => /abstract/i.test(l)));
        const authors = authorsBlock
          .filter((line) => /^[A-Z][a-z]+\s+[A-Z][a-z]+/.test(line)) // crude name match
          .join(', ');

        // DOI extraction
        const doiMatch = extractedText.match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i);
        const doi = doiMatch?.[0] || '';

        resolve({
          title,
          authors: authors || 'Unknown Author(s)',
          doi,
          rawText: extractedText,
          pageCount: pdf.numPages, 
        });
      } catch (err: any) {
        console.error('[extractPdfText] Error:', err);
        reject(new Error('PDF extraction failed: ' + err.message));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read PDF file.'));
    reader.readAsArrayBuffer(file);
  });
};
