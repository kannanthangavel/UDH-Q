import React, { useState, useEffect } from 'react';
import { 
  Receipt, PlusCircle, Search, Printer, MessageCircle, 
  Trash2, Eye, Calendar, ArrowUpRight, DollarSign,
  CheckCircle2, Clock, FileText, User, Phone, Check, RefreshCw, X
} from 'lucide-react';
import { api } from '../api/client';
import ThemedConfirmDialog from '../components/ThemedConfirmDialog';

export default function Receipts() {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // New Receipt Modal State
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customers, setCustomers] = useState([]);

  // Form Fields
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [billNo, setBillNo] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentMode, setPaymentMode] = useState('UPI'); // 'Cash' | 'UPI' | 'Cheque' | 'Bank Transfer'
  const [referenceNo, setReferenceNo] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [balanceAmount, setBalanceAmount] = useState('0');
  const [paperFormat, setPaperFormat] = useState('A4');
  const [notes, setNotes] = useState('Thank you for your prompt payment! We sincerely appreciate your business.');

  // View PDF Modal
  const [viewPdfReceipt, setViewPdfReceipt] = useState(null);

  // Dialog & Toast
  const [dialogConfig, setDialogConfig] = useState({ isOpen: false });
  const [toastMsg, setToastMsg] = useState(null);

  function showToast(text, isError = false) {
    setToastMsg({ text, isError });
    setTimeout(() => setToastMsg(null), 4000);
  }

  useEffect(() => {
    loadReceipts();
  }, [search, page]);

  useEffect(() => {
    loadCustomers();
  }, []);

  async function loadCustomers() {
    try {
      const res = await api.getCustomers();
      if (res.customers) setCustomers(res.customers);
    } catch (e) {}
  }

  async function loadReceipts() {
    try {
      setLoading(true);
      const res = await api.getReceipts({ search, page, limit: 15 });
      setReceipts(res.receipts || []);
      setTotalPages(res.totalPages || 1);
      setTotalCount(res.total || 0);
    } catch (err) {
      showToast('Failed to load receipts: ' + err.message, true);
    } finally {
      setLoading(false);
    }
  }

  function handleSelectCustomer(c) {
    setCustomerName(c.name);
    if (c.phone) setCustomerPhone(c.phone);
    if (c.address) setCustomerAddress(c.address);
  }

  async function handleCreateReceipt(e) {
    e.preventDefault();
    if (!customerName.trim()) {
      showToast('Please enter customer name', true);
      return;
    }
    const paid = parseFloat(amountPaid);
    if (!paid || paid <= 0) {
      showToast('Please enter valid payment amount', true);
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.createReceipt({
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        customer_address: customerAddress.trim(),
        bill_no: billNo.trim(),
        payment_date: paymentDate,
        payment_mode: paymentMode,
        reference_no: referenceNo.trim(),
        amount_paid: paid,
        balance_amount: parseFloat(balanceAmount) || 0,
        notes: notes.trim(),
        paper_format: paperFormat
      });

      showToast(`✓ Created receipt ${res.receipt?.receipt_number || ''}`);
      setShowModal(false);
      resetForm();
      loadReceipts();

      // Offer to view PDF
      if (res.receipt) {
        setViewPdfReceipt(res.receipt);
      }
    } catch (err) {
      showToast('Failed to create receipt: ' + err.message, true);
    } finally {
      setIsSubmitting(false);
    }
  }

  function resetForm() {
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
    setBillNo('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentMode('UPI');
    setReferenceNo('');
    setAmountPaid('');
    setBalanceAmount('0');
    setPaperFormat('A4');
    setNotes('Thank you for your prompt payment! We sincerely appreciate your business.');
  }

  function handleDeleteReceipt(r) {
    setDialogConfig({
      isOpen: true,
      title: 'Delete Receipt',
      message: `Permanently delete Receipt "${r.receipt_number}" for ${r.customer_name} (Rs. ${r.amount_paid})?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger',
      onConfirm: async () => {
        setDialogConfig({ isOpen: false });
        try {
          await api.deleteReceipt(r.id);
          showToast(`✓ Deleted receipt ${r.receipt_number}`);
          loadReceipts();
        } catch (err) {
          showToast('Failed to delete: ' + err.message, true);
        }
      }
    });
  }

  function handleShareWhatsApp(r) {
    const formattedPaid = Number(r.amount_paid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
    const formattedBal = Number(r.balance_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
    const pdfUrl = api.getReceiptPdfUrl(r.id, r.paper_format || 'A4');

    const msg = `Hello ${r.customer_name},

Thank you for your payment! Please find your official payment receipt from UDHAYAM AGENCIES below:

🧾 *Receipt No:* ${r.receipt_number}
📅 *Date:* ${r.payment_date}
📄 *Bill / Ref No:* ${r.bill_no || 'Direct'}
💳 *Payment Mode:* ${r.payment_mode}
💰 *Amount Received:* ₹${formattedPaid}
⚖️ *Remaining Balance:* ₹${formattedBal}

📥 *Download Receipt PDF:*
${pdfUrl}

${r.notes ? `\n"${r.notes}"\n` : ''}
Thank you for your business and trust in Udhayam Agencies!

📞 +91 97156 22499
📞 +91 88700 22499
UDHAYAM AGENCIES - Perundurai`;

    const cleanPhone = (r.customer_phone || '').replace(/\D/g, '');
    const waUrl = cleanPhone 
      ? `https://api.whatsapp.com/send?phone=91${cleanPhone.slice(-10)}&text=${encodeURIComponent(msg)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;

    window.open(waUrl, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="space-y-6">
      
      {/* Top Banner / Actions */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-[#00545C]/10 flex items-center justify-center">
                <Receipt className="w-5 h-5 text-[#00545C]" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                  Customer Receipts
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 font-medium">
                  Issue official payment receipts for Cash, UPI, and credit bill settlements
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => { resetForm(); setShowModal(true); }}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-[#00545C] hover:bg-[#0A6D77] text-white font-bold text-xs shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-[#7DBA00]" />
              <span>New Customer Receipt</span>
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by customer name, receipt no, bill no, or phone..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00545C]/20 focus:border-[#00545C] text-slate-800"
            />
          </div>
        </div>
      </div>

      {/* Receipts Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs flex items-center justify-center space-x-2">
            <RefreshCw className="w-4 h-4 animate-spin text-[#00545C]" />
            <span>Loading receipts...</span>
          </div>
        ) : receipts.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            <Receipt className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="font-bold text-slate-700">No receipts found</p>
            <p className="text-slate-400 mt-1">Create a receipt whenever a customer settles cash or UPI payments</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Receipt No</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Bill No</th>
                  <th className="py-3 px-4">Mode</th>
                  <th className="py-3 px-4 text-right">Amount Paid</th>
                  <th className="py-3 px-4 text-right">Balance Due</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {receipts.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-[#00545C]">
                      {r.receipt_number}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                      {r.payment_date}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{r.customer_name}</div>
                      {r.customer_phone && (
                        <div className="text-[11px] text-slate-400">{r.customer_phone}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-700">
                      {r.bill_no || '—'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                        r.payment_mode === 'UPI' ? 'bg-purple-100 text-purple-800' :
                        r.payment_mode === 'Cash' ? 'bg-emerald-100 text-emerald-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {r.payment_mode}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-extrabold text-emerald-700">
                      ₹{Number(r.amount_paid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {Number(r.balance_amount || 0) > 0 ? (
                        <span className="font-bold text-amber-700">
                          ₹{Number(r.balance_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                          Cleared
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-center space-x-1.5">
                        <button
                          type="button"
                          onClick={() => setViewPdfReceipt(r)}
                          className="p-1.5 text-slate-600 hover:text-[#00545C] hover:bg-[#00545C]/10 rounded-lg transition-colors cursor-pointer"
                          title="View / Print PDF"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleShareWhatsApp(r)}
                          className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                          title="Share on WhatsApp"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteReceipt(r)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete Receipt"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <div>Total: {totalCount} receipts</div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
              >
                Previous
              </button>
              <span className="font-semibold">{page} of {totalPages}</span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* New Customer Receipt Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="bg-[#00545C] text-white p-5 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                  <Receipt className="w-5 h-5 text-[#7DBA00]" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base">New Customer Receipt</h3>
                  <p className="text-xs text-emerald-200">Udhayam Agencies • Paint Division</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateReceipt} className="p-5 sm:p-6 space-y-4 text-xs">
              
              {/* Customer Name with quick select */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Vinoth kumar"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00545C]"
                />
                {customers.length > 0 && !customerName && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    <span className="text-[10px] text-slate-400 py-0.5">Quick select:</span>
                    {customers.slice(0, 5).map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSelectCustomer(c)}
                        className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Phone & Bill No */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Customer Phone</label>
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="e.g. 98427 11223"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00545C]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Bill / Invoice No</label>
                  <input
                    type="text"
                    value={billNo}
                    onChange={(e) => setBillNo(e.target.value)}
                    placeholder="e.g. UD23056"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00545C]"
                  />
                </div>
              </div>

              {/* Payment Date & Mode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Payment Date</label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00545C]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Payment Mode</label>
                  <div className="flex flex-wrap gap-1">
                    {['UPI', 'Cash', 'Cheque', 'Bank Transfer'].map(mode => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setPaymentMode(mode)}
                        className={`text-[10px] font-extrabold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                          paymentMode === mode
                            ? 'bg-[#00545C] text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {mode === 'Cash' && '💵 '}
                        {mode === 'UPI' && '💳 '}
                        {mode === 'Cheque' && '📝 '}
                        {mode === 'Bank Transfer' && '🏛️ '}
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Amount Paid & Balance Due */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
                <div>
                  <label className="block font-extrabold text-emerald-900 mb-1">
                    Amount Paid (Rs.) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    placeholder="e.g. 15000"
                    className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-extrabold text-base text-emerald-950"
                  />
                </div>
                <div>
                  <label className="block font-extrabold text-amber-900 mb-1">
                    Remaining Balance (Rs.)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={balanceAmount}
                    onChange={(e) => setBalanceAmount(e.target.value)}
                    placeholder="e.g. 2000 (0 if fully paid)"
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-extrabold text-base text-amber-950"
                  />
                </div>
              </div>

              {/* Reference / Txn No & Format */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Txn / Reference ID</label>
                  <input
                    type="text"
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                    placeholder="e.g. UPI Ref / Cheque No"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00545C]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">PDF Page Format</label>
                  <div className="flex gap-2">
                    {['A4', 'A5'].map(f => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setPaperFormat(f)}
                        className={`flex-1 py-2 rounded-xl font-extrabold text-xs border cursor-pointer ${
                          paperFormat === f
                            ? 'bg-[#00545C] text-white border-[#00545C]'
                            : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {f} Format
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Warm Message Notes */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Warm Thank You Message
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00545C]"
                />
              </div>

              {/* Form Submit Buttons */}
              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-600 font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center space-x-2 px-5 py-2 rounded-xl bg-[#00545C] hover:bg-[#0A6D77] text-white font-bold shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4 text-[#7DBA00]" />
                  <span>{isSubmitting ? 'Creating...' : 'Create Receipt'}</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* PDF Preview Modal */}
      {viewPdfReceipt && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-hidden">
          <div className="bg-white rounded-2xl max-w-4xl w-full h-[90vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
            <div className="bg-[#00545C] text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-[#7DBA00]" />
                <span className="font-extrabold text-sm">
                  Receipt PDF - {viewPdfReceipt.receipt_number}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handleShareWhatsApp(viewPdfReceipt)}
                  className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer shadow-xs"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Share WhatsApp</span>
                </button>
                <a
                  href={api.getReceiptPdfUrl(viewPdfReceipt.id, viewPdfReceipt.paper_format || 'A4')}
                  target="_blank"
                  rel="noreferrer"
                  download={`Receipt-${viewPdfReceipt.receipt_number}.pdf`}
                  className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-[#7DBA00] hover:bg-[#8ee000] text-[#003B40] font-extrabold text-xs cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Download / Print</span>
                </a>
                <button
                  type="button"
                  onClick={() => setViewPdfReceipt(null)}
                  className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer ml-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-slate-100 p-2 sm:p-4 overflow-hidden">
              <iframe
                title="Receipt PDF"
                src={api.getReceiptPdfUrl(viewPdfReceipt.id, viewPdfReceipt.paper_format || 'A4')}
                className="w-full h-full rounded-xl border border-slate-300 shadow-inner bg-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <ThemedConfirmDialog
        isOpen={dialogConfig.isOpen}
        title={dialogConfig.title}
        message={dialogConfig.message}
        confirmText={dialogConfig.confirmText}
        cancelText={dialogConfig.cancelText}
        type={dialogConfig.type}
        onConfirm={dialogConfig.onConfirm}
        onCancel={() => setDialogConfig({ isOpen: false })}
      />

      {/* Floating Toast Notification */}
      {toastMsg && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center space-x-2 px-4 py-3 rounded-xl shadow-xl text-xs font-bold text-white transition-all transform animate-in fade-in slide-in-from-bottom-3 ${
          toastMsg.isError ? 'bg-rose-600' : 'bg-[#00545C]'
        }`}>
          {toastMsg.isError ? (
            <span className="w-2 h-2 rounded-full bg-amber-300" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-[#7DBA00]" />
          )}
          <span>{toastMsg.text}</span>
        </div>
      )}

    </div>
  );
}
