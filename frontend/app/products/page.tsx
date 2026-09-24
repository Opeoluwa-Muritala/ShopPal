'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Package,
  Plus,
  Upload,
  Search,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
  FileText,
  DollarSign,
  Layers,
  ArrowUpDown,
  Download,
} from 'lucide-react';
import { productsApi } from '../../lib/api';
import { formatNaira } from '../../lib/utils';

export interface ProductItem {
  id: string;
  name: string;
  price: number;
  stock: number;
  image_url: string;
  description?: string;
  status?: string;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');

  // Add Product modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState('');
  const [addPrice, setAddPrice] = useState('');
  const [addStock, setAddStock] = useState('10');
  const [addImageUrl, setAddImageUrl] = useState('');
  const [addDescription, setAddDescription] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // CSV Upload modal state
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isUploadingCsv, setIsUploadingCsv] = useState(false);
  const [csvResult, setCsvResult] = useState<string | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);

  // Toast notification
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      const res = await productsApi.list();
      if (res.data && Array.isArray(res.data.products)) {
        const mapped: ProductItem[] = res.data.products.map((p) => ({
          id: p.id || `prod_${Math.random()}`,
          name: p.name,
          price: typeof p.price === 'string' ? parseFloat(p.price) : Number(p.price) || 0,
          stock: Number(p.stock) || 0,
          image_url: p.image_url || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30',
          description: p.description || '',
          status: p.status || (Number(p.stock) > 0 ? 'active' : 'out_of_stock'),
        }));
        setProducts(mapped);
        setIsBackendConnected(true);
      } else {
        setProducts([]);
        setIsBackendConnected(Boolean(res.data));
      }
    } catch {
      setProducts([]);
      setIsBackendConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchesSearch) return false;

      if (stockFilter === 'in_stock') return p.stock > 5;
      if (stockFilter === 'low_stock') return p.stock > 0 && p.stock <= 5;
      if (stockFilter === 'out_of_stock') return p.stock === 0;
      return true;
    });
  }, [products, searchTerm, stockFilter]);

  // Aggregate metrics
  const totalStockUnits = useMemo(() => products.reduce((acc, p) => acc + p.stock, 0), [products]);
  const totalCatalogValue = useMemo(
    () => products.reduce((acc, p) => acc + p.price * p.stock, 0),
    [products]
  );
  const lowStockCount = useMemo(
    () => products.filter((p) => p.stock > 0 && p.stock <= 5).length,
    [products]
  );
  const outOfStockCount = useMemo(() => products.filter((p) => p.stock === 0).length, [products]);

  // Handle Add Product Submit
  const handleAddProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim() || !addPrice) {
      setAddError('Product name and price are required.');
      return;
    }
    const numericPrice = parseFloat(addPrice.replace(/[^\d.]/g, ''));
    const numericStock = parseInt(addStock, 10) || 0;
    if (isNaN(numericPrice) || numericPrice < 0) {
      setAddError('Please enter a valid price.');
      return;
    }

    setIsAdding(true);
    setAddError(null);

    const defaultImg =
      addImageUrl.trim() ||
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&auto=format&fit=crop&q=80';

    try {
      const res = await productsApi.create({
        name: addName.trim(),
        price: numericPrice,
        stock: numericStock,
        image_url: defaultImg,
        description: addDescription.trim() || undefined,
      });

      if (res.data?.id || res.status === 200 || res.status === 201) {
        showNotification(`✅ Product "${addName.trim()}" added to catalog!`);
        setShowAddModal(false);
        setAddName('');
        setAddPrice('');
        setAddStock('10');
        setAddImageUrl('');
        setAddDescription('');
        await loadProducts();
      } else {
        setAddError(res.error || 'Failed to create product on backend.');
      }
    } catch (err: any) {
      setAddError(err?.message || 'Failed to create product on backend.');
    } finally {
      setIsAdding(false);
    }
  };

  // Handle CSV Upload Submit
  const handleCsvUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile) {
      setCsvError('Please select a CSV file to upload.');
      return;
    }
    if (csvFile.size > 1024 * 1024) {
      setCsvError('File exceeds 1MB limit. Please upload a smaller file.');
      return;
    }

    setIsUploadingCsv(true);
    setCsvError(null);
    setCsvResult(null);

    try {
      const res = await productsApi.uploadCsv(csvFile);
      if (res.data?.products_created !== undefined) {
        setCsvResult(
          `✅ Successfully parsed CSV! ${res.data.products_created} products imported into WhatsApp storefront.`
        );
        showNotification(`Imported ${res.data.products_created} products successfully.`);
        await loadProducts();
        setTimeout(() => {
          setShowCsvModal(false);
          setCsvFile(null);
          setCsvResult(null);
        }, 1800);
      } else {
        setCsvError(res.error || 'Failed to import CSV. Check file format.');
      }
    } catch (err: any) {
      setCsvError(err?.message || 'Error uploading CSV. Check column headers.');
    } finally {
      setIsUploadingCsv(false);
    }
  };

  const handleDownloadSampleCsv = () => {
    const csvContent =
      'name,price,stock,image_url,description\n' +
      'Chelsea Leather Boots,24000,18,https://images.unsplash.com/photo-1549298916-b41d501d3772,Brown leather boots\n' +
      'Ankara Maxi Gown,18500,12,https://images.unsplash.com/photo-1572804013309-59a88b7e92f1,100% cotton print dress\n' +
      'Senator Navy Suit,35000,4,https://images.unsplash.com/photo-1594938298603-c8148c4dae35,2-piece tailored senator\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'sample_naija_products.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 p-4 rounded-xl shadow-lg border text-sm font-semibold flex items-center gap-2 ${
            toast.type === 'success'
              ? 'bg-emerald-900 text-white border-emerald-800'
              : 'bg-rose-900 text-white border-rose-800'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Product Catalog
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                isBackendConnected
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isBackendConnected ? 'bg-emerald-500' : 'bg-slate-400'
                }`}
              />
              {isBackendConnected ? 'Live API (v0.6.0)' : 'Catalog (Offline / Empty)'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manage inventory and pricing available to Nigerian customers via your automated WhatsApp bot.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowCsvModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white border border-slate-300 hover:border-slate-400 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-bold rounded-xl transition shadow-xs"
          >
            <Upload className="w-4 h-4 text-slate-500" />
            <span>Upload CSV</span>
          </button>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white text-xs sm:text-sm font-bold rounded-xl transition shadow-sm shadow-emerald-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Product</span>
          </button>
        </div>
      </div>

      {/* 4 Metric Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 block mb-1">Total Products</span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl sm:text-2xl font-black text-slate-900">{products.length}</span>
            <Package className="w-4 h-4 text-emerald-600" />
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Live in WhatsApp store</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 block mb-1">Stock Units</span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl sm:text-2xl font-black text-slate-900">{totalStockUnits}</span>
            <Layers className="w-4 h-4 text-emerald-600" />
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Available inventory</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 block mb-1">Catalog Value</span>
          <div className="flex items-baseline justify-between">
            <span className="text-lg sm:text-xl font-black text-slate-900">
              {formatNaira(totalCatalogValue)}
            </span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Estimated retail value</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 block mb-1">Stock Alerts</span>
          <div className="flex items-baseline justify-between">
            <span
              className={`text-xl sm:text-2xl font-black ${
                lowStockCount + outOfStockCount > 0 ? 'text-amber-600' : 'text-slate-900'
              }`}
            >
              {lowStockCount + outOfStockCount}
            </span>
            <AlertCircle
              className={`w-4 h-4 ${
                lowStockCount + outOfStockCount > 0 ? 'text-amber-600' : 'text-slate-400'
              }`}
            />
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {outOfStockCount} out of stock • {lowStockCount} low
          </span>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 border border-slate-200 rounded-2xl shadow-xs">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Search products by name or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Stock Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(
            [
              { id: 'all', label: 'All Items' },
              { id: 'in_stock', label: 'In Stock (>5)' },
              { id: 'low_stock', label: 'Low Stock (≤5)' },
              { id: 'out_of_stock', label: 'Out of Stock' },
            ] as const
          ).map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setStockFilter(filter.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                stockFilter === filter.id
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Product</th>
                <th className="py-3 px-4">Price (NGN)</th>
                <th className="py-3 px-4">Stock Level</th>
                <th className="py-3 px-4">WhatsApp Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700">
                      {products.length === 0 ? 'No products in catalog yet' : 'No products match your criteria'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {products.length === 0
                        ? 'Add a single product or upload a CSV file to start building your WhatsApp inventory.'
                        : 'Try clearing your search query or adjusting your filters.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const isOutOfStock = p.stock === 0;
                  const isLowStock = p.stock > 0 && p.stock <= 5;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={p.image_url}
                            alt={p.name}
                            className="w-11 h-11 rounded-xl object-cover bg-slate-100 border border-slate-200 shrink-0"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=100&auto=format&fit=crop&q=80';
                            }}
                          />
                          <div>
                            <p className="font-bold text-slate-900">{p.name}</p>
                            {p.description && (
                              <p className="text-xs text-slate-500 line-clamp-1 max-w-sm">
                                {p.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {formatNaira(p.price)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            isOutOfStock
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : isLowStock
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isOutOfStock
                                ? 'bg-rose-500'
                                : isLowStock
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                          />
                          {p.stock} units
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700">
                          {isOutOfStock ? (
                            <span className="text-rose-600">Hidden (Out of stock)</span>
                          ) : (
                            <span className="text-emerald-700">Active on Bot</span>
                          )}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            // Quick adjust demo
                            setProducts((prev) =>
                              prev.map((item) =>
                                item.id === p.id ? { ...item, stock: item.stock + 5 } : item
                              )
                            );
                            showNotification(`Updated stock for ${p.name} (+5 units)`);
                          }}
                          className="text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg transition"
                        >
                          +5 Stock
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Product Modal */}
      {showAddModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 relative">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Add New Product</h3>
                <p className="text-xs text-slate-500">
                  Product will be searchable by customers on WhatsApp (`POST /api/products`).
                </p>
              </div>
            </div>

            {addError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{addError}</span>
              </div>
            )}

            <form onSubmit={handleAddProductSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Product Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ankara Floral Wrap Dress"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Price (NGN) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="18500"
                    value={addPrice}
                    onChange={(e) => setAddPrice(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Available Stock <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="10"
                    value={addStock}
                    onChange={(e) => setAddStock(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Image URL <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={addImageUrl}
                  onChange={(e) => setAddImageUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Description <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Brief details or sizing notes for customer queries..."
                  value={addDescription}
                  onChange={(e) => setAddDescription(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={isAdding}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAdding}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition"
                >
                  {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Save Product</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload CSV Modal */}
      {showCsvModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative">
            <button
              type="button"
              onClick={() => {
                setShowCsvModal(false);
                setCsvError(null);
                setCsvResult(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Bulk Product Upload</h3>
                <p className="text-xs text-slate-500">
                  Import products via CSV (`POST /api/products/upload-csv`).
                </p>
              </div>
            </div>

            {csvResult && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{csvResult}</span>
              </div>
            )}

            {csvError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{csvError}</span>
              </div>
            )}

            <form onSubmit={handleCsvUploadSubmit} className="space-y-4">
              {/* Dropzone / File Picker */}
              <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-6 text-center transition bg-slate-50/50">
                <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <label className="cursor-pointer block">
                  <span className="text-xs font-bold text-emerald-700 hover:underline">
                    {csvFile ? csvFile.name : 'Click to select CSV file'}
                  </span>
                  <span className="block text-[11px] text-slate-400 mt-1">
                    UTF-8 encoded CSV (&lt; 1MB)
                  </span>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setCsvFile(e.target.files[0]);
                        setCsvError(null);
                      }
                    }}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Sample Template Download */}
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                <span className="text-slate-600 font-medium">Need sample format?</span>
                <button
                  type="button"
                  onClick={handleDownloadSampleCsv}
                  className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:underline"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Sample CSV</span>
                </button>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCsvModal(false)}
                  disabled={isUploadingCsv}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploadingCsv || !csvFile}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition"
                >
                  {isUploadingCsv ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>Upload &amp; Import</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
