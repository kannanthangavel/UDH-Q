import React, { useState, useEffect, useRef } from 'react';
import { WifiOff, RefreshCw, CheckCircle2, Loader2, X, CloudLightning } from 'lucide-react';
import { checkBackendHealth } from '../api/client';

export default function BackendStatusBanner() {
  const [status, setStatus] = useState('checking'); // 'checking' | 'waking' | 'connected' | 'disconnected'
  const [errorInfo, setErrorInfo] = useState(null);
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
      setErrorInfo(null);
    } else {
      // If it's a timeout or network error during first 4 attempts, Render is likely spinning up
      if (attempt < 4) {
        setStatus('waking');
        timerRef.current = setTimeout(() => {
          verifyConnection(attempt + 1);
        }, 5000);
      } else {
        setStatus('disconnected');
        setErrorInfo(result);
      }
    }
  }

  if (status === 'connected' || dismissed) {
    return null;
  }

  if (status === 'waking' || status === 'checking') {
    return (
      <div className="no-print bg-emerald-900 text-emerald-100 px-4 sm:px-6 py-2.5 text-xs shadow-inner flex items-center justify-between">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <Loader2 className="w-4 h-4 text-emerald-400 animate-spin flex-shrink-0" />
            <span className="font-semibold">
              Connecting to UD-QM Cloud Backend...
              {status === 'waking' && ` (Waking up server, attempt ${retryCount}/4)`}
            </span>
          </div>
          <span className="text-[11px] text-emerald-300 hidden sm:inline">
            Free tier instances wake up in ~20-30s. All your 5,331 catalogue items are secure.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="no-print bg-amber-50 border-b border-amber-200 px-4 sm:px-6 py-3 text-amber-950">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center space-x-2.5 text-xs">
          <WifiOff className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <div>
            <span className="font-extrabold text-amber-900">
              Cloud Backend is Reconnecting
            </span>
            <span className="text-amber-800 ml-1.5">
              {errorInfo?.message || 'Server is taking longer than usual to respond. Please click Retry.'}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => verifyConnection(1)}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 font-bold text-xs cursor-pointer transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Connection</span>
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
    </div>
  );
}
