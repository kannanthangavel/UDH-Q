import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[UD-QM ErrorBoundary] Uncaught UI error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F5F8F5] flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="bg-[#00545C] text-white px-6 py-4 flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-400/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <h2 className="font-extrabold text-base">UD-QM Workspace Recovery</h2>
                <p className="text-xs text-emerald-200">Udhayam Agencies • Paint Division</p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-700 leading-relaxed">
                Something unexpected occurred while rendering this view. Your saved quotations and catalogue data are completely safe.
              </p>

              {this.state.error?.message && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs font-mono text-rose-800 break-words">
                  {this.state.error.message}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={this.handleReset}
                  className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-[#00545C] hover:bg-[#0A6D77] text-white font-bold text-xs shadow-sm cursor-pointer transition-colors"
                >
                  <Home className="w-4 h-4" />
                  <span>Return to Dashboard</span>
                </button>
                <button
                  type="button"
                  onClick={this.handleReload}
                  className="flex items-center space-x-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Reload App</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
