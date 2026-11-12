import React from 'react';
import { Menu, MessageSquare, Sparkles, Building2, Phone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function TopHeader({ activePage, onToggleMobileSidebar, onOpenWhatsAppParser }) {
  const { settings, user } = useAuth();

  const pageTitles = {
    'dashboard': 'Dashboard Overview',
    'create-quotation': 'Quotation Creator Wizard',
    'quotations': 'Quotations Register',
    'price-list': 'Price List & Official Catalogue',
    'customers': 'Customer Directory',
    'settings': 'Settings & Business Profile'
  };

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-slate-200/80 px-4 sm:px-6 lg:px-8 py-3.5 no-print shadow-xs flex items-center justify-between">
      
      {/* Left: Mobile hamburger & Page Breadcrumb */}
      <div className="flex items-center space-x-3">
        <button
          onClick={onToggleMobileSidebar}
          className="md:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none"
          title="Open Navigation Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-bold text-[#00545C] uppercase tracking-wider hidden sm:inline">
              UD-QM
            </span>
            <span className="text-slate-300 hidden sm:inline">•</span>
            <h1 className="text-sm sm:text-base font-extrabold text-slate-900 leading-none">
              {pageTitles[activePage] || 'Paint Division'}
            </h1>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5 hidden sm:block">
            {settings?.company_division || 'Paint Division Quotation Management'} • Perundurai, Erode
          </p>
        </div>
      </div>

      {/* Right: Quick WhatsApp Parser & Company Quick Badge */}
      <div className="flex items-center space-x-2.5">
        <button
          onClick={onOpenWhatsAppParser}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold bg-[#25D366] hover:bg-[#20ba59] text-white shadow-xs transition-all transform active:scale-95 cursor-pointer"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">⚡ WhatsApp Parser</span>
          <span className="sm:hidden">Parser</span>
        </button>

        <div className="hidden lg:flex items-center space-x-2 text-xs text-slate-600 border-l border-slate-200 pl-3">
          <div className="w-2 h-2 rounded-full bg-[#7DBA00] animate-pulse"></div>
          <span className="font-semibold text-slate-700">Official Rate Sheet Grounded</span>
        </div>
      </div>

    </header>
  );
}
