import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Search,
  Sparkles,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  FileText,
  Plus,
  Trash2,
  Printer,
  Download,
  Share2,
  RefreshCw,
  Copy,
  Check,
  Smartphone,
  Laptop,
  Mail,
  Send,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Upload,
  X,
  ShieldCheck,
  FileSpreadsheet
} from 'lucide-react';
import { api } from '../../api/client';
import { formatINR } from '../../utils/currency';
import { Badge, MatchStatusBadge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { ProductSelectorModal } from '../../components/ProductSelectorModal';

export function NewQuotation({
  quotationIdToLoad,
  activePriceList,
  onQuotationSaved,
  onNavigateToHistory
}) {
  // Quotation Header State
  const [quotationId, setQuotationId] = useState(quotationIdToLoad || null);
  const [quotationNumber, setQuotationNumber] = useState('');
  const [quotationStatus, setQuotationStatus] = useState('draft');
  const [approvalStatus, setApprovalStatus] = useState('pending_review');
  const [approvedBy, setApprovedBy] = useState(null);
  const [approvedAt, setApprovedAt] = useState(null);
  const [documentType, setDocumentType] = useState('gst_quotation');
  const [paperSize, setPaperSize] = useState('A5');
  const [validityDays, setValidityDays] = useState(7);
  const [paymentTerms, setPaymentTerms] = useState('Immediate / Against Delivery');
  const [deliveryTerms, setDeliveryTerms] = useState('Ex-Shop / Standard Local Delivery');
  const [deliveryCharges, setDeliveryCharges] = useState(0);
  const [otherCharges, setOtherCharges] = useState(0);
  const [notes, setNotes] = useState('1. Quotation valid for 7 days.\n2. Goods once sold will not be returned.\n3. Taxes as applicable.\n4. Subject to Perundurai jurisdiction.');

  // Logo Settings per Quotation
  const [logoSource, setLogoSource] = useState('default'); // 'default' | 'custom' | 'none'
  const [customLogoPath, setCustomLogoPath] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Customer Details State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerCompany, setCustomerCompany] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerGstin, setCustomerGstin] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState('');

  // WhatsApp Message Input & Parsing State
  const [rawMessage, setRawMessage] = useState('');
  const [parsing, setParsing] = useState(false);
  const [billWarning, setBillWarning] = useState(null);
  const [parseError, setParseError] = useState(null);

  // Line items state
  const [items, setItems] = useState([]);
  const [isStalePdf, setIsStalePdf] = useState(false);
  const [pdfFilename, setPdfFilename] = useState(null);

  // Product selector modal state
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [itemIndexToReplace, setItemIndexToReplace] = useState(null);

  // PDF Preview & WhatsApp share modal states
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfRefreshKey, setPdfRefreshKey] = useState(Date.now());
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);
  const [whatsappShareData, setWhatsappShareData] = useState(null);
  const [isSharingNative, setIsSharingNative] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [shareTab, setShareTab] = useState('whatsapp'); // 'whatsapp' | 'email'
  const [emailRecipient, setEmailRecipient] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSuccessMessage, setEmailSuccessMessage] = useState(null);
  const [emailErrorMessage, setEmailErrorMessage] = useState(null);

  // Official WhatsApp API Sending State
  const [sendingCloudWhatsApp, setSendingCloudWhatsApp] = useState(false);
  const [cloudWhatsAppSuccess, setCloudWhatsAppSuccess] = useState(null);
  const [cloudWhatsAppError, setCloudWhatsAppError] = useState(null);

  // Saving / Finalizing loading states
  const [saveLoading, setSaveLoading] = useState(false);
  const [finalizeLoading, setFinalizeLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Load quotation if quotationIdToLoad provided
  useEffect(() => {
    if (quotationIdToLoad) {
      loadQuotation(quotationIdToLoad);
    }
  }, [quotationIdToLoad]);

  async function loadQuotation(id) {
    try {
      setSaveLoading(true);
      const res = await api.getQuotation(id);
      const q = res.quotation;
      setQuotationId(q.id);
      setQuotationNumber(q.quotation_number);
      setQuotationStatus(q.status);
      setApprovalStatus(q.approval_status || 'pending_review');
      setApprovedBy(q.approved_by);
      setApprovedAt(q.approved_at);
      setDocumentType(q.document_type || 'gst_quotation');
      setPaperSize(q.paper_size || 'A5');
      setLogoSource(q.logo_source || 'default');
      setCustomLogoPath(q.custom_logo_path || null);
      setCustomerName(q.customer_name || '');
      setCustomerPhone(q.customer_phone || '');
      setCustomerEmail(q.customer_email || '');
      setCustomerCompany(q.customer_company || '');
      setCustomerAddress(q.customer_address || '');
      setCustomerGstin(q.customer_gstin || '');
      setReferenceNo(q.reference_no || '');
      setDeliveryLocation(q.delivery_location || '');
      setValidityDays(q.validity_days || 7);
      setPaymentTerms(q.payment_terms || 'Immediate / Against Delivery');
      setDeliveryTerms(q.delivery_terms || 'Ex-Shop / Standard Local Delivery');
      setDeliveryCharges(q.delivery_charges || 0);
      setOtherCharges(q.other_charges || 0);
      setNotes(q.notes || '');
      setRawMessage(q.raw_whatsapp_message || '');
      setPdfFilename(q.pdf_filename);
      setIsStalePdf(Boolean(q.is_stale_pdf));

      if (res.items && res.items.length > 0) {
        setItems(res.items);
      }
    } catch (err) {
      setActionError(err.message || 'Failed to load quotation.');
    } finally {
      setSaveLoading(false);
    }
  }

  // Handle WhatsApp Message Parsing
  async function handleParseMessage() {
    if (!rawMessage || !rawMessage.trim()) {
      setParseError('Please paste a WhatsApp message first.');
      return;
    }

    try {
      setParsing(true);
      setParseError(null);
      setBillWarning(null);

      const res = await api.parseMessage({
        message: rawMessage,
        priceListId: activePriceList?.id
      });

      if (res.isBillLookup) {
        setBillWarning(res.warning);
        return;
      }

      // Populate extracted customer details if available and currently blank
      if (res.customerDetails) {
        if (!customerName && res.customerDetails.customerName) {
          setCustomerName(res.customerDetails.customerName);
        }
        if (!customerPhone && res.customerDetails.customerPhone) {
          setCustomerPhone(res.customerDetails.customerPhone);
        }
      }

      // Pre-select document type if customer explicitly requested it
      if (res.documentType) {
        setDocumentType(res.documentType);
      }
      if (res.paperSize) {
        setPaperSize(res.paperSize);
      }

      // Convert parsed matched items to quotation line items
      const newLines = (res.items || []).map((m, idx) => {
        const prod = m.matchedProduct;
        return {
          id: `tmp-${Date.now()}-${idx}`,
          product_id: prod ? prod.id : null,
          item_code: prod ? prod.item_code : '',
          product_name: prod ? prod.product_name : (m.productName || m.rawPhrase),
          specification: prod ? (prod.specification || m.specification) : (m.specification || ''),
          hsn_code: prod ? prod.hsn_code : '',
          quantity: m.quantity || 1,
          isQuantityMissing: m.isQuantityMissing || false,
          unit: m.unit || (prod ? prod.unit : 'Nos'),
          isUnitMissing: m.isUnitMissing || false,
          unit_price: prod && prod.sales_rate ? prod.sales_rate : 0,
          discount_percent: 0,
          gst_rate: prod ? prod.gst_rate : 18,
          matchStatus: m.matchStatus,
          confidence: m.confidence,
          explanation: m.explanation,
          candidates: m.candidates || [],
          rawPhrase: m.rawPhrase
        };
      });

      setItems(newLines);
      setIsStalePdf(true);
    } catch (err) {
      setParseError(err.message || 'Error parsing message.');
    } finally {
      setParsing(false);
    }
  }

  // Quick preset sample message
  function insertSampleMessage(text) {
    setRawMessage(text);
  }

  // Add blank item row or from price list
  function handleAddBlankItem() {
    setSelectorOpen(true);
    setItemIndexToReplace(null);
  }

  // Add custom unlisted product directly without price list lookup
  function handleAddCustomItem() {
    const newItem = {
      id: `custom-${Date.now()}`,
      product_id: null,
      item_code: '',
      product_name: '',
      specification: '',
      hsn_code: '',
      quantity: 1,
      unit: 'Nos',
      unit_price: 0,
      discount_percent: 0,
      gst_rate: 18,
      matchStatus: 'Manual Entry',
      confidence: 100,
      candidates: []
    };
    setItems(prev => [...prev, newItem]);
    setIsStalePdf(true);
  }

  // Open product selector for existing row
  function handleOpenChangeProduct(index) {
    setItemIndexToReplace(index);
    setSelectorOpen(true);
  }

  // Product selection callback
  function handleProductSelected(product) {
    if (itemIndexToReplace !== null && items[itemIndexToReplace]) {
      const updated = [...items];
      updated[itemIndexToReplace] = {
        ...updated[itemIndexToReplace],
        product_id: product.id,
        item_code: product.item_code,
        product_name: product.product_name,
        specification: product.specification || '',
        hsn_code: product.hsn_code,
        unit: product.unit || 'Nos',
        unit_price: product.sales_rate || 0,
        gst_rate: product.gst_rate || 18,
        matchStatus: 'Exact Match',
        confidence: 100,
        candidates: []
      };
      setItems(updated);
    } else {
      const newItem = {
        id: `manual-${Date.now()}`,
        product_id: product.id,
        item_code: product.item_code,
        product_name: product.product_name,
        specification: product.specification || '',
        hsn_code: product.hsn_code,
        quantity: 1,
        unit: product.unit || 'Nos',
        unit_price: product.sales_rate || 0,
        discount_percent: 0,
        gst_rate: product.gst_rate || 18,
        matchStatus: 'Exact Match',
        confidence: 100,
        candidates: []
      };
      setItems([...items, newItem]);
    }
    setIsStalePdf(true);
  }

  // Remove line item
  function handleRemoveItem(index) {
    setItems(items.filter((_, i) => i !== index));
    setIsStalePdf(true);
  }

  // Update item field (quantity, price, unit, discount, gst)
  function handleItemChange(index, field, value) {
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      [field]: value
    };
    if (field === 'quantity') {
      updated[index].isQuantityMissing = false;
    }
    if (field === 'unit') {
      updated[index].isUnitMissing = false;
    }
    setItems(updated);
    setIsStalePdf(true);
  }

  // Handle Logo Source Change
  async function handleLogoSourceChange(source) {
    setLogoSource(source);
    setIsStalePdf(true);
    if (quotationId) {
      try {
        await api.updateQuotationLogoSource(quotationId, source);
      } catch (err) {
        console.error('Failed to update logo source:', err);
      }
    }
  }

  // Handle Custom Logo Upload for this quotation
  async function handleCustomLogoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!quotationId) {
      setActionError('Please save the quotation draft first before uploading a custom logo.');
      return;
    }

    try {
      setUploadingLogo(true);
      const res = await api.uploadQuotationCustomLogo(quotationId, file);
      setCustomLogoPath(res.custom_logo_path);
      setLogoSource('custom');
      setIsStalePdf(true);
      setActionMessage('Custom quotation logo uploaded successfully!');
    } catch (err) {
      setActionError(err.message || 'Failed to upload custom logo.');
    } finally {
      setUploadingLogo(false);
    }
  }

  // Calculations
  const calculatedItems = items.map((item) => {
    const qty = Math.max(0, Number(item.quantity || 0));
    const rate = Math.max(0, Number(item.unit_price || 0));
    const disc = Math.min(100, Math.max(0, Number(item.discount_percent || 0)));
    const gst = Math.max(0, Number(item.gst_rate !== undefined ? item.gst_rate : 18));

    const gross = qty * rate;
    const discountAmount = gross * (disc / 100);
    const discounted = gross - discountAmount;

    // Sales rate is tax inclusive in Udhayam standard format
    const taxable = discounted / (1 + gst / 100);
    const gstAmount = discounted - taxable;
    const lineTotal = discounted;

    return {
      ...item,
      taxableAmount: taxable,
      gstAmount,
      lineTotal
    };
  });

  const subtotal = calculatedItems.reduce((acc, it) => acc + (it.quantity * it.unit_price), 0);
  const discountTotal = calculatedItems.reduce((acc, it) => acc + ((it.quantity * it.unit_price) * (it.discount_percent / 100)), 0);
  const taxableAmount = calculatedItems.reduce((acc, it) => acc + it.taxableAmount, 0);
  const taxTotal = calculatedItems.reduce((acc, it) => acc + it.gstAmount, 0);
  const grandTotal = calculatedItems.reduce((acc, it) => acc + it.lineTotal, 0) + Number(deliveryCharges || 0) + Number(otherCharges || 0);

  // Save as Draft
  async function handleSaveDraft() {
    if (items.length === 0) {
      setActionError('Cannot save empty quotation. Please add at least one product.');
      return;
    }

    try {
      setSaveLoading(true);
      setActionError(null);
      setActionMessage(null);

      const payload = {
        status: 'draft',
        document_type: documentType,
        paper_size: paperSize,
        logo_source: logoSource,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail,
        customer_company: customerCompany,
        customer_address: customerAddress,
        customer_gstin: customerGstin,
        reference_no: referenceNo,
        delivery_location: deliveryLocation,
        validity_days: Math.max(1, Number(validityDays || 7)),
        payment_terms: paymentTerms,
        delivery_terms: deliveryTerms,
        delivery_charges: Math.max(0, Number(deliveryCharges || 0)),
        other_charges: Math.max(0, Number(otherCharges || 0)),
        notes,
        raw_whatsapp_message: rawMessage,
        price_list_id: activePriceList?.id,
        items: items.map(it => ({
          product_id: it.product_id,
          item_code: it.item_code || '',
          product_name: it.product_name || 'Item',
          specification: it.specification || '',
          hsn_code: it.hsn_code || '',
          quantity: Math.max(1, Number(it.quantity || 1)),
          unit: it.unit || 'Nos',
          unit_price: Math.max(0, Number(it.unit_price || 0)),
          discount_percent: Math.min(100, Math.max(0, Number(it.discount_percent || 0))),
          gst_rate: Number(it.gst_rate !== undefined ? it.gst_rate : 18),
          match_status: it.matchStatus || 'Exact Match',
          raw_query: it.rawPhrase || ''
        }))
      };

      if (quotationId) {
        await api.updateQuotation(quotationId, payload);
        setActionMessage('Quotation draft saved successfully.');
      } else {
        const res = await api.createQuotation(payload);
        setQuotationId(res.quotationId);
        setQuotationNumber(res.quotationNumber);
        setPdfFilename(res.pdfFilename);
        setIsStalePdf(false);
        setActionMessage(`Quotation draft ${res.quotationNumber} saved!`);
      }

      setPdfRefreshKey(Date.now());
      if (onQuotationSaved) {
        onQuotationSaved();
      }
    } catch (err) {
      setActionError(err.message || 'Failed to save quotation draft.');
    } finally {
      setSaveLoading(false);
    }
  }

  // Operator 1-Click Approve
  async function handleApproveQuotation() {
    if (!quotationId) {
      setActionError('Please save the draft first.');
      return;
    }

    try {
      setSaveLoading(true);
      await api.approveQuotation(quotationId, {
        operatorName: 'Operator',
        notes: 'Verified item quantities and pricing.'
      });
      setApprovalStatus('approved');
      setApprovedBy('Operator');
      setApprovedAt(new Date().toISOString());
      setActionMessage('Quotation verified and approved by operator!');
      if (onQuotationSaved) onQuotationSaved();
    } catch (err) {
      setActionError(err.message || 'Failed to approve quotation.');
    } finally {
      setSaveLoading(false);
    }
  }

  // Finalize Quotation and Generate Official PDF
  async function handleFinalizeQuotation() {
    if (items.length === 0) {
      setActionError('Cannot finalize empty quotation.');
      return;
    }

    const unpriced = items.find(it => !it.unit_price || Number(it.unit_price) <= 0);
    if (unpriced) {
      setActionError(`Item "${unpriced.product_name}" has zero price. Please manually adjust or select a priced product.`);
      return;
    }

    try {
      setFinalizeLoading(true);
      setActionError(null);
      setActionMessage(null);

      // Auto-save any pending changes first
      await handleSaveDraft();

      // Finalize and create immutable snapshot
      const finRes = await api.finalizeQuotation(quotationId, paperSize);
      setQuotationStatus('finalized');
      setApprovalStatus('approved');
      setPdfFilename(finRes.pdfFilename);
      setIsStalePdf(false);
      setPdfRefreshKey(Date.now());
      setActionMessage(`Quotation ${quotationNumber} finalized with immutable snapshot!`);

      if (onQuotationSaved) onQuotationSaved();
    } catch (err) {
      setActionError(err.message || 'Failed to finalize quotation.');
    } finally {
      setFinalizeLoading(false);
    }
  }

  // Regenerate PDF Layout
  async function handleRegeneratePdf() {
    if (!quotationId) return;
    try {
      setSaveLoading(true);
      await handleSaveDraft();
      setPdfRefreshKey(Date.now());
      setIsStalePdf(false);
      setActionMessage('PDF layout regenerated!');
    } catch (err) {
      setActionError(err.message || 'Failed to regenerate PDF.');
    } finally {
      setSaveLoading(false);
    }
  }

  // Open Share Modal
  async function handleOpenWhatsAppShare() {
    if (!quotationId) return;
    try {
      setSaveLoading(true);
      const res = await api.getWhatsAppShare(quotationId);
      setWhatsappShareData(res);
      setEmailRecipient(customerEmail || '');
      setWhatsappModalOpen(true);
    } catch (err) {
      setActionError(err.message || 'Failed to prepare share message.');
    } finally {
      setSaveLoading(false);
    }
  }

  // Send via Official Meta Cloud API
  async function handleSendOfficialCloudWhatsApp() {
    if (!quotationId) return;
    try {
      setSendingCloudWhatsApp(true);
      setCloudWhatsAppError(null);
      setCloudWhatsAppSuccess(null);

      const recipient = customerPhone || whatsappShareData?.recipientPhone;
      if (!recipient) {
        setCloudWhatsAppError('Please provide a valid recipient WhatsApp phone number.');
        return;
      }

      const res = await api.sendQuotationWhatsApp(quotationId, {
        recipientPhone: recipient,
        messageText: whatsappShareData?.messageText
      });

      if (res.mode === 'official_meta_api') {
        setCloudWhatsAppSuccess(`Sent officially via WhatsApp Cloud API! Message ID: ${res.wamid}`);
        setActionMessage(`Quotation PDF officially delivered to ${recipient} via WhatsApp!`);
      } else {
        // Fallback triggered
        triggerDesktopShareFlow();
        setCloudWhatsAppSuccess('Opened WhatsApp Web with pre-filled message and downloaded PDF.');
      }
    } catch (err) {
      setCloudWhatsAppError(err.message || 'Official WhatsApp send failed.');
    } finally {
      setSendingCloudWhatsApp(false);
    }
  }

  // Desktop WhatsApp Web Fallback
  function triggerDesktopShareFlow() {
    if (typeof navigator !== 'undefined' && navigator.clipboard && whatsappShareData?.messageText) {
      navigator.clipboard.writeText(whatsappShareData.messageText);
    }

    const link = document.createElement('a');
    link.href = api.getPdfUrl(quotationId, true) + `&t=${pdfRefreshKey}`;
    link.download = `${quotationNumber || 'Quotation'}_Udhayam.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (whatsappShareData?.shareLink) {
      window.open(whatsappShareData.shareLink, '_blank', 'noopener,noreferrer');
      api.updateWhatsAppStatus(quotationId, 'whatsapp_opened');
    }

    setActionMessage('PDF downloaded and WhatsApp opened! Welcome text copied to clipboard. Drag or attach the PDF into WhatsApp.');
  }

  function handleCopyMessage() {
    if (whatsappShareData?.messageText && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(whatsappShareData.messageText);
      setCopiedMessage(true);
      setActionMessage('Welcome message copied to clipboard!');
      setTimeout(() => setCopiedMessage(false), 3000);
    }
  }

  // Send Email
  async function handleSendEmail() {
    if (!quotationId) return;
    if (!emailRecipient || !emailRecipient.trim()) {
      setEmailErrorMessage('Please enter a valid recipient email address.');
      return;
    }

    try {
      setSendingEmail(true);
      setEmailErrorMessage(null);
      setEmailSuccessMessage(null);

      const res = await api.shareEmail(quotationId, {
        recipientEmail: emailRecipient.trim(),
        recipientName: customerName
      });

      if (res.mode === 'smtp') {
        setEmailSuccessMessage(`Quotation PDF emailed to ${emailRecipient}!`);
        setActionMessage(`Quotation PDF emailed to ${emailRecipient}!`);
      } else {
        triggerEmailClientFallback(res.gmailComposeLink, res.emailContent?.text);
        setEmailSuccessMessage('PDF downloaded! Opened email composer with pre-filled quotation details.');
      }
    } catch (err) {
      setEmailErrorMessage(err.message || 'Failed to send email.');
    } finally {
      setSendingEmail(false);
    }
  }

  function triggerEmailClientFallback(composeUrl, messageBody) {
    const link = document.createElement('a');
    link.href = api.getPdfUrl(quotationId, true) + `&t=${pdfRefreshKey}`;
    link.download = `${quotationNumber || 'Quotation'}_Udhayam.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    const textToSend = messageBody || whatsappShareData?.messageText || '';
    if (typeof navigator !== 'undefined' && navigator.clipboard && textToSend) {
      navigator.clipboard.writeText(textToSend);
    }

    const subject = encodeURIComponent(`📄 Quotation ${quotationNumber || ''} - Udhayam Agencies`);
    const body = encodeURIComponent(textToSend);
    const to = encodeURIComponent(emailRecipient || customerEmail || '');
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${subject}&body=${body}`;
    const mailto = `mailto:${to}?subject=${subject}&body=${body}`;

    window.open(composeUrl || gmailUrl || mailto, '_blank', 'noopener,noreferrer');
  }

  // Duplicate into brand new draft
  async function handleDuplicate() {
    if (!quotationId) return;
    try {
      setSaveLoading(true);
      const res = await api.duplicateQuotation(quotationId);
      setQuotationId(res.newQuotationId);
      setQuotationNumber(res.newQuotationNumber);
      setQuotationStatus('draft');
      setApprovalStatus('pending_review');
      setIsStalePdf(true);
      setActionMessage(`Quotation duplicated as new draft ${res.newQuotationNumber}.`);
      if (onQuotationSaved) onQuotationSaved();
    } catch (err) {
      setActionError(err.message || 'Failed to duplicate quotation.');
    } finally {
      setSaveLoading(false);
    }
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Workspace Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-4 sm:p-5 rounded-lg border border-slate-200 shadow-2xs">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {quotationNumber ? `Quotation: ${quotationNumber}` : 'New Quotation Workspace'}
            </h1>
            <Badge variant={quotationStatus === 'finalized' ? 'success' : 'warning'}>
              {quotationStatus === 'finalized' ? 'Finalized Snapshot' : 'Draft'}
            </Badge>
            {approvalStatus === 'approved' ? (
              <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-semibold border border-emerald-200">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Approved by {approvedBy || 'Operator'}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-semibold border border-amber-200">
                <AlertCircle className="w-3 h-3 text-amber-600" />
                Awaiting Operator Approval
              </span>
            )}
            {isStalePdf && (
              <span className="text-[11px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-200">
                Pending PDF update
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Official A5/A4 quotation preparation with WhatsApp message parsing, catalog matching, and instant PDF generation.
          </p>
        </div>

        {/* Global Header Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {quotationId && (
            <>
              <button
                onClick={handleDuplicate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-md shadow-2xs transition-colors"
                title="Duplicate into new draft"
              >
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                Duplicate
              </button>

              <button
                onClick={handleOpenWhatsAppShare}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-md shadow-2xs transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" />
                Share (WhatsApp/Email)
              </button>
            </>
          )}

          <button
            onClick={handleSaveDraft}
            disabled={saveLoading || finalizeLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-md shadow-2xs transition-colors"
          >
            {saveLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
            <span>Save Draft</span>
          </button>

          {approvalStatus !== 'approved' && quotationId && (
            <button
              onClick={handleApproveQuotation}
              disabled={saveLoading || finalizeLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold rounded-md shadow-2xs transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span>Approve Draft</span>
            </button>
          )}

          <button
            onClick={handleFinalizeQuotation}
            disabled={saveLoading || finalizeLoading}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md shadow-2xs transition-colors"
          >
            {finalizeLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            <span>Finalize & Lock PDF</span>
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{actionMessage}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="text-emerald-700 font-bold">×</button>
        </div>
      )}

      {actionError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-rose-700 font-bold">×</button>
        </div>
      )}

      {/* 3-PANEL ZOHO-INSPIRED WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ========================================================= */}
        {/* PANEL 1 (LEFT 3 COLS): WhatsApp Input & Customer Details */}
        {/* ========================================================= */}
        <div className="lg:col-span-3 space-y-5">
          {/* WhatsApp Requirement Input */}
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                Customer WhatsApp Input
              </label>
              <span className="text-[10px] text-slate-400">Natural Text</span>
            </div>

            <textarea
              rows={4}
              value={rawMessage}
              onChange={(e) => setRawMessage(e.target.value)}
              placeholder="Paste raw WhatsApp text: e.g. 20 bags OPC cement, 10 rods 12mm, 5 paint buckets. Need quotation."
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-md p-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
            />

            {/* Quick Presets */}
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Example Presets:</span>
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => insertSampleMessage('20 bags OPC cement, 10 numbers of 12mm steel rods, 5 paint buckets. Please prepare quotation.')}
                  className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded transition-colors text-left truncate"
                >
                  "20 bags OPC, 12mm rods, paint"
                </button>
                <button
                  type="button"
                  onClick={() => insertSampleMessage('1 As EN golden Brown 1lt 1Nos. Need quotation with GST')}
                  className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded transition-colors text-left truncate"
                >
                  "As EN golden Brown 1lt 1Nos"
                </button>
                <button
                  type="button"
                  onClick={() => insertSampleMessage('UD12345 bill send pannunga.')}
                  className="text-[11px] bg-amber-50 hover:bg-amber-100 text-amber-800 px-2 py-1 rounded border border-amber-200 text-left truncate"
                >
                  "UD12345 bill send pannunga" (Lookup)
                </button>
              </div>
            </div>

            {billWarning && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800 flex items-start gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <div className="text-[11px]">{billWarning}</div>
              </div>
            )}

            {parseError && (
              <div className="p-2 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700">
                {parseError}
              </div>
            )}

            <button
              onClick={handleParseMessage}
              disabled={parsing || !rawMessage.trim()}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md shadow-2xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {parsing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>{parsing ? 'Parsing...' : 'Parse & Extract Items'}</span>
            </button>
          </div>

          {/* Customer Details Form */}
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs space-y-3">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Customer Details
            </h2>

            <div className="space-y-2.5 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-0.5 text-[11px]">Customer Name</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar / Sri Amman"
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded focus:bg-white focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-0.5 text-[11px]">WhatsApp Phone</label>
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="e.g. +91 97156 22499"
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded focus:bg-white focus:ring-1 focus:ring-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-0.5 text-[11px]">Email Address</label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="customer@domain.com"
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded focus:bg-white focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-0.5 text-[11px]">Company / Site</label>
                <input
                  type="text"
                  value={customerCompany}
                  onChange={(e) => setCustomerCompany(e.target.value)}
                  placeholder="Company name..."
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-0.5 text-[11px]">Address</label>
                <textarea
                  rows={2}
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="Site or billing address..."
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-medium text-slate-700 mb-0.5 text-[11px]">GSTIN</label>
                  <input
                    type="text"
                    value={customerGstin}
                    onChange={(e) => setCustomerGstin(e.target.value)}
                    placeholder="33AAAAA..."
                    className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded font-mono text-[11px]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-0.5 text-[11px]">Ref #</label>
                  <input
                    type="text"
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                    placeholder="SITE-A"
                    className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded text-[11px]"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* PANEL 2 (CENTER 5 COLS): Line Items & Configuration Bar  */}
        {/* ========================================================= */}
        <div className="lg:col-span-5 space-y-5">
          {/* Document Format & Logo Selector Bar */}
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              {/* Document Type Switch */}
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-700">Type:</span>
                <div className="inline-flex rounded-md shadow-2xs">
                  <button
                    type="button"
                    onClick={() => { setDocumentType('gst_quotation'); setIsStalePdf(true); }}
                    className={`px-2.5 py-1 font-semibold rounded-l-md border transition-colors ${
                      documentType === 'gst_quotation'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    GST Quote
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDocumentType('estimation'); setIsStalePdf(true); }}
                    className={`px-2.5 py-1 font-semibold rounded-r-md border-t border-b border-r transition-colors ${
                      documentType === 'estimation'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Estimation
                  </button>
                </div>
              </div>

              {/* Paper Size Switch */}
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-700">Paper:</span>
                <div className="inline-flex rounded-md shadow-2xs">
                  <button
                    type="button"
                    onClick={() => { setPaperSize('A5'); setIsStalePdf(true); }}
                    className={`px-2.5 py-1 font-semibold rounded-l-md border transition-colors ${
                      paperSize === 'A5'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    A5 (Default)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPaperSize('A4'); setIsStalePdf(true); }}
                    className={`px-2.5 py-1 font-semibold rounded-r-md border-t border-b border-r transition-colors ${
                      paperSize === 'A4'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    A4
                  </button>
                </div>
              </div>
            </div>

            {/* Company Logo Selector (Default / Custom / None) */}
            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
                <span className="font-bold text-slate-700">Quotation Logo:</span>
                <select
                  value={logoSource}
                  onChange={(e) => handleLogoSourceChange(e.target.value)}
                  className="p-1 bg-slate-50 border border-slate-200 rounded text-xs font-medium"
                >
                  <option value="default">Default Company Logo</option>
                  <option value="custom">Custom Logo (This Quote Only)</option>
                  <option value="none">No Logo (Text Only Header)</option>
                </select>
              </div>

              {logoSource === 'custom' && (
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold transition-colors">
                    <Upload className="w-3 h-3" />
                    <span>{uploadingLogo ? 'Uploading...' : customLogoPath ? 'Replace Logo' : 'Upload Logo'}</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleCustomLogoUpload}
                      disabled={uploadingLogo}
                      className="hidden"
                    />
                  </label>
                  {customLogoPath && (
                    <span className="text-[10px] text-emerald-600 font-semibold">✓ Attached</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Line Items Table */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Line Items ({items.length})
                </h2>
                <p className="text-[11px] text-slate-500">
                  Manual price adjustments and custom products supported.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleAddCustomItem}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 text-[11px] font-semibold rounded shadow-2xs transition-colors"
                >
                  <Plus className="w-3 h-3 text-blue-600" />
                  + Custom Item
                </button>
                <button
                  type="button"
                  onClick={handleAddBlankItem}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-[11px] font-semibold rounded transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  + From Catalog
                </button>
              </div>
            </div>

            {items.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs space-y-2">
                <p className="font-medium text-slate-700">No items in quotation</p>
                <p className="text-slate-400 text-[11px]">
                  Parse a WhatsApp message on the left or click "+ From Catalog" to add products.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="px-2.5 py-2 w-6">#</th>
                      <th className="px-2.5 py-2">Product Description</th>
                      <th className="px-2 py-2 w-14 text-center">Qty</th>
                      <th className="px-2 py-2 w-14 text-center">Unit</th>
                      <th className="px-2 py-2 w-24 text-right">Rate (₹)</th>
                      <th className="px-2 py-2 w-12 text-center">Disc%</th>
                      <th className="px-2 py-2 w-12 text-center">GST%</th>
                      <th className="px-2.5 py-2 w-20 text-right">Total</th>
                      <th className="px-2 py-2 w-8 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {calculatedItems.map((item, index) => (
                      <tr key={item.id || index} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-2.5 py-2 text-slate-400 font-mono text-[10px]">
                          {index + 1}
                        </td>

                        <td className="px-2.5 py-2 space-y-1">
                          {!item.product_id ? (
                            <div className="space-y-1">
                              <input
                                type="text"
                                value={item.product_name}
                                onChange={(e) => handleItemChange(index, 'product_name', e.target.value)}
                                placeholder="Custom product name..."
                                className="w-full text-xs font-semibold p-1 bg-amber-50/50 border border-amber-300 rounded focus:bg-white text-slate-900"
                              />
                              <input
                                type="text"
                                value={item.specification || ''}
                                onChange={(e) => handleItemChange(index, 'specification', e.target.value)}
                                placeholder="Specification..."
                                className="w-full text-[10px] p-0.5 bg-slate-50 border border-slate-200 rounded text-slate-600 focus:bg-white"
                              />
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-slate-900 leading-tight">
                                  {item.product_name}
                                </span>
                                {item.matchStatus && (
                                  <MatchStatusBadge status={item.matchStatus} />
                                )}
                              </div>
                              {item.specification && (
                                <div className="text-[10px] text-slate-500 leading-tight">
                                  {item.specification}
                                </div>
                              )}
                              {item.hsn_code && (
                                <div className="text-[9px] text-slate-400 font-mono">
                                  HSN: {item.hsn_code}
                                </div>
                              )}
                            </>
                          )}

                          {item.candidates && item.candidates.length > 0 && item.matchStatus === 'Multiple Possible Matches' && (
                            <div className="mt-1 p-1.5 bg-amber-50 border border-amber-200 rounded text-[10px] space-y-0.5">
                              <span className="font-semibold text-amber-900 block">Choose intended match:</span>
                              {item.candidates.map(cand => (
                                <button
                                  key={cand.id}
                                  type="button"
                                  onClick={() => handleProductSelected(cand)}
                                  className="block text-left text-blue-700 hover:underline"
                                >
                                  • {cand.product_name} ({cand.unit} @ {formatINR(cand.sales_rate)})
                                </button>
                              ))}
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => handleOpenChangeProduct(index)}
                            className="text-[10px] text-blue-600 hover:text-blue-800 font-medium block"
                          >
                            {item.product_id ? 'Change catalog product...' : 'Link to catalog...'}
                          </button>
                        </td>

                        {/* Qty */}
                        <td className="px-2 py-2 text-center">
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                            className={`w-12 text-center text-xs p-1 rounded border ${
                              item.isQuantityMissing
                                ? 'border-amber-400 bg-amber-50 text-amber-900 font-bold'
                                : 'border-slate-200 bg-slate-50 focus:bg-white'
                            }`}
                          />
                        </td>

                        {/* Unit */}
                        <td className="px-2 py-2 text-center">
                          <input
                            type="text"
                            value={item.unit || 'Nos'}
                            onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                            className="w-12 text-center text-xs p-1 rounded border border-slate-200 bg-slate-50 focus:bg-white"
                          />
                        </td>

                        {/* Unit Price (Editable with manual adjustment support) */}
                        <td className="px-2 py-2 text-right">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.unit_price}
                            onChange={(e) => handleItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                            className={`w-20 text-right text-xs p-1 rounded border font-mono font-medium ${
                              !item.unit_price || item.unit_price <= 0
                                ? 'border-rose-300 bg-rose-50 text-rose-700'
                                : 'border-slate-200 bg-slate-50 text-slate-900'
                            }`}
                            title="Edit price (manual adjustment allowed)"
                          />
                        </td>

                        {/* Disc% */}
                        <td className="px-2 py-2 text-center">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={item.discount_percent || 0}
                            onChange={(e) => handleItemChange(index, 'discount_percent', parseFloat(e.target.value) || 0)}
                            className="w-10 text-center text-xs p-1 rounded border border-slate-200 bg-slate-50 focus:bg-white"
                          />
                        </td>

                        {/* GST% */}
                        <td className="px-2 py-2 text-center">
                          <select
                            value={item.gst_rate !== undefined ? item.gst_rate : 18}
                            onChange={(e) => handleItemChange(index, 'gst_rate', parseFloat(e.target.value))}
                            className="text-[11px] p-1 rounded border border-slate-200 bg-slate-50 focus:bg-white"
                          >
                            <option value={0}>0%</option>
                            <option value={5}>5%</option>
                            <option value={12}>12%</option>
                            <option value={18}>18%</option>
                            <option value={28}>28%</option>
                          </select>
                        </td>

                        {/* Total */}
                        <td className="px-2.5 py-2 text-right font-bold text-slate-900 font-mono text-xs">
                          {formatINR(item.lineTotal)}
                        </td>

                        {/* Trash */}
                        <td className="px-2 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="text-slate-400 hover:text-rose-600 p-0.5 transition-colors"
                            title="Remove"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Quotation Notes & Validity */}
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs space-y-3">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Terms & Notes
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded p-2 text-slate-800 focus:bg-white"
            />
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block mb-0.5 text-[11px]">Validity (Days)</span>
                <input
                  type="number"
                  value={validityDays}
                  onChange={(e) => setValidityDays(Number(e.target.value))}
                  className="w-full p-1.5 border border-slate-200 rounded text-xs"
                />
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5 text-[11px]">Payment Terms</span>
                <input
                  type="text"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  className="w-full p-1.5 border border-slate-200 rounded text-xs"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* PANEL 3 (RIGHT 4 COLS): Financials & Live PDF Preview     */}
        {/* ========================================================= */}
        <div className="lg:col-span-4 space-y-5">
          {/* Financial Totals Card */}
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs space-y-2 text-xs">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
              Financial Summary
            </h3>

            <div className="flex justify-between py-1 text-slate-600">
              <span>Subtotal (Gross):</span>
              <span className="font-medium text-slate-900">{formatINR(subtotal)}</span>
            </div>

            {discountTotal > 0 && (
              <div className="flex justify-between py-1 text-emerald-700">
                <span>Total Discount:</span>
                <span className="font-medium">-{formatINR(discountTotal)}</span>
              </div>
            )}

            {documentType === 'gst_quotation' && (
              <>
                <div className="flex justify-between py-1 text-slate-600">
                  <span>Taxable Value:</span>
                  <span className="font-medium">{formatINR(taxableAmount)}</span>
                </div>
                <div className="flex justify-between py-1 text-slate-600">
                  <span>GST Tax (CGST + SGST):</span>
                  <span className="font-medium">{formatINR(taxTotal)}</span>
                </div>
              </>
            )}

            <div className="flex items-center justify-between py-1 text-slate-600">
              <span>Delivery Charges:</span>
              <input
                type="number"
                min="0"
                step="any"
                value={deliveryCharges}
                onChange={(e) => setDeliveryCharges(parseFloat(e.target.value) || 0)}
                className="w-20 text-right p-1 border border-slate-200 rounded text-xs font-mono"
              />
            </div>

            <div className="flex items-center justify-between py-1 text-slate-600">
              <span>Other Charges:</span>
              <input
                type="number"
                min="0"
                step="any"
                value={otherCharges}
                onChange={(e) => setOtherCharges(parseFloat(e.target.value) || 0)}
                className="w-20 text-right p-1 border border-slate-200 rounded text-xs font-mono"
              />
            </div>

            {/* Grand Total */}
            <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
              <span className="text-sm font-bold text-slate-900">Grand Total:</span>
              <span className="text-xl font-bold text-blue-600 font-mono">
                {formatINR(grandTotal)}
              </span>
            </div>
          </div>

          {/* Embedded Live PDF Preview Iframe */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden space-y-2">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                Live PDF Document ({paperSize})
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleRegeneratePdf}
                  className="p-1 hover:bg-slate-200 rounded text-slate-600 transition-colors"
                  title="Regenerate PDF"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                {quotationId && (
                  <a
                    href={api.getPdfUrl(quotationId, false) + `&refresh=true&t=${pdfRefreshKey}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 hover:bg-slate-200 rounded text-slate-600 transition-colors"
                    title="Open Full Window"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>

            <div className="bg-slate-100 p-2 min-h-[460px] flex items-center justify-center">
              {quotationId ? (
                <iframe
                  key={pdfRefreshKey}
                  src={api.getPdfUrl(quotationId, false) + `&refresh=true&t=${pdfRefreshKey}`}
                  title="Quotation PDF Live Preview"
                  className="w-full h-[480px] bg-white rounded border border-slate-200 shadow-inner"
                />
              ) : (
                <div className="text-center p-6 text-xs text-slate-500 space-y-2">
                  <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                  <p>Save draft to generate live PDF preview</p>
                </div>
              )}
            </div>

            {/* Quick PDF Actions Bar */}
            {quotationId && (
              <div className="p-3 bg-white border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                <a
                  href={api.getPdfUrl(quotationId, true) + `&t=${pdfRefreshKey}`}
                  download={`${quotationNumber || 'Quotation'}.pdf`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded transition-colors text-[11px]"
                >
                  <Download className="w-3 h-3" />
                  Download PDF
                </a>
                <button
                  type="button"
                  onClick={handleOpenWhatsAppShare}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded transition-colors text-[11px] shadow-2xs"
                >
                  <Send className="w-3 h-3" />
                  Share PDF
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Product Selector Modal */}
      <ProductSelectorModal
        isOpen={selectorOpen}
        onClose={() => setSelectorOpen(false)}
        onSelectProduct={handleProductSelected}
      />

      {/* Share Modal (Official WhatsApp Cloud API, Desktop Web & Email) */}
      <Modal
        isOpen={whatsappModalOpen}
        onClose={() => setWhatsappModalOpen(false)}
        title="Share Quotation (Official WhatsApp & Email)"
        maxWidth="max-w-xl"
      >
        <div className="space-y-4 text-xs">
          {/* Quick Header */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Quote #</span>
              <span className="font-bold text-slate-800 text-sm">{quotationNumber || 'New Quote'}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Customer</span>
              <span className="font-semibold text-slate-700">{customerName || 'Customer'} {customerPhone ? `(${customerPhone})` : ''}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Total</span>
              <span className="font-bold text-emerald-700 text-sm">{formatINR(grandTotal)}</span>
            </div>
          </div>

          {/* Share Method Switcher */}
          <div className="flex border-b border-slate-200">
            <button
              type="button"
              onClick={() => setShareTab('whatsapp')}
              className={`flex-1 py-2 text-center font-bold border-b-2 transition-colors flex items-center justify-center gap-2 ${
                shareTab === 'whatsapp'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Smartphone className="w-4 h-4 text-emerald-600" />
              WhatsApp Share
            </button>
            <button
              type="button"
              onClick={() => setShareTab('email')}
              className={`flex-1 py-2 text-center font-bold border-b-2 transition-colors flex items-center justify-center gap-2 ${
                shareTab === 'email'
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Mail className="w-4 h-4 text-blue-600" />
              Email PDF
            </button>
          </div>

          {shareTab === 'whatsapp' && (
            <div className="space-y-4">
              {cloudWhatsAppSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{cloudWhatsAppSuccess}</span>
                </div>
              )}

              {cloudWhatsAppError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{cloudWhatsAppError}</span>
                </div>
              )}

              {/* Message Preview */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-slate-700">Message Text:</span>
                  <button
                    type="button"
                    onClick={handleCopyMessage}
                    className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                  >
                    {copiedMessage ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedMessage ? 'Copied!' : 'Copy Text'}</span>
                  </button>
                </div>
                <pre className="p-3 bg-slate-50 border border-slate-200 rounded-md text-[11px] font-sans whitespace-pre-wrap text-slate-800 max-h-48 overflow-y-auto leading-relaxed">
                  {whatsappShareData?.messageText}
                </pre>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleSendOfficialCloudWhatsApp}
                  disabled={sendingCloudWhatsApp}
                  className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-bold text-xs shadow-2xs transition-colors flex items-center justify-center gap-2"
                >
                  {sendingCloudWhatsApp ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Official Cloud API Send</span>
                </button>

                <button
                  type="button"
                  onClick={triggerDesktopShareFlow}
                  className="w-full py-2.5 px-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md font-bold text-xs shadow-2xs transition-colors flex items-center justify-center gap-2"
                >
                  <Laptop className="w-3.5 h-3.5 text-slate-500" />
                  <span>Open WhatsApp Web</span>
                </button>
              </div>
            </div>
          )}

          {shareTab === 'email' && (
            <div className="space-y-4">
              {emailSuccessMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{emailSuccessMessage}</span>
                </div>
              )}

              {emailErrorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{emailErrorMessage}</span>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Recipient Email Address</label>
                <input
                  type="email"
                  value={emailRecipient}
                  onChange={(e) => setEmailRecipient(e.target.value)}
                  placeholder="e.g. customer@example.com"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded text-xs focus:bg-white"
                />
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded text-[11px] text-blue-800">
                📎 The generated official PDF ({paperSize}) will be attached automatically.
              </div>

              <button
                type="button"
                onClick={handleSendEmail}
                disabled={sendingEmail}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-xs shadow-2xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {sendingEmail ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Send Email with Quotation PDF</span>
              </button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
