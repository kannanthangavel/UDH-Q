import React, { useState, useEffect } from 'react';
import { 
  Building2, CreditCard, Shield, Clock, 
  Save, Upload, Check, AlertCircle, Lock, Key, CheckCircle2, QrCode
} from 'lucide-react';
import { api, getUploadUrl } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Settings() {
  const { user, settings: authSettings, refreshSettings, updateLocalSettings, changePassword } = useAuth();

  const [activeTab, setActiveTab] = useState('company'); // 'company' | 'banking' | 'defaults' | 'security'

  // General Company & Bank Settings State
  const [formData, setFormData] = useState({
    company_name: 'UDHAYAM AGENCIES',
    company_division: 'Paint Division',
    company_tagline: 'Authorised Dealer in All Reputed Brands of Paints & Accessories',
    company_address: '41/10, KMR Complex, Old Bus Stand Road, Perundurai, Erode - 638052',
    company_phone: '+91 97156 22499',
    company_phone_secondary: '+91 88700 22499',
    company_email: 'udhayamagency2013@gmail.com',
    company_gstin: '33AADFU6496M1ZJ',
    bank_account_name: 'Udhayam Agencies',
    bank_account_no: '6659330152',
    bank_name: 'Indian Bank',
    bank_branch: 'Perundurai Branch',
    bank_ifsc: 'IDIB000P034',
    gpay_number: '+91 97156 22499',
    default_paper_format: 'A4',
    default_validity_days: '7',
    default_gst_rate: '18',
    default_terms: '1. Quotation is valid for 7 days from the date of issue.\n2. Goods once sold/dispatched will not be taken back.\n3. Delivery subject to physical stock availability.\n4. GST and Transport charges applicable as mentioned.'
  });

  // Logo State
  const [companyLogo, setCompanyLogo] = useState('udhayam_logo.png');
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState('');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  // QR Code State
  const [paymentQrCode, setPaymentQrCode] = useState('default_upi_qr.png');
  const [qrFile, setQrFile] = useState(null);
  const [qrPreviewUrl, setQrPreviewUrl] = useState('');
  const [isUploadingQr, setIsUploadingQr] = useState(false);

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Save State & Feedback
  const [isSaving, setIsSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);

  function showToast(text, isError = false) {
    setToastMsg({ text, isError });
    setTimeout(() => setToastMsg(null), 3500);
  }

  useEffect(() => {
    loadSettingsData();
  }, [authSettings]);

  function loadSettingsData() {
    if (authSettings) {
      setFormData(prev => ({
        ...prev,
        ...authSettings,
        bank_account_name: authSettings.bank_account_name || 'Udhayam Agencies',
        bank_account_no: authSettings.bank_account_no || '6659330152',
        bank_name: authSettings.bank_name || 'Indian Bank',
        bank_branch: authSettings.bank_branch || 'Perundurai Branch',
        bank_ifsc: authSettings.bank_ifsc || 'IDIB000P034'
      }));
      if (authSettings.company_logo) setCompanyLogo(authSettings.company_logo);
      if (authSettings.payment_qr_code) setPaymentQrCode(authSettings.payment_qr_code);
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
      if (qrFile) {
        const qrData = new FormData();
        qrData.append('qr_code', qrFile);
        qrData.append('qr', qrFile);
        const resQr = await api.uploadQrCode(qrData);
        setPaymentQrCode(resQr.filename);
        setQrFile(null);
        setQrPreviewUrl('');
      }
      if (logoFile) {
        const logoData = new FormData();
        logoData.append('logo', logoFile);
        const resLogo = await api.uploadLogo(logoData);
        setCompanyLogo(resLogo.filename);
        setLogoFile(null);
        setLogoPreviewUrl('');
      }
      await api.updateSettings(formData);
      updateLocalSettings(formData);
      await refreshSettings();
      showToast('Settings saved successfully');
    } catch (err) {
      showToast('Failed to save settings: ' + err.message, true);
    } finally {
      setIsSaving(false);
    }
  }

  // Logo file selection and upload
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
      showToast('Company logo updated successfully');
    } catch (err) {
      showToast('Failed to upload logo: ' + err.message, true);
    } finally {
      setIsUploadingLogo(false);
    }
  }

  // QR Code file selection and auto-upload
  async function handleQrFileChange(e) {
    const file = e.target.files[0];
    if (file) {
      setQrFile(file);
      const reader = new FileReader();
      reader.onload = () => setQrPreviewUrl(reader.result);
      reader.readAsDataURL(file);

      // Auto-upload immediately so user never encounters an upload glitch
      try {
        setIsUploadingQr(true);
        const data = new FormData();
        data.append('qr_code', file);
        data.append('qr', file);
        const res = await api.uploadQrCode(data);
        setPaymentQrCode(res.filename);
        setQrFile(null);
        await refreshSettings();
        showToast('✓ UPI payment QR code uploaded & saved successfully');
      } catch (err) {
        console.warn('Auto-upload QR failed:', err);
      } finally {
        setIsUploadingQr(false);
      }
    }
  }

  async function handleUploadQr() {
    if (!qrFile) return;
    try {
      setIsUploadingQr(true);
      const data = new FormData();
      data.append('qr_code', qrFile);
      data.append('qr', qrFile);
      const res = await api.uploadQrCode(data);
      setPaymentQrCode(res.filename);
      setQrFile(null);
      setQrPreviewUrl('');
      await refreshSettings();
      showToast('UPI payment QR code updated successfully');
    } catch (err) {
      showToast('Failed to upload QR code: ' + err.message, true);
    } finally {
      setIsUploadingQr(false);
    }
  }

  // Password change submission
  async function handleChangePassword(e) {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword) {
      setPasswordError('Please enter current password');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    try {
      setIsChangingPassword(true);
      await changePassword(currentPassword, newPassword);
      setPasswordSuccess('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast('Password updated successfully');
    } catch (err) {
      setPasswordError(err.message || 'Failed to update password');
    } finally {
      setIsChangingPassword(false);
    }
  }

  const activeLogoUrl = logoPreviewUrl || (authSettings?.company_logo_data?.startsWith('data:')
    ? authSettings.company_logo_data
    : getUploadUrl(companyLogo ? `/uploads/logos/${companyLogo}` : '/uploads/logos/udhayam_logo.png'));

  const activeQrUrl = qrPreviewUrl || (authSettings?.payment_qr_code_data?.startsWith('data:')
    ? authSettings.payment_qr_code_data
    : getUploadUrl(paymentQrCode ? `/uploads/qr/${paymentQrCode}` : '/uploads/qr/default_upi_qr.png'));

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      
      {/* Toast Feedback */}
      {toastMsg && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-xs font-bold flex items-center space-x-2 animate-bounce-short ${
          toastMsg.isError ? 'bg-rose-600 text-white' : 'bg-[#004D40] text-white'
        }`}>
          {toastMsg.isError ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4 text-[#7DBA00]" />}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Settings & Business Profile
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure company branding, bank details, quotation defaults, and security credentials.
          </p>
        </div>
      </div>

      {/* Executive Clean Tab Navigation */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-1 overflow-x-auto text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab('company')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-colors cursor-pointer ${
            activeTab === 'company'
              ? 'bg-[#004D40] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Company Profile</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('banking')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-colors cursor-pointer ${
            activeTab === 'banking'
              ? 'bg-[#004D40] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Bank & Payment QR</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('defaults')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-colors cursor-pointer ${
            activeTab === 'defaults'
              ? 'bg-[#004D40] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Quotation Defaults</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-colors cursor-pointer ${
            activeTab === 'security'
              ? 'bg-[#004D40] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>Security & Password</span>
        </button>
      </div>

      {/* TAB 1: COMPANY PROFILE */}
      {activeTab === 'company' && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
            
            {/* Logo Section */}
            <div>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-3">
                Company Brand Logo
              </h2>
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="w-24 h-24 rounded-2xl bg-slate-50 border border-slate-200 p-2 flex items-center justify-center flex-shrink-0 shadow-inner">
                  <img 
                    src={activeLogoUrl} 
                    alt="Company Logo Preview" 
                    className="max-h-full max-w-full object-contain"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = '/uploads/logos/udhayam_logo.png';
                    }}
                  />
                </div>
                <div className="space-y-2 flex-1 w-full">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleLogoFileChange}
                    id="logo-input"
                    className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-100 file:text-[#004D40] hover:file:bg-slate-200 cursor-pointer"
                  />
                  {logoFile && (
                    <button
                      type="button"
                      disabled={isUploadingLogo}
                      onClick={handleUploadLogo}
                      className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-[#004D40] hover:bg-[#00332C] text-white text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-60"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isUploadingLogo ? 'Saving Logo...' : 'Upload & Save Logo'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* Profile Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Company Name
                </label>
                <input
                  type="text"
                  name="company_name"
                  value={formData.company_name}
                  onChange={handleInputChange}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#004D40]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Division / Subtitle
                </label>
                <input
                  type="text"
                  name="company_division"
                  value={formData.company_division}
                  onChange={handleInputChange}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#004D40]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Tagline / Business Header
                </label>
                <input
                  type="text"
                  name="company_tagline"
                  value={formData.company_tagline}
                  onChange={handleInputChange}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#004D40]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Official Business Address
                </label>
                <textarea
                  name="company_address"
                  rows={2}
                  value={formData.company_address}
                  onChange={handleInputChange}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#004D40]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Primary Contact Phone
                </label>
                <input
                  type="text"
                  name="company_phone"
                  value={formData.company_phone}
                  onChange={handleInputChange}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#004D40]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Secondary Contact Phone
                </label>
                <input
                  type="text"
                  name="company_phone_secondary"
                  value={formData.company_phone_secondary}
                  onChange={handleInputChange}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#004D40]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Official Email Address
                </label>
                <input
                  type="email"
                  name="company_email"
                  value={formData.company_email}
                  onChange={handleInputChange}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#004D40]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  GSTIN Number
                </label>
                <input
                  type="text"
                  name="company_gstin"
                  value={formData.company_gstin}
                  onChange={handleInputChange}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#004D40]"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-[#004D40] hover:bg-[#00332C] text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-60"
              >
                <Save className="w-4 h-4 text-[#7DBA00]" />
                <span>{isSaving ? 'Saving...' : 'Save Company Profile'}</span>
              </button>
            </div>

          </div>
        </form>
      )}

      {/* TAB 2: BANK & UPI QR (EXACT 5-LINE CORPORATE STRUCTURE) */}
      {activeTab === 'banking' && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
            
            <div>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-1">
                Official Bank Settlement Details
              </h2>
              <p className="text-xs text-slate-500">
                Printed directly on quotations and payment receipts in exact 5-line executive structure.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  1. Account Holder Name
                </label>
                <input
                  type="text"
                  name="bank_account_name"
                  value={formData.bank_account_name}
                  onChange={handleInputChange}
                  placeholder="Udhayam Agencies"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#004D40]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  2. Account Number
                </label>
                <input
                  type="text"
                  name="bank_account_no"
                  value={formData.bank_account_no}
                  onChange={handleInputChange}
                  placeholder="6659330152"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#004D40]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  3. Bank Name
                </label>
                <input
                  type="text"
                  name="bank_name"
                  value={formData.bank_name}
                  onChange={handleInputChange}
                  placeholder="Indian Bank"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#004D40]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  4. Branch Name
                </label>
                <input
                  type="text"
                  name="bank_branch"
                  value={formData.bank_branch}
                  onChange={handleInputChange}
                  placeholder="Perundurai Branch"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#004D40]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  5. IFSC Code
                </label>
                <input
                  type="text"
                  name="bank_ifsc"
                  value={formData.bank_ifsc}
                  onChange={handleInputChange}
                  placeholder="IDIB000P034"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#004D40]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  UPI / GPay Mobile Number
                </label>
                <input
                  type="text"
                  name="gpay_number"
                  value={formData.gpay_number}
                  onChange={handleInputChange}
                  placeholder="+91 97156 22499"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#004D40]"
                />
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* UPI Payment QR Code Section */}
            <div>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-3">
                UPI Payment QR Code
              </h2>
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="w-24 h-24 rounded-2xl bg-slate-50 border border-slate-200 p-2 flex items-center justify-center flex-shrink-0 shadow-inner">
                  <img 
                    src={activeQrUrl} 
                    alt="UPI QR Preview" 
                    className="max-h-full max-w-full object-contain"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = '/uploads/qr/default_upi_qr.png';
                    }}
                  />
                </div>
                <div className="space-y-2 flex-1 w-full">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleQrFileChange}
                    id="qr-input"
                    className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-100 file:text-[#004D40] hover:file:bg-slate-200 cursor-pointer"
                  />
                  {qrFile && (
                    <button
                      type="button"
                      disabled={isUploadingQr}
                      onClick={handleUploadQr}
                      className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-[#004D40] hover:bg-[#00332C] text-white text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-60"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isUploadingQr ? 'Saving QR...' : 'Upload & Save QR Code'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-[#004D40] hover:bg-[#00332C] text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-60"
              >
                <Save className="w-4 h-4 text-[#7DBA00]" />
                <span>{isSaving ? 'Saving...' : 'Save Bank Details'}</span>
              </button>
            </div>

          </div>
        </form>
      )}

      {/* TAB 3: QUOTATION DEFAULTS */}
      {activeTab === 'defaults' && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
            
            <div>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-1">
                Default Terms & Quotation Rules
              </h2>
              <p className="text-xs text-slate-500">
                Applied automatically when preparing new quotations.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Validity Period (Days)
                </label>
                <input
                  type="number"
                  name="default_validity_days"
                  value={formData.default_validity_days}
                  onChange={handleInputChange}
                  min="1"
                  max="90"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#004D40]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Default GST Rate (%)
                </label>
                <input
                  type="number"
                  name="default_gst_rate"
                  value={formData.default_gst_rate}
                  onChange={handleInputChange}
                  min="0"
                  max="28"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#004D40]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Default Paper Format
                </label>
                <select
                  name="default_paper_format"
                  value={formData.default_paper_format}
                  onChange={handleInputChange}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#004D40]"
                >
                  <option value="A4">A4 Standard Format</option>
                  <option value="A5">A5 Compact Format</option>
                </select>
              </div>

              <div className="sm:col-span-3">
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Default Terms & Conditions
                </label>
                <textarea
                  name="default_terms"
                  rows={4}
                  value={formData.default_terms}
                  onChange={handleInputChange}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#004D40]"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-[#004D40] hover:bg-[#00332C] text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-60"
              >
                <Save className="w-4 h-4 text-[#7DBA00]" />
                <span>{isSaving ? 'Saving...' : 'Save Defaults'}</span>
              </button>
            </div>

          </div>
        </form>
      )}

      {/* TAB 4: SECURITY & LOGIN PASSWORD */}
      {activeTab === 'security' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
          
          <div>
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-1">
              Account Security & Access
            </h2>
            <p className="text-xs text-slate-500">
              Manage your workspace login credentials.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between text-xs">
            <div>
              <span className="font-bold text-slate-500 uppercase tracking-wider block text-[10px]">
                Active Master Username
              </span>
              <span className="font-extrabold text-slate-900 text-sm">
                Sash
              </span>
            </div>
            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[10px] uppercase">
              Administrator
            </span>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4 max-w-md text-xs">
            
            {passwordError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl flex items-center space-x-2 font-semibold">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            {passwordSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl flex items-center space-x-2 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Current Password
              </label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#004D40]"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                New Password
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#004D40]"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#004D40]"
              />
            </div>

            <button
              type="submit"
              disabled={isChangingPassword}
              className="inline-flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-[#004D40] hover:bg-[#00332C] text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-60"
            >
              <Lock className="w-3.5 h-3.5 text-[#7DBA00]" />
              <span>{isChangingPassword ? 'Updating Password...' : 'Update Password'}</span>
            </button>
          </form>

        </div>
      )}

    </div>
  );
}
