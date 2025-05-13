import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface ProductData {
  idea: string;
  productVision: string;
  productGoals: string;
  targetAudience: string;
  keyFeatures: string;
}

export const exportToPdf = async (productData: ProductData, techSpec: string, fileName: string = 'document') => {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageHeight = pdf.internal.pageSize.getHeight();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 15;
  const maxLineWidth = pageWidth - margin * 2;
  let yPosition = margin;

  // Add a title
  pdf.setFont('Arial', 'bold'); // Set font for main title
  pdf.setFontSize(22);
  pdf.setTextColor(40, 40, 40); // Dark gray
  pdf.text('VisionCraft: Документация по продукту', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 15;

  // Helper to add text and handle page breaks
  const addTextSection = (title: string, content: string) => {
    // Ensure space for title
    if (yPosition + 10 > pageHeight - margin) { 
      pdf.addPage();
      yPosition = margin;
    }
    pdf.setFont('Arial', 'bold'); // Set font for section title
    pdf.setFontSize(16);
    pdf.setTextColor(0, 128, 128); // Teal for titles
    pdf.text(title, margin, yPosition);
    yPosition += 8;

    const lines = pdf.splitTextToSize(content, maxLineWidth);
    lines.forEach((line: string) => {
      // Ensure space for this line of content
      if (yPosition + 5 > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
      }
      // Set font for content line (AFTER potential page break)
      pdf.setFont('Arial', 'normal'); 
      pdf.setFontSize(11);
      pdf.setTextColor(50, 50, 50); // Normal text color
      pdf.text(line, margin, yPosition);
      yPosition += 5; // Line height
    });
    yPosition += 5; // Extra space after section
  };

  // Product Card Section
  // For "Карточка продукта", we'll use the same style as other section titles.
  // We call addTextSection for each sub-item, which is fine.
  
  addTextSection('Идея', productData.idea);
  addTextSection('Видение продукта', productData.productVision);
  addTextSection('Цели продукта', productData.productGoals);
  addTextSection('Целевая аудитория', productData.targetAudience);
  addTextSection('Ключевые функции', productData.keyFeatures);
  
  yPosition += 5; // Space before Tech Spec, adjusted from 10 to 5 as addTextSection adds 5 already.

  // Technical Specification Section
  addTextSection('Техническое Задание', techSpec);

  pdf.save(`${fileName}.pdf`);
};

// Fallback if HTML elements are used (not the current primary method for simplicity)
export const exportHtmlElementToPdf = async (elementId: string, fileName: string = 'document') => {
  const input = document.getElementById(elementId);
  if (!input) {
    console.error(`Element with id ${elementId} not found.`);
    throw new Error(`Element with id ${elementId} not found.`);
  }

  // Temporarily increase resolution for better quality
  const originalWidth = input.style.width;
  const originalHeight = input.style.height;
  input.style.width = (input.offsetWidth * 2) + 'px';
  input.style.height = (input.offsetHeight * 2) + 'px';
  
  const canvas = await html2canvas(input, {
    scale: 2, // Increase scale for better resolution
    useCORS: true,
    logging: true,
    onclone: (document) => {
      // Ensure text is selectable in the captured image if possible (complex)
      // For now, this mainly helps with styles.
    }
  });

  // Restore original size
  input.style.width = originalWidth;
  input.style.height = originalHeight;

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF('p', 'mm', 'a4');
  const imgProps = pdf.getImageProperties(imgData);
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
  
  const pageHeightInternal = pdf.internal.pageSize.getHeight();

  if (pdfHeight < pageHeightInternal) { // Changed pageHeight to pageHeightInternal for clarity
     pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
  } else {
    // Handle multi-page PDF for long content
    let position = 0; // y-position in the source canvas image, in pixels
    const canvasTotalHeight = canvas.height; // total height of the source canvas in pixels
    const canvasWidth = canvas.width; // width of the source canvas in pixels

    while(position < canvasTotalHeight) {
      // Calculate the height of the segment to draw from the source canvas for the current PDF page
      // This needs to be in source canvas pixel units.
      // Max segment height in PDF units for one page is pageHeightInternal.
      // Max segment height in canvas pixels = pageHeightInternal * (canvasWidth / pdfWidth)
      const maxSegmentHeightInCanvasPixels = pageHeightInternal * (canvasWidth / pdfWidth);
      const remainingCanvasHeight = canvasTotalHeight - position;
      const currentSegmentHeightInCanvasPixels = Math.min(remainingCanvasHeight, maxSegmentHeightInCanvasPixels);

      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvasWidth;
      pageCanvas.height = currentSegmentHeightInCanvasPixels;
      
      const ctx = pageCanvas.getContext('2d');
      if (ctx) {
        // Draw the segment of the original canvas onto the page canvas
        // sX, sY, sWidth, sHeight, dX, dY, dWidth, dHeight
        // sY is `position`
        ctx.drawImage(canvas, 0, position, canvasWidth, currentSegmentHeightInCanvasPixels, 0, 0, canvasWidth, currentSegmentHeightInCanvasPixels);
      }
      
      const pageImgData = pageCanvas.toDataURL('image/png');
      
      if (position > 0) { // Add new page for subsequent segments
        pdf.addPage();
      }
      // Calculate the height of this segment when rendered in the PDF
      const segmentPdfHeight = currentSegmentHeightInCanvasPixels * (pdfWidth / canvasWidth);
      pdf.addImage(pageImgData, 'PNG', 0, 0, pdfWidth, segmentPdfHeight);
      
      position += currentSegmentHeightInCanvasPixels;
    }
  }
  pdf.save(`${fileName}.pdf`);
};
