import React, { useState } from 'react';
import { Printer, Download, X, FileText, CheckCircle2, ShieldCheck, Building2, Edit3, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { numberToIndianWords } from '../utils/numberToWords';

export default function QuotationPdfModal({ quotation, onClose, onEdit, onDelete }) {
  if (!quotation) return null;

  const { settings } = useAuth();
  const [paperFormat, setPaperFormat] = useState(quotation.paper_format || 'A4');

  const logoUrl = settings?.company_logo 
    ? `/uploads/logos/${settings.company_logo}` 
    : '/uploads/logos/udhayam_logo.png';

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

  // Tax calculations (rates are tax-inclusive by default)
  const subtotal = Number(quotation.subtotal || 0);
  const discountAmount = Number(quotation.discount_amount || 0);
  const netAmount = Math.max(0, subtotal - discountAmount);
  const gstRate = Number(quotation.gst_rate || 18);
  
  // Taxable base and included GST
  const taxableAmount = quotation.taxable_amount !== undefined 
    ? Number(quotation.taxable_amount) 
    : Math.round((netAmount / (1 + gstRate / 100)) * 100) / 100;
  
  const gstAmount = quotation.gst_amount !== undefined
    ? Number(quotation.gst_amount)
    : Math.round((netAmount - taxableAmount) * 100) / 100;

  const cgstAmount = Math.round((gstAmount / 2) * 100) / 100;
  const sgstAmount = Math.round((gstAmount - cgstAmount) * 100) / 100;

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
            <a
              href={`/api/quotations/${quotation.id}/pdf?download=true&format=${paperFormat}`}
              download
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download</span> PDF
            </a>

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
                  <div className={`mt-1 text-emerald-100 ${isA5 ? 'text-[9.5px]' : 'text-[11px]'}`}>
                    <p className="font-bold text-white text-xs tracking-wider tabular-nums">{quotation.quotation_number}</p>
                    <p className="tabular-nums">Date: {quotation.quotation_date}</p>
                  </div>
                </div>
              </div>

              {/* Customer & Quote Meta Bar */}
              <div className={`mt-2.5 sm:mt-3 grid grid-cols-2 gap-2 sm:gap-3.5 bg-slate-50/90 border border-slate-200 rounded-xl ${
                isA5 ? 'p-2 text-[10px]' : 'p-3.5 text-xs'
              }`}>
                <div>
                  <span className={`${
                    isA5 ? 'text-[8px]' : 'text-[9px]'
                  } font-extrabold text-[#00545C] uppercase tracking-wider block mb-0.5`}>
                    BILLED TO / CUSTOMER DETAILS:
                  </span>
                  <p className={`font-extrabold text-slate-900 ${isA5 ? 'text-xs' : 'text-xs sm:text-sm'}`}>{quotation.customer_name}</p>
                  <p className={`${isA5 ? 'text-[10px]' : 'text-[11px]'} text-slate-600 font-medium tabular-nums`}>Phone: {quotation.customer_phone}</p>
                  {quotation.customer_email && (
                    <p className={`${isA5 ? 'text-[10px]' : 'text-[11px]'} text-slate-600`}>Email: {quotation.customer_email}</p>
                  )}
                  {quotation.customer_address && (
                    <p className={`${isA5 ? 'text-[10px]' : 'text-[11px]'} text-slate-600 mt-0.5 leading-snug`}>{quotation.customer_address}</p>
                  )}
                </div>
                <div className="text-right">
                  <span className={`${
                    isA5 ? 'text-[8px]' : 'text-[9px]'
                  } font-extrabold text-[#00545C] uppercase tracking-wider block mb-0.5`}>
                    QUOTATION META:
                  </span>
                  <p className={`${isA5 ? 'text-[10px]' : 'text-[11px]'} text-slate-700`}>
                    <span className="text-slate-500">Valid Until:</span>{' '}
                    <span className="font-bold text-slate-900 tabular-nums">{quotation.validity_date || '7 days from issue'}</span>
                  </p>
                  <p className={`${isA5 ? 'text-[10px]' : 'text-[11px]'} text-slate-700 mt-0.5`}>
                    <span className="text-slate-500">Tax Convention:</span>{' '}
                    <span className="font-semibold text-emerald-800">GST Inclusive</span>
                  </p>
                  <p className={`${isA5 ? 'text-[10px]' : 'text-[11px]'} text-slate-700 mt-0.5`}>
                    <span className="text-slate-500">Authorized:</span>{' '}
                    <span className="font-semibold text-slate-900">Udhayam Paint Division</span>
                  </p>
                </div>
              </div>

              {/* Line Items Table with Clean Alignment */}
              <div className="mt-2.5 sm:mt-3 border border-slate-200 rounded-xl overflow-hidden shadow-2xs flex-1 flex flex-col">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-[#00545C] text-white text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">
                      <th className={`text-center ${isA5 ? 'py-1.5 px-1.5 w-7' : 'py-2.5 px-3 w-10'}`}>#</th>
                      <th className={`${isA5 ? 'py-1.5 px-2' : 'py-2.5 px-3'}`}>Item Description & Specifications</th>
                      <th className={`text-center ${isA5 ? 'py-1.5 px-1.5 w-14' : 'py-2.5 px-2.5 w-20'}`}>HSN</th>
                      <th className={`text-center ${isA5 ? 'py-1.5 px-1 w-10' : 'py-2.5 px-2.5 w-14'}`}>Unit</th>
                      <th className={`text-center ${isA5 ? 'py-1.5 px-1 w-10' : 'py-2.5 px-2.5 w-14'}`}>Qty</th>
                      <th className={`text-right ${isA5 ? 'py-1.5 px-2 w-18' : 'py-2.5 px-3 w-24'}`}>Rate (₹)</th>
                      <th className={`text-right ${isA5 ? 'py-1.5 px-2 w-20' : 'py-2.5 px-3.5 w-28'}`}>Total (₹)</th>
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
                        <td className={`text-center text-slate-600 tabular-nums font-medium ${isA5 ? 'py-1.5 px-1.5 text-[10px]' : 'py-2.5 px-2.5 text-[11px]'}`}>
                          {item.hsn_sac || '-'}
                        </td>
                        <td className={`text-center text-slate-600 font-medium ${isA5 ? 'py-1.5 px-1 text-[10px]' : 'py-2.5 px-2.5 text-[11px]'}`}>
                          {item.unit || 'Nos'}
                        </td>
                        <td className={`text-center font-extrabold text-slate-900 tabular-nums ${isA5 ? 'py-1.5 px-1 text-[11px]' : 'py-2.5 px-2.5 text-xs sm:text-[13px]'}`}>
                          {item.quantity}
                        </td>
                        <td className={`text-right font-semibold text-slate-700 tabular-nums ${isA5 ? 'py-1.5 px-2 text-[11px]' : 'py-2.5 px-3 text-xs sm:text-[13px]'}`}>
                          {Number(item.sale_rate).toFixed(2)}
                        </td>
                        <td className={`text-right font-extrabold text-slate-900 tabular-nums ${isA5 ? 'py-1.5 px-2 text-[11px]' : 'py-2.5 px-3.5 text-xs sm:text-[13px]'}`}>
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
              
              {/* Bottom Two Cards: Equal Height, Perfectly Aligned Bottom */}
              <div className={`grid grid-cols-1 md:grid-cols-2 ${isA5 ? 'gap-2' : 'gap-3.5'} items-stretch`}>
                
                {/* Left Card: Bank Details, UPI QR, and Terms & Conditions */}
                <div className={`bg-slate-50/90 border border-slate-200 rounded-xl flex flex-col justify-between h-full ${
                  isA5 ? 'p-2.5' : 'p-3.5'
                }`}>
                  <div>
                    <span className={`${isA5 ? 'text-[8px]' : 'text-[9px]'} font-extrabold text-[#00545C] uppercase tracking-wider block mb-1`}>
                      BANK & UPI PAYMENT DETAILS:
                    </span>
                    
                    <div className="flex items-start justify-between gap-2 sm:gap-3">
                      <div className={`${isA5 ? 'text-[9.5px]' : 'text-[11px]'} text-slate-700 space-y-0.5 flex-1 min-w-0`}>
                        <p><span className="text-slate-500 font-medium">Bank:</span> <strong className="text-slate-900 font-bold">{settings?.bank_name || 'Indian Bank'}</strong> ({settings?.bank_branch || 'Perundurai'})</p>
                        <p><span className="text-slate-500 font-medium">A/c Name:</span> <strong className="text-slate-900 font-semibold">{settings?.bank_account_name || 'Udhayam Agencies'}</strong></p>
                        <p><span className="text-slate-500 font-medium">A/c No:</span> <strong className="text-slate-900 font-bold tabular-nums">{settings?.bank_account_no || '6659330152'}</strong></p>
                        <p><span className="text-slate-500 font-medium">IFSC:</span> <strong className="text-slate-900 font-bold tabular-nums">{settings?.bank_ifsc || 'IDIB000P034'}</strong></p>
                        <p className="text-[#00545C] font-bold pt-0.5">
                          GPay: <span className="tabular-nums">{settings?.gpay_number || '+91 97156 22499'}</span> <span className="text-slate-500 font-normal">(MS Udhayam)</span>
                        </p>
                      </div>

                      {/* UPI QR Code Container with Frame */}
                      <div className="flex flex-col items-center flex-shrink-0 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                        <img
                          src={`/uploads/qr/${settings?.payment_qr_code || 'default_upi_qr.png'}`}
                          alt="UPI QR Code"
                          className={`${isA5 ? 'w-12 h-12' : 'w-16 h-16 sm:w-18 sm:h-18'} object-contain rounded-md`}
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = '/uploads/qr/default_upi_qr.png';
                          }}
                        />
                        <span className={`${isA5 ? 'text-[7px]' : 'text-[8px]'} font-black text-[#00545C] mt-0.5 uppercase tracking-wider`}>
                          SCAN TO PAY UPI
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Terms & Conditions */}
                  <div className={`mt-2 pt-1.5 border-t border-slate-200 ${isA5 ? 'text-[9px]' : 'text-[10px]'} text-slate-500 leading-tight`}>
                    <span className="font-bold text-slate-700 block mb-0.5">Terms & Conditions:</span>
                    <div className="whitespace-pre-line leading-relaxed text-slate-600">
                      {quotation.notes || settings?.default_terms || '1. Quotation is valid for 7 days from the date of issue.\n2. Goods once sold/dispatched will not be taken back.\n3. Delivery subject to physical stock availability.\n4. GST and Transport charges applicable as mentioned.'}
                    </div>
                  </div>
                </div>

                {/* Right Card: Tax-Inclusive Financial Breakdown */}
                <div className={`bg-white border border-slate-200 rounded-xl flex flex-col justify-between h-full shadow-2xs ${
                  isA5 ? 'p-2.5 text-[11px]' : 'p-3.5 text-xs'
                }`}>
                  <div className={`space-y-1 text-slate-700`}>
                    <div className="flex justify-between py-0.5 border-b border-slate-100">
                      <span className="text-slate-600 font-medium">Subtotal (Retail Incl. GST):</span>
                      <span className={`font-extrabold text-slate-900 tabular-nums ${isA5 ? 'text-xs' : 'text-sm'}`}>{formatCurrency(subtotal)}</span>
                    </div>

                    {discountAmount > 0 && (
                      <div className="flex justify-between py-0.5 border-b border-slate-100 text-emerald-700">
                        <span className="font-medium">Discount ({quotation.discount_percent}%):</span>
                        <span className="font-bold tabular-nums">- {formatCurrency(discountAmount)}</span>
                      </div>
                    )}

                    {/* GST Inclusive Breakdown Box */}
                    <div className={`bg-slate-50/90 rounded-lg border border-slate-200/80 space-y-0.5 ${
                      isA5 ? 'p-1.5 text-[9.5px]' : 'p-2 text-[11px]'
                    }`}>
                      <div className="flex justify-between text-slate-500">
                        <span>Taxable Value (Base):</span>
                        <span className="tabular-nums font-semibold text-slate-700">{formatCurrency(taxableAmount)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>CGST ({(gstRate / 2)}%):</span>
                        <span className="tabular-nums font-semibold text-slate-700">{formatCurrency(cgstAmount)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>SGST ({(gstRate / 2)}%):</span>
                        <span className="tabular-nums font-semibold text-slate-700">{formatCurrency(sgstAmount)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-emerald-800 pt-0.5 border-t border-slate-200">
                        <span>Total GST Included ({gstRate}%):</span>
                        <span className="tabular-nums font-extrabold">{formatCurrency(gstAmount)}</span>
                      </div>
                    </div>

                    {Number(quotation.delivery_charges || 0) > 0 && (
                      <div className="flex justify-between py-0.5 border-b border-slate-100">
                        <span className="text-slate-600 font-medium">Delivery / Freight:</span>
                        <span className="font-bold text-slate-900 tabular-nums">+ {formatCurrency(quotation.delivery_charges)}</span>
                      </div>
                    )}
                  </div>

                  {/* Grand Total Highlight Banner */}
                  <div className="mt-2 pt-1 border-t border-slate-200">
                    <div className={`bg-[#00545C] text-white rounded-xl flex items-center justify-between shadow-sm ${
                      isA5 ? 'p-2 sm:p-2.5' : 'p-2.5 sm:p-3'
                    }`}>
                      <div>
                        <span className={`font-black uppercase tracking-wider block leading-tight ${
                          isA5 ? 'text-[10px]' : 'text-xs'
                        }`}>
                          GRAND TOTAL:
                        </span>
                        <span className={`${isA5 ? 'text-[8.5px]' : 'text-[10px]'} text-emerald-200 font-medium`}>
                          Inclusive of all taxes
                        </span>
                      </div>
                      <div className="text-right">
                        <span className={`font-black tabular-nums block leading-none text-[#7DBA00] ${
                          isA5 ? 'text-sm sm:text-base' : 'text-base sm:text-xl'
                        }`}>
                          {formatCurrency(quotation.grand_total)}
                        </span>
                      </div>
                    </div>
                    {/* Amount in words */}
                    <div className={`mt-1.5 text-slate-500 italic leading-snug ${isA5 ? 'text-[8.5px]' : 'text-[10px]'}`}>
                      <span className="font-bold text-slate-700 not-italic">In Words: </span>
                      {numberToIndianWords(quotation.grand_total)}
                    </div>
                  </div>
                </div>

              </div>

              {/* Footer Signature & Verification Bar */}
              <div className={`pt-2 border-t border-slate-300 flex items-end justify-between ${
                isA5 ? 'text-[10px]' : 'text-xs'
              } text-slate-600`}>
                <div className="space-y-0.5">
                  <p className={`font-bold text-slate-700 ${isA5 ? 'text-[10px]' : 'text-xs'}`}>Customer Acceptance</p>
                  <div className={`border-b border-dashed border-slate-300 ${isA5 ? 'h-6 w-32' : 'h-8 w-44'}`}></div>
                  <p className={`${isA5 ? 'text-[8.5px]' : 'text-[10px]'} text-slate-400`}>Signature / Seal & Date</p>
                </div>

                <div className={`text-center text-slate-400 max-w-xs hidden sm:block ${isA5 ? 'text-[8.5px]' : 'text-[10px]'}`}>
                  <p>Computer-generated quotation valid without physical signature.</p>
                  <p className="font-medium text-slate-500">UDHAYAM AGENCIES • GSTIN: {settings?.company_gstin || '33AADFU6496M1ZJ'}</p>
                </div>

                <div className="text-right space-y-0.5">
                  <p className={`font-black text-slate-900 ${isA5 ? 'text-[10px]' : 'text-xs'}`}>For {settings?.company_name || 'UDHAYAM AGENCIES'}</p>
                  <div className={`border-b border-dashed border-slate-300 ml-auto ${isA5 ? 'h-6 w-32' : 'h-8 w-44'}`}></div>
                  <p className={`font-semibold text-slate-700 ${isA5 ? 'text-[8.5px]' : 'text-[10px]'}`}>Authorised Signatory</p>
                </div>
              </div>

            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
