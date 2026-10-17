import React, { useState, useEffect } from 'react';
import { Search, Check, AlertCircle } from 'lucide-react';
import { api } from '../api/client';
import { formatINR } from '../utils/currency';
import { Modal } from './Modal';
import { Badge } from './Badge';

export function ProductSelectorModal({ isOpen, onClose, onSelectProduct, currentItemName }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setSearchTerm(currentItemName || '');
      fetchProducts(currentItemName || '');
    }
  }, [isOpen, currentItemName]);

  async function fetchProducts(query) {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getProducts({ search: query, limit: 30 });
      setProducts(res.products || []);
    } catch (err) {
      setError(err.message || 'Failed to search products.');
    } finally {
      setLoading(false);
    }
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    fetchProducts(searchTerm);
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Select Product from Price List" maxWidth="max-w-3xl">
      <div className="space-y-4">
        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search product name, specification, item code..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors shadow-xs"
          >
            Search
          </button>
        </form>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Results List */}
        <div className="border border-slate-200 rounded-md divide-y divide-slate-100 max-h-96 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-slate-500 text-sm">Searching price list products...</div>
          ) : products.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              No matching products found in the active price list. Try a different search term.
            </div>
          ) : (
            products.map((p) => (
              <div
                key={p.id}
                onClick={() => {
                  onSelectProduct(p);
                  onClose();
                }}
                className="p-3 hover:bg-blue-50/50 cursor-pointer transition-colors flex items-center justify-between group"
              >
                <div className="space-y-0.5 max-w-[70%]">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                      {p.item_code || 'NO-CODE'}
                    </span>
                    <span className="text-sm font-medium text-slate-900 group-hover:text-blue-600">
                      {p.product_name}
                    </span>
                    {p.category && <Badge variant="default">{p.category}</Badge>}
                  </div>
                  {p.specification && (
                    <p className="text-xs text-slate-500">{p.specification}</p>
                  )}
                  <p className="text-xs text-slate-400">
                    Unit: <span className="font-medium text-slate-600">{p.unit || 'Nos'}</span> | GST: {p.gst_rate}%
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-slate-900">
                    {p.sales_rate ? formatINR(p.sales_rate) : <span className="text-rose-600 text-xs">No Price</span>}
                  </div>
                  <div className="text-xs text-slate-400">
                    {p.is_tax_inclusive ? '(incl. tax)' : '(plus tax)'}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}
