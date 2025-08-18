import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.js?url";

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfjsWorker;

export const extractPdfText = async (
  file: File
): Promise<{
  pages: number; // required by your type
  title: string;
  authors: string;
  doi: string;
  rawText: string;
  pageCount: number; // you also keep this for convenience
}> => {
  const reader = new FileReader();

  return new Promise((resolve, reject) => {
    reader.onload = async () => {
      try {
        const typedArray = new Uint8Array(reader.result as ArrayBuffer);
        const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;

        let extractedText = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const strings = (content.items as any[]).map((item: any) => item.str);
          extractedText += strings.join("\n") + "\n";
        }

        // Basic heuristics
        const lines = extractedText
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);

        let title = "Unknown Title";
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const nextLine = lines[i + 1] || "";
          const isBeforeAbstract =
            !/abstract/i.test(line) && !/abstract/i.test(nextLine);
          if (
            line.length > 15 &&
            line.length < 300 &&
            /^[A-Z\s\d:,"'-]+$/i.test(line) &&
            isBeforeAbstract
          ) {
            title = line;
            break;
          }
        }

        const authorsBlock = lines.slice(
          0,
          lines.findIndex((l) => /abstract/i.test(l))
        );
        const authors =
          authorsBlock
            .filter((line) => /^[A-Z][a-z]+\s+[A-Z][a-z]+/.test(line))
            .join(", ") || "Unknown Author(s)";

        const doiMatch = extractedText.match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i);
        const doi = doiMatch?.[0] || "";

        resolve({
          pages: pdf.numPages, // ✅ add this
          title,
          authors,
          doi,
          rawText: extractedText,
          pageCount: pdf.numPages, // keep if other code expects it
        });
      } catch (err: any) {
        console.error("[extractPdfText] Error:", err);
        reject(new Error("PDF extraction failed: " + err.message));
      }
    };

    reader.onerror = () => reject(new Error("Failed to read PDF file."));
    reader.readAsArrayBuffer(file);
  });
};
