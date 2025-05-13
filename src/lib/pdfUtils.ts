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
  pdf.setFontSize(22);
  pdf.setTextColor(40, 40, 40); // Dark gray
  pdf.text('VisionCraft: Документация по продукту', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 15;

  // Helper to add text and handle page breaks
  const addTextSection = (title: string, content: string) => {
    if (yPosition + 10 > pageHeight - margin) { // Check for new page before title
      pdf.addPage();
      yPosition = margin;
    }
    pdf.setFontSize(16);
    pdf.setTextColor(0, 128, 128); // Teal for titles
    pdf.text(title, margin, yPosition);
    yPosition += 8;

    pdf.setFontSize(11);
    pdf.setTextColor(50, 50, 50); // Normal text color
    const lines = pdf.splitTextToSize(content, maxLineWidth);
    lines.forEach((line: string) => {
      if (yPosition + 5 > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
      }
      pdf.text(line, margin, yPosition);
      yPosition += 5; // Line height
    });
    yPosition += 5; // Extra space after section
  };

  // Product Card Section
  addTextSection('Карточка продукта', ''); // Title for section
  yPosition -=5; // remove extra space after section title for subsections
  
  addTextSection('Идея', productData.idea);
  addTextSection('Видение продукта', productData.productVision);
  addTextSection('Цели продукта', productData.productGoals);
  addTextSection('Целевая аудитория', productData.targetAudience);
  addTextSection('Ключевые функции', productData.keyFeatures);
  
  yPosition += 10; // Space before Tech Spec

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
  
  let currentHeight = 0;
  const pageHeight = pdf.internal.pageSize.getHeight();

  if (pdfHeight < pageHeight) {
     pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
  } else {
    // Handle multi-page PDF for long content
    let position = 0;
    while(position < pdfHeight) {
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      // Calculate height of the current page segment
      const segmentHeight = Math.min(canvas.height - position * (canvas.width / pdfWidth), pageHeight * (canvas.width / pdfWidth));
      pageCanvas.height = segmentHeight;
      const ctx = pageCanvas.getContext('2d');
      // Draw the segment of the original canvas onto the page canvas
      ctx?.drawImage(canvas, 0, -position * (canvas.width / pdfWidth) , canvas.width, canvas.height);
      const pageImgData = pageCanvas.toDataURL('image/png');
      
      if (position > 0) {
        pdf.addPage();
      }
      pdf.addImage(pageImgData, 'PNG', 0, 0, pdfWidth, segmentHeight * (pdfWidth/canvas.width) );
      position += segmentHeight / (canvas.width / pdfWidth) ;
    }
  }
  pdf.save(`${fileName}.pdf`);
};
