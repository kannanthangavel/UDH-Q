import React, { useState } from 'react';
import { Lock, User, Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getUploadUrl } from '../api/client';

export default function LoginScreen() {
  const { login, settings } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const logoUrl = (settings?.company_logo_data && settings?.company_logo_data.startsWith('data:'))
    ? settings.company_logo_data
    : getUploadUrl(
        settings?.company_logo
          ? `/uploads/logos/${settings.company_logo}`
          : '/uploads/logos/udhayam_logo.png'
      );

  async function handleSubmit(e) {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please enter your username and password.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await login(username.trim(), password);
    } catch (err) {
      setError(err.message || 'Invalid username or password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F8F5] p-4 selection:bg-[#7DBA00] selection:text-[#003B40]">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-200/80 overflow-hidden">
        
        {/* Brand Header Banner */}
        <div className="bg-[#004D40] text-white p-7 text-center relative overflow-hidden">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-white p-2 shadow-md flex items-center justify-center mb-3.5 border border-slate-200">
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
          <div className="inline-flex items-center space-x-1.5 px-3 py-0.5 rounded-full bg-white/10 text-emerald-200 text-[10px] font-bold uppercase tracking-wider mb-1">
            <span>Paint Division</span>
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-white">
            UDHAYAM AGENCIES
          </h1>
          <p className="text-xs text-slate-200 mt-0.5">
            Quotation Management System (UD-QM)
          </p>

          <div className="absolute -right-8 -bottom-8 w-28 h-28 rounded-full bg-white/5 pointer-events-none"></div>
        </div>

        {/* Login Form */}
        <div className="p-7">
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 rounded-xl flex items-start space-x-2 animate-shake">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <span className="font-semibold leading-relaxed">{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  autoFocus
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#004D40] focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#004D40] focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 flex items-center justify-center space-x-2 py-3 px-4 rounded-xl text-sm font-bold bg-[#004D40] hover:bg-[#00332C] text-white shadow-md transition-all transform active:scale-98 cursor-pointer disabled:opacity-60"
            >
              {loading ? (
                <span>Verifying credentials...</span>
              ) : (
                <>
                  <LogIn className="w-4 h-4 text-[#7DBA00]" />
                  <span>Sign In to UD-QM</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-400">
              UDHAYAM AGENCIES • Perundurai, Erode
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
