import React, { useState, useEffect } from 'react';
import {
  Activity,
  Search,
  Filter,
  RefreshCw,
  Clock,
  ShieldCheck,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { api } from '../../api/client';
import { formatDateTime } from '../../utils/currency';
import { Badge } from '../../components/Badge';

export function AuditActivity() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEventType, setSelectedEventType] = useState('all');
  const [eventTypes, setEventTypes] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedLogId, setExpandedLogId] = useState(null);

  useEffect(() => {
    fetchLogs();
  }, [searchTerm, selectedEventType, page]);

  async function fetchLogs() {
    try {
      setLoading(true);
      const res = await api.getAuditLogs({
        search: searchTerm,
        eventType: selectedEventType,
        page,
        limit: 25
      });
      setLogs(res.logs || []);
      setEventTypes(res.eventTypes || []);
      setTotalPages(res.totalPages || 1);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  }

  function getEventBadgeVariant(type) {
    if (type.includes('FINALIZED')) return 'success';
    if (type.includes('OVERRIDE')) return 'danger';
    if (type.includes('IMPORTED') || type.includes('ACTIVATED')) return 'primary';
    if (type.includes('SHARE')) return 'success';
    if (type.includes('UPDATE')) return 'warning';
    return 'default';
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Audit Activity</h1>
          <p className="text-sm text-slate-500 mt-1">
            Permanent, tamper-evident log of price imports, manual price overrides, quotation finalizations, and sharing events.
          </p>
        </div>
        <button
          onClick={fetchLogs}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-md shadow-xs transition-colors self-start"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Bar */}
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
            placeholder="Search audit details or operator name..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto text-xs">
          <span className="text-slate-500">Event Type:</span>
          <select
            value={selectedEventType}
            onChange={(e) => {
              setSelectedEventType(e.target.value);
              setPage(1);
            }}
            className="bg-white border border-slate-200 rounded p-1.5 text-xs"
          >
            <option value="all">All Events</option>
            {eventTypes.map((et) => (
              <option key={et} value={et}>{et}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            {loading ? 'Loading audit records...' : 'No audit entries found.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 w-12">ID</th>
                  <th className="px-4 py-3 w-40">Timestamp</th>
                  <th className="px-4 py-3">Event Type</th>
                  <th className="px-4 py-3">Operator</th>
                  <th className="px-4 py-3">Action Description</th>
                  <th className="px-4 py-3 text-center">Outcome</th>
                  <th className="px-4 py-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {logs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  return (
                    <React.Fragment key={log.id}>
                      <tr className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-mono text-slate-400">
                          {log.id}
                        </td>
                        <td className="px-4 py-3 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                          {formatDateTime(log.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={getEventBadgeVariant(log.event_type)}>
                            {log.event_type}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {log.operator || 'Operator'}
                        </td>
                        <td className="px-4 py-3 text-slate-700 max-w-md">
                          {log.details}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-semibold ${log.outcome === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {log.outcome}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {log.metadata_json && (
                            <button
                              onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                              className="text-blue-600 hover:text-blue-800 text-[11px] font-medium"
                            >
                              {isExpanded ? 'Hide' : 'Metadata'}
                            </button>
                          )}
                        </td>
                      </tr>
                      {isExpanded && log.metadata_json && (
                        <tr className="bg-slate-50">
                          <td colSpan={7} className="px-6 py-3">
                            <div className="text-[11px] font-mono bg-white p-3 border border-slate-200 rounded text-slate-800 overflow-x-auto">
                              <pre>{JSON.stringify(JSON.parse(log.metadata_json), null, 2)}</pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-slate-200 flex items-center justify-between bg-slate-50/50 text-xs">
            <span className="text-slate-500">
              Page {page} of {totalPages}
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
    </div>
  );
}
