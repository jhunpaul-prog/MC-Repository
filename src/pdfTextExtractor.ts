// @ts-ignore - ignore TS for CommonJS compatibility
import pdfjsLib from 'pdfjs-dist';
// @ts-ignore - import the worker correctly for Vite
import workerSrc from 'pdfjs-dist/build/pdf.worker.min?url';

// Assign the worker
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

// Function to extract text from PDF
export const extractPdfText = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async () => {
      try {
        const typedArray = new Uint8Array(reader.result as ArrayBuffer);
        const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;

        let extractedText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const strings = content.items.map((item: any) => item.str);
          extractedText += strings.join(' ') + '\n';
        }

        resolve(extractedText);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};
