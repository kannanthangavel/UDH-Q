import React, { useState, useEffect } from 'react';
import { 
  MessageCircle, Copy, Check, ExternalLink, X, AlertCircle, 
  FileText, Download, Share2, CheckCircle2, ArrowRight, Loader2, Sparkles
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

export default function WhatsAppShareModal({ quotation, onClose, onShared }) {
  if (!quotation) return null;

  const { settings } = useAuth();

  // Normalize phone number to Indian 10 digits
  const rawPhone = quotation.customer_phone || '';
  const digitsOnly = rawPhone.replace(/\D/g, '');
  const tenDigitPhone = digitsOnly.length > 10 ? digitsOnly.slice(-10) : digitsOnly;

  const [phone, setPhone] = useState(tenDigitPhone);
  const [langTab, setLangTab] = useState('tamil'); // 'tamil' | 'tanglish' | 'english'
  const [copied, setCopied] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [pdfDownloadedNotice, setPdfDownloadedNotice] = useState(false);
  const [shareSuccessNotice, setShareSuccessNotice] = useState(false);

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

  // High-Quality Verified Templates with Direct PDF Document Link
  const templates = {
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

  const [message, setMessage] = useState(templates.tamil);

  function handleTabChange(tabKey) {
    setLangTab(tabKey);
    setMessage(templates[tabKey]);
  }

  function handleCopy() {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Primary Action: Share with PDF Document attached
  async function handleShareWithPdf() {
    if (isSending) return;
    setIsSending(true);

    const cleanPhone = phone.replace(/\D/g, '');
    const recipient = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

    try {
      // 1. Fetch PDF binary blob from backend
      const pdfRes = await fetch(`/api/quotations/${quotation.id}/pdf?format=${pdfFormat}&download=true`);
      if (!pdfRes.ok) throw new Error('Failed to generate quotation PDF');
      const blob = await pdfRes.blob();
      const pdfFileName = `${quotation.quotation_number}.pdf`;
      const pdfFile = new File([blob], pdfFileName, { type: 'application/pdf' });

      // Audit sharing event
      await api.auditShare(quotation.id, 'whatsapp', `+${recipient}`).catch(e => console.warn(e));
      if (onShared) onShared();

      // If browser supports Web Share API Level 2 with file attachments (e.g. Android Chrome, iOS Safari)
      if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          title: `Quotation ${quotation.quotation_number} - ${companyName}`,
          text: message,
          files: [pdfFile]
        });
        setShareSuccessNotice(true);
        setTimeout(() => setShareSuccessNotice(false), 5000);
        return;
      }

      // Desktop / Unsupported Web Share:
      // 1) Trigger direct download of the PDF file to user's device
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = pdfFileName;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(downloadUrl);
      link.remove();

      setPdfDownloadedNotice(true);

      // 2) Open WhatsApp Web with the chat and message containing the direct PDF download link
      const waUrl = `https://wa.me/${recipient}?text=${encodeURIComponent(message)}`;
      window.open(waUrl, '_blank', 'noopener,noreferrer');

    } catch (err) {
      console.warn('PDF Share error:', err);
      const waUrl = `https://wa.me/${recipient}?text=${encodeURIComponent(message)}`;
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    } finally {
      setIsSending(false);
    }
  }

  async function handleDownloadPdfOnly() {
    try {
      setIsDownloadingPdf(true);
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
      alert('Error downloading PDF: ' + err.message);
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
              <MessageCircle className="w-5 h-5 text-[#7DBA00]" />
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
          {shareSuccessNotice && (
            <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-xl flex items-center space-x-2 text-xs font-bold animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <span>Quotation and PDF document successfully shared to WhatsApp!</span>
            </div>
          )}

          {pdfDownloadedNotice && (
            <div className="bg-teal-50 border border-teal-300 text-teal-950 p-3.5 rounded-xl text-xs space-y-1.5 animate-in fade-in">
              <div className="flex items-center space-x-2 font-bold text-[#00545C]">
                <FileText className="w-4 h-4 text-[#7DBA00]" />
                <span>PDF Document Downloaded: {quotation.quotation_number}.pdf</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                👉 Simply drag and drop the downloaded PDF file into your WhatsApp Web chat to send as an attachment. The message text also contains the direct document link!
              </p>
            </div>
          )}
          
          {/* Recipient Phone */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Customer WhatsApp Mobile Number
            </label>
            <div className="flex rounded-xl shadow-sm border border-slate-300 overflow-hidden focus-within:ring-2 focus-within:ring-[#00545C]">
              <span className="inline-flex items-center px-3.5 bg-slate-100 text-slate-700 text-xs font-bold border-r border-slate-300">
                +91
              </span>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10-digit mobile number"
                className="w-full px-3 py-2 text-sm font-semibold text-slate-900 focus:outline-none"
              />
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

          {/* Message Preview */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Message Content with PDF Link
              </label>
              <button
                onClick={handleCopy}
                className="flex items-center space-x-1 text-xs text-emerald-700 hover:text-emerald-800 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy Text'}</span>
              </button>
            </div>
            <textarea
              rows={8}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full text-xs font-mono p-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00545C] leading-relaxed"
            />
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

          <button
            type="button"
            disabled={isSending}
            onClick={handleShareWithPdf}
            className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white font-black text-xs shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          >
            {isSending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Preparing PDF Document…</span>
              </>
            ) : (
              <>
                <MessageCircle className="w-4 h-4 text-white" />
                <span>Share to WhatsApp (with PDF Document)</span>
                <ArrowRight className="w-3.5 h-3.5 text-white" />
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
