import React, { useState, useEffect } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
  RefreshCw,
  Download,
  Edit2,
  AlertCircle,
  ChevronRight,
  Database,
  Trash2,
  Layers,
  Check,
  Calendar
} from 'lucide-react';
import { api } from '../../api/client';
import { formatINR } from '../../utils/currency';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';

export function PriceList({ activePriceList, onPriceListChanged }) {
  // Products table state
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [categories, setCategories] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);

  // Versions history state
  const [priceLists, setPriceLists] = useState([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [showVersionsSection, setShowVersionsSection] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState(null);

  // Deletion modals state
  const [clearAllModalOpen, setClearAllModalOpen] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);
  const [deleteVersionModalOpen, setDeleteVersionModalOpen] = useState(false);
  const [versionToDelete, setVersionToDelete] = useState(null);
  const [deletingVersion, setDeletingVersion] = useState(false);

  // Upload & Import Wizard State
  const [showUploadWizard, setShowUploadWizard] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [sheets, setSheets] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [previewData, setPreviewData] = useState(null);
  const [headerRowIndex, setHeaderRowIndex] = useState(0);
  const [columnMapping, setColumnMapping] = useState({});
  const [replaceExisting, setReplaceExisting] = useState(true); // default true: daily update fresh replacement
  const [deduplicate, setDeduplicate] = useState(true); // default true: intra-sheet deduplication
  const [uploadLoading, setUploadLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importSummary, setImportSummary] = useState(null);
  const [wizardError, setWizardError] = useState(null);

  // Price Override Modal State
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [selectedProductForOverride, setSelectedProductForOverride] = useState(null);
  const [overridePrice, setOverridePrice] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideError, setOverrideError] = useState(null);
  const [overrideLoading, setOverrideLoading] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchPriceLists();
  }, [searchTerm, selectedCategory, selectedStatus, page, activePriceList?.id]);

  async function fetchProducts() {
    try {
      setLoadingProducts(true);
      const res = await api.getProducts({
        search: searchTerm,
        category: selectedCategory,
        status: selectedStatus,
        page,
        limit: 25
      });
      setProducts(res.products || []);
      setCategories(res.categories || []);
      setTotalPages(res.totalPages || 1);
      setTotalProducts(res.total || 0);
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setLoadingProducts(false);
    }
  }

  async function fetchPriceLists() {
    try {
      setLoadingVersions(true);
      const res = await api.getPriceLists();
      setPriceLists(res.priceLists || []);
    } catch (err) {
      console.error('Failed to load price list versions:', err);
    } finally {
      setLoadingVersions(false);
    }
  }

  // Handle Excel File Selection
  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setUploadLoading(true);
      setWizardError(null);
      const res = await api.uploadExcel(formData);
      setUploadedFile(res.file);
      setSheets(res.sheets || []);
      setSelectedSheet(res.selectedSheet || res.sheets[0]?.name || '');
      setPreviewData(res.preview);
      setHeaderRowIndex(res.preview?.detectedHeaderRowIndex || 0);
      setColumnMapping(res.preview?.suggestedMapping || {});
      setShowUploadWizard(true);
    } catch (err) {
      setWizardError(err.message || 'Failed to upload and parse Excel file.');
    } finally {
      setUploadLoading(false);
      e.target.value = '';
    }
  }

  // Change worksheet in preview
  async function handleSheetChange(newSheet) {
    setSelectedSheet(newSheet);
    try {
      setUploadLoading(true);
      const res = await api.previewSheet({
        filePath: uploadedFile.path,
        sheetName: newSheet
      });
      setPreviewData(res.preview);
      setHeaderRowIndex(res.preview?.detectedHeaderRowIndex || 0);
      setColumnMapping(res.preview?.suggestedMapping || {});
    } catch (err) {
      setWizardError(err.message || 'Failed to preview selected sheet.');
    } finally {
      setUploadLoading(false);
    }
  }

  // Change header row index
  async function handleHeaderRowChange(newIndex) {
    const idx = Number(newIndex);
    setHeaderRowIndex(idx);
    try {
      const res = await api.previewSheet({
        filePath: uploadedFile.path,
        sheetName: selectedSheet,
        headerRowIndex: idx
      });
      setPreviewData(res.preview);
      setColumnMapping(res.preview?.suggestedMapping || {});
    } catch (err) {
      console.error(err);
    }
  }

  // Commit imported price list to SQLite
  async function handleConfirmImport() {
    if (!columnMapping.product_name) {
      setWizardError('Please map the "Product Name" column. It is mandatory.');
      return;
    }

    try {
      setImportLoading(true);
      setWizardError(null);
      const res = await api.confirmImport({
        filePath: uploadedFile.path,
        originalFilename: uploadedFile.filename,
        sheetName: selectedSheet,
        headerRowIndex,
        columnMapping,
        isDemo: false,
        replaceExisting,
        deduplicate
      });

      setImportSummary(res);
      setActionSuccessMessage(res.message);
      if (onPriceListChanged) {
        onPriceListChanged();
      }
      fetchPriceLists();
      fetchProducts();
    } catch (err) {
      setWizardError(err.message || 'Failed to finalize import.');
    } finally {
      setImportLoading(false);
    }
  }

  // Handle Full Section Clear Data (Wipe all price lists and products)
  async function handleConfirmClearAll() {
    try {
      setClearingAll(true);
      const res = await api.clearAllPriceLists();
      setClearAllModalOpen(false);
      setActionSuccessMessage(res.message || 'All price lists and products have been cleared successfully.');
      await fetchPriceLists();
      await fetchProducts();
      if (onPriceListChanged) {
        onPriceListChanged();
      }
    } catch (err) {
      alert(err.message || 'Failed to clear price lists.');
    } finally {
      setClearingAll(false);
    }
  }

  // Handle Individual Version Deletion
  async function handleConfirmDeleteVersion() {
    if (!versionToDelete) return;
    try {
      setDeletingVersion(true);
      const res = await api.deletePriceList(versionToDelete.id);
      setDeleteVersionModalOpen(false);
      setVersionToDelete(null);
      setActionSuccessMessage(res.message || `Deleted Version ${versionToDelete.version}.`);
      await fetchPriceLists();
      await fetchProducts();
      if (onPriceListChanged) {
        onPriceListChanged();
      }
    } catch (err) {
      alert(err.message || 'Failed to delete price list version.');
    } finally {
      setDeletingVersion(false);
    }
  }

  // Switch Active Price List Version
  async function handleActivateVersion(id) {
    try {
      await api.activatePriceList(id);
      setActionSuccessMessage('Activated selected price list version.');
      await fetchPriceLists();
      await fetchProducts();
      if (onPriceListChanged) {
        onPriceListChanged();
      }
    } catch (err) {
      alert(err.message || 'Failed to activate price list.');
    }
  }

  // Handle manual price override
  function openPriceOverride(product) {
    setSelectedProductForOverride(product);
    setOverridePrice(product.sales_rate || '');
    setOverrideReason('');
    setOverrideError(null);
    setOverrideModalOpen(true);
  }

  async function handleSavePriceOverride(e) {
    e.preventDefault();
    if (!overridePrice || isNaN(overridePrice) || Number(overridePrice) <= 0) {
      setOverrideError('Please enter a valid positive numeric price.');
      return;
    }
    if (!overrideReason || overrideReason.trim().length < 5) {
      setOverrideError('A clear audit reason (at least 5 characters) is required for manual price override.');
      return;
    }

    try {
      setOverrideLoading(true);
      setOverrideError(null);
      await api.overrideProductPrice(selectedProductForOverride.id, {
        newPrice: Number(overridePrice),
        reason: overrideReason
      });

      setOverrideModalOpen(false);
      setActionSuccessMessage(`Updated price for ${selectedProductForOverride.product_name} to ₹${overridePrice}`);
      fetchProducts();
    } catch (err) {
      setOverrideError(err.message || 'Failed to override price.');
    } finally {
      setOverrideLoading(false);
    }
  }

  const hasCatalogData = priceLists.length > 0 || totalProducts > 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header & Actions Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Price List Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            The imported Excel price list is the single source of truth for all product names, specifications, rates, and units.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Version History Toggle */}
          <button
            type="button"
            onClick={() => setShowVersionsSection(prev => !prev)}
            className={`inline-flex items-center gap-2 px-3 py-2 border text-xs font-semibold rounded-md shadow-xs transition-colors ${
              showVersionsSection
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Versions ({priceLists.length})</span>
          </button>

          {/* Sample Download */}
          <a
            href={api.getSampleExcelUrl()}
            download
            className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-md shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Download Sample Excel</span>
          </a>

          {/* Full Section Clear Data Button (Danger Action) */}
          <button
            type="button"
            onClick={() => setClearAllModalOpen(true)}
            disabled={!hasCatalogData}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold rounded-md shadow-xs transition-colors"
            title="Wipe all price lists and products from database"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
            <span>Clear All Data</span>
          </button>

          {/* Upload Button */}
          <label className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md shadow-xs cursor-pointer transition-colors">
            <UploadCloud className="w-4 h-4" />
            <span>{uploadLoading ? 'Uploading...' : 'Upload Excel Price List'}</span>
            <input
              type="file"
              accept=".xlsx, .xls"
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploadLoading}
            />
          </label>
        </div>
      </div>

      {/* Action Success Toast/Banner */}
      {actionSuccessMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-800 flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccessMessage}</span>
          </div>
          <button
            onClick={() => setActionSuccessMessage(null)}
            className="text-emerald-600 hover:text-emerald-900 text-xs font-bold px-2 py-0.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* Upload & Import Wizard Modal/Drawer */}
      {showUploadWizard && (
        <div className="bg-white border-2 border-blue-500 rounded-lg p-6 shadow-md space-y-6 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Configure Excel Price List Import</h2>
              <p className="text-xs text-slate-500">
                File: <span className="font-semibold text-slate-800">{uploadedFile?.filename}</span> ({Math.round(uploadedFile?.size / 1024)} KB)
              </p>
            </div>
            <button
              onClick={() => {
                setShowUploadWizard(false);
                setImportSummary(null);
              }}
              className="text-xs text-slate-500 hover:text-slate-800 font-medium"
            >
              Cancel
            </button>
          </div>

          {wizardError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{wizardError}</span>
            </div>
          )}

          {importSummary ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6 text-center space-y-4">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
              <h3 className="text-base font-bold text-emerald-900">Price List Successfully Imported and Activated!</h3>
              <p className="text-xs text-emerald-700 max-w-lg mx-auto">
                {importSummary.message}
              </p>
              <div className="flex flex-wrap justify-center gap-6 text-xs text-slate-600 py-2">
                <div>Total Rows Examined: <b>{importSummary.summary.totalRows}</b></div>
                <div>Valid Products: <b className="text-emerald-700">{importSummary.summary.validProducts}</b></div>
                <div>Duplicates Removed: <b className="text-blue-700 font-semibold">{importSummary.summary.duplicatesRemoved || 0}</b></div>
                <div>Warnings: <b className="text-amber-700">{importSummary.summary.rowsWithWarnings}</b></div>
                <div>Catalog Mode: <b className="text-slate-800">{importSummary.summary.replacedExisting ? 'Fresh Daily Replace (No Duplicates)' : 'New Version Added'}</b></div>
              </div>
              <button
                onClick={() => {
                  setShowUploadWizard(false);
                  setImportSummary(null);
                }}
                className="px-5 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-md shadow-xs hover:bg-emerald-700"
              >
                Close & View Product Catalog
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Step 1: Sheet & Header Row Picker */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-md border border-slate-200">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Select Worksheet
                  </label>
                  <select
                    value={selectedSheet}
                    onChange={(e) => handleSheetChange(e.target.value)}
                    className="w-full text-xs bg-white border border-slate-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {sheets.map((s) => (
                      <option key={s.name} value={s.name}>
                        {s.name} ({s.rowCount} rows)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Header Row (1-indexed row number in Excel)
                  </label>
                  <select
                    value={headerRowIndex}
                    onChange={(e) => handleHeaderRowChange(e.target.value)}
                    className="w-full text-xs bg-white border border-slate-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {previewData?.previewRows?.slice(0, 10).map((row, idx) => (
                      <option key={idx} value={idx}>
                        Row {idx + 1}: {row.slice(0, 4).join(' | ').substring(0, 40)}...
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Step 2: Column Mapping Configuration */}
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Map Excel Columns to Application Fields
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Match your Excel columns to the standard fields below. (Product Name is mandatory).
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {[
                    { key: 'product_name', label: 'Product Name *', required: true },
                    { key: 'specification', label: 'Details / Specification' },
                    { key: 'hsn_code', label: 'HSN / SAC Code' },
                    { key: 'unit', label: 'Unit (e.g. Nos, bags, kg)' },
                    { key: 'sales_rate', label: 'Sales Rate (Selling Price)' },
                    { key: 'purchase_rate', label: 'Purchase Rate (Cost)' },
                    { key: 'gst_rate', label: 'GST %' },
                    { key: 'item_code', label: 'Item Code / SKU' },
                    { key: 'brand', label: 'Brand / Make' },
                    { key: 'category', label: 'Category' }
                  ].map((field) => (
                    <div key={field.key} className="bg-slate-50 p-2.5 rounded-md border border-slate-200">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {field.label}
                      </label>
                      <select
                        value={columnMapping[field.key] || ''}
                        onChange={(e) =>
                          setColumnMapping({ ...columnMapping, [field.key]: e.target.value })
                        }
                        className="w-full text-xs bg-white border border-slate-300 rounded p-1.5 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">-- None / Skip --</option>
                        {previewData?.detectedHeaders?.map((hdr, i) => (
                          <option key={i} value={hdr}>
                            {hdr}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Step 3: Daily Update & Duplicate Prevention Settings */}
              <div className="bg-slate-50 p-4 rounded-md border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Daily Update & Duplicate Prevention Settings
                  </h3>
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Zero Duplicates Guaranteed
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <label className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors ${replaceExisting ? 'bg-blue-50/60 border-blue-400' : 'bg-white border-slate-200'}`}>
                    <input
                      type="radio"
                      name="importMode"
                      checked={replaceExisting}
                      onChange={() => setReplaceExisting(true)}
                      className="mt-0.5 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900">Replace Active Catalog (Daily Update)</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Clears existing products and activates this new file fresh. Recommended for daily price lists to avoid duplicate items.
                      </div>
                    </div>
                  </label>

                  <label className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors ${!replaceExisting ? 'bg-blue-50/60 border-blue-400' : 'bg-white border-slate-200'}`}>
                    <input
                      type="radio"
                      name="importMode"
                      checked={!replaceExisting}
                      onChange={() => setReplaceExisting(false)}
                      className="mt-0.5 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900">Keep Historical Versions</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Preserves older versions in history and saves this upload as a new version.
                      </div>
                    </div>
                  </label>
                </div>

                <div className="pt-2 border-t border-slate-200/80">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={deduplicate}
                      onChange={(e) => setDeduplicate(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span>Automatically remove duplicate rows inside this Excel sheet (by item code or product name)</span>
                  </label>
                </div>
              </div>

              {/* Step 4: Worksheet Preview */}
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  First 10 Rows Preview
                </h3>
                <div className="overflow-x-auto border border-slate-200 rounded-md max-h-48">
                  <table className="min-w-full text-[11px] text-slate-600 divide-y divide-slate-200">
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {previewData?.previewRows?.slice(0, 10).map((row, rIdx) => {
                        const isHeader = rIdx === headerRowIndex;
                        return (
                          <tr key={rIdx} className={isHeader ? 'bg-blue-50 font-bold text-blue-900' : ''}>
                            <td className="px-2 py-1 bg-slate-100 text-slate-400 font-mono text-[10px]">
                              {rIdx + 1}
                            </td>
                            {row.map((cell, cIdx) => (
                              <td key={cIdx} className="px-2 py-1 whitespace-nowrap border-r border-slate-100">
                                {String(cell || '')}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Step 5: Confirm Action */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <span className="text-xs text-slate-500">
                  {replaceExisting
                    ? 'This will replace the active catalog with the verified products from this sheet.'
                    : 'This will save as a new version and set it as active.'}
                </span>
                <button
                  onClick={handleConfirmImport}
                  disabled={importLoading}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md shadow-xs transition-colors flex items-center gap-2"
                >
                  {importLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>{importLoading ? 'Validating & Importing...' : 'Confirm & Activate Price List'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Price List Versions & History Card (Expandable/Toggleable) */}
      {showVersionsSection && (
        <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden animate-in fade-in">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                <span>Price List Versions & History ({priceLists.length})</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage uploaded price list versions. You can activate past versions or delete unwanted versions anytime.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchPriceLists}
                className="text-slate-500 hover:text-slate-800 p-1 rounded"
                title="Refresh Versions"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingVersions ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setShowVersionsSection(false)}
                className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1 font-medium"
              >
                Hide
              </button>
            </div>
          </div>

          {priceLists.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No price list versions found in the database.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-2.5">Version</th>
                    <th className="px-4 py-2.5">Filename & Sheet</th>
                    <th className="px-4 py-2.5">Imported Date</th>
                    <th className="px-4 py-2.5 text-center">Products</th>
                    <th className="px-4 py-2.5 text-center">Warnings</th>
                    <th className="px-4 py-2.5 text-center">Status</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {priceLists.map((pl) => (
                    <tr key={pl.id} className={`hover:bg-slate-50 transition-colors ${pl.is_active ? 'bg-blue-50/30' : ''}`}>
                      <td className="px-4 py-3 font-bold text-slate-900">
                        v{pl.version}
                        {pl.is_demo ? <span className="ml-1 text-[10px] text-amber-600 font-normal">(Demo)</span> : null}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">{pl.filename}</div>
                        <div className="text-[11px] text-slate-400">Sheet: {pl.sheet_name || 'Default'}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {pl.imported_at ? new Date(pl.imported_at).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : '-'}
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-slate-800">
                        {pl.valid_products_count}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-500">
                        {pl.warnings_count || 0}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {pl.is_active ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                            <Check className="w-3 h-3" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600">
                            Archived
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          {!pl.is_active && (
                            <button
                              onClick={() => handleActivateVersion(pl.id)}
                              className="px-2 py-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded font-medium transition-colors"
                              title="Make this the active price list"
                            >
                              Activate
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setVersionToDelete(pl);
                              setDeleteVersionModalOpen(true);
                            }}
                            className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors"
                            title={`Delete version ${pl.version}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!hasCatalogData ? (
        /* Empty Catalog State Card */
        <div className="bg-white border-2 border-dashed border-slate-300 rounded-xl p-12 text-center max-w-2xl mx-auto space-y-4">
          <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <FileSpreadsheet className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">No Price List Currently Loaded</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Your catalog is currently empty. Upload your daily Excel price list to enable automatic product lookup, smart fuzzy matching, and real-time quotation pricing with zero duplicate entries.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md shadow-xs cursor-pointer transition-colors">
              <UploadCloud className="w-4 h-4" />
              <span>{uploadLoading ? 'Uploading...' : 'Upload Today\'s Excel Price List'}</span>
              <input
                type="file"
                accept=".xlsx, .xls"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploadLoading}
              />
            </label>
            <a
              href={api.getSampleExcelUrl()}
              download
              className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-md shadow-xs transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Download Sample Excel</span>
            </a>
          </div>
        </div>
      ) : (
        <>
          {/* Search and Filters Bar */}
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                placeholder="Search active products by name, code, specification, or brand..."
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              {/* Category Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Category:</span>
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setPage(1);
                  }}
                  className="text-xs bg-white border border-slate-200 rounded-md px-2.5 py-1.5 focus:ring-blue-500"
                >
                  <option value="all">All Categories</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Price Status Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Status:</span>
                <select
                  value={selectedStatus}
                  onChange={(e) => {
                    setSelectedStatus(e.target.value);
                    setPage(1);
                  }}
                  className="text-xs bg-white border border-slate-200 rounded-md px-2.5 py-1.5 focus:ring-blue-500"
                >
                  <option value="all">All Prices</option>
                  <option value="verified">Verified</option>
                  <option value="missing_price">Missing Price</option>
                  <option value="review_required">Needs Review</option>
                </select>
              </div>
            </div>
          </div>

          {/* Product Catalog Table */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Active Price List Products ({totalProducts})
                </h2>
                <p className="text-xs text-slate-500">
                  Source: <span className="font-semibold">{activePriceList?.filename || 'None'}</span>
                  {activePriceList?.is_demo ? ' (Demo Fictional Data)' : (activePriceList?.version ? ` (Version ${activePriceList.version})` : '')}
                </p>
              </div>
              <button
                onClick={fetchProducts}
                className="text-slate-500 hover:text-slate-800 p-1 rounded"
                title="Refresh products"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingProducts ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {products.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-xs">
                {loadingProducts ? 'Loading products...' : 'No products found matching your search or filters.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Code</th>
                      <th className="px-4 py-3">Product Name & Specification</th>
                      <th className="px-4 py-3">Category / Brand</th>
                      <th className="px-4 py-3">HSN Code</th>
                      <th className="px-4 py-3">Unit</th>
                      <th className="px-4 py-3 text-right">Sales Rate</th>
                      <th className="px-4 py-3 text-right">Purchase Rate</th>
                      <th className="px-4 py-3 text-center">GST %</th>
                      <th className="px-4 py-3">Price Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {products.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-mono font-medium text-slate-500">
                          {p.item_code || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{p.product_name}</div>
                          {p.specification && (
                            <div className="text-[11px] text-slate-500">{p.specification}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          <div>{p.category || '-'}</div>
                          {p.brand && <div className="text-[11px] text-slate-400">{p.brand}</div>}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-600">
                          {p.hsn_code || '-'}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-700">
                          {p.unit || 'Nos'}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900">
                          {p.sales_rate ? formatINR(p.sales_rate) : <span className="text-rose-600">Missing</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-500">
                          {p.purchase_rate ? formatINR(p.purchase_rate) : '-'}
                        </td>
                        <td className="px-4 py-3 text-center font-medium text-slate-700">
                          {p.gst_rate}%
                        </td>
                        <td className="px-4 py-3">
                          {p.price_status === 'verified' ? (
                            <Badge variant="success">Verified</Badge>
                          ) : p.price_status === 'missing_price' ? (
                            <Badge variant="danger">Missing Price</Badge>
                          ) : (
                            <Badge variant="warning">Review</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => openPriceOverride(p)}
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium"
                            title="Override price with audit reason"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>Override</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Bar */}
            {totalPages > 1 && (
              <div className="px-6 py-3 border-t border-slate-200 flex items-center justify-between bg-slate-50/50 text-xs">
                <span className="text-slate-500">
                  Showing page {page} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                    className="px-3 py-1 bg-white border border-slate-200 rounded text-slate-700 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                    className="px-3 py-1 bg-white border border-slate-200 rounded text-slate-700 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Manual Price Override Modal */}
      <Modal
        isOpen={overrideModalOpen}
        onClose={() => setOverrideModalOpen(false)}
        title="Manual Price Override (With Audit Trail)"
      >
        <form onSubmit={handleSavePriceOverride} className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <b>Audit Notice:</b> Modifying a product price overrides the imported price list. All changes are permanently recorded in the audit trail with operator identity and mandatory rationale.
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Product</label>
            <input
              type="text"
              readOnly
              value={selectedProductForOverride?.product_name || ''}
              className="w-full text-xs bg-slate-100 border border-slate-200 rounded-md p-2 text-slate-700 cursor-not-allowed"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Current Price (INR)</label>
              <input
                type="text"
                readOnly
                value={selectedProductForOverride?.sales_rate || 'None'}
                className="w-full text-xs bg-slate-100 border border-slate-200 rounded-md p-2 text-slate-700 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">New Price (INR) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={overridePrice}
                onChange={(e) => setOverridePrice(e.target.value)}
                placeholder="Enter new price"
                className="w-full text-xs bg-white border border-slate-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Override Reason / Business Justification *
            </label>
            <textarea
              rows={3}
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="e.g. Special festive bulk discount approved by owner, or revised supplier cost."
              className="w-full text-xs bg-white border border-slate-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          {overrideError && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700">
              {overrideError}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setOverrideModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={overrideLoading}
              className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow-xs flex items-center gap-2"
            >
              {overrideLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
              <span>Save & Log Override</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Clear All Confirmation Modal (Full Section Clear) */}
      <Modal
        isOpen={clearAllModalOpen}
        onClose={() => !clearingAll && setClearAllModalOpen(false)}
        title="Clear All Price List Data"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <b className="font-semibold text-rose-900">Permanent Catalog Reset:</b>
              <p className="mt-1 text-rose-700">
                This will delete <b>all {priceLists.length} price lists</b> and all <b>{totalProducts} products</b> from your system.
              </p>
            </div>
          </div>

          <div className="text-xs text-slate-600 space-y-2 bg-slate-50 p-3 rounded-md border border-slate-200">
            <div className="flex items-center gap-2 text-emerald-700 font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>Past quotations and generated PDFs remain completely safe and untouched.</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-blue-600" />
              <span>Allows you to re-upload a clean daily Excel sheet with zero duplicate entries.</span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              disabled={clearingAll}
              onClick={() => setClearAllModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={clearingAll}
              onClick={handleConfirmClearAll}
              className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-md shadow-xs flex items-center gap-2"
            >
              {clearingAll ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              <span>{clearingAll ? 'Clearing All...' : 'Yes, Clear All Data'}</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Single Version Modal */}
      <Modal
        isOpen={deleteVersionModalOpen}
        onClose={() => !deletingVersion && setDeleteVersionModalOpen(false)}
        title={`Delete Price List Version ${versionToDelete?.version || ''}`}
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Are you sure you want to delete this version?</p>
              <p className="mt-1 text-slate-600">
                File: <span className="font-medium text-slate-900">{versionToDelete?.filename}</span>
              </p>
              <p className="text-slate-600">
                Products: <span className="font-medium text-slate-900">{versionToDelete?.valid_products_count} items</span>
              </p>
              {versionToDelete?.is_active && (
                <p className="mt-1 text-amber-800 font-medium">
                  Note: This is currently the active version. If deleted, the next latest remaining version will be activated automatically.
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              disabled={deletingVersion}
              onClick={() => {
                setDeleteVersionModalOpen(false);
                setVersionToDelete(null);
              }}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={deletingVersion}
              onClick={handleConfirmDeleteVersion}
              className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-md shadow-xs flex items-center gap-2"
            >
              {deletingVersion ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              <span>{deletingVersion ? 'Deleting...' : 'Delete Version'}</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
