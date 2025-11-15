import { createMuPdf } from 'mupdf';

export interface ConvertedImage {
  buffer: Buffer;
  pageNumber: number;
  mimeType: string;
}

// Cache the mupdf instance to avoid re-initialization
let mupdfInstance: Awaited<ReturnType<typeof createMuPdf>> | null = null;

async function getMuPdfInstance() {
  if (!mupdfInstance) {
    mupdfInstance = await createMuPdf();
  }
  return mupdfInstance;
}

/**
 * Converts a PDF file to JPG images (one per page)
 * @param pdfBuffer - The PDF file as a Buffer
 * @returns Array of image buffers, one for each page
 */
export async function convertPdfToJpgImages(pdfBuffer: Buffer): Promise<ConvertedImage[]> {
  try {
    // Initialize MuPDF
    const mupdf = await getMuPdfInstance();
    
    // Convert buffer to Uint8Array
    const pdfData = new Uint8Array(pdfBuffer);
    
    // Load the PDF document
    const doc = mupdf.load(pdfData);
    const pageCount = doc.countPages();
    const images: ConvertedImage[] = [];

    // Convert each page to a JPG image
    // Using 2.0 scale factor for better quality
    for (let i = 0; i < pageCount; i++) {
      const page = doc.loadPage(i);
      const pixmap = page.toPixmap(2.0); // Render at 2x resolution for better quality
      const jpgBuffer = pixmap.toBuffer('jpeg');
      
      images.push({
        buffer: Buffer.from(jpgBuffer),
        pageNumber: i + 1,
        mimeType: 'image/jpeg',
      });
    }

    return images;
  } catch (error) {
    throw new Error(`Failed to convert PDF to images: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

