import React from 'react';
import { 
  AlertCircle, Trash2, Copy, RefreshCw, CheckCircle2, 
  HelpCircle, X, ShieldAlert
} from 'lucide-react';

/**
 * ThemedConfirmDialog
 * 
 * Replaces native browser confirm() and alert() popups with a modern,
 * centered modal dialogue matching Udhayam Agencies' Deep Teal (#00545C)
 * and Lime (#7DBA00) design theme.
 * 
 * Props:
 * - isOpen: boolean
 * - title: string
 * - message: string or ReactNode
 * - confirmText: string (default: 'Confirm')
 * - cancelText: string (default: 'Cancel')
 * - type: 'confirm' | 'danger' | 'duplicate' | 'info' | 'success' (default: 'confirm')
 * - onConfirm: () => void
 * - onCancel: () => void
 * - isSubmitting: boolean
 */
export default function ThemedConfirmDialog({
  isOpen,
  title = 'Confirmation Required',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'confirm',
  onConfirm,
  onCancel,
  isSubmitting = false
}) {
  if (!isOpen) return null;

  // Determine styling and icon based on dialog type
  let icon = <HelpCircle className="w-6 h-6 text-[#00545C]" />;
  let iconBg = 'bg-teal-50 border-teal-200';
  let confirmBtnClass = 'bg-[#00545C] hover:bg-[#004147] text-white focus:ring-teal-500';

  if (type === 'danger') {
    icon = <Trash2 className="w-6 h-6 text-rose-600" />;
    iconBg = 'bg-rose-50 border-rose-200';
    confirmBtnClass = 'bg-rose-600 hover:bg-rose-700 text-white focus:ring-rose-500';
  } else if (type === 'duplicate') {
    icon = <Copy className="w-6 h-6 text-[#00545C]" />;
    iconBg = 'bg-teal-50 border-teal-200';
    confirmBtnClass = 'bg-[#00545C] hover:bg-[#004147] text-white focus:ring-teal-500';
  } else if (type === 'reset') {
    icon = <RefreshCw className="w-6 h-6 text-amber-600" />;
    iconBg = 'bg-amber-50 border-amber-200';
    confirmBtnClass = 'bg-amber-600 hover:bg-amber-700 text-white focus:ring-amber-500';
  } else if (type === 'success') {
    icon = <CheckCircle2 className="w-6 h-6 text-[#7DBA00]" />;
    iconBg = 'bg-lime-50 border-lime-200';
    confirmBtnClass = 'bg-[#00545C] hover:bg-[#004147] text-white focus:ring-teal-500';
  } else if (type === 'info') {
    icon = <AlertCircle className="w-6 h-6 text-blue-600" />;
    iconBg = 'bg-blue-50 border-blue-200';
    confirmBtnClass = 'bg-[#00545C] hover:bg-[#004147] text-white focus:ring-teal-500';
  }

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onCancel}
    >
      <div 
        className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Accent Strip */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#00545C] via-[#7DBA00] to-[#00545C]" />

        {/* Modal Body */}
        <div className="p-6">
          <div className="flex items-start space-x-4">
            {/* Themed Icon Badge */}
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center border flex-shrink-0 ${iconBg}`}>
              {icon}
            </div>

            {/* Dialog Text */}
            <div className="flex-1 min-w-0 pt-0.5">
              <h3 className="text-base font-extrabold text-slate-900 leading-snug">
                {title}
              </h3>
              <div className="mt-2 text-xs text-slate-600 leading-relaxed space-y-1">
                {typeof message === 'string' ? (
                  <p className="whitespace-pre-line">{message}</p>
                ) : (
                  message
                )}
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={onCancel}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors -mr-1 -mt-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-100 flex items-center justify-end space-x-3">
          {cancelText && (
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 transition-all cursor-pointer disabled:opacity-50"
            >
              {cancelText}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className={`px-4 py-2 text-xs font-extrabold rounded-xl shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 cursor-pointer disabled:opacity-50 flex items-center space-x-1.5 ${confirmBtnClass}`}
          >
            {isSubmitting && (
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-1" />
            )}
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
