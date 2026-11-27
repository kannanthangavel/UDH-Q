import React, { useState, useRef } from 'react';
import { 
  FileText, Upload, CheckCircle2, AlertCircle, RefreshCw, 
  Download, MessageSquare, ArrowRight, X, Sparkles, Building2,
  ChevronRight, Phone, MapPin, Hash, Calendar, Layers, Check, ShieldCheck, AlertTriangle
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { calculateQuotationFinancials } from '../utils/quotationEngine';
import { toYMDString } from '../utils/dateHelper';

const DEFAULT_OFFICIAL_TERMS =
  '1. Quotation valid for 15 days from date of issue.\n2. Goods once sold will not be taken back or exchanged.\n3. 100% payment on delivery / as per agreed terms.\n4. Subject to Perundurai jurisdiction only.';

export default function OptechPdfUploadModal({
  isOpen,
  onClose,
  onApplyToStudio,
  onQuotationCreated
}) {
  const { settings } = useAuth();
  const [file, setFile] = useState(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState('');
  const [parsedData, setParsedData] = useState(null);

  // Editable fields in preview
  const [customerName, setCustomerName] = useState('');
  const [customerGstin, setCustomerGstin] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [quotationNumber, setQuotationNumber] = useState('');
  const [quotationDate, setQuotationDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [validityDate, setValidityDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 8);
    return d.toISOString().split('T')[0];
  });
  const [paymentTerms, setPaymentTerms] = useState('Cash');
  const [items, setItems] = useState([]);
  const [paperFormat, setPaperFormat] = useState('A4');
  const [isCreatingQuote, setIsCreatingQuote] = useState(false);

  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  function resetAll() {
    setFile(null);
    setIsParsing(false);
    setParseError('');
    setParsedData(null);
    setCustomerName('');
    setCustomerGstin('');
    setCustomerPhone('');
    setCustomerAddress('');
    setQuotationNumber('');
    setQuotationDate(new Date().toISOString().split('T')[0]);
    const d = new Date();
    d.setDate(d.getDate() + 8);
    setValidityDate(d.toISOString().split('T')[0]);
    setPaymentTerms('Cash');
    setItems([]);
  }

  function handleSetValidityPreset(days) {
    const base = quotationDate ? new Date(quotationDate) : new Date();
    const d = isNaN(base.getTime()) ? new Date() : base;
    d.setDate(d.getDate() + days);
    setValidityDate(d.toISOString().split('T')[0]);
  }

  function handleFileSelected(e) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!selected.name.toLowerCase().endsWith('.pdf')) {
      setParseError('Please select a valid PDF quotation document.');
      return;
    }

    setFile(selected);
    setParseError('');
    handleParsePdf(selected);
  }

  async function handleParsePdf(fileToUpload) {
    try {
      setIsParsing(true);
      setParseError('');

      const formData = new FormData();
      formData.append('file', fileToUpload);

      const res = await api.uploadOptechPdf(formData);

      if (res && res.success) {
        setParsedData(res);
        setCustomerName(res.customer?.name || '');
        setCustomerGstin(res.customer?.gstin || '');
        setCustomerPhone(res.customer?.phone || '');
        setCustomerAddress(res.customer?.address || '');
        setQuotationNumber(res.quotationNumber || res.referenceNo || res.estimateNumber || '');
        setPaymentTerms(res.paymentTerms || 'Cash');
        if (res.quotationDate) setQuotationDate(res.quotationDate);
        if (res.quotationDate) {
          const qd = new Date(res.quotationDate);
          if (!isNaN(qd.getTime())) {
            qd.setDate(qd.getDate() + 8);
            setValidityDate(qd.toISOString().split('T')[0]);
          }
        }
        setItems(res.items || []);
      } else {
        setParseError(res.error || 'Could not parse quotation items from this PDF.');
      }
    } catch (err) {
      console.error('[Optech PDF Parse Error]:', err);
      setParseError(err.message || 'Error uploading and analyzing Optech PDF.');
    } finally {
      setIsParsing(false);
    }
  }

  function handleSwitchPack(itemIndex, sisterProduct) {
    setItems(prev => {
      const updated = [...prev];
      const target = updated[itemIndex];
      if (!target) return prev;

      target.product_id = sisterProduct.id;
      target.item_name = sisterProduct.item_name;
      target.sale_rate = sisterProduct.sale_rate;
      target.line_total = Math.round(target.quantity * sisterProduct.sale_rate * 100) / 100;
      target.unit = sisterProduct.main_unit || target.unit;
      return updated;
    });
  }

  function handleRemoveItem(idx) {
    setItems(prev => prev.filter((_, i) => i !== idx));
  }

  function handleUpdateItem(idx, field, value) {
    setItems(prev => {
      const next = [...prev];
      const it = { ...next[idx] };
      if (field === 'quantity') {
        it.quantity = Math.max(0.01, parseFloat(value) || 0);
      } else if (field === 'sale_rate') {
        it.sale_rate = Math.max(0, parseFloat(value) || 0);
      } else if (field === 'tax_percent') {
        it.tax_percent = parseFloat(value) || 0;
      }
      it.line_total = Math.round(it.quantity * it.sale_rate * 100) / 100;
      next[idx] = it;
      return next;
    });
  }

  // Canonical Calculation Engine for Optech Quotation Review
  const liveFinancials = calculateQuotationFinancials({
    items: items,
    is_tax_inclusive: false, // Optech uses Tax Exclusive breakdown
    delivery_charges: 0,
    customer_gstin: customerGstin
  });

  const taxableSubtotal = liveFinancials.taxableValue;
  const cgstAmount = liveFinancials.totalCgst;
  const sgstAmount = liveFinancials.totalSgst;
  const totalTaxAmount = liveFinancials.totalTaxAmount;
  const roundOff = liveFinancials.roundedOff;
  const grandTotal = liveFinancials.grandTotal;
  const totalQty = items.reduce((acc, it) => acc + (parseFloat(it.quantity) || 0), 0);
  const taxSlabs = liveFinancials.taxSlabs || [];

  const extractedTotal = parsedData?.totals?.grandTotal != null ? Number(parsedData.totals.grandTotal) : null;
  const hasDiscrepancy = extractedTotal != null && Math.abs(extractedTotal - grandTotal) > 1.0;

  async function handleConvert(action = 'download') {
    if (!customerName.trim()) {
      setParseError('Please enter a customer name for the quotation.');
      return;
    }
    if (items.length === 0) {
      setParseError('At least one line item is required.');
      return;
    }

    try {
      setIsCreatingQuote(true);
      setParseError('');

      const quotePayload = {
        quotation_number: quotationNumber.trim(),
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        customer_address: customerAddress.trim(),
        customer_gstin: customerGstin.trim(),
        reference_no: parsedData?.referenceNo || parsedData?.estimateNumber || '',
        payment_terms: (paymentTerms || '').trim() || 'Cash',
        validity_date: validityDate,
        quotation_date: quotationDate || new Date().toISOString().split('T')[0],
        rounded_off: roundOff,
        paper_format: paperFormat,
        subtotal: Math.round(taxableSubtotal * 100) / 100,
        gst_rate: 18,
        gst_amount: Math.round(totalTaxAmount * 100) / 100,
        grand_total: Math.round(grandTotal * 100) / 100,
        is_tax_inclusive: false, // Optech uses Tax Exclusive breakdown
        notes: (settings?.default_terms && !/7 days/i.test(settings.default_terms))
          ? settings.default_terms
          : DEFAULT_OFFICIAL_TERMS,
        items: items.map(it => ({
          product_id: it.product_id || null,
          item_name: it.item_name,
          details: it.details || '',
          hsn_sac: it.hsn_sac || '3209',
          unit: it.unit || 'Nos',
          quantity: it.quantity,
          sale_rate: it.sale_rate,
          tax_percent: it.tax_percent || 18,
          line_total: it.line_total
        }))
      };

      const res = await api.createQuotation(quotePayload);

      if (res && res.quotation) {
        if (action === 'download') {
          // Trigger instant reliable download of the converted PDF
          const downloadUrl = api.getApiUrl(`/quotations/${res.quotation.id}/pdf?format=${paperFormat}&download=true`);
          const safeCust = (res.quotation.customer_name || 'Customer').trim().replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
          const safeQuoteNo = (res.quotation.quotation_number || 'Quote').trim().replace(/[^A-Za-z0-9\-]+/g, '_');
          const targetFilename = `${safeCust}_${safeQuoteNo}.pdf`;
          try {
            const blobRes = await fetch(downloadUrl);
            if (!blobRes.ok) throw new Error(`HTTP ${blobRes.status}`);
            const blob = await blobRes.blob();
            const objectUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = objectUrl;
            link.download = targetFilename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1500);
          } catch (e) {
            console.warn('Direct blob download failed, falling back to window.open:', e);
            window.open(downloadUrl, '_blank');
          }
        }

        if (onQuotationCreated) {
          onQuotationCreated(res.quotation, { openWhatsApp: action === 'share' });
        }
        onClose();
        resetAll();
      } else {
        setParseError(res.error || 'Failed to create quotation.');
      }
    } catch (err) {
      setParseError(err.message || 'Error generating UD-QM quotation.');
    } finally {
      setIsCreatingQuote(false);
    }
  }

  function handleLoadIntoStudio() {
    if (onApplyToStudio) {
      onApplyToStudio({
        customer: {
          name: customerName,
          phone: customerPhone,
          address: customerAddress,
          gstin: customerGstin
        },
        quotation_number: quotationNumber,
        reference_no: parsedData?.referenceNo || quotationNumber || '',
        payment_terms: paymentTerms || 'Cash',
        validity_date: validityDate,
        is_tax_inclusive: false,
        subtotal: taxableSubtotal,
        gst_amount: totalTaxAmount,
        grand_total: grandTotal,
        items: items.map(it => ({
          productId: it.product_id,
          itemName: it.item_name,
          details: it.details || (parsedData?.referenceNo ? `Optech #${parsedData.referenceNo}` : ''),
          hsnSac: it.hsn_sac || '3209',
          unit: it.unit || 'Nos',
          quantity: it.quantity,
          saleRate: it.sale_rate,
          taxPercent: it.tax_percent || 18,
          lineTotal: it.line_total,
          availableSizes: it.availableSizes || []
        }))
      });
    }
    onClose();
    resetAll();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-[#00545C] to-[#0A6D77] px-6 py-4 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#7DBA00] text-[#003B40] flex items-center justify-center shadow-md font-black">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight">
                  Optech Software PDF Auto-Converter
                </h2>
                <span className="bg-[#7DBA00] text-[#003B40] text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                  1-Click Convert
                </span>
              </div>
              <p className="text-xs text-emerald-100">
                Upload Optech quote PDF → preserves exact Customer, GSTIN, Quantities & Rates → instant UD-QM A4/A5 PDF & WhatsApp Share!
              </p>
            </div>
          </div>

          <button
            onClick={() => { onClose(); resetAll(); }}
            className="p-1.5 rounded-lg text-emerald-100 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          
          {/* Error Banner */}
          {parseError && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 flex items-start space-x-3 text-rose-800 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{parseError}</div>
              <button onClick={() => setParseError('')} className="text-rose-500 hover:text-rose-700">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Upload Area */}
          {!parsedData && (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all ${
                isParsing 
                  ? 'border-[#00545C] bg-emerald-50/50 cursor-wait' 
                  : 'border-slate-300 hover:border-[#00545C] hover:bg-slate-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileSelected}
                className="hidden"
              />

              {isParsing ? (
                <div className="flex flex-col items-center justify-center space-y-3">
                  <RefreshCw className="w-10 h-10 text-[#00545C] animate-spin" />
                  <div>
                    <p className="font-extrabold text-sm text-slate-800">
                      Ingesting Optech Quotation PDF...
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Extracting Customer, GSTIN, Products, Rates & Tax Breakdown...
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-[#00545C]/10 text-[#00545C] flex items-center justify-center">
                    <Upload className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="font-extrabold text-sm sm:text-base text-slate-800">
                      Click to choose or drop Optech Quote PDF here
                    </p>
                    <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                      Supports all Optech Retail & Wholesale paint estimate exports. Extracts customer details, products, packs, and rates automatically.
                    </p>
                  </div>
                  <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200">
                    <FileText className="w-3.5 h-3.5 text-[#00545C]" />
                    <span>Select Optech Estimate PDF</span>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Parsed Quotation Preview */}
          {parsedData && (
            <div className="space-y-4 animate-in fade-in duration-150">
              
              {/* File Info Bar */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold text-emerald-950">
                    Parsed: <span className="font-mono">{file?.name || parsedData.filename}</span>
                  </span>
                  {parsedData.referenceNo && (
                    <span className="bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded font-mono font-bold text-[10px]">
                      Optech #{parsedData.referenceNo}
                    </span>
                  )}
                  {parsedData.quotationDate && (
                    <span className="text-emerald-700">
                      • {parsedData.quotationDate}
                    </span>
                  )}
                  {parsedData.paymentTerms && (
                    <span className="text-emerald-700">
                      • Terms: {parsedData.paymentTerms}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs font-bold text-[#00545C] hover:underline cursor-pointer"
                >
                  Change PDF File
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileSelected}
                  className="hidden"
                />
              </div>

              {/* Conversion Review Checklist */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="bg-white border border-slate-200 rounded-xl p-2.5 flex items-center space-x-2 shadow-2xs">
                  {customerName ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Customer</span>
                    <span className="font-bold text-slate-900 truncate block text-xs" title={customerName}>
                      {customerName || 'Required'}
                    </span>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-2.5 flex items-center space-x-2 shadow-2xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Quote No</span>
                    <span className="font-bold text-slate-900 truncate block text-xs font-mono">
                      {quotationNumber || 'UDQ-Auto'}
                    </span>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-2.5 flex items-center space-x-2 shadow-2xs">
                  {customerGstin ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  ) : (
                    <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-400 font-bold text-[10px] flex items-center justify-center flex-shrink-0">i</span>
                  )}
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">GSTIN</span>
                    <span className="font-bold text-slate-900 truncate block text-xs font-mono">
                      {customerGstin || 'Unregistered'}
                    </span>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-2.5 flex items-center space-x-2 shadow-2xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Items & Slabs</span>
                    <span className="font-bold text-slate-900 truncate block text-xs">
                      {items.length} Items ({taxSlabs.map(s => `${s.rate}%`).join(', ') || '18%'})
                    </span>
                  </div>
                </div>
              </div>

              {/* Discrepancy Warning Alert */}
              {hasDiscrepancy && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-start space-x-2.5 text-xs text-amber-900 shadow-2xs">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Imported total differs from calculated total:</span>
                    <span>
                      The extracted Optech footer total is <strong>₹{extractedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>, whereas the recalculated sum is <strong>₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>. Please review line item quantities, rates, and tax percentages below.
                    </span>
                  </div>
                </div>
              )}

              {/* Customer Details Form */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3 flex items-center space-x-1.5">
                  <Building2 className="w-3.5 h-3.5 text-[#00545C]" />
                  <span>Customer Details (from Optech PDF)</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Customer / Firm Name *
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                      placeholder="e.g. Milky Mist Diary Food Pvt Ltd"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00545C] font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Customer GSTIN
                    </label>
                    <input
                      type="text"
                      value={customerGstin}
                      onChange={e => setCustomerGstin(e.target.value)}
                      placeholder="e.g. 33AAJCM3448G1ZI"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00545C] font-mono font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Phone Number (Optional)
                    </label>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={e => setCustomerPhone(e.target.value)}
                      placeholder="Mobile for WhatsApp share"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00545C] font-mono text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Address / Location
                    </label>
                    <input
                      type="text"
                      value={customerAddress}
                      onChange={e => setCustomerAddress(e.target.value)}
                      placeholder="e.g. Pattakaran Palayam, Perundurai"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00545C] text-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* Quotation Parameters & CASH / Credit Operations */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3 flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#00545C]" />
                    <span>Quotation Number, Validity & Payment Terms</span>
                  </div>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                    Optech Linked
                  </span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Quote Number (SAM Quote Number from Optech) */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Quotation / Estimate # *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={quotationNumber}
                        onChange={e => setQuotationNumber(e.target.value)}
                        placeholder="e.g. 1182"
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00545C] font-mono font-bold text-[#00545C]"
                      />
                      {parsedData?.referenceNo && (
                        <span className="absolute right-2 top-2 text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                          Optech No
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Matches Optech quote number automatically.
                    </span>
                  </div>

                  {/* Quotation Issue Date */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Quotation Date (Issue Date)
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        value={toYMDString(quotationDate)}
                        onChange={e => setQuotationDate(e.target.value)}
                        onClick={(e) => { try { e.target.showPicker(); } catch (err) {} }}
                        className="w-full px-3 py-2 pr-9 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00545C] font-mono font-medium text-slate-900 cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          const input = e.currentTarget.previousElementSibling;
                          if (input && input.showPicker) {
                            try { input.showPicker(); } catch (err) { input.focus(); }
                          }
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#00545C] cursor-pointer p-0.5"
                        title="Open calendar"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Manual Validity Date Operation */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-slate-700">
                        Valid Until Date
                      </label>
                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => handleSetValidityPreset(7)}
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white hover:bg-slate-200 text-slate-600 border border-slate-200 cursor-pointer"
                        >
                          +7D
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetValidityPreset(15)}
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white hover:bg-slate-200 text-slate-600 border border-slate-200 cursor-pointer"
                        >
                          +15D
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetValidityPreset(30)}
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white hover:bg-slate-200 text-slate-600 border border-slate-200 cursor-pointer"
                        >
                          +30D
                        </button>
                      </div>
                    </div>
                    <div className="relative">
                      <input
                        type="date"
                        value={toYMDString(validityDate)}
                        onChange={e => setValidityDate(e.target.value)}
                        onClick={(e) => { try { e.target.showPicker(); } catch (err) {} }}
                        className="w-full px-3 py-2 pr-9 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00545C] font-mono font-medium text-slate-900 cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          const input = e.currentTarget.previousElementSibling;
                          if (input && input.showPicker) {
                            try { input.showPicker(); } catch (err) { input.focus(); }
                          }
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#00545C] cursor-pointer p-0.5"
                        title="Open calendar"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Manual calendar selection or quick presets.
                    </span>
                  </div>

                  {/* CASH / Credit Operations */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Payment Terms (Cash / Credit)
                    </label>
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      <button
                        type="button"
                        onClick={() => setPaymentTerms('Cash')}
                        className={`text-[10px] font-extrabold px-2 py-1 rounded-md transition-colors cursor-pointer ${
                          (paymentTerms || '').toLowerCase() === 'cash'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        💵 Cash
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentTerms('Credit')}
                        className={`text-[10px] font-extrabold px-2 py-1 rounded-md transition-colors cursor-pointer ${
                          (paymentTerms || '').toLowerCase() === 'credit'
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        💳 Credit
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentTerms('Credit (15 Days)')}
                        className={`text-[10px] font-bold px-2 py-1 rounded-md transition-colors cursor-pointer ${
                          (paymentTerms || '').includes('15')
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        15 Days
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentTerms('Credit (30 Days)')}
                        className={`text-[10px] font-bold px-2 py-1 rounded-md transition-colors cursor-pointer ${
                          (paymentTerms || '').includes('30')
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        30 Days
                      </button>
                    </div>
                    <input
                      type="text"
                      value={paymentTerms || ''}
                      onChange={e => setPaymentTerms(e.target.value)}
                      placeholder="e.g. Cash / Credit (15 Days)"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00545C] text-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* Line Items Table (Optech Layout Design) */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="bg-slate-100 px-4 py-2.5 flex items-center justify-between border-b border-slate-200">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-black text-slate-800">
                      Line Items ({items.length}) • Total Qty: {totalQty}
                    </span>
                    <span className="bg-[#7DBA00] text-[#003B40] text-[10px] font-black px-2 py-0.5 rounded-full">
                      Exact Rates & Quantities
                    </span>
                  </div>
                  
                  {/* Paper Format Selector */}
                  <div className="flex items-center space-x-1 text-xs">
                    <span className="text-slate-500 font-medium">Format:</span>
                    <button
                      type="button"
                      onClick={() => setPaperFormat('A4')}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer ${
                        paperFormat === 'A4' ? 'bg-[#00545C] text-white' : 'bg-white text-slate-700 border border-slate-200'
                      }`}
                    >
                      A4 Full
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaperFormat('A5')}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer ${
                        paperFormat === 'A5' ? 'bg-[#00545C] text-white' : 'bg-white text-slate-700 border border-slate-200'
                      }`}
                    >
                      A5 Half
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-72 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-[#00545C] text-white font-bold text-[11px] sticky top-0 z-10">
                      <tr>
                        <th className="py-2 px-3 w-8 text-center">S.No</th>
                        <th className="py-2 px-3">Description of Goods</th>
                        <th className="py-2 px-3 w-24 text-center">HSN/SAC</th>
                        <th className="py-2 px-3 w-20 text-center">Qty</th>
                        <th className="py-2 px-3 w-24 text-right">Rate (₹)</th>
                        <th className="py-2 px-3 w-16 text-center">Tax %</th>
                        <th className="py-2 px-3 w-28 text-right">Amount (₹)</th>
                        <th className="py-2 px-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((it, idx) => (
                        <tr key={it.id || idx} className="hover:bg-slate-50/80">
                          <td className="py-2.5 px-3 font-mono text-slate-400 text-center">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-extrabold text-slate-900">
                              {it.item_name}
                            </div>
                            {/* Sister sizes pill selector */}
                            {it.availableSizes && it.availableSizes.length > 1 && (
                              <div className="flex flex-wrap items-center gap-1 mt-1">
                                <span className="text-[10px] font-bold text-slate-400">Packs:</span>
                                {it.availableSizes.map(sz => (
                                  <button
                                    key={sz.id}
                                    type="button"
                                    onClick={() => handleSwitchPack(idx, sz)}
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                                      sz.id === it.product_id
                                        ? 'bg-[#00545C] text-white'
                                        : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                                    }`}
                                  >
                                    {sz.pack_size || sz.item_name.match(/(\d+(?:\.\d+)?\s*(?:LT|L|ML|KG|GM|NOS))\b/i)?.[1] || 'Size'} (₹{sz.sale_rate})
                                  </button>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                            {it.hsn_sac || '-'}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <div className="flex items-center justify-center space-x-1">
                              <input
                                type="number"
                                min="0.01"
                                step="any"
                                value={it.quantity}
                                onChange={(e) => handleUpdateItem(idx, 'quantity', e.target.value)}
                                className="w-16 text-center font-mono font-bold text-xs py-1 px-1 border border-slate-300 rounded bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#00545C]"
                              />
                              <span className="text-[10px] text-slate-500 font-normal">{it.unit || 'Nos'}</span>
                            </div>
                          </td>
                          <td className="py-2 px-2 text-right">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={it.sale_rate}
                              onChange={(e) => handleUpdateItem(idx, 'sale_rate', e.target.value)}
                              className="w-20 text-right font-mono font-bold text-xs py-1 px-1 border border-slate-300 rounded bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#00545C]"
                            />
                          </td>
                          <td className="py-2 px-2 text-center">
                            <select
                              value={it.tax_percent != null ? it.tax_percent : 18}
                              onChange={(e) => handleUpdateItem(idx, 'tax_percent', e.target.value)}
                              className="text-xs font-mono font-bold py-1 px-1 border border-slate-300 rounded bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#00545C]"
                            >
                              <option value="18">18%</option>
                              <option value="5">5%</option>
                              <option value="12">12%</option>
                              <option value="28">28%</option>
                              <option value="0">0%</option>
                            </select>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-extrabold text-[#00545C]">
                            ₹{Number(it.line_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="text-slate-400 hover:text-rose-600 cursor-pointer"
                              title="Remove item"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Tax Breakdown & Net Amount Footer */}
                <div className="bg-slate-50 border-t border-slate-200 p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1 text-slate-600">
                      <div className="font-bold text-slate-800">GST Breakdown (Optech Standard):</div>
                      <div className="flex justify-between max-w-xs">
                        <span>Taxable Value (Subtotal):</span>
                        <span className="font-mono font-bold">₹{taxableSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      {taxSlabs.length > 1 ? (
                        taxSlabs.map((s, sIdx) => (
                          <div key={sIdx} className="flex justify-between max-w-xs text-[11px] text-slate-600 pl-2 border-l-2 border-slate-300">
                            <span>Slab {s.rate}% (Taxable ₹{s.taxableValue.toFixed(2)}):</span>
                            <span className="font-mono font-semibold">+ ₹{s.totalTaxAmount.toFixed(2)}</span>
                          </div>
                        ))
                      ) : (
                        <>
                          <div className="flex justify-between max-w-xs">
                            <span>CGST ({taxSlabs[0]?.cgstPercent ? taxSlabs[0].cgstPercent.toFixed(2) : '9.00'}%):</span>
                            <span className="font-mono">+ ₹{cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between max-w-xs">
                            <span>SGST ({taxSlabs[0]?.sgstPercent ? taxSlabs[0].sgstPercent.toFixed(2) : '9.00'}%):</span>
                            <span className="font-mono">+ ₹{sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between max-w-xs pt-1 border-t border-slate-200">
                        <span>Total Tax Amount:</span>
                        <span className="font-mono font-bold text-slate-800">₹{totalTaxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      {roundOff !== 0 && (
                        <div className="flex justify-between max-w-xs">
                          <span>Rounded Off:</span>
                          <span className="font-mono">{roundOff > 0 ? `+ ₹${roundOff}` : `- ₹${Math.abs(roundOff)}`}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col justify-end items-end space-y-1">
                      <div className="text-right">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Net Amount (Incl. GST)</span>
                        <span className="text-2xl font-black text-[#00545C] font-mono">
                          ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      {parsedData?.totals?.amountInWords && (
                        <div className="text-[11px] text-slate-500 italic max-w-sm text-right">
                          {parsedData.totals.amountInWords}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Modal Footer Actions */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={() => { onClose(); resetAll(); }}
            className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer transition-colors"
          >
            Cancel
          </button>

          {parsedData && (
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleLoadIntoStudio}
                className="inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-xl border border-[#00545C] bg-white text-[#00545C] hover:bg-emerald-50 text-xs font-bold cursor-pointer transition-colors"
              >
                <span>Edit in Quotation Studio</span>
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                disabled={isCreatingQuote}
                onClick={() => handleConvert('download')}
                className="inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-[#7DBA00] hover:bg-[#8ee000] text-[#003B40] text-xs font-black shadow-md cursor-pointer transition-all transform active:scale-95 disabled:opacity-50"
              >
                {isCreatingQuote ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-[#003B40]" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 text-[#003B40]" />
                    <span>Convert & Download PDF</span>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={isCreatingQuote}
                onClick={() => handleConvert('share')}
                className="inline-flex items-center space-x-1.5 px-4.5 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white text-xs font-black shadow-md cursor-pointer transition-all transform active:scale-95 disabled:opacity-50"
                title="Convert and immediately share via WhatsApp with attached PDF"
              >
                <MessageSquare className="w-4 h-4 text-white" />
                <span>Convert & Share WhatsApp</span>
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
