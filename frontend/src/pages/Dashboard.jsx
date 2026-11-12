import React, { useState, useEffect } from 'react';
import { 
  PlusCircle, FileText, CheckCircle2, Clock, 
  Layers, Users, ArrowUpRight, MessageCircle, Printer, Eye,
  RefreshCw, TrendingUp, Sparkles, MessageSquare, ArrowRight
} from 'lucide-react';
import { api } from '../api/client';
import QuotationPdfModal from '../components/QuotationPdfModal';
import WhatsAppShareModal from '../components/WhatsAppShareModal';
import SmartParserModal from '../components/SmartParserModal';

export default function Dashboard({ setActivePage, onStartQuoteWithImport }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedQuoteForPdf, setSelectedQuoteForPdf] = useState(null);
  const [selectedQuoteForWa, setSelectedQuoteForWa] = useState(null);
  const [showParserModal, setShowParserModal] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      setLoading(true);
      const res = await api.getDashboard();
      setData(res);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  }

  function formatCurrency(val) {
    return '₹' + Number(val || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  const metrics = data?.metrics || {
    totalQuotations: 0,
    totalQuotationValue: 0,
    pendingQuotations: 0,
    acceptedQuotations: 0,
    totalProducts: 5331,
    paintProducts: 3724,
    accessProducts: 1607,
    customerCount: 3
  };

  const recentQuotations = data?.recentQuotations || [];

  return (
    <div className="space-y-6">
      
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#00545C] to-[#0A6D77] rounded-2xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/15 text-xs font-semibold text-emerald-200 mb-3">
              <span className="w-2 h-2 rounded-full bg-[#7DBA00] animate-pulse"></span>
              <span>UDHAYAM AGENCIES • Paint Division (Kids)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              UD-QM Quotation Management
            </h1>
            <p className="text-slate-200 text-sm mt-1 max-w-xl">
              Create fast, accurate quotations from official Excel rate sheets with instant WhatsApp smart parsing, GST calculations, and A4/A5 single-page PDF exports.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setActivePage('create-quotation')}
              className="flex items-center space-x-2 px-5 py-3 rounded-xl bg-[#7DBA00] hover:bg-[#8ee000] text-[#003B40] font-black text-sm shadow-md transition-all transform active:scale-95 cursor-pointer"
            >
              <PlusCircle className="w-5 h-5 text-[#003B40]" />
              <span>+ Create Quotation</span>
            </button>
            <button
              onClick={() => setShowParserModal(true)}
              className="flex items-center space-x-2 px-4 py-3 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white font-black text-sm shadow transition-all transform active:scale-95 cursor-pointer"
            >
              <MessageSquare className="w-5 h-5 text-white" />
              <span>⚡ WhatsApp Parser</span>
            </button>
          </div>
        </div>

        {/* Decorative background circle */}
        <div className="absolute -right-12 -bottom-16 w-64 h-64 rounded-full bg-white/5 pointer-events-none"></div>
      </div>

      {/* WhatsApp Smart Parser Showcase Card (User Request: "automation is missing and whatsapp intergration is failed...") */}
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200/80 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#25D366] text-white flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                WhatsApp Order AI Parser & Auto-Matcher
              </h3>
              <span className="bg-[#25D366] text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                Active
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5 max-w-xl">
              Paste informal customer messages with typos or shorthand (e.g. <span className="font-mono font-bold text-slate-800">"golden brown 1ltr 5ps, putty powder 40kg, brush 2" 1ps"</span>) — UD-QM automatically matches authentic Excel products and builds quotations in 1 click!
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowParserModal(true)}
          className="flex items-center space-x-1.5 px-5 py-2.5 rounded-xl bg-[#00545C] hover:bg-[#0A6D77] text-white font-black text-xs shadow-md transition-all transform active:scale-95 whitespace-nowrap cursor-pointer self-start md:self-auto"
        >
          <span>Launch WhatsApp Parser</span>
          <ArrowRight className="w-4 h-4 text-[#7DBA00]" />
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        
        {/* Total Quotations */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Quotations</p>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1 font-mono">
                {metrics.totalQuotations}
              </h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#00545C]/10 text-[#00545C] flex items-center justify-center">
              <FileText className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Cumulative Value:</span>
            <span className="font-bold text-slate-900 font-mono">{formatCurrency(metrics.totalQuotationValue)}</span>
          </div>
        </div>

        {/* Pending Quotations */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">Pending Quotations</p>
              <h3 className="text-2xl sm:text-3xl font-black text-amber-600 mt-1 font-mono">
                {metrics.pendingQuotations}
              </h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Status:</span>
            <span className="font-bold text-amber-700">Created / Shared</span>
          </div>
        </div>

        {/* Accepted Quotations */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Accepted Quotations</p>
              <h3 className="text-2xl sm:text-3xl font-black text-emerald-600 mt-1 font-mono">
                {metrics.acceptedQuotations}
              </h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-[#7DBA00]" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Confirmed Value:</span>
            <span className="font-bold text-emerald-700 font-mono">{formatCurrency(metrics.acceptedValue)}</span>
          </div>
        </div>

      </div>

      {/* Product & Rate Sheet Banner */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-[#00545C]/10 text-[#00545C] flex items-center justify-center flex-shrink-0">
            <Layers className="w-5 h-5 text-[#00545C]" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">Loaded Product Catalogue</h4>
            <p className="text-xs text-slate-500">Synchronized with official Excel rate sheet • GST Included</p>
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-4">
          <div className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-800 text-xs font-bold">
            <span className="text-[#00545C]">PAINTS:</span> {metrics.paintProducts.toLocaleString()} items
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-800 text-xs font-bold">
            <span className="text-[#7DBA00]">ACCESSORIES:</span> {metrics.accessProducts.toLocaleString()} items
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-[#00545C] text-white text-xs font-black">
            Total: {metrics.totalProducts.toLocaleString()} items
          </div>
        </div>
      </div>

      {/* Recent Quotations Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-slate-900">Recent Quotations</h3>
            <p className="text-xs text-slate-500">Latest quotations prepared for clients</p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={loadDashboard}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setActivePage('quotations')}
              className="text-xs font-bold text-[#00545C] hover:text-[#0A6D77] flex items-center space-x-1 cursor-pointer"
            >
              <span>View All</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {recentQuotations.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-2" />
            <p className="font-semibold text-sm">No quotations created yet.</p>
            <p className="text-xs text-slate-400 mt-1">Click "+ Create Quotation" above to prepare your first quote.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <th className="py-3 px-4">Quotation No</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Grand Total (Incl. GST)</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {recentQuotations.map((quote) => {
                  const statusColors = {
                    Draft: 'bg-slate-100 text-slate-700 border-slate-300',
                    Created: 'bg-sky-50 text-sky-700 border-sky-300',
                    Shared: 'bg-indigo-50 text-indigo-700 border-indigo-300',
                    Accepted: 'bg-emerald-50 text-emerald-800 border-emerald-300',
                    Rejected: 'bg-rose-50 text-rose-700 border-rose-300',
                    Expired: 'bg-amber-50 text-amber-700 border-amber-300'
                  };

                  return (
                    <tr key={quote.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-[#00545C]">
                        {quote.quotation_number}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{quote.customer_name}</div>
                        <div className="text-[11px] text-slate-500">{quote.customer_phone}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-medium">
                        {quote.quotation_date}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(quote.grand_total)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusColors[quote.status] || 'bg-slate-100 text-slate-700'}`}>
                          {quote.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={async () => {
                              const res = await api.getQuotation(quote.id);
                              setSelectedQuoteForPdf(res.quotation);
                            }}
                            className="p-1.5 text-slate-600 hover:text-[#00545C] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="View / Print PDF"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={async () => {
                              const res = await api.getQuotation(quote.id);
                              setSelectedQuoteForWa(res.quotation);
                            }}
                            className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                            title="Share on WhatsApp"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* WhatsApp Smart Parser Modal */}
      {showParserModal && (
        <SmartParserModal
          onClose={() => setShowParserModal(false)}
          onTransferToQuotation={(importData) => {
            setShowParserModal(false);
            if (onStartQuoteWithImport) {
              onStartQuoteWithImport(importData);
            } else {
              setActivePage('create-quotation');
            }
          }}
        />
      )}

      {/* PDF View Modal */}
      {selectedQuoteForPdf && (
        <QuotationPdfModal
          quotation={selectedQuoteForPdf}
          onClose={() => setSelectedQuoteForPdf(null)}
        />
      )}

      {/* WhatsApp Share Modal */}
      {selectedQuoteForWa && (
        <WhatsAppShareModal
          quotation={selectedQuoteForWa}
          onClose={() => setSelectedQuoteForWa(null)}
          onShared={() => {
            setSelectedQuoteForWa(null);
            loadDashboard();
          }}
        />
      )}

    </div>
  );
}
