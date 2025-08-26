// src/types/pdfjs-shims.d.ts

// Minimal shims so TS stops complaining about these build paths / ?url imports.
declare module "pdfjs-dist/legacy/build/pdf" {
  // We don't need full types here; keep it lightweight.
  export const GlobalWorkerOptions: any;
  export function getDocument(src: any): { promise: Promise<any> };
}

declare module "pdfjs-dist/build/pdf.worker.min?url" {
  const url: string;
  export default url;
}

// If you don't already have a global ?url shim:
declare module "*?url" {
  const url: string;
  export default url;
}
