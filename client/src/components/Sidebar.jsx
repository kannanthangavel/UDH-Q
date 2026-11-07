import React, { useState } from 'react';
import { 
  FileText, PlusCircle, Users, Settings as SettingsIcon, 
  Layers, LayoutDashboard, Menu, X, Sparkles, MessageSquare,
  ChevronRight, Shield, CheckCircle2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Sidebar({ activePage, setActivePage, onOpenWhatsAppParser, mobileOpen, setMobileOpen }) {
  const { user, settings } = useAuth();

  const logoUrl = settings?.company_logo 
    ? `/uploads/logos/${settings.company_logo}` 
    : '/uploads/logos/udhayam_logo.png';

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'create-quotation', label: 'Create Quotation', icon: PlusCircle, isPrimary: true },
    { id: 'quotations', label: 'Quotations', icon: FileText },
    { id: 'price-list', label: 'Price List & Catalogue', icon: Layers },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'settings', label: 'Settings & Profile', icon: SettingsIcon },
  ];

  function handleNav(id) {
    setActivePage(id);
    if (setMobileOpen) setMobileOpen(false);
  }

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#00545C] text-white border-r border-[#003B40] select-none">
      
      {/* Brand Header */}
      <div className="p-5 border-b border-[#003B40] flex items-center justify-between">
        <div 
          className="flex items-center space-x-3 cursor-pointer group"
          onClick={() => handleNav('dashboard')}
        >
          <div className="w-12 h-12 rounded-xl bg-white p-1.5 flex items-center justify-center shadow-md flex-shrink-0 border border-slate-200 group-hover:scale-105 transition-transform">
            <img 
              src={logoUrl} 
              alt="Udhayam Agencies Logo" 
              className="max-h-full max-w-full object-contain"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = '/uploads/logos/udhayam_logo.png';
              }}
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-1.5">
              <span className="font-black text-sm tracking-tight text-white truncate">
                UDHAYAM
              </span>
              <span className="px-1.5 py-0.5 text-[9px] font-black uppercase rounded bg-[#7DBA00] text-[#003B40]">
                QM
              </span>
            </div>
            <p className="text-[10px] text-emerald-200 font-bold uppercase tracking-wider mt-0.5">
              Paint Division
            </p>
          </div>
        </div>

        {/* Mobile close button */}
        {setMobileOpen && (
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-[#003B40]"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Action Buttons: Primary Create & WhatsApp Parser */}
      <div className="p-4 space-y-2 border-b border-[#003B40]/80">
        <button
          onClick={() => handleNav('create-quotation')}
          className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl text-xs font-black bg-[#7DBA00] hover:bg-[#8ee000] text-[#003B40] shadow-md transition-all transform active:scale-95 cursor-pointer"
        >
          <PlusCircle className="w-4 h-4 text-[#003B40]" />
          <span>+ Create Quotation</span>
        </button>

        <button
          onClick={onOpenWhatsAppParser}
          className="w-full flex items-center justify-center space-x-2 py-2 px-3 rounded-xl text-xs font-extrabold bg-[#25D366] hover:bg-[#20ba59] text-white shadow-sm transition-all transform active:scale-95 cursor-pointer"
          title="Paste raw WhatsApp customer text and match products automatically"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>⚡ WhatsApp Parser</span>
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
        <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-300/80">
          Main Menu
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNav(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#003B40] text-white shadow-inner border-l-4 border-[#7DBA00]'
                  : 'text-slate-200 hover:bg-[#0A6D77]/80 hover:text-white'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#7DBA00]' : 'text-emerald-300'}`} />
                <span>{item.label}</span>
              </div>
              {isActive && <ChevronRight className="w-3.5 h-3.5 text-[#7DBA00]" />}
            </button>
          );
        })}
      </nav>

      {/* User Account Profile Footer Card (Single user Kids) */}
      <div className="p-4 border-t border-[#003B40] bg-[#003B40]/40">
        <div 
          onClick={() => handleNav('settings')}
          className="flex items-center space-x-3 p-2 rounded-xl hover:bg-[#003B40] transition-colors cursor-pointer"
        >
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-[#7DBA00] text-[#003B40] font-black text-sm flex items-center justify-center shadow">
              {user?.name ? user.name[0].toUpperCase() : 'K'}
            </div>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#00545C] absolute -bottom-0.5 -right-0.5"></span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-white truncate leading-tight">
                {user?.name || 'Kids'}
              </p>
              <span className="text-[9px] font-bold text-emerald-300 uppercase bg-[#00545C] px-1.5 py-0.2 rounded">
                Admin
              </span>
            </div>
            <p className="text-[10px] text-emerald-200/70 truncate mt-0.5">
              {user?.email || 'paints@udhayam.com'}
            </p>
          </div>
        </div>
      </div>

    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex flex-col w-64 lg:w-72 flex-shrink-0 h-screen sticky top-0 no-print z-30">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex no-print">
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileOpen(false)}
          ></div>
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-[#00545C] shadow-2xl animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
