import React, { useState, useRef, useEffect } from 'react';
import {
  Bell,
  Search,
  PlusCircle,
  Database,
  CheckCircle2,
  AlertTriangle,
  FileText,
  MessageSquare,
  Clock,
  Check,
  Radio,
  ExternalLink
} from 'lucide-react';
import { Badge } from './Badge';

export function Navbar({
  activeTab,
  setActiveTab,
  activePriceList,
  onNewQuotationClick,
  onOpenQuotation,
  notifications = [],
  unreadCount = 0,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  whatsAppStatus
}) {
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setNotifDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const titles = {
    dashboard: 'Operational Overview',
    inbox: 'WhatsApp Business Inbox',
    queue: 'Quotation Review Queue',
    pricelist: 'Price List Management',
    'new-quote': 'Quotation Workspace',
    history: 'Quotation History & Snapshots',
    notifications: 'Notification Center',
    audit: 'Audit & System Activity',
    settings: 'Settings & Integrations'
  };

  const isConnected = whatsAppStatus?.connectionState === 'connected';

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 h-14 flex items-center justify-between px-4 sm:px-6 shadow-2xs">
      {/* Left: Workspace Title & Breadcrumb */}
      <div className="flex items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-xs font-medium">Udhayam</span>
            <span className="text-slate-300">/</span>
            <h1 className="text-sm font-bold text-slate-900 tracking-tight">
              {titles[activeTab] || 'Workspace'}
            </h1>
          </div>
        </div>
      </div>

      {/* Right: Operational Controls & Badges */}
      <div className="flex items-center gap-3">
        {/* WhatsApp Connection Status Badge */}
        <div
          onClick={() => setActiveTab('settings')}
          className="cursor-pointer hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors bg-slate-50 hover:bg-slate-100 border-slate-200"
          title={isConnected ? 'Connected to official Meta WhatsApp Cloud API' : 'Operating in local trial / demo mode with simulator'}
        >
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
          <span className="text-slate-700 text-[11px] font-semibold">
            {isConnected ? 'WhatsApp API Live' : 'WhatsApp Demo Mode'}
          </span>
        </div>

        {/* Active Price List Badge */}
        {activePriceList && (
          <div
            onClick={() => setActiveTab('pricelist')}
            className="cursor-pointer hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md text-xs text-slate-600 transition-colors"
            title={`Active price list: ${activePriceList.filename}`}
          >
            <Database className="w-3.5 h-3.5 text-blue-600" />
            <span className="max-w-[120px] truncate font-medium text-[11px]">{activePriceList.filename}</span>
            {activePriceList.is_demo ? (
              <Badge variant="warning">Demo</Badge>
            ) : (
              <Badge variant="success">v{activePriceList.version}</Badge>
            )}
          </div>
        )}

        {/* Real-Time Notification Bell Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setNotifDropdownOpen(!notifDropdownOpen)}
            className="relative p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
            title="Real-Time Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-rose-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-bounce">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Dropdown Menu */}
          {notifDropdownOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-lg shadow-xl py-2 z-50 text-xs">
              <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 text-xs">Real-Time Alerts</span>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.2 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full">
                      {unreadCount} unread
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={onMarkAllNotificationsRead}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-xs">
                    No notifications yet.
                  </div>
                ) : (
                  notifications.slice(0, 10).map((n) => {
                    return (
                      <div
                        key={n.id}
                        onClick={() => {
                          if (!n.is_read) onMarkNotificationRead(n.id);
                          if (n.reference_type === 'quotation' && n.reference_id && onOpenQuotation) {
                            onOpenQuotation(n.reference_id);
                            setNotifDropdownOpen(false);
                          }
                        }}
                        className={`p-3 cursor-pointer hover:bg-slate-50 transition-colors flex items-start gap-2.5 ${
                          !n.is_read ? 'bg-blue-50/40' : ''
                        }`}
                      >
                        <div className="mt-0.5">
                          {n.type === 'draft_prepared' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          ) : n.type === 'match_review' ? (
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                          ) : n.type === 'send_success' ? (
                            <MessageSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <FileText className="w-4 h-4 text-slate-400" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-800 truncate">{n.title}</span>
                            <span className="text-[10px] text-slate-400 shrink-0">
                              {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 line-clamp-2 mt-0.5">{n.message}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="p-2 border-t border-slate-100 text-center">
                <button
                  onClick={() => {
                    setActiveTab('notifications');
                    setNotifDropdownOpen(false);
                  }}
                  className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold"
                >
                  View All Notifications
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Primary Action Button (Header CTA) */}
        {activeTab !== 'new-quote' && (
          <button
            type="button"
            onClick={onNewQuotationClick}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold shadow-xs transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Quotation</span>
          </button>
        )}
      </div>
    </header>
  );
}
