import React, { useState, useEffect } from 'react';
import { 
  Search, Filter, PlusCircle, Printer, MessageCircle, Mail, 
  Copy, Eye, RefreshCw, FileText, CheckCircle2, AlertCircle,
  MoreVertical, Calendar, Edit3, Trash2
} from 'lucide-react';
import { api } from '../api/client';
import QuotationPdfModal from '../components/QuotationPdfModal';
import WhatsAppShareModal from '../components/WhatsAppShareModal';
import EmailShareModal from '../components/EmailShareModal';
import ThemedConfirmDialog from '../components/ThemedConfirmDialog';

export default function Quotations({ setActivePage, onEditQuotation }) {
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Selected Quotations for Modals
  const [selectedQuoteForPdf, setSelectedQuoteForPdf] = useState(null);
  const [selectedQuoteForWa, setSelectedQuoteForWa] = useState(null);
  const [selectedQuoteForEmail, setSelectedQuoteForEmail] = useState(null);
  const [viewQuoteDetail, setViewQuoteDetail] = useState(null);

  // Dialog State (replaces native confirm/alert)
  const [dialogConfig, setDialogConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    type: 'confirm',
    onConfirm: null
  });

  // Toast State (bottom-right notification)
  const [toastMsg, setToastMsg] = useState(null);

  function showToast(text, isError = false) {
    setToastMsg({ text, isError });
    setTimeout(() => setToastMsg(null), 4000);
  }

  useEffect(() => {
    loadQuotations();
  }, [search, statusFilter, page]);

  async function loadQuotations() {
    try {
      setLoading(true);
      const res = await api.getQuotations({
        search,
        status: statusFilter,
        page,
        limit: 15
      });
      setQuotations(res.quotations || []);
      setTotalPages(res.totalPages || 1);
      setTotalCount(res.total || 0);
    } catch (err) {
      console.warn('Failed to load quotations:', err);
      showToast('Failed to load quotations: ' + err.message, true);
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(id, newStatus) {
    try {
      await api.updateQuotationStatus(id, newStatus);
      showToast(`✓ Quotation status updated to ${newStatus}`);
      loadQuotations();
    } catch (err) {
      showToast('Failed to update status: ' + err.message, true);
    }
  }

  function handleDuplicate(quote) {
    setDialogConfig({
      isOpen: true,
      title: 'Duplicate Quotation',
      message: `Create a new duplicate of quotation "${quote.quotation_number}" for ${quote.customer_name}?\n\nThis will generate a new sequential quotation number while copying all products and rates.`,
      confirmText: 'Duplicate Now',
      cancelText: 'Cancel',
      type: 'duplicate',
      onConfirm: async () => {
        setDialogConfig(prev => ({ ...prev, isOpen: false }));
        try {
          const res = await api.duplicateQuotation(quote.id);
          showToast(`✓ Created duplicate quotation ${res.quotation_number}`);
          loadQuotations();
        } catch (err) {
          showToast('Failed to duplicate quotation: ' + err.message, true);
        }
      }
    });
  }

  async function handleEdit(quote) {
    try {
      const full = await api.getQuotation(quote.id);
      if (onEditQuotation) {
        onEditQuotation(full.quotation);
      } else {
        setActivePage('create-quotation');
      }
    } catch (err) {
      showToast('Failed to load quotation for editing: ' + (err.message || 'Error'), true);
    }
  }

  function handleDelete(quote) {
    setDialogConfig({
      isOpen: true,
      title: 'Delete Quotation',
      message: `Are you sure you want to permanently delete quotation "${quote.quotation_number}" for "${quote.customer_name}"?\n\nThis action cannot be undone.`,
      confirmText: 'Delete Permanently',
      cancelText: 'Keep Quotation',
      type: 'danger',
      onConfirm: async () => {
        setDialogConfig(prev => ({ ...prev, isOpen: false }));
        try {
          await api.deleteQuotation(quote.id);
          showToast(`✓ Deleted quotation ${quote.quotation_number}`);
          loadQuotations();
        } catch (err) {
          showToast('Failed to delete quotation: ' + (err.message || 'Error occurred'), true);
        }
      }
    });
  }

  async function openPdf(quote) {
    const full = await api.getQuotation(quote.id);
    setSelectedQuoteForPdf(full.quotation);
  }

  async function openWhatsApp(quote) {
    const full = await api.getQuotation(quote.id);
    setSelectedQuoteForWa(full.quotation);
  }

  async function openEmail(quote) {
    const full = await api.getQuotation(quote.id);
    setSelectedQuoteForEmail(full.quotation);
  }

  async function openDetail(quote) {
    const full = await api.getQuotation(quote.id);
    setViewQuoteDetail(full.quotation);
  }

  function formatCurrency(val) {
    return '₹' + Number(val || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  const statusColors = {
    Draft: 'bg-slate-100 text-slate-700 border-slate-300',
    Created: 'bg-sky-50 text-sky-800 border-sky-300',
    Shared: 'bg-indigo-50 text-indigo-800 border-indigo-300',
    Accepted: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    Rejected: 'bg-rose-50 text-rose-800 border-rose-300',
    Expired: 'bg-amber-50 text-amber-800 border-amber-300'
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[#00545C]">
            Quotations Management
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Total {totalCount} quotation(s) issued • Track status, view PDFs, and share via WhatsApp
          </p>
        </div>

        <button
          onClick={() => setActivePage('create-quotation')}
          className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-[#7DBA00] hover:bg-[#8ee000] text-[#003B40] font-black text-xs sm:text-sm shadow-md transition-all active:scale-95"
        >
          <PlusCircle className="w-4 h-4 text-[#003B40]" />
          <span>+ Create Quotation</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-xl">
          {[
            { id: 'all', label: 'All Statuses' },
            { id: 'Created', label: 'Created' },
            { id: 'Shared', label: 'Shared' },
            { id: 'Accepted', label: 'Accepted' },
            { id: 'Draft', label: 'Draft' },
            { id: 'Rejected', label: 'Rejected' },
            { id: 'Expired', label: 'Expired' }
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => { setStatusFilter(opt.id); setPage(1); }}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                statusFilter === opt.id
                  ? 'bg-[#00545C] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search Quote #, Customer Name, Phone..."
            className="w-full pl-9 pr-4 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00545C]"
          />
        </div>

      </div>

      {/* Quotations Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#00545C] text-white text-[11px] font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Quotation Number</th>
                <th className="py-3 px-4">Customer Details</th>
                <th className="py-3 px-4">Date & Validity</th>
                <th className="py-3 px-4 text-right">Grand Total (₹)</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right min-w-[300px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    Loading quotations...
                  </td>
                </tr>
              ) : quotations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    No quotations found matching criteria.
                  </td>
                </tr>
              ) : (
                quotations.map((quote) => (
                  <tr key={quote.id} className="hover:bg-slate-50/80 transition-colors">
                    
                    {/* Quotation Number */}
                    <td className="py-3.5 px-4 font-mono font-bold text-[#00545C]">
                      <button
                        onClick={() => openDetail(quote)}
                        className="hover:underline flex items-center space-x-1"
                      >
                        <span>{quote.quotation_number}</span>
                      </button>
                      <span className="block text-[10px] text-slate-400 font-sans font-normal mt-0.5">
                        {quote.paper_format} Format
                      </span>
                    </td>

                    {/* Customer Info */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{quote.customer_name}</div>
                      <div className="text-[11px] text-slate-500">{quote.customer_phone}</div>
                    </td>

                    {/* Date */}
                    <td className="py-3.5 px-4 text-slate-600">
                      <div>Issued: <span className="font-medium text-slate-800">{quote.quotation_date}</span></div>
                      <div className="text-[11px] text-slate-400">Valid: {quote.validity_date}</div>
                    </td>

                    {/* Grand Total */}
                    <td className="py-3.5 px-4 text-right font-mono font-extrabold text-sm text-slate-900">
                      {formatCurrency(quote.grand_total)}
                    </td>

                    {/* Status with quick change dropdown */}
                    <td className="py-3.5 px-4 text-center">
                      <select
                        value={quote.status}
                        onChange={(e) => handleStatusChange(quote.id, e.target.value)}
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border cursor-pointer focus:outline-none ${
                          statusColors[quote.status] || 'bg-slate-100'
                        }`}
                      >
                        <option value="Created">Created</option>
                        <option value="Shared">Shared</option>
                        <option value="Accepted">Accepted</option>
                        <option value="Draft">Draft</option>
                        <option value="Rejected">Rejected</option>
                        <option value="Expired">Expired</option>
                      </select>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1.5 flex-wrap gap-y-1">
                        <button
                          onClick={() => handleEdit(quote)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold border border-amber-300 transition-all cursor-pointer shadow-2xs"
                          title="Edit Quotation details and items"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-amber-700" />
                          <span>Edit</span>
                        </button>

                        <button
                          onClick={() => openPdf(quote)}
                          className="p-1.5 text-slate-700 hover:text-[#00545C] hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                          title="Print / View PDF"
                        >
                          <Printer className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => openWhatsApp(quote)}
                          className="p-1.5 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 rounded-lg transition-colors border border-emerald-200"
                          title="Share on WhatsApp"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => openEmail(quote)}
                          className="p-1.5 text-slate-600 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors border border-slate-200"
                          title="Share via Email"
                        >
                          <Mail className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleDuplicate(quote)}
                          className="p-1.5 text-slate-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors border border-slate-200"
                          title="Duplicate Quotation"
                        >
                          <Copy className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleDelete(quote)}
                          className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg text-rose-600 hover:text-rose-800 hover:bg-rose-50 border border-transparent hover:border-rose-200 text-xs font-semibold transition-all cursor-pointer"
                          title="Delete Quotation"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Page {page} of {totalPages} (Total {totalCount} records)</span>
            <div className="flex space-x-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* PDF View Modal */}
      {selectedQuoteForPdf && (
        <QuotationPdfModal
          quotation={selectedQuoteForPdf}
          onClose={() => setSelectedQuoteForPdf(null)}
          onEdit={(q) => {
            setSelectedQuoteForPdf(null);
            handleEdit(q);
          }}
          onDelete={async (q) => {
            setSelectedQuoteForPdf(null);
            await handleDelete(q);
          }}
        />
      )}

      {/* WhatsApp Modal */}
      {selectedQuoteForWa && (
        <WhatsAppShareModal
          quotation={selectedQuoteForWa}
          onClose={() => setSelectedQuoteForWa(null)}
          onShared={loadQuotations}
        />
      )}

      {/* Email Modal */}
      {selectedQuoteForEmail && (
        <EmailShareModal
          quotation={selectedQuoteForEmail}
          onClose={() => setSelectedQuoteForEmail(null)}
          onShared={loadQuotations}
        />
      )}

      {/* Quotation Detail Inspection Modal */}
      {viewQuoteDetail && (
        <QuotationPdfModal
          quotation={viewQuoteDetail}
          onClose={() => setViewQuoteDetail(null)}
          onEdit={(q) => {
            setViewQuoteDetail(null);
            handleEdit(q);
          }}
          onDelete={async (q) => {
            setViewQuoteDetail(null);
            await handleDelete(q);
          }}
        />
      )}

      {/* Themed Confirmation & Action Dialog */}
      <ThemedConfirmDialog
        isOpen={dialogConfig.isOpen}
        title={dialogConfig.title}
        message={dialogConfig.message}
        confirmText={dialogConfig.confirmText}
        cancelText={dialogConfig.cancelText}
        type={dialogConfig.type}
        onConfirm={dialogConfig.onConfirm}
        onCancel={() => setDialogConfig(prev => ({ ...prev, isOpen: false }))}
      />

      {/* Modern Bottom-Right Toast Notification (replaces top alerts) */}
      {toastMsg && (
        <div className={`fixed bottom-6 right-6 z-50 font-bold text-xs py-3 px-5 rounded-2xl shadow-2xl flex items-center space-x-2.5 border backdrop-blur-md animate-in slide-in-from-bottom-3 duration-200 ${
          toastMsg.isError 
            ? 'bg-rose-950/95 text-rose-100 border-rose-700/80' 
            : 'bg-[#00545C]/95 text-[#7DBA00] border-[#7DBA00]/50'
        }`}>
          {toastMsg.isError ? (
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-[#7DBA00] flex-shrink-0" />
          )}
          <span className="text-white tracking-wide">{toastMsg.text}</span>
        </div>
      )}

    </div>
  );
}
