export interface ConvertedImage {
  buffer: Buffer;
  pageNumber: number;
  mimeType: string;
}

/**
 * Converts a PDF file to JPG images (one per page)
 * @param pdfBuffer - The PDF file as a Buffer
 * @returns Array of image buffers, one for each page
 */
export async function convertPdfToJpgImages(pdfBuffer: Buffer): Promise<ConvertedImage[]> {
  try {
    // Dynamically import mupdf to handle top-level await
    const mupdf = await import('mupdf');
    
    // Convert buffer to Uint8Array
    const pdfData = new Uint8Array(pdfBuffer);
    
    // Load the PDF document
    const doc = mupdf.default.Document.openDocument(pdfData);
    const pageCount = doc.countPages();
    const images: ConvertedImage[] = [];

    // Get RGB colorspace for rendering
    const rgbColorSpace = mupdf.default.ColorSpace.DeviceRGB;

    // Convert each page to a JPG image
    // Using 2.0 scale factor for better quality
    const scale = 2.0;
    
    for (let i = 0; i < pageCount; i++) {
      const page = doc.loadPage(i);
      
      // Create transformation matrix for scaling
      const matrix = mupdf.default.Matrix.scale(scale, scale);
      
      // Render page to pixmap
      const pixmap = page.toPixmap(matrix, rgbColorSpace, false);
      
      // Convert pixmap to JPEG (quality: 95)
      const jpgData = pixmap.asJPEG(95);
      
      images.push({
        buffer: Buffer.from(jpgData),
        pageNumber: i + 1,
        mimeType: 'image/jpeg',
      });
    }

    return images;
  } catch (error) {
    throw new Error(`Failed to convert PDF to images: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

