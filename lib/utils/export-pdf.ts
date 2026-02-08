/**
 * PDF export utility using jspdf and html2canvas
 * Captures the DOM element and converts it to a multi-page PDF
 */

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface ExportPdfOptions {
  filename?: string;
  scale?: number;
  format?: 'a4' | 'letter';
}

/**
 * Export a DOM element to PDF
 * @param elementId - The ID of the element to export
 * @param options - Export options
 */
export async function exportAnalysisPdf(
  elementId: string,
  options: ExportPdfOptions = {}
): Promise<void> {
  const {
    filename = `analysis-${Date.now()}.pdf`,
    scale = 2,
    format = 'a4',
  } = options;

  try {
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error(`Element with ID "${elementId}" not found`);
    }

    // Add print-mode class for clean rendering
    element.classList.add('print-mode');

    // Capture the element as canvas
    const canvas = await html2canvas(element, {
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: element.scrollWidth * scale,
      windowHeight: element.scrollHeight * scale,
    } as any);

    // Remove print-mode class
    element.classList.remove('print-mode');

    // Convert canvas to image
    const imgData = canvas.toDataURL('image/png');

    // Create PDF
    const pdf = new jsPDF('p', 'mm', format);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    // Calculate image dimensions
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const ratio = canvasWidth / pdfWidth;
    const imgHeight = canvasHeight / ratio;

    // Handle multi-page content
    let heightLeft = imgHeight;
    let position = 0;

    // Add first page
    pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
    heightLeft -= pdfHeight;

    // Add additional pages if content overflows
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
      heightLeft -= pdfHeight;
    }

    // Save the PDF
    pdf.save(filename);
  } catch (error) {
    console.error('Error exporting PDF:', error);
    throw new Error('Failed to export PDF. Please try again.');
  }
}

/**
 * Check if PDF export is supported in the current browser
 */
export function isPdfExportSupported(): boolean {
  try {
    // Check if required APIs are available
    return !!(
      typeof document !== 'undefined' &&
      document.createElement('canvas').getContext('2d') &&
      typeof Blob !== 'undefined'
    );
  } catch {
    return false;
  }
}

/**
 * Generate a filename for the PDF based on patient info
 */
export function generatePdfFilename(
  patientName?: string | null,
  date?: string | Date
): string {
  const timestamp = date
    ? new Date(date).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];

  const sanitizedName = patientName
    ? patientName.replace(/[^a-zA-Z0-9]/g, '_')
    : 'patient';

  return `analysis_${sanitizedName}_${timestamp}.pdf`;
}
