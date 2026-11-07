import React, { useState, useEffect } from 'react';
import { 
  Users, Search, Plus, Edit, Phone, Mail, MapPin, 
  FileText, ArrowRight, X, AlertCircle, CheckCircle2
} from 'lucide-react';
import { api } from '../api/client';

export default function Customers({ setActivePage, onStartQuoteForCustomer }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Customer History Drawer
  const [historyCust, setHistoryCust] = useState(null);
  const [customerQuotes, setCustomerQuotes] = useState([]);
  const [loadingQuotes, setLoadingQuotes] = useState(false);

  useEffect(() => {
    loadCustomers();
  }, [search]);

  async function loadCustomers() {
    try {
      setLoading(true);
      const res = await api.getCustomers(search);
      setCustomers(res.customers || []);
    } catch (err) {
      console.warn('Failed to load customers:', err);
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingCustomer(null);
    setName('');
    setPhone('');
    setEmail('');
    setAddress('');
    setFormError('');
    setModalOpen(true);
  }

  function openEditModal(cust) {
    setEditingCustomer(cust);
    setName(cust.name);
    setPhone(cust.phone);
    setEmail(cust.email || '');
    setAddress(cust.address || '');
    setFormError('');
    setModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Customer name is required');
      return;
    }
    if (!phone.trim()) {
      setFormError('Phone number is required');
      return;
    }

    try {
      setIsSaving(true);
      setFormError('');
      if (editingCustomer) {
        await api.updateCustomer(editingCustomer.id, { name, phone, email, address });
      } else {
        await api.createCustomer({ name, phone, email, address });
      }
      setModalOpen(false);
      loadCustomers();
    } catch (err) {
      setFormError(err.message || 'Failed to save customer');
    } finally {
      setIsSaving(false);
    }
  }

  async function openHistory(cust) {
    setHistoryCust(cust);
    try {
      setLoadingQuotes(true);
      const res = await api.getCustomerQuotations(cust.id);
      setCustomerQuotes(res.quotations || []);
    } catch (err) {
      console.warn('Failed to load customer quotes:', err);
    } finally {
      setLoadingQuotes(false);
    }
  }

  function handleCreateQuoteForCust(cust) {
    if (onStartQuoteForCustomer) {
      onStartQuoteForCustomer(cust);
    }
    setActivePage('create-quotation');
  }

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[#00545C]">
            Customer Management
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Directory of buyers, contractors, and builders • Fast auto-fill for quotations
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-[#7DBA00] hover:bg-[#8ee000] text-[#003B40] font-black text-xs sm:text-sm shadow-md transition-all active:scale-95"
        >
          <Plus className="w-4 h-4 text-[#003B40]" />
          <span>+ Add Customer</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex items-center justify-between">
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer name, phone number, or email..."
            className="w-full pl-9 pr-4 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00545C]"
          />
        </div>
        <span className="text-xs text-slate-500 font-semibold hidden sm:inline">
          {customers.length} customer(s) found
        </span>
      </div>

      {/* Customer Cards / Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#00545C] text-white text-[11px] font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Customer Name</th>
                <th className="py-3 px-4">Phone Number</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Address / Site</th>
                <th className="py-3 px-4 text-center">Quotations</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    Loading customers...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    No customers found. Click "+ Add Customer" to create one.
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {c.name}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-700">
                      {c.phone}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {c.email || '-'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate">
                      {c.address || '-'}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => openHistory(c)}
                        className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-[#00545C] hover:bg-emerald-50 transition-colors"
                      >
                        {c.total_quotations || 0} quotes
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => handleCreateQuoteForCust(c)}
                          className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-[#7DBA00]/15 hover:bg-[#7DBA00]/30 text-[#003B40] text-xs font-bold transition-colors"
                          title="Prepare quotation for this customer"
                        >
                          <FileText className="w-3.5 h-3.5 text-[#00545C]" />
                          <span>+ Quote</span>
                        </button>
                        <button
                          onClick={() => openEditModal(c)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Edit Customer"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Customer Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-[#00545C] text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-base">
                {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="p-1 rounded text-slate-300 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 text-xs">
              {formError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Customer / Business Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Murali Builders / Karthik"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00545C]"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Phone Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +91 98427 11223"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00545C]"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="customer@domain.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00545C]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Site / Delivery Address
                </label>
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street, City, Pincode"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00545C]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 font-bold text-white bg-[#00545C] hover:bg-[#0A6D77] rounded-xl shadow active:scale-95"
                >
                  {isSaving ? 'Saving...' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Quotation History Modal */}
      {historyCust && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-[#00545C] text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">Quotation History</h3>
                <p className="text-xs text-emerald-200">{historyCust.name} ({historyCust.phone})</p>
              </div>
              <button onClick={() => setHistoryCust(null)} className="p-1 rounded text-slate-300 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {loadingQuotes ? (
                <div className="text-center p-6 text-slate-400 text-xs">Loading quote history...</div>
              ) : customerQuotes.length === 0 ? (
                <div className="text-center p-6 text-slate-500 text-xs">
                  No quotations created for this customer yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto text-xs">
                  {customerQuotes.map(q => (
                    <div key={q.id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <span className="font-mono font-bold text-[#00545C]">{q.quotation_number}</span>
                        <span className="text-slate-400 ml-2">Date: {q.quotation_date}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-slate-900 block">
                          ₹{Number(q.grand_total).toFixed(2)}
                        </span>
                        <span className="text-[10px] font-bold uppercase text-slate-500">{q.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <button
                onClick={() => handleCreateQuoteForCust(historyCust)}
                className="font-bold text-[#00545C] hover:underline"
              >
                + Prepare New Quotation
              </button>
              <button
                onClick={() => setHistoryCust(null)}
                className="px-4 py-1.5 font-bold text-slate-600 hover:bg-slate-200 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
