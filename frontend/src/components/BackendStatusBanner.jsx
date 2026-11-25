import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, Loader2, X, Cloud } from 'lucide-react';
import { checkBackendHealth } from '../api/client';

export default function BackendStatusBanner() {
  const [status, setStatus] = useState('checking'); // 'checking' | 'waking' | 'connected' | 'disconnected'
  const [retryCount, setRetryCount] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    verifyConnection(1);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  async function verifyConnection(attempt = 1) {
    if (attempt === 1) {
      setStatus('checking');
    } else {
      setStatus('waking');
    }
    setRetryCount(attempt);

    const result = await checkBackendHealth();
    if (result.ok) {
      setStatus('connected');
    } else {
      // Allow up to 6 attempts (~30 seconds) for Render cold start
      if (attempt < 6) {
        setStatus('waking');
        timerRef.current = setTimeout(() => {
          verifyConnection(attempt + 1);
        }, 4500);
      } else {
        setStatus('disconnected');
      }
    }
  }

  if (status === 'connected' || dismissed) {
    return null;
  }

  if (status === 'waking' || status === 'checking') {
    return (
      <div className="no-print bg-[#004D40] text-emerald-50 px-4 sm:px-6 py-2 text-xs shadow-xs flex items-center justify-between border-b border-emerald-800/40">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Loader2 className="w-3.5 h-3.5 text-[#7DBA00] animate-spin flex-shrink-0" />
            <span className="font-semibold tracking-wide">
              Connecting to secure cloud server...
            </span>
          </div>
          <span className="text-[11px] text-emerald-200 hidden sm:inline">
            Udhayam Agencies Cloud Sync Active
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="no-print bg-slate-900 text-white px-4 sm:px-6 py-2.5 text-xs shadow-sm border-b border-slate-800">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <Cloud className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span className="font-medium text-slate-200">
            Cloud server is warming up. Auto-reconnecting...
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => verifyConnection(1)}
            className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer transition-colors shadow-xs"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Connect Now</span>
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
            title="Dismiss notice"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
