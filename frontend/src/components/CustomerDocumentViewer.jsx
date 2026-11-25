import React, { useState, useEffect } from 'react';
import { Download, Printer, FileText, Phone, CheckCircle2, ShieldCheck } from 'lucide-react';
import { getApiUrl, getUploadUrl } from '../api/client';

export default function CustomerDocumentViewer() {
  const [docType, setDocType] = useState('quote'); // 'quote' | 'receipt'
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const path = window.location.pathname; // e.g. /download/quote/1182 or /view/quote/1182
      const segments = path.split('/').filter(Boolean);
      // segments: ['download', 'quote', '1182'] or ['view', 'receipt', '1']
      if (segments.length >= 3) {
        setDocType(segments[1].toLowerCase().includes('receipt') ? 'receipt' : 'quote');
        setIdentifier(segments[2]);
      } else if (segments.length === 2) {
        setIdentifier(segments[1]);
      }
    } catch (e) {
      console.warn('URL parse error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const downloadEndpoint = docType === 'receipt'
    ? `/receipts/${identifier}/pdf?download=true`
    : `/quotations/${identifier}/pdf?download=true`;

  const previewEndpoint = docType === 'receipt'
    ? `/receipts/${identifier}/pdf`
    : `/quotations/${identifier}/pdf`;

  const directDownloadUrl = getApiUrl(downloadEndpoint);
  const pdfPreviewUrl = getApiUrl(previewEndpoint);

  const [isDownloading, setIsDownloading] = useState(false);

  async function handleDownloadPdf() {
    if (isDownloading) return;
    setIsDownloading(true);
    const targetFilename = `${docType === 'receipt' ? 'Payment_Receipt' : 'Quotation'}_${identifier}.pdf`;
    try {
      const response = await fetch(directDownloadUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = targetFilename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1500);
    } catch (e) {
      console.warn('Direct download fallback:', e);
      window.open(directDownloadUrl, '_blank');
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900 selection:bg-[#7DBA00] selection:text-[#004D40]">
      
      {/* Top Professional Header Bar */}
      <header className="bg-[#004D40] text-white shadow-md sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-3 sm:px-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white p-1 flex items-center justify-center flex-shrink-0 shadow-sm border border-slate-200">
              <img 
                src="/uploads/logos/udhayam_logo.png" 
                alt="Udhayam Agencies Logo" 
                className="max-h-full max-w-full object-contain"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = getUploadUrl('/uploads/logos/udhayam_logo.png');
                }}
              />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="font-extrabold text-sm sm:text-base tracking-tight text-white">
                  UDHAYAM AGENCIES
                </h1>
                <span className="bg-[#7DBA00] text-[#003B40] text-[9px] font-black px-1.5 py-0.2 rounded uppercase">
                  Official
                </span>
              </div>
              <p className="text-[11px] text-emerald-200 font-medium">
                Paint Division • {docType === 'receipt' ? 'Payment Settlement Receipt' : 'Customer Quotation'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isDownloading}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-[#7DBA00] hover:bg-[#8ee000] text-[#003B40] font-black text-xs shadow-md transition-all transform active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isDownloading ? 'Downloading…' : 'Download PDF'}</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="hidden sm:inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs border border-white/20 transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Print</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Document Body */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 flex flex-col items-center">
        
        {/* Document Information Strip */}
        <div className="w-full bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 mb-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <span className="font-extrabold text-slate-900 block">
                Official Digitally Generated {docType === 'receipt' ? 'Receipt' : 'Quotation'}
              </span>
              <span className="text-slate-500 text-[11px]">
                Issued by Udhayam Agencies - Perundurai
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-slate-600 text-[11px]">
            <span>Need assistance?</span>
            <a 
              href="tel:+919715622499" 
              className="inline-flex items-center space-x-1 font-bold text-[#004D40] hover:underline"
            >
              <Phone className="w-3 h-3 text-[#004D40]" />
              <span>+91 97156 22499</span>
            </a>
          </div>
        </div>

        {/* Embedded PDF Viewer Frame */}
        <div className="w-full flex-1 bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden min-h-[650px] flex flex-col">
          <iframe
            src={`${pdfPreviewUrl}#toolbar=1&navpanes=0`}
            title="Customer Document Viewer"
            className="w-full flex-1 border-0 min-h-[650px]"
          />
        </div>

        {/* Bottom Fallback Notice for Mobile Devices */}
        <div className="w-full mt-4 text-center">
          <p className="text-xs text-slate-500">
            If preview does not open automatically on your mobile device, please tap{' '}
            <button type="button" onClick={handleDownloadPdf} className="font-bold text-[#004D40] underline cursor-pointer">
              Download PDF
            </button>{' '}
            to save the file directly.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        <p className="font-semibold text-slate-700">UDHAYAM AGENCIES • Paint Division</p>
        <p className="text-[11px] text-slate-400 mt-0.5">
          41/10, KMR Complex, Old Bus Stand Road, Perundurai, Erode - 638052 | Phone: +91 97156 22499 | GSTIN: 33AADFU6496M1ZJ
        </p>
      </footer>

    </div>
  );
}
