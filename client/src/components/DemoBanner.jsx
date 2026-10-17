import React from 'react';
import { AlertTriangle, UploadCloud } from 'lucide-react';

export function DemoBanner({ isDemo, onNavigateToPriceList }) {
  if (!isDemo) return null;

  return (
    <div className="bg-amber-500 text-slate-900 px-4 py-2 text-xs font-semibold flex items-center justify-between border-b border-amber-600 shadow-xs">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-slate-950 shrink-0" />
        <span>
          DEMO DATA ACTIVE — NOT ACTUAL UDHAYAM PRICING. Fictional prices and items are currently loaded for evaluation.
        </span>
      </div>
      <button
        onClick={onNavigateToPriceList}
        className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-900 text-white rounded font-medium hover:bg-slate-800 transition-colors shadow-xs"
      >
        <UploadCloud className="w-3.5 h-3.5" />
        Upload Real Price List
      </button>
    </div>
  );
}
