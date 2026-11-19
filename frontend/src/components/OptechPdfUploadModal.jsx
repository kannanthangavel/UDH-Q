import React, { useState, useRef } from 'react';
import { 
  FileText, Upload, CheckCircle2, AlertCircle, RefreshCw, 
  Download, MessageSquare, ArrowRight, X, Sparkles, Building2,
  ChevronRight, Phone, MapPin, Hash, Calendar, Layers, Check
} from 'lucide-react';
import { api } from '../api/client';

export default function OptechPdfUploadModal({
  isOpen,
  onClose,
  onApplyToStudio,
  onQuotationCreated
}) {
  const [file, setFile] = useState(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState('');
  const [parsedData, setParsedData] = useState(null);

  // Editable fields in preview
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
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
    setCustomerPhone('');
    setCustomerAddress('');
    setItems([]);
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
        setCustomerName(res.customer?.name || 'Walk-in Customer');
        setCustomerPhone(res.customer?.phone || '');
        setCustomerAddress(res.customer?.address || '');
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
      target.catalog_rate = sisterProduct.sale_rate;
      target.line_total = Math.round(target.quantity * sisterProduct.sale_rate * 100) / 100;
      target.unit = sisterProduct.main_unit || target.unit;
      return updated;
    });
  }

  function handleRemoveItem(idx) {
    setItems(prev => prev.filter((_, i) => i !== idx));
  }

  // Calculate live totals
  const subtotal = items.reduce((acc, it) => acc + (it.line_total || 0), 0);
  const gstRate = 18;
  const taxAmount = Math.round((subtotal * (gstRate / (100 + gstRate))) * 100) / 100;
  const grandTotal = Math.round(subtotal * 100) / 100;

  async function handleAutoCreateAndDownload() {
    if (!customerName.trim()) {
      setParseError('Please enter a customer name for the quotation.');
      return;
    }
    if (!customerPhone.trim()) {
      setParseError('Please enter a 10-digit mobile number for WhatsApp sharing and records.');
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
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        customer_address: customerAddress.trim(),
        paper_format: paperFormat,
        gst_rate: 18,
        is_tax_inclusive: true,
        notes: parsedData?.estimateNumber ? `Converted from Optech Estimate #${parsedData.estimateNumber}` : 'Converted from Optech Quotation',
        items: items.map(it => ({
          product_id: it.product_id || null,
          item_name: it.item_name,
          details: it.details || '',
          hsn_sac: it.hsn_sac || '3209',
          unit: it.unit || 'Nos',
          quantity: it.quantity,
          sale_rate: it.sale_rate,
          line_total: it.line_total
        }))
      };

      const res = await api.createQuotation(quotePayload);

      if (res && res.quotation) {
        if (onQuotationCreated) {
          onQuotationCreated(res.quotation);
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
          address: customerAddress
        },
        items: items.map(it => ({
          productId: it.product_id,
          itemName: it.item_name,
          details: it.details || (parsedData?.estimateNumber ? `Optech Quote #${parsedData.estimateNumber}` : ''),
          hsnSac: it.hsn_sac || '3209',
          unit: it.unit || 'Nos',
          quantity: it.quantity,
          saleRate: it.sale_rate,
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
                Upload any Optech quotation/estimate PDF → auto-matches with 5,331 UD-QM catalogue items → instant UD-QM A4/A5 PDF & WhatsApp Share!
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
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
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

          {/* Upload Area (shown when no items parsed yet or to replace file) */}
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
                      Extracting text, customer details, and matching products via 11-stage AI engine...
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
            <div className="space-y-5 animate-in fade-in duration-150">
              
              {/* File Info & Re-upload Bar */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold text-emerald-950">
                    Parsed: <span className="font-mono">{file?.name || parsedData.filename}</span>
                  </span>
                  {parsedData.estimateNumber && (
                    <span className="bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded font-mono font-bold text-[10px]">
                      Est #{parsedData.estimateNumber}
                    </span>
                  )}
                  {parsedData.quotationDate && (
                    <span className="text-emerald-700">
                      • {parsedData.quotationDate}
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

              {/* Customer Details Form */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3 flex items-center space-x-1.5">
                  <Building2 className="w-3.5 h-3.5 text-[#00545C]" />
                  <span>Customer Details for Quotation</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Customer / Firm Name *
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                      placeholder="e.g. Senthil Paints"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00545C] font-semibold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Phone Number (for WhatsApp Share) *
                    </label>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={e => setCustomerPhone(e.target.value)}
                      placeholder="e.g. 9842144555"
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
                      placeholder="e.g. Perundurai Road, Erode"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00545C] text-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="bg-slate-100 px-4 py-2.5 flex items-center justify-between border-b border-slate-200">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-black text-slate-800">
                      Line Items ({items.length})
                    </span>
                    <span className="bg-[#7DBA00] text-[#003B40] text-[10px] font-black px-2 py-0.5 rounded-full">
                      Catalogue Matched
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
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 text-[11px] sticky top-0 z-10">
                      <tr>
                        <th className="py-2 px-3 w-8">#</th>
                        <th className="py-2 px-3">Product Description & Sister Sizes</th>
                        <th className="py-2 px-3 w-16 text-center">Unit</th>
                        <th className="py-2 px-3 w-16 text-right">Qty</th>
                        <th className="py-2 px-3 w-24 text-right">Sale Rate</th>
                        <th className="py-2 px-3 w-28 text-right">Total (₹)</th>
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
                            {it.details && (
                              <div className="text-[11px] text-slate-500 font-mono">
                                {it.details}
                              </div>
                            )}

                            {/* Sister sizes pill selector */}
                            {it.availableSizes && it.availableSizes.length > 1 && (
                              <div className="flex flex-wrap items-center gap-1 mt-1.5">
                                <span className="text-[10px] font-bold text-slate-400">Packs:</span>
                                {it.availableSizes.map(sz => {
                                  const isSelected = sz.id === it.product_id;
                                  return (
                                    <button
                                      key={sz.id}
                                      type="button"
                                      onClick={() => handleSwitchPack(idx, sz)}
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                                        isSelected
                                          ? 'bg-[#00545C] text-white'
                                          : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                                      }`}
                                    >
                                      {sz.pack_size || sz.item_name.match(/(\d+(?:\.\d+)?\s*(?:LT|L|ML|KG|GM|NOS))\b/i)?.[1] || 'Size'} (₹{sz.sale_rate})
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-600 font-medium">
                            {it.unit || 'Nos'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">
                            {it.quantity}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                            ₹{Number(it.sale_rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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

                {/* Totals Footer */}
                <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="text-slate-500">
                    Standard 18% Paint GST Included • Official UD-QM Rate Master
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <span className="text-slate-500 mr-2">Grand Total:</span>
                      <span className="text-base font-black text-[#00545C] font-mono">
                        ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
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
                onClick={handleAutoCreateAndDownload}
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-[#7DBA00] hover:bg-[#8ee000] text-[#003B40] text-xs font-black shadow-md cursor-pointer transition-all transform active:scale-95 disabled:opacity-50"
              >
                {isCreatingQuote ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-[#003B40]" />
                    <span>Creating Quotation...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-[#003B40]" />
                    <span>Convert to UD-QM Quotation & Download / Share</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
