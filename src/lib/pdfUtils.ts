
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
  const margin = 15; // Consistent margin for PDF content

  const contentWidth = pdfWidth - margin * 2;
  
  let currentYOnPage = initialYPosition;
  let sourceImageY = 0; // Y position in the source canvas

  while (sourceImageY < imgProps.height) {
    // Add new page if it's not the first chunk of the image AND currentYOnPage is not at the initial position
    // or if currentYOnPage plus a minimal content height would exceed page height.
    if (sourceImageY > 0 && (pdfPageHeight - currentYOnPage - margin < 20 /* min content height */)) { 
      pdf.addPage();
      currentYOnPage = margin; // Reset Y for new page
    }

    const availablePdfPageHeight = pdfPageHeight - currentYOnPage - margin;
    
    // How many pixels from the source image can fit into availablePdfPageHeight
    const sourceSliceHeight = Math.min(
      imgProps.height - sourceImageY, 
      availablePdfPageHeight * (imgProps.width / contentWidth) 
    );

    if (sourceSliceHeight <= 0) {
        break;
    }

    const segmentCanvas = document.createElement('canvas');
    segmentCanvas.width = imgProps.width;
    segmentCanvas.height = sourceSliceHeight;
    const segmentCtx = segmentCanvas.getContext('2d');
    
    if (segmentCtx) {
      segmentCtx.drawImage(canvas, 0, sourceImageY, imgProps.width, sourceSliceHeight, 0, 0, imgProps.width, sourceSliceHeight);
    }
    
    const segmentImgData = segmentCanvas.toDataURL('image/png');
    const segmentPdfHeight = (sourceSliceHeight * contentWidth) / imgProps.width;

    pdf.addImage(segmentImgData, 'PNG', margin, currentYOnPage, contentWidth, segmentPdfHeight);

    currentYOnPage += segmentPdfHeight; // Update Y for next segment or next content block
    sourceImageY += sourceSliceHeight;
  }
  return currentYOnPage; 
}


export const exportToPdf = async (productData: ProductData, techSpec: string, fileName: string = 'document') => {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageHeight = pdf.internal.pageSize.getHeight();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 15;
  let yPosition = margin;

  try {
    pdf.setFont('Helvetica', 'bold'); 
  } catch (e) {
    console.warn("Failed to set font, jsPDF will use its default.");
  }
  pdf.setFontSize(18); 
  pdf.setTextColor(40, 40, 40);
  const titleText = 'VisionCraft: Документация по продукту';
  const titleLines = pdf.splitTextToSize(titleText, pageWidth - margin * 2);
  pdf.text(titleLines, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += titleLines.length * 7 + 10; 

  const renderDiv = document.createElement('div');
  renderDiv.style.fontFamily = 'var(--font-geist-sans), Arial, "Times New Roman", sans-serif';
  renderDiv.style.fontSize = '12px'; 
  renderDiv.style.color = '#333333';
  renderDiv.style.width = '680px'; 
  renderDiv.style.padding = '10px';
  renderDiv.style.lineHeight = '1.6';
  renderDiv.style.wordWrap = 'break-word';
  renderDiv.style.backgroundColor = '#ffffff'; 

  renderDiv.style.position = 'absolute';
  renderDiv.style.left = '-9999px'; 
  renderDiv.style.top = '0px'; 

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
    const formattedContent = section.content
      .replace(/\n\s*\n/g, '<br><br>') 
      .replace(/\n/g, '<br>');       
    htmlContent += `<h1>${section.title}</h1><p>${formattedContent}</p>`;
  });

  htmlContent += `<h1>Техническое Задание</h1><pre>${techSpec}</pre>`;
  renderDiv.innerHTML = htmlContent;
  
  await new Promise(resolve => setTimeout(resolve, 200)); 

  const canvas = await html2canvas(renderDiv, {
    scale: 2, 
    useCORS: true,
    logging: false,
    backgroundColor: null, 
    width: renderDiv.offsetWidth, 
    height: renderDiv.offsetHeight, 
    windowWidth: renderDiv.scrollWidth, 
    windowHeight: renderDiv.scrollHeight,
  });

  document.body.removeChild(renderDiv);
  if (document.head.contains(styleTag)) { // Check if styleTag is still in head
      document.head.removeChild(styleTag);
  }


  await addCanvasToPdf(pdf, canvas, yPosition);

  pdf.save(`${fileName}.pdf`);
};

export const exportHtmlElementToPdf = async (elementId: string, fileName: string = 'document') => {
  const inputElement = document.getElementById(elementId);
  if (!inputElement) {
    console.error(`Element with id ${elementId} not found.`);
    throw new Error(`Element with id ${elementId} not found.`);
  }
  
  // Clone the element to avoid modifying the live DOM element directly if styles are temporarily changed
  const clonedElement = inputElement.cloneNode(true) as HTMLElement;
  clonedElement.style.position = 'absolute';
  clonedElement.style.left = '-9999px'; // Position off-screen
  clonedElement.style.top = '0';
  clonedElement.style.zIndex = '-1'; // Ensure it's not visible but still renderable
  clonedElement.style.display = 'block'; // Ensure it's display block for html2canvas
  clonedElement.style.width = inputElement.scrollWidth + 'px'; // Set explicit width for full capture

  // If the element to be exported has an inner scrollable div, this needs to be handled better.
  // For now, we assume the element itself (or its direct children) determines the scrollHeight.

  document.body.appendChild(clonedElement);

  // Ensure fonts are loaded and element is rendered
  await new Promise(resolve => setTimeout(resolve, 300));


  const canvas = await html2canvas(clonedElement, {
    scale: 2, // Increase scale for better quality
    useCORS: true,
    logging: false,
    backgroundColor: window.getComputedStyle(clonedElement).backgroundColor || '#ffffff', // Use element's BG or default to white
    width: clonedElement.scrollWidth, 
    height: clonedElement.scrollHeight, 
    windowWidth: clonedElement.scrollWidth,
    windowHeight: clonedElement.scrollHeight,
    scrollX: 0, // Ensure we capture from the beginning
    scrollY: 0,
  });

  document.body.removeChild(clonedElement);

  const pdf = new jsPDF('p', 'mm', 'a4');
  await addCanvasToPdf(pdf, canvas, 10); // Start from a small margin

  pdf.save(`${fileName}.pdf`);
};

