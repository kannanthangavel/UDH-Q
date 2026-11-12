import React, { useState } from 'react';
import { 
  FileText, PlusCircle, Users, Settings as SettingsIcon, 
  Layers, LayoutDashboard, Menu, X, Sparkles, MessageSquare
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Navbar({ activePage, setActivePage, onOpenWhatsAppParser }) {
  const { user, settings } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const logoUrl = settings?.company_logo 
    ? `/uploads/logos/${settings.company_logo}` 
    : '/uploads/logos/udhayam_logo.png';

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'create-quotation', label: 'Create Quotation', icon: PlusCircle, isPrimary: true },
    { id: 'quotations', label: 'Quotations', icon: FileText },
    { id: 'price-list', label: 'Price List & Catalogue', icon: Layers },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  function handleNav(id) {
    setActivePage(id);
    setMobileMenuOpen(false);
  }

  return (
    <header className="sticky top-0 z-40 bg-[#00545C] text-white shadow-md border-b border-[#003B40] no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          
          {/* Left: Brand Identity & Logo */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => handleNav('dashboard')}>
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-white p-1 flex items-center justify-center shadow-sm overflow-hidden flex-shrink-0 border border-slate-200">
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
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg sm:text-xl tracking-tight text-white">
                  UDHAYAM AGENCIES
                </span>
                <span className="hidden sm:inline-flex px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-[#7DBA00] text-[#003B40] tracking-wider">
                  UD-QM
                </span>
              </div>
              <p className="text-xs text-emerald-200 font-medium tracking-wide">
                Paint Division Quotation Management
              </p>
            </div>
          </div>

          {/* Center: Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              
              if (item.isPrimary) {
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNav(item.id)}
                    className="flex items-center space-x-1.5 px-3.5 py-2 mx-1 rounded-lg text-sm font-bold bg-[#7DBA00] hover:bg-[#8fd400] text-[#003B40] shadow-sm transition-all transform active:scale-95"
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              }

              return (
                <button
                  key={item.id}
                  onClick={() => handleNav(item.id)}
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                    isActive 
                      ? 'bg-[#003B40] text-white border-b-2 border-[#7DBA00]' 
                      : 'text-slate-200 hover:bg-[#0A6D77] hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 text-emerald-300" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right: WhatsApp Smart Parser Quick Action & Single User Account (Kids) */}
          <div className="hidden sm:flex items-center space-x-3">
            {/* WhatsApp Parser Button */}
            <button
              onClick={onOpenWhatsAppParser}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold bg-[#25D366] hover:bg-[#20ba59] text-white shadow-sm transition-all transform active:scale-95 cursor-pointer"
              title="Parse messy WhatsApp customer text into quote items instantly"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>⚡ WhatsApp Parser</span>
            </button>

            {/* Single User Account Display (Kids) */}
            <div className="flex items-center space-x-2 pl-2 border-l border-[#0A6D77]">
              <div className="w-8 h-8 rounded-full bg-[#7DBA00] text-[#003B40] font-black text-xs flex items-center justify-center shadow">
                {user?.name ? user.name[0].toUpperCase() : 'K'}
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-white leading-tight">{user?.name || 'Kids'}</p>
                <span className="text-[10px] text-emerald-200 font-semibold uppercase tracking-wider">
                  Admin • UD-QM
                </span>
              </div>
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="flex lg:hidden items-center space-x-2">
            <button
              onClick={onOpenWhatsAppParser}
              className="p-1.5 rounded-lg bg-[#25D366] text-white text-xs font-bold flex items-center space-x-1"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Parser</span>
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-emerald-200 hover:text-white hover:bg-[#003B40] focus:outline-none"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile menu drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-[#003B40] border-t border-[#002629] px-4 pt-2 pb-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                  item.isPrimary
                    ? 'bg-[#7DBA00] text-[#003B40] font-bold'
                    : isActive
                    ? 'bg-[#00545C] text-white font-bold'
                    : 'text-slate-200 hover:bg-[#00545C]'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
}
