import React from 'react';
import {
  LayoutDashboard,
  MessageSquare,
  Layers,
  FileSpreadsheet,
  History,
  Bell,
  ShieldCheck,
  Settings,
  PlusCircle,
  CheckCircle2,
  AlertTriangle,
  Radio
} from 'lucide-react';

export function Sidebar({
  activeTab,
  setActiveTab,
  onNewQuotationClick,
  activePriceList,
  unreadCount = 0,
  queueCount = 0,
  whatsAppStatus
}) {
  const isDemo = Boolean(activePriceList?.is_demo);
  const isConnected = whatsAppStatus?.connectionState === 'connected';

  const navItems = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'inbox', label: 'WhatsApp Inbox', icon: MessageSquare, badge: unreadCount > 0 ? unreadCount : null, badgeColor: 'bg-emerald-500' },
    { id: 'queue', label: 'Quotation Queue', icon: Layers, badge: queueCount > 0 ? queueCount : null, badgeColor: 'bg-blue-600' },
    { id: 'pricelist', label: 'Price List', icon: FileSpreadsheet, subtext: isDemo ? 'Demo Mode' : 'Active' },
    { id: 'history', label: 'Quotation History', icon: History },
    { id: 'notifications', label: 'Notifications', icon: Bell, badge: unreadCount > 0 ? unreadCount : null, badgeColor: 'bg-amber-500' },
    { id: 'audit', label: 'Audit Activity', icon: ShieldCheck },
    { id: 'settings', label: 'Integration Settings', icon: Settings }
  ];

  return (
    <aside className="w-64 bg-[#0F172A] text-slate-300 flex flex-col shrink-0 select-none border-r border-slate-800">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-md shadow-blue-500/20">
            U
          </div>
          <div>
            <div className="text-sm font-bold text-white tracking-wide flex items-center gap-1.5">
              <span>UDHAYAM</span>
              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                PRO
              </span>
            </div>
            <div className="text-[11px] text-slate-400">Intelligent Quotation Suite</div>
          </div>
        </div>
      </div>

      {/* Primary Action Button (Zoho Style) */}
      <div className="px-4 py-3">
        <button
          type="button"
          onClick={onNewQuotationClick}
          className="w-full py-2.5 px-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white rounded-lg text-xs font-bold shadow-md shadow-blue-600/30 flex items-center justify-center gap-2 transition-all transform active:scale-[0.98]"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Create Quotation</span>
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        <div className="text-[10px] uppercase font-bold text-slate-500 px-3 pt-2 pb-1 tracking-wider">
          Workspaces
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {item.subtext && !item.badge && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                    item.subtext === 'Demo Mode' ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-700 text-slate-300'
                  }`}>
                    {item.subtext}
                  </span>
                )}
                {item.badge && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold text-white ${item.badgeColor || 'bg-blue-600'}`}>
                    {item.badge}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </nav>

      {/* Persistent Connection Status Footer */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-900/50">
        <div className="flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
            }`} />
            <span className="text-slate-300 font-medium">
              {isConnected ? 'WhatsApp Live' : 'WhatsApp Demo Mode'}
            </span>
          </div>
          <button
            onClick={() => setActiveTab('settings')}
            className="text-[10px] text-blue-400 hover:text-blue-300 underline font-semibold"
          >
            Config
          </button>
        </div>
      </div>
    </aside>
  );
}
