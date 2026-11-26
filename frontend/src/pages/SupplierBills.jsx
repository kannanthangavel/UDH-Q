import React, { useState, useEffect } from 'react';
import { 
  Truck, PlusCircle, Search, MessageCircle, AlertTriangle, 
  CheckCircle2, Clock, Calendar, Check, Trash2, RefreshCw, X,
  ExternalLink, Bell, DollarSign, Filter
} from 'lucide-react';
import { api } from '../api/client';
import ThemedConfirmDialog from '../components/ThemedConfirmDialog';
import { toYMDString } from '../utils/dateHelper';

export default function SupplierBills() {
  const [bills, setBills] = useState([]);
  const [dueAlerts, setDueAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // New / Edit Bill Modal
  const [showModal, setShowModal] = useState(false);
  const [editingBill, setEditingBill] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields
  const [supplierName, setSupplierName] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [billDate, setBillDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().split('T')[0];
  });
  const [billAmount, setBillAmount] = useState('');
  const [paidAmount, setPaidAmount] = useState('0');
  const [notes, setNotes] = useState('');

  // WhatsApp Alert Dispatch Preview Modal
  const [alertDispatchInfo, setAlertDispatchInfo] = useState(null);

  // Dialog & Toast
  const [dialogConfig, setDialogConfig] = useState({ isOpen: false });
  const [toastMsg, setToastMsg] = useState(null);

  function showToast(text, isError = false) {
    setToastMsg({ text, isError });
    setTimeout(() => setToastMsg(null), 4000);
  }

  useEffect(() => {
    loadBills();
    loadDueAlerts();
  }, [search, statusFilter, page]);

  async function loadBills() {
    try {
      setLoading(true);
      const res = await api.getSupplierBills({ search, status: statusFilter, page, limit: 15 });
      setBills(res.bills || []);
      setTotalPages(res.totalPages || 1);
      setTotalCount(res.total || 0);
    } catch (err) {
      showToast('Failed to load bills: ' + err.message, true);
    } finally {
      setLoading(false);
    }
  }

  async function loadDueAlerts() {
    try {
      const res = await api.getDueAlerts();
      if (res.dueBills) {
        setDueAlerts(res.dueBills);
      }
    } catch (e) {}
  }

  function handleOpenCreate() {
    setEditingBill(null);
    setSupplierName('');
    setBillNumber('');
    setBillDate(new Date().toISOString().split('T')[0]);
    const d = new Date();
    d.setDate(d.getDate() + 15);
    setDueDate(d.toISOString().split('T')[0]);
    setBillAmount('');
    setPaidAmount('0');
    setNotes('');
    setShowModal(true);
  }

  function handleOpenEdit(b) {
    setEditingBill(b);
    setSupplierName(b.supplier_name);
    setBillNumber(b.bill_number);
    setBillDate(toYMDString(b.bill_date));
    setDueDate(toYMDString(b.due_date));
    setBillAmount(String(b.bill_amount));
    setPaidAmount(String(b.paid_amount || 0));
    setNotes(b.notes || '');
    setShowModal(true);
  }

  async function handleSaveBill(e) {
    e.preventDefault();
    if (!supplierName.trim()) {
      showToast('Please enter supplier name', true);
      return;
    }
    if (!billNumber.trim()) {
      showToast('Please enter bill number', true);
      return;
    }
    const amt = parseFloat(billAmount);
    if (!amt || amt <= 0) {
      showToast('Please enter valid bill amount', true);
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        supplier_name: supplierName.trim(),
        bill_number: billNumber.trim(),
        bill_date: billDate,
        due_date: dueDate,
        bill_amount: amt,
        paid_amount: parseFloat(paidAmount) || 0,
        notes: notes.trim()
      };

      if (editingBill) {
        await api.updateSupplierBill(editingBill.id, payload);
        showToast(`✓ Updated purchase bill ${billNumber}`);
      } else {
        await api.createSupplierBill(payload);
        showToast(`✓ Added purchase bill for ${supplierName}`);
      }

      setShowModal(false);
      loadBills();
      loadDueAlerts();
    } catch (err) {
      showToast('Failed to save bill: ' + err.message, true);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleMarkPaid(b) {
    try {
      await api.updateSupplierBill(b.id, {
        paid_amount: b.bill_amount,
        status: 'Paid'
      });
      showToast(`✓ Bill ${b.bill_number} marked as Paid!`);
      loadBills();
      loadDueAlerts();
    } catch (err) {
      showToast('Failed to mark paid: ' + err.message, true);
    }
  }

  function handleDeleteBill(b) {
    setDialogConfig({
      isOpen: true,
      title: 'Delete Purchase Bill',
      message: `Permanently delete purchase bill "${b.bill_number}" from ${b.supplier_name} (Rs. ${b.bill_amount})?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger',
      onConfirm: async () => {
        setDialogConfig({ isOpen: false });
        try {
          await api.deleteSupplierBill(b.id);
          showToast(`✓ Deleted bill ${b.bill_number}`);
          loadBills();
          loadDueAlerts();
        } catch (err) {
          showToast('Failed to delete: ' + err.message, true);
        }
      }
    });
  }

  async function handleSendAlert(b) {
    try {
      const res = await api.sendSupplierAlert(b.id);
      setAlertDispatchInfo(res);
      showToast('✓ WhatsApp payment alerts ready to dispatch!');
    } catch (err) {
      showToast('Failed to generate alert: ' + err.message, true);
    }
  }

  function getDaysUntilDue(dueDateStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDateStr);
    due.setHours(0, 0, 0, 0);
    const diffTime = due - today;
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  }

  return (
    <div className="space-y-6">
      
      {/* Top Banner / Actions */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Truck className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                  Supplier Payments & Due Alerts
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 font-medium">
                  Track vendor purchase bills (Asian Paints, etc.) and auto-send WhatsApp due alerts to +91 97156 22499 & +91 88700 22499
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleOpenCreate}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-[#00545C] hover:bg-[#0A6D77] text-white font-bold text-xs shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-[#7DBA00]" />
              <span>New Purchase Bill</span>
            </button>
          </div>
        </div>

        {/* Due Alerts Notification Banner */}
        {dueAlerts.length > 0 && (
          <div className="mt-5 p-4 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-extrabold text-amber-900 text-xs sm:text-sm">
                  {dueAlerts.length} Supplier Payment{dueAlerts.length > 1 ? 's' : ''} Due Tomorrow or Overdue!
                </span>
                <p className="text-xs text-amber-800 mt-0.5">
                  Bills for {dueAlerts.map(d => `${d.supplier_name} (Rs. ${Number(d.bill_amount).toLocaleString('en-IN')})`).slice(0, 2).join(', ')} require payment settlement.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleSendAlert(dueAlerts[0])}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs shadow-xs cursor-pointer whitespace-nowrap self-start sm:self-auto"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Send Due WhatsApp Alert</span>
            </button>
          </div>
        )}

        {/* Search & Filter Tabs */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by supplier (Asian Paints, etc.) or bill number..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00545C]/20 focus:border-[#00545C] text-slate-800"
            />
          </div>

          <div className="flex items-center space-x-1 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            {['all', 'Pending', 'Overdue', 'Paid'].map(s => (
              <button
                key={s}
                type="button"
                onClick={() => { setStatusFilter(s); setPage(1); }}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  statusFilter === s
                    ? 'bg-[#00545C] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {s === 'all' ? 'All Bills' : s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Supplier Bills Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs flex items-center justify-center space-x-2">
            <RefreshCw className="w-4 h-4 animate-spin text-[#00545C]" />
            <span>Loading purchase bills...</span>
          </div>
        ) : bills.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            <Truck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="font-bold text-slate-700">No purchase bills recorded</p>
            <p className="text-slate-400 mt-1">Add vendor purchase bills to track due dates and automated alerts</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4">Bill No</th>
                  <th className="py-3 px-4">Bill Date</th>
                  <th className="py-3 px-4">Due Date & Status</th>
                  <th className="py-3 px-4 text-right">Bill Amount</th>
                  <th className="py-3 px-4 text-right">Balance Due</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bills.map((b) => {
                  const daysLeft = getDaysUntilDue(b.due_date);
                  const isPaid = b.status === 'Paid';
                  const isOverdue = !isPaid && daysLeft < 0;
                  const isDueTomorrow = !isPaid && daysLeft === 1;
                  const isDueToday = !isPaid && daysLeft === 0;

                  return (
                    <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-extrabold text-slate-900">{b.supplier_name}</div>
                        {b.notes && <div className="text-[11px] text-slate-400 truncate max-w-xs">{b.notes}</div>}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                        {b.bill_number}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                        {b.bill_date}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-800">{b.due_date}</div>
                        {!isPaid && (
                          <div className="text-[10px] font-extrabold mt-0.5">
                            {isOverdue && (
                              <span className="text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                                {Math.abs(daysLeft)} Day{Math.abs(daysLeft) > 1 ? 's' : ''} Overdue
                              </span>
                            )}
                            {isDueToday && (
                              <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                                Due Today!
                              </span>
                            )}
                            {isDueTomorrow && (
                              <span className="text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded font-black">
                                Due Tomorrow!
                              </span>
                            )}
                            {daysLeft > 1 && (
                              <span className="text-slate-500">
                                In {daysLeft} days
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-extrabold text-slate-900">
                        ₹{Number(b.bill_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {isPaid ? (
                          <span className="text-emerald-600 font-bold">Cleared</span>
                        ) : (
                          <span className="font-bold text-amber-700">
                            ₹{Number((b.bill_amount || 0) - (b.paid_amount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                          isPaid ? 'bg-emerald-100 text-emerald-800' :
                          isOverdue ? 'bg-rose-100 text-rose-800' :
                          isDueTomorrow || isDueToday ? 'bg-amber-100 text-amber-800' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {b.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            type="button"
                            onClick={() => handleSendAlert(b)}
                            className="p-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                            title="Send Due WhatsApp Alert (+91 97156 22499 & +91 88700 22499)"
                          >
                            <Bell className="w-4 h-4" />
                          </button>
                          {!isPaid && (
                            <button
                              type="button"
                              onClick={() => handleMarkPaid(b)}
                              className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                              title="Mark as Paid"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(b)}
                            className="p-1.5 text-slate-500 hover:text-[#00545C] hover:bg-[#00545C]/10 rounded-lg transition-colors cursor-pointer"
                            title="Edit Bill"
                          >
                            <Calendar className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteBill(b)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Bill"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <div>Total: {totalCount} bills</div>
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

      {/* New / Edit Purchase Bill Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="bg-[#00545C] text-white p-5 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                  <Truck className="w-5 h-5 text-[#7DBA00]" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base">
                    {editingBill ? 'Edit Purchase Bill' : 'New Purchase Bill'}
                  </h3>
                  <p className="text-xs text-emerald-200">Asian Paints • Berger • Agaram • Tools</p>
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

            <form onSubmit={handleSaveBill} className="p-5 sm:p-6 space-y-4 text-xs">
              
              {/* Supplier Name */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Supplier Name *
                </label>
                <input
                  type="text"
                  required
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="e.g. Asian Paints, Berger Paints, Agaram"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00545C]"
                />
                <div className="flex flex-wrap gap-1 mt-1.5">
                  <span className="text-[10px] text-slate-400 py-0.5">Quick picks:</span>
                  {['Asian Paints', 'Berger Paints', 'Agaram Paints', 'Pidilite', 'Esdee'].map(brand => (
                    <button
                      key={brand}
                      type="button"
                      onClick={() => setSupplierName(brand)}
                      className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                    >
                      {brand}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bill Number */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Bill / Invoice Number *
                </label>
                <input
                  type="text"
                  required
                  value={billNumber}
                  onChange={(e) => setBillNumber(e.target.value)}
                  placeholder="e.g. 1525-22522-2255"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00545C]"
                />
              </div>

              {/* Bill Date & Due Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Bill Date *</label>
                  <div className="relative">
                    <input
                      type="date"
                      required
                      value={toYMDString(billDate)}
                      onChange={(e) => setBillDate(e.target.value)}
                      onClick={(e) => { try { e.target.showPicker(); } catch (err) {} }}
                      className="w-full px-3 py-2 pr-9 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00545C] cursor-pointer font-medium text-slate-800"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        const input = e.currentTarget.previousElementSibling;
                        if (input && input.showPicker) {
                          try { input.showPicker(); } catch (err) { input.focus(); }
                        }
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#00545C] cursor-pointer p-0.5"
                      title="Open calendar"
                    >
                      <Calendar className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Payment Due Date *</label>
                  <div className="relative">
                    <input
                      type="date"
                      required
                      value={toYMDString(dueDate)}
                      onChange={(e) => setDueDate(e.target.value)}
                      onClick={(e) => { try { e.target.showPicker(); } catch (err) {} }}
                      className="w-full px-3 py-2 pr-9 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00545C] cursor-pointer font-medium text-slate-800"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        const input = e.currentTarget.previousElementSibling;
                        if (input && input.showPicker) {
                          try { input.showPicker(); } catch (err) { input.focus(); }
                        }
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#00545C] cursor-pointer p-0.5"
                      title="Open calendar"
                    >
                      <Calendar className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Bill Amount & Paid Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-amber-50/60 rounded-xl border border-amber-100">
                <div>
                  <label className="block font-extrabold text-amber-900 mb-1">
                    Bill Amount (Rs.) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={billAmount}
                    onChange={(e) => setBillAmount(e.target.value)}
                    placeholder="e.g. 23456"
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-extrabold text-base text-amber-950"
                  />
                </div>
                <div>
                  <label className="block font-extrabold text-slate-800 mb-1">
                    Amount Already Paid
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    placeholder="0 if unpaid"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00545C] font-extrabold text-base text-slate-900"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Notes / Remarks</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. 30 days credit terms, cheque payment"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00545C]"
                />
              </div>

              {/* Submit Buttons */}
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
                  <span>{isSubmitting ? 'Saving...' : (editingBill ? 'Update Bill' : 'Save Purchase Bill')}</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Alert Dispatch Modal (Dispatches to +91 97156 22499 & +91 88700 22499) */}
      {alertDispatchInfo && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="bg-amber-600 text-white p-5 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                  <Bell className="w-5 h-5 text-amber-200" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base">WhatsApp Due Alert Dispatched</h3>
                  <p className="text-xs text-amber-100">Sent to designated partner numbers</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAlertDispatchInfo(null)}
                className="p-1 rounded-lg text-amber-200 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4 text-xs">
              <p className="text-slate-600">
                Payment due alert formatted and ready. You can 1-click open WhatsApp for both numbers without requiring approval:
              </p>

              {/* Message preview box */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px] text-slate-800 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                {alertDispatchInfo.alertMessage}
              </div>

              {/* Click buttons for each number */}
              <div className="space-y-2 pt-2">
                {alertDispatchInfo.urls?.map((target, idx) => (
                  <a
                    key={idx}
                    href={target.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-900 font-extrabold transition-colors cursor-pointer"
                  >
                    <div className="flex items-center space-x-2">
                      <MessageCircle className="w-4 h-4 text-emerald-600" />
                      <span>Send WhatsApp to {target.phone}</span>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
                  </a>
                ))}
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAlertDispatchInfo(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold cursor-pointer"
                >
                  Close
                </button>
              </div>
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
