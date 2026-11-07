import React, { useState } from 'react';
import { 
  Sparkles, MessageSquare, ArrowRight, Check, X, AlertCircle,
  Copy, RefreshCw, ChevronDown, CheckCircle2, ShoppingCart, Send,
  Printer, FileText, Loader2, ArrowUpRight
} from 'lucide-react';
import { api } from '../api/client';
import QuotationPdfModal from './QuotationPdfModal';
import WhatsAppShareModal from './WhatsAppShareModal';

export default function SmartParserModal({ onClose, onApplyToQuotation, onTransferToQuotation }) {
  const sampleMessage = `Customer: Ramesh +91 98427 11223
golden brown 1ltr 5ps
putty powder 40kg
brush 2" 1ps`;

  const [message, setMessage] = useState(sampleMessage);
  const [isParsing, setIsParsing] = useState(false);
  const [parseResult, setParseResult] = useState(null);
  const [parseError, setParseError] = useState('');

  // Editable customer info extracted from WhatsApp
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  
  // Editable matched items list
  const [items, setItems] = useState([]);

  // Direct Creation State
  const [isDirectCreating, setIsDirectCreating] = useState(false);
  const [createdQuotation, setCreatedQuotation] = useState(null);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [showWaModal, setShowWaModal] = useState(false);

  const transferCallback = onTransferToQuotation || onApplyToQuotation;

  async function handleParse() {
    if (!message.trim()) {
      setParseError('Please paste a WhatsApp message first.');
      return;
    }

    try {
      setIsParsing(true);
      setParseError('');
      const res = await api.parseWhatsAppMessage(message);
      
      setCustomerName(res.customerName || 'Customer');
      setCustomerPhone(res.customerPhone || '');
      
      // Map items with selected product
      const mapped = (res.items || []).map((it, idx) => ({
        id: idx,
        originalLine: it.originalLine,
        selectedProduct: it.matchedProduct,
        quantity: it.quantity || 1,
        unit: it.unit || it.matchedProduct?.main_unit || 'Nos',
        sale_rate: it.matchedProduct?.sale_rate || 0,
        candidates: it.candidates || [],
        confidence: it.confidence || 'Medium'
      }));

      setItems(mapped);
      setParseResult(res);
    } catch (err) {
      setParseError(err.message || 'Failed to parse message');
    } finally {
      setIsParsing(false);
    }
  }

  function handleProductSelect(itemIdx, product) {
    const updated = [...items];
    updated[itemIdx].selectedProduct = product;
    updated[itemIdx].sale_rate = product.sale_rate;
    updated[itemIdx].unit = product.main_unit || updated[itemIdx].unit;
    setItems(updated);
  }

  function handleQtyChange(itemIdx, newQty) {
    const updated = [...items];
    updated[itemIdx].quantity = Math.max(0.01, parseFloat(newQty) || 1);
    setItems(updated);
  }

  function handleRateChange(itemIdx, newRate) {
    const updated = [...items];
    updated[itemIdx].sale_rate = Math.max(0, parseFloat(newRate) || 0);
    setItems(updated);
  }

  function handleUnitChange(itemIdx, newUnit) {
    const updated = [...items];
    updated[itemIdx].unit = newUnit;
    setItems(updated);
  }

  function handleRemoveItem(itemIdx) {
    setItems(items.filter((_, idx) => idx !== itemIdx));
  }

  // Running total calculation (Tax Inclusive)
  const totalAmount = items.reduce((sum, it) => sum + (it.quantity * it.sale_rate), 0);

  // 1. Transfer to Quotation Form
  function handleTransferToQuote() {
    const validItems = items.filter(it => it.selectedProduct);
    if (validItems.length === 0) {
      alert('Please match at least one product before transferring.');
      return;
    }

    const quotationData = {
      customer: {
        name: customerName || 'Customer',
        phone: customerPhone || ''
      },
      customer_name: customerName || 'Customer',
      customer_phone: customerPhone || '',
      items: validItems.map(it => ({
        product_id: it.selectedProduct.id,
        productId: it.selectedProduct.id,
        id: it.selectedProduct.id,
        item_name: it.selectedProduct.item_name,
        itemName: it.selectedProduct.item_name,
        details: `Requested: ${it.originalLine}`,
        hsn_sac: it.selectedProduct.hsn_sac || '',
        unit: it.unit || it.selectedProduct.main_unit || 'Nos',
        main_unit: it.unit || it.selectedProduct.main_unit || 'Nos',
        quantity: it.quantity,
        sale_rate: it.sale_rate,
        catalog_rate: it.selectedProduct.sale_rate || it.sale_rate,
        line_total: Math.round(it.quantity * it.sale_rate * 100) / 100
      }))
    };

    if (transferCallback) {
      transferCallback(quotationData);
    }
    onClose();
  }

  // 2. Directly Save and Create Quotation Now
  async function handleDirectSaveAndCreate() {
    const validItems = items.filter(it => it.selectedProduct);
    if (validItems.length === 0) {
      alert('Please match at least one product before creating a quotation.');
      return;
    }

    const finalName = customerName.trim() || 'WhatsApp Customer';
    const finalPhone = customerPhone.trim() || '9842711223';

    try {
      setIsDirectCreating(true);
      const payload = {
        customer_name: finalName,
        customer_phone: finalPhone,
        customer_email: '',
        customer_address: '',
        items: validItems.map(it => ({
          product_id: it.selectedProduct.id,
          item_name: it.selectedProduct.item_name,
          details: `Requested: ${it.originalLine}`,
          hsn_sac: it.selectedProduct.hsn_sac || '',
          unit: it.unit || it.selectedProduct.main_unit || 'Nos',
          quantity: it.quantity,
          sale_rate: it.sale_rate,
          line_total: Math.round(it.quantity * it.sale_rate * 100) / 100
        })),
        discount_percent: 0,
        gst_rate: 18,
        is_tax_inclusive: true,
        delivery_charges: 0,
        paper_format: 'A4',
        notes: 'Generated via Smart WhatsApp Message Parser'
      };

      const res = await api.createQuotation(payload);
      if (res && res.quotation) {
        setCreatedQuotation(res.quotation);
      } else {
        throw new Error(res.error || 'Failed to save quotation');
      }
    } catch (err) {
      alert('Error creating quotation: ' + (err.message || 'Server error'));
    } finally {
      setIsDirectCreating(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
        <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95">
          
          {/* Header */}
          <div className="bg-[#00545C] text-white px-6 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-[#7DBA00] flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-[#7DBA00]" />
              </div>
              <div>
                <h3 className="font-extrabold text-base leading-tight">
                  Smart WhatsApp Message Automation
                </h3>
                <p className="text-xs text-emerald-200">
                  Parse informal customer messages • Auto-matches 8,000+ catalog products with live rates
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Success Screen if Quote was directly created */}
          {createdQuotation ? (
            <div className="p-8 text-center space-y-5 my-auto">
              <div className="w-16 h-16 bg-emerald-100 text-[#00545C] rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-10 h-10 text-[#7DBA00]" />
              </div>

              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Official Quotation Generated</span>
                <h2 className="text-2xl font-black text-[#00545C] mt-1">
                  {createdQuotation.quotation_number}
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  Billed to <strong className="text-slate-900">{createdQuotation.customer_name}</strong> • Grand Total: <strong className="text-[#00545C] font-mono">₹{Number(createdQuotation.grand_total).toFixed(2)}</strong>
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowPdfModal(true)}
                  className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-[#00545C] hover:bg-[#0A6D77] text-white font-bold text-xs shadow transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-[#7DBA00]" />
                  <span>View & Print Full Page PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowWaModal(true)}
                  className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow transition-all cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Share via WhatsApp</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1">
                
                {/* Input Area */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-[#00545C]" />
                      <span>Customer WhatsApp Message</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setMessage(sampleMessage)}
                      className="text-xs font-bold text-[#00545C] hover:text-[#7DBA00] flex items-center space-x-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Reset Sample</span>
                    </button>
                  </div>

                  <textarea
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Paste customer WhatsApp message here (e.g. Ramesh 9842711223, golden brown 1ltr 5ps, putty powder 40kg)..."
                    className="w-full p-3.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00545C] font-mono text-slate-800"
                  />

                  {parseError && (
                    <div className="mt-2 text-xs text-rose-600 flex items-center space-x-1.5 font-medium">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{parseError}</span>
                    </div>
                  )}

                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={handleParse}
                      disabled={isParsing || !message.trim()}
                      className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-[#00545C] hover:bg-[#0A6D77] text-white text-xs font-bold shadow transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                    >
                      {isParsing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-[#7DBA00]" />
                          <span>Matching Products Across Catalog...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 text-[#7DBA00]" />
                          <span>Intelligently Parse Message</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Parsed Results Section */}
                {items.length > 0 && (
                  <div className="space-y-4 pt-4 border-t border-slate-200">
                    
                    {/* Customer Extracted Info Bar */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                          Customer Name
                        </label>
                        <input
                          type="text"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="e.g. Ramesh"
                          className="w-full px-3 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00545C]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                          Phone Number
                        </label>
                        <input
                          type="text"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          placeholder="+91 98427 11223"
                          className="w-full px-3 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00545C]"
                        />
                      </div>
                    </div>

                    {/* Matched Items Table */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-[#00545C] text-white text-[10px] font-bold uppercase tracking-wider">
                            <th className="py-2.5 px-3">Customer Requirement</th>
                            <th className="py-2.5 px-3">Matched Catalog Product</th>
                            <th className="py-2.5 px-2 text-center w-16">Unit</th>
                            <th className="py-2.5 px-2 text-center w-16">Qty</th>
                            <th className="py-2.5 px-3 text-right w-24">Rate (₹)</th>
                            <th className="py-2.5 px-3 text-right w-28">Total (₹)</th>
                            <th className="py-2.5 px-2 text-center w-8"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {items.map((it, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                              
                              {/* Original Raw Requirement */}
                              <td className="py-2.5 px-3">
                                <span className="font-mono text-xs font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                                  {it.originalLine}
                                </span>
                              </td>

                              {/* Selected Product / Candidates Dropdown */}
                              <td className="py-2.5 px-3">
                                {it.candidates && it.candidates.length > 1 ? (
                                  <div className="relative">
                                    <select
                                      value={it.selectedProduct?.id || ''}
                                      onChange={(e) => {
                                        const found = it.candidates.find(c => c.id === parseInt(e.target.value, 10));
                                        if (found) handleProductSelect(idx, found);
                                      }}
                                      className="w-full text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-lg p-1.5 pr-6 appearance-none focus:outline-none focus:ring-2 focus:ring-[#00545C]"
                                    >
                                      {it.candidates.map(cand => (
                                        <option key={cand.id} value={cand.id}>
                                          {cand.item_name} - ₹{cand.sale_rate} ({cand.section})
                                        </option>
                                      ))}
                                    </select>
                                    <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-2.5 text-slate-400 pointer-events-none" />
                                  </div>
                                ) : (
                                  <span className="font-bold text-slate-900">
                                    {it.selectedProduct ? it.selectedProduct.item_name : <span className="text-rose-500 italic">No match found</span>}
                                  </span>
                                )}
                              </td>

                              {/* Unit */}
                              <td className="py-2.5 px-2 text-center">
                                <input
                                  type="text"
                                  value={it.unit}
                                  onChange={(e) => handleUnitChange(idx, e.target.value)}
                                  className="w-14 text-center font-bold text-xs p-1 border border-slate-300 rounded bg-white"
                                />
                              </td>

                              {/* Qty */}
                              <td className="py-2.5 px-2 text-center">
                                <input
                                  type="number"
                                  min="0.01"
                                  step="any"
                                  value={it.quantity}
                                  onChange={(e) => handleQtyChange(idx, e.target.value)}
                                  className="w-14 text-center font-black text-xs p-1 border border-slate-300 rounded bg-white text-slate-900"
                                />
                              </td>

                              {/* Rate */}
                              <td className="py-2.5 px-3 text-right">
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={it.sale_rate}
                                  onChange={(e) => handleRateChange(idx, e.target.value)}
                                  className="w-20 text-right font-bold text-xs p-1 border border-slate-300 rounded bg-white text-[#00545C] tabular-nums"
                                />
                              </td>

                              {/* Line Total */}
                              <td className="py-2.5 px-3 text-right font-black text-slate-900 tabular-nums">
                                ₹{(it.quantity * it.sale_rate).toFixed(2)}
                              </td>

                              {/* Remove */}
                              <td className="py-2.5 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(idx)}
                                  className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                                  title="Remove Item"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </td>

                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Summary Bar */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-700">Matched {items.length} Product(s)</span>
                        <span className="text-slate-400 ml-2">(Rates include GST as per official rate sheet)</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-600">Total:</span>
                        <span className="text-base font-black text-[#00545C] tabular-nums">
                          ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                  </div>
                )}

              </div>

              {/* Modal Footer Actions */}
              <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>

                <div className="flex items-center space-x-2 sm:space-x-3">
                  {/* Button 1: Transfer to Form Editor */}
                  <button
                    type="button"
                    onClick={handleTransferToQuote}
                    disabled={items.length === 0}
                    className={`flex items-center space-x-1.5 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      items.length > 0
                        ? 'bg-white border-[#00545C] text-[#00545C] hover:bg-slate-100 shadow-2xs'
                        : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <span>Edit in Quotation Form</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>

                  {/* Button 2: Direct 1-Click Quotation Creation */}
                  <button
                    type="button"
                    onClick={handleDirectSaveAndCreate}
                    disabled={items.length === 0 || isDirectCreating}
                    className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-black shadow transition-all active:scale-95 cursor-pointer ${
                      items.length > 0 && !isDirectCreating
                        ? 'bg-[#7DBA00] hover:bg-[#8ee000] text-[#003B40]'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {isDirectCreating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Saving Official Quotation...</span>
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="w-4 h-4" />
                        <span>Save & Create Quote ({items.length})</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}

        </div>
      </div>

      {/* Sub-modals if quote was directly created */}
      {showPdfModal && createdQuotation && (
        <QuotationPdfModal
          quotation={createdQuotation}
          onClose={() => setShowPdfModal(false)}
        />
      )}

      {showWaModal && createdQuotation && (
        <WhatsAppShareModal
          quotation={createdQuotation}
          onClose={() => setShowWaModal(false)}
        />
      )}
    </>
  );
}
