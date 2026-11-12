import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, Upload, Download, Printer, Search, 
  Layers, CheckCircle2, AlertTriangle, FileText, RefreshCw,
  Clock, Shield, ArrowRight, Eye, Sparkles, Plus, X, Check
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import ThemedConfirmDialog from '../components/ThemedConfirmDialog';

export default function PriceListAndCatalogue({ onAddToQuote }) {
  const { isAdmin } = useAuth();

  // Active Tab: 'catalogue' | 'pdf' | 'excel-import'
  const [activeTab, setActiveTab] = useState('catalogue');

  // Catalogue State
  const [section, setSection] = useState('PAINTS'); // 'PAINTS' | 'ACCESS'
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState('50');
  const [totalFound, setTotalFound] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [counts, setCounts] = useState({ total: 0, paints: 0, access: 0 });
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Manual Item Creation Modal State (User Request: "also need Item creation in the Pricelist section")
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProduct, setNewProduct] = useState({
    section: 'PAINTS',
    item_name: '',
    details: '',
    sale_rate: '',
    main_unit: 'Nos',
    hsn_sac: '',
    dpl: '',
    purc_rate: '',
    cost: ''
  });
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [createProductError, setCreateProductError] = useState('');
  const [createProductSuccess, setCreateProductSuccess] = useState('');

  // Price List PDF Options
  const [pdfSection, setPdfSection] = useState('combined'); // 'paints' | 'access' | 'combined'
  const [pdfFormat, setPdfFormat] = useState('A4'); // 'A4' | 'A5'
  const [previewProducts, setPreviewProducts] = useState([]);
  const [loadingPdfPreview, setLoadingPdfPreview] = useState(false);

  // Excel Import State
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState('');
  const [importHistory, setImportHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Themed Confirm Dialog & Bottom Toast State
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    type: 'confirm',
    onConfirm: null
  });
  const [toastMsg, setToastMsg] = useState(null);

  function showToast(text, isError = false) {
    setToastMsg({ text, isError });
    setTimeout(() => setToastMsg(null), 4000);
  }

  // Load product counts on mount
  useEffect(() => {
    loadCounts();
    if (activeTab === 'excel-import') {
      loadHistory();
    }
  }, [activeTab]);

  // Load catalogue products
  useEffect(() => {
    if (activeTab === 'catalogue') {
      loadProducts();
    }
  }, [section, search, page, pageSize, activeTab]);

  // Load preview for PDF tab
  useEffect(() => {
    if (activeTab === 'pdf') {
      loadPdfPreview();
    }
  }, [pdfSection, activeTab]);

  async function loadCounts() {
    try {
      const res = await api.getProductCounts();
      setCounts(res);
    } catch (e) {}
  }

  async function loadProducts() {
    try {
      setLoadingProducts(true);
      const isAll = pageSize === 'all';
      const res = await api.getProducts({
        section,
        search: search.trim(),
        page: isAll ? 1 : page,
        limit: isAll ? 'all' : pageSize,
        all: isAll ? 'true' : 'false'
      });
      setProducts(res.products || []);
      setTotalPages(res.totalPages || 1);
      setTotalFound(res.total || 0);
    } catch (e) {
      console.warn('Failed to load products:', e);
    } finally {
      setLoadingProducts(false);
    }
  }

  async function loadPdfPreview() {
    try {
      setLoadingPdfPreview(true);
      const secParam = pdfSection === 'paints' ? 'PAINTS' : pdfSection === 'access' ? 'ACCESS' : undefined;
      const res = await api.getProducts({
        section: secParam,
        limit: 50
      });
      setPreviewProducts(res.products || []);
    } catch (e) {
      console.warn('Failed to load PDF preview:', e);
    } finally {
      setLoadingPdfPreview(false);
    }
  }

  async function loadHistory() {
    try {
      setLoadingHistory(true);
      const res = await api.getImportHistory();
      setImportHistory(res.history || []);
    } catch (e) {}
    finally {
      setLoadingHistory(false);
    }
  }

  // Handle Manual Product Creation
  async function handleCreateProductSubmit(e) {
    e.preventDefault();
    if (!newProduct.item_name.trim()) {
      setCreateProductError('Product Item Name is required.');
      return;
    }
    if (!newProduct.sale_rate || isNaN(newProduct.sale_rate)) {
      setCreateProductError('Valid Sale Rate (₹) is required.');
      return;
    }

    try {
      setIsCreatingProduct(true);
      setCreateProductError('');
      const res = await api.createProduct({
        ...newProduct,
        sale_rate: parseFloat(newProduct.sale_rate),
        dpl: newProduct.dpl ? parseFloat(newProduct.dpl) : null,
        purc_rate: newProduct.purc_rate ? parseFloat(newProduct.purc_rate) : null
      });

      if (res.success) {
        setCreateProductSuccess(`Product "${res.product.item_name}" added successfully with S.No #${res.product.s_no}!`);
        // Reset form
        setNewProduct({
          section: newProduct.section,
          item_name: '',
          details: '',
          sale_rate: '',
          main_unit: 'Nos',
          hsn_sac: '',
          dpl: '',
          purc_rate: '',
          cost: ''
        });
        loadCounts();
        loadProducts();
        setTimeout(() => {
          setCreateProductSuccess('');
          setShowAddModal(false);
        }, 1500);
      }
    } catch (err) {
      setCreateProductError(err.message || 'Failed to create product');
    } finally {
      setIsCreatingProduct(false);
    }
  }

  // Excel Upload Handlers
  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreviewData(null);
      setImportResult(null);
      setImportError('');
    }
  }

  async function handleParsePreview() {
    if (!selectedFile) return;
    try {
      setIsParsing(true);
      setImportError('');
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await api.previewRateSheet(formData);
      setPreviewData(res);
    } catch (err) {
      setImportError(err.message || 'Failed to parse Excel workbook');
    } finally {
      setIsParsing(false);
    }
  }

  async function handleConfirmImport() {
    if (!previewData?.previewId) return;
    try {
      setIsCommitting(true);
      setImportError('');
      const res = await api.commitImport(previewData.previewId);
      setImportResult(res);
      setPreviewData(null);
      setSelectedFile(null);
      loadCounts();
      loadHistory();
    } catch (err) {
      setImportError(err.message || 'Failed to commit import');
    } finally {
      setIsCommitting(false);
    }
  }

  function handleSeedOfficial() {
    setConfirmDialog({
      isOpen: true,
      title: 'Import Official Rate Sheet',
      message: 'This will load all 5,300+ authentic products directly from the official Udhayam Agencies rate sheet "4. RATES [04.11.2026].xlsx".\n\nExisting products will be synchronized with live master rates.',
      confirmText: 'Import Official Rates',
      cancelText: 'Cancel',
      type: 'confirm',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        try {
          setIsCommitting(true);
          const res = await api.seedOfficialRates();
          setImportResult(res);
          loadCounts();
          loadHistory();
          loadProducts();
          showToast(`✓ Successfully synchronized ${res.rows_imported || 5331} authentic products!`);
        } catch (err) {
          showToast('Error seeding official rates: ' + err.message, true);
        } finally {
          setIsCommitting(false);
        }
      }
    });
  }

  function handleDirectPrint() {
    const url = `/api/price-list/pdf?section=${pdfSection}&format=${pdfFormat}`;
    const win = window.open(url, '_blank');
    if (win) win.focus();
  }

  return (
    <div className="space-y-6">
      
      {/* Top Section Header with Combined Tabs */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl sm:text-2xl font-black text-[#00545C]">
                Price List & Product Management
              </h2>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                GST Inclusive
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Browse catalogue, generate A4/A5 customer price list PDFs, create items, and manage rate sheets
            </p>
          </div>

          {/* Tab Switcher Buttons */}
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('catalogue')}
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'catalogue'
                  ? 'bg-[#00545C] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Browse Catalogue</span>
            </button>

            <button
              onClick={() => setActiveTab('pdf')}
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'pdf'
                  ? 'bg-[#00545C] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Price List PDF</span>
            </button>

            <button
              onClick={() => setActiveTab('excel-import')}
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'excel-import'
                  ? 'bg-[#00545C] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Excel Rate Sheet</span>
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: BROWSE CATALOGUE */}
      {activeTab === 'catalogue' && (
        <div className="space-y-4 animate-in fade-in">
          
          {/* Section Filter & Search Bar + Add Product Button */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            {/* PAINTS vs ACCESS Switcher */}
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => { setSection('PAINTS'); setPage(1); }}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                  section === 'PAINTS'
                    ? 'bg-[#00545C] text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                PAINTS SECTION ({counts.paints.toLocaleString()})
              </button>
              <button
                type="button"
                onClick={() => { setSection('ACCESS'); setPage(1); }}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                  section === 'ACCESS'
                    ? 'bg-[#00545C] text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ACCESSORIES SECTION ({counts.access.toLocaleString()})
              </button>
            </div>

            {/* Live Search, Page Size & Add New Product Action */}
            <div className="flex flex-wrap items-center gap-2 flex-1 max-w-2xl">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Search products by Item Name, specs, color, brand..."
                  className="w-full pl-9 pr-8 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00545C]"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => { setSearch(''); setPage(1); }}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Page Size Selector */}
              <div className="flex items-center space-x-1.5 bg-slate-100 px-2 py-1.5 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase">View:</span>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(e.target.value); setPage(1); }}
                  className="text-xs bg-transparent font-black text-[#00545C] focus:outline-none cursor-pointer"
                >
                  <option value="50">50 / pg</option>
                  <option value="100">100 / pg</option>
                  <option value="200">200 / pg</option>
                  <option value="all">Show All</option>
                </select>
              </div>

              {/* Add New Product Button */}
              <button
                type="button"
                onClick={() => {
                  setNewProduct(prev => ({ ...prev, section }));
                  setShowAddModal(true);
                }}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-[#7DBA00] hover:bg-[#8ee000] text-[#003B40] font-black text-xs shadow transition-all active:scale-95 whitespace-nowrap cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add Product</span>
              </button>
            </div>
          </div>

          {/* Product Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#00545C] text-white text-[11px] font-bold uppercase tracking-wider">
                    <th className="py-3 px-3 text-center w-12">S.No</th>
                    <th className="py-3 px-4">Item Name</th>
                    <th className="py-3 px-3">Details / Specs</th>
                    <th className="py-3 px-3 text-center w-24">HSN/SAC</th>
                    <th className="py-3 px-3 text-center w-20">Unit</th>
                    <th className="py-3 px-4 text-right w-32">Sale Rate (₹ Incl. GST)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingProducts ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">
                        Loading products...
                      </td>
                    </tr>
                  ) : products.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">
                        No products found matching "{search}".
                      </td>
                    </tr>
                  ) : (
                    products.map((p, idx) => (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                          {p.s_no || idx + 1}
                        </td>
                        <td className="py-2.5 px-4 font-bold text-slate-900">
                          {p.item_name}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                          {p.details || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                          {p.hsn_sac || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-600">
                          {p.main_unit || 'Nos'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-black text-[#00545C]">
                          ₹{Number(p.sale_rate).toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination & Count Controls */}
            <div className="p-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 bg-slate-50/60">
              <span className="font-semibold">
                Showing <strong className="text-[#00545C]">{products.length}</strong> of{' '}
                <strong className="text-slate-900">{totalFound.toLocaleString()}</strong> products
                {search && ` matching "${search}"`}
              </span>

              {totalPages > 1 && pageSize !== 'all' && (
                <div className="flex items-center space-x-2">
                  <span className="text-slate-500 font-medium">Page {page} of {totalPages}</span>
                  <div className="flex space-x-1">
                    <button
                      disabled={page <= 1}
                      onClick={() => setPage(page - 1)}
                      className="px-3 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 font-bold cursor-pointer"
                    >
                      Previous
                    </button>
                    <button
                      disabled={page >= totalPages}
                      onClick={() => setPage(page + 1)}
                      className="px-3 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 font-bold cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: PRICE LIST PDF GENERATOR */}
      {activeTab === 'pdf' && (
        <div className="space-y-6 animate-in fade-in">
          
          {/* Options & Action Bar */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
            
            {/* Section Filter */}
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-700">Section:</span>
              <div className="flex bg-slate-100 p-0.5 rounded-xl">
                {[
                  { id: 'paints', label: 'PAINTS' },
                  { id: 'access', label: 'ACCESSORIES' },
                  { id: 'combined', label: 'COMBINED (ALL)' }
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setPdfSection(opt.id)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      pdfSection === opt.id
                        ? 'bg-[#00545C] text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Layout Format: A4 vs A5 */}
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-700">Layout:</span>
              <div className="flex bg-slate-100 p-0.5 rounded-xl">
                <button
                  onClick={() => setPdfFormat('A4')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    pdfFormat === 'A4'
                      ? 'bg-[#00545C] text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  A4 Full Page
                </button>
                <button
                  onClick={() => setPdfFormat('A5')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    pdfFormat === 'A5'
                      ? 'bg-[#00545C] text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  A5 Compact
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-2">
              <button
                onClick={handleDirectPrint}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold text-xs transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4 text-slate-600" />
                <span>Print Directly</span>
              </button>

              <a
                href={`/api/price-list/pdf?section=${pdfSection}&format=${pdfFormat}&download=true`}
                download
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-[#7DBA00] hover:bg-[#8ee000] text-[#003B40] font-black text-xs shadow transition-all active:scale-95 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download PDF ({pdfFormat})</span>
              </a>
            </div>

          </div>

          {/* Exact Columns Notice */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 flex items-center justify-between">
            <div>
              <span className="font-bold">Official Price List Format:</span> Generated directly from loaded rate sheets. Required 7 columns in exact order: 
              <span className="font-mono ml-1 font-bold">1. S. No. | 2. Item Name | 3. Details | 4. Sales Rate | 5. Qty (Blank) | 6. Unit | 7. HSN</span>
            </div>
            <span className="text-[10px] bg-emerald-200/60 font-bold px-2 py-0.5 rounded text-emerald-900">
              Rates Include GST
            </span>
          </div>

          {/* Table Preview matching exact columns */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700">
                Document Preview ({pdfSection.toUpperCase()} • {pdfFormat})
              </h4>
              <span className="text-[11px] text-slate-400">Showing first 50 sample items</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#00545C] text-white text-[11px] font-bold uppercase tracking-wider">
                    <th className="py-2.5 px-3 text-center w-12">1. S. No.</th>
                    <th className="py-2.5 px-4">2. Item Name</th>
                    <th className="py-2.5 px-3 w-28">3. Details</th>
                    <th className="py-2.5 px-3 text-right w-24">4. Sales Rate</th>
                    <th className="py-2.5 px-3 text-center w-24 bg-[#003B40]">5. Qty (Write-in)</th>
                    <th className="py-2.5 px-3 text-center w-20">6. Unit</th>
                    <th className="py-2.5 px-3 text-center w-24">7. HSN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {previewProducts.map((p, idx) => (
                    <tr key={p.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      <td className="py-2 px-3 text-center font-mono text-slate-500">{p.s_no || idx + 1}</td>
                      <td className="py-2 px-4 font-bold text-slate-900">{p.item_name}</td>
                      <td className="py-2 px-3 text-slate-400">{p.details || '-'}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                        {Number(p.sale_rate).toFixed(2)}
                      </td>
                      {/* Blank entry box for handwritten quantities */}
                      <td className="py-1 px-3 text-center">
                        <div className="h-5 border border-dashed border-slate-300 rounded bg-slate-50/80"></div>
                      </td>
                      <td className="py-2 px-3 text-center text-slate-600">{p.main_unit || 'Nos'}</td>
                      <td className="py-2 px-3 text-center font-mono text-slate-600">{p.hsn_sac || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* TAB 3: EXCEL RATE SHEET & IMPORT */}
      {activeTab === 'excel-import' && (
        <div className="space-y-6 animate-in fade-in">
          
          {/* Upload Card */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Import Official Excel Rate Sheet</h3>
              <p className="text-xs text-slate-500">
                Supports <span className="font-mono font-bold">.xlsx</span>, <span className="font-mono font-bold">.xls</span>, and <span className="font-mono font-bold">.csv</span> with PAINTS and ACCESS worksheets
              </p>
            </div>

            {/* Drag & Drop / File Input */}
            <div className="border-2 border-dashed border-slate-300 hover:border-[#00545C] rounded-2xl p-6 sm:p-8 text-center bg-slate-50/50 transition-colors">
              <input
                type="file"
                id="rate-sheet-input"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <label htmlFor="rate-sheet-input" className="cursor-pointer space-y-2 block">
                <FileSpreadsheet className="w-12 h-12 text-[#00545C] mx-auto" />
                <div className="text-sm font-bold text-slate-800">
                  {selectedFile ? (
                    <span className="text-[#00545C] font-mono">{selectedFile.name}</span>
                  ) : (
                    <span>Click to browse or drop rate sheet file here</span>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  e.g. <span className="font-mono">4. RATES [04.11.2026].xlsx</span> (Max 25MB)
                </p>
              </label>

              {/* Action Buttons */}
              {selectedFile && (
                <div className="mt-4 flex items-center justify-center space-x-2">
                  <button
                    onClick={handleParsePreview}
                    disabled={isParsing}
                    className="flex items-center space-x-1.5 px-5 py-2.5 rounded-xl bg-[#00545C] hover:bg-[#0A6D77] text-white font-extrabold text-xs shadow transition-all active:scale-95 cursor-pointer"
                  >
                    {isParsing ? <span>Analyzing workbook...</span> : <span>Parse & Validate File</span>}
                  </button>
                  <button
                    onClick={() => { setSelectedFile(null); setPreviewData(null); }}
                    className="px-3 py-2 text-xs text-slate-500 hover:text-slate-800 font-bold cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            {/* Quick Seed Button for demo / testing */}
            <div className="pt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100">
              <span>Need to re-load official 5,300+ items?</span>
              <button
                type="button"
                onClick={handleSeedOfficial}
                disabled={isCommitting}
                className="font-bold text-[#00545C] hover:underline flex items-center space-x-1 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#7DBA00]" />
                <span>Load Official 4. RATES [04.11.2026].xlsx</span>
              </button>
            </div>
          </div>

          {/* Import Error Notice */}
          {importError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{importError}</span>
            </div>
          )}

          {/* Import Success Result */}
          {importResult && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-5 rounded-2xl text-xs space-y-2">
              <div className="flex items-center space-x-2 font-bold text-sm text-emerald-800">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Rate Sheet Imported Successfully!</span>
              </div>
              <p>
                Processed <span className="font-bold">{importResult.totalProcessed || importResult.rows_imported}</span> records from <span className="font-mono font-bold">{importResult.filename}</span>.
              </p>
              {importResult.sectionSummary && (
                <div className="flex space-x-4 pt-1 font-semibold text-[11px]">
                  <span>PAINTS: {importResult.sectionSummary.PAINTS || 0}</span>
                  <span>ACCESSORIES: {importResult.sectionSummary.ACCESS || 0}</span>
                </div>
              )}
            </div>
          )}

          {/* Validation & Preview Card */}
          {previewData && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900">Workbook Analysis & Preview</h4>
                  <p className="text-xs text-slate-500">File: {previewData.filename}</p>
                </div>

                <div className="flex space-x-2">
                  <button
                    onClick={() => setPreviewData(null)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmImport}
                    disabled={isCommitting}
                    className="flex items-center space-x-1.5 px-5 py-2 rounded-xl bg-[#7DBA00] hover:bg-[#8ee000] text-[#003B40] font-black text-xs shadow transition-all active:scale-95 cursor-pointer"
                  >
                    {isCommitting ? <span>Importing...</span> : <span>Confirm & Commit Import</span>}
                  </button>
                </div>
              </div>

              {/* Warning if duplicate */}
              {previewData.isDuplicate && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl text-xs flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span>
                    Notice: This rate sheet was already imported on {previewData.previousImport?.import_timestamp}. Re-importing will update prices.
                  </span>
                </div>
              )}

              {/* Summary Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px] font-bold">TOTAL VALID ROWS</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">{previewData.validRows}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[#00545C] block text-[10px] font-bold">PAINTS ITEMS</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {previewData.sections.PAINTS?.itemCount || 0}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[#7DBA00] block text-[10px] font-bold">ACCESSORIES ITEMS</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {previewData.sections.ACCESS?.itemCount || 0}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px] font-bold">SHEETS FOUND</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {previewData.sheetsFound.join(', ')}
                  </span>
                </div>
              </div>

              {/* Sample preview items */}
              {previewData.sections.PAINTS?.preview && (
                <div className="pt-2">
                  <p className="text-xs font-bold text-slate-700 mb-1">PAINTS Section Sample (First 5 items):</p>
                  <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-100 text-slate-600 text-[10px] font-bold uppercase">
                        <tr>
                          <th className="p-2">S.No</th>
                          <th className="p-2">Item Name</th>
                          <th className="p-2 text-right">Sale Rate</th>
                          <th className="p-2 text-center">Unit</th>
                          <th className="p-2 text-center">HSN/SAC</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {previewData.sections.PAINTS.preview.slice(0, 5).map((it, idx) => (
                          <tr key={idx}>
                            <td className="p-2 font-mono text-slate-400">{it.s_no}</td>
                            <td className="p-2 font-bold text-slate-800">{it.item_name}</td>
                            <td className="p-2 text-right font-mono font-bold text-[#00545C]">₹{it.sale_rate}</td>
                            <td className="p-2 text-center text-slate-600">{it.main_unit}</td>
                            <td className="p-2 text-center font-mono text-slate-500">{it.hsn_sac}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Import History Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-slate-900">Import History</h4>
                <p className="text-xs text-slate-500">Record of all price list rate sheet imports</p>
              </div>
              <button
                onClick={loadHistory}
                className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${loadingHistory ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-2.5 px-4">Filename</th>
                    <th className="py-2.5 px-4">Imported By</th>
                    <th className="py-2.5 px-4">Timestamp</th>
                    <th className="py-2.5 px-4 text-right">Items Imported</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {importHistory.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-slate-400">
                        No previous imports recorded.
                      </td>
                    </tr>
                  ) : (
                    importHistory.map((h) => (
                      <tr key={h.id} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-4 font-mono font-bold text-slate-900">
                          {h.filename}
                        </td>
                        <td className="py-2.5 px-4 text-slate-700 font-medium">
                          {h.imported_by}
                        </td>
                        <td className="py-2.5 px-4 text-slate-500">
                          {h.import_timestamp}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-700">
                          {h.rows_imported.toLocaleString()} items
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* Manual Add New Product Modal Dialog */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            
            {/* Header */}
            <div className="bg-[#00545C] text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Plus className="w-5 h-5 text-[#7DBA00]" />
                <h3 className="font-extrabold text-base">Add New Product to Price List</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateProductSubmit} className="p-6 space-y-4 text-xs">
              
              {createProductError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{createProductError}</span>
                </div>
              )}

              {createProductSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl flex items-center space-x-2">
                  <Check className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                  <span>{createProductSuccess}</span>
                </div>
              )}

              {/* Section Selector */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Catalogue Section <span className="text-rose-500">*</span></label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewProduct({ ...newProduct, section: 'PAINTS' })}
                    className={`py-2 rounded-xl font-bold border transition-all ${
                      newProduct.section === 'PAINTS'
                        ? 'bg-[#00545C] text-white border-[#00545C]'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    PAINTS SECTION
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewProduct({ ...newProduct, section: 'ACCESS' })}
                    className={`py-2 rounded-xl font-bold border transition-all ${
                      newProduct.section === 'ACCESS'
                        ? 'bg-[#00545C] text-white border-[#00545C]'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    ACCESSORIES SECTION
                  </button>
                </div>
              </div>

              {/* Product Name */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Item Description / Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ASIAN APCOLITE PREMIUM EMULSION 1LT"
                  value={newProduct.item_name}
                  onChange={(e) => setNewProduct({ ...newProduct, item_name: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00545C]"
                />
              </div>

              {/* Details / Specs */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Product Details / Shade / Specs <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Brilliant White / Exterior Finish"
                  value={newProduct.details}
                  onChange={(e) => setNewProduct({ ...newProduct, details: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00545C]"
                />
              </div>

              {/* Sale Rate & Unit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Sale Rate (₹ Incl. GST) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-400 font-bold">₹</span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      required
                      placeholder="0.00"
                      value={newProduct.sale_rate}
                      onChange={(e) => setNewProduct({ ...newProduct, sale_rate: e.target.value })}
                      className="w-full pl-7 pr-3 py-2 font-mono font-bold border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00545C]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Main Unit
                  </label>
                  <select
                    value={newProduct.main_unit}
                    onChange={(e) => setNewProduct({ ...newProduct, main_unit: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00545C]"
                  >
                    <option value="Nos">Nos</option>
                    <option value="Ltr">Ltr</option>
                    <option value="Kg">Kg</option>
                    <option value="Box">Box</option>
                    <option value="Set">Set</option>
                    <option value="Mtr">Mtr</option>
                    <option value="Roll">Roll</option>
                  </select>
                </div>
              </div>

              {/* HSN/SAC */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  HSN / SAC Code <span className="text-slate-400 font-normal">(e.g. 3208, 3209, 3214, 9603)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 3209"
                  value={newProduct.hsn_sac}
                  onChange={(e) => setNewProduct({ ...newProduct, hsn_sac: e.target.value })}
                  className="w-full px-3 py-2 font-mono border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00545C]"
                />
              </div>

              {/* Footer buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 font-bold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingProduct}
                  className="flex items-center space-x-1.5 px-6 py-2.5 rounded-xl bg-[#7DBA00] hover:bg-[#8ee000] text-[#003B40] font-black shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isCreatingProduct ? 'Saving Item...' : 'Save Product'}</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Themed Confirmation Dialog */}
      <ThemedConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        type={confirmDialog.type}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />

      {/* Non-Intrusive Bottom-Right Action Toast */}
      {toastMsg && (
        <div className={`fixed bottom-6 right-6 z-50 font-bold text-xs py-3 px-5 rounded-2xl shadow-2xl flex items-center space-x-2.5 border backdrop-blur-md animate-in slide-in-from-bottom-3 duration-200 ${
          toastMsg.isError 
            ? 'bg-rose-950/95 text-rose-100 border-rose-700/80' 
            : 'bg-[#00545C]/95 text-[#7DBA00] border-[#7DBA00]/50'
        }`}>
          {toastMsg.isError ? (
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-[#7DBA00] flex-shrink-0" />
          )}
          <span className="text-white tracking-wide">{toastMsg.text}</span>
        </div>
      )}

    </div>
  );
}
