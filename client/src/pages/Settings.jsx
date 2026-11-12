import React, { useState, useEffect } from 'react';
import { 
  Building2, Image, CreditCard, Shield, Clock, 
  Save, RefreshCw, Upload, Check, AlertCircle, Trash2, 
  Users, Plus, FileText, MessageSquare, Key, Lock, CheckCircle2,
  QrCode
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import ThemedConfirmDialog from '../components/ThemedConfirmDialog';

export default function Settings() {
  const { user, isAdmin, settings: authSettings, refreshSettings, updateLocalSettings } = useAuth();

  // Tab: 'profile-logo' | 'bank' | 'terms' | 'whatsapp-api' | 'users' | 'audit'
  const [activeTab, setActiveTab] = useState('profile-logo');

  // Form State
  const [formData, setFormData] = useState({
    company_name: '',
    company_division: '',
    company_tagline: '',
    company_address: '',
    company_phone: '',
    company_phone_secondary: '',
    company_email: '',
    company_gstin: '',
    bank_name: '',
    bank_branch: '',
    bank_account_name: '',
    bank_account_no: '',
    bank_ifsc: '',
    gpay_number: '',
    default_paper_format: 'A4',
    default_validity_days: '7',
    default_gst_rate: '18',
    default_terms: ''
  });

  const [companyLogo, setCompanyLogo] = useState('udhayam_logo.png');
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState('');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Payment UPI QR Code State
  const [paymentQrCode, setPaymentQrCode] = useState('default_upi_qr.png');
  const [qrFile, setQrFile] = useState(null);
  const [qrPreviewUrl, setQrPreviewUrl] = useState('');
  const [isUploadingQr, setIsUploadingQr] = useState(false);
  const [qrSuccess, setQrSuccess] = useState('');
  const [qrError, setQrError] = useState('');

  // API Key & n8n Automation State
  const [apiKey, setApiKey] = useState('');
  const [apiEndpoints, setApiEndpoints] = useState(null);
  const [isLoadingApiKey, setIsLoadingApiKey] = useState(false);
  const [isRegeneratingApiKey, setIsRegeneratingApiKey] = useState(false);
  const [apiKeyCopied, setApiKeyCopied] = useState(false);
  const [apiKeySuccessMsg, setApiKeySuccessMsg] = useState('');
  const [apiKeyErrorMsg, setApiKeyErrorMsg] = useState('');

  // Themed Confirm Dialog & Bottom Toast State
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    type: 'confirm',
    onConfirm: null
  });
  const [toastMsg, setToastMsg] = useState(null);

  function showToast(text, isError = false) {
    setToastMsg({ text, isError });
    setTimeout(() => setToastMsg(null), 4000);
  }

  // User Account (Kids) Profile Edit State
  const [profileName, setProfileName] = useState('Kids');
  const [profileEmail, setProfileEmail] = useState('kids@udhayam.com');
  const [profilePassword, setProfilePassword] = useState('');
  const [profileConfirmPassword, setProfileConfirmPassword] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  useEffect(() => {
    loadSettingsData();
    loadWaConfig();
  }, []);

  useEffect(() => {
    if (user) {
      setProfileName(user.name || 'Kids');
      setProfileEmail(user.email || 'kids@udhayam.com');
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === 'audit') {
      loadAudit();
    } else if (activeTab === 'api-key') {
      loadApiKey();
    }
  }, [activeTab]);

  async function loadSettingsData() {
    try {
      const res = await api.getSettings();
      if (res.settings) {
        setFormData(prev => ({
          ...prev,
          ...res.settings
        }));
        if (res.settings.company_logo) {
          setCompanyLogo(res.settings.company_logo);
        }
        if (res.settings.payment_qr_code) {
          setPaymentQrCode(res.settings.payment_qr_code);
        }
      }
    } catch (e) {
      console.warn('Failed to load settings:', e);
    }
  }

  async function loadApiKey() {
    try {
      setIsLoadingApiKey(true);
      const res = await api.getApiKey();
      if (res.success && res.apiKey) {
        setApiKey(res.apiKey);
        setApiEndpoints(res.endpoints);
      }
    } catch (e) {
      console.warn('Failed to load API key:', e);
    } finally {
      setIsLoadingApiKey(false);
    }
  }

  function handleRegenerateApiKey() {
    setConfirmDialog({
      isOpen: true,
      title: 'Regenerate API Key',
      message: 'Are you sure you want to regenerate your webhook API Key?\n\nAny active n8n workflows or automated systems using the previous key will immediately stop working until updated with the new key.',
      confirmText: 'Regenerate Key',
      cancelText: 'Cancel',
      type: 'danger',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        try {
          setIsRegeneratingApiKey(true);
          setApiKeyErrorMsg('');
          const res = await api.regenerateApiKey();
          if (res.success && res.apiKey) {
            setApiKey(res.apiKey);
            showToast('✓ New API Key generated successfully!');
          }
        } catch (err) {
          setApiKeyErrorMsg(err.message || 'Failed to regenerate API Key');
          showToast('Failed to regenerate API Key: ' + err.message, true);
        } finally {
          setIsRegeneratingApiKey(false);
        }
      }
    });
  }

  function handleCopyApiKey(text) {
    navigator.clipboard.writeText(text);
    setApiKeyCopied(true);
    setTimeout(() => setApiKeyCopied(false), 2000);
  }

  async function loadAudit() {
    try {
      setLoadingAudit(true);
      const res = await api.getAuditLogs();
      setAuditLogs(res.logs || []);
    } catch (e) {}
    finally {
      setLoadingAudit(false);
    }
  }

  function handleInputChange(e) {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }

  async function handleSaveSettings(e) {
    e.preventDefault();
    try {
      setIsSaving(true);
      setSaveError('');
      setSaveSuccess(false);
      await api.updateSettings(formData);
      updateLocalSettings(formData);
      await refreshSettings();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      setSaveError(err.message || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  }

  // Logo upload handler
  function handleLogoFileChange(e) {
    const file = e.target.files[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onload = () => setLogoPreviewUrl(reader.result);
      reader.readAsDataURL(file);
    }
  }

  async function handleUploadLogo() {
    if (!logoFile) return;
    try {
      setIsUploadingLogo(true);
      const data = new FormData();
      data.append('logo', logoFile);
      const res = await api.uploadLogo(data);
      setCompanyLogo(res.filename);
      setLogoFile(null);
      setLogoPreviewUrl('');
      await refreshSettings();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      showToast('Failed to upload logo: ' + err.message, true);
    } finally {
      setIsUploadingLogo(false);
    }
  }

  function handleResetLogo() {
    setConfirmDialog({
      isOpen: true,
      title: 'Reset Company Logo',
      message: 'Reset company logo back to default official Udhayam Agencies logo branding?',
      confirmText: 'Reset Logo',
      cancelText: 'Cancel',
      type: 'reset',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        try {
          await api.resetLogo();
          setCompanyLogo('udhayam_logo.png');
          setLogoFile(null);
          setLogoPreviewUrl('');
          await refreshSettings();
          showToast('✓ Company logo reset to official default');
        } catch (err) {
          showToast('Failed to reset logo: ' + err.message, true);
        }
      }
    });
  }

  // QR Code Upload handlers
  function handleQrFileChange(e) {
    const file = e.target.files[0];
    if (file) {
      setQrFile(file);
      const reader = new FileReader();
      reader.onload = () => setQrPreviewUrl(reader.result);
      reader.readAsDataURL(file);
    }
  }

  async function handleUploadQr() {
    if (!qrFile) return;
    try {
      setIsUploadingQr(true);
      setQrError('');
      const data = new FormData();
      data.append('qr', qrFile);
      const res = await api.uploadQrCode(data);
      setPaymentQrCode(res.filename);
      setQrFile(null);
      setQrPreviewUrl('');
      await refreshSettings();
      setQrSuccess('Payment UPI QR Code updated and attached to all quotations and PDFs successfully!');
      setTimeout(() => setQrSuccess(''), 4000);
    } catch (err) {
      setQrError(err.message || 'Failed to upload QR Code');
    } finally {
      setIsUploadingQr(false);
    }
  }

  function handleResetQr() {
    setConfirmDialog({
      isOpen: true,
      title: 'Reset UPI Payment QR',
      message: 'Reset payment QR code back to default UDHAYAM AGENCIES official UPI QR code?',
      confirmText: 'Reset QR Code',
      cancelText: 'Cancel',
      type: 'reset',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        try {
          await api.resetQrCode();
          setPaymentQrCode('default_upi_qr.png');
          setQrFile(null);
          setQrPreviewUrl('');
          await refreshSettings();
          showToast('✓ Payment QR code reset to official default');
        } catch (err) {
          showToast('Failed to reset QR code: ' + err.message, true);
        }
      }
    });
  }

  // User Profile (Kids / 22499) Save handler
  async function handleSaveProfile(e) {
    e.preventDefault();
    if (profilePassword && profilePassword.length < 4) {
      setProfileError('Password must be at least 4 characters');
      return;
    }
    if (profilePassword && profilePassword !== profileConfirmPassword) {
      setProfileError('Passwords do not match');
      return;
    }
    try {
      setIsSavingProfile(true);
      setProfileError('');
      setProfileSuccess('');
      await api.updateProfile({
        name: profileName,
        email: profileEmail,
        password: profilePassword || undefined
      });
      await refreshSettings();
      setProfilePassword('');
      setProfileConfirmPassword('');
      setProfileSuccess('User account profile and credentials updated successfully!');
      setTimeout(() => setProfileSuccess(''), 4000);
    } catch (err) {
      setProfileError(err.message || 'Failed to update user profile');
    } finally {
      setIsSavingProfile(false);
    }
  }

  const currentLogoSrc = logoPreviewUrl || `/uploads/logos/${companyLogo}`;
  const currentQrSrc = qrPreviewUrl || `/uploads/qr/${paymentQrCode || 'default_upi_qr.png'}`;

  return (
    <div className="space-y-6">
      
      {/* Settings Header */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-[#00545C]">
              Application Settings & Configuration
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage business profile, company logo, payment QR code, WhatsApp API, and account credentials
            </p>
          </div>

          {/* Settings Tabs */}
          <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-xl text-xs">
            <button
              onClick={() => setActiveTab('profile-logo')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                activeTab === 'profile-logo' ? 'bg-[#00545C] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Profile & Logo</span>
            </button>

            <button
              onClick={() => setActiveTab('bank')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                activeTab === 'bank' ? 'bg-[#00545C] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Bank & UPI QR</span>
            </button>

            <button
              onClick={() => setActiveTab('terms')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                activeTab === 'terms' ? 'bg-[#00545C] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Quotation & GST</span>
            </button>

            <button
              onClick={() => setActiveTab('api-key')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                activeTab === 'api-key' ? 'bg-[#00545C] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Key className="w-3.5 h-3.5 text-amber-500" />
              <span>API Key & n8n Integration</span>
            </button>

            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                activeTab === 'users' ? 'bg-[#00545C] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>User Account (Kids)</span>
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                activeTab === 'audit' ? 'bg-[#00545C] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Audit Trail</span>
            </button>
          </div>
        </div>
      </div>

      {/* Global save banner */}
      {saveSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-xl text-xs flex items-center space-x-2 shadow-xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span className="font-bold">Settings saved and updated successfully! All quotations and views reflect the latest configuration.</span>
        </div>
      )}

      {saveError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3.5 rounded-xl text-xs flex items-center space-x-2 shadow-xs animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span className="font-bold">{saveError}</span>
        </div>
      )}

      {/* TAB 1: COMPANY PROFILE & LOGO */}
      {activeTab === 'profile-logo' && (
        <div className="space-y-6 animate-in fade-in">
          
          {/* Logo Upload Card */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <h3 className="text-base font-extrabold text-slate-900 mb-1">
              Official Company Logo / Profile Image
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Placed automatically on all quotations, price list PDFs, and the sidebar navigation.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center">
              
              {/* Active Logo Preview */}
              <div className="sm:col-span-4 flex flex-col items-center p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Active Logo Preview
                </span>
                <div className="w-40 h-28 bg-white rounded-xl p-2 border border-slate-300 shadow-sm flex items-center justify-center overflow-hidden">
                  <img
                    src={currentLogoSrc}
                    alt="Active Logo"
                    className="max-h-full max-w-full object-contain"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = '/uploads/logos/udhayam_logo.png';
                    }}
                  />
                </div>
                <span className="text-[10px] text-slate-500 font-mono mt-2 truncate max-w-full">
                  {companyLogo}
                </span>
              </div>

              {/* Upload Controls */}
              <div className="sm:col-span-8 space-y-3">
                <label className="block text-xs font-bold text-slate-700">
                  Upload New Logo (PNG, JPG, WEBP, SVG)
                </label>
                
                <div className="flex items-center space-x-3">
                  <input
                    type="file"
                    id="logo-upload-input"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={handleLogoFileChange}
                    className="text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#00545C] file:text-white hover:file:bg-[#0A6D77] cursor-pointer"
                  />
                </div>

                {logoFile && (
                  <div className="flex items-center space-x-2 pt-1">
                    <button
                      type="button"
                      onClick={handleUploadLogo}
                      disabled={isUploadingLogo}
                      className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-[#7DBA00] hover:bg-[#8ee000] text-[#003B40] font-black text-xs shadow active:scale-95 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isUploadingLogo ? 'Uploading...' : 'Save & Set as Company Logo'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setLogoFile(null); setLogoPreviewUrl(''); }}
                      className="px-3 py-2 text-xs text-slate-500 hover:text-slate-800 font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Want to restore default official logo?</span>
                  <button
                    type="button"
                    onClick={handleResetLogo}
                    className="text-xs font-bold text-slate-700 hover:text-[#00545C] hover:underline cursor-pointer"
                  >
                    Restore Official Udhayam Logo
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* Company Details Form */}
          <form onSubmit={handleSaveSettings} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
            <h3 className="text-base font-extrabold text-slate-900 mb-1">
              Company & Paint Division Profile
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Official business credentials printed on quotations and receipts
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Business Name</label>
                <input
                  type="text"
                  name="company_name"
                  value={formData.company_name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00545C]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Division Tag</label>
                <input
                  type="text"
                  name="company_division"
                  value={formData.company_division}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00545C]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">Tagline</label>
                <input
                  type="text"
                  name="company_tagline"
                  value={formData.company_tagline}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00545C]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">Office / Shop Address</label>
                <input
                  type="text"
                  name="company_address"
                  value={formData.company_address}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00545C]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Primary Phone Number</label>
                <input
                  type="text"
                  name="company_phone"
                  value={formData.company_phone}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00545C]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Secondary / WhatsApp Phone</label>
                <input
                  type="text"
                  name="company_phone_secondary"
                  value={formData.company_phone_secondary}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00545C]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  name="company_email"
                  value={formData.company_email}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00545C]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">GSTIN Number</label>
                <input
                  type="text"
                  name="company_gstin"
                  value={formData.company_gstin}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 font-mono font-bold border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00545C]"
                />
              </div>
            </div>

            {/* Direct Save Action Bar with Immediate Inline Feedback */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <div>
                {saveSuccess && (
                  <div className="flex items-center space-x-1.5 text-emerald-700 font-bold text-xs bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Profile saved successfully!</span>
                  </div>
                )}
                {saveError && (
                  <div className="flex items-center space-x-1.5 text-rose-700 font-bold text-xs bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200">
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                    <span>{saveError}</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center space-x-1.5 px-6 py-2.5 rounded-xl bg-[#00545C] hover:bg-[#0A6D77] text-white font-black text-xs shadow transition-all active:scale-95 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Saving Profile...' : 'Save Profile Changes'}</span>
              </button>
            </div>
          </form>

        </div>
      )}

      {/* TAB 2: BANK & PAYMENT UPI QR DETAILS */}
      {activeTab === 'bank' && (
        <div className="space-y-6 animate-in fade-in">
          
          {/* Payment UPI QR Code Card */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center space-x-2">
              <QrCode className="w-5 h-5 text-[#00545C]" />
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Payment UPI QR Code (Quotation & PDF Printouts)
                </h3>
                <p className="text-xs text-slate-500">
                  Attached directly inside all Quotation PDFs (A4 & A5) and interactive modal views for instant Google Pay / PhonePe / Paytm scan-to-pay
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center pt-2">
              <div className="sm:col-span-4 flex flex-col items-center p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Active UPI QR Code
                </span>
                <div className="w-36 h-36 bg-white rounded-xl p-2 border border-slate-300 shadow-sm flex items-center justify-center overflow-hidden">
                  <img
                    src={currentQrSrc}
                    alt="UPI QR Code"
                    className="max-h-full max-w-full object-contain"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = '/uploads/qr/default_upi_qr.png';
                    }}
                  />
                </div>
                <span className="text-[10px] text-slate-500 font-mono mt-2 truncate max-w-full">
                  {paymentQrCode || 'default_upi_qr.png'}
                </span>
                <span className="text-[10px] text-emerald-700 font-bold mt-1 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  UPI: 9715622499@okbizaxis
                </span>
              </div>

              <div className="sm:col-span-8 space-y-3">
                <label className="block text-xs font-bold text-slate-700">
                  Attach Custom Payment QR Code (PNG, JPG, WEBP)
                </label>
                <p className="text-xs text-slate-500">
                  You can upload your official PhonePe, Google Pay, BharatPe, or Bank Merchant UPI QR code screenshot.
                </p>
                
                <div className="flex items-center space-x-3">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleQrFileChange}
                    className="text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#00545C] file:text-white hover:file:bg-[#0A6D77] cursor-pointer"
                  />
                </div>

                {qrFile && (
                  <div className="flex items-center space-x-2 pt-1">
                    <button
                      type="button"
                      onClick={handleUploadQr}
                      disabled={isUploadingQr}
                      className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-[#7DBA00] hover:bg-[#8ee000] text-[#003B40] font-black text-xs shadow active:scale-95 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isUploadingQr ? 'Uploading QR...' : 'Save & Attach QR Code to PDF'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setQrFile(null); setQrPreviewUrl(''); }}
                      className="px-3 py-2 text-xs text-slate-500 hover:text-slate-800 font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {qrSuccess && (
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center space-x-2 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>{qrSuccess}</span>
                  </div>
                )}

                {qrError && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2 animate-in fade-in">
                    <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                    <span>{qrError}</span>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Want to use the default Udhayam Agencies UPI QR?</span>
                  <button
                    type="button"
                    onClick={handleResetQr}
                    className="text-xs font-bold text-slate-700 hover:text-[#00545C] hover:underline cursor-pointer"
                  >
                    Restore Official Default UPI QR
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Bank Account Details Form */}
          <form onSubmit={handleSaveSettings} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 mb-1">
                Bank & Payment Account Information
              </h3>
              <p className="text-xs text-slate-500">
                Details printed at the bottom of customer quotation PDFs for wire transfer and NEFT/RTGS/IMPS
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Bank Name</label>
                <input
                  type="text"
                  name="bank_name"
                  value={formData.bank_name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00545C]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Branch Name</label>
                <input
                  type="text"
                  name="bank_branch"
                  value={formData.bank_branch}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00545C]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Account Holder Name</label>
                <input
                  type="text"
                  name="bank_account_name"
                  value={formData.bank_account_name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00545C]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Account Number</label>
                <input
                  type="text"
                  name="bank_account_no"
                  value={formData.bank_account_no}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 font-mono font-bold border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00545C]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">IFSC Code</label>
                <input
                  type="text"
                  name="bank_ifsc"
                  value={formData.bank_ifsc}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 font-mono font-bold border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00545C]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">GPay / UPI Registered Number</label>
                <input
                  type="text"
                  name="gpay_number"
                  value={formData.gpay_number}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 font-bold border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00545C]"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <div>
                {saveSuccess && (
                  <div className="flex items-center space-x-1.5 text-emerald-700 font-bold text-xs bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Bank details saved successfully!</span>
                  </div>
                )}
                {saveError && (
                  <div className="flex items-center space-x-1.5 text-rose-700 font-bold text-xs bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200">
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                    <span>{saveError}</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center space-x-1.5 px-6 py-2.5 rounded-xl bg-[#00545C] hover:bg-[#0A6D77] text-white font-black text-xs shadow transition-all active:scale-95 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Saving...' : 'Save Bank Details'}</span>
              </button>
            </div>
          </form>

        </div>
      )}

      {/* TAB 3: TERMS & QUOTATION DEFAULTS */}
      {activeTab === 'terms' && (
        <form onSubmit={handleSaveSettings} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4 animate-in fade-in">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 mb-1">
              Quotation Defaults & Standard Terms
            </h3>
            <p className="text-xs text-slate-500">
              Default values pre-filled when creating new quotations
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Default Paper Size</label>
              <select
                name="default_paper_format"
                value={formData.default_paper_format}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00545C]"
              >
                <option value="A4">A4 Full Page (210 × 297 mm)</option>
                <option value="A5">A5 Compact (148 × 210 mm)</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Default Validity (Days)</label>
              <input
                type="number"
                min="1"
                max="90"
                name="default_validity_days"
                value={formData.default_validity_days}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00545C]"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Default GST Rate (%)</label>
              <select
                name="default_gst_rate"
                value={formData.default_gst_rate}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00545C]"
              >
                <option value="0">0%</option>
                <option value="5">5%</option>
                <option value="12">12%</option>
                <option value="18">18% (Standard GST - Included in Rate)</option>
                <option value="28">28%</option>
              </select>
            </div>

            <div className="sm:col-span-3">
              <label className="block font-bold text-slate-700 mb-1">Standard Terms & Conditions</label>
              <textarea
                rows={5}
                name="default_terms"
                value={formData.default_terms}
                onChange={handleInputChange}
                className="w-full p-3 font-mono text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00545C]"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <div>
              {saveSuccess && (
                <div className="flex items-center space-x-1.5 text-emerald-700 font-bold text-xs bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Quotation defaults saved successfully!</span>
                </div>
              )}
              {saveError && (
                <div className="flex items-center space-x-1.5 text-rose-700 font-bold text-xs bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200">
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                  <span>{saveError}</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center space-x-1.5 px-6 py-2.5 rounded-xl bg-[#00545C] hover:bg-[#0A6D77] text-white font-black text-xs shadow transition-all active:scale-95 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save Quotation Defaults'}</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 4: API KEY & n8n WEBHOOK INTEGRATION */}
      {activeTab === 'api-key' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6 animate-in fade-in">
          <div>
            <div className="flex items-center space-x-2">
              <Key className="w-5 h-5 text-amber-500" />
              <h3 className="text-base font-extrabold text-slate-900">
                UD-QM Web App API Key & n8n Webhook Integration
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Connect n8n workflows, WhatsApp bots, and custom automations directly into UD-QM using secure API token authentication.
            </p>
          </div>

          {apiKeySuccessMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-xl text-xs flex items-center space-x-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span className="font-bold">{apiKeySuccessMsg}</span>
            </div>
          )}

          {apiKeyErrorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3.5 rounded-xl text-xs flex items-center space-x-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{apiKeyErrorMsg}</span>
            </div>
          )}

          {/* Active API Key Card */}
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Secret Web App API Key
                </label>
                <p className="text-[11px] text-slate-500">
                  Header name: <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-300 text-slate-800 font-bold">X-API-Key</code> or Bearer token
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handleCopyApiKey(apiKey)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs border border-slate-300 transition-colors shadow-2xs cursor-pointer"
                >
                  {apiKeyCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Key className="w-3.5 h-3.5 text-slate-500" />}
                  <span>{apiKeyCopied ? 'Copied Key!' : 'Copy API Key'}</span>
                </button>

                {isAdmin && (
                  <button
                    type="button"
                    disabled={isRegeneratingApiKey}
                    onClick={handleRegenerateApiKey}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRegeneratingApiKey ? 'animate-spin' : ''}`} />
                    <span>{isRegeneratingApiKey ? 'Regenerating…' : 'Regenerate'}</span>
                  </button>
                )}
              </div>
            </div>

            <div className="relative">
              <input
                type="text"
                readOnly
                value={apiKey || 'Loading API key...'}
                className="w-full px-3.5 py-2.5 font-mono text-xs font-bold bg-white text-slate-900 border border-slate-300 rounded-xl select-all focus:outline-none focus:ring-2 focus:ring-[#00545C]"
              />
            </div>

            <div className="flex items-center space-x-2 text-[11px] text-emerald-700 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Authentication ready for n8n workflows & webhook triggers</span>
            </div>
          </div>

          {/* Endpoints for n8n */}
          <div className="space-y-3">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
              Available Webhook & Automation Endpoints for n8n:
            </h4>

            <div className="grid grid-cols-1 gap-2.5 text-xs">
              
              {/* Endpoint 1: Parse WhatsApp */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-black text-[10px] font-mono">POST</span>
                    <code className="font-mono font-bold text-slate-900">/api/whatsapp/parse</code>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Parse customer order messages from WhatsApp & match 5,300+ items with available pack sizes.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyApiKey(apiEndpoints?.parseMessage || `${window.location.origin}/api/whatsapp/parse`)}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-slate-700 font-bold text-[11px] self-start sm:self-center cursor-pointer"
                >
                  Copy URL
                </button>
              </div>

              {/* Endpoint 2: Create Quotation */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-black text-[10px] font-mono">POST</span>
                    <code className="font-mono font-bold text-slate-900">/api/quotations</code>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Create official quotation with tax-inclusive calculation and generate UDQ-YYYY-XXXXXX number.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyApiKey(apiEndpoints?.createQuotation || `${window.location.origin}/api/quotations`)}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-slate-700 font-bold text-[11px] self-start sm:self-center cursor-pointer"
                >
                  Copy URL
                </button>
              </div>

              {/* Endpoint 3: Stream PDF */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-black text-[10px] font-mono">GET</span>
                    <code className="font-mono font-bold text-slate-900">/api/quotations/:id/pdf?download=true</code>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Stream crisp A4/A5 PDF binary to send as document attachment in WhatsApp bot workflows.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyApiKey(apiEndpoints?.getQuotationPdf || `${window.location.origin}/api/quotations/:id/pdf?download=true`)}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-slate-700 font-bold text-[11px] self-start sm:self-center cursor-pointer"
                >
                  Copy URL
                </button>
              </div>

              {/* Endpoint 4: Search Products */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-black text-[10px] font-mono">GET</span>
                    <code className="font-mono font-bold text-slate-900">/api/products?search=...</code>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Query catalog items, rates, and pack sizes with fuzzy and space-agnostic matching.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyApiKey(apiEndpoints?.searchProducts || `${window.location.origin}/api/products`)}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-slate-700 font-bold text-[11px] self-start sm:self-center cursor-pointer"
                >
                  Copy URL
                </button>
              </div>

            </div>
          </div>

          {/* n8n Integration Guide Snippet */}
          <div className="bg-[#003B40] text-slate-200 p-4 rounded-xl space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-300">n8n HTTP Request Node Configuration:</span>
              <button
                type="button"
                onClick={() => handleCopyApiKey(`curl -X POST "${window.location.origin}/api/whatsapp/parse" \\\n  -H "Content-Type: application/json" \\\n  -H "X-API-Key: ${apiKey}" \\\n  -d '{"message": "Customer: Ramesh\\nAsian Paints Apex 20lt 2 cans"}'`)}
                className="text-[11px] text-emerald-200 hover:text-white font-mono font-bold cursor-pointer underline"
              >
                Copy cURL Sample
              </button>
            </div>
            <pre className="font-mono text-[11px] overflow-x-auto text-emerald-100/90 bg-black/30 p-2.5 rounded-lg leading-relaxed">
{`Method: POST
URL: ${window.location.origin}/api/whatsapp/parse
Headers:
  Content-Type: application/json
  X-API-Key: ${apiKey || 'udqm_live_...'}
Body (JSON):
  { "message": "Customer: Ramesh\\nUdhayam Manjal 4lt 2\\nBirla Putty 40kg 5" }`}
            </pre>
          </div>

        </div>
      )}

      {/* TAB 5: SINGLE USER ACCOUNT (Kids / 22499) PROFILE & PASSWORD MANAGEMENT */}
      {activeTab === 'users' && (
        <div className="space-y-6 animate-in fade-in">
          
          {/* Primary User Account Card */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">User Account Profile</h3>
              <p className="text-xs text-slate-500">
                Single master administrator account for UDHAYAM AGENCIES Paint Division
              </p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 rounded-2xl bg-[#00545C] text-[#7DBA00] font-black text-2xl flex items-center justify-center shadow">
                  {profileName ? profileName[0].toUpperCase() : 'K'}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h4 className="text-base font-black text-slate-900">{profileName || 'Kids'}</h4>
                    <span className="bg-[#00545C] text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Master Administrator
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 font-mono">Username: Kids • {profileEmail || 'kids@udhayam.com'}</p>
                  <div className="flex items-center space-x-2 mt-2 text-[11px] text-emerald-700 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Full Administrative Privileges (Rate overrides, Excel import, Settings)</span>
                  </div>
                </div>
              </div>

              <div className="bg-white px-4 py-2.5 rounded-xl border border-slate-200 text-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Security Status</span>
                <span className="font-bold text-slate-800">Password Protected</span>
              </div>
            </div>

            <div className="border border-slate-100 rounded-xl p-4 bg-emerald-50/50 text-xs text-emerald-900">
              <span className="font-bold">Account Policy:</span> Single master administrator account (<b>Kids</b>). You have full control across all features without role switches.
            </div>
          </div>

          {/* Edit Profile & Password Form */}
          <form onSubmit={handleSaveProfile} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 mb-1">
                Update Account Name & Password
              </h3>
              <p className="text-xs text-slate-500">
                Modify your administrator display name, contact email, or change your login password
              </p>
            </div>

            {profileSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center space-x-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span className="font-bold">{profileSuccess}</span>
              </div>
            )}

            {profileError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{profileError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Administrator Name</label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00545C]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Account Email Address</label>
                <input
                  type="email"
                  value={profileEmail}
                  onChange={(e) => setProfileEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00545C]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  New Password <span className="font-normal text-slate-400">(Leave blank to keep current)</span>
                </label>
                <input
                  type="password"
                  placeholder="Enter new password (optional)"
                  value={profilePassword}
                  onChange={(e) => setProfilePassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00545C]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  placeholder="Repeat new password"
                  value={profileConfirmPassword}
                  onChange={(e) => setProfileConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00545C]"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Default Credentials: Username <b>Kids</b> • Password <b>22499</b>
              </span>

              <button
                type="submit"
                disabled={isSavingProfile}
                className="flex items-center space-x-1.5 px-6 py-2.5 rounded-xl bg-[#00545C] hover:bg-[#0A6D77] text-white font-black text-xs shadow transition-all active:scale-95 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSavingProfile ? 'Updating Profile...' : 'Save Profile & Password'}</span>
              </button>
            </div>
          </form>

        </div>
      )}

      {/* TAB 6: AUDIT TRAIL */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">System Audit Trail</h3>
              <p className="text-xs text-slate-500">Immutable log of imports, price overrides, quotes, and shares</p>
            </div>
            <button
              onClick={loadAudit}
              className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loadingAudit ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase">
                  <th className="py-2.5 px-4">Timestamp</th>
                  <th className="py-2.5 px-4">User</th>
                  <th className="py-2.5 px-4">Action</th>
                  <th className="py-2.5 px-4">Target</th>
                  <th className="py-2.5 px-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-400">
                      No audit events recorded yet.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-4 text-slate-400 font-mono text-[11px]">{log.timestamp}</td>
                      <td className="py-2.5 px-4 font-bold text-slate-900">{log.user_name || 'Kids'}</td>
                      <td className="py-2.5 px-4">
                        <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-bold text-[#00545C]">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-700">{log.target_type} #{log.target_id || '-'}</td>
                      <td className="py-2.5 px-4 text-slate-500 font-mono text-[11px] truncate max-w-xs">{log.details}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Themed Confirmation & Reset Dialog */}
      <ThemedConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        type={confirmDialog.type}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />

      {/* Non-Intrusive Bottom-Right Action Toast */}
      {toastMsg && (
        <div className={`fixed bottom-6 right-6 z-50 font-bold text-xs py-3 px-5 rounded-2xl shadow-2xl flex items-center space-x-2.5 border backdrop-blur-md animate-in slide-in-from-bottom-3 duration-200 ${
          toastMsg.isError 
            ? 'bg-rose-950/95 text-rose-100 border-rose-700/80' 
            : 'bg-[#00545C]/95 text-[#7DBA00] border-[#7DBA00]/50'
        }`}>
          {toastMsg.isError ? (
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-[#7DBA00] flex-shrink-0" />
          )}
          <span className="text-white tracking-wide">{toastMsg.text}</span>
        </div>
      )}

    </div>
  );
}
