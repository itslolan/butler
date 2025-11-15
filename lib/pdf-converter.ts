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
    const mupdfModule = await import('mupdf');
    // Use the default export which contains all the classes
    const mupdf = mupdfModule.default;
    
    if (!mupdf) {
      throw new Error('MuPDF default export not found');
    }
    
    if (!mupdf.Document) {
      throw new Error('MuPDF Document class not found');
    }
    
    if (typeof mupdf.Document.openDocument !== 'function') {
      throw new Error(`Document.openDocument is not a function. Type: ${typeof mupdf.Document.openDocument}`);
    }
    
    // Convert buffer to Uint8Array
    const pdfData = new Uint8Array(pdfBuffer);
    
    // Load the PDF document
    const doc = mupdf.Document.openDocument(pdfData);
    
    if (!doc) {
      throw new Error('Failed to open PDF document');
    }
    
    const pageCount = doc.countPages();
    const images: ConvertedImage[] = [];

    // Get RGB colorspace for rendering
    if (!mupdf.ColorSpace || !mupdf.ColorSpace.DeviceRGB) {
      throw new Error('ColorSpace.DeviceRGB not found');
    }
    const rgbColorSpace = mupdf.ColorSpace.DeviceRGB;

    // Convert each page to a JPG image
    // Using 2.0 scale factor for better quality
    const scale = 2.0;
    
    for (let i = 0; i < pageCount; i++) {
      const page = doc.loadPage(i);
      
      if (!page) {
        throw new Error(`Failed to load page ${i + 1}`);
      }
      
      // Create transformation matrix for scaling
      const matrix = mupdf.Matrix.scale(scale, scale);
      
      // Render page to pixmap
      const pixmap = page.toPixmap(matrix, rgbColorSpace, false);
      
      if (!pixmap) {
        throw new Error(`Failed to render page ${i + 1} to pixmap`);
      }
      
      // Convert pixmap to JPEG (quality: 95)
      const jpgData = pixmap.asJPEG(95);
      
      if (!jpgData) {
        throw new Error(`Failed to convert page ${i + 1} to JPEG`);
      }
      
      images.push({
        buffer: Buffer.from(jpgData),
        pageNumber: i + 1,
        mimeType: 'image/jpeg',
      });
    }

    return images;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('PDF conversion error:', errorMessage, errorStack);
    throw new Error(`Failed to convert PDF to images: ${errorMessage}`);
  }
}

