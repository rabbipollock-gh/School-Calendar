/**
 * Inject print-optimized CSS into the document head
 * Called by the Print button — ensures clean @media print output
 */
export function injectPrintStyles() {
  const existing = document.getElementById('yayoe-print-styles')
  if (existing) return

  const style = document.createElement('style')
  style.id = 'yayoe-print-styles'
  style.textContent = `
    @media print {
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      
      body { background: white !important; }
      
      /* Hide all UI chrome */
      #app-header,
      #app-sidebar,
      #settings-drawer,
      #conflict-panel,
      #holiday-suggestions-panel,
      #search-modal,
      [role="dialog"],
      .no-print,
      button:not(.print-visible) { display: none !important; }
      
      /* Calendar grid: full width, 4 columns */
      #calendar-grid {
        display: grid !important;
        grid-template-columns: repeat(4, 1fr) !important;
        gap: 8px !important;
        padding: 16px !important;
        width: 100% !important;
      }
      
      /* Month blocks */
      .month-block {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
        border: 1px solid #ddd !important;
        border-radius: 4px !important;
        padding: 6px !important;
        font-size: 8pt !important;
      }
      
      /* Day cells */
      .day-cell {
        min-height: 28px !important;
        padding: 2px !important;
      }
      
      /* SHA column */
      .sha-col { background: #e8f5fa !important; }
      
      /* Event dots */
      .event-dot { width: 6px !important; height: 6px !important; }
      
      /* Notes strip */
      .notes-strip {
        font-size: 7pt !important;
        border-top: 1px solid #eee !important;
        margin-top: 4px !important;
        padding-top: 4px !important;
      }
      
      /* Page setup */
      @page {
        size: landscape;
        margin: 0.5in;
      }
    }
  `
  document.head.appendChild(style)
}

export function triggerPrint() {
  injectPrintStyles()
  setTimeout(() => window.print(), 100)
}
