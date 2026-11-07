import React, { useState } from 'react';
import { Mail, Copy, Check, ExternalLink, X } from 'lucide-react';
import { api } from '../api/client';

export default function EmailShareModal({ quotation, onClose, onShared }) {
  if (!quotation) return null;

  const [email, setEmail] = useState(quotation.customer_email || '');
  const [copied, setCopied] = useState(false);

  const subject = `Quotation ${quotation.quotation_number} - UDHAYAM AGENCIES (Paint Division)`;
  const itemsCount = quotation.items ? quotation.items.length : 0;
  const grandTotalFormatted = Number(quotation.grand_total || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const body = 
`Dear ${quotation.customer_name || 'Customer'},

Greetings from UDHAYAM AGENCIES (Paint Division)!

Please find below the quotation details prepared for you:

• Quotation Number: ${quotation.quotation_number}
• Quotation Date: ${quotation.quotation_date}
• Total Items: ${itemsCount} items
• Grand Total: ₹${grandTotalFormatted} (inclusive of GST)
• Validity: Valid for 7 days from the date of issue

Bank Details:
• Bank: Indian Bank, Perundurai Branch
• Account Name: Udhayam Agencies
• Account Number: 6659330152
• IFSC: IDIB000P034
• GPay: +91 97156 22499

If you require any further assistance or modifications, please feel free to reach out to us at +91 97156 22499.

Warm regards,
UDHAYAM AGENCIES — Paint Division
Perundurai, Erode - 638052`;

  function handleOpenMail() {
    if (!email) {
      alert('Please enter a recipient email address.');
      return;
    }
    api.auditShare(quotation.id, 'email', email).catch(console.warn);
    if (onShared) onShared();

    const mailtoUrl = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
  }

  function handleCopy() {
    navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="bg-[#00545C] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-300">
              <Mail className="w-5 h-5 text-[#7DBA00]" />
            </div>
            <div>
              <h3 className="font-bold text-base">Share via Email</h3>
              <p className="text-xs text-emerald-200">Quotation {quotation.quotation_number}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Recipient Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="customer@domain.com"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00545C]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                Email Subject
              </label>
            </div>
            <input
              type="text"
              readOnly
              value={subject}
              className="w-full text-xs font-semibold p-2.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-700"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                Email Body Preview
              </label>
              <button
                onClick={handleCopy}
                className="flex items-center space-x-1 text-xs text-emerald-700 hover:text-emerald-800 font-semibold"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <textarea
              rows={6}
              readOnly
              value={body}
              className="w-full text-xs font-mono p-3 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/50 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleOpenMail}
            className="flex items-center space-x-1.5 px-4 py-2 text-xs font-bold text-white bg-[#00545C] hover:bg-[#003B40] rounded-lg shadow transition-all active:scale-95"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open Email Draft</span>
          </button>
        </div>

      </div>
    </div>
  );
}
