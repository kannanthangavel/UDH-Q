import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Search,
  RefreshCw,
  PlusCircle,
  FileCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Phone,
  User,
  Send,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Info
} from 'lucide-react';
import { api } from '../../api/client';
import { formatINR, formatDate, formatDateTime } from '../../utils/currency';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';

export function WhatsAppInbox({ onOpenQuotation, onNavigateToNewQuote }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMessage, setSelectedMessage] = useState(null);

  // Simulator Modal State
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [simMessage, setSimMessage] = useState(
    'Vanakkam sir, need 20 bags OPC 53 cement and 2 buckets paint golden brown 1lt for Ramesh 9876543210. Need GST quote in A5'
  );
  const [simPhone, setSimPhone] = useState('9876543210');
  const [simName, setSimName] = useState('Ramesh Kumar');
  const [simulating, setSimulating] = useState(false);
  const [simSuccessMessage, setSimSuccessMessage] = useState(null);

  useEffect(() => {
    fetchInbox();
  }, [statusFilter, searchTerm]);

  async function fetchInbox() {
    try {
      setLoading(true);
      const res = await api.getWhatsAppInbox({
        status: statusFilter,
        search: searchTerm
      });
      const list = res.messages || [];
      setMessages(list);
      if (list.length > 0 && !selectedMessage) {
        setSelectedMessage(list[0]);
      } else if (selectedMessage) {
        // Keep selected message refreshed
        const updated = list.find(m => m.id === selectedMessage.id);
        if (updated) setSelectedMessage(updated);
      }
    } catch (err) {
      console.error('Failed to load WhatsApp inbox:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSimulateMessage(e) {
    e.preventDefault();
    if (!simMessage.trim()) return;

    try {
      setSimulating(true);
      setSimSuccessMessage(null);

      const res = await api.simulateWhatsAppMessage({
        message: simMessage,
        senderPhone: simPhone,
        senderName: simName
      });

      setSimSuccessMessage(`Message ingested! Automatic draft ${res.data?.quotation_number || ''} prepared.`);
      await fetchInbox();

      if (res.data) {
        setSelectedMessage(res.data);
      }

      setTimeout(() => {
        setSimulatorOpen(false);
        setSimSuccessMessage(null);
      }, 1800);
    } catch (err) {
      alert(err.message || 'Failed to simulate message.');
    } finally {
      setSimulating(false);
    }
  }

  // Parse extracted items JSON safely
  let parsedExtracted = null;
  if (selectedMessage?.extracted_json) {
    try {
      parsedExtracted = JSON.parse(selectedMessage.extracted_json);
    } catch (_) {}
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      {/* Workspace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-emerald-600" />
            <span>WhatsApp Business Inbox</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time feed of customer material requests received via WhatsApp Business Platform.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchInbox}
            className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-md hover:bg-slate-50 transition-colors shadow-2xs flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => setSimulatorOpen(true)}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-md shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Simulate Incoming WhatsApp</span>
          </button>
        </div>
      </div>

      {/* Main 2-Pane Inbox Layout */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[580px]">
        {/* Left Pane: Conversation / Message List */}
        <div className="md:col-span-5 lg:col-span-4 border-r border-slate-200 flex flex-col h-full bg-slate-50/50">
          {/* Search & Filters */}
          <div className="p-3 border-b border-slate-200 space-y-2 bg-white">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search phone, customer, or message..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
              />
            </div>

            {/* Status Pills Filter */}
            <div className="flex items-center gap-1 overflow-x-auto text-[11px] pb-1">
              {[
                { id: 'all', label: 'All' },
                { id: 'draft_ready', label: 'Draft Ready' },
                { id: 'needs_review', label: 'Needs Review' },
                { id: 'needs_clarification', label: 'Clarification' }
              ].map(st => (
                <button
                  key={st.id}
                  onClick={() => setStatusFilter(st.id)}
                  className={`px-2 py-0.5 rounded-full whitespace-nowrap transition-colors font-medium ${
                    statusFilter === st.id
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* List of Messages */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {messages.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                {loading ? 'Loading incoming messages...' : 'No WhatsApp messages found.'}
              </div>
            ) : (
              messages.map((m) => {
                const isSelected = selectedMessage?.id === m.id;
                return (
                  <div
                    key={m.id}
                    onClick={() => setSelectedMessage(m)}
                    className={`p-3 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-blue-50/80 border-l-4 border-l-blue-600'
                        : 'hover:bg-slate-100/70 border-l-4 border-l-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-bold text-slate-900 text-xs truncate">
                          {m.sender_name || 'Customer'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {m.sender_phone}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {formatDateTime(m.received_at)}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                      {m.raw_content}
                    </p>

                    <div className="mt-2 flex items-center justify-between">
                      <div>
                        {m.processing_status === 'draft_ready' ? (
                          <Badge variant="success">Draft Ready</Badge>
                        ) : m.processing_status === 'needs_review' ? (
                          <Badge variant="warning">Needs Review</Badge>
                        ) : m.processing_status === 'needs_clarification' ? (
                          <Badge variant="danger">Clarification</Badge>
                        ) : (
                          <Badge variant="default">{m.processing_status}</Badge>
                        )}
                      </div>

                      {m.quotation_number && (
                        <span className="font-mono text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                          {m.quotation_number}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Pane: Detailed Message Inspection & Prepared Quotation */}
        <div className="md:col-span-7 lg:col-span-8 p-5 flex flex-col justify-between overflow-y-auto">
          {selectedMessage ? (
            <div className="space-y-5">
              {/* Message Header Details */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                    <User className="w-4 h-4 text-emerald-700" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      {selectedMessage.sender_name || 'Valued Customer'}
                    </h3>
                    <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                      <span className="font-mono">{selectedMessage.sender_phone}</span>
                      <span>•</span>
                      <span>Received: {formatDateTime(selectedMessage.received_at)}</span>
                    </div>
                  </div>
                </div>

                {selectedMessage.quotation_id && (
                  <button
                    type="button"
                    onClick={() => onOpenQuotation(selectedMessage.quotation_id)}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
                  >
                    <span>Open Quotation Draft</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Raw Message Card */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Original WhatsApp Customer Message:</span>
                </label>
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 whitespace-pre-wrap leading-relaxed select-all">
                  {selectedMessage.raw_content}
                </div>
              </div>

              {/* Automated Extraction & Matching Result */}
              {parsedExtracted && parsedExtracted.items && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Automated Extraction & Active Price-List Matching:</span>
                  </label>

                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="min-w-full text-xs text-left divide-y divide-slate-200">
                      <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px]">
                        <tr>
                          <th className="px-3 py-2">Customer Query</th>
                          <th className="px-3 py-2">Matched Price-List Product</th>
                          <th className="px-3 py-2 text-center">Qty / Unit</th>
                          <th className="px-3 py-2 text-right">Verified Rate</th>
                          <th className="px-3 py-2 text-center">Match Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {parsedExtracted.items.map((it, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/60">
                            <td className="px-3 py-2 font-mono text-slate-600 text-[11px]">
                              {it.rawPhrase || it.productName}
                            </td>
                            <td className="px-3 py-2 font-medium text-slate-900">
                              {it.matchedProduct?.product_name || it.productName || 'Unmatched'}
                            </td>
                            <td className="px-3 py-2 text-center text-slate-700">
                              {it.quantity} {it.unit}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-slate-900">
                              {it.salesRate > 0 ? formatINR(it.salesRate) : <span className="text-rose-500">Missing</span>}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {it.matchStatus === 'Exact Match' ? (
                                <Badge variant="success">Exact</Badge>
                              ) : it.matchStatus === 'No Match' ? (
                                <Badge variant="danger">No Match</Badge>
                              ) : (
                                <Badge variant="warning">{it.matchStatus}</Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Prepared Quotation Summary Callout */}
              {selectedMessage.quotation_number && (
                <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-lg flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">
                      Auto-Prepared Quotation Draft
                    </span>
                    <span className="text-base font-bold text-slate-900">
                      {selectedMessage.quotation_number}
                    </span>
                    <span className="text-xs text-slate-600 block mt-0.5">
                      Grand Total: <b>{formatINR(selectedMessage.quotation_grand_total || 0)}</b>
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenQuotation(selectedMessage.quotation_id)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
                  >
                    <span>Review in Workspace</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="p-12 text-center text-slate-400 text-xs">
              Select an incoming WhatsApp message from the left to view details.
            </div>
          )}
        </div>
      </div>

      {/* Simulator Modal */}
      <Modal
        isOpen={simulatorOpen}
        onClose={() => setSimulatorOpen(false)}
        title="Simulate Incoming WhatsApp Business Message"
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSimulateMessage} className="space-y-4 text-xs">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-800 text-xs flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              This testing tool simulates receiving a customer message via Meta's WhatsApp Business webhook. It runs real message extraction, product matching against the active Udhayam price list, and automatic quotation drafting!
            </span>
          </div>

          {simSuccessMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{simSuccessMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Customer Phone #</label>
              <input
                type="text"
                value={simPhone}
                onChange={(e) => setSimPhone(e.target.value)}
                className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-md focus:bg-white"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Customer Name</label>
              <input
                type="text"
                value={simName}
                onChange={(e) => setSimName(e.target.value)}
                className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-md focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">WhatsApp Message Content</label>
            <textarea
              rows={4}
              value={simMessage}
              onChange={(e) => setSimMessage(e.target.value)}
              className="w-full font-mono text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-md focus:bg-white leading-relaxed"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setSimulatorOpen(false)}
              className="px-3 py-1.5 border border-slate-200 rounded-md text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={simulating}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-md flex items-center gap-1.5 disabled:opacity-50"
            >
              {simulating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>Process & Auto-Draft</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
