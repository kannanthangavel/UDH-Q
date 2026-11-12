import React, { useState, useEffect } from 'react';
import {
  Building2,
  Landmark,
  FileText,
  Save,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  RotateCcw,
  Download,
  Mail,
  Smartphone,
  Upload,
  Trash2,
  Image as ImageIcon,
  Copy,
  Check,
  ShieldCheck,
  Radio,
  ExternalLink
} from 'lucide-react';
import { api } from '../../api/client';
import { Badge } from '../../components/Badge';

export function Settings({ onPriceListChanged }) {
  const [activeTab, setActiveTab] = useState('company'); // 'company' | 'whatsapp' | 'payment' | 'quotation' | 'email' | 'demo'
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  // Logo upload state
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoFile, setLogoFile] = useState(null);

  // WhatsApp status state
  const [whatsAppStatus, setWhatsAppStatus] = useState(null);
  const [checkingWhatsApp, setCheckingWhatsApp] = useState(false);
  const [copiedWebhookUrl, setCopiedWebhookUrl] = useState(false);

  useEffect(() => {
    fetchSettings();
    checkWhatsAppConnection();
  }, []);

  async function fetchSettings() {
    try {
      setLoading(true);
      const res = await api.getSettings();
      setSettings(res.settings || {});
    } catch (err) {
      setError(err.message || 'Failed to load settings.');
    } finally {
      setLoading(false);
    }
  }

  async function checkWhatsAppConnection() {
    try {
      setCheckingWhatsApp(true);
      const res = await api.getWhatsAppStatus();
      setWhatsAppStatus(res);
    } catch (err) {
      console.warn('Failed to check WhatsApp status:', err);
    } finally {
      setCheckingWhatsApp(false);
    }
  }

  function handleChange(key, value) {
    setSettings((prev) => ({
      ...prev,
      [key]: value
    }));
  }

  async function handleSubmit(e) {
    if (e) e.preventDefault();
    try {
      setSaving(true);
      setMessage(null);
      setError(null);
      await api.updateSettings(settings);
      setMessage('Settings updated and saved successfully.');
      checkWhatsAppConnection();
    } catch (err) {
      setError(err.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  }

  // Handle Logo Upload
  async function handleLogoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('Logo file size must be less than 5MB.');
      return;
    }

    try {
      setLogoUploading(true);
      setError(null);
      setMessage(null);
      const formData = new FormData();
      formData.append('logo', file);
      const res = await api.uploadCompanyLogo(formData);
      setSettings(prev => ({ ...prev, company_logo: res.filename }));
      setMessage('Company logo uploaded successfully! It will now be contained in all new quotation headers.');
    } catch (err) {
      setError(err.message || 'Failed to upload logo.');
    } finally {
      setLogoUploading(false);
    }
  }

  // Handle Logo Removal
  async function handleRemoveLogo() {
    const confirm = window.confirm('Remove company logo? Quotations configured with Default Logo will render text-only headers. Finalized historical snapshots will not be altered.');
    if (!confirm) return;

    try {
      setLogoUploading(true);
      setError(null);
      setMessage(null);
      await api.removeCompanyLogo();
      setSettings(prev => ({ ...prev, company_logo: '' }));
      setMessage('Company logo removed.');
    } catch (err) {
      setError(err.message || 'Failed to remove logo.');
    } finally {
      setLogoUploading(false);
    }
  }

  // Handle Reset Demo
  async function handleResetDemo() {
    const confirm = window.confirm('Reset demo mode to reload default sample products and reset active price list?');
    if (!confirm) return;

    try {
      setSaving(true);
      await api.resetDemoData({ clearQuotations: false });
      setMessage('Demo data successfully reset.');
      if (onPriceListChanged) onPriceListChanged();
      fetchSettings();
    } catch (err) {
      setError(err.message || 'Failed to reset demo data.');
    } finally {
      setSaving(false);
    }
  }

  function copyWebhookUrl() {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${settings.public_app_url || origin}/api/whatsapp/webhook`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopiedWebhookUrl(true);
      setTimeout(() => setCopiedWebhookUrl(false), 3000);
    }
  }

  if (loading) {
    return <div className="p-12 text-center text-xs text-slate-500">Loading settings...</div>;
  }

  const navTabs = [
    { id: 'company', label: 'Company & Logo', icon: Building2 },
    { id: 'whatsapp', label: 'WhatsApp Business API', icon: Smartphone },
    { id: 'payment', label: 'Bank & Payments', icon: Landmark },
    { id: 'quotation', label: 'Quotation Defaults', icon: FileText },
    { id: 'email', label: 'Email & SMTP', icon: Mail },
    { id: 'demo', label: 'Trial & Demo Mode', icon: RotateCcw }
  ];

  const logoUrl = settings.company_logo ? api.getCompanyLogoUrl(settings.company_logo) : null;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Business & Integration Settings</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage company profile, WhatsApp Business Cloud API credentials, quotation defaults, and bank payment info.
          </p>
        </div>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md shadow-2xs transition-colors"
        >
          {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          <span>{saving ? 'Saving...' : 'Save All Settings'}</span>
        </button>
      </div>

      {message && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{message}</span>
          </div>
          <button onClick={() => setMessage(null)} className="font-bold">×</button>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="font-bold">×</button>
        </div>
      )}

      {/* Main Settings Navigation Tabs */}
      <div className="flex border-b border-slate-200 bg-white rounded-t-lg px-2 shadow-2xs overflow-x-auto">
        {navTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                isActive
                  ? 'border-blue-600 text-blue-600 bg-blue-50/40'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: Company Profile & Logo */}
      {activeTab === 'company' && (
        <div className="space-y-6">
          {/* Logo Management Card */}
          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <ImageIcon className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-bold text-slate-900">Default Company Logo</h2>
            </div>
            <p className="text-xs text-slate-500">
              Upload your official company emblem or trade logo. It is proportionally contained in the document header for both A5 and A4 formats. Finalized quotations preserve an immutable snapshot, so future logo updates never alter past invoices.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center pt-2">
              {/* Preview Box */}
              <div className="md:col-span-4 flex flex-col items-center justify-center p-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-lg min-h-[140px]">
                {logoUrl ? (
                  <div className="space-y-2 text-center">
                    <img
                      src={logoUrl}
                      alt="Company Logo Preview"
                      className="max-h-24 max-w-[200px] object-contain mx-auto rounded shadow-2xs bg-white p-1 border border-slate-200"
                    />
                    <span className="text-[11px] text-slate-500 font-mono block truncate max-w-[220px]">
                      {settings.company_logo}
                    </span>
                  </div>
                ) : (
                  <div className="text-center text-slate-400 space-y-1">
                    <ImageIcon className="w-8 h-8 mx-auto text-slate-300" />
                    <span className="text-xs font-medium block">No Logo Uploaded</span>
                    <span className="text-[10px] text-slate-400 block">Text header will be used</span>
                  </div>
                )}
              </div>

              {/* Upload & Action Controls */}
              <div className="md:col-span-8 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold shadow-2xs transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{logoUploading ? 'Uploading...' : logoUrl ? 'Replace Logo' : 'Upload Company Logo'}</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleLogoUpload}
                      disabled={logoUploading}
                      className="hidden"
                    />
                  </label>

                  {logoUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      disabled={logoUploading}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 rounded-md text-xs font-semibold transition-colors shadow-2xs"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>Remove Logo</span>
                    </button>
                  )}
                </div>

                <div className="text-[11px] text-slate-500 space-y-1">
                  <p>• Supported formats: <strong>PNG, JPG, WebP</strong> (transparent background PNG recommended).</p>
                  <p>• Max file size: <strong>5 MB</strong>.</p>
                  <p>• Automatically scaled to fit A5 (compact) and A4 (standard) document margins without overlapping text.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Seller / Profile Details */}
          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Building2 className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-bold text-slate-900">Seller / Business Information</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Company / Firm Name</label>
                <input
                  type="text"
                  value={settings.company_name || ''}
                  onChange={(e) => handleChange('company_name', e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Business Tagline / Subtitle</label>
                <input
                  type="text"
                  value={settings.company_tagline || ''}
                  onChange={(e) => handleChange('company_tagline', e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded focus:bg-white"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Official Address</label>
                <textarea
                  rows={2}
                  value={settings.company_address || ''}
                  onChange={(e) => handleChange('company_address', e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">GSTIN</label>
                <input
                  type="text"
                  value={settings.company_gstin || ''}
                  onChange={(e) => handleChange('company_gstin', e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded font-mono focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Contact Phone</label>
                <input
                  type="text"
                  value={settings.company_phone || ''}
                  onChange={(e) => handleChange('company_phone', e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Official Email</label>
                <input
                  type="email"
                  value={settings.company_email || ''}
                  onChange={(e) => handleChange('company_email', e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded focus:bg-white"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: WhatsApp Business API (Meta Cloud API) */}
      {activeTab === 'whatsapp' && (
        <div className="space-y-6">
          {/* Status Overview Card */}
          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-600" />
                <h2 className="text-sm font-bold text-slate-900">Meta WhatsApp Cloud API Integration</h2>
              </div>
              <button
                type="button"
                onClick={checkWhatsAppConnection}
                disabled={checkingWhatsApp}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-xs font-semibold transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${checkingWhatsApp ? 'animate-spin' : ''}`} />
                <span>Check Live Status</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Connection State</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`w-2.5 h-2.5 rounded-full ${whatsAppStatus?.connectionState === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                  <span className="font-bold text-slate-800">
                    {whatsAppStatus?.connectionState === 'connected' ? 'Live Connected' : 'Operating in Trial/Simulator Mode'}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Active Mode</span>
                <span className="font-bold text-slate-800 mt-1 block">
                  {settings.whatsapp_integration_mode === 'official_meta_api' ? 'Official Meta Cloud API' : 'Trial Simulator Mode'}
                </span>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Webhook Signature Security</span>
                <span className="font-bold text-slate-800 mt-1 block">
                  {settings.meta_app_secret ? 'HMAC-SHA256 Active' : 'Unsigned / Dev Mode'}
                </span>
              </div>
            </div>
          </div>

          {/* Integration Mode Switcher */}
          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-2xs space-y-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Operating Mode
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <label className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                settings.whatsapp_integration_mode !== 'official_meta_api'
                  ? 'border-blue-600 bg-blue-50/30'
                  : 'border-slate-200 hover:border-slate-300'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">Trial / Simulator Mode (Local Testing)</span>
                  <input
                    type="radio"
                    name="integration_mode"
                    value="trial_simulator"
                    checked={settings.whatsapp_integration_mode !== 'official_meta_api'}
                    onChange={() => handleChange('whatsapp_integration_mode', 'trial_simulator')}
                    className="text-blue-600"
                  />
                </div>
                <p className="text-slate-500 text-[11px] mt-1.5 leading-relaxed">
                  No Meta Developer account required. Use the interactive <strong>WhatsApp Inbox Simulator</strong> to test parsing, quoting, and web sharing immediately.
                </p>
              </label>

              <label className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                settings.whatsapp_integration_mode === 'official_meta_api'
                  ? 'border-emerald-600 bg-emerald-50/30'
                  : 'border-slate-200 hover:border-slate-300'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">Official Meta Cloud API (Live Production)</span>
                  <input
                    type="radio"
                    name="integration_mode"
                    value="official_meta_api"
                    checked={settings.whatsapp_integration_mode === 'official_meta_api'}
                    onChange={() => handleChange('whatsapp_integration_mode', 'official_meta_api')}
                    className="text-emerald-600"
                  />
                </div>
                <p className="text-slate-500 text-[11px] mt-1.5 leading-relaxed">
                  Direct connection to Meta's WhatsApp Cloud Platform. Receives real customer messages via webhooks and delivers PDF documents directly.
                </p>
              </label>
            </div>
          </div>

          {/* Meta API Credentials Form */}
          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-2xs space-y-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Meta Developer Credentials
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">WhatsApp Business Account ID (WABA ID)</label>
                <input
                  type="text"
                  placeholder="e.g. 109283746592837"
                  value={settings.meta_waba_id || ''}
                  onChange={(e) => handleChange('meta_waba_id', e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded font-mono focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Phone Number ID</label>
                <input
                  type="text"
                  placeholder="e.g. 102938475610293"
                  value={settings.meta_phone_number_id || ''}
                  onChange={(e) => handleChange('meta_phone_number_id', e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded font-mono focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Business Display Phone Number</label>
                <input
                  type="text"
                  placeholder="e.g. +91 97156 22499"
                  value={settings.meta_business_phone || ''}
                  onChange={(e) => handleChange('meta_business_phone', e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded font-mono focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">API Version</label>
                <input
                  type="text"
                  placeholder="v21.0"
                  value={settings.meta_api_version || 'v21.0'}
                  onChange={(e) => handleChange('meta_api_version', e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded font-mono focus:bg-white"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Permanent Meta Access Token (System User Token)</label>
                <input
                  type="password"
                  placeholder="EAAG..."
                  value={settings.meta_access_token || ''}
                  onChange={(e) => handleChange('meta_access_token', e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded font-mono focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">App Secret (for Webhook HMAC-SHA256 Verification)</label>
                <input
                  type="password"
                  placeholder="Meta App Secret..."
                  value={settings.meta_app_secret || ''}
                  onChange={(e) => handleChange('meta_app_secret', e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded font-mono focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Webhook Verify Token (hub.verify_token)</label>
                <input
                  type="text"
                  placeholder="e.g. udhayam_secure_verify_2026"
                  value={settings.meta_webhook_verify_token || ''}
                  onChange={(e) => handleChange('meta_webhook_verify_token', e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded font-mono focus:bg-white"
                />
              </div>
            </div>

            {/* Webhook Callback Display */}
            <div className="pt-3 border-t border-slate-100">
              <label className="block font-semibold text-slate-700 mb-1 text-xs">
                Your Webhook Callback URL (Copy & Paste in Meta App Dashboard &rarr; WhatsApp &rarr; Configuration):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${settings.public_app_url || (typeof window !== 'undefined' ? window.location.origin : '')}/api/whatsapp/webhook`}
                  className="w-full p-2 bg-slate-100 border border-slate-200 rounded font-mono text-xs text-slate-700 select-all"
                />
                <button
                  type="button"
                  onClick={copyWebhookUrl}
                  className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded text-xs flex items-center gap-1.5 transition-colors shadow-2xs shrink-0"
                >
                  {copiedWebhookUrl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedWebhookUrl ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Bank & Payments */}
      {activeTab === 'payment' && (
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Landmark className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-900">Bank & GPay Payment Information</h2>
          </div>
          <p className="text-xs text-slate-500">
            These account details appear at the bottom of generated PDF quotations for customer direct payments.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Account Holder Name</label>
              <input
                type="text"
                value={settings.bank_account_name || ''}
                onChange={(e) => handleChange('bank_account_name', e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded focus:bg-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Bank Name</label>
              <input
                type="text"
                value={settings.bank_name || ''}
                onChange={(e) => handleChange('bank_name', e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded focus:bg-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Account Number</label>
              <input
                type="text"
                value={settings.bank_account_no || ''}
                onChange={(e) => handleChange('bank_account_no', e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded font-mono focus:bg-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">IFSC Code / Branch</label>
              <input
                type="text"
                value={settings.bank_ifsc || ''}
                onChange={(e) => handleChange('bank_ifsc', e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded font-mono focus:bg-white"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">GPay Number & Business Name</label>
              <input
                type="text"
                value={settings.gpay_number || ''}
                onChange={(e) => handleChange('gpay_number', e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded font-medium text-emerald-700 focus:bg-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Quotation Defaults */}
      {activeTab === 'quotation' && (
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <FileText className="w-4 h-4 text-purple-600" />
            <h2 className="text-sm font-bold text-slate-900">Quotation Defaults & Numbering</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Quotation Prefix</label>
              <input
                type="text"
                value={settings.quote_prefix || 'UD'}
                onChange={(e) => handleChange('quote_prefix', e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded font-mono focus:bg-white"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Format: PREFIX-YYYY-0001</span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Default Paper Size</label>
              <select
                value={settings.default_paper_size || 'A5'}
                onChange={(e) => handleChange('default_paper_size', e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded focus:bg-white"
              >
                <option value="A5">A5 (Default standard)</option>
                <option value="A4">A4</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Default Document Mode</label>
              <select
                value={settings.default_doc_type || 'gst_quotation'}
                onChange={(e) => handleChange('default_doc_type', e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded focus:bg-white"
              >
                <option value="gst_quotation">GST Quotation</option>
                <option value="estimation">Estimation</option>
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="block font-semibold text-slate-700 mb-1">Default Quotation Terms & Notes</label>
              <textarea
                rows={3}
                value={settings.default_notes || ''}
                onChange={(e) => handleChange('default_notes', e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs focus:bg-white"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block font-semibold text-slate-700 mb-1">Public Domain URL (Optional for WhatsApp PDF Links)</label>
              <input
                type="text"
                placeholder="e.g. https://udhayam-agencies.com (leave blank to auto-detect)"
                value={settings.public_app_url || ''}
                onChange={(e) => handleChange('public_app_url', e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs focus:bg-white"
              />
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                If provided, online PDF links embedded inside WhatsApp welcome messages will use this public URL so customers can open it on their phones from anywhere.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: Email & SMTP */}
      {activeTab === 'email' && (
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Mail className="w-4 h-4 text-purple-600" />
            <h2 className="text-sm font-bold text-slate-900">Email & SMTP Configuration</h2>
          </div>
          <p className="text-xs text-slate-500">
            Configure SMTP credentials (e.g. Gmail App Password) to allow direct background email delivery with the official PDF attached. If left blank, you can still use the 1-click Gmail/Client launcher!
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">SMTP Host</label>
              <input
                type="text"
                placeholder="e.g. smtp.gmail.com"
                value={settings.smtp_host || ''}
                onChange={(e) => handleChange('smtp_host', e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded focus:bg-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">SMTP Port</label>
              <input
                type="text"
                placeholder="587 or 465"
                value={settings.smtp_port || '587'}
                onChange={(e) => handleChange('smtp_port', e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded focus:bg-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Sender Email / User</label>
              <input
                type="email"
                placeholder="e.g. udhayamagencies2013@gmail.com"
                value={settings.smtp_user || ''}
                onChange={(e) => handleChange('smtp_user', e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded focus:bg-white"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">SMTP Password / Google App Password</label>
              <input
                type="password"
                placeholder="16-character App Password"
                value={settings.smtp_pass || ''}
                onChange={(e) => handleChange('smtp_pass', e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded font-mono focus:bg-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Sender Display Name</label>
              <input
                type="text"
                placeholder="e.g. Udhayam Agencies"
                value={settings.smtp_from || ''}
                onChange={(e) => handleChange('smtp_from', e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded focus:bg-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: Trial & Demo Controls */}
      {activeTab === 'demo' && (
        <div className="bg-amber-50/50 border border-amber-200 rounded-lg p-6 space-y-4">
          <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wider">
            Trial Mode & Sample Price List Assets
          </h3>
          <p className="text-xs text-amber-800 leading-relaxed">
            Reset demo mode to load initial sample products or download a ready-to-test Excel file in Udhayam's required format.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              onClick={handleResetDemo}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-md shadow-2xs transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Demo Price List
            </button>

            <a
              href={api.getSampleExcelUrl()}
              download
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 text-xs font-semibold rounded-md shadow-2xs transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download Sample Udhayam Excel
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
