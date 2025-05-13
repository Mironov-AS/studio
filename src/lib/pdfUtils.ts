import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface ProductData {
  idea: string;
  productVision: string;
  productGoals: string;
  targetAudience: string;
  keyFeatures: string;
}

// Helper function to add canvas (as image) to PDF with pagination
async function addCanvasToPdf(pdf: jsPDF, canvas: HTMLCanvasElement, initialYPosition: number) {
  const imgData = canvas.toDataURL('image/png');
  const imgProps = pdf.getImageProperties(imgData);
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfPageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15; // Consistent margin

  const contentWidth = pdfWidth - margin * 2;
  // Calculate the height of the image if it were scaled to contentWidth
  // This is not directly used for PDF segment height, but helps understand scale
  // const scaledContentHeight = (imgProps.height * contentWidth) / imgProps.width;


  let currentYOnPage = initialYPosition;
  let sourceImageY = 0; // Y position in the source canvas (original full image)

  while (sourceImageY < imgProps.height) {
    if (currentYOnPage !== initialYPosition && sourceImageY !== 0) { // Need a new page if not the first chunk overall
      pdf.addPage();
      currentYOnPage = margin; // Reset Y for new page
    }

    // Calculate how much of the PDF page height is available for this chunk
    const availablePdfPageHeight = pdfPageHeight - currentYOnPage - margin;
    
    // Convert this available PDF height back to source image pixels
    // (how many pixels from the source image can fit into availablePdfPageHeight)
    const sourceSliceHeight = Math.min(
      imgProps.height - sourceImageY, // Remaining height of the source image
      availablePdfPageHeight * (imgProps.width / contentWidth) // Max source image height that fits
    );

    if (sourceSliceHeight <= 0) { // No more content or no space
        break;
    }

    // Create a temporary canvas for the current slice
    const segmentCanvas = document.createElement('canvas');
    segmentCanvas.width = imgProps.width;
    segmentCanvas.height = sourceSliceHeight;
    const segmentCtx = segmentCanvas.getContext('2d');
    
    if (segmentCtx) {
      // Draw the slice from the original large canvas onto the temporary segment canvas
      segmentCtx.drawImage(canvas, 0, sourceImageY, imgProps.width, sourceSliceHeight, 0, 0, imgProps.width, sourceSliceHeight);
    }
    
    const segmentImgData = segmentCanvas.toDataURL('image/png');
    // Calculate the height this segment will occupy in the PDF
    const segmentPdfHeight = (sourceSliceHeight * contentWidth) / imgProps.width;

    pdf.addImage(segmentImgData, 'PNG', margin, currentYOnPage, contentWidth, segmentPdfHeight);

    currentYOnPage += segmentPdfHeight + 5; // Add some spacing for the next element on the same page
    sourceImageY += sourceSliceHeight;
  }
  return currentYOnPage; // Return the Y position after adding this content
}


export const exportToPdf = async (productData: ProductData, techSpec: string, fileName: string = 'document') => {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageHeight = pdf.internal.pageSize.getHeight();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 15;
  let yPosition = margin;

  // Add a title (text-based)
  // This might still have issues if the chosen font doesn't support Cyrillic well.
  // Using 'Helvetica' as a very basic fallback.
  try {
    // jsPDF doesn't bundle Arial. It might try to use a system font if available,
    // but this is unreliable for Cyrillic without embedding.
    // Helvetica is one of the 14 standard PDF fonts, but with limited charsets.
    pdf.setFont('Helvetica', 'bold'); 
  } catch (e) {
    console.warn("Failed to set font, jsPDF will use its default.");
  }
  pdf.setFontSize(18); // Adjusted title font size
  pdf.setTextColor(40, 40, 40);
  const titleText = 'VisionCraft: Документация по продукту';
  // Wrap title text if it's too long
  const titleLines = pdf.splitTextToSize(titleText, pageWidth - margin * 2);
  pdf.text(titleLines, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += titleLines.length * 7 + 10; // 7 is approx line height for 18pt font, 10 is spacing

  // Create a hidden div to render all main content for html2canvas
  const renderDiv = document.createElement('div');
  // Apply styles that will be used by html2canvas
  renderDiv.style.fontFamily = 'var(--font-geist-sans), Arial, "Times New Roman", sans-serif';
  renderDiv.style.fontSize = '12px'; // Use px for html2canvas consistency
  renderDiv.style.color = '#333333';
  // Approximate A4 content width in pixels (A4 width 210mm - 2*margin) * (DPI/25.4)
  // Using a common web DPI of 96: (210 - 30) * (96 / 25.4) ~= 680px.
  // Let html2canvas determine width based on content if possible, or set fixed.
  renderDiv.style.width = '680px'; 
  renderDiv.style.padding = '10px';
  renderDiv.style.lineHeight = '1.6';
  renderDiv.style.wordWrap = 'break-word';
  renderDiv.style.backgroundColor = '#ffffff'; // Ensure a white background for the canvas

  // Make it part of the DOM but off-screen for html2canvas to render
  renderDiv.style.position = 'absolute';
  renderDiv.style.left = '-9999px'; // Position off-screen
  renderDiv.style.top = '0px'; // Keep top 0 for scroll calculations if any

  // Styles for headings and paragraphs within the renderDiv
  const styleTag = document.createElement('style');
  styleTag.innerHTML = `
    .render-div-content h1 { font-size: 16px; color: #008080; margin-top: 15px; margin-bottom: 8px; font-weight: bold; border-bottom: 1px solid #e0e0e0; padding-bottom: 4px; }
    .render-div-content p { margin-bottom: 12px; text-align: justify; }
    .render-div-content pre { white-space: pre-wrap; font-family: var(--font-geist-mono), "Courier New", monospace; background-color: #f5f5f5; padding: 12px; border-radius: 4px; border: 1px solid #e0e0e0; font-size: 11px; }
  `;
  document.head.appendChild(styleTag);
  renderDiv.classList.add('render-div-content');

  document.body.appendChild(renderDiv);

  let htmlContent = '';
  const sections = [
    { title: 'Идея', content: productData.idea },
    { title: 'Видение продукта', content: productData.productVision },
    { title: 'Цели продукта', content: productData.productGoals },
    { title: 'Целевая аудитория', content: productData.targetAudience },
    { title: 'Ключевые функции', content: productData.keyFeatures },
  ];

  sections.forEach(section => {
    // Sanitize content slightly by replacing multiple newlines with single <br>s, then handle single newlines
    const formattedContent = section.content
      .replace(/\n\s*\n/g, '<br><br>') // Preserve paragraph breaks
      .replace(/\n/g, '<br>');       // Convert single newlines
    htmlContent += `<h1>${section.title}</h1><p>${formattedContent}</p>`;
  });

  htmlContent += `<h1>Техническое Задание</h1><pre>${techSpec}</pre>`;
  renderDiv.innerHTML = htmlContent;
  
  // Wait for browser to render the content in renderDiv
  await new Promise(resolve => setTimeout(resolve, 200)); // Increased delay slightly

  const canvas = await html2canvas(renderDiv, {
    scale: 2, // Higher scale for better quality
    useCORS: true,
    logging: false,
    backgroundColor: null, // Use the div's background color
    width: renderDiv.offsetWidth, // Use offsetWidth for more accurate width
    height: renderDiv.offsetHeight, // Use offsetHeight for accurate height
    windowWidth: renderDiv.scrollWidth, // Ensure full content is captured
    windowHeight: renderDiv.scrollHeight,
  });

  document.body.removeChild(renderDiv);
  document.head.removeChild(styleTag);

  await addCanvasToPdf(pdf, canvas, yPosition);

  pdf.save(`${fileName}.pdf`);
};

export const exportHtmlElementToPdf = async (elementId: string, fileName: string = 'document') => {
  const input = document.getElementById(elementId);
  if (!input) {
    console.error(`Element with id ${elementId} not found.`);
    throw new Error(`Element with id ${elementId} not found.`);
  }
  
  const originalStyle = {
      fontFamily: input.style.fontFamily,
      width: input.style.width,
      height: input.style.height,
  };

  // Attempt to ensure a Cyrillic-supporting font family from CSS variables
  const currentFontFamily = window.getComputedStyle(input).fontFamily;
  if (!currentFontFamily.toLowerCase().includes('geist')) {
    input.style.fontFamily = `var(--font-geist-sans), ${currentFontFamily}, Arial, sans-serif`;
  }
  
  const canvas = await html2canvas(input, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: null,
    width: input.scrollWidth, // Capture full scrollable width
    height: input.scrollHeight, // Capture full scrollable height
    windowWidth: input.scrollWidth,
    windowHeight: input.scrollHeight,
  });

  // Restore original styles if they were changed
  input.style.fontFamily = originalStyle.fontFamily;
  // Note: Restoring width/height might not be necessary if they weren't changed or if originals were percentages/auto

  const pdf = new jsPDF('p', 'mm', 'a4');
  await addCanvasToPdf(pdf, canvas, 15); // Start from 'margin' Y position

  pdf.save(`${fileName}.pdf`);
};
