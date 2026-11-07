import React, { useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import TopHeader from './components/TopHeader';
import Dashboard from './pages/Dashboard';
import CreateQuotation from './pages/CreateQuotation';
import Quotations from './pages/Quotations';
import PriceListAndCatalogue from './pages/PriceListAndCatalogue';
import Customers from './pages/Customers';
import Settings from './pages/Settings';
import SmartParserModal from './components/SmartParserModal';

export default function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const [customerForQuote, setCustomerForQuote] = useState(null);
  const [quoteImportData, setQuoteImportData] = useState(null);
  const [editingQuotation, setEditingQuotation] = useState(null);
  const [showGlobalParser, setShowGlobalParser] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  function handleStartQuoteForCustomer(cust) {
    setEditingQuotation(null);
    setCustomerForQuote(cust);
    setActivePage('create-quotation');
  }

  function handleStartQuoteWithImport(importData) {
    setEditingQuotation(null);
    setQuoteImportData(importData);
    setActivePage('create-quotation');
  }

  function handleEditQuotation(quote) {
    setEditingQuotation(quote);
    setActivePage('create-quotation');
  }

  return (
    <AuthProvider>
      <div className="min-h-screen flex bg-[#F5F8F5] text-slate-900 selection:bg-[#7DBA00] selection:text-[#003B40]">
        
        {/* Left Vertical Modern Sidebar (Desktop Persistent + Mobile Drawer) */}
        <Sidebar 
          activePage={activePage} 
          setActivePage={setActivePage} 
          onOpenWhatsAppParser={() => setShowGlobalParser(true)}
          mobileOpen={mobileSidebarOpen}
          setMobileOpen={setMobileSidebarOpen}
        />

        {/* Right Main Content Column */}
        <div className="flex-1 flex flex-col min-w-0 min-h-screen">
          
          {/* Top Header with Breadcrumbs, Brand division, and WhatsApp Action */}
          <TopHeader 
            activePage={activePage}
            onToggleMobileSidebar={() => setMobileSidebarOpen(prev => !prev)}
            onOpenWhatsAppParser={() => setShowGlobalParser(true)}
          />

          {/* Main Workspace Container */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
            {activePage === 'dashboard' && (
              <Dashboard 
                setActivePage={setActivePage} 
                onStartQuoteWithImport={handleStartQuoteWithImport}
              />
            )}

            {activePage === 'create-quotation' && (
              <CreateQuotation 
                setActivePage={setActivePage} 
                initialCustomer={customerForQuote}
                importData={quoteImportData}
                onClearImportData={() => setQuoteImportData(null)}
                editingQuote={editingQuotation}
                onCancelEdit={() => setEditingQuotation(null)}
              />
            )}

            {activePage === 'quotations' && (
              <Quotations 
                setActivePage={setActivePage} 
                onEditQuotation={handleEditQuotation}
              />
            )}

            {activePage === 'price-list' && (
              <PriceListAndCatalogue 
                onAddToQuote={() => setActivePage('create-quotation')}
              />
            )}

            {activePage === 'customers' && (
              <Customers 
                setActivePage={setActivePage}
                onStartQuoteForCustomer={handleStartQuoteForCustomer}
              />
            )}

            {activePage === 'settings' && (
              <Settings />
            )}
          </main>

          {/* Footer (Hidden during print) */}
          <footer className="no-print bg-white border-t border-slate-200 py-5 mt-auto text-xs text-slate-500">
            <div className="px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-[#00545C]">UDHAYAM AGENCIES</span>
                <span className="text-slate-300">•</span>
                <span className="font-semibold text-slate-600">Paint Division Quotation Management (UD-QM)</span>
              </div>
              <div>
                <span>Perundurai, Erode - 638052 | Phone: +91 97156 22499 | GSTIN: 33AADFU6496M1ZJ</span>
              </div>
            </div>
          </footer>

        </div>

        {/* Global WhatsApp Smart Parser Modal */}
        {showGlobalParser && (
          <SmartParserModal
            onClose={() => setShowGlobalParser(false)}
            onTransferToQuotation={(data) => {
              setShowGlobalParser(false);
              handleStartQuoteWithImport(data);
            }}
          />
        )}

      </div>
    </AuthProvider>
  );
}
