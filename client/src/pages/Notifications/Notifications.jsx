import React from 'react';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Clock,
  Check,
  MessageSquare,
  ArrowRight,
  ExternalLink
} from 'lucide-react';
import { formatDateTime } from '../../utils/currency';
import { Badge } from '../../components/Badge';

export function Notifications({
  notifications = [],
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onOpenQuotation,
  onNavigateToInbox
}) {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Bell className="w-6 h-6 text-blue-600" />
            Operator Notification Center
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time automated alerts for incoming WhatsApp requirements, drafted quotes, and price warnings.
          </p>
        </div>

        {notifications.length > 0 && (
          <button
            type="button"
            onClick={onMarkAllNotificationsRead}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-md shadow-2xs transition-colors"
          >
            <Check className="w-3.5 h-3.5 text-slate-500" />
            Mark All as Read
          </button>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden">
        {notifications.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
              <Bell className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">No Notifications</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              You are completely up to date. New WhatsApp inquiries and automatic drafts will appear here in real-time.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {notifications.map((n) => {
              const isUnread = !n.is_read;
              return (
                <div
                  key={n.id}
                  className={`p-4 transition-colors flex items-start justify-between gap-4 ${
                    isUnread ? 'bg-blue-50/40 hover:bg-blue-50/70' : 'hover:bg-slate-50/80'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="mt-0.5 shrink-0">
                      {n.type === 'draft_ready' ? (
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                      ) : n.type === 'needs_clarification' ? (
                        <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                          <MessageSquare className="w-4 h-4" />
                        </div>
                      )}
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs ${isUnread ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
                          {n.title}
                        </span>
                        {isUnread && (
                          <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                        )}
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed">
                        {n.message}
                      </p>

                      <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-1">
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3" />
                          {formatDateTime(n.created_at)}
                        </span>
                        {n.quotation_id && (
                          <button
                            type="button"
                            onClick={() => {
                              if (isUnread) onMarkNotificationRead(n.id);
                              onOpenQuotation(n.quotation_id);
                            }}
                            className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                          >
                            <span>Open Quotation</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 pt-0.5">
                    {isUnread && (
                      <button
                        type="button"
                        onClick={() => onMarkNotificationRead(n.id)}
                        className="p-1 hover:bg-slate-200/80 rounded text-slate-400 hover:text-slate-700 transition-colors"
                        title="Mark as read"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
