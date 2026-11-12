import React, { useState } from 'react';
import { 
  Sparkles, MessageSquare, ArrowRight, Check, X, AlertCircle,
  Copy, RefreshCw, ChevronDown, ChevronUp, CheckCircle2,
  FileText, Loader2, Search, Plus, Trash2, Tag, Layers
} from 'lucide-react';
import { api } from '../api/client';

export default function SmartParserModal({ onClose, onApplyToQuotation, onTransferToQuotation }) {
  // Start with completely clean, empty message - no pre-filled text!
  const [message, setMessage] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parseResult, setParseResult] = useState(null);
  const [parseError, setParseError] = useState('');

  // Editable customer info extracted from WhatsApp
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  
  // Editable matched items list
  const [items, setItems] = useState([]);

  // Expanded suggestions toggle per item index
  const [expandedRowSuggestions, setExpandedRowSuggestions] = useState({});

  // Size filter tab per item index in suggestions
  const [selectedSizeFilter, setSelectedSizeFilter] = useState({});

  // In-row live catalog search state
  const [rowSearchQueries, setRowSearchQueries] = useState({});
  const [rowSearchResults, setRowSearchResults] = useState({});
  const [isRowSearching, setIsRowSearching] = useState({});

  const transferCallback = onTransferToQuotation || onApplyToQuotation;

  function handleLoadSample() {
    setMessage(`Customer: Ramesh Kumar +91 98427 11223
Asian Paints Apex 20lt - 2 cans
Birla Putty 40kg 5 bags
Brush 2 inch 3 nos
Udhayam Manjal 4lt
Dr Fixit 302 1lt 2
Golden Brown 1lt 5ps
Red Oxide Primer 4lt`);
    setParseError('');
  }

  async function handleParse() {
    if (!message.trim()) {
      setParseError('Please paste customer order text into the message box.');
      return;
    }

    try {
      setIsParsing(true);
      setParseError('');
      const res = await api.parseWhatsAppMessage(message);
      
      setCustomerName(res.customerName || '');
      setCustomerPhone(res.customerPhone || '');
      
      const mapped = (res.items || []).map((it, idx) => ({
        id: idx,
        originalLine: it.originalLine,
        selectedProduct: it.matchedProduct,
        quantity: it.quantity || 1,
        unit: it.unit || it.matchedProduct?.main_unit || 'Nos',
        sale_rate: it.matchedProduct?.sale_rate || 0,
        candidates: it.candidates || [],
        availableSizes: it.availableSizes || it.matchedProduct?.availableSizes || [],
        confidence: it.confidence || 'Medium'
      }));

      // Automatically open suggestions for medium or low confidence items
      const initialExpanded = {};
      mapped.forEach((it, idx) => {
        if (it.confidence !== 'High' || !it.selectedProduct) {
          initialExpanded[idx] = true;
        }
      });
      setExpandedRowSuggestions(initialExpanded);

      setItems(mapped);
      setParseResult(res);
    } catch (err) {
      setParseError(err.message || 'Failed to parse message. Please check the text format.');
    } finally {
      setIsParsing(false);
    }
  }

  function toggleSuggestions(idx) {
    setExpandedRowSuggestions(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  }

  function handleProductSelect(itemIdx, product) {
    setItems(prev => {
      const updated = [...prev];
      const existingSizes = updated[itemIdx].availableSizes || [];
      const newSizes = product.availableSizes && product.availableSizes.length > 0 ? product.availableSizes : existingSizes;

      updated[itemIdx] = {
        ...updated[itemIdx],
        selectedProduct: product,
        sale_rate: product.sale_rate || 0,
        unit: product.main_unit || updated[itemIdx].unit || 'Nos',
        availableSizes: newSizes,
        confidence: 'High'
      };
      return updated;
    });

    // Close the suggestion drawer after selection
    setExpandedRowSuggestions(prev => ({ ...prev, [itemIdx]: false }));
  }

  // 1-Click Pack Size Switcher (e.g. 1LT -> 4LT -> 10LT -> 20LT)
  function handleSwitchPackSize(itemIdx, sizeOption) {
    setItems(prev => {
      const updated = [...prev];
      const current = updated[itemIdx];
      const candMatch = (current.candidates || []).find(c => c.id === sizeOption.id);
      const chosenProduct = candMatch || {
        ...current.selectedProduct,
        id: sizeOption.id,
        item_name: sizeOption.item_name,
        details: sizeOption.details || current.selectedProduct?.details || '',
        sale_rate: sizeOption.sale_rate,
        main_unit: sizeOption.main_unit || current.unit || 'Nos',
        hsn_sac: sizeOption.hsn_sac || current.selectedProduct?.hsn_sac || '',
        availableSizes: current.availableSizes
      };

      updated[itemIdx] = {
        ...current,
        selectedProduct: chosenProduct,
        sale_rate: sizeOption.sale_rate,
        unit: sizeOption.main_unit || current.unit || 'Nos',
        confidence: 'High'
      };
      return updated;
    });
  }

  async function handleRowLiveSearch(itemIdx, query) {
    setRowSearchQueries(prev => ({ ...prev, [itemIdx]: query }));
    if (!query.trim()) {
      setRowSearchResults(prev => ({ ...prev, [itemIdx]: [] }));
      return;
    }

    try {
      setIsRowSearching(prev => ({ ...prev, [itemIdx]: true }));
      const res = await api.getProducts({ search: query.trim(), limit: 16, all: 'true' });
      setRowSearchResults(prev => ({ ...prev, [itemIdx]: res.products || [] }));
    } catch (err) {
      console.warn('Row search error:', err);
    } finally {
      setIsRowSearching(prev => ({ ...prev, [itemIdx]: false }));
    }
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
        name: customerName || '',
        phone: customerPhone || ''
      },
      customer_name: customerName || '',
      customer_phone: customerPhone || '',
      items: validItems.map(it => ({
        product_id: it.selectedProduct.id,
        productId: it.selectedProduct.id,
        id: it.selectedProduct.id,
        item_name: it.selectedProduct.item_name,
        itemName: it.selectedProduct.item_name,
        details: it.selectedProduct.details || it.selectedProduct.structuredDetails?.summary || '',
        customer_req: it.originalLine || '',
        hsn_sac: it.selectedProduct.hsn_sac || '',
        unit: it.unit || it.selectedProduct.main_unit || 'Nos',
        main_unit: it.unit || it.selectedProduct.main_unit || 'Nos',
        quantity: it.quantity,
        sale_rate: it.sale_rate,
        catalog_rate: it.selectedProduct.sale_rate || it.sale_rate,
        availableSizes: it.availableSizes || [],
        line_total: Math.round(it.quantity * it.sale_rate * 100) / 100
      }))
    };

    if (transferCallback) {
      transferCallback(quotationData);
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="bg-[#00545C] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 text-white flex items-center justify-center border border-white/20">
              <Sparkles className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h3 className="font-extrabold text-base leading-tight">
                WhatsApp Order Parser & Catalog Matcher
              </h3>
              <p className="text-xs text-slate-200">
                Real-time multi-candidate matching across all 5,300+ inventory items with live feedback & replacement
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
                
                {/* Input Area */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-[#00545C]" />
                      <span>Customer WhatsApp Order Message</span>
                    </label>
                    <div className="flex items-center space-x-3 text-xs">
                      {message && (
                        <button
                          type="button"
                          onClick={() => setMessage('')}
                          className="text-rose-600 hover:underline font-medium cursor-pointer"
                        >
                          Clear Text
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleLoadSample}
                        className="text-[#00545C] hover:underline font-bold flex items-center space-x-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Load Sample Demo Order</span>
                      </button>
                    </div>
                  </div>

                  <textarea
                    rows={4}
                    value={message}
                    onChange={(e) => { setMessage(e.target.value); setParseError(''); }}
                    placeholder="Paste customer WhatsApp message here (e.g. Ramesh 9842711223, Apex 20lt 2 cans, Putty 40kg 5 bags, Brush 2 inch 3 nos)..."
                    className="w-full p-3.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00545C]/20 focus:border-[#00545C] font-mono text-slate-800"
                  />

                  {parseError && (
                    <div className="mt-2 text-xs text-rose-600 flex items-center space-x-1.5 font-medium">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{parseError}</span>
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">
                      Supports brand abbreviations, mixed pack sizes, Tamil/English quantities, and lists.
                    </span>

                    <button
                      type="button"
                      onClick={handleParse}
                      disabled={isParsing || !message.trim()}
                      className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-[#00545C] hover:bg-[#003B40] text-white text-xs font-bold shadow-sm transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                    >
                      {isParsing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Matching 5,300+ Products...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>Process & Match Products</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Parsed Results Section with Suggestion & Feedback Mechanism */}
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
                          className="w-full px-3 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00545C]/20 focus:border-[#00545C]"
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
                          className="w-full px-3 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00545C]/20 focus:border-[#00545C]"
                        />
                      </div>
                    </div>

                    {/* Matched Items Cards with Rich Feedback Options */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs text-slate-600 font-bold px-1">
                        <span>Extracted Order Items ({items.length})</span>
                        <span>Click Suggestions to swap or search any catalog item</span>
                      </div>

                      {items.map((it, idx) => {
                        const isExpanded = !!expandedRowSuggestions[idx];
                        const candidates = it.candidates || [];
                        const specs = it.selectedProduct?.structuredDetails;
                        const rowResults = rowSearchResults[idx] || [];

                        return (
                          <div 
                            key={idx} 
                            className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3 transition-all hover:border-slate-300"
                          >
                            {/* Line Item Header: Customer Original Line + Confidence */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                              <div className="flex items-center space-x-2">
                                <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-mono text-[10px] font-bold flex items-center justify-center">
                                  {idx + 1}
                                </span>
                                <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                                  💬 "{it.originalLine}"
                                </span>
                              </div>

                              <div className="flex items-center space-x-2">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  it.confidence === 'High'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : it.confidence === 'Medium'
                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                    : 'bg-rose-50 text-rose-800 border-rose-200'
                                }`}>
                                  {it.confidence === 'High' ? '✓ High Match' : it.confidence === 'Medium' ? '⚠️ Medium Match' : '🔍 Review Required'}
                                </span>

                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(idx)}
                                  className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer transition-colors"
                                  title="Remove this item"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Main Selected Product Display */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                {it.selectedProduct ? (
                                  <>
                                    <h4 className="font-extrabold text-sm text-slate-900 leading-snug">
                                      {it.selectedProduct.item_name}
                                    </h4>

                                    {/* Structured specs badges */}
                                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                      {specs?.brand && (
                                        <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                          🏷️ {specs.brand}
                                        </span>
                                      )}
                                      {specs?.packSize && (
                                        <span className="text-[10px] font-black text-[#00545C] bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                                          📦 {specs.packSize}
                                        </span>
                                      )}
                                      {specs?.category && (
                                        <span className="text-[10px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                          {specs.category}
                                        </span>
                                      )}
                                      {specs?.colour && (
                                        <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                                          🎨 {specs.colour}
                                        </span>
                                      )}
                                      {it.selectedProduct.details && (
                                        <span className="text-[10px] text-slate-500 italic">
                                          ({it.selectedProduct.details})
                                        </span>
                                      )}
                                    </div>

                                    {/* 1-Click Pack Size Switcher Pills */}
                                    {it.availableSizes && it.availableSizes.length > 0 && (
                                      <div className="mt-2.5 pt-2 border-t border-slate-100">
                                        <div className="flex items-center space-x-1.5 mb-1.5">
                                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                            Pack Sizes ({it.availableSizes.length} Available):
                                          </span>
                                          <span className="text-[10px] text-[#00545C] font-semibold">
                                            Click to switch size
                                          </span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-1.5">
                                          {it.availableSizes.map(sz => {
                                            const isSelected = sz.id === it.selectedProduct?.id || sz.item_name === it.selectedProduct?.item_name || sz.packSize === specs?.packSize;
                                            return (
                                              <button
                                                key={sz.id}
                                                type="button"
                                                onClick={() => handleSwitchPackSize(idx, sz)}
                                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                                                  isSelected
                                                    ? 'bg-[#00545C] text-white shadow-sm ring-2 ring-[#00545C]/30 scale-[1.02]'
                                                    : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 hover:border-[#00545C]'
                                                }`}
                                                title={`Switch to ${sz.item_name} (₹${sz.sale_rate})`}
                                              >
                                                <span className="font-extrabold">{sz.packSize}</span>
                                                <span className={`text-[11px] font-mono ${isSelected ? 'text-emerald-200' : 'text-slate-500'}`}>
                                                  ₹{sz.sale_rate}
                                                </span>
                                                {isSelected && <Check className="w-3 h-3 text-emerald-300" />}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 font-bold">
                                    No exact match found. Please choose from alternative suggestions or search below.
                                  </div>
                                )}
                              </div>

                              {/* Quantity, Unit, Rate, Total Controls */}
                              <div className="flex items-center space-x-3 flex-shrink-0 self-end sm:self-center">
                                {/* Unit */}
                                <div className="text-center">
                                  <span className="text-[9px] text-slate-400 block font-bold">UNIT</span>
                                  <input
                                    type="text"
                                    value={it.unit}
                                    onChange={(e) => handleUnitChange(idx, e.target.value)}
                                    className="w-16 text-center font-bold text-xs p-1 border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#00545C]"
                                  />
                                </div>

                                {/* Qty Stepper */}
                                <div className="text-center">
                                  <span className="text-[9px] text-slate-400 block font-bold">QTY</span>
                                  <div className="inline-flex items-center space-x-1 bg-white border border-slate-300 rounded-lg p-0.5">
                                    <button
                                      type="button"
                                      onClick={() => handleQtyChange(idx, Math.max(1, it.quantity - 1))}
                                      className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs flex items-center justify-center cursor-pointer"
                                    >
                                      −
                                    </button>
                                    <input
                                      type="number"
                                      min="0.01"
                                      step="any"
                                      value={it.quantity}
                                      onChange={(e) => handleQtyChange(idx, e.target.value)}
                                      className="w-10 text-center font-mono font-black text-xs bg-transparent text-slate-900 focus:outline-none"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleQtyChange(idx, it.quantity + 1)}
                                      className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs flex items-center justify-center cursor-pointer"
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>

                                {/* Rate */}
                                <div className="text-right">
                                  <span className="text-[9px] text-slate-400 block font-bold">RATE (₹)</span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={it.sale_rate}
                                    onChange={(e) => handleRateChange(idx, e.target.value)}
                                    className="w-20 text-right font-mono font-bold text-xs p-1 border border-slate-300 rounded-lg bg-white text-[#00545C] focus:outline-none focus:ring-1 focus:ring-[#00545C]"
                                  />
                                </div>

                                {/* Total */}
                                <div className="text-right min-w-[70px]">
                                  <span className="text-[9px] text-slate-400 block font-bold">TOTAL</span>
                                  <div className="font-mono font-black text-sm text-slate-900">
                                    ₹{(it.quantity * it.sale_rate).toFixed(2)}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Suggestion & Feedback Accordion Toggle Button */}
                            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                              <button
                                type="button"
                                onClick={() => toggleSuggestions(idx)}
                                className="text-xs font-bold text-[#00545C] hover:text-[#003B40] flex items-center space-x-1 cursor-pointer bg-slate-50 hover:bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 transition-colors"
                              >
                                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                <span>
                                  {isExpanded ? 'Hide Alternatives' : `Alternative Suggestions (${Math.max(0, candidates.length - 1)}) & Catalog Search`}
                                </span>
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5 ml-1" /> : <ChevronDown className="w-3.5 h-3.5 ml-1" />}
                              </button>

                              <span className="text-[10px] text-slate-400">
                                Official Rate includes GST
                              </span>
                            </div>

                            {/* EXPANDED SUGGESTIONS & INLINE CATALOG REPLACEMENT DRAWER */}
                            {isExpanded && (() => {
                              const sizeFilter = selectedSizeFilter[idx] || 'ALL';
                              
                              // Extract distinct pack sizes from candidates and available sizes
                              const candidateSizes = ['ALL', ...Array.from(new Set([
                                ...(it.availableSizes || []).map(s => s.packSize),
                                ...candidates.map(c => c.packSize || c.item_name.match(/(\d+(?:\.\d+)?\s*(?:LT|L|ML|KG|GM|NOS|INCH|MM|FT))\b/i)?.[1]?.toUpperCase())
                              ].filter(Boolean)))];

                              const filteredCandidates = sizeFilter === 'ALL'
                                ? candidates
                                : candidates.filter(c => {
                                    const cSize = (c.packSize || c.item_name.match(/(\d+(?:\.\d+)?\s*(?:LT|L|ML|KG|GM|NOS|INCH|MM|FT))\b/i)?.[1]?.toUpperCase());
                                    return cSize === sizeFilter || c.item_name.toUpperCase().includes(sizeFilter);
                                  });

                              return (
                                <div className="bg-slate-50/90 p-3.5 rounded-xl border border-slate-200 space-y-3 mt-2 animate-in fade-in duration-200">
                                  
                                  {/* 1. Alternative Candidates from AI Matcher */}
                                  {candidates.length > 0 && (
                                    <div>
                                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                        <div className="flex items-center space-x-1.5">
                                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                          <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
                                            Matching Products & Pack Sizes ({candidates.length})
                                          </span>
                                        </div>

                                        {/* Pack Size Filter Tabs */}
                                        {candidateSizes.length > 2 && (
                                          <div className="flex flex-wrap items-center gap-1">
                                            {candidateSizes.map(sz => (
                                              <button
                                                key={sz}
                                                type="button"
                                                onClick={() => setSelectedSizeFilter(prev => ({ ...prev, [idx]: sz }))}
                                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer transition-colors ${
                                                  sizeFilter === sz
                                                    ? 'bg-[#00545C] text-white shadow-2xs'
                                                    : 'bg-white hover:bg-slate-200 text-slate-600 border border-slate-200'
                                                }`}
                                              >
                                                {sz === 'ALL' ? `All (${candidates.length})` : sz}
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                      </div>

                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                                        {filteredCandidates.map(cand => {
                                          const isCurrent = it.selectedProduct?.id === cand.id || it.selectedProduct?.item_name === cand.item_name;
                                          const candSize = cand.packSize || cand.item_name.match(/(\d+(?:\.\d+)?\s*(?:LT|L|ML|KG|GM|NOS|INCH|MM|FT))\b/i)?.[1]?.toUpperCase();

                                          return (
                                            <div
                                              key={cand.id}
                                              onClick={() => handleProductSelect(idx, cand)}
                                              className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between gap-2 ${
                                                isCurrent 
                                                  ? 'bg-teal-50/90 border-[#00545C] text-[#00545C] font-bold shadow-xs ring-1 ring-[#00545C]' 
                                                  : 'bg-white border-slate-200 hover:border-[#00545C] hover:bg-slate-50 text-slate-800'
                                              }`}
                                            >
                                              <div className="min-w-0 flex-1">
                                                <div className="flex items-center space-x-1.5 flex-wrap">
                                                  <p className="truncate font-bold text-slate-900">{cand.item_name}</p>
                                                  {candSize && (
                                                    <span className="px-1.5 py-0.5 rounded bg-teal-100 text-[#00545C] font-black text-[9px] flex-shrink-0">
                                                      {candSize}
                                                    </span>
                                                  )}
                                                </div>
                                                {cand.details && (
                                                  <p className="text-[10px] text-slate-500 truncate mt-0.5">{cand.details}</p>
                                                )}
                                              </div>
                                              <div className="text-right flex-shrink-0">
                                                <div className="font-mono font-bold text-xs text-[#00545C]">₹{cand.sale_rate}</div>
                                                {isCurrent ? (
                                                  <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">✓ Selected</span>
                                                ) : (
                                                  <span className="text-[9px] text-[#00545C] font-semibold hover:underline">Use this</span>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}

                                {/* 2. Live In-Row Search: If item missed in suggestions, search entire 5,300+ catalog */}
                                <div className="pt-2 border-t border-slate-200">
                                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                    Search & Replace from Full 5,300+ Catalog:
                                  </span>
                                  <div className="relative">
                                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                                    <input
                                      type="text"
                                      value={rowSearchQueries[idx] || ''}
                                      onChange={(e) => handleRowLiveSearch(idx, e.target.value)}
                                      placeholder="Type product name, brand, or code to replace... (e.g. Apex 20lt, Putty, Brush)"
                                      className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#00545C]"
                                    />
                                    {isRowSearching[idx] && (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin absolute right-2.5 top-2.5 text-[#00545C]" />
                                    )}
                                  </div>

                                  {/* Row Search Results Dropdown */}
                                  {rowResults.length > 0 && (
                                    <div className="mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto divide-y divide-slate-100">
                                      {rowResults.map(p => (
                                        <div
                                          key={p.id}
                                          onClick={() => {
                                            handleProductSelect(idx, p);
                                            setRowSearchQueries(prev => ({ ...prev, [idx]: '' }));
                                            setRowSearchResults(prev => ({ ...prev, [idx]: [] }));
                                          }}
                                          className="p-2 text-xs hover:bg-slate-50 cursor-pointer flex items-center justify-between"
                                        >
                                          <div className="min-w-0 flex-1">
                                            <p className="font-bold text-slate-900 truncate">{p.item_name}</p>
                                            <p className="text-[10px] text-slate-500">{p.details || p.section}</p>
                                          </div>
                                          <div className="font-mono font-bold text-xs text-[#00545C] ml-2">
                                            ₹{p.sale_rate}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })()}

                          </div>
                        );
                      })}
                    </div>

                    {/* Summary Bar */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-800">Total {items.length} item(s) ready for quotation</span>
                        <span className="text-slate-400 ml-2 hidden sm:inline">• Official Udhayam catalog rates applied</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-600">Subtotal:</span>
                        <span className="text-base font-black font-mono text-[#00545C]">
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

          <button
            type="button"
            onClick={handleTransferToQuote}
            disabled={items.length === 0}
            className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl text-xs font-black shadow-md transition-all active:scale-95 cursor-pointer ${
              items.length > 0
                ? 'bg-[#00545C] hover:bg-[#003B40] text-white shadow-[#00545C]/20'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <span>Transfer to Quotation Form (Review & Confirm)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
}
