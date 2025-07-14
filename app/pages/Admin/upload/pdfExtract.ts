// 📁 src/utils/pdfExtract.ts
export const extractTextFromPDF = async (file: File): Promise<string> => {
  if (typeof window === "undefined") return "";

  const pdfjsLib = await import("pdfjs-dist");

  // Set worker path dynamically
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

  const reader = new FileReader();

  return new Promise((resolve) => {
    reader.onload = async () => {
      if (!reader.result) return resolve('');

      const typedArray = new Uint8Array(reader.result as ArrayBuffer);
      const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;

      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();

        const pageText = content.items
          .map((item) => ('str' in item ? (item as any).str : ''))
          .join(' ');

        fullText += pageText + '\n';
      }

      resolve(fullText);
    };

    reader.readAsArrayBuffer(file);
  });
};
