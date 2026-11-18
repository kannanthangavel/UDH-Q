import React, { useState, useEffect } from 'react';
import { WifiOff, RefreshCw, Link2, CheckCircle2, Loader2, X } from 'lucide-react';
import { checkBackendHealth, getApiOrigin, setCustomApiBaseUrl } from '../api/client';

export default function BackendStatusBanner() {
  const [status, setStatus] = useState('checking'); // 'checking' | 'connected' | 'disconnected'
  const [errorInfo, setErrorInfo] = useState(null);
  const [showUrlForm, setShowUrlForm] = useState(false);
  const [urlInput, setUrlInput] = useState(() => getApiOrigin() || 'https://ud-qm-backend.onrender.com');
  const [isTesting, setIsTesting] = useState(false);
  const [urlError, setUrlError] = useState('');
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    verifyConnection();
  }, []);

  async function verifyConnection() {
    setStatus('checking');
    const result = await checkBackendHealth();
    if (result.ok) {
      setStatus('connected');
      setErrorInfo(null);
    } else {
      setStatus('disconnected');
      setErrorInfo(result);
    }
  }

  async function handleSaveBackendUrl(e) {
    e.preventDefault();
    setUrlError('');
    const cleaned = urlInput.trim();
    if (!cleaned || !/^https?:\/\//i.test(cleaned)) {
      setUrlError('Please enter a valid URL starting with https:// or http:// (e.g. https://ud-qm-backend.onrender.com)');
      return;
    }

    setIsTesting(true);
    const result = await checkBackendHealth(cleaned);
    setIsTesting(false);

    if (result.ok) {
      setCustomApiBaseUrl(cleaned);
      setStatus('connected');
      window.location.reload();
    } else {
      setUrlError(result.message || 'Could not reach /api/health at that URL. Check if your Render service is live.');
    }
  }

  if (status === 'connected' || status === 'checking' || dismissed) {
    return null;
  }

  const isHtmlMismatch = errorInfo?.reason === 'HTML_RESPONSE';

  return (
    <div className="no-print bg-amber-50 border-b border-amber-200 px-4 sm:px-6 py-3 text-amber-950">
      <div className="max-w-7xl mx-auto flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start sm:items-center space-x-2.5 text-xs">
            <WifiOff className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <span className="font-extrabold text-amber-900">
                {isHtmlMismatch ? 'Backend API Not Connected' : 'Connecting to UD-QM Server'}
              </span>
              <span className="text-amber-800 ml-1.5">
                {isHtmlMismatch
                  ? 'This Vercel frontend needs your Render backend URL to load products, search, and quotations.'
                  : errorInfo?.message || 'Unable to reach the backend API right now.'}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={verifyConnection}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 font-bold text-xs cursor-pointer transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
            <button
              type="button"
              onClick={() => setShowUrlForm(prev => !prev)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#00545C] hover:bg-[#0A6D77] text-white font-bold text-xs cursor-pointer transition-colors"
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>Connect Backend URL</span>
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="p-1 rounded-lg text-amber-700 hover:bg-amber-200/60 cursor-pointer"
              title="Dismiss notice"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {showUrlForm && (
          <form onSubmit={handleSaveBackendUrl} className="bg-white border border-amber-200 rounded-xl p-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shadow-xs">
            <div className="flex-1">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://ud-qm-backend.onrender.com"
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00545C] text-slate-900"
              />
              {urlError && (
                <p className="text-[11px] text-rose-600 font-semibold mt-1">{urlError}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={isTesting}
              className="inline-flex items-center justify-center space-x-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              {isTesting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Testing…</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Verify & Connect</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
