import React, { useState, useEffect, useRef } from 'react';
import { 
  User, Search, Plus, Trash2, Check, FileText, Printer, MessageCircle, 
  Mail, AlertCircle, Sparkles, Building2, Phone, MapPin, Tag, 
  MessageSquare, Edit3, X, QrCode, ArrowRight, CheckCircle2, ChevronDown, Layers, Loader2
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import QuotationPdfModal from '../components/QuotationPdfModal';
import WhatsAppShareModal from '../components/WhatsAppShareModal';
import EmailShareModal from '../components/EmailShareModal';
import SmartParserModal from '../components/SmartParserModal';
import ThemedConfirmDialog from '../components/ThemedConfirmDialog';
import { numberToIndianWords } from '../utils/numberToWords';

const COMMON_UNITS = ['Nos', 'Ltr', 'Kg', 'Box', 'Bag', 'Can', 'Set', 'Drum', 'Roll', 'Meter', 'Pkt', 'Tin'];

export default function CreateQuotation({ setActivePage, initialCustomer, importData, onClearImportData, editingQuote, onCancelEdit }) {
  const { settings } = useAuth();

  // WhatsApp Smart Parser Modal
  const [showSmartParser, setShowSmartParser] = useState(false);

  // Catalogue Drawer Modal
  const [showCatalogDrawer, setShowCatalogDrawer] = useState(false);

  // Customer State
  const [customerSearch, setCustomerSearch] = useState('');
  const [existingCustomers, setExistingCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerError, setCustomerError] = useState('');
  const [customerNameTouched, setCustomerNameTouched] = useState(false);
  const [customerPhoneTouched, setCustomerPhoneTouched] = useState(false);
  const [itemsError, setItemsError] = useState('');
  const [activeDropdownIndex, setActiveDropdownIndex] = useState(-1);

  // Quotation Meta
  const [quotationDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [validityDate, setValidityDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + (parseInt(settings?.default_validity_days) || 7));
    return d.toISOString().split('T')[0];
  });
  const [paperFormat, setPaperFormat] = useState(settings?.default_paper_format || 'A4'); // 'A4' | 'A5'
  const [notes, setNotes] = useState(settings?.default_terms || '');

  // Line Items in Quotation Studio
  const [items, setItems] = useState([]);
  const [highlightedRowIndex, setHighlightedRowIndex] = useState(null);
  const lastAddClickRef = useRef(0);

  // Live Quick Search Bar State (Above Table)
  const [quickSearchQuery, setQuickSearchQuery] = useState('');
  const [quickSearchResults, setQuickSearchResults] = useState([]);
  const [isSearchingQuick, setIsSearchingQuick] = useState(false);
  const [showQuickDropdown, setShowQuickDropdown] = useState(false);
  const [quickSectionFilter, setQuickSectionFilter] = useState('ALL'); // 'ALL' | 'PAINTS' | 'ACCESS'
  const [isSearchAmbiguous, setIsSearchAmbiguous] = useState(false);
  const [searchDistinctTypes, setSearchDistinctTypes] = useState([]);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('ALL');
  const [selectedSizeFilter, setSelectedSizeFilter] = useState('ALL');
  const [searchSuggestions, setSearchSuggestions] = useState({ availableSizes: [], availableTypes: [], didYouMean: null });
  const searchContainerRef = useRef(null);

  // Catalogue Drawer State
  const [catalogSection, setCatalogSection] = useState('PAINTS');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [productCounts, setProductCounts] = useState({ total: 5331, paints: 4185, access: 1146 });

  // Financial Calculations & Adjustments (Tax Inclusive)
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountAmountManual, setDiscountAmountManual] = useState('');
  const [discountMode, setDiscountMode] = useState('percent'); // 'percent' | 'amount'
  const [gstRate, setGstRate] = useState(18); // Default 18% standard GST included
  const [deliveryCharges, setDeliveryCharges] = useState('');

  // Submission & Post-Creation Modal State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdQuotation, setCreatedQuotation] = useState(null);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [showWaModal, setShowWaModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [recentActionToast, setRecentActionToast] = useState(null);

  // Dialog State (replaces native confirm/alert)
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    type: 'confirm',
    onConfirm: null
  });

  // Handle outside click to dismiss quick search dropdown
  useEffect(() => {
    function handleClickOutside(e) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowQuickDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Initialize customer and product counts
  useEffect(() => {
    loadCustomers();
    loadProductCounts();
  }, []);

  useEffect(() => {
    if (initialCustomer) {
      handleSelectExistingCustomer(initialCustomer);
    }
  }, [initialCustomer]);

  useEffect(() => {
    if (importData) {
      applyImportData(importData);
      if (onClearImportData) onClearImportData();
    }
  }, [importData]);

  // Load existing quotation data when editing
  useEffect(() => {
    if (editingQuote) {
      setSelectedCustomerId(editingQuote.customer_id || null);
      setCustomerName(editingQuote.customer_name || '');
      setCustomerPhone(editingQuote.customer_phone || '');
      setCustomerEmail(editingQuote.customer_email || '');
      setCustomerAddress(editingQuote.customer_address || '');
      setPaperFormat(editingQuote.paper_format || 'A4');
      if (editingQuote.validity_date) setValidityDate(editingQuote.validity_date);
      if (editingQuote.notes != null) setNotes(editingQuote.notes);
      if (editingQuote.discount_percent != null) setDiscountPercent(editingQuote.discount_percent);
      if (editingQuote.gst_rate != null) setGstRate(editingQuote.gst_rate);
      if (editingQuote.delivery_charges != null) setDeliveryCharges(String(editingQuote.delivery_charges || ''));

      if (Array.isArray(editingQuote.items) && editingQuote.items.length > 0) {
        setItems(editingQuote.items.map((it, idx) => ({
          id: it.id || (Date.now() + idx),
          product_id: it.product_id || null,
          item_name: it.item_name,
          details: it.details || '',
          hsn_sac: it.hsn_sac || '',
          unit: it.unit || 'Nos',
          quantity: it.quantity || 1,
          sale_rate: it.sale_rate || 0,
          original_sale_rate: it.original_sale_rate || it.sale_rate || 0,
          line_total: it.line_total || Math.round((it.quantity || 1) * (it.sale_rate || 0) * 100) / 100,
          customer_input: ''
        })));
      }
    }
  }, [editingQuote]);

  // Catalog Drawer search
  useEffect(() => {
    if (showCatalogDrawer) {
      fetchCatalogProducts();
    }
  }, [showCatalogDrawer, catalogSection, catalogSearch]);

  // Quick search debounce with Intelligent Multi-Attribute Engine (Space/Hyphen Agnostic)
  useEffect(() => {
    if (!quickSearchQuery.trim()) {
      setQuickSearchResults([]);
      setShowQuickDropdown(false);
      setIsSearchAmbiguous(false);
      setSearchDistinctTypes([]);
      setSelectedTypeFilter('ALL');
      setSelectedSizeFilter('ALL');
      setSearchSuggestions({ availableSizes: [], availableTypes: [], didYouMean: null });
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearchingQuick(true);
        const res = await api.getProducts({
          section: quickSectionFilter === 'ALL' ? undefined : quickSectionFilter,
          search: quickSearchQuery.trim(),
          all: 'true'
        });
        setQuickSearchResults(res.products || []);
        setIsSearchAmbiguous(Boolean(res.ambiguous));
        setSearchDistinctTypes(res.distinctTypes || []);
        setSearchSuggestions(res.suggestions || { availableSizes: [], availableTypes: [], didYouMean: null });
        setSelectedTypeFilter('ALL');
        setSelectedSizeFilter('ALL');
        setShowQuickDropdown(true);
      } catch (err) {
        console.warn('Quick search failed:', err);
      } finally {
        setIsSearchingQuick(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [quickSearchQuery, quickSectionFilter]);

  async function loadCustomers() {
    try {
      const res = await api.getCustomers();
      setExistingCustomers(res.customers || []);
    } catch (e) {}
  }

  async function loadProductCounts() {
    try {
      const res = await api.getProductCounts();
      if (res) setProductCounts(res);
    } catch (e) {}
  }

  async function fetchCatalogProducts(loadAll = false) {
    try {
      setLoadingCatalog(true);
      const res = await api.getProducts({
        section: catalogSection,
        search: catalogSearch.trim(),
        all: (catalogSearch.trim() || loadAll) ? 'true' : 'false',
        limit: (catalogSearch.trim() || loadAll) ? undefined : 150
      });
      setCatalogProducts(res.products || []);
    } catch (e) {
      console.warn('Catalogue load failed:', e);
    } finally {
      setLoadingCatalog(false);
    }
  }

  function applyImportData(data) {
    if (!data) return;
    const name = data.customer?.name || data.customer_name || '';
    const phone = data.customer?.phone || data.customer_phone || '';
    const email = data.customer?.email || data.customer_email || '';
    const address = data.customer?.address || data.customer_address || '';

    if (name) setCustomerName(name);
    if (phone) setCustomerPhone(phone);
    if (email) setCustomerEmail(email);
    if (address) setCustomerAddress(address);

    if (data.items && data.items.length > 0) {
      const formattedItems = data.items.map((it, idx) => {
        const pId = it.product_id || it.productId || it.id || null;
        const qty = parseFloat(it.quantity) || 1;
        const rate = parseFloat(it.sale_rate || it.saleRate || 0);
        const customerReq = it.details || it.rawText || it.originalLine || '';

        return {
          id: Date.now() + Math.random() + idx,
          product_id: pId,
          item_name: it.item_name || it.itemName || 'Selected Product',
          hsn_sac: it.hsn_sac || it.hsnSac || '',
          unit: it.unit || it.main_unit || 'Nos',
          details: customerReq,
          quantity: qty,
          sale_rate: rate,
          catalog_rate: rate,
          line_total: Math.round(qty * rate * 100) / 100,
          is_overridden: false,
          availableSizes: it.availableSizes || []
        };
      });

      // Append new items to allow multiple entries freely without wiping existing rows
      setItems(prev => [...prev, ...formattedItems]);
      showToast(`✓ Added ${formattedItems.length} product entry(s) to quotation!`);
    }
  }

  function handleSelectExistingCustomer(cust) {
    setSelectedCustomerId(cust.id);
    setCustomerName(cust.name);
    setCustomerPhone(cust.phone);
    setCustomerEmail(cust.email || '');
    setCustomerAddress(cust.address || '');
    setCustomerError('');
    setCustomerSearch('');
    showToast(`Loaded customer: ${cust.name}`);
  }

  function showToast(msg, isError = false) {
    setRecentActionToast({ text: typeof msg === 'string' ? msg : msg.text, isError });
    setTimeout(() => setRecentActionToast(null), 3800);
  }

  const isNameValid = customerName.trim().length > 0;
  const isPhoneValid = customerPhone.replace(/\D/g, '').length >= 10;

  // Add product to quote (Supports Multiple Entries for different shades/specs/rooms)
  function handleAddProduct(product) {
    // Rapid double-click guard
    const now = Date.now();
    if (now - lastAddClickRef.current < 250) return;
    lastAddClickRef.current = now;

    const officialDetails = product.details || product.structuredDetails?.summary || '';
    const customerReq = quickSearchQuery.trim();

    const newItem = {
      id: Date.now() + Math.random(),
      product_id: product.id,
      item_name: product.item_name,
      hsn_sac: product.hsn_sac || '',
      unit: product.main_unit || 'Nos',
      details: officialDetails,
      customer_req: customerReq,
      quantity: 1,
      sale_rate: product.sale_rate,
      catalog_rate: product.sale_rate,
      line_total: product.sale_rate,
      is_overridden: false,
      structuredDetails: product.structuredDetails || null,
      availableSizes: product.availableSizes || []
    };

    setItems(prev => [...prev, newItem]);
    setItemsError('');
    setQuickSearchQuery('');
    setShowQuickDropdown(false);
    setActiveDropdownIndex(-1);
    showToast(`✓ Added: ${product.item_name}`);
  }

  // Rapid Blank Row Addition for Manual Quotation Creation
  function handleAddBlankItem() {
    const newItem = {
      id: Date.now() + Math.random(),
      product_id: null,
      item_name: '',
      hsn_sac: '32091010',
      unit: 'Nos',
      details: '',
      customer_req: '',
      quantity: 1,
      sale_rate: 0,
      catalog_rate: 0,
      line_total: 0,
      is_overridden: true,
      availableSizes: []
    };
    setItems(prev => [...prev, newItem]);
    setItemsError('');
    showToast('✓ Added blank row. You can type item name, rate, and unit directly.');
  }

  function handleSearchKeyDown(e) {
    if (!showQuickDropdown || displayedQuickResults.length === 0) {
      if (e.key === 'ArrowDown' && displayedQuickResults.length > 0) {
        setShowQuickDropdown(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveDropdownIndex(prev => (prev < displayedQuickResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveDropdownIndex(prev => (prev > 0 ? prev - 1 : displayedQuickResults.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeDropdownIndex >= 0 && activeDropdownIndex < displayedQuickResults.length) {
        handleAddProduct(displayedQuickResults[activeDropdownIndex]);
      } else if (displayedQuickResults.length > 0) {
        handleAddProduct(displayedQuickResults[0]);
      }
    } else if (e.key === 'Escape') {
      setShowQuickDropdown(false);
      setActiveDropdownIndex(-1);
    }
  }

  function updateItemCustomerReq(index, val) {
    setItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], customer_req: val };
      return next;
    });
  }

  // BULLETPROOF QUANTITY CONTROLS
  function updateItemQuantity(index, val) {
    setItems(prev => {
      const next = [...prev];
      const item = { ...next[index] };

      if (val === '' || val === undefined) {
        item.quantity = '';
        item.line_total = 0;
      } else {
        const num = typeof val === 'number' ? val : parseFloat(val);
        item.quantity = val;
        const validNum = isNaN(num) ? 0 : Math.max(0, num);
        item.line_total = Math.round(validNum * Number(item.sale_rate || 0) * 100) / 100;
      }

      next[index] = item;
      return next;
    });
  }

  function stepQuantity(index, delta) {
    setItems(prev => {
      const next = [...prev];
      const item = { ...next[index] };
      const current = parseFloat(item.quantity) || 0;
      const newQty = Math.max(0.5, Math.round((current + delta) * 100) / 100);
      item.quantity = newQty;
      item.line_total = Math.round(newQty * Number(item.sale_rate || 0) * 100) / 100;
      next[index] = item;
      return next;
    });
  }

  function normalizeItemQuantityOnBlur(index) {
    setItems(prev => {
      const next = [...prev];
      const item = { ...next[index] };
      let val = parseFloat(item.quantity);
      if (isNaN(val) || val <= 0) {
        val = 1;
      } else {
        val = Math.round(val * 100) / 100;
      }
      item.quantity = val;
      item.line_total = Math.round(val * Number(item.sale_rate || 0) * 100) / 100;
      next[index] = item;
      return next;
    });
  }

  // 1-Click Pack Size Switcher for Line Items in Quotation Table
  function handleSwitchRowPackSize(index, sizeOption) {
    setItems(prev => {
      const next = [...prev];
      const cur = { ...next[index] };
      const newRate = sizeOption.sale_rate != null ? sizeOption.sale_rate : cur.sale_rate;
      const qty = parseFloat(cur.quantity) || 1;
      cur.product_id = sizeOption.id || cur.product_id;
      cur.item_name = sizeOption.item_name || cur.item_name;
      if (sizeOption.details) cur.details = sizeOption.details;
      cur.sale_rate = newRate;
      cur.catalog_rate = newRate;
      cur.unit = sizeOption.main_unit || cur.unit || 'Nos';
      cur.line_total = Math.round(qty * newRate * 100) / 100;
      next[index] = cur;
      return next;
    });
    showToast(`✓ Switched to ${sizeOption.packSize || sizeOption.item_name} (₹${sizeOption.sale_rate})`);
  }

  // Unit Update
  function updateItemUnit(index, unit) {
    setItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], unit: unit || 'Nos' };
      return next;
    });
  }

  // Rate Override
  function updateItemRate(index, newRate) {
    setItems(prev => {
      const next = [...prev];
      const item = { ...next[index] };
      item.sale_rate = newRate;
      const numericRate = parseFloat(newRate);
      const validRate = isNaN(numericRate) ? 0 : Math.max(0, numericRate);
      const numericQty = parseFloat(item.quantity) || 0;
      item.line_total = Math.round(numericQty * validRate * 100) / 100;
      item.is_overridden = Math.abs(validRate - (item.catalog_rate || 0)) > 0.001;
      next[index] = item;
      return next;
    });
  }

  // Details / Shade Update
  function updateItemDetails(index, details) {
    setItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], details };
      return next;
    });
  }

  // Remove Item
  function removeItem(index) {
    setItems(prev => prev.filter((_, idx) => idx !== index));
  }

  // TAX INCLUSIVE FINANCIAL CALCULATIONS
  const grossSubtotal = Math.round(items.reduce((acc, it) => acc + (parseFloat(it.line_total) || 0), 0) * 100) / 100;
  
  let computedDiscount = 0;
  if (discountMode === 'percent') {
    computedDiscount = Math.round((grossSubtotal * (parseFloat(discountPercent) || 0) / 100) * 100) / 100;
  } else {
    computedDiscount = Math.min(grossSubtotal, parseFloat(discountAmountManual) || 0);
  }

  const netRetail = Math.max(0, grossSubtotal - computedDiscount);
  const gstRateVal = parseFloat(gstRate) || 18;
  const taxableBase = Math.round((netRetail / (1 + gstRateVal / 100)) * 100) / 100;
  const includedGst = Math.round((netRetail - taxableBase) * 100) / 100;
  const deliveryVal = Math.max(0, parseFloat(deliveryCharges) || 0);
  const grandTotal = Math.round((netRetail + deliveryVal) * 100) / 100;

  function formatCurrency(val) {
    return '₹' + Number(val || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  // Reset entire quotation studio
  function handleClearForm() {
    if (items.length > 0 || customerName) {
      setConfirmDialog({
        isOpen: true,
        title: 'Reset Quotation Studio',
        message: 'Clear all items, customer fields, and adjustments to start a new blank quotation?',
        confirmText: 'Clear All',
        cancelText: 'Keep Editing',
        type: 'danger',
        onConfirm: () => {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          resetAllStudioFields();
        }
      });
      return;
    }
    resetAllStudioFields();
  }

  function resetAllStudioFields() {
    setCustomerName('');
    setCustomerPhone('');
    setCustomerEmail('');
    setCustomerAddress('');
    setSelectedCustomerId(null);
    setCustomerError('');
    setItems([]);
    setDiscountPercent(0);
    setDiscountAmountManual('');
    setDeliveryCharges('');
    setCreatedQuotation(null);
    showToast('✓ Quotation studio cleared');
  }

  // Create Quotation Handler with IDEMPOTENCY & REPEATED CLICK DEFENSE
  async function handleSubmitQuotation(e) {
    if (e) e.preventDefault();
    if (isSubmitting) return; // Prevent repeated double-clicks

    if (!customerName.trim()) {
      setCustomerNameTouched(true);
      setCustomerError('Customer Name is required.');
      document.getElementById('customer-name-input')?.focus();
      return;
    }
    if (customerPhone.replace(/\D/g, '').length < 10) {
      setCustomerPhoneTouched(true);
      setCustomerError('A valid 10-digit mobile number is required for quotation sharing.');
      document.getElementById('customer-phone-input')?.focus();
      return;
    }
    if (items.length === 0) {
      setItemsError('Please add at least one product item to the quotation.');
      document.getElementById('search-products-card')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    const invalidQtyIndex = items.findIndex(it => !it.quantity || parseFloat(it.quantity) <= 0);
    if (invalidQtyIndex !== -1) {
      setItemsError(`Item #${invalidQtyIndex + 1} (${items[invalidQtyIndex].item_name}) has invalid quantity. Please specify at least 1.`);
      setHighlightedRowIndex(invalidQtyIndex);
      return;
    }

    try {
      setIsSubmitting(true);
      setCustomerError('');
      setItemsError('');

      const payload = {
        customer_id: selectedCustomerId,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        customer_email: customerEmail.trim(),
        customer_address: customerAddress.trim(),
        is_tax_inclusive: true,
        items: items.map(it => {
          let finalDetails = it.details || '';
          if (it.customer_req && it.customer_req.trim() && !finalDetails.includes(it.customer_req.trim())) {
            finalDetails = finalDetails ? `${finalDetails} • ${it.customer_req.trim()}` : it.customer_req.trim();
          }
          return {
            product_id: it.product_id,
            item_name: it.item_name,
            details: finalDetails,
            hsn_sac: it.hsn_sac,
            unit: it.unit || 'Nos',
            quantity: Math.max(0.01, parseFloat(it.quantity) || 1),
            sale_rate: parseFloat(it.sale_rate) || 0
          };
        }),
        discount_percent: discountMode === 'percent' ? (parseFloat(discountPercent) || 0) : 0,
        gst_rate: gstRateVal,
        delivery_charges: deliveryVal,
        paper_format: paperFormat,
        validity_date: validityDate,
        notes: notes.trim(),
        status: 'Created'
      };

      let res;
      if (editingQuote?.id) {
        res = await api.updateQuotation(editingQuote.id, payload);
      } else {
        res = await api.createQuotation(payload);
      }

      if (res.success) {
        const fullQuoteRes = await api.getQuotation(res.id);
        setCreatedQuotation(fullQuoteRes.quotation);
        setShowPdfModal(true);
        if (editingQuote?.id && onCancelEdit) {
          onCancelEdit();
        }
      }
    } catch (err) {
      showToast('Error creating quotation: ' + (err.message || 'Failed to save quotation'), true);
    } finally {
      setIsSubmitting(false);
    }
  }

  // Filtered dropdown results based on ambiguous category pills and pack sizes
  const displayedQuickResults = quickSearchResults.filter(p => {
    if (selectedTypeFilter !== 'ALL') {
      const name = (p.item_name || '').toLowerCase();
      const pTypes = p.types || [];
      if (selectedTypeFilter === 'Enamel' && !(pTypes.includes('enamel') || name.includes('enamel') || name.includes(' en '))) return false;
      if (selectedTypeFilter === 'Emulsion' && !(pTypes.includes('emulsion') || name.includes('emulsion') || name.includes('apex') || name.includes('ace') || name.includes('tractor') || name.includes('royale'))) return false;
      if (selectedTypeFilter === 'Primer' && !(pTypes.includes('primer') || name.includes('primer') || name.includes(' ps ') || name.includes(' pr '))) return false;
      if (selectedTypeFilter === 'Putty' && !(pTypes.includes('putty') || name.includes('putty'))) return false;
      if (selectedTypeFilter === 'Brush' && !(pTypes.includes('brush') || name.includes('brush') || name.includes(' br '))) return false;
    }
    if (selectedSizeFilter !== 'ALL') {
      const pSpecs = p.specs || [];
      const nameUpper = (p.item_name || '').toUpperCase();
      const cleanName = nameUpper.replace(/[^A-Z0-9]/g, '');
      const cleanSpec = selectedSizeFilter.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const matchesSpec = pSpecs.includes(selectedSizeFilter) || nameUpper.includes(selectedSizeFilter.toUpperCase()) || cleanName.includes(cleanSpec);
      if (!matchesSpec) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 pb-24">
      {/* STUDIO HEADER */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-200">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className={`px-2 py-0.5 text-[10px] font-black uppercase rounded ${
                editingQuote ? 'bg-amber-400 text-amber-950' : 'bg-[#7DBA00] text-[#003B40]'
              }`}>
                {editingQuote ? 'Edit Mode' : 'Single-Page Studio'}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {editingQuote ? `Editing ${editingQuote.quotation_number}` : 'Tax-Inclusive Rate Sheet Grounded'}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[#00545C] mt-1">
              {editingQuote ? `Edit Quotation: ${editingQuote.quotation_number}` : 'Create Customer Quotation'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {editingQuote 
                ? `Update line items, rates, discounts, or customer information for quote ${editingQuote.quotation_number}`
                : 'Add products, edit quantities/units/details in real time, and generate single-page PDFs & WhatsApp quotes'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {editingQuote ? (
              <button
                type="button"
                onClick={() => {
                  if (onCancelEdit) onCancelEdit();
                  handleClearForm();
                }}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold transition-all cursor-pointer border border-amber-300"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel Edit</span>
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => setShowSmartParser(true)}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white text-xs font-bold shadow-xs active:scale-95 cursor-pointer transition-all"
              title="Paste WhatsApp text or customer messages to auto-match products"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>⚡ Paste WhatsApp Order</span>
            </button>

            <button
              type="button"
              onClick={() => setShowCatalogDrawer(true)}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-[#00545C] hover:bg-[#0A6D77] text-white text-xs font-bold shadow-xs active:scale-95 cursor-pointer transition-all"
            >
              <Layers className="w-3.5 h-3.5 text-[#7DBA00]" />
              <span>Browse Catalogue ({productCounts.total.toLocaleString()})</span>
            </button>

            <button
              type="button"
              onClick={handleClearForm}
              className="px-3 py-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 text-xs font-bold transition-colors cursor-pointer"
            >
              Clear Form
            </button>
          </div>
        </div>

        {/* Persistent Post-Creation CTA Banner */}
        {createdQuotation && (
          <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-white border-2 border-emerald-400 p-4 rounded-2xl shadow-sm flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                <Check className="w-5 h-5 font-black" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-slate-900 leading-tight">
                  Quotation <span className="font-mono text-[#00545C]">{createdQuotation.quotation_number}</span> Created Successfully!
                </h4>
                <p className="text-xs text-slate-600">
                  Customer: <strong>{createdQuotation.customer_name}</strong> • Amount: <strong className="font-mono text-[#00545C]">₹{Number(createdQuotation.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowPdfModal(true)}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-300 shadow-2xs transition-colors cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-[#00545C]" />
                <span>View PDF Preview</span>
              </button>

              <button
                type="button"
                onClick={() => setShowWaModal(true)}
                className="flex items-center space-x-1 px-3.5 py-1.5 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white text-xs font-bold shadow-2xs transition-all active:scale-95 cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5 text-white" />
                <span>Share WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => setActivePage('quotations')}
                className="flex items-center space-x-1.5 px-4 py-1.5 rounded-xl bg-[#00545C] hover:bg-[#003B40] text-white text-xs font-extrabold shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                <span>Go to Quotes Register</span>
                <ArrowRight className="w-3.5 h-3.5 text-emerald-300" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* EDIT MODE ACTIVE NOTICE BANNER */}
      {editingQuote && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm animate-in fade-in">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-200 text-amber-900 flex items-center justify-center font-black">
              <Edit3 className="w-5 h-5 text-amber-800" />
            </div>
            <div>
              <div className="text-xs font-black text-amber-900 uppercase tracking-wider flex items-center space-x-2">
                <span>Currently Editing: {editingQuote.quotation_number}</span>
                <span className="text-[10px] bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-bold">
                  {editingQuote.status || 'Created'}
                </span>
              </div>
              <div className="text-xs text-amber-700 mt-0.5">
                Originally created on {editingQuote.quotation_date} for {editingQuote.customer_name}. Click "Update & Save Quotation" to save changes.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (onCancelEdit) onCancelEdit();
              handleClearForm();
            }}
            className="px-3.5 py-1.5 rounded-xl bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 text-xs font-bold shadow-xs transition-all cursor-pointer whitespace-nowrap"
          >
            ✕ Exit Edit Mode
          </button>
        </div>
      )}

      {/* SECTION 1: CUSTOMER DETAILS & QUOTATION METADATA */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4">
        
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <User className="w-4 h-4 text-[#00545C]" />
            <h2 className="text-sm font-extrabold text-slate-900">Customer & Quotation Profile</h2>
          </div>

          {/* Paper Format Selector */}
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl text-xs">
            <button
              type="button"
              onClick={() => setPaperFormat('A4')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                paperFormat === 'A4' ? 'bg-[#00545C] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              A4 Full Page
            </button>
            <button
              type="button"
              onClick={() => setPaperFormat('A5')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                paperFormat === 'A5' ? 'bg-[#00545C] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              A5 Compact
            </button>
          </div>
        </div>

        {customerError && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-2.5 rounded-xl text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="font-bold">{customerError}</span>
          </div>
        )}

        {/* Existing Customer Quick Search Dropdown */}
        <div className="relative">
          <div className="flex items-center space-x-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="Search registered customers by name or mobile number..."
                className="w-full pl-8 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00545C]"
              />
            </div>
            {selectedCustomerId && (
              <span className="text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-1 rounded-lg">
                ✓ Registered Client #{selectedCustomerId}
              </span>
            )}
          </div>

          {customerSearch.trim() && (
            <div className="absolute left-0 right-0 top-9 z-30 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-100">
              {existingCustomers
                .filter(c => 
                  c.name.toLowerCase().includes(customerSearch.toLowerCase()) || 
                  c.phone.includes(customerSearch)
                )
                .map(cust => (
                  <div
                    key={cust.id}
                    onClick={() => handleSelectExistingCustomer(cust)}
                    className="p-2.5 text-xs hover:bg-slate-50 cursor-pointer flex items-center justify-between"
                  >
                    <div>
                      <span className="font-bold text-slate-900">{cust.name}</span>
                      <span className="text-slate-500 ml-2">({cust.phone})</span>
                    </div>
                    <span className="text-[10px] font-bold text-[#00545C] bg-emerald-50 px-2 py-0.5 rounded">
                      Use Customer
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Input Fields Grid with Real-time Error Highlighting & Helper Guidance */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-slate-700">
                Customer Name <span className="text-rose-500">*</span>
              </label>
              {customerNameTouched && (
                isNameValid ? (
                  <span className="text-[10px] text-emerald-600 font-bold flex items-center space-x-0.5">
                    <Check className="w-3 h-3" /> <span>Valid</span>
                  </span>
                ) : (
                  <span className="text-[10px] text-rose-500 font-bold">Required</span>
                )
              )}
            </div>
            <input
              id="customer-name-input"
              type="text"
              value={customerName}
              onChange={(e) => { setCustomerName(e.target.value); setCustomerError(''); }}
              onBlur={() => setCustomerNameTouched(true)}
              placeholder="e.g. Ramesh Builders / Kumar"
              className={`w-full px-3 py-2 border rounded-xl font-semibold text-slate-900 transition-all focus:outline-none focus:ring-2 ${
                customerNameTouched && !isNameValid
                  ? 'border-rose-400 bg-rose-50/40 focus:ring-rose-200'
                  : 'border-slate-300 focus:border-[#00545C] focus:ring-[#00545C]/20'
              }`}
              required
            />
            {customerNameTouched && !isNameValid && (
              <p className="text-[11px] text-rose-600 font-medium mt-1">
                ⚠️ Customer name is required.
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-slate-700">
                Mobile / WhatsApp <span className="text-rose-500">*</span>
              </label>
              {customerPhoneTouched && (
                isPhoneValid ? (
                  <span className="text-[10px] text-emerald-600 font-bold flex items-center space-x-0.5">
                    <Check className="w-3 h-3" /> <span>Valid (10 digits)</span>
                  </span>
                ) : (
                  <span className="text-[10px] text-rose-500 font-bold">10 digits required</span>
                )
              )}
            </div>
            <input
              id="customer-phone-input"
              type="tel"
              value={customerPhone}
              onChange={(e) => { setCustomerPhone(e.target.value); setCustomerError(''); }}
              onBlur={() => setCustomerPhoneTouched(true)}
              placeholder="e.g. 98427 11223"
              className={`w-full px-3 py-2 border rounded-xl font-mono font-bold text-slate-900 transition-all focus:outline-none focus:ring-2 ${
                customerPhoneTouched && !isPhoneValid
                  ? 'border-rose-400 bg-rose-50/40 focus:ring-rose-200'
                  : 'border-slate-300 focus:border-[#00545C] focus:ring-[#00545C]/20'
              }`}
              required
            />
            {customerPhoneTouched && !isPhoneValid && (
              <p className="text-[11px] text-rose-600 font-medium mt-1">
                ⚠️ Please enter a valid 10-digit mobile number.
              </p>
            )}
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Email Address <span className="font-normal text-slate-400">(Optional)</span>
            </label>
            <input
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="client@gmail.com"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00545C]/20 focus:border-[#00545C]"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Validity Until Date
            </label>
            <input
              type="date"
              value={validityDate}
              onChange={(e) => setValidityDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00545C]/20 focus:border-[#00545C]"
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-4">
            <label className="block font-bold text-slate-700 mb-1">
              Site / Delivery Address <span className="font-normal text-slate-400">(Printed on Quotation PDF)</span>
            </label>
            <input
              type="text"
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
              placeholder="e.g. Site 44, Perundurai SIPCOT Road, Erode - 638052"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00545C]/20 focus:border-[#00545C]"
            />
          </div>
        </div>

      </div>

      {/* SECTION 2: QUOTATION LINE ITEMS TABLE */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-black text-slate-900 flex items-center space-x-2">
              <span>Quotation Items</span>
              <span className="bg-[#00545C] text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                {items.length} {items.length === 1 ? 'item' : 'items'}
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Live rate sheet pricing with instant product search, spec tags, and editable quantities
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setShowSmartParser(true)}
              className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300 flex items-center space-x-1.5 transition-all cursor-pointer shadow-2xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Paste WhatsApp Order</span>
            </button>

            <button
              type="button"
              onClick={handleAddBlankItem}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-200 flex items-center space-x-1.5 transition-all cursor-pointer shadow-2xs"
              title="Add a manual entry row to type custom items directly"
            >
              <Plus className="w-3.5 h-3.5 text-[#00545C]" />
              <span>+ Add Blank Item</span>
            </button>

            <button
              type="button"
              onClick={() => setShowCatalogDrawer(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-200 flex items-center space-x-1 transition-all cursor-pointer shadow-2xs"
            >
              <Layers className="w-3.5 h-3.5 text-[#00545C]" />
              <span>Browse Catalogue</span>
            </button>

            {items.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setConfirmDialog({
                    isOpen: true,
                    title: 'Remove All Items',
                    message: 'Are you sure you want to remove all product items from this quotation?',
                    confirmText: 'Remove All',
                    cancelText: 'Keep Items',
                    type: 'danger',
                    onConfirm: () => {
                      setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                      setItems([]);
                      showToast('✓ All items removed');
                    }
                  });
                }}
                className="text-xs font-semibold text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-2 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Clean Inline Search Bar for quick product addition */}
        <div ref={searchContainerRef} className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={quickSearchQuery}
            onChange={(e) => {
              setQuickSearchQuery(e.target.value);
              setActiveDropdownIndex(-1);
            }}
            onKeyDown={handleSearchKeyDown}
            onFocus={() => { if (quickSearchResults.length > 0) setShowQuickDropdown(true); }}
            placeholder="Type to search and add products... (e.g. 'Apex 20lt', 'White 1lt', 'Putty 40kg', 'Brush 2&quot;', 'Dr Fixit 302')"
            className="w-full pl-10 pr-10 py-2.5 bg-slate-50 hover:bg-white focus:bg-white text-slate-900 text-xs sm:text-sm font-semibold rounded-xl border border-slate-300 focus:border-[#00545C] focus:ring-2 focus:ring-[#00545C]/20 focus:outline-none transition-all shadow-2xs"
          />
          {isSearchingQuick ? (
            <div className="absolute right-3.5 top-2.5 text-[#00545C]">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          ) : quickSearchQuery ? (
            <button
              type="button"
              onClick={() => { setQuickSearchQuery(''); setShowQuickDropdown(false); setActiveDropdownIndex(-1); }}
              className="absolute right-3.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          ) : null}

          {/* Clean Floating Autocomplete Dropdown */}
          {showQuickDropdown && (
            <div className="absolute left-0 right-0 top-11 z-40 bg-white border border-slate-200 rounded-2xl shadow-2xl max-h-80 overflow-y-auto divide-y divide-slate-100 mt-1">
              <div className="bg-slate-50 px-3 py-1.5 text-[11px] text-slate-500 font-medium flex items-center justify-between sticky top-0 z-10 border-b border-slate-100">
                <span>Found {displayedQuickResults.length} matching products</span>
                <span>Press Enter to add, Esc to close</span>
              </div>
              {displayedQuickResults.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500">
                  No products found for "{quickSearchQuery}". Try another keyword or browse the full catalogue.
                </div>
              ) : (
                displayedQuickResults.map((prod, pIdx) => {
                  const alreadyIndex = items.findIndex(it => it.product_id === prod.id);
                  const isAlreadyAdded = alreadyIndex !== -1;
                  const alreadyQty = isAlreadyAdded ? items[alreadyIndex].quantity : 0;
                  const isHighlighted = activeDropdownIndex === pIdx;
                  const specs = prod.structuredDetails;

                  return (
                    <div
                      key={prod.id}
                      onClick={() => handleAddProduct(prod)}
                      className={`p-3 cursor-pointer flex items-center justify-between gap-3 text-slate-900 transition-colors ${
                        isHighlighted
                          ? 'bg-teal-50 border-l-4 border-l-[#00545C]'
                          : isAlreadyAdded
                          ? 'bg-amber-50/40 hover:bg-amber-50'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="font-extrabold text-xs sm:text-sm text-slate-900 truncate">
                            {prod.item_name}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          {specs?.brand && (
                            <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                              {specs.brand}
                            </span>
                          )}
                          {specs?.packSize && (
                            <span className="text-[10px] font-black text-[#00545C] bg-teal-50 px-1.5 py-0.2 rounded border border-teal-200">
                              {specs.packSize}
                            </span>
                          )}
                          {specs?.category && (
                            <span className="text-[10px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded">
                              {specs.category}
                            </span>
                          )}
                          {specs?.colour && (
                            <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded">
                              {specs.colour}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400">
                            Unit: {prod.main_unit || 'Nos'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 flex-shrink-0">
                        <div className="text-right">
                          <div className="font-mono font-black text-sm text-[#00545C]">
                            ₹{Number(prod.sale_rate).toFixed(2)}
                          </div>
                          <span className="text-[9px] text-emerald-700 font-bold bg-emerald-50 px-1 py-0.2 rounded">
                            Incl. GST
                          </span>
                        </div>
                        {isAlreadyAdded ? (
                          <span className="px-2 py-1 rounded bg-amber-100 text-amber-900 font-bold text-xs border border-amber-300">
                            In Quote ({alreadyQty})
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="px-3 py-1 rounded-lg bg-[#00545C] hover:bg-[#003B40] text-white font-bold text-xs shadow-2xs"
                          >
                            + Add
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {itemsError && (
          <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 text-xs font-bold flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{itemsError}</span>
          </div>
        )}

        {/* Empty State */}
        {items.length === 0 ? (
          <div className="py-12 px-4 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 text-[#00545C] font-black flex items-center justify-center mx-auto">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">Your Quotation is Empty</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                Type customer requirements in the search box above (e.g. <i>white 1lt</i>, <i>golden brown 1ltr</i>, <i>brush 2"</i>), or browse official Excel items.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCatalogDrawer(true)}
                className="px-4 py-2 rounded-xl bg-[#00545C] hover:bg-[#0A6D77] text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                + Browse Official Catalogue
              </button>
              <button
                type="button"
                onClick={() => setShowSmartParser(true)}
                className="px-4 py-2 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                ⚡ Paste WhatsApp Order
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#00545C] text-white text-[11px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-3 text-center w-12">#</th>
                  <th className="py-3 px-4 min-w-[240px]">Product & Specifications</th>
                  <th className="py-3 px-3 min-w-[170px]">Customer Notes / Shade</th>
                  <th className="py-3 px-2 text-center w-24">Unit</th>
                  <th className="py-3 px-3 text-center w-36">Quantity</th>
                  <th className="py-3 px-3 text-right w-28">Rate (₹)</th>
                  <th className="py-3 px-4 text-right w-32">Total (₹)</th>
                  <th className="py-3 px-2 text-center w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item, idx) => {
                  const isHighlighted = highlightedRowIndex === idx;
                  const isQtyInvalid = !item.quantity || parseFloat(item.quantity) <= 0;

                  return (
                    <tr 
                      key={idx} 
                      id={`quote-row-${idx}`}
                      className={`transition-all duration-300 ${
                        isHighlighted 
                          ? 'bg-amber-100/90 ring-2 ring-amber-500 font-bold' 
                          : idx % 2 === 0 
                          ? 'bg-white hover:bg-slate-50/80' 
                          : 'bg-slate-50/50 hover:bg-slate-100/60'
                      }`}
                    >
                      {/* Row Index */}
                      <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-xs">
                        {idx + 1}
                      </td>

                      {/* Product Name & Specifications Badge */}
                      <td className="py-2.5 px-4">
                        {item.product_id === null ? (
                          <input
                            type="text"
                            value={item.item_name}
                            onChange={(e) => {
                              const val = e.target.value;
                              setItems(prev => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], item_name: val };
                                return next;
                              });
                            }}
                            placeholder="Type custom product name or service..."
                            className="w-full px-2.5 py-1 text-xs font-bold border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#00545C]"
                          />
                        ) : (
                          <p className="font-extrabold text-slate-900 text-xs sm:text-sm leading-snug">
                            {item.item_name}
                          </p>
                        )}
                        {item.details && (
                          <div className="mt-1 inline-block bg-slate-100 text-slate-700 text-[11px] font-medium px-2 py-0.5 rounded border border-slate-200/80">
                            {item.details}
                          </div>
                        )}
                        {item.hsn_sac && (
                          <span className="block font-mono text-[10px] text-slate-400 mt-0.5">
                            HSN/SAC: {item.hsn_sac}
                          </span>
                        )}
                        {item.availableSizes && item.availableSizes.length > 1 && (
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              Sizes:
                            </span>
                            {item.availableSizes.map(sz => {
                              const isCurrentSize = sz.id === item.product_id || sz.item_name === item.item_name;
                              return (
                                <button
                                  key={sz.id}
                                  type="button"
                                  onClick={() => handleSwitchRowPackSize(idx, sz)}
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer flex items-center space-x-1 ${
                                    isCurrentSize
                                      ? 'bg-[#00545C] text-white shadow-2xs'
                                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                                  }`}
                                  title={`Switch to ${sz.item_name} (₹${sz.sale_rate})`}
                                >
                                  <span>{sz.packSize}</span>
                                  <span className={`font-mono text-[9px] ${isCurrentSize ? 'text-teal-200' : 'text-slate-500'}`}>
                                    ₹{sz.sale_rate}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </td>

                      {/* Customer Requirement / Custom Shade Input */}
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={item.customer_req || ''}
                          onChange={(e) => updateItemCustomerReq(idx, e.target.value)}
                          placeholder="e.g. Shade 4202 / Req: 1lt white"
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#00545C] focus:border-[#00545C]"
                        />
                      </td>

                      {/* Unit Dropdown / Editable */}
                      <td className="py-2 px-2 text-center">
                        <div className="relative">
                          <input
                            type="text"
                            list={`unit-options-${idx}`}
                            value={item.unit || 'Nos'}
                            onChange={(e) => updateItemUnit(idx, e.target.value)}
                            className="w-20 text-center font-bold text-xs py-1 px-1.5 border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#00545C]"
                            title="Click to edit unit (e.g. Nos, Ltr, Kg, Box, Bag, Can)"
                          />
                          <datalist id={`unit-options-${idx}`}>
                            {COMMON_UNITS.map(u => (
                              <option key={u} value={u} />
                            ))}
                          </datalist>
                        </div>
                      </td>

                      {/* QUANTITY INPUT WITH STEPPER BUTTONS & ERROR HIGHLIGHT */}
                      <td className="py-2 px-3 text-center">
                        <div className={`inline-flex items-center space-x-1 bg-white border rounded-lg p-0.5 shadow-2xs ${
                          isQtyInvalid ? 'border-rose-400 ring-2 ring-rose-200' : 'border-slate-300'
                        }`}>
                          <button
                            type="button"
                            onClick={() => stepQuantity(idx, -1)}
                            className="w-7 h-7 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-sm flex items-center justify-center cursor-pointer transition-colors"
                            title="Decrease quantity by 1"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            step="any"
                            min="0.01"
                            value={item.quantity === 0 ? '' : item.quantity}
                            onChange={(e) => updateItemQuantity(idx, e.target.value)}
                            onBlur={() => normalizeItemQuantityOnBlur(idx)}
                            className="w-16 text-center font-mono font-black text-sm py-0.5 px-1 bg-transparent text-slate-900 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => stepQuantity(idx, 1)}
                            className="w-7 h-7 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-sm flex items-center justify-center cursor-pointer transition-colors"
                            title="Increase quantity by 1"
                          >
                            +
                          </button>
                        </div>
                        {isQtyInvalid && (
                          <span className="block text-[9px] text-rose-600 font-bold mt-0.5">Min 1</span>
                        )}
                      </td>

                      {/* Sale Rate (₹ Incl. GST) */}
                      <td className="py-2 px-3 text-right">
                        <div className="flex flex-col items-end">
                          <div className="flex items-center space-x-1">
                            <span className="text-[11px] text-slate-400">₹</span>
                            <input
                              type="number"
                              step="any"
                              min="0"
                              value={item.sale_rate}
                              onChange={(e) => updateItemRate(idx, e.target.value)}
                              className={`w-20 text-right font-mono font-bold text-xs py-1 px-1.5 border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#00545C] ${
                                item.is_overridden ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-slate-300 bg-white text-slate-900'
                              }`}
                            />
                          </div>
                          {item.is_overridden && (
                            <span className="text-[9px] text-amber-600 font-bold mt-0.5">
                              Overridden
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Line Total */}
                      <td className="py-2.5 px-4 text-right font-mono font-black text-sm text-[#00545C]">
                        ₹{Number(item.line_total || 0).toFixed(2)}
                      </td>

                      {/* Delete Action */}
                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Remove product"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* SECTION 4: FINANCIAL SUMMARY & TERMS & PAYMENT UPI QR */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (7 cols): Terms, Bank Details, and Payment UPI QR */}
        <div className="lg:col-span-7 space-y-5">
          
          {/* Payment UPI QR Code Card */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
            <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
              <QrCode className="w-4 h-4 text-[#00545C]" />
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                Payment UPI QR & Bank Settlement
              </h3>
            </div>

            <div className="flex items-center space-x-4 pt-3">
              <div className="w-20 h-20 bg-slate-50 border border-slate-200 rounded-xl p-1 flex items-center justify-center flex-shrink-0">
                <img
                  src={`/uploads/qr/${settings?.payment_qr_code || 'default_upi_qr.png'}`}
                  alt="UPI QR Code"
                  className="max-h-full max-w-full object-contain"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = '/uploads/qr/default_upi_qr.png';
                  }}
                />
              </div>

              <div className="flex-1 min-w-0 text-xs space-y-1">
                <p className="font-bold text-slate-900">
                  {settings?.bank_name || 'Indian Bank'} • {settings?.bank_branch || 'Perundurai'}
                </p>
                <p className="font-mono text-slate-600">
                  A/c No: <b>{settings?.bank_account_no || '6659330152'}</b> • IFSC: <b>{settings?.bank_ifsc || 'IDIB000P034'}</b>
                </p>
                <div className="flex items-center space-x-2 pt-0.5">
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    UPI: 9715622499@okbizaxis
                  </span>
                  <span className="text-[10px] text-slate-400">Printed on customer PDF</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quotation Terms & Conditions */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
              Quotation Terms & Delivery Notes
            </h3>
            <textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Terms and conditions printed at the bottom of the quotation..."
              className="w-full p-3 font-mono text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00545C]"
            />
          </div>

        </div>

        {/* Right Column (5 cols): Live Calculations & Grand Total */}
        <div className="lg:col-span-5">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4 sticky top-24">
            
            <h3 className="text-sm font-black text-slate-900 border-b border-slate-100 pb-3 flex items-center justify-between">
              <span>Financial Summary</span>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full">
                GST Included in Rates
              </span>
            </h3>

            <div className="space-y-3 text-xs">
              
              {/* Gross Subtotal */}
              <div className="flex justify-between items-center text-slate-600">
                <span>Subtotal ({items.length} items)</span>
                <span className="font-mono font-bold text-slate-900 text-sm">{formatCurrency(grossSubtotal)}</span>
              </div>

              {/* Discount Controls */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700">Customer Discount</span>
                  <div className="flex items-center space-x-1 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setDiscountMode('percent')}
                      className={`px-2 py-0.5 rounded font-bold cursor-pointer ${
                        discountMode === 'percent' ? 'bg-[#00545C] text-white' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      Percent (%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountMode('amount')}
                      className={`px-2 py-0.5 rounded font-bold cursor-pointer ${
                        discountMode === 'amount' ? 'bg-[#00545C] text-white' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      Flat (₹)
                    </button>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {discountMode === 'percent' ? (
                    <div className="flex-1 flex items-center space-x-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={discountPercent}
                        onChange={(e) => setDiscountPercent(e.target.value)}
                        placeholder="0"
                        className="w-20 px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white font-bold"
                      />
                      <span className="text-slate-500 font-bold">% Discount</span>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center space-x-2">
                      <span className="text-slate-400 font-bold">₹</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={discountAmountManual}
                        onChange={(e) => setDiscountAmountManual(e.target.value)}
                        placeholder="0.00"
                        className="flex-1 px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white font-bold"
                      />
                    </div>
                  )}
                  <span className="font-mono font-bold text-rose-600 text-xs">
                    − {formatCurrency(computedDiscount)}
                  </span>
                </div>
              </div>

              {/* Taxable Value & GST 18% Breakdown */}
              <div className="border-t border-slate-100 pt-2 space-y-1 text-slate-500 text-[11px]">
                <div className="flex justify-between">
                  <span>Net Taxable Base:</span>
                  <span className="font-mono text-slate-700">{formatCurrency(taxableBase)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Included GST ({gstRateVal}%):</span>
                  <span className="font-mono text-emerald-700 font-semibold">{formatCurrency(includedGst)}</span>
                </div>
              </div>

              {/* Delivery / Transport Charges */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-slate-600">Transport / Delivery (₹)</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={deliveryCharges}
                  onChange={(e) => setDeliveryCharges(e.target.value)}
                  placeholder="0.00"
                  className="w-24 text-right px-2 py-1 border border-slate-300 rounded-lg bg-white text-xs font-mono font-bold text-slate-900"
                />
              </div>

              {/* GRAND TOTAL */}
              <div className="bg-[#00545C] text-white p-5 rounded-2xl shadow-sm space-y-1.5 mt-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Grand Total (INR)
                  </span>
                  <span className="text-xl sm:text-2xl font-black font-mono text-white">
                    {formatCurrency(grandTotal)}
                  </span>
                </div>
                <p className="text-[10px] text-teal-100 italic pt-1.5 border-t border-teal-700/60 leading-tight">
                  {numberToIndianWords(grandTotal)}
                </p>
              </div>

            </div>

            {/* Submit Action Button with IDEMPOTENCY DEFENSE */}
            <button
              type="button"
              disabled={isSubmitting || items.length === 0}
              onClick={handleSubmitQuotation}
              className={`w-full py-3.5 px-4 rounded-xl text-sm font-black shadow-md transition-all transform flex items-center justify-center space-x-2 cursor-pointer ${
                items.length > 0 && !isSubmitting
                  ? editingQuote 
                    ? 'bg-amber-600 hover:bg-amber-700 text-white active:scale-95 shadow-amber-600/20'
                    : 'bg-[#00545C] hover:bg-[#003B40] text-white active:scale-95 shadow-[#00545C]/20'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{editingQuote ? 'Updating Quotation…' : 'Generating Quotation…'}</span>
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  <span>{editingQuote ? `✓ Update & Save Quotation (${editingQuote.quotation_number})` : '✓ Create Quotation & Preview PDF'}</span>
                </>
              )}
            </button>

          </div>
        </div>

      </div>

      {/* STICKY BOTTOM ACTION BAR */}
      <div className="fixed bottom-0 left-0 md:left-64 lg:left-72 right-0 bg-white border-t border-slate-200 p-3 sm:p-4 z-20 shadow-2xl flex items-center justify-between gap-4 no-print">
        <div className="flex items-center space-x-3">
          <div className="hidden sm:block">
            <span className="text-xs text-slate-500 font-bold block">Quotation Summary</span>
            <span className="text-xs font-black text-slate-900">
              {items.length} {items.length === 1 ? 'item' : 'items'} • Customer: {customerName || 'None'}
            </span>
          </div>
          <div className="sm:border-l sm:border-slate-200 sm:pl-3">
            <span className="text-[10px] text-slate-400 block sm:inline">Grand Total: </span>
            <span className="font-mono font-black text-base text-[#00545C]">
              {formatCurrency(grandTotal)}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setShowSmartParser(true)}
            className="hidden sm:flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>WhatsApp Text</span>
          </button>

          <button
            type="button"
            disabled={isSubmitting || items.length === 0}
            onClick={handleSubmitQuotation}
            className={`py-2 px-5 rounded-xl text-xs sm:text-sm font-black shadow-md transition-all transform flex items-center space-x-2 cursor-pointer ${
              items.length > 0 && !isSubmitting
                ? editingQuote
                  ? 'bg-amber-500 hover:bg-amber-600 text-white active:scale-95'
                  : 'bg-[#7DBA00] hover:bg-[#8ee000] text-[#003B40] active:scale-95'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{editingQuote ? 'Updating…' : 'Creating…'}</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>{editingQuote ? `✓ Update ${editingQuote.quotation_number}` : '✓ Generate Quotation'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* CATALOGUE BROWSER MODAL / DRAWER */}
      {showCatalogDrawer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs no-print animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
            
            {/* Drawer Header */}
            <div className="p-4 sm:p-5 bg-[#00545C] text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-white flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-[#7DBA00]" />
                  <span>Official Product Catalogue</span>
                </h3>
                <p className="text-xs text-emerald-200 mt-0.5">
                  Browse official Excel items from PAINTS & ACCESSORIES sections
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCatalogDrawer(false)}
                className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-[#003B40] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Controls: Section Tabs & Search */}
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="flex items-center space-x-1 bg-slate-200 p-1 rounded-xl w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setCatalogSection('PAINTS')}
                  className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    catalogSection === 'PAINTS' ? 'bg-[#00545C] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  PAINTS ({productCounts.paints.toLocaleString()})
                </button>
                <button
                  type="button"
                  onClick={() => setCatalogSection('ACCESS')}
                  className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    catalogSection === 'ACCESS' ? 'bg-[#00545C] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ACCESSORIES ({productCounts.access.toLocaleString()})
                </button>
              </div>

              <div className="flex items-center space-x-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-72">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    placeholder={`Search all ${catalogSection.toLowerCase()}...`}
                    className="w-full pl-8 pr-8 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00545C]"
                  />
                  {catalogSearch && (
                    <button
                      type="button"
                      onClick={() => setCatalogSearch('')}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <span className="text-[11px] font-bold text-slate-600 bg-slate-200 px-2.5 py-1.5 rounded-xl whitespace-nowrap">
                  {catalogProducts.length} items
                </span>
              </div>
            </div>

            {/* Products List in Catalogue */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2">
              {loadingCatalog ? (
                <div className="p-12 text-center text-slate-400 text-xs font-bold">
                  Loading catalogue products...
                </div>
              ) : catalogProducts.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-xs">
                  No products found matching "{catalogSearch}".
                </div>
              ) : (
                catalogProducts.map(p => {
                  const alreadyCount = items.filter(it => it.product_id === p.id).reduce((sum, it) => sum + (parseFloat(it.quantity) || 0), 0);
                  const isAdded = alreadyCount > 0;
                  return (
                    <div
                      key={p.id}
                      className="p-3 hover:bg-slate-50 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] font-mono text-slate-400">#{p.s_no}</span>
                          <span className="font-bold text-slate-900 text-sm truncate">{p.item_name}</span>
                        </div>
                        <div className="flex items-center space-x-2 mt-1 text-[11px] text-slate-500">
                          <span>Unit: <b>{p.main_unit}</b></span>
                          {p.hsn_sac && <span>• HSN: {p.hsn_sac}</span>}
                          <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded font-semibold text-[10px]">
                            GST Included
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 flex-shrink-0">
                        <div className="text-right">
                          <span className="font-mono font-black text-sm text-[#00545C] block">
                            ₹{Number(p.sale_rate).toFixed(2)}
                          </span>
                          <span className="text-[9px] text-slate-400">Sale Rate</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleAddProduct(p)}
                          className={`px-3 py-1.5 rounded-xl font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer flex items-center space-x-1 ${
                            isAdded
                              ? 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200'
                              : 'bg-[#7DBA00] hover:bg-[#8ee000] text-[#003B40]'
                          }`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{isAdded ? `In Quote (${alreadyCount})` : '+ Add'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}

              {/* Optional Load All Button for browsing entire section without searching */}
              {catalogProducts.length < (productCounts[catalogSection.toLowerCase()] || 0) && !catalogSearch.trim() && (
                <div className="p-4 text-center bg-slate-50 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => fetchCatalogProducts(true)}
                    className="px-4 py-2 rounded-xl bg-white border border-[#00545C] text-[#00545C] hover:bg-[#00545C] hover:text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    Load all {productCounts[catalogSection.toLowerCase()].toLocaleString()} {catalogSection} products &darr;
                  </button>
                </div>
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-600 font-bold">
                {items.length} item(s) currently in your quotation
              </span>
              <button
                type="button"
                onClick={() => setShowCatalogDrawer(false)}
                className="px-5 py-2 rounded-xl bg-[#00545C] hover:bg-[#0A6D77] text-white font-bold cursor-pointer"
              >
                Done / Back to Quotation
              </button>
            </div>

          </div>
        </div>
      )}

      {/* WHATSAPP SMART PARSER MODAL */}
      {showSmartParser && (
        <SmartParserModal
          onClose={() => setShowSmartParser(false)}
          onTransferToQuotation={(data) => {
            setShowSmartParser(false);
            applyImportData(data);
          }}
        />
      )}

      {/* SUCCESS / PDF VIEW MODAL */}
      {showPdfModal && createdQuotation && (
        <QuotationPdfModal
          quotation={createdQuotation}
          onClose={() => {
            setShowPdfModal(false);
          }}
          onGoToQuotes={() => {
            setShowPdfModal(false);
            setActivePage('quotations');
          }}
          onNewQuotation={() => {
            setShowPdfModal(false);
            handleClearForm();
          }}
          onShareWhatsApp={() => {
            setShowPdfModal(false);
            setShowWaModal(true);
          }}
          onShareEmail={() => {
            setShowPdfModal(false);
            setShowEmailModal(true);
          }}
        />
      )}

      {/* WHATSAPP SHARING MODAL */}
      {showWaModal && createdQuotation && (
        <WhatsAppShareModal
          quotation={createdQuotation}
          onClose={() => {
            setShowWaModal(false);
            setShowPdfModal(true);
          }}
        />
      )}

      {/* EMAIL SHARING MODAL */}
      {showEmailModal && createdQuotation && (
        <EmailShareModal
          quotation={createdQuotation}
          onClose={() => {
            setShowEmailModal(false);
            setShowPdfModal(true);
          }}
        />
      )}

      {/* Themed Confirmation & Reset Dialog */}
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
      {recentActionToast && (
        <div className={`fixed bottom-6 right-6 z-50 font-bold text-xs py-3 px-5 rounded-2xl shadow-2xl flex items-center space-x-2.5 border backdrop-blur-md animate-in slide-in-from-bottom-3 duration-200 ${
          recentActionToast.isError 
            ? 'bg-rose-950/95 text-rose-100 border-rose-700/80' 
            : 'bg-[#00545C]/95 text-[#7DBA00] border-[#7DBA00]/50'
        }`}>
          {recentActionToast.isError ? (
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-[#7DBA00] flex-shrink-0" />
          )}
          <span className="text-white tracking-wide">{recentActionToast.text}</span>
        </div>
      )}

    </div>
  );
}
