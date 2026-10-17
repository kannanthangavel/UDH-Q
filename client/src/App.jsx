import React, { useState, useEffect } from 'react';
import { api } from './api/client';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { DemoBanner } from './components/DemoBanner';
import { Modal } from './components/Modal';
import { Dashboard } from './pages/Dashboard/Dashboard';
import { WhatsAppInbox } from './pages/WhatsAppInbox/WhatsAppInbox';
import { QuotationQueue } from './pages/QuotationQueue/QuotationQueue';
import { PriceList } from './pages/PriceList/PriceList';
import { NewQuotation } from './pages/NewQuotation/NewQuotation';
import { QuotationHistory } from './pages/QuotationHistory/QuotationHistory';
import { Notifications } from './pages/Notifications/Notifications';
import { AuditActivity } from './pages/AuditActivity/AuditActivity';
import { Settings } from './pages/Settings/Settings';
import { Download, ExternalLink } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [activePriceList, setActivePriceList] = useState(null);
  const [quotationIdToLoad, setQuotationIdToLoad] = useState(null);

  // Real-time notifications & badges
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [queueCount, setQueueCount] = useState(0);
  const [whatsAppStatus, setWhatsAppStatus] = useState(null);

  // Global PDF preview modal state
  const [globalPdfId, setGlobalPdfId] = useState(null);
  const [globalPdfModalOpen, setGlobalPdfModalOpen] = useState(false);

  useEffect(() => {
    fetchInitialData();
    setupSSEStream();
  }, []);

  async function fetchInitialData() {
    await Promise.allSettled([
      fetchActivePriceList(),
      fetchNotifications(),
      fetchQueueMetrics(),
      fetchWhatsAppStatus()
    ]);
  }

  async function fetchActivePriceList() {
    try {
      const res = await api.getActivePriceList();
      setActivePriceList(res.activePriceList || null);
    } catch (err) {
      console.warn('Failed to load active price list:', err);
    }
  }

  async function fetchNotifications() {
    try {
      const res = await api.getNotifications();
      setNotifications(res.notifications || []);
      setUnreadCount(res.unreadCount || 0);
    } catch (err) {
      console.warn('Failed to fetch notifications:', err);
    }
  }

  async function fetchQueueMetrics() {
    try {
      const res = await api.getQuotationQueue();
      setQueueCount(res.totalPending || (res.queue ? res.queue.length : 0));
    } catch (err) {
      console.warn('Failed to fetch queue metrics:', err);
    }
  }

  async function fetchWhatsAppStatus() {
    try {
      const res = await api.getWhatsAppStatus();
      setWhatsAppStatus(res);
    } catch (err) {
      console.warn('Failed to fetch WhatsApp status:', err);
    }
  }

  // Setup Server-Sent Events (SSE) stream for real-time operator alerts
  function setupSSEStream() {
    try {
      const streamUrl = api.getNotificationStreamUrl();
      const eventSource = new EventSource(streamUrl);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.type === 'notification' && data.notification) {
            setNotifications(prev => [data.notification, ...prev]);
            setUnreadCount(prev => prev + 1);
            fetchQueueMetrics();
          } else if (data && data.unreadCount !== undefined) {
            setUnreadCount(data.unreadCount);
          }
        } catch (e) {
          // heartbeat or non-json message
        }
      };

      eventSource.onerror = () => {
        // Fallback polling handles it gracefully
      };

      return () => {
        eventSource.close();
      };
    } catch (err) {
      console.warn('SSE stream init failed, using polling:', err);
    }
  }

  async function handleMarkNotificationRead(id) {
    try {
      await api.markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  }

  async function handleMarkAllNotificationsRead() {
    try {
      await api.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all notifications read:', err);
    }
  }

  function handleCreateNewQuotation() {
    setQuotationIdToLoad(null);
    setActiveTab('new-quote');
  }

  function handleOpenQuotation(id) {
    setQuotationIdToLoad(id);
    setActiveTab('new-quote');
  }

  function handleViewPdf(id) {
    setGlobalPdfId(id);
    setGlobalPdfModalOpen(true);
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex font-sans text-slate-900 antialiased">
      {/* Compact Zoho-Inspired Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          if (tab === 'new-quote') {
            setQuotationIdToLoad(null);
          }
          setActiveTab(tab);
        }}
        onNewQuotationClick={handleCreateNewQuotation}
        activePriceList={activePriceList}
        unreadCount={unreadCount}
        queueCount={queueCount}
        whatsAppStatus={whatsAppStatus}
      />

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Demo Data Warning Banner */}
        <DemoBanner
          isDemo={Boolean(activePriceList?.is_demo)}
          onNavigateToPriceList={() => setActiveTab('pricelist')}
        />

        {/* Top Operational Bar */}
        <Navbar
          activeTab={activeTab}
          setActiveTab={(tab) => {
            if (tab === 'new-quote') {
              setQuotationIdToLoad(null);
            }
            setActiveTab(tab);
          }}
          activePriceList={activePriceList}
          onNewQuotationClick={handleCreateNewQuotation}
          onOpenQuotation={handleOpenQuotation}
          notifications={notifications}
          unreadCount={unreadCount}
          onMarkNotificationRead={handleMarkNotificationRead}
          onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
          whatsAppStatus={whatsAppStatus}
        />

        {/* Dynamic Workspace Body */}
        <main className="flex-1">
          {activeTab === 'dashboard' && (
            <Dashboard
              onNavigateToNewQuote={handleCreateNewQuotation}
              onNavigateToPriceList={() => setActiveTab('pricelist')}
              onOpenQuotation={handleOpenQuotation}
              onViewPdf={handleViewPdf}
              onNavigateToQueue={() => setActiveTab('queue')}
              onNavigateToInbox={() => setActiveTab('inbox')}
            />
          )}

          {activeTab === 'inbox' && (
            <WhatsAppInbox
              onOpenQuotation={handleOpenQuotation}
              onNavigateToNewQuote={handleCreateNewQuotation}
            />
          )}

          {activeTab === 'queue' && (
            <QuotationQueue
              onOpenQuotation={handleOpenQuotation}
            />
          )}

          {activeTab === 'pricelist' && (
            <PriceList
              activePriceList={activePriceList}
              onPriceListChanged={fetchActivePriceList}
            />
          )}

          {activeTab === 'new-quote' && (
            <NewQuotation
              key={quotationIdToLoad || 'new-quote-fresh'}
              quotationIdToLoad={quotationIdToLoad}
              activePriceList={activePriceList}
              onQuotationSaved={() => {
                fetchActivePriceList();
                fetchQueueMetrics();
              }}
              onNavigateToHistory={() => setActiveTab('history')}
            />
          )}

          {activeTab === 'history' && (
            <QuotationHistory
              onOpenQuotation={handleOpenQuotation}
              onViewPdf={handleViewPdf}
            />
          )}

          {activeTab === 'notifications' && (
            <Notifications
              notifications={notifications}
              onMarkNotificationRead={handleMarkNotificationRead}
              onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
              onOpenQuotation={handleOpenQuotation}
              onNavigateToInbox={() => setActiveTab('inbox')}
            />
          )}

          {activeTab === 'audit' && <AuditActivity />}

          {activeTab === 'settings' && (
            <Settings onPriceListChanged={fetchActivePriceList} />
          )}
        </main>

        {/* Compact Workspace Footer */}
        <footer className="bg-white border-t border-slate-200 py-3 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>
              <strong>Udhayam Quotation Automation Platform</strong> — Enterprise Edition v2.0
            </span>
            <span>
              Seller: Udhayam Agencies | Default Paper: A5 | Meta WhatsApp Cloud API Ready
            </span>
          </div>
        </footer>
      </div>

      {/* Global PDF Viewer Modal */}
      <Modal
        isOpen={globalPdfModalOpen}
        onClose={() => setGlobalPdfModalOpen(false)}
        title="Quotation PDF Document"
        maxWidth="max-w-4xl"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-end gap-2">
            {globalPdfId && (
              <>
                <a
                  href={api.getPdfUrl(globalPdfId, false) + '&refresh=true'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-md flex items-center gap-1.5 hover:bg-slate-50 transition-colors shadow-2xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open in New Tab
                </a>
                <a
                  href={api.getPdfUrl(globalPdfId, true)}
                  download={`Quotation_${globalPdfId}.pdf`}
                  className="px-3.5 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-md flex items-center gap-1.5 hover:bg-blue-700 transition-colors shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download PDF
                </a>
              </>
            )}
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-100 min-h-[520px]">
            {globalPdfId && (
              <iframe
                src={api.getPdfUrl(globalPdfId, false) + '&refresh=true'}
                title="Quotation PDF Viewer"
                className="w-full h-[560px] border-none"
              />
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
