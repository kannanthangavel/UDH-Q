import React, { useState, useEffect } from 'react';
import {
  Layers,
  Search,
  RefreshCw,
  FileCheck,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Filter,
  Calendar,
  ExternalLink
} from 'lucide-react';
import { api } from '../../api/client';
import { formatINR, formatDate, formatDateTime } from '../../utils/currency';
import { Badge } from '../../components/Badge';

export function QuotationQueue({ onOpenQuotation }) {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all' | 'ready' | 'approved'
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchQueue();
  }, [filter]);

  async function fetchQueue() {
    try {
      setLoading(true);
      const res = await api.getQuotationQueue({ status: filter });
      setQueue(res.queue || []);
    } catch (err) {
      console.error('Failed to load quotation queue:', err);
    } finally {
      setLoading(false);
    }
  }

  const filteredQueue = queue.filter(q => {
    if (!searchTerm.trim()) return true;
    const s = searchTerm.toLowerCase();
    return (
      (q.quotation_number && q.quotation_number.toLowerCase().includes(s)) ||
      (q.customer_name && q.customer_name.toLowerCase().includes(s)) ||
      (q.customer_phone && q.customer_phone.includes(s))
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      {/* Workspace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-600" />
            <span>Quotation Review Queue</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Auto-prepared drafts requiring operator review, price confirmation, or explicit approval before sending.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchQueue}
          className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-md hover:bg-slate-50 transition-colors shadow-2xs flex items-center gap-1.5 self-start"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Tabs */}
        <div className="flex items-center gap-1 w-full md:w-auto overflow-x-auto text-xs">
          {[
            { id: 'all', label: 'All Drafts' },
            { id: 'ready', label: 'Awaiting Operator Review' },
            { id: 'approved', label: 'Approved (Pending Send)' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
                filter === tab.id
                  ? 'bg-blue-600 text-white font-semibold shadow-xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Search quotation #, customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
          />
        </div>
      </div>

      {/* Queue Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
        {filteredQueue.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            {loading ? 'Loading queue items...' : 'No quotation drafts currently in queue.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Quote #</th>
                  <th className="px-4 py-3">Customer Details</th>
                  <th className="px-4 py-3">Received Time</th>
                  <th className="px-4 py-3 text-center">Items</th>
                  <th className="px-4 py-3 text-center">Match Quality</th>
                  <th className="px-4 py-3 text-right">Grand Total</th>
                  <th className="px-4 py-3 text-center">Paper</th>
                  <th className="px-4 py-3 text-center">Approval State</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredQueue.map((q) => {
                  const hasReviewItems = q.review_items_count > 0;
                  return (
                    <tr key={q.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-blue-600">
                        {q.quotation_number}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{q.customer_name || 'Customer'}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{q.customer_phone}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-[11px]">
                        {formatDateTime(q.created_at)}
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-slate-700">
                        {q.item_count}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {hasReviewItems ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            <AlertTriangle className="w-3 h-3 text-amber-500" />
                            <span>{q.review_items_count} Review</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>All Matched</span>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900">
                        {formatINR(q.grand_total)}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-slate-600">
                        {q.paper_size || 'A5'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {q.approval_status === 'approved' ? (
                          <Badge variant="success">Approved</Badge>
                        ) : (
                          <Badge variant="warning">Awaiting Review</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => onOpenQuotation(q.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-2xs transition-colors"
                        >
                          <span>Review Draft</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
