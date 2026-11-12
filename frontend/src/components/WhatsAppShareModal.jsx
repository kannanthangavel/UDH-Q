import React, { useState, useEffect } from 'react';
import { 
  MessageCircle, Copy, Check, ExternalLink, X, AlertCircle, 
  FileText, Download, Share2, CheckCircle2, ArrowRight, Loader2, Sparkles,
  Smartphone, Monitor, HelpCircle
} from 'lucide-react';
import { api } from '../api/client';
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
 * Strips non-digits, leading country code +91 / 91, or leading 0
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

export default function WhatsAppShareModal({ quotation, onClose, onShared }) {
  if (!quotation) return null;

  const { settings } = useAuth();

  // Normalize phone number to Indian 10 digits
  const [phone, setPhone] = useState(() => normalizeIndianPhone(quotation.customer_phone));
  const [langTab, setLangTab] = useState('tamil'); // 'tamil' | 'tanglish' | 'english'
  const [copied, setCopied] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [pdfDownloadedNotice, setPdfDownloadedNotice] = useState(false);
  const [shareSuccessNotice, setShareSuccessNotice] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Dynamically sync phone whenever quotation prop updates
  useEffect(() => {
    if (quotation?.customer_phone) {
      setPhone(normalizeIndianPhone(quotation.customer_phone));
    }
  }, [quotation?.customer_phone, quotation?.id]);

  const cleanDigits = normalizeIndianPhone(phone);
  const isValidPhone = cleanDigits.length === 10;
  const targetRecipient = isValidPhone ? `91${cleanDigits}` : '';

  const itemsCount = quotation.items ? quotation.items.length : 0;
  const subtotalFormatted = Number(quotation.subtotal || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  const discountFormatted = Number(quotation.discount_amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  const gstFormatted = Number(quotation.gst_amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  const deliveryFormatted = Number(quotation.delivery_charges || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  const grandTotalFormatted = Number(quotation.grand_total || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const companyName = settings?.company_name || 'UDHAYAM AGENCIES';
  const divisionName = settings?.company_division || 'Paint Division';
  const companyPhone = settings?.company_phone || '+91 97156 22499';
  const gpayNumber = settings?.gpay_number || '+91 97156 22499';
  const itemsText = formatItemsList(quotation.items);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const pdfFormat = quotation.paper_format || 'A4';
  const pdfDownloadUrl = `${origin}/api/quotations/${quotation.id}/pdf?format=${pdfFormat}&download=true`;

  // 1. URL-Safe Concise Summaries (< 400 chars raw, < 1,200 bytes encoded)
  // This guarantees WhatsApp Web never drops the phone parameter or exceeds URL buffers!
  const urlSafeSummaries = {
    tamil: 
`வணக்கம் ${quotation.customer_name || 'சார் / மேடம்'}! 🙏
*${companyName} (${divisionName})*

📋 *மதிப்பீடு எண்:* ${quotation.quotation_number}
📅 *தேதி:* ${quotation.quotation_date}
💰 *மொத்தத் தொகை:* *₹${grandTotalFormatted}* (${itemsCount} பொருட்கள், GST உள்ளடக்கம்)

📄 *உத்தியோகபூர்வ PDF ஆவணம்:*
${pdfDownloadUrl}

💳 *UPI / GPay:* ${gpayNumber}
📞 *அழைக்க:* ${companyPhone}
நன்றி! 🙏`,

    tanglish: 
`Vanakkam ${quotation.customer_name || 'Sir / Madam'}! 🙏
*${companyName} (${divisionName})*

📋 *Quotation No:* ${quotation.quotation_number}
📅 *Date:* ${quotation.quotation_date}
💰 *Grand Total:* *₹${grandTotalFormatted}* (${itemsCount} items, GST incl.)

📄 *Download Official PDF Document:*
${pdfDownloadUrl}

💳 *UPI / GPay:* ${gpayNumber}
📞 *Call:* ${companyPhone}
Nandri! Thank you! 🙏`,

    english: 
`Dear ${quotation.customer_name || 'Customer'},

Greetings from *${companyName} (${divisionName})*! 🎨
Your official paint quotation is ready:

📋 *Quotation No:* ${quotation.quotation_number}
📅 *Date:* ${quotation.quotation_date}
💰 *Grand Total:* *₹${grandTotalFormatted}* (${itemsCount} items, GST incl.)

📄 *Download Official PDF Document:*
${pdfDownloadUrl}

💳 *UPI / GPay:* ${gpayNumber}
📞 *Contact:* ${companyPhone}
Thank you for your business! 🙏`
  };

  // 2. Full Detailed Templates (For copying the full line-item breakdown)
  const fullTemplates = {
    tamil: 
`வணக்கம் ${quotation.customer_name || 'சார் / மேடம்'}! 🙏

*${companyName} (${divisionName})* - பெருந்துறை 🎨✨
தங்களின் கோரிக்கையின்படி தயார் செய்யப்பட்ட உத்தியோகபூர்வ மதிப்பீட்டு ரசீது (Quotation) விபரம்:

📋 *மதிப்பீடு எண்:* ${quotation.quotation_number}
📅 *தேதி:* ${quotation.quotation_date}
⏳ *செல்லுபடியாகும் காலம்:* ${quotation.validity_date || '7 நாட்கள்'}

🛒 *பொருட்கள் விபரம் (Quotation Items):*
${itemsText}

──────────────────────
📊 *தொகை விவரம் (Summary):*
• மொத்த மதிப்பு (Subtotal): ₹${subtotalFormatted}
${quotation.discount_amount > 0 ? `• தள்ளுபடி (Discount): − ₹${discountFormatted}\n` : ''}• GST வரி (18% Included): ₹${gstFormatted}
${quotation.delivery_charges > 0 ? `• டெலிவரி / வண்டி வாடகை: ₹${deliveryFormatted}\n` : ''}💰 *நிகர மொத்தத் தொகை (Grand Total): ₹${grandTotalFormatted}*

📄 *உத்தியோகபூர்வ PDF ஆவணம் (Official PDF Document):*
${pdfDownloadUrl}

✅ *முக்கிய குறிப்பு:*
• அனைத்து பொருட்களின் விலையும் GST வரி உள்ளடக்கியது.
• ஒரிஜினல் கம்பெனி தயாரிப்புகள் மற்றும் உடனடி சப்ளை.

💳 *GPay / PhonePe / UPI Payment:*
📱 UPI: ${gpayNumber}

ஏதேனும் திருத்தங்கள் அல்லது விவரங்கள் தேவைப்பட்டால் அழைக்கவும்:
📞 ${companyPhone}

நன்றி! மீண்டும் வருக! 🙏🌟`,

    tanglish:
`Vanakkam ${quotation.customer_name || 'Sir / Madam'}! 🙏

*${companyName} (${divisionName})* - Perundurai 🎨✨
Official Quotation summary details:

📋 *Quotation No:* ${quotation.quotation_number}
📅 *Date:* ${quotation.quotation_date}
⏳ *Valid Until:* ${quotation.validity_date || '7 Days'}

🛒 *Items List:*
${itemsText}

──────────────────────
📊 *Calculation Summary:*
• Subtotal: ₹${subtotalFormatted}
${quotation.discount_amount > 0 ? `• Discount: − ₹${discountFormatted}\n` : ''}• Included GST (18%): ₹${gstFormatted}
${quotation.delivery_charges > 0 ? `• Delivery / Transport: ₹${deliveryFormatted}\n` : ''}💰 *Grand Total: ₹${grandTotalFormatted}*

📄 *Download Official PDF Document:*
${pdfDownloadUrl}

✅ *Key Notes:*
• All product rates are inclusive of GST as per official rate sheet.
• Genuine brand materials & prompt delivery assured.

💳 *GPay / UPI Payment:*
📱 GPay / PhonePe: ${gpayNumber}

For immediate confirmation or changes:
📞 ${companyPhone}

Nandri! Thank you for choosing Udhayam Agencies! 🙏🌟`,

    english:
`Dear ${quotation.customer_name || 'Customer'},

Greetings from *${companyName} (${divisionName})*! 🎨✨

Please find your official paint quotation summary below:

📋 *Quotation No:* ${quotation.quotation_number}
📅 *Date:* ${quotation.quotation_date}
⏳ *Valid Until:* ${quotation.validity_date || '7 days'}

🛒 *Products & Materials:*
${itemsText}

──────────────────────
📊 *Financial Summary:*
• Subtotal: ₹${subtotalFormatted}
${quotation.discount_amount > 0 ? `• Discount: − ₹${discountFormatted}\n` : ''}• GST (18% Included): ₹${gstFormatted}
${quotation.delivery_charges > 0 ? `• Transport / Delivery: ₹${deliveryFormatted}\n` : ''}💰 *Grand Total: ₹${grandTotalFormatted}*

📄 *Official Quotation PDF Document:*
${pdfDownloadUrl}

✅ *Terms & Notes:*
• All prices are inclusive of GST as per official price list.
• Authentic manufacturer materials guaranteed.

💳 *Payment & GPay / UPI:*
📱 GPay / PhonePe: ${gpayNumber}

For any inquiries or delivery dispatch:
📞 ${companyPhone}

Thank you for your business! 🙏🌟`
  };

  const [message, setMessage] = useState(fullTemplates.tamil);

  function handleTabChange(tabKey) {
    setLangTab(tabKey);
    setMessage(fullTemplates[tabKey]);
  }

  function handleCopyFull() {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleCopySummary() {
    const sum = urlSafeSummaries[langTab] || urlSafeSummaries.english;
    navigator.clipboard.writeText(sum);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  }

  /**
   * Core WhatsApp Share Handler
   * 1. Validates 10-digit phone
   * 2. SYNCHRONOUSLY executes window.open() to prevent browser popup blocking
   * 3. Triggers PDF download in background
   * 4. Logs audit event asynchronously
   * 
   * @param {'web' | 'app' | 'wame'} channel
   */
  function handleShareToWhatsApp(channel = 'web') {
    setErrorMessage('');

    if (!isValidPhone) {
      setErrorMessage('Please enter a valid 10-digit Indian mobile number (e.g. 8248221211).');
      return;
    }

    const recipient = `91${cleanDigits}`;
    const safeText = urlSafeSummaries[langTab] || urlSafeSummaries.english;
    const encodedText = encodeURIComponent(safeText);

    let targetUrl = '';
    if (channel === 'web') {
      // Directly opens WhatsApp Web into the specific recipient's chat window
      targetUrl = `https://web.whatsapp.com/send/?phone=${recipient}&text=${encodedText}`;
    } else if (channel === 'app') {
      // Opens WhatsApp Desktop app or mobile app directly into recipient chat
      targetUrl = `https://api.whatsapp.com/send?phone=${recipient}&text=${encodedText}`;
    } else {
      targetUrl = `https://wa.me/${recipient}?text=${encodedText}`;
    }

    // 1. MUST EXECUTE SYNCHRONOUSLY FIRST to guarantee browser popup blocker will NOT block it!
    window.open(targetUrl, '_blank', 'noopener,noreferrer');

    // 2. Trigger instant PDF download without delaying or blocking window.open
    try {
      const downloadLink = document.createElement('a');
      downloadLink.href = `/api/quotations/${quotation.id}/pdf?format=${pdfFormat}&download=true`;
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
      const pdfRes = await fetch(`/api/quotations/${quotation.id}/pdf?format=${pdfFormat}&download=true`);
      if (!pdfRes.ok) throw new Error('Failed to fetch quotation PDF');
      const blob = await pdfRes.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${quotation.quotation_number}.pdf`;
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
                {quotation.quotation_number} • {quotation.customer_name} ({itemsCount} items)
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

          {pdfDownloadedNotice ? (
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-400 text-emerald-950 p-4 rounded-xl text-xs space-y-2 animate-in fade-in shadow-sm">
              <div className="flex items-center space-x-2 font-black text-emerald-900 text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <span>PDF Document Ready: {quotation.quotation_number}.pdf</span>
              </div>
              <p className="text-xs text-emerald-800 leading-relaxed font-semibold">
                📥 The official PDF document has been downloaded to your computer!
              </p>
              <div className="bg-white/80 p-2.5 rounded-lg border border-emerald-200 text-[11px] text-slate-700 space-y-1">
                <p className="font-bold text-slate-900">👉 How to attach in WhatsApp Web:</p>
                <p>1. Drag and drop the downloaded <strong>{quotation.quotation_number}.pdf</strong> file directly into WhatsApp Web chat.</p>
                <p>2. Or in WhatsApp, click the <strong>📎 (Attach)</strong> icon → choose <strong>Document</strong> → select the downloaded file.</p>
                <p>3. The message text also contains the direct cloud download link for the customer!</p>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-start space-x-2.5 text-xs text-slate-600">
              <FileText className="w-4 h-4 text-[#00545C] mt-0.5 flex-shrink-0" />
              <div className="text-[11px] leading-relaxed">
                <span className="font-bold text-slate-800 block">Direct WhatsApp Chat & Document Delivery:</span>
                Clicking <strong>Share to WhatsApp</strong> opens the chat with <strong className="text-slate-900">{quotation.customer_name || 'Customer'}</strong> directly in WhatsApp Web and auto-downloads the official PDF (<span className="font-mono font-bold text-[#00545C]">{quotation.quotation_number}.pdf</span>). Simply attach or send!
              </div>
            </div>
          )}
          
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
                placeholder="e.g. 8248221211"
                className="w-full px-3 py-2 text-sm font-semibold text-slate-900 focus:outline-none"
              />
            </div>

            {/* Direct Target Status Badge */}
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs">
              <div className="flex items-center space-x-1.5 text-emerald-950 font-medium">
                <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${isValidPhone ? 'text-emerald-600' : 'text-slate-400'}`} />
                <span>
                  Target Chat: <strong className="font-mono text-emerald-800 text-xs">{isValidPhone ? `+91 ${cleanDigits}` : '(Enter valid 10-digit number)'}</strong>
                </span>
              </div>
              {isValidPhone && (
                <div className="flex items-center space-x-1.5">
                  <a
                    href={`https://web.whatsapp.com/send/?phone=91${cleanDigits}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1 text-emerald-800 hover:text-emerald-950 font-bold bg-white px-2 py-0.5 rounded-md border border-emerald-300 shadow-xs hover:bg-emerald-50 transition-colors cursor-pointer text-[11px]"
                    title="Test direct link to customer chat in WhatsApp Web"
                  >
                    <span>Direct Web Chat</span>
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
                Select Message Language
              </label>
              <span className="text-[11px] text-slate-400">Includes PDF link & UPI info</span>
            </div>

            <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1 rounded-xl">
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
              <button
                type="button"
                onClick={() => handleTabChange('english')}
                className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                  langTab === 'english'
                    ? 'bg-[#00545C] text-white shadow-sm'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <span>🇬🇧 English</span>
              </button>
            </div>
          </div>

          {/* Message Preview Box */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Full Quotation Breakdown
              </label>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleCopySummary}
                  className="flex items-center space-x-1 text-[11px] text-slate-600 hover:text-slate-900 font-bold bg-slate-100 px-2 py-1 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                  title="Copy concise message with PDF link & total"
                >
                  {copiedSummary ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedSummary ? 'Copied' : 'Copy Summary'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyFull}
                  className="flex items-center space-x-1 text-xs text-emerald-700 hover:text-emerald-800 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied All!' : 'Copy Full Details'}</span>
                </button>
              </div>
            </div>
            <textarea
              rows={7}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full text-xs font-mono p-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00545C] leading-relaxed"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              💡 The direct WhatsApp link pre-fills a concise summary with PDF link so WhatsApp Web opens instantly into the chat without error. You can also paste the full itemized breakdown above!
            </p>
          </div>

          {/* Compulsory Document Sharing Option Bar */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FileText className="w-4 h-4 text-[#00545C]" />
              <div>
                <span className="text-xs font-bold text-slate-800 block">
                  Official PDF Document ({pdfFormat} Format)
                </span>
                <span className="text-[10px] text-slate-400">
                  Crisp layout with bank details, QR code, and items
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
            {/* Desktop App / Mobile fallback button */}
            <button
              type="button"
              onClick={() => handleShareToWhatsApp('app')}
              title="Open in WhatsApp Desktop application or mobile app"
              className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs transition-all cursor-pointer active:scale-95"
            >
              <Smartphone className="w-4 h-4 text-slate-600" />
              <span className="hidden sm:inline">WhatsApp App</span>
            </button>

            {/* Primary Button: WhatsApp Web Direct Chat */}
            <button
              type="button"
              onClick={() => handleShareToWhatsApp('web')}
              title="Directly opens WhatsApp Web into customer chat and auto-downloads PDF"
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white font-black text-xs shadow-md active:scale-95 transition-all cursor-pointer"
            >
              <MessageCircle className="w-4 h-4 text-white" />
              <span>Share to WhatsApp (with PDF Document)</span>
              <ArrowRight className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
