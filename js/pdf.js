/**
 * PDF Export Module
 *
 * Exports the TipTap editor content to a PDF file using html2pdf.js
 * (a client-side library that combines html2canvas + jsPDF).
 *
 * Depends on the global `html2pdf()` function loaded via CDN in index.html.
 */

let pdfInitialized = false;

export function setupPDF() {
  if (pdfInitialized) return;
  pdfInitialized = true;

  const pdfBtn = document.getElementById('pdfBtn');
  if (!pdfBtn) return;

  pdfBtn.addEventListener('click', async () => {
    const editorEl = document.querySelector('.ProseMirror');
    if (!editorEl) {
      const status = document.getElementById('statusText');
      if (status) status.textContent = 'No editor content to export';
      return;
    }

    const title = document.getElementById('docTitle')?.value || 'Untitled Document';

    try {
      pdfBtn.disabled = true;
      pdfBtn.textContent = '⏳ Exporting...';

      await html2pdf()
        .set({
          margin: [0.5, 0.5, 0.5, 0.5],
          filename: `${title}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, letterRendering: true },
          jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
        })
        .from(editorEl)
        .save();

      const status = document.getElementById('statusText');
      if (status) status.textContent = 'PDF exported successfully';
    } catch (err) {
      const status = document.getElementById('statusText');
      if (status) status.textContent = `PDF export failed: ${err.message}`;
    } finally {
      pdfBtn.disabled = false;
      pdfBtn.textContent = '📄 PDF';
    }
  });
}
