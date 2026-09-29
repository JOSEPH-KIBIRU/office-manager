declare module "pdfjs-dist/legacy/build/pdf.mjs" {
  export interface PdfTextItem {
    str: string;
    transform: number[];
  }
  export interface PdfTextContent {
    items: Array<PdfTextItem | { type: string }>;
  }
  export interface PdfPage {
    getTextContent(): Promise<PdfTextContent>;
  }
  export interface PdfDocument {
    numPages: number;
    getPage(pageNumber: number): Promise<PdfPage>;
  }
  export function getDocument(src: unknown): { promise: Promise<PdfDocument> };
}
