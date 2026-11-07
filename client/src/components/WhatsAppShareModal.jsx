import React, { useState, useEffect } from 'react';
import { MessageCircle, Copy, Check, ExternalLink, X, AlertCircle, Globe } from 'lucide-react';
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

  // High-Quality Verified Templates
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

  async function handleOpenWhatsApp() {
    if (isSending) return;
    const cleanPhone = phone.replace(/\D/g, '');
    const recipient = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const url = `https://wa.me/${recipient}?text=${encodeURIComponent(message)}`;

    setIsSending(true);
    try {
      await api.auditShare(quotation.id, 'whatsapp', `+${recipient}`);
      if (onShared) onShared();
    } catch (err) {
      console.warn('Audit share failed:', err);
    } finally {
      setIsSending(false);
    }

    window.open(url, '_blank', 'noopener,noreferrer');
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
              <span className="text-[11px] text-slate-400">Includes items, prices & UPI info</span>
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
                Message Content (Verified & Editable)
              </label>
              <button
                onClick={handleCopy}
                className="flex items-center space-x-1 text-xs text-emerald-700 hover:text-emerald-800 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied to Clipboard!' : 'Copy Text'}</span>
              </button>
            </div>
            <textarea
              rows={9}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full text-xs font-mono p-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00545C] leading-relaxed"
            />
          </div>

        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between">
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
            onClick={handleOpenWhatsApp}
            className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white font-black text-xs shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          >
            <MessageCircle className="w-4 h-4" />
            <span>{isSending ? 'Preparing message…' : 'Open WhatsApp & Send Quote'}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>
    </div>
  );
}
