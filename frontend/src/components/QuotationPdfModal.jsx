import React, { useState, useEffect } from 'react';
import { 
  Printer, Download, X, FileText, CheckCircle2, ShieldCheck, 
  Building2, Edit3, Trash2, ArrowRight, MessageSquare, Plus, Loader2 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getApiUrl, getUploadUrl } from '../api/client';
import { numberToIndianWords } from '../utils/numberToWords';
import { formatToDMY } from '../utils/dateHelper';
import { calculateQuotationFinancials } from '../utils/quotationEngine';
import { generateDynamicQrDataUrl } from '../services/qrService';

export default function QuotationPdfModal({ quotation, onClose, onEdit, onDelete, onGoToQuotes, onNewQuotation, onShareWhatsApp }) {
  if (!quotation) return null;

  const { settings } = useAuth();
  const [paperFormat, setPaperFormat] = useState(quotation.paper_format || 'A4');
  const [dynamicQrUrl, setDynamicQrUrl] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);

  const logoUrl = getUploadUrl(
    settings?.company_logo
      ? `/uploads/logos/${settings.company_logo}`
      : '/uploads/logos/udhayam_logo.png'
  );

  const isA5 = paperFormat === 'A5';

  function formatCurrency(val) {
    return '₹' + Number(val || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function handlePrint() {
    window.print();
  }

  const items = quotation.items || [];
  const isTaxInclusive = quotation.is_tax_inclusive === 1 || quotation.is_tax_inclusive === true;

  // Canonical Calculation Engine
  const financials = calculateQuotationFinancials({
    items: items,
    discount_percent: quotation.discount_percent,
    discount_amount: quotation.discount_amount,
    is_tax_inclusive: isTaxInclusive,
    default_gst_rate: quotation.gst_rate || settings?.default_gst_rate || 18,
    delivery_charges: quotation.delivery_charges || 0,
    company_state_code: settings?.company_state_code || '33',
    customer_gstin: quotation.customer_gstin || ''
  });

  const taxSlabs = financials.taxSlabs || [];
  const taxableAmount = financials.taxableValue;
  const gstAmount = financials.totalTaxAmount;
  const cgstAmount = financials.totalCgst;
  const sgstAmount = financials.totalSgst;
  const grandTotal = financials.grandTotal;

  // Generate dynamic QR code matching quotation details
  useEffect(() => {
    let isMounted = true;
    const upi = quotation.upi_id || settings?.upi_id || 'paytmqr6vc6b5@ptys';
    generateDynamicQrDataUrl({
      upiId: upi,
      payeeName: settings?.bank_account_name || settings?.company_name || 'UDHAYAM AGENCIES',
      amount: grandTotal,
      ref: quotation.quotation_number
    }).then(url => {
      if (isMounted && url) setDynamicQrUrl(url);
    });
    return () => { isMounted = false; };
  }, [quotation, settings, grandTotal]);

  async function handleDownloadPdf() {
    if (isDownloading) return;
    setIsDownloading(true);
    const downloadEndpoint = `/quotations/${quotation.id}/pdf?download=true&format=${paperFormat}`;
    const directUrl = getApiUrl(downloadEndpoint);
    const safeCust = (quotation.customer_name || 'Customer').trim().replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const safeQuoteNo = (quotation.quotation_number || 'Quote').trim().replace(/[^A-Za-z0-9\-]+/g, '_');
    const targetFilename = `${safeCust}_${safeQuoteNo}.pdf`;

    try {
      const response = await fetch(directUrl);
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
    } catch (err) {
      console.warn('Direct blob download failed, falling back to window.open:', err);
      window.open(directUrl, '_blank');
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="bg-slate-100 rounded-2xl max-w-5xl w-full shadow-2xl border border-slate-300 overflow-hidden flex flex-col max-h-[96vh] animate-in fade-in zoom-in-95 font-sans">
        
        {/* Modal Controls Bar (Hidden during print) */}
        <div className="no-print bg-[#00545C] text-white px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-[#003B40]">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-[#7DBA00]" />
            <div>
              <h3 className="font-bold text-sm sm:text-base leading-tight">
                Official Quotation: {quotation.quotation_number}
              </h3>
              <p className="text-[11px] text-emerald-200">
                Customer: {quotation.customer_name} • {items.length} item(s) • Full Page A4 Design
              </p>
            </div>
          </div>

          {/* Paper Format Selector & Print Actions */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Format Selector */}
            <div className="flex bg-[#003B40] p-0.5 rounded-lg border border-emerald-700/50">
              <button
                type="button"
                onClick={() => setPaperFormat('A4')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  !isA5 ? 'bg-[#7DBA00] text-[#003B40] shadow' : 'text-slate-300 hover:text-white'
                }`}
              >
                A4 Full Page
              </button>
              <button
                type="button"
                onClick={() => setPaperFormat('A5')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  isA5 ? 'bg-[#7DBA00] text-[#003B40] shadow' : 'text-slate-300 hover:text-white'
                }`}
              >
                A5 Compact
              </button>
            </div>

            {/* Download Button */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isDownloading}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#7DBA00] hover:bg-[#8ee000] text-[#003B40] text-xs font-black shadow transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              title="Download Official Quotation PDF"
            >
              {isDownloading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5 text-[#003B40]" />
              )}
              <span>{isDownloading ? 'Downloading…' : 'Download PDF'}</span>
            </button>

            {/* Edit Button */}
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(quotation)}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow transition-all active:scale-95 cursor-pointer"
                title="Edit Quotation"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Edit</span>
              </button>
            )}

            {/* Delete Button */}
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(quotation)}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow transition-all active:scale-95 cursor-pointer"
                title="Delete Quotation"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Delete</span>
              </button>
            )}

            {/* Print Button */}
            <button
              onClick={handlePrint}
              className="flex items-center space-x-1 px-3.5 py-1.5 rounded-lg bg-[#7DBA00] hover:bg-[#8ee000] text-[#003B40] text-xs font-extrabold shadow transition-all active:scale-95 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Page</span>
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 ml-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Paper Container */}
        <div className="overflow-y-auto flex-1 p-3 sm:p-6 flex justify-center bg-slate-200/80">
          
          {/* Dynamic Print CSS for A4 vs A5 */}
          <style>{`
            @media print {
              @page {
                size: ${isA5 ? 'A5 portrait' : 'A4 portrait'} !important;
                margin: ${isA5 ? '4mm 5mm' : '8mm 10mm'} !important;
              }
            }
          `}</style>

          {/* Printable Document Paper Card: Real A4 / A5 Full-Page Design */}
          <div 
            id="printable-quotation"
            className={`bg-white text-slate-900 rounded-none shadow-2xl mx-auto flex flex-col justify-between print-page ${
              isA5 
                ? 'w-full max-w-[148mm] min-h-[205mm] p-3.5 sm:p-4 text-xs' 
                : 'w-full max-w-[210mm] min-h-[292mm] p-6 sm:p-8 text-sm'
            }`}
            style={{ fontFeatureSettings: '"tnum"' }}
          >
            {/* TOP & MIDDLE CONTAINER */}
            <div className="flex-1 flex flex-col">
              
              {/* Header Banner */}
              <div className={`bg-[#00545C] text-white rounded-xl flex items-center justify-between shadow-sm ${
                isA5 ? 'p-2.5 sm:p-3' : 'p-3.5 sm:p-4'
              }`}>
                <div className="flex items-center space-x-2.5 sm:space-x-3.5">
                  <div className={`${
                    isA5 ? 'w-11 h-11 p-1' : 'w-14 h-14 sm:w-16 sm:h-16 p-1.5'
                  } bg-white rounded-lg flex items-center justify-center flex-shrink-0 shadow`}>
                    <img
                      src={logoUrl}
                      alt="Logo"
                      className="max-h-full max-w-full object-contain"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = '/uploads/logos/udhayam_logo.png';
                      }}
                    />
                  </div>
                  <div>
                    <h1 className={`${
                      isA5 ? 'text-sm sm:text-base font-black' : 'text-base sm:text-lg font-black'
                    } tracking-tight leading-tight`}>
                      {settings?.company_name || 'UDHAYAM AGENCIES'}
                    </h1>
                    <p className={`${
                      isA5 ? 'text-[9.5px]' : 'text-[11px]'
                    } font-extrabold text-[#7DBA00] tracking-wide uppercase`}>
                      {settings?.company_division || 'Paint Division'}
                    </p>
                    <p className={`${
                      isA5 ? 'text-[8.5px]' : 'text-[10px]'
                    } text-slate-200 mt-0.5 max-w-md leading-relaxed`}>
                      {settings?.company_address || '41/10, KMR Complex, Old Bus Stand Road, Perundurai, Erode - 638052'}
                    </p>
                    <p className={`${
                      isA5 ? 'text-[8.5px]' : 'text-[10px]'
                    } text-emerald-200 mt-0.5 font-medium`}>
                      Phone: {settings?.company_phone || '+91 97156 22499'} | GSTIN: {settings?.company_gstin || '33AADFU6496M1ZJ'}
                    </p>
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <div className={`inline-block bg-[#7DBA00] text-[#003B40] font-black rounded uppercase tracking-wider shadow ${
                    isA5 ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs'
                  }`}>
                    QUOTATION
                  </div>
                  <div className={`mt-1 text-emerald-100 ${isA5 ? 'text-[9px]' : 'text-[10.5px]'} leading-tight space-y-0.5`}>
                    <p className="font-bold text-white text-xs tracking-wider tabular-nums">Q.No: {quotation.quotation_number}</p>
                    <p className="tabular-nums">Date: {formatToDMY(quotation.quotation_date) || formatToDMY(new Date())}</p>
                    <p className="tabular-nums text-slate-200">Valid Till: {formatToDMY(quotation.validity_date, quotation.quotation_date, 15)}</p>
                    <p className={`font-extrabold uppercase tracking-wide ${
                      /credit/i.test(quotation.payment_terms || '') ? 'text-amber-300' : 'text-[#BEF264]'
                    }`}>
                      Terms: {(quotation.payment_terms || 'Cash').toUpperCase()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Full-Width Customer Details Bar (No duplicate Quote Meta) */}
              <div className={`mt-2.5 sm:mt-3 bg-slate-50/90 border border-slate-200 rounded-xl ${
                isA5 ? 'p-2 text-[10px]' : 'p-3.5 text-xs'
              }`}>
                <span className={`${
                  isA5 ? 'text-[8px]' : 'text-[9px]'
                } font-extrabold text-[#00545C] uppercase tracking-wider block mb-0.5`}>
                  BILLED TO / CUSTOMER DETAILS:
                </span>
                <p className={`font-extrabold text-slate-900 ${isA5 ? 'text-xs' : 'text-xs sm:text-sm'}`}>{quotation.customer_name}</p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 mt-0.5">
                  <p className={`${isA5 ? 'text-[10px]' : 'text-[11px]'} text-slate-600 font-medium tabular-nums`}>Phone: {quotation.customer_phone}</p>
                  {quotation.customer_gstin && (
                    <p className={`${isA5 ? 'text-[10px]' : 'text-[11px]'} text-slate-600 font-medium`}>GSTIN: {quotation.customer_gstin}</p>
                  )}
                  {quotation.customer_email && (
                    <p className={`${isA5 ? 'text-[10px]' : 'text-[11px]'} text-slate-600`}>Email: {quotation.customer_email}</p>
                  )}
                </div>
                {quotation.customer_address && (
                  <p className={`${isA5 ? 'text-[10px]' : 'text-[11px]'} text-slate-600 mt-0.5 leading-snug`}>Address: {quotation.customer_address}</p>
                )}
              </div>

              {/* Line Items Table with Clean Alignment */}
              <div className="mt-2.5 sm:mt-3 border border-slate-200 rounded-xl overflow-hidden shadow-2xs flex-1 flex flex-col">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-[#00545C] text-white text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">
                      <th className={`text-center ${isA5 ? 'py-1.5 px-1.5 w-7' : 'py-2.5 px-3 w-9'}`}>#</th>
                      <th className={`${isA5 ? 'py-1.5 px-2' : 'py-2.5 px-3'}`}>Item Description & Specifications</th>
                      <th className={`text-center ${isA5 ? 'py-1.5 px-1.5 w-12' : 'py-2.5 px-2 w-16'}`}>HSN</th>
                      <th className={`text-center ${isA5 ? 'py-1.5 px-1 w-8' : 'py-2.5 px-2 w-12'}`}>Qty</th>
                      <th className={`text-center ${isA5 ? 'py-1.5 px-1 w-8' : 'py-2.5 px-2 w-12'}`}>Unit</th>
                      <th className={`text-right ${isA5 ? 'py-1.5 px-1.5 w-16' : 'py-2.5 px-2.5 w-20'}`}>Rate (₹)</th>
                      <th className={`text-center ${isA5 ? 'py-1.5 px-1.5 w-12' : 'py-2.5 px-2 w-16'}`}>Tax %</th>
                      <th className={`text-right ${isA5 ? 'py-1.5 px-2 w-18' : 'py-2.5 px-3 w-24'}`}>Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/80 text-xs">
                    {items.map((item, idx) => (
                      <tr key={item.id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                        <td className={`text-center tabular-nums text-slate-400 font-medium ${isA5 ? 'py-1.5 px-1.5 text-[10px]' : 'py-2.5 px-3 text-[11px]'}`}>
                          {idx + 1}
                        </td>
                        <td className={`${isA5 ? 'py-1.5 px-2' : 'py-2.5 px-3'}`}>
                          <div className={`font-bold text-slate-900 ${isA5 ? 'text-[11px]' : 'text-xs sm:text-[13px]'} leading-snug`}>
                            {item.item_name}
                          </div>
                          {item.details && item.details.trim().length > 0 && (
                            <div className={`${isA5 ? 'text-[9.5px]' : 'text-[11px]'} text-slate-500 italic mt-0.5 font-normal`}>
                              {item.details}
                            </div>
                          )}
                        </td>
                        <td className={`text-center text-slate-600 tabular-nums font-medium ${isA5 ? 'py-1.5 px-1.5 text-[10px]' : 'py-2.5 px-2 text-[11px]'}`}>
                          {item.hsn_sac || '-'}
                        </td>
                        <td className={`text-center font-extrabold text-slate-900 tabular-nums ${isA5 ? 'py-1.5 px-1 text-[11px]' : 'py-2.5 px-2 text-xs sm:text-[13px]'}`}>
                          {item.quantity}
                        </td>
                        <td className={`text-center text-slate-600 font-medium ${isA5 ? 'py-1.5 px-1 text-[10px]' : 'py-2.5 px-2 text-[11px]'}`}>
                          {item.unit || 'Nos'}
                        </td>
                        <td className={`text-right font-semibold text-slate-700 tabular-nums ${isA5 ? 'py-1.5 px-1.5 text-[11px]' : 'py-2.5 px-2.5 text-xs sm:text-[13px]'}`}>
                          {Number(item.sale_rate).toFixed(2)}
                        </td>
                        <td className={`text-center font-extrabold text-slate-800 tabular-nums ${isA5 ? 'py-1.5 px-1.5 text-[11px]' : 'py-2.5 px-2 text-xs sm:text-[12px]'}`}>
                          {item.tax_percent != null ? item.tax_percent : (quotation.gst_rate || 18)}%
                        </td>
                        <td className={`text-right font-extrabold text-slate-900 tabular-nums ${isA5 ? 'py-1.5 px-2 text-[11px]' : 'py-2.5 px-3 text-xs sm:text-[13px]'}`}>
                          {Number(item.line_total).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>

            {/* BOTTOM SECTION: ANCHORED AT BOTTOM OF A4 / A5 PAGE */}
            <div className={`mt-3 pt-1.5 ${isA5 ? 'space-y-2' : 'space-y-3.5'}`}>
              
            {/* 1. HORIZONTAL TAX BREAKDOWN TABLE (FULL WIDTH) */}
            <div className="mt-3 border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-[#00545C] text-white text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">
                      <th className="py-2 px-3 text-right">Taxable Value</th>
                      <th className="py-2 px-2 text-center">CGST %</th>
                      <th className="py-2 px-3 text-right">CGST Amt</th>
                      <th className="py-2 px-2 text-center">SGST %</th>
                      <th className="py-2 px-3 text-right">SGST Amt</th>
                      <th className="py-2 px-3 text-right">Total Tax</th>
                      <th className="py-2 px-2 text-right">Round Off</th>
                      <th className="py-2 px-3 text-right bg-[#7DBA00] text-[#003B40]">Net Grand Total</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100 text-xs">
                    {taxSlabs.length > 1 && taxSlabs.map((s, sIdx) => (
                      <tr key={sIdx} className="bg-slate-50/50">
                        <td className="py-1.5 px-3 text-right font-mono text-slate-700">
                          {formatCurrency(s.taxableValue)}
                        </td>
                        <td className="py-1.5 px-2 text-center font-mono text-slate-600">
                          {s.cgstPercent.toFixed(2)}%
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono text-slate-700">
                          {formatCurrency(s.cgstAmount)}
                        </td>
                        <td className="py-1.5 px-2 text-center font-mono text-slate-600">
                          {s.sgstPercent.toFixed(2)}%
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono text-slate-700">
                          {formatCurrency(s.sgstAmount)}
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono text-slate-700">
                          {formatCurrency(s.totalTaxAmount)}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono text-slate-400">—</td>
                        <td className="py-1.5 px-3 text-right font-mono text-slate-400">—</td>
                      </tr>
                    ))}
                    <tr>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">
                        {formatCurrency(taxableAmount)}
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-600">
                        {taxSlabs.length === 1 ? `${taxSlabs[0].cgstPercent.toFixed(2)}%` : 'TOTAL'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700">
                        {formatCurrency(cgstAmount)}
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-600">
                        {taxSlabs.length === 1 ? `${taxSlabs[0].sgstPercent.toFixed(2)}%` : 'TOTAL'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700">
                        {formatCurrency(sgstAmount)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">
                        {formatCurrency(gstAmount)}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-slate-500">
                        {quotation.rounded_off ? formatCurrency(quotation.rounded_off) : '₹0.00'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-sm sm:text-base text-[#003B40] bg-lime-100/70">
                        {formatCurrency(quotation.grand_total)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="bg-slate-50 px-3 py-1.5 border-t border-slate-200 text-[10px] sm:text-xs text-slate-600 flex items-center justify-between">
                <span>
                  <strong className="text-slate-800">Amount in Words: </strong>
                  <span className="italic">{numberToIndianWords(quotation.grand_total)}</span>
                </span>
                <span className="text-[10px] text-emerald-800 font-bold bg-emerald-100 px-2 py-0.5 rounded">
                  GST Applicable
                </span>
              </div>
            </div>

            {/* 2. BANK DETAILS & TERMS HORIZONTAL COLUMNS (FULL WIDTH) */}
            <div className="mt-3 bg-slate-50/90 border border-slate-200 rounded-xl p-3 shadow-2xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-stretch">
                {/* Col 1: Bank & Settlement (Executive Structure with IDIB000P155) */}
                <div className="space-y-0.5 text-[11px] text-slate-800 border-r border-slate-200/80 pr-2">
                  <span className="text-[9px] font-black text-[#004D40] uppercase tracking-wider block mb-1">
                    BANK DETAILS:
                  </span>
                  <p className="font-extrabold text-slate-900 leading-tight">{settings?.bank_account_name || 'Udhayam Agencies'}</p>
                  <p className="font-mono font-bold text-slate-900 leading-tight">Acc Number: {settings?.bank_account_no || '6659330152'}</p>
                  <p className="text-slate-700 leading-tight">{settings?.bank_name ? `${settings.bank_name} | ${settings.bank_branch || 'Perundurai Branch'}` : 'Indian Bank | Perundurai Branch'}</p>
                  <p className="font-bold text-[#004D40] leading-tight">IFSC Code: {settings?.bank_ifsc?.replace(/^IFSC\s*(Code)?\s*[:\-]\s*/i, '') || 'IDIB000P155'}</p>
                </div>

                {/* Col 2: Terms & Conditions */}
                <div className="text-[10px] text-slate-600 border-r border-slate-200/80 pr-2 space-y-1">
                  <span className="text-[9px] font-black text-[#00545C] uppercase tracking-wider block mb-1">
                    TERMS & CONDITIONS:
                  </span>
                  <p className="line-clamp-4 leading-relaxed whitespace-pre-line text-[9px] text-slate-600">
                    {(quotation.notes && !/auto-generated|test_msg|^Optech Quote\s*#|^Converted from Optech/i.test(quotation.notes))
                      ? quotation.notes
                      : '1. Quotation valid for 15 days from date of issue.\n2. Goods once sold will not be taken back or exchanged.\n3. 100% payment on delivery / as per agreed terms.\n4. Subject to Perundurai jurisdiction only.'}
                  </p>
                </div>

                {/* Col 3: Official Paytm / Dynamic UPI QR Code */}
                <div className="flex flex-col items-center justify-center border-r border-slate-200/80 pr-2">
                  <div className="bg-white p-1 rounded-lg border border-slate-200 shadow-2xs flex flex-col items-center">
                    <img
                      src={
                        settings?.payment_qr_code_data ||
                        getUploadUrl(`/uploads/qr/${settings?.payment_qr_code || 'default_upi_qr.png'}`) ||
                        dynamicQrUrl
                      }
                      alt="UPI QR Code"
                      className="w-16 h-16 object-contain rounded"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = dynamicQrUrl || getUploadUrl('/uploads/qr/default_upi_qr.png');
                      }}
                    />
                    <span className="text-[7.5px] font-black text-[#00545C] mt-0.5 uppercase tracking-wider">
                      SCAN TO PAY UPI
                    </span>
                  </div>
                </div>

                {/* Col 4: Authorised Signatory */}
                <div className="flex flex-col justify-between text-right text-[11px] text-slate-700 pl-2 py-0.5">
                  <p className="font-extrabold text-[#00545C] text-xs">For {settings?.company_name || 'UDHAYAM AGENCIES'}</p>
                  <div className="mt-auto">
                    <div className="border-b border-dashed border-slate-400 w-32 h-5 ml-auto"></div>
                    <p className="text-[9px] font-bold text-slate-500 mt-1">Authorised Signatory</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Corporate Verification Bar */}
            <div className="pt-2 border-t border-slate-200 text-center text-slate-500 text-[10px] space-y-0.5">
              <p>Computer-generated quotation valid without physical signature.</p>
            </div>

            </div>

          </div>

        </div>

        {/* Post-Creation Action Bar & CTAs (Hidden during print) */}
        <div className="no-print bg-white px-4 sm:px-6 py-3 border-t border-slate-300 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="font-extrabold text-slate-800">
              Quotation {quotation.quotation_number} Ready!
            </span>
            <span className="text-slate-400 hidden md:inline">• Official rates applied</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onNewQuotation && (
              <button
                type="button"
                onClick={onNewQuotation}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                title="Create a new blank quotation"
              >
                <Plus className="w-3.5 h-3.5 text-slate-600" />
                <span>+ Create Another</span>
              </button>
            )}

            {onShareWhatsApp && (
              <button
                type="button"
                onClick={onShareWhatsApp}
                className="flex items-center space-x-1.5 px-4 py-1.5 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
                title="Share via WhatsApp with PDF Document"
              >
                <MessageSquare className="w-3.5 h-3.5 text-white" />
                <span>Share WhatsApp</span>
              </button>
            )}

            {onGoToQuotes && (
              <button
                type="button"
                onClick={onGoToQuotes}
                className="flex items-center space-x-1.5 px-5 py-1.5 rounded-xl bg-[#00545C] hover:bg-[#003B40] text-white font-black text-xs shadow-md transition-all active:scale-95 cursor-pointer shadow-[#00545C]/20"
                title="Navigate to the full Quotations Register"
              >
                <span>Go to Quotations List</span>
                <ArrowRight className="w-3.5 h-3.5 text-emerald-300" />
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
