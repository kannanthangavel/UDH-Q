import React, { useState, useEffect } from 'react';
import {
  FileText,
  UploadCloud,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileSpreadsheet,
  PlusCircle,
  Download,
  Eye,
  ExternalLink,
  RefreshCw,
  MessageSquare,
  Layers,
  ArrowRight,
  ShieldAlert,
  Smartphone,
  Check
} from 'lucide-react';
import { api } from '../../api/client';
import { formatINR, formatDate, formatDateTime } from '../../utils/currency';
import { Badge } from '../../components/Badge';

export function Dashboard({
  onNavigateToNewQuote,
  onNavigateToPriceList,
  onOpenQuotation,
  onViewPdf,
  onNavigateToQueue,
  onNavigateToInbox
}) {
  const [metrics, setMetrics] = useState(null);
  const [recentQuotes, setRecentQuotes] = useState([]);
  const [pendingAttentionQueue, setPendingAttentionQueue] = useState([]);
  const [recentWhatsAppActivity, setRecentWhatsAppActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getDashboardMetrics();
      setMetrics(res.metrics || {});
      setRecentQuotes(res.recentQuotations || []);
      setPendingAttentionQueue(res.pendingAttentionQueue || []);
      setRecentWhatsAppActivity(res.recentWhatsAppActivity || []);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard metrics.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Welcome & Operational Command Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Operational Command Center</h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time WhatsApp ingestion, automated quotation drafting, and price list synchronization.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchDashboardData}
            className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors shadow-2xs"
            title="Refresh metrics"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onNavigateToPriceList}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-md shadow-2xs transition-colors"
          >
            <UploadCloud className="w-4 h-4 text-slate-500" />
            Price List
          </button>
          <button
            onClick={onNavigateToNewQuote}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md shadow-2xs transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            Create Quotation
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 4 Primary Operational KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Incoming WhatsApp Ingestion */}
        <div
          onClick={onNavigateToInbox}
          className="bg-white p-5 rounded-lg border border-slate-200 shadow-2xs hover:border-emerald-300 transition-all cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">WhatsApp Ingestion</span>
            <div className="w-8 h-8 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold text-slate-900">
              {metrics?.totalWhatsApp || 0}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-slate-500">
                {metrics?.draftsReady || 0} auto-drafted
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-xs text-emerald-600 font-medium">View Inbox &rarr;</span>
            </div>
          </div>
        </div>

        {/* Card 2: Drafts Ready for Review */}
        <div
          onClick={onNavigateToQueue}
          className="bg-white p-5 rounded-lg border border-slate-200 shadow-2xs hover:border-blue-300 transition-all cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ready for Review</span>
            <div className="w-8 h-8 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold text-blue-600">
              {metrics?.draftQuotations || 0}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="primary">Awaiting Operator</Badge>
              <span className="text-xs text-slate-400">Review Queue &rarr;</span>
            </div>
          </div>
        </div>

        {/* Card 3: Needs Clarification */}
        <div
          onClick={onNavigateToInbox}
          className="bg-white p-5 rounded-lg border border-slate-200 shadow-2xs hover:border-amber-300 transition-all cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Needs Clarification</span>
            <div className="w-8 h-8 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold text-amber-600">
              {(metrics?.clarificationNeeded || 0) + (metrics?.needsReview || 0)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Bill inquiries or ambiguous items
            </p>
          </div>
        </div>

        {/* Card 4: Finalized Quotations */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Finalized Quotations</span>
            <div className="w-8 h-8 rounded-md bg-purple-50 text-purple-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold text-slate-900">
              {metrics?.finalizedQuotations || 0}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              <span className="font-semibold text-emerald-600">+{metrics?.finalizedToday || 0} today</span> with immutable PDF snapshots
            </p>
          </div>
        </div>
      </div>

      {/* Two Column Split: Operator Attention Queue (Left 7 cols) & WhatsApp Feed (Right 5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Requires Operator Attention Queue */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                Requires Operator Attention
              </h2>
              <p className="text-xs text-slate-500">Drafts pending human review and price confirmation</p>
            </div>
            <button
              onClick={onNavigateToQueue}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
            >
              <span>View All Queue</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {pendingAttentionQueue.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <Check className="w-5 h-5" />
              </div>
              <p className="text-xs font-semibold text-slate-900">All caught up!</p>
              <p className="text-xs text-slate-400">No quotation drafts currently require urgent operator review.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {pendingAttentionQueue.map((item) => (
                <div
                  key={item.id}
                  className="p-4 hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-4"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-blue-600">{item.quotation_number}</span>
                      <span className="text-slate-300">•</span>
                      <span className="text-xs font-semibold text-slate-900 truncate">
                        {item.customer_name || 'Customer'}
                      </span>
                      {item.customer_phone && (
                        <span className="text-[11px] text-slate-400 font-mono">({item.customer_phone})</span>
                      )}
                    </div>

                    {item.message_snippet && (
                      <p className="text-[11px] text-slate-600 italic truncate max-w-md">
                        "{item.message_snippet}"
                      </p>
                    )}

                    <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-0.5">
                      <span>{item.item_count} items</span>
                      {item.review_items_count > 0 && (
                        <span className="text-amber-600 font-medium">
                          ⚠️ {item.review_items_count} need price verification
                        </span>
                      )}
                      <span>Total: <strong className="text-slate-900 font-bold">{formatINR(item.grand_total)}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => onOpenQuotation(item.id)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md shadow-2xs transition-colors"
                    >
                      Review Draft
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Recent WhatsApp Ingestion Activity */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-600" />
                Live WhatsApp Activity
              </h2>
              <p className="text-xs text-slate-500">Incoming customer messages & auto-classification</p>
            </div>
            <button
              onClick={onNavigateToInbox}
              className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1"
            >
              <span>Inbox</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentWhatsAppActivity.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <div className="w-10 h-10 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                <Smartphone className="w-5 h-5" />
              </div>
              <p className="text-xs font-semibold text-slate-700">No WhatsApp messages yet</p>
              <p className="text-xs text-slate-400">Simulate incoming customer requests from the WhatsApp Inbox.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentWhatsAppActivity.map((msg) => (
                <div key={msg.id} className="p-3.5 hover:bg-slate-50/60 transition-colors space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">
                      {msg.sender_name || msg.sender_phone}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {formatDateTime(msg.received_at)}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-2">
                    {msg.raw_content}
                  </p>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1.5">
                      {msg.processing_status === 'draft_ready' && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Draft Ready
                        </span>
                      )}
                      {msg.processing_status === 'needs_review' && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          Needs Review
                        </span>
                      )}
                      {msg.processing_status === 'needs_clarification' && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                          Clarification
                        </span>
                      )}
                      {msg.intent && (
                        <span className="text-[10px] text-slate-400">
                          [{msg.intent}]
                        </span>
                      )}
                    </div>

                    {msg.quotation_id && (
                      <button
                        onClick={() => onOpenQuotation(msg.quotation_id)}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                      >
                        {msg.quotation_number || 'View Quote'} &rarr;
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Active Price List Status Banner */}
      <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900">
                {metrics?.activePriceList?.filename || 'No Active Price List'}
              </span>
              {metrics?.activePriceList?.is_demo ? (
                <Badge variant="warning">Demo Price List</Badge>
              ) : (
                <Badge variant="success">Version {metrics?.activePriceList?.version || 1}</Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {metrics?.totalProducts || 0} active products in catalog. Upload new price lists anytime without disrupting existing quotes.
            </p>
          </div>
        </div>
        <button
          onClick={onNavigateToPriceList}
          className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold rounded-md transition-colors shrink-0 shadow-2xs"
        >
          Manage Catalog & Price Lists
        </button>
      </div>

      {/* Recent Quotations Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Recent Quotations</h2>
            <p className="text-xs text-slate-500">Latest quotation drafts and finalized documents</p>
          </div>
          <button
            onClick={() => onNavigateToNewQuote()}
            className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
          >
            + New Quote
          </button>
        </div>

        {recentQuotes.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">No Quotations Created Yet</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Paste customer WhatsApp requirements or wait for incoming WhatsApp messages to prepare quotations.
            </p>
            <div className="pt-2">
              <button
                onClick={onNavigateToNewQuote}
                className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-md shadow-2xs hover:bg-blue-700"
              >
                Create Your First Quotation
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Quote #</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Items</th>
                  <th className="px-4 py-3">Grand Total</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Paper</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {recentQuotes.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-blue-600">
                      {q.quotation_number}
                    </td>
                    <td className="px-4 py-3 text-slate-900 font-medium">
                      {q.customer_name || 'Valued Customer'}
                      {q.customer_phone && (
                        <div className="text-[11px] text-slate-400 font-mono">{q.customer_phone}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {formatDate(q.created_at)}
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-medium">
                      {q.item_count}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900">
                      {formatINR(q.grand_total)}
                    </td>
                    <td className="px-4 py-3">
                      {q.document_type === 'gst_quotation' ? (
                        <Badge variant="primary">GST Quote</Badge>
                      ) : (
                        <Badge variant="default">Estimation</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-slate-600">{q.paper_size || 'A5'}</span>
                    </td>
                    <td className="px-4 py-3">
                      {q.status === 'finalized' ? (
                        <Badge variant="success">Finalized</Badge>
                      ) : (
                        <Badge variant="warning">Draft</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => onOpenQuotation(q.id)}
                        className="text-blue-600 hover:text-blue-800 font-semibold"
                      >
                        {q.status === 'finalized' ? 'View' : 'Edit Draft'}
                      </button>
                      {q.pdf_filename && (
                        <button
                          onClick={() => onViewPdf(q.id)}
                          className="text-slate-600 hover:text-slate-900 font-medium"
                          title="View PDF"
                        >
                          PDF
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
