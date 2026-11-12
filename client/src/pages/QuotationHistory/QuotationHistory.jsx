import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  FileText,
  Download,
  Share2,
  Copy,
  RefreshCw,
  ExternalLink,
  Calendar,
  CheckCircle2,
  Check,
  Smartphone,
  Laptop,
  Sparkles,
  Mail,
  Send,
  AlertCircle
} from 'lucide-react';
import { api } from '../../api/client';
import { formatINR, formatDate, formatDateTime } from '../../utils/currency';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';

export function QuotationHistory({ onOpenQuotation, onViewPdf }) {
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [paperFilter, setPaperFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Share modal state (WhatsApp & Email)
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareData, setShareData] = useState(null);
  const [activeShareQuoteId, setActiveShareQuoteId] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);
  const [shareTab, setShareTab] = useState('whatsapp'); // 'whatsapp' | 'email'
  const [emailRecipient, setEmailRecipient] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSuccessMessage, setEmailSuccessMessage] = useState(null);
  const [emailErrorMessage, setEmailErrorMessage] = useState(null);

  useEffect(() => {
    fetchQuotations();
  }, [searchTerm, statusFilter, typeFilter, paperFilter, page]);

  async function fetchQuotations() {
    try {
      setLoading(true);
      const res = await api.getQuotations({
        search: searchTerm,
        status: statusFilter,
        docType: typeFilter,
        paperSize: paperFilter,
        page,
        limit: 20
      });
      setQuotations(res.quotations || []);
      setTotalPages(res.totalPages || 1);
      setTotalCount(res.total || 0);
    } catch (err) {
      console.error('Failed to load quotation history:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDuplicate(id) {
    try {
      setLoading(true);
      const res = await api.duplicateQuotation(id);
      setActionMessage(`Quotation duplicated as new draft ${res.newQuotationNumber}.`);
      fetchQuotations();
    } catch (err) {
      alert(err.message || 'Failed to duplicate quotation.');
    } finally {
      setLoading(false);
    }
  }

  async function handleOpenShare(id) {
    try {
      setActiveShareQuoteId(id);
      const quote = quotations.find(q => q.id === id);
      setEmailRecipient(quote?.customer_email || '');
      setShareTab('whatsapp');
      setEmailSuccessMessage(null);
      setEmailErrorMessage(null);
      const res = await api.shareWhatsApp(id);
      setShareData(res);
      setShareModalOpen(true);
    } catch (err) {
      alert(err.message || 'Failed to prepare quotation share link.');
    }
  }

  const [isSharingNative, setIsSharingNative] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);

  async function handleNativeShareWithPdf() {
    if (!activeShareQuoteId) return;
    try {
      setIsSharingNative(true);

      if (typeof navigator !== 'undefined' && navigator.clipboard && shareData?.messageText) {
        await navigator.clipboard.writeText(shareData.messageText);
      }

      const pdfUrl = api.getPdfUrl(activeShareQuoteId, false);
      const res = await fetch(pdfUrl);
      if (!res.ok) throw new Error('Could not fetch PDF for sharing.');
      const blob = await res.blob();
      const pdfFile = new File([blob], `Quotation_${activeShareQuoteId}_Udhayam.pdf`, { type: 'application/pdf' });

      if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          title: `Quotation_${activeShareQuoteId}.pdf`,
          files: [pdfFile]
        });
        await api.updateWhatsAppStatus(activeShareQuoteId, 'sent');
        setActionMessage('PDF attached to WhatsApp! Tamil quotation message copied to clipboard.');
      } else {
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

  function triggerDesktopShareFlow() {
    if (!activeShareQuoteId) return;

    if (typeof navigator !== 'undefined' && navigator.clipboard && shareData?.messageText) {
      navigator.clipboard.writeText(shareData.messageText);
    }

    const link = document.createElement('a');
    link.href = api.getPdfUrl(activeShareQuoteId, true);
    link.download = `Quotation_${activeShareQuoteId}_Udhayam.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (shareData?.shareLink) {
      window.open(shareData.shareLink, '_blank', 'noopener,noreferrer');
      api.updateWhatsAppStatus(activeShareQuoteId, 'whatsapp_opened');
    }

    setActionMessage('Quotation PDF downloaded & WhatsApp opened! Tamil text copied to clipboard. Drag or attach PDF into WhatsApp.');
  }

  function handleCopyMessage() {
    if (shareData?.messageText && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(shareData.messageText);
      setCopiedMessage(true);
      setActionMessage('Tamil quotation message copied to clipboard!');
      setTimeout(() => setCopiedMessage(false), 3000);
    }
  }

  // Handle Send Email via Server (Nodemailer attachment) or Web fallback
  async function handleSendEmail() {
    if (!activeShareQuoteId) return;
    if (!emailRecipient || !emailRecipient.trim()) {
      setEmailErrorMessage('Please enter a valid recipient email address.');
      return;
    }

    try {
      setSendingEmail(true);
      setEmailErrorMessage(null);
      setEmailSuccessMessage(null);

      const activeQuote = quotations.find(q => q.id === activeShareQuoteId);
      const res = await api.shareEmail(activeShareQuoteId, {
        recipientEmail: emailRecipient.trim(),
        recipientName: activeQuote?.customer_name
      });

      if (res.mode === 'smtp') {
        setEmailSuccessMessage(`Quotation PDF successfully emailed to ${emailRecipient}!`);
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

  // Fallback: 1-Click Download PDF & Launch Gmail / Mail Client
  function triggerEmailClientFallback(composeUrl, messageBody) {
    if (!activeShareQuoteId) return;
    const activeQuote = quotations.find(q => q.id === activeShareQuoteId);
    const quoteNum = activeQuote?.quotation_number || `Quote_${activeShareQuoteId}`;

    // 1. Download PDF file
    const link = document.createElement('a');
    link.href = api.getPdfUrl(activeShareQuoteId, true);
    link.download = `${quoteNum}_Udhayam.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // 2. Copy text
    const textToSend = messageBody || shareData?.messageText || '';
    if (typeof navigator !== 'undefined' && navigator.clipboard && textToSend) {
      navigator.clipboard.writeText(textToSend);
    }

    // 3. Open Gmail / mailto
    const subject = encodeURIComponent(`📄 Quotation ${quoteNum} - Udhayam Agencies`);
    const body = encodeURIComponent(textToSend);
    const to = encodeURIComponent(emailRecipient || activeQuote?.customer_email || '');
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${subject}&body=${body}`;
    const mailto = `mailto:${to}?subject=${subject}&body=${body}`;

    window.open(composeUrl || gmailUrl || mailto, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Quotation History</h1>
          <p className="text-sm text-slate-500 mt-1">
            Search historical quotation snapshots, drafts, generated PDFs, and WhatsApp sharing records.
          </p>
        </div>
        <button
          onClick={fetchQuotations}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-md shadow-xs transition-colors self-start"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {actionMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{actionMessage}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="font-bold">×</button>
        </div>
      )}

      {/* Filters Bar */}
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
            placeholder="Search by quotation number, customer name, or phone..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto text-xs">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="bg-white border border-slate-200 rounded p-1.5 text-xs"
            >
              <option value="all">All</option>
              <option value="draft">Drafts</option>
              <option value="finalized">Finalized</option>
            </select>
          </div>

          {/* Doc Type Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="bg-white border border-slate-200 rounded p-1.5 text-xs"
            >
              <option value="all">All Types</option>
              <option value="gst_quotation">GST Quotation</option>
              <option value="estimation">Estimation</option>
            </select>
          </div>

          {/* Paper Size Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Paper:</span>
            <select
              value={paperFilter}
              onChange={(e) => {
                setPaperFilter(e.target.value);
                setPage(1);
              }}
              className="bg-white border border-slate-200 rounded p-1.5 text-xs"
            >
              <option value="all">All Sizes</option>
              <option value="A5">A5</option>
              <option value="A4">A4</option>
            </select>
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
        {quotations.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            {loading ? 'Loading quotation history...' : 'No quotations found matching your criteria.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Quote #</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-center">Items</th>
                  <th className="px-4 py-3 text-right">Grand Total</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-center">Paper</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">WhatsApp</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {quotations.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-blue-600 font-mono">
                      {q.quotation_number}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{q.customer_name || 'Valued Customer'}</div>
                      {q.customer_phone && (
                        <div className="text-[11px] text-slate-400">{q.customer_phone}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {formatDate(q.created_at)}
                    </td>
                    <td className="px-4 py-3 text-center font-medium text-slate-700">
                      {q.item_count}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">
                      {formatINR(q.grand_total)}
                    </td>
                    <td className="px-4 py-3">
                      {q.document_type === 'gst_quotation' ? (
                        <Badge variant="primary">GST Quote</Badge>
                      ) : (
                        <Badge variant="default">Estimation</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-slate-600">
                      {q.paper_size || 'A5'}
                    </td>
                    <td className="px-4 py-3">
                      {q.status === 'finalized' ? (
                        <Badge variant="success">Finalized</Badge>
                      ) : (
                        <Badge variant="warning">Draft</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {q.whatsapp_status === 'whatsapp_opened' ? (
                        <Badge variant="primary">Chat Opened</Badge>
                      ) : q.whatsapp_status === 'sent' ? (
                        <Badge variant="success">Sent</Badge>
                      ) : (
                        <span className="text-slate-400 text-[11px]">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => onOpenQuotation(q.id)}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {q.status === 'finalized' ? 'View' : 'Edit'}
                      </button>

                      {q.pdf_filename && (
                        <>
                          <button
                            onClick={() => onViewPdf(q.id)}
                            className="text-slate-600 hover:text-slate-900 font-medium"
                            title="Preview PDF"
                          >
                            PDF
                          </button>
                          <a
                            href={api.getPdfUrl(q.id, true)}
                            download
                            className="text-slate-600 hover:text-slate-900 font-medium"
                            title="Download PDF"
                          >
                            <Download className="w-3.5 h-3.5 inline" />
                          </a>
                        </>
                      )}

                      <button
                        onClick={() => handleOpenShare(q.id)}
                        className="text-emerald-600 hover:text-emerald-800 font-medium"
                        title="Share on WhatsApp"
                      >
                        <Share2 className="w-3.5 h-3.5 inline" />
                      </button>

                      <button
                        onClick={() => handleDuplicate(q.id)}
                        className="text-slate-500 hover:text-slate-800 font-medium"
                        title="Duplicate as new draft"
                      >
                        <Copy className="w-3.5 h-3.5 inline" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-slate-200 flex items-center justify-between bg-slate-50/50 text-xs">
            <span className="text-slate-500">
              Showing page {page} of {totalPages} ({totalCount} total records)
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

      {/* Share Modal (WhatsApp & Email with PDF) */}
      {(() => {
        const activeQuote = quotations.find(q => q.id === activeShareQuoteId);
        return (
          <Modal
            isOpen={shareModalOpen}
            onClose={() => setShareModalOpen(false)}
            title="Share Quotation (WhatsApp & Email)"
            maxWidth="max-w-xl"
          >
            <div className="space-y-4 text-xs">
              {/* Quotation Quick Details Header */}
              {activeQuote && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Quotation Ref</span>
                    <span className="font-bold text-slate-800 text-sm">{activeQuote.quotation_number}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Customer</span>
                    <span className="font-semibold text-slate-700">{activeQuote.customer_name || 'Valued Customer'} {activeQuote.customer_phone ? `(${activeQuote.customer_phone})` : ''}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Grand Total</span>
                    <span className="font-bold text-emerald-700 text-sm">{formatINR(activeQuote.grand_total)}</span>
                  </div>
                </div>
              )}

              {/* Share Method Switcher Tabs */}
              <div className="flex border-b border-slate-200">
                <button
                  type="button"
                  onClick={() => setShareTab('whatsapp')}
                  className={`flex-1 py-2 text-center font-bold text-xs border-b-2 flex items-center justify-center gap-1.5 transition-colors ${
                    shareTab === 'whatsapp'
                      ? 'border-emerald-600 text-emerald-700 bg-emerald-50/40'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Share2 className="w-4 h-4 text-emerald-600" />
                  <span>WhatsApp (வாட்ஸ்அப்)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShareTab('email')}
                  className={`flex-1 py-2 text-center font-bold text-xs border-b-2 flex items-center justify-center gap-1.5 transition-colors ${
                    shareTab === 'email'
                      ? 'border-purple-600 text-purple-700 bg-purple-50/40'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Mail className="w-4 h-4 text-purple-600" />
                  <span>Email with PDF (மின்னஞ்சல்)</span>
                </button>
              </div>

              {/* TAB 1: WHATSAPP SHARING */}
              {shareTab === 'whatsapp' && (
                <div className="space-y-4">
                  {/* TWO PRIMARY WAYS TO SHARE WITH PDF */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* OPTION 1: Mobile Direct Share */}
                    <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-lg flex flex-col justify-between space-y-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-emerald-900 font-bold text-xs">
                          <Smartphone className="w-4 h-4 text-emerald-600" />
                          <span>Mobile WhatsApp Share</span>
                        </div>
                        <p className="text-[11px] text-emerald-700 leading-snug">
                          Attaches the <b>.pdf file</b> directly into WhatsApp. The Tamil quotation message is automatically copied to your clipboard.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleNativeShareWithPdf}
                        disabled={isSharingNative}
                        className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-md shadow-xs transition-colors flex items-center justify-center gap-1.5 text-xs disabled:opacity-50"
                      >
                        {isSharingNative ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5" />}
                        <span>📎 Attach PDF to WhatsApp</span>
                      </button>
                    </div>

                    {/* OPTION 2: Desktop 1-Click Flow */}
                    <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-lg flex flex-col justify-between space-y-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-blue-900 font-bold text-xs">
                          <Laptop className="w-4 h-4 text-blue-600" />
                          <span>Desktop WhatsApp Web</span>
                        </div>
                        <p className="text-[11px] text-blue-700 leading-snug">
                          Downloads the PDF file and opens WhatsApp chat with the Tamil message pre-filled. Drag the PDF into WhatsApp to send both!
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={triggerDesktopShareFlow}
                        className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md shadow-xs transition-colors flex items-center justify-center gap-1.5 text-xs"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>🚀 1-Click: PDF + WhatsApp</span>
                      </button>
                    </div>
                  </div>

                  {/* Tamil Quotation Message Preview */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="font-semibold text-slate-800 text-xs flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        <span>WhatsApp Quotation Message (Tamil):</span>
                      </label>
                      <button
                        type="button"
                        onClick={handleCopyMessage}
                        className="text-xs font-semibold px-2 py-0.5 rounded text-blue-600 hover:bg-blue-50 flex items-center gap-1 transition-colors"
                      >
                        {copiedMessage ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-600">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy Message</span>
                          </>
                        )}
                      </button>
                    </div>
                    <textarea
                      readOnly
                      rows={8}
                      value={shareData?.messageText || ''}
                      className="w-full font-mono text-[11px] p-3 bg-slate-50 border border-slate-200 rounded-md text-slate-800 focus:outline-none select-all leading-relaxed"
                    />
                  </div>

                  {/* Bottom Direct Shortcuts */}
                  <div className="flex flex-col sm:flex-row gap-2.5 pt-2 border-t border-slate-200">
                    {activeShareQuoteId && (
                      <a
                        href={api.getPdfUrl(activeShareQuoteId, true)}
                        download={`Quotation_${activeShareQuoteId}_Udhayam.pdf`}
                        className="flex-1 py-2 text-center bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-md flex items-center justify-center gap-1.5 transition-colors text-xs"
                      >
                        <Download className="w-3.5 h-3.5 text-slate-500" />
                        Download PDF Only
                      </a>
                    )}

                    <a
                      href={shareData?.shareLink || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        if (activeShareQuoteId) api.updateWhatsAppStatus(activeShareQuoteId, 'whatsapp_opened');
                      }}
                      className="flex-1 py-2 text-center bg-slate-100 hover:bg-slate-200 text-emerald-700 font-semibold rounded-md flex items-center justify-center gap-1.5 transition-colors text-xs"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
                      Open WhatsApp Chat Only
                    </a>
                  </div>
                </div>
              )}

              {/* TAB 2: EMAIL SHARING */}
              {shareTab === 'email' && (
                <div className="space-y-4">
                  {emailSuccessMessage && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-800 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{emailSuccessMessage}</span>
                    </div>
                  )}

                  {emailErrorMessage && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-800 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{emailErrorMessage}</span>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Customer Email Address <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="email"
                        placeholder="e.g. customer@gmail.com"
                        value={emailRecipient}
                        onChange={(e) => setEmailRecipient(e.target.value)}
                        className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-lg flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-purple-900 font-semibold text-xs">
                        <FileText className="w-4 h-4 text-purple-600" />
                        <span>Attached Document: <b>{activeQuote?.quotation_number || 'Quotation'}_Udhayam.pdf</b></span>
                      </div>
                      <span className="text-[10px] bg-purple-200 text-purple-800 px-2 py-0.5 rounded font-bold uppercase">
                        Auto-Attached
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-semibold text-slate-700 text-xs">Email Content Preview (Tamil):</label>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(shareData?.messageText || '');
                            setActionMessage('Email content copied to clipboard!');
                          }}
                          className="text-purple-600 hover:text-purple-800 text-[11px] font-medium flex items-center gap-1"
                        >
                          <Copy className="w-3 h-3" />
                          Copy Email Text
                        </button>
                      </div>
                      <textarea
                        readOnly
                        rows={6}
                        value={shareData?.messageText || ''}
                        className="w-full font-mono text-[11px] p-2.5 bg-slate-50 border border-slate-200 rounded-md text-slate-800 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Email Send Actions */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={handleSendEmail}
                      disabled={sendingEmail}
                      className="py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-md shadow-xs transition-colors flex items-center justify-center gap-2 text-xs disabled:opacity-50"
                    >
                      {sendingEmail ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      <span>Direct Send (with PDF Attached)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => triggerEmailClientFallback(null, shareData?.messageText)}
                      className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-md transition-colors flex items-center justify-center gap-2 text-xs"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-purple-600" />
                      <span>1-Click: Open in Gmail / Mail App</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
