import React from 'react';
import udhayamLogo from '../assets/udhayam_logo.png';
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
    { id: 'queue', label: 'Quotation Queue', icon: Layers, badge: queueCount > 0 ? queueCount : null, badgeColor: 'bg-[#044E54]' },
    { id: 'pricelist', label: 'Price List', icon: FileSpreadsheet, subtext: isDemo ? 'Demo Mode' : 'Active' },
    { id: 'history', label: 'Quotation History', icon: History },
    { id: 'notifications', label: 'Notifications', icon: Bell, badge: unreadCount > 0 ? unreadCount : null, badgeColor: 'bg-amber-500' },
    { id: 'audit', label: 'Audit Activity', icon: ShieldCheck },
    { id: 'settings', label: 'Integration Settings', icon: Settings }
  ];

  return (
    <aside className="w-64 bg-[#0B1517] text-slate-300 flex flex-col shrink-0 select-none border-r border-[#152E32]">
      {/* Brand Header */}
      <div className="p-4 border-b border-[#152E32] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white/95 p-1 flex items-center justify-center shadow-md shadow-teal-950/40 border border-teal-800/30">
            <img src={udhayamLogo} alt="Udhayam Agencies Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="text-sm font-bold text-white tracking-wide flex items-center gap-1.5">
              <span>UDHAYAM</span>
              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-[#72B01D]/20 text-[#72B01D] border border-[#72B01D]/30">
                PRO
              </span>
            </div>
            <div className="text-[11px] text-slate-400">Intelligent Quotation Suite</div>
          </div>
        </div>
      </div>

      {/* Primary Action Button (Zoho / Google Workspace Style) */}
      <div className="px-4 py-3">
        <button
          type="button"
          onClick={onNewQuotationClick}
          className="w-full py-2.5 px-3 bg-gradient-to-r from-[#044E54] to-[#06636A] hover:from-[#033B40] hover:to-[#044E54] text-white rounded-lg text-xs font-bold shadow-md shadow-teal-950/40 flex items-center justify-center gap-2 transition-all transform active:scale-[0.98] border border-teal-600/30"
        >
          <PlusCircle className="w-4 h-4 text-[#72B01D]" />
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
                  ? 'bg-[#044E54] text-white font-semibold shadow-sm border border-teal-500/30'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-[#12272A]/70'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#72B01D]' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {item.subtext && !item.badge && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                    item.subtext === 'Demo Mode' ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-300'
                  }`}>
                    {item.subtext}
                  </span>
                )}
                {item.badge && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold text-white ${item.badgeColor || 'bg-[#044E54]'}`}>
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
