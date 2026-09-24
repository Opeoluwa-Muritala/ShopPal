'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
        showNotification(`Product "${addName.trim()}" added to catalog.`);
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
          `Successfully imported ${res.data.products_created} products into WhatsApp storefront.`
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
    link.setAttribute('download', 'sample_shoppal_products.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-5 right-5 z-50 p-4 rounded border text-xs font-semibold ${
            toast.type === 'success'
              ? 'bg-slate-900 text-white border-slate-800'
              : 'bg-red-900 text-white border-red-800'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Product Catalog
            </h1>
            <span
              className={`px-2.5 py-0.5 rounded text-xs font-semibold border ${
                isBackendConnected
                  ? 'bg-slate-100 text-slate-800 border-slate-300'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}
            >
              {isBackendConnected ? 'Backend Connected' : 'Catalog Ready'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage inventory and pricing available to WhatsApp customers in real time.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowCsvModal(true)}
            className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded transition"
          >
            Upload CSV
          </button>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded shadow-sm transition"
          >
            + Add Product
          </button>

        </div>
      </div>

      {/* 4 Minimal Metric Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <span className="text-xs font-medium text-slate-500 block mb-1">Total Products</span>
          <span className="text-2xl font-bold text-slate-900">{products.length}</span>
          <span className="text-[11px] text-slate-400 mt-1 block">Live in WhatsApp store</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <span className="text-xs font-medium text-slate-500 block mb-1">Stock Units</span>
          <span className="text-2xl font-bold text-slate-900">{totalStockUnits}</span>
          <span className="text-[11px] text-slate-400 mt-1 block">Available inventory</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <span className="text-xs font-medium text-slate-500 block mb-1">Catalog Value</span>
          <span className="text-xl font-bold text-slate-900">{formatNaira(totalCatalogValue)}</span>
          <span className="text-[11px] text-slate-400 mt-1 block">Retail inventory sum</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <span className="text-xs font-medium text-slate-500 block mb-1">Low / Out of Stock</span>
          <span className="text-2xl font-bold text-slate-900">{lowStockCount + outOfStockCount}</span>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {outOfStockCount} out of stock • {lowStockCount} low
          </span>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 border border-slate-200 rounded-lg">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search products by name or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-900 focus:outline-none focus:border-slate-900"
          />
        </div>

        {/* Stock Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
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
              className={`px-3 py-1.5 rounded text-xs font-medium transition shrink-0 ${
                stockFilter === filter.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">Product</th>
                <th className="py-3 px-4">Price</th>
                <th className="py-3 px-4">Stock</th>
                <th className="py-3 px-4">Storefront Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500">
                    Loading products...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500">
                    <p className="font-semibold text-slate-800">
                      {products.length === 0 ? 'No products in catalog yet' : 'No products match your search'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {products.length === 0
                        ? 'Add a single product or upload a CSV to build your WhatsApp inventory.'
                        : 'Try searching with a different keyword.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const isOutOfStock = p.stock === 0;
                  const isLowStock = p.stock > 0 && p.stock <= 5;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-bold text-slate-900">{p.name}</p>
                          {p.description && (
                            <p className="text-slate-500 line-clamp-1 max-w-sm">
                              {p.description}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {formatNaira(p.price)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold border ${
                            isOutOfStock
                              ? 'bg-red-50 text-red-800 border-red-200'
                              : isLowStock
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          }`}
                        >
                          {p.stock} units
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-slate-700 font-medium">
                          {isOutOfStock ? 'Hidden (Out of stock)' : 'Active on Bot'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setProducts((prev) =>
                              prev.map((item) =>
                                item.id === p.id ? { ...item, stock: item.stock + 5 } : item
                              )
                            );
                            showNotification(`Updated stock for ${p.name} (+5 units)`);
                          }}
                          className="text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 px-2.5 py-1 rounded transition"
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
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-lg max-w-lg w-full p-6 border border-slate-200 relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Add New Product</h3>
                <p className="text-xs text-slate-500">
                  Product will be visible on WhatsApp storefront immediately.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-xs text-slate-500 hover:text-slate-800 p-1 border border-slate-200 rounded"
              >
                Close
              </button>
            </div>

            {addError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-800 text-xs font-medium">
                {addError}
              </div>
            )}

            <form onSubmit={handleAddProductSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Product Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Wrap Dress"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Price (NGN) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="18500"
                    value={addPrice}
                    onChange={(e) => setAddPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Available Stock <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="10"
                    value={addStock}
                    onChange={(e) => setAddStock(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-slate-900 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Image URL <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={addImageUrl}
                  onChange={(e) => setAddImageUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Product details or sizing notes..."
                  value={addDescription}
                  onChange={(e) => setAddDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={isAdding}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAdding}
                  className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold rounded transition"
                >
                  {isAdding ? 'Saving...' : 'Save Product'}
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
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-lg max-w-md w-full p-6 border border-slate-200 relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Bulk Product Upload</h3>
                <p className="text-xs text-slate-500">
                  Import products using CSV file
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCsvModal(false);
                  setCsvError(null);
                  setCsvResult(null);
                }}
                className="text-xs text-slate-500 hover:text-slate-800 p-1 border border-slate-200 rounded"
              >
                Close
              </button>
            </div>

            {csvResult && (
              <div className="mb-4 p-3 bg-slate-100 border border-slate-300 rounded text-slate-800 text-xs font-medium">
                {csvResult}
              </div>
            )}

            {csvError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-800 text-xs font-medium">
                {csvError}
              </div>
            )}

            <form onSubmit={handleCsvUploadSubmit} className="space-y-4">
              <div className="border border-slate-300 rounded p-6 text-center bg-slate-50">
                <label className="cursor-pointer block">
                  <span className="text-xs font-semibold text-slate-900 underline block">
                    {csvFile ? csvFile.name : 'Select CSV file'}
                  </span>
                  <span className="block text-[11px] text-slate-500 mt-1">
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

              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded text-xs">
                <span className="text-slate-600">Sample CSV format:</span>
                <button
                  type="button"
                  onClick={handleDownloadSampleCsv}
                  className="font-semibold text-slate-900 underline"
                >
                  Download Sample CSV
                </button>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCsvModal(false)}
                  disabled={isUploadingCsv}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploadingCsv || !csvFile}
                  className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold rounded transition"
                >
                  {isUploadingCsv ? 'Uploading...' : 'Upload & Import'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
