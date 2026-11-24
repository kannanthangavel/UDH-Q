import React, { useState, useEffect } from 'react';
import { 
  MessageCircle, Copy, Check, ExternalLink, X, AlertCircle, 
  FileText, Download, Share2, CheckCircle2, ArrowRight, Loader2, Sparkles,
  Smartphone, Monitor, Send
} from 'lucide-react';
import { api, getApiUrl, getAbsoluteApiUrl, getQuickDownloadUrl } from '../api/client';
import { useAuth } from '../context/AuthContext';

function formatItemsList(items) {
  if (!items || items.length === 0) return '• No items listed';
  return items.map((it, idx) => {
    const qty = it.quantity;
    const unit = it.unit || 'Nos';
    const rate = Number(it.sale_rate || 0).toFixed(2);
    const total = Number(it.line_total || 0).toFixed(2);
    const details = it.details ? `\n   ↳ _Note: ${it.details}_` : '';
    return `${idx + 1}. *${it.item_name}*${details}\n   ▫️ ${qty} ${unit} × ₹${rate} = *₹${total}*`;
  }).join('\n');
}

/**
 * Normalizes Indian mobile number cleanly to 10 digits
 */
export function normalizeIndianPhone(raw) {
  if (!raw) return '';
  let digits = String(raw).replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  }
  if (digits.length > 10) {
    digits = digits.slice(-10);
  }
  return digits;
}

/**
 * Formats any Date or string cleanly to DD/MM/YYYY
 */
function formatDateDMY(dateStr) {
  if (!dateStr) return '';
  const trimmed = String(dateStr).trim();
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
    return trimmed;
  }
  try {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
  } catch (e) {}
  return trimmed;
}

export default function WhatsAppShareModal({ quotation, onClose, onShared }) {
  if (!quotation) return null;

  const { settings } = useAuth();

  // Normalize phone number to Indian 10 digits
  const [phone, setPhone] = useState(() => normalizeIndianPhone(quotation.customer_phone));
  const [langTab, setLangTab] = useState('english'); // Default to requested official format
  const [copied, setCopied] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isSharingNative, setIsSharingNative] = useState(false);
  const [pdfDownloadedNotice, setPdfDownloadedNotice] = useState(false);
  const [shareSuccessNotice, setShareSuccessNotice] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [canShareFiles, setCanShareFiles] = useState(false);

  // Check if device supports native file sharing (Web Share API Level 2)
  useEffect(() => {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.canShare === 'function') {
        const dummyFile = new File([''], 'sample.pdf', { type: 'application/pdf' });
        if (navigator.canShare({ files: [dummyFile] })) {
          setCanShareFiles(true);
        }
      }
    } catch (e) {
      setCanShareFiles(false);
    }
  }, []);

  // Dynamically sync phone whenever quotation prop updates
  useEffect(() => {
    if (quotation?.customer_phone) {
      setPhone(normalizeIndianPhone(quotation.customer_phone));
    }
  }, [quotation?.customer_phone, quotation?.id]);

  const cleanDigits = normalizeIndianPhone(phone);
  const isValidPhone = cleanDigits.length === 10;
  const targetRecipient = isValidPhone ? `91${cleanDigits}` : '';

  const grandTotalFormatted = Number(quotation.grand_total || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const quoteDateFormatted = formatDateDMY(quotation.quotation_date) || new Date().toLocaleDateString('en-GB');

  let validTillFormatted = formatDateDMY(quotation.validity_date);
  if (!validTillFormatted) {
    try {
      const baseDate = quotation.quotation_date ? new Date(quotation.quotation_date) : new Date();
      const d = isNaN(baseDate.getTime()) ? new Date() : baseDate;
      d.setDate(d.getDate() + 8);
      validTillFormatted = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    } catch (e) {
      validTillFormatted = '26/11/2026';
    }
  }

  const pdfFormat = quotation.paper_format || 'A4';
  const cleanCustomerName = (quotation.customer_name || 'Customer').trim().replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const cleanQuoteNum = (quotation.quotation_number || 'Quote').trim().replace(/[^A-Za-z0-9\-]+/g, '_');
  const targetPdfFilename = `${cleanCustomerName}_${cleanQuoteNum}.pdf`;
  const pdfDownloadUrl = getQuickDownloadUrl('quote', quotation.id || quotation.quotation_number);

  // EXACT OFFICIAL MESSAGE REQUESTED BY USER
  const officialQuotationMessage = 
`Hello ${quotation.customer_name || 'Customer'},

On behalf of UDHAYAM AGENCIES - Perundurai, please find the quotation details below:

📋 Quotation No: ${quotation.quotation_number}
📅 Date: ${quoteDateFormatted}
💰 Total Amount: ₹${grandTotalFormatted}
⏳ Valid Till: ${validTillFormatted}

📄 Download Quotation PDF:
${pdfDownloadUrl}

Please feel free to contact us for any changes or additional details.

📞 +91 97156 22499
📞 +91 88700 22499

Thank you,
UDHAYAM AGENCIES`;

  // Native caption used when PDF document is directly attached to the share payload
  const nativeFileCaption = 
`Hello ${quotation.customer_name || 'Customer'},

On behalf of UDHAYAM AGENCIES - Perundurai, please find the quotation details below:

📋 Quotation No: ${quotation.quotation_number}
📅 Date: ${quoteDateFormatted}
💰 Total Amount: ₹${grandTotalFormatted}
⏳ Valid Till: ${validTillFormatted}

Please feel free to contact us for any changes or additional details.

📞 +91 97156 22499
📞 +91 88700 22499

Thank you,
UDHAYAM AGENCIES`;

  const urlSafeSummaries = {
    english: officialQuotationMessage,
    tamil: 
`வணக்கம் ${quotation.customer_name || 'சார் / மேடம்'}! 🙏
*UDHAYAM AGENCIES - Perundurai*

📋 *மதிப்பீடு எண்:* ${quotation.quotation_number}
📅 *தேதி:* ${quoteDateFormatted}
💰 *மொத்தத் தொகை:* *₹${grandTotalFormatted}*
⏳ *செல்லுபடியாகும் நாள்:* ${validTillFormatted}

📄 *PDF பதிவிறக்கம்:*
${pdfDownloadUrl}

📞 +91 97156 22499
📞 +91 88700 22499
நன்றி! UDHAYAM AGENCIES`,

    tanglish: 
`Hello ${quotation.customer_name || 'Sir / Madam'}! 🙏
*UDHAYAM AGENCIES - Perundurai*

📋 *Quotation No:* ${quotation.quotation_number}
📅 *Date:* ${quoteDateFormatted}
💰 *Total Amount:* *₹${grandTotalFormatted}*
⏳ *Valid Till:* ${validTillFormatted}

📄 *Download PDF:*
${pdfDownloadUrl}

📞 +91 97156 22499
📞 +91 88700 22499
Thank you! UDHAYAM AGENCIES`
  };

  const [message, setMessage] = useState(() => officialQuotationMessage);

  function handleTabChange(tabKey) {
    setLangTab(tabKey);
    setMessage(urlSafeSummaries[tabKey] || officialQuotationMessage);
  }

  function handleCopyMessage() {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  /**
   * 1-Click Native Share with PDF Document File Attached
   * Compulsory document attachment with zero manual uploading or selecting
   */
  async function handleShareWithPdfFile() {
    setErrorMessage('');
    setIsSharingNative(true);

    try {
      // 1. Fetch official PDF document buffer
      const pdfEndpoint = getApiUrl(`/quotations/${quotation.id}/pdf?format=${pdfFormat}&download=true`);
      const pdfRes = await fetch(pdfEndpoint);
      if (!pdfRes.ok) {
        throw new Error('Unable to retrieve PDF from backend server.');
      }
      const pdfBlob = await pdfRes.blob();
      const pdfFile = new File([pdfBlob], targetPdfFilename, { type: 'application/pdf' });

      // 2. Check if device supports Web Share API with files (Android, iOS, macOS/Windows Edge)
      if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          title: `Quotation ${quotation.quotation_number}`,
          text: nativeFileCaption,
          files: [pdfFile]
        });
        setShareSuccessNotice(true);
        api.auditShare(quotation.id, 'whatsapp', isValidPhone ? `+91${cleanDigits}` : 'native-share').catch(() => {});
        if (onShared) onShared();
        return;
      }

      // 3. Fallback: If device supports text share
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: `Quotation ${quotation.quotation_number}`,
          text: message || officialQuotationMessage,
          url: pdfDownloadUrl
        });
        setShareSuccessNotice(true);
        api.auditShare(quotation.id, 'whatsapp', isValidPhone ? `+91${cleanDigits}` : 'native-share').catch(() => {});
        if (onShared) onShared();
        return;
      }

      // 4. Fallback for Desktop browser without native share: open WhatsApp Web
      handleShareToWhatsApp('web');
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('Native share error or dismissed, opening WhatsApp Web:', err);
        handleShareToWhatsApp('web');
      }
    } finally {
      setIsSharingNative(false);
    }
  }

  /**
   * WhatsApp Web / App Direct Chat Handler
   * Pre-fills exact message with live PDF link and auto-downloads PDF locally
   */
  function handleShareToWhatsApp(channel = 'web') {
    setErrorMessage('');

    if (!isValidPhone) {
      setErrorMessage('Please enter a valid 10-digit Indian mobile number (e.g. 9842711223).');
      return;
    }

    const recipient = `91${cleanDigits}`;
    const safeText = message || urlSafeSummaries[langTab] || officialQuotationMessage;
    const encodedText = encodeURIComponent(safeText);

    let targetUrl = '';
    if (channel === 'web') {
      targetUrl = `https://web.whatsapp.com/send/?phone=${recipient}&text=${encodedText}`;
    } else if (channel === 'app') {
      targetUrl = `https://api.whatsapp.com/send?phone=${recipient}&text=${encodedText}`;
    } else {
      targetUrl = `https://wa.me/${recipient}?text=${encodedText}`;
    }

    // 1. MUST EXECUTE SYNCHRONOUSLY FIRST to guarantee browser popup blocker will not block it
    window.open(targetUrl, '_blank', 'noopener,noreferrer');

    // 2. Trigger instant PDF download without delaying or blocking window.open
    try {
      const downloadLink = document.createElement('a');
      downloadLink.href = getApiUrl(`/quotations/${quotation.id}/pdf?format=${pdfFormat}&download=true`);
      downloadLink.download = `${quotation.quotation_number}.pdf`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      setPdfDownloadedNotice(true);
    } catch (e) {
      console.warn('PDF auto-download notice:', e);
    }

    // 3. Asynchronously audit share event
    api.auditShare(quotation.id, 'whatsapp', `+${recipient}`).catch(e => console.warn(e));
    if (onShared) onShared();
  }

  async function handleDownloadPdfOnly() {
    try {
      setIsDownloadingPdf(true);
      setErrorMessage('');
      const pdfRes = await fetch(getApiUrl(`/quotations/${quotation.id}/pdf?format=${pdfFormat}&download=true`));
      const contentType = pdfRes.headers.get('content-type') || '';
      if (!pdfRes.ok || !contentType.includes('application/pdf')) {
        throw new Error('Failed to fetch quotation PDF. Please verify backend server connection.');
      }
      const blob = await pdfRes.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = targetPdfFilename;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(downloadUrl);
      link.remove();
      setPdfDownloadedNotice(true);
    } catch (err) {
      setErrorMessage('Error downloading PDF: ' + err.message);
    } finally {
      setIsDownloadingPdf(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="bg-[#00545C] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-300">
              <MessageCircle className="w-5 h-5 text-[#25D366]" />
            </div>
            <div>
              <h3 className="font-extrabold text-base leading-tight">Share Quotation via WhatsApp</h3>
              <p className="text-xs text-emerald-200 font-mono">
                {quotation.quotation_number} • {quotation.customer_name}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">

          {/* Active Notifications */}
          {errorMessage && (
            <div className="bg-rose-50 border border-rose-300 text-rose-900 px-4 py-3 rounded-xl flex items-center space-x-2 text-xs font-bold animate-in fade-in">
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {shareSuccessNotice && (
            <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-xl flex items-center space-x-2 text-xs font-bold animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <span>Quotation and PDF document successfully shared to WhatsApp!</span>
            </div>
          )}

          {/* Compulsory Document Notice */}
          <div className="bg-emerald-50/80 border border-emerald-200 p-3 rounded-xl flex items-start space-x-2.5 text-xs text-emerald-950">
            <FileText className="w-4 h-4 text-[#00545C] mt-0.5 flex-shrink-0" />
            <div className="text-[11px] leading-relaxed">
              <span className="font-bold text-[#00545C] block">Compulsory PDF Document Delivery:</span>
              The official quotation PDF (<strong className="font-mono">{quotation.quotation_number}.pdf</strong>) is attached directly with your message. On desktop, it auto-downloads and includes a direct cloud link for the customer!
            </div>
          </div>
          
          {/* Recipient Phone with Live Target Indicator */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Customer WhatsApp Mobile Number
              </label>
              <span className="text-[11px] text-slate-400 font-mono">10-Digit Mobile</span>
            </div>
            <div className="flex rounded-xl shadow-xs border border-slate-300 overflow-hidden focus-within:ring-2 focus-within:ring-[#00545C]">
              <span className="inline-flex items-center px-3.5 bg-slate-100 text-slate-700 text-xs font-bold border-r border-slate-300">
                +91
              </span>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 9842711223"
                className="w-full px-3 py-2 text-sm font-semibold text-slate-900 focus:outline-none"
              />
            </div>

            {/* Direct Target Status Badge */}
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs">
              <div className="flex items-center space-x-1.5 text-slate-700 font-medium">
                <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${isValidPhone ? 'text-emerald-600' : 'text-slate-400'}`} />
                <span>
                  Target Chat: <strong className="font-mono text-slate-900 text-xs">{isValidPhone ? `+91 ${cleanDigits}` : '(Enter 10-digit number)'}</strong>
                </span>
              </div>
              {isValidPhone && (
                <div className="flex items-center space-x-1.5">
                  <a
                    href={`https://web.whatsapp.com/send/?phone=91${cleanDigits}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1 text-emerald-800 hover:text-emerald-950 font-bold bg-white px-2 py-0.5 rounded-md border border-emerald-300 shadow-xs hover:bg-emerald-50 transition-colors cursor-pointer text-[11px]"
                    title="Open chat in WhatsApp Web"
                  >
                    <span>Web Chat</span>
                    <ExternalLink className="w-3 h-3 ml-0.5" />
                  </a>
                  <a
                    href={`https://api.whatsapp.com/send?phone=91${cleanDigits}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1 text-slate-700 hover:text-slate-950 font-bold bg-white px-2 py-0.5 rounded-md border border-slate-300 shadow-xs hover:bg-slate-50 transition-colors cursor-pointer text-[11px]"
                    title="Open in WhatsApp Desktop App or Mobile"
                  >
                    <span>App</span>
                    <ExternalLink className="w-3 h-3 ml-0.5" />
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Language Tabs Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Message Template
              </label>
              <span className="text-[11px] text-slate-400">Official format pre-filled</span>
            </div>

            <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => handleTabChange('english')}
                className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                  langTab === 'english'
                    ? 'bg-[#00545C] text-white shadow-sm'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <span>🇬🇧 Official Standard</span>
              </button>
              <button
                type="button"
                onClick={() => handleTabChange('tamil')}
                className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                  langTab === 'tamil'
                    ? 'bg-[#00545C] text-white shadow-sm'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <span>🇮🇳 தமிழ் (Tamil)</span>
              </button>
              <button
                type="button"
                onClick={() => handleTabChange('tanglish')}
                className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                  langTab === 'tanglish'
                    ? 'bg-[#00545C] text-white shadow-sm'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <span>🗣️ Tanglish</span>
              </button>
            </div>
          </div>

          {/* Message Preview Box */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Quotation Message (Included with PDF)
              </label>
              <button
                type="button"
                onClick={handleCopyMessage}
                className="flex items-center space-x-1 text-xs text-emerald-700 hover:text-emerald-800 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy Message'}</span>
              </button>
            </div>
            <textarea
              rows={8}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full text-xs font-mono p-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00545C] leading-relaxed"
            />
          </div>

          {/* PDF Download Direct Bar */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FileText className="w-4 h-4 text-[#00545C]" />
              <div>
                <span className="text-xs font-bold text-slate-800 block">
                  Official PDF Document ({pdfFormat} Format)
                </span>
                <span className="text-[10px] text-slate-400">
                  Udhayam logo, bank settlement details & UPI QR
                </span>
              </div>
            </div>
            <button
              type="button"
              disabled={isDownloadingPdf}
              onClick={handleDownloadPdfOnly}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isDownloadingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00545C]" />
              ) : (
                <Download className="w-3.5 h-3.5 text-[#00545C]" />
              )}
              <span>{isDownloadingPdf ? 'Downloading…' : 'Download PDF'}</span>
            </button>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            Close
          </button>

          <div className="flex items-center space-x-2">
            {/* Desktop App fallback */}
            <button
              type="button"
              onClick={() => handleShareToWhatsApp('app')}
              title="Open in WhatsApp Desktop application or mobile app"
              className="flex items-center space-x-1.5 px-3 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs transition-all cursor-pointer active:scale-95"
            >
              <Smartphone className="w-4 h-4 text-slate-600" />
              <span className="hidden sm:inline">WhatsApp App</span>
            </button>

            {/* 1-Click Native Share (Attaches PDF file directly) */}
            <button
              type="button"
              disabled={isSharingNative}
              onClick={handleShareWithPdfFile}
              title="Attaches official PDF document directly with this message into WhatsApp without manual uploading"
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white font-black text-xs shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSharingNative ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Preparing PDF & Sharing...</span>
                </>
              ) : (
                <>
                  <MessageCircle className="w-4 h-4 text-white" />
                  <span>Share WhatsApp (with PDF Document)</span>
                  <ArrowRight className="w-3.5 h-3.5 text-white" />
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
