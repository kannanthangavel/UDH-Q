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
  FileSpreadsheet,
  Building,
  User,
  Phone,
  MapPin,
  CreditCard,
  Calendar,
  Layers,
  HelpCircle,
  Eye
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

  // Customer Details State (Hero Card at the Top)
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerCompany, setCustomerCompany] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerGstin, setCustomerGstin] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState('');

  // Collapsible WhatsApp Importer State
  const [isImporterOpen, setIsImporterOpen] = useState(!quotationIdToLoad);
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
      setApprovedBy(q.approved_by || null);
      setApprovedAt(q.approved_at || null);
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
      setPdfFilename(q.pdf_filename || null);
      setIsStalePdf(Boolean(q.is_stale_pdf));

      if (res.items && res.items.length > 0) {
        setItems(res.items.map(it => ({
          id: it.id,
          product_id: it.product_id,
          item_code: it.item_code,
          product_name: it.product_name,
          specification: it.specification || '',
          hsn_code: it.hsn_code,
          quantity: it.quantity,
          unit: it.unit,
          unit_price: it.unit_price,
          is_override_price: it.is_override_price,
          override_reason: it.override_reason,
          discount_percent: it.discount_percent || 0,
          gst_rate: it.gst_rate !== undefined ? it.gst_rate : 18,
          matchStatus: it.match_status || 'Exact Match',
          rawPhrase: it.raw_query || ''
        })));
      }
    } catch (err) {
      setActionError(err.message || 'Failed to load quotation details.');
    } finally {
      setSaveLoading(false);
    }
  }

  // Parse natural language WhatsApp text
  async function handleParseMessage() {
    if (!rawMessage.trim()) return;

    try {
      setParsing(true);
      setBillWarning(null);
      setParseError(null);

      const res = await api.parseWhatsAppMessage(rawMessage, activePriceList?.id);

      if (res.isBillLookup) {
        setBillWarning(res.billLookup.warning);
        return;
      }

      if (res.customerDetails) {
        if (res.customerDetails.customerName && !customerName) {
          setCustomerName(res.customerDetails.customerName);
        }
        if (res.customerDetails.customerPhone && !customerPhone) {
          setCustomerPhone(res.customerDetails.customerPhone);
        }
      }

      if (res.documentType) {
        setDocumentType(res.documentType);
      }
      if (res.paperSize) {
        setPaperSize(res.paperSize);
      }

      if (res.items && res.items.length > 0) {
        const newItems = res.items.map(it => {
          const matched = it.matchedProduct;
          return {
            product_id: matched ? matched.id : null,
            item_code: matched ? matched.item_code : '',
            product_name: matched ? matched.product_name : it.productName,
            specification: it.specification || (matched ? matched.specification : ''),
            hsn_code: matched ? matched.hsn_code : '',
            quantity: it.quantity !== null ? it.quantity : 1,
            unit: it.unit || (matched ? matched.unit : 'Nos'),
            unit_price: matched ? (matched.sales_rate || 0) : 0,
            discount_percent: 0,
            gst_rate: matched ? (matched.gst_rate || 18) : 18,
            isQuantityMissing: it.isQuantityMissing,
            isUnitMissing: it.isUnitMissing,
            matchStatus: it.matchStatus,
            confidence: it.confidence,
            candidates: it.candidates || [],
            rawPhrase: it.rawPhrase
          };
        });

        setItems(newItems);
        setIsStalePdf(true);
        setActionMessage(`Successfully parsed ${newItems.length} requirement(s) from text!`);
      } else {
        setParseError('No products could be extracted. Please check the text format.');
      }
    } catch (err) {
      setParseError(err.message || 'Failed to parse message text.');
    } finally {
      setParsing(false);
    }
  }

  function insertSampleMessage(msg) {
    setRawMessage(msg);
  }

  // Line item management
  function handleAddCustomItem() {
    const newItem = {
      product_id: null,
      item_code: '',
      product_name: 'New Custom Material',
      specification: '',
      hsn_code: '32089021',
      quantity: 1,
      unit: 'Nos',
      unit_price: 0,
      discount_percent: 0,
      gst_rate: 18,
      matchStatus: 'Manual Adjustment',
      confidence: 100,
      candidates: []
    };
    setItems([...items, newItem]);
    setIsStalePdf(true);
  }

  function handleAddBlankItem() {
    setItemIndexToReplace(null);
    setSelectorOpen(true);
  }

  function handleOpenChangeProduct(index) {
    setItemIndexToReplace(index);
    setSelectorOpen(true);
  }

  function handleProductSelected(product) {
    if (itemIndexToReplace !== null && items[itemIndexToReplace]) {
      const updated = [...items];
      updated[itemIndexToReplace] = {
        ...updated[itemIndexToReplace],
        product_id: product.id,
        item_code: product.item_code,
        product_name: product.product_name,
        specification: product.specification || updated[itemIndexToReplace].specification || '',
        hsn_code: product.hsn_code,
        unit: product.unit || updated[itemIndexToReplace].unit || 'Nos',
        unit_price: product.sales_rate || 0,
        gst_rate: product.gst_rate || 18,
        matchStatus: 'Exact Match',
        confidence: 100,
        candidates: []
      };
      setItems(updated);
    } else {
      const newItem = {
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

  function handleRemoveItem(index) {
    setItems(items.filter((_, i) => i !== index));
    setIsStalePdf(true);
  }

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
    if (field === 'unit_price') {
      updated[index].is_override_price = true;
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

  // Financial Calculations
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
      setActionError('Cannot save empty quotation. Please add at least one line item.');
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
          quantity: Math.max(0.01, Number(it.quantity || 1)),
          unit: it.unit || 'Nos',
          unit_price: Math.max(0, Number(it.unit_price || 0)),
          is_override_price: Boolean(it.is_override_price),
          override_reason: it.override_reason || '',
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
        setActionMessage(`Quotation draft ${res.quotationNumber} created!`);
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

  // Finalize Quotation and Generate Official PDF (Enterprise UX Writing)
  async function handleFinalizeQuotation() {
    if (items.length === 0) {
      setActionError('Cannot finalize empty quotation.');
      return;
    }

    const unpriced = items.find(it => !it.unit_price || Number(it.unit_price) <= 0);
    if (unpriced) {
      setActionError(`Item "${unpriced.product_name}" has zero price. Please manually adjust or select a priced catalog product.`);
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
      setActionMessage(`Quotation ${quotationNumber} approved and finalized with official PDF snapshot!`);

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
    if (!quotationId) {
      setActionError('Please save the quotation first before sharing.');
      return;
    }
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

  // Native Web Share with attached PDF file
  async function handleNativeShareWithFile() {
    if (!quotationId) return;
    try {
      setIsSharingNative(true);
      const pdfUrl = api.getPdfUrl(quotationId, false);
      const res = await fetch(pdfUrl);
      if (!res.ok) throw new Error('Could not fetch PDF file.');
      const blob = await res.blob();
      const fileName = `${quotationNumber || 'Quotation'}_Udhayam.pdf`;
      const file = new File([blob], fileName, { type: 'application/pdf' });

      if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `Quotation ${quotationNumber} - Udhayam Agencies`,
          text: whatsappShareData?.messageText || `Quotation ${quotationNumber} from Udhayam Agencies`,
          files: [file]
        });
        api.updateWhatsAppStatus(quotationId, 'sent');
        setActionMessage('Quotation PDF and welcome text shared successfully via native share!');
        return;
      } else {
        // Fallback to desktop flow
        triggerDesktopShareFlow();
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        triggerDesktopShareFlow();
      }
    } finally {
      setIsSharingNative(false);
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
        triggerDesktopShareFlow();
        setCloudWhatsAppSuccess('Opened WhatsApp Web with pre-filled message and downloaded PDF.');
      }
    } catch (err) {
      setCloudWhatsAppError(err.message || 'Official WhatsApp send failed.');
    } finally {
      setSendingCloudWhatsApp(false);
    }
  }

  // Desktop WhatsApp Web Flow (with auto PDF download & copy welcome text)
  function triggerDesktopShareFlow() {
    if (typeof navigator !== 'undefined' && navigator.clipboard && whatsappShareData?.messageText) {
      navigator.clipboard.writeText(whatsappShareData.messageText);
    }

    // Trigger instant download of the PDF
    const link = document.createElement('a');
    link.href = api.getPdfUrl(quotationId, true) + `&t=${pdfRefreshKey}`;
    link.download = `${quotationNumber || 'Quotation'}_Udhayam.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Open WhatsApp Web
    if (whatsappShareData?.shareLink) {
      window.open(whatsappShareData.shareLink, '_blank', 'noopener,noreferrer');
      api.updateWhatsAppStatus(quotationId, 'whatsapp_opened');
    }

    setActionMessage('Quotation PDF downloaded! Welcome message copied to clipboard. You can now paste and attach in WhatsApp.');
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
      {/* ========================================================================= */}
      {/* 1. TOP COMMAND & STATUS BAR (Inspired by Google Workspace & Zoho Books) */}
      {/* ========================================================================= */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span className="text-[#044E54]">{quotationNumber || 'New Quotation'}</span>
            </h1>

            <Badge variant={quotationStatus === 'finalized' ? 'success' : 'warning'}>
              {quotationStatus === 'finalized' ? 'Finalized Snapshot' : 'Draft'}
            </Badge>

            {approvalStatus === 'approved' ? (
              <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-50 text-emerald-800 px-2.5 py-0.5 rounded-full font-semibold border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Approved by {approvedBy || 'Operator'}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] bg-amber-50 text-amber-800 px-2.5 py-0.5 rounded-full font-semibold border border-amber-200">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                Awaiting Operator Review
              </span>
            )}

            {isStalePdf && (
              <span className="text-[11px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-200">
                Pending PDF sync
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Udhayam Precision Quotation System • 5,300+ Verified Catalog Items • GST & Commercial Estimation
          </p>
        </div>

        {/* Global Action Suite */}
        <div className="flex flex-wrap items-center gap-2">
          {quotationId && (
            <>
              <button
                type="button"
                onClick={() => setPdfModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 shadow-2xs transition-colors"
                title="Preview high-resolution PDF"
              >
                <Eye className="w-3.5 h-3.5 text-slate-600" />
                <span>Preview PDF</span>
              </button>

              <button
                type="button"
                onClick={handleDuplicate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-lg shadow-2xs transition-colors"
                title="Duplicate into new draft"
              >
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>Duplicate</span>
              </button>

              <button
                type="button"
                onClick={handleOpenWhatsAppShare}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#72B01D] hover:bg-[#5F9418] text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share & Deliver</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={saveLoading || finalizeLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg shadow-2xs transition-colors disabled:opacity-50"
          >
            {saveLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#044E54]" /> : null}
            <span>Save Draft</span>
          </button>

          {approvalStatus !== 'approved' && quotationId && (
            <button
              type="button"
              onClick={handleApproveQuotation}
              disabled={saveLoading || finalizeLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-teal-50 border border-teal-200 text-[#044E54] hover:bg-teal-100 text-xs font-semibold rounded-lg shadow-2xs transition-colors disabled:opacity-50"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#044E54]" />
              <span>Approve Draft</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleFinalizeQuotation}
            disabled={saveLoading || finalizeLoading}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#044E54] hover:bg-[#033B40] text-white text-xs font-bold rounded-lg shadow-xs transition-colors disabled:opacity-50"
          >
            {finalizeLoading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-[#72B01D]" />
            )}
            <span>Approve & Finalize Quotation</span>
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionMessage}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="text-emerald-700 font-bold px-1.5">×</button>
        </div>
      )}

      {actionError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-rose-700 font-bold px-1.5">×</button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. FULL-WIDTH CLIENT & QUOTATION DETAILS CARD (TOP PRIORITY REQUEST)       */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Header Ribbon */}
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-[#044E54]">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Client & Quotation Information
              </h2>
              <p className="text-[11px] text-slate-500">
                Primary recipient and commercial configuration for this document.
              </p>
            </div>
          </div>

          {/* Quick Segmented Document Controls */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {/* Mode Switch: GST Quote vs Estimation */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-600">Mode:</span>
              <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-100">
                <button
                  type="button"
                  onClick={() => { setDocumentType('gst_quotation'); setIsStalePdf(true); }}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                    documentType === 'gst_quotation'
                      ? 'bg-[#044E54] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  GST Quotation
                </button>
                <button
                  type="button"
                  onClick={() => { setDocumentType('estimation'); setIsStalePdf(true); }}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                    documentType === 'estimation'
                      ? 'bg-[#044E54] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Estimation
                </button>
              </div>
            </div>

            {/* Paper Size Switch: A5 vs A4 */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-600">Format:</span>
              <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-100">
                <button
                  type="button"
                  onClick={() => { setPaperSize('A5'); setIsStalePdf(true); }}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                    paperSize === 'A5'
                      ? 'bg-[#044E54] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  A5 (Default)
                </button>
                <button
                  type="button"
                  onClick={() => { setPaperSize('A4'); setIsStalePdf(true); }}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                    paperSize === 'A4'
                      ? 'bg-[#044E54] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  A4
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Client Fields Grid */}
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* Customer / Client Name */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1 text-[11px]">
              Customer / Client Name <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Ramesh Kumar / Sri Amman Traders"
                className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#044E54] font-medium"
              />
            </div>
          </div>

          {/* WhatsApp Phone */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1 text-[11px] flex items-center justify-between">
              <span>WhatsApp Phone</span>
              {customerPhone && (
                <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
                  <CheckCircle2 className="w-2.5 h-2.5" /> WhatsApp Active
                </span>
              )}
            </label>
            <div className="relative">
              <Phone className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="+91 97156 22499"
                className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#044E54] font-mono"
              />
            </div>
          </div>

          {/* Email Address */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1 text-[11px]">
              Email Address (Optional)
            </label>
            <div className="relative">
              <Mail className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="client@example.com"
                className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#044E54]"
              />
            </div>
          </div>

          {/* Company / Site Name */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1 text-[11px]">
              Company / Construction Site
            </label>
            <div className="relative">
              <Building className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={customerCompany}
                onChange={(e) => setCustomerCompany(e.target.value)}
                placeholder="e.g. Apex Builders, Perundurai Site"
                className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#044E54]"
              />
            </div>
          </div>

          {/* Billing & Site Address */}
          <div className="md:col-span-2">
            <label className="block font-semibold text-slate-700 mb-1 text-[11px]">
              Billing & Site Delivery Address
            </label>
            <div className="relative">
              <MapPin className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <textarea
                rows={2}
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="Site location or billing address..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#044E54]"
              />
            </div>
          </div>

          {/* GSTIN */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1 text-[11px]">
              Customer GSTIN (Tax Invoices)
            </label>
            <input
              type="text"
              value={customerGstin}
              onChange={(e) => setCustomerGstin(e.target.value)}
              placeholder="33AAAAA0000A1Z5"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#044E54] font-mono uppercase"
            />
          </div>

          {/* Reference # / PO Number */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1 text-[11px]">
              Customer PO / Ref Number
            </label>
            <input
              type="text"
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              placeholder="e.g. PO-8841 / SITE-A"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#044E54]"
            />
          </div>
        </div>

        {/* Secondary Meta Bar (Validity, Logo Mode, Delivery) */}
        <div className="px-5 py-3 bg-slate-50/70 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-4 text-slate-600">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Validity:</span>
              <select
                value={validityDays}
                onChange={(e) => setValidityDays(Number(e.target.value))}
                className="bg-white border border-slate-200 rounded px-2 py-0.5 font-medium"
              >
                <option value={7}>7 Days (Standard)</option>
                <option value={15}>15 Days</option>
                <option value={30}>30 Days</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
              <span>Logo:</span>
              <select
                value={logoSource}
                onChange={(e) => handleLogoSourceChange(e.target.value)}
                className="bg-white border border-slate-200 rounded px-2 py-0.5 font-medium"
              >
                <option value="default">Default Official Logo</option>
                <option value="custom">Custom Logo (This Quote Only)</option>
                <option value="none">No Logo (Text Only)</option>
              </select>
            </div>

            {logoSource === 'custom' && (
              <label className="cursor-pointer inline-flex items-center gap-1 px-2 py-0.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded text-[11px] font-semibold transition-colors">
                <Upload className="w-3 h-3 text-[#044E54]" />
                <span>{uploadingLogo ? 'Uploading...' : customLogoPath ? 'Replace Logo' : 'Upload Logo'}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleCustomLogoUpload}
                  disabled={uploadingLogo}
                  className="hidden"
                />
              </label>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsImporterOpen(!isImporterOpen)}
            className="text-xs font-semibold text-[#044E54] hover:text-[#033B40] flex items-center gap-1"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#72B01D]" />
            <span>{isImporterOpen ? 'Hide WhatsApp Importer' : 'Import from WhatsApp / Notes'}</span>
            {isImporterOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. COLLAPSIBLE SMART WHATSAPP REQUIREMENT IMPORTER                         */}
      {/* ========================================================================= */}
      {isImporterOpen && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden transition-all">
          <div className="p-4 bg-teal-50/40 border-b border-teal-100/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#044E54]" />
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Smart WhatsApp & Text Requirement Importer
              </span>
              <span className="text-[10px] bg-teal-100 text-[#044E54] px-2 py-0.5 rounded font-semibold">
                AI NLP
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsImporterOpen(false)}
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 space-y-3">
            <textarea
              rows={3}
              value={rawMessage}
              onChange={(e) => setRawMessage(e.target.value)}
              placeholder="Paste raw WhatsApp text e.g. 1.green paint=1/2 litre 2.block paint=1/2 litre 3.enamel thinner=1/2 litre 4.brush(2inch)=2 nos. Or: asian golden yellow 20lt, 20 bags cement."
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#044E54] font-mono leading-relaxed"
            />

            {/* Quick Example Presets */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Presets:</span>
              <button
                type="button"
                onClick={() => insertSampleMessage(`1.green paint=1/2 litre\n2.block paint=1/2 litre\n3.enamel thinner=1/2 litre\n4.brush(2inch)=2 nos\nThis metrial needed sir`)}
                className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-md transition-colors"
              >
                Paint & Thinner Request
              </button>
              <button
                type="button"
                onClick={() => insertSampleMessage('asian golden yellow 20lt. Need estimation.')}
                className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-md transition-colors"
              >
                Asian Golden Yellow 20LT
              </button>
              <button
                type="button"
                onClick={() => insertSampleMessage('20 bags OPC cement, 10 numbers of 12mm steel rods, 5 paint buckets. Please prepare quotation.')}
                className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-md transition-colors"
              >
                Cement & Hardware
              </button>
              <button
                type="button"
                onClick={() => insertSampleMessage('UD12345 bill send pannunga.')}
                className="text-[11px] bg-amber-50 hover:bg-amber-100 text-amber-800 px-2.5 py-1 rounded-md border border-amber-200"
              >
                Bill Lookup Test
              </button>
            </div>

            {billWarning && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <div className="text-[11px]">{billWarning}</div>
              </div>
            )}

            {parseError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                {parseError}
              </div>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleParseMessage}
                disabled={parsing || !rawMessage.trim()}
                className="py-2 px-5 bg-[#044E54] hover:bg-[#033B40] text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {parsing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-[#72B01D]" />}
                <span>{parsing ? 'Parsing Requirements...' : 'Extract & Populate Line Items'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. FULL-WIDTH HERO LINE ITEMS & SPECIFICATION TABLE (WITH NEW DETAILS COL) */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table Action Header */}
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Line Items & Material Specifications ({items.length})
              </h2>
              {activePriceList && (
                <span className="text-[10px] text-teal-800 bg-teal-50 px-2 py-0.5 rounded font-medium border border-teal-200">
                  Catalog: {activePriceList.filename}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Live pricing linked to 5,300+ Udhayam items. Manual price adjustment and custom remarks supported.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddCustomItem}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 text-xs font-semibold rounded-lg shadow-2xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-[#044E54]" />
              <span>+ Custom Item</span>
            </button>
            <button
              type="button"
              onClick={handleAddBlankItem}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#044E54] text-white hover:bg-[#033B40] text-xs font-bold rounded-lg shadow-xs transition-colors"
            >
              <Search className="w-3.5 h-3.5 text-[#72B01D]" />
              <span>+ Browse Catalog</span>
            </button>
          </div>
        </div>

        {/* Empty State */}
        {items.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs space-y-3">
            <Layers className="w-10 h-10 text-slate-300 mx-auto" />
            <div>
              <p className="font-semibold text-slate-800 text-sm">No items in this quotation yet</p>
              <p className="text-slate-400 text-xs mt-0.5">
                Paste a customer WhatsApp requirement above or click "+ Browse Catalog" to add products.
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleAddBlankItem}
                className="px-4 py-2 bg-[#044E54] hover:bg-[#033B40] text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
              >
                Open Product Catalog
              </button>
              <button
                type="button"
                onClick={handleAddCustomItem}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
              >
                Add Manual Item
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-[#F8FAFC] text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-3 py-3 w-8 text-center text-slate-400">#</th>
                  <th className="px-3 py-3 min-w-[240px]">Product / Material Name</th>
                  {/* USER REQUEST: Dedicated new column right after Item Name */}
                  <th className="px-3 py-3 min-w-[160px] text-[#044E54]">Details / Remarks</th>
                  <th className="px-2 py-3 w-20 text-center">HSN/SAC</th>
                  <th className="px-2 py-3 w-16 text-center">Qty</th>
                  <th className="px-2 py-3 w-16 text-center">Unit</th>
                  <th className="px-3 py-3 w-28 text-right">Rate (₹)</th>
                  <th className="px-2 py-3 w-14 text-center">Disc%</th>
                  <th className="px-2 py-3 w-16 text-center">GST%</th>
                  <th className="px-3 py-3 w-28 text-right">Amount (₹)</th>
                  <th className="px-2 py-3 w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {calculatedItems.map((item, index) => (
                  <tr key={item.id || index} className="hover:bg-teal-50/20 transition-colors group">
                    {/* S.No */}
                    <td className="px-3 py-3 text-slate-400 font-mono text-[10px] text-center">
                      {index + 1}
                    </td>

                    {/* Column 2: Product Name */}
                    <td className="px-3 py-3 space-y-1">
                      {!item.product_id ? (
                        <input
                          type="text"
                          value={item.product_name}
                          onChange={(e) => handleItemChange(index, 'product_name', e.target.value)}
                          placeholder="Product description..."
                          className="w-full text-xs font-semibold p-1.5 bg-amber-50/60 border border-amber-300 rounded-md focus:bg-white text-slate-900"
                        />
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-900 leading-snug">
                            {item.product_name}
                          </span>
                          {item.matchStatus && (
                            <MatchStatusBadge status={item.matchStatus} />
                          )}
                        </div>
                      )}

                      {/* Candidates dropdown if multiple matches */}
                      {item.candidates && item.candidates.length > 0 && item.matchStatus === 'Multiple Possible Matches' && (
                        <div className="mt-1 p-2 bg-amber-50 border border-amber-200 rounded-md text-[10px] space-y-1">
                          <span className="font-semibold text-amber-900 block">Multiple matches found. Select correct pack:</span>
                          {item.candidates.map(cand => (
                            <button
                              key={cand.id}
                              type="button"
                              onClick={() => handleProductSelected(cand)}
                              className="block text-left text-[#044E54] hover:underline font-medium"
                            >
                              • {cand.product_name} ({cand.unit} @ {formatINR(cand.sales_rate)})
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenChangeProduct(index)}
                          className="text-[10px] text-[#044E54] hover:text-[#033B40] font-semibold hover:underline"
                        >
                          {item.product_id ? 'Change catalog item...' : 'Link to price list catalog...'}
                        </button>
                        {item.is_override_price && (
                          <span className="text-[9px] bg-amber-100 text-amber-800 font-semibold px-1.5 py-0.2 rounded">
                            Adjusted Price
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Column 3 (NEW COLUMN): Details / Remarks / Specifications */}
                    <td className="px-3 py-3">
                      <input
                        type="text"
                        value={item.specification || ''}
                        onChange={(e) => handleItemChange(index, 'specification', e.target.value)}
                        placeholder="e.g. 20LT Pack, Glossy, Batch A"
                        className="w-full text-xs p-1.5 bg-slate-50 border border-slate-200 rounded-md text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#044E54]"
                      />
                    </td>

                    {/* Column 4: HSN/SAC */}
                    <td className="px-2 py-3 text-center">
                      <input
                        type="text"
                        value={item.hsn_code || ''}
                        onChange={(e) => handleItemChange(index, 'hsn_code', e.target.value)}
                        placeholder="HSN"
                        className="w-16 text-center text-xs p-1 rounded-md border border-slate-200 bg-slate-50 font-mono text-slate-600"
                      />
                    </td>

                    {/* Column 5: Qty */}
                    <td className="px-2 py-3 text-center">
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                        className={`w-14 text-center text-xs p-1.5 rounded-md border font-bold ${
                          item.isQuantityMissing
                            ? 'border-amber-400 bg-amber-50 text-amber-900'
                            : 'border-slate-200 bg-slate-50 focus:bg-white text-slate-900'
                        }`}
                      />
                    </td>

                    {/* Column 6: Unit */}
                    <td className="px-2 py-3 text-center">
                      <input
                        type="text"
                        value={item.unit || 'Nos'}
                        onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                        className="w-14 text-center text-xs p-1.5 rounded-md border border-slate-200 bg-slate-50 focus:bg-white text-slate-700 font-medium"
                      />
                    </td>

                    {/* Column 7: Unit Price (Manual adjustment enabled) */}
                    <td className="px-3 py-3 text-right">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={item.unit_price}
                        onChange={(e) => handleItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className={`w-24 text-right text-xs p-1.5 rounded-md border font-mono font-bold ${
                          !item.unit_price || item.unit_price <= 0
                            ? 'border-rose-300 bg-rose-50 text-rose-700'
                            : 'border-slate-200 bg-slate-50 text-slate-900 focus:bg-white'
                        }`}
                        title="Manual rate adjustment allowed"
                      />
                    </td>

                    {/* Column 8: Discount % */}
                    <td className="px-2 py-3 text-center">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={item.discount_percent || 0}
                        onChange={(e) => handleItemChange(index, 'discount_percent', parseFloat(e.target.value) || 0)}
                        className="w-12 text-center text-xs p-1.5 rounded-md border border-slate-200 bg-slate-50 focus:bg-white"
                      />
                    </td>

                    {/* Column 9: GST % */}
                    <td className="px-2 py-3 text-center">
                      <select
                        value={item.gst_rate !== undefined ? item.gst_rate : 18}
                        onChange={(e) => handleItemChange(index, 'gst_rate', parseFloat(e.target.value))}
                        className="text-xs p-1 rounded-md border border-slate-200 bg-slate-50 focus:bg-white font-medium"
                      >
                        <option value={0}>0%</option>
                        <option value={5}>5%</option>
                        <option value={12}>12%</option>
                        <option value={18}>18%</option>
                        <option value={28}>28%</option>
                      </select>
                    </td>

                    {/* Column 10: Total Line Amount */}
                    <td className="px-3 py-3 text-right font-bold text-slate-900 font-mono text-xs">
                      {formatINR(item.lineTotal)}
                    </td>

                    {/* Column 11: Remove action */}
                    <td className="px-2 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors"
                        title="Remove Item"
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

        {/* Bottom Table Utility Bar */}
        {items.length > 0 && (
          <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddBlankItem}
                className="text-xs font-semibold text-[#044E54] hover:underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Add More Items
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Are you sure you want to clear all line items?')) {
                  setItems([]);
                  setIsStalePdf(true);
                }
              }}
              className="text-xs text-rose-600 hover:text-rose-800 font-medium"
            >
              Clear All Items
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 5. COMMERCIAL TERMS & FINANCIAL SUMMARY (2-COLUMN ZOHO-INSPIRED LAYOUT)    */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left (6 Cols): Terms, Bank Details & Notes */}
        <div className="lg:col-span-6 space-y-5">
          {/* Official Bank Account & GPay Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#044E54]" />
                Official Bank & Payment Information
              </h3>
              <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Verified Bank Profile
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 space-y-0.5">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Account Holder</span>
                <span className="font-bold text-slate-900 block">Udhayam Agencies</span>
                <span className="text-[11px] text-slate-600 block">Indian Bank • Perundurai</span>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 space-y-0.5">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Account Number & IFSC</span>
                <span className="font-mono font-bold text-slate-900 block">6659330152</span>
                <span className="text-[11px] font-mono text-slate-600 block">IFSC: IDIB000P034</span>
              </div>
            </div>

            <div className="p-2.5 bg-emerald-50/60 rounded-lg border border-emerald-200/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-700" />
                <span className="font-bold text-emerald-900 text-xs">GPay / PhonePe:</span>
                <span className="font-mono font-bold text-emerald-950 text-xs">+91 97156 22499</span>
              </div>
              <span className="text-[10px] text-emerald-700 font-semibold">MS Udhayam Agencies</span>
            </div>
          </div>

          {/* Terms & Conditions Box */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Commercial Terms & Notes
            </h3>
            <textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#044E54] leading-relaxed"
            />
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block mb-1 text-[11px] font-medium">Payment Terms</span>
                <input
                  type="text"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                />
              </div>
              <div>
                <span className="text-slate-500 block mb-1 text-[11px] font-medium">Delivery Terms</span>
                <input
                  type="text"
                  value={deliveryTerms}
                  onChange={(e) => setDeliveryTerms(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right (6 Cols): Zoho-Style Financial Summary Card */}
        <div className="lg:col-span-6 space-y-5">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Financial Summary & Tax Computation
              </h3>
              <span className="text-[11px] font-bold text-[#044E54]">
                {documentType === 'gst_quotation' ? 'Tax Invoice Model' : 'Commercial Estimate Model'}
              </span>
            </div>

            <div className="space-y-2.5 text-xs text-slate-600">
              {/* Gross Subtotal */}
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span>Subtotal (Gross Item Value):</span>
                <span className="font-mono font-semibold text-slate-800">{formatINR(subtotal)}</span>
              </div>

              {/* Discount */}
              {discountTotal > 0 && (
                <div className="flex justify-between py-1 border-b border-slate-100 text-emerald-700">
                  <span>Total Discount:</span>
                  <span className="font-mono font-semibold">-{formatINR(discountTotal)}</span>
                </div>
              )}

              {/* Taxable Amount */}
              {documentType === 'gst_quotation' && (
                <>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span>Taxable Amount (Net of GST):</span>
                    <span className="font-mono font-semibold text-slate-800">{formatINR(taxableAmount)}</span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span>Total GST Tax Component:</span>
                    <span className="font-mono font-semibold text-slate-800">{formatINR(taxTotal)}</span>
                  </div>
                </>
              )}

              {/* Delivery / Freight Charges */}
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span>Delivery / Freight Charges (+):</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={deliveryCharges}
                  onChange={(e) => {
                    setDeliveryCharges(parseFloat(e.target.value) || 0);
                    setIsStalePdf(true);
                  }}
                  className="w-24 text-right text-xs p-1 border border-slate-200 rounded font-mono"
                />
              </div>

              {/* Other Charges */}
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span>Other / Loading Charges (+):</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={otherCharges}
                  onChange={(e) => {
                    setOtherCharges(parseFloat(e.target.value) || 0);
                    setIsStalePdf(true);
                  }}
                  className="w-24 text-right text-xs p-1 border border-slate-200 rounded font-mono"
                />
              </div>

              {/* Grand Total */}
              <div className="pt-3 border-t-2 border-slate-200 flex justify-between items-center">
                <div>
                  <span className="text-sm font-bold text-slate-900 block">Grand Total</span>
                  <span className="text-[10px] text-slate-400 font-medium">All taxes & charges inclusive</span>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-[#044E54] font-mono tracking-tight block">
                    {formatINR(grandTotal)}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions inside Summary */}
            <div className="pt-4 grid grid-cols-2 gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPdfModalOpen(true)}
                className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>View PDF Document</span>
              </button>

              <button
                type="button"
                onClick={handleFinalizeQuotation}
                disabled={finalizeLoading || saveLoading}
                className="py-2.5 px-3 bg-[#044E54] hover:bg-[#033B40] text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
              >
                {finalizeLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#72B01D]" />
                )}
                <span>Approve & Finalize</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 6. MODALS: PRODUCT SELECTOR, PDF PREVIEW, WHATSAPP/EMAIL SHARE            */}
      {/* ========================================================================= */}

      {/* Product Selector Modal */}
      <ProductSelectorModal
        isOpen={selectorOpen}
        onClose={() => setSelectorOpen(false)}
        onSelectProduct={handleProductSelected}
      />

      {/* High-Resolution Live PDF Preview Modal */}
      <Modal
        isOpen={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        title={`Live Document Preview • ${quotationNumber || 'Draft'} (${paperSize})`}
        maxWidth="max-w-4xl"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#044E54]" />
              <span className="font-semibold text-slate-800">
                {quotationNumber || 'Quotation Draft'} • {paperSize} Layout
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRegeneratePdf}
                className="p-1.5 bg-white border border-slate-200 rounded text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1 font-medium"
                title="Regenerate PDF"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Sync Layout</span>
              </button>
              {quotationId && (
                <>
                  <a
                    href={api.getPdfUrl(quotationId, true) + `&t=${pdfRefreshKey}`}
                    download={`${quotationNumber || 'Quotation'}_Udhayam.pdf`}
                    className="p-1.5 bg-white border border-slate-200 rounded text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1 font-medium"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </a>
                  <a
                    href={api.getPdfUrl(quotationId, false) + `&refresh=true&t=${pdfRefreshKey}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 bg-[#044E54] text-white rounded hover:bg-[#033B40] transition-colors flex items-center gap-1 font-medium"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open in New Tab</span>
                  </a>
                </>
              )}
            </div>
          </div>

          <div className="bg-slate-200/70 p-2 rounded-xl flex items-center justify-center min-h-[520px]">
            {quotationId ? (
              <iframe
                key={pdfRefreshKey}
                src={api.getPdfUrl(quotationId, false) + `&refresh=true&t=${pdfRefreshKey}`}
                title="Quotation PDF Live Preview"
                className="w-full h-[600px] bg-white rounded-lg shadow-md border border-slate-300"
              />
            ) : (
              <div className="text-center p-8 text-xs text-slate-500 space-y-2">
                <FileText className="w-10 h-10 text-slate-300 mx-auto" />
                <p>Save draft to generate live PDF preview.</p>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Complete WhatsApp & Email Delivery Modal */}
      <Modal
        isOpen={whatsappModalOpen}
        onClose={() => setWhatsappModalOpen(false)}
        title="Share Quotation (WhatsApp & Email Delivery)"
        maxWidth="max-w-xl"
      >
        <div className="space-y-4 text-xs">
          {/* Header Summary Box */}
          <div className="p-3.5 bg-teal-50/50 border border-teal-100 rounded-xl flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Quotation Ref</span>
              <span className="font-bold text-[#044E54] text-sm">{quotationNumber || 'New Quote'}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Recipient</span>
              <span className="font-semibold text-slate-800">{customerName || 'Valued Customer'} {customerPhone ? `(${customerPhone})` : ''}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Grand Total</span>
              <span className="font-bold text-[#72B01D] text-sm">{formatINR(grandTotal)}</span>
            </div>
          </div>

          {/* Delivery Channel Switcher */}
          <div className="flex border-b border-slate-200">
            <button
              type="button"
              onClick={() => setShareTab('whatsapp')}
              className={`flex-1 py-2.5 text-center font-bold border-b-2 transition-colors flex items-center justify-center gap-2 ${
                shareTab === 'whatsapp'
                  ? 'border-[#044E54] text-[#044E54]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Smartphone className="w-4 h-4 text-[#72B01D]" />
              <span>WhatsApp Delivery</span>
            </button>
            <button
              type="button"
              onClick={() => setShareTab('email')}
              className={`flex-1 py-2.5 text-center font-bold border-b-2 transition-colors flex items-center justify-center gap-2 ${
                shareTab === 'email'
                  ? 'border-[#044E54] text-[#044E54]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Mail className="w-4 h-4 text-teal-600" />
              <span>Email PDF</span>
            </button>
          </div>

          {/* WhatsApp Share Flow */}
          {shareTab === 'whatsapp' && (
            <div className="space-y-4">
              {cloudWhatsAppSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{cloudWhatsAppSuccess}</span>
                </div>
              )}

              {cloudWhatsAppError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{cloudWhatsAppError}</span>
                </div>
              )}

              {/* 3-Step Guided Delivery Experience */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="text-[11px] uppercase font-bold text-slate-700 tracking-wider block">
                  How WhatsApp Sharing Works:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                  <div className="p-2 bg-white rounded-lg border border-slate-200/80">
                    <span className="font-bold text-[#044E54] block">1. PDF Download</span>
                    <span className="text-slate-500 text-[10px]">Auto-downloaded to your computer</span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200/80">
                    <span className="font-bold text-[#044E54] block">2. Text Copied</span>
                    <span className="text-slate-500 text-[10px]">Welcome message copied to clipboard</span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200/80">
                    <span className="font-bold text-[#044E54] block">3. Drag & Send</span>
                    <span className="text-slate-500 text-[10px]">Paste text and drag PDF into chat</span>
                  </div>
                </div>
              </div>

              {/* Message Content Preview */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-slate-700 text-[11px]">Welcome & Quotation Message:</span>
                  <button
                    type="button"
                    onClick={handleCopyMessage}
                    className="text-[#044E54] hover:text-[#033B40] font-semibold flex items-center gap-1"
                  >
                    {copiedMessage ? <Check className="w-3.5 h-3.5 text-[#72B01D]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedMessage ? 'Copied to Clipboard!' : 'Copy Message'}</span>
                  </button>
                </div>
                <pre className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-sans whitespace-pre-wrap text-slate-800 max-h-40 overflow-y-auto leading-relaxed">
                  {whatsappShareData?.messageText}
                </pre>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleNativeShareWithFile}
                  disabled={isSharingNative}
                  className="w-full py-2.5 px-3 bg-[#72B01D] hover:bg-[#5F9418] text-white rounded-lg font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-2"
                >
                  {isSharingNative ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Smartphone className="w-3.5 h-3.5" />}
                  <span>Share PDF & Message</span>
                </button>

                <button
                  type="button"
                  onClick={triggerDesktopShareFlow}
                  className="w-full py-2.5 px-3 bg-[#044E54] hover:bg-[#033B40] text-white rounded-lg font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-2"
                >
                  <Laptop className="w-3.5 h-3.5 text-[#72B01D]" />
                  <span>Open WhatsApp Web</span>
                </button>
              </div>

              {/* Optional Cloud API Direct Dispatch */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Official Meta Cloud API sending:</span>
                <button
                  type="button"
                  onClick={handleSendOfficialCloudWhatsApp}
                  disabled={sendingCloudWhatsApp}
                  className="text-[#044E54] hover:underline font-semibold flex items-center gap-1"
                >
                  {sendingCloudWhatsApp ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                  <span>Direct Cloud API Dispatch</span>
                </button>
              </div>
            </div>
          )}

          {/* Email Share Flow */}
          {shareTab === 'email' && (
            <div className="space-y-4">
              {emailSuccessMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{emailSuccessMessage}</span>
                </div>
              )}

              {emailErrorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{emailErrorMessage}</span>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-[11px]">
                  Recipient Email Address
                </label>
                <input
                  type="email"
                  value={emailRecipient}
                  onChange={(e) => setEmailRecipient(e.target.value)}
                  placeholder="client@company.com"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#044E54]"
                />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] space-y-1">
                <span className="font-semibold text-slate-700 block">Attachment:</span>
                <span className="font-mono text-[#044E54] block">
                  📄 {quotationNumber || 'Quotation'}_Udhayam.pdf (A5/A4 Single Sheet)
                </span>
                <span className="text-slate-400 block text-[10px]">
                  Includes full price computation, company GSTIN, and Indian Bank remittance details.
                </span>
              </div>

              <button
                type="button"
                onClick={handleSendEmail}
                disabled={sendingEmail || !emailRecipient.trim()}
                className="w-full py-2.5 px-3 bg-[#044E54] hover:bg-[#033B40] text-white rounded-lg font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {sendingEmail ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5 text-[#72B01D]" />}
                <span>{sendingEmail ? 'Dispatching Email...' : 'Send Quotation Email'}</span>
              </button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
