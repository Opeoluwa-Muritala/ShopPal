'use client';

import React, { useState } from 'react';
import { Plus, Trash2, Sparkles, AlertCircle } from 'lucide-react';
import { ProductItem } from './CSVUploadZone';

interface ProductManualEntryProps {
  products: ProductItem[];
  onAddProduct: (product: ProductItem) => void;
  onRemoveProduct: (index: number) => void;
  onAddBatch: (products: ProductItem[]) => void;
}

export default function ProductManualEntry({
  products,
  onAddProduct,
  onRemoveProduct,
  onAddBatch,
}: ProductManualEntryProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('5');
  const [imageUrl, setImageUrl] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const sampleProducts: ProductItem[] = [
    {
      name: 'Black Chelsea Leather Boots',
      price: 24000,
      stock: 6,
      image_url: 'https://images.unsplash.com/photo-1638247025967-b4e38f787b76',
      description: 'Handcrafted genuine leather boots size 40-45',
    },
    {
      name: 'Ankara Premium Maxi Dress',
      price: 18500,
      stock: 8,
      image_url: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1',
      description: 'Vibrant 100% cotton wax print dress',
    },
    {
      name: 'Senator Navy Two-Piece Suit',
      price: 35000,
      stock: 4,
      image_url: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35',
      description: 'Bespoke Nigerian native formal attire',
    },
  ];

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Product name is required.');
      return;
    }

    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice <= 0) {
      setError('Price must be a valid number greater than 0.');
      return;
    }

    const numStock = parseInt(stock, 10);
    if (isNaN(numStock) || numStock < 0) {
      setError('Stock cannot be negative.');
      return;
    }

    const finalImage = imageUrl.trim() || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff';

    onAddProduct({
      name: name.trim(),
      price: numPrice,
      stock: numStock,
      image_url: finalImage,
      description: description.trim(),
    });

    setName('');
    setPrice('');
    setStock('5');
    setImageUrl('');
    setDescription('');
    setIsOpen(false);
  };

  const handleLoadSamples = () => {
    onAddBatch(sampleProducts);
  };

  return (
    <div className="space-y-4">
      {/* Action buttons bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition"
        >
          <Plus className="w-4 h-4" />
          <span>{isOpen ? 'Close Form' : '+ Add Single Product'}</span>
        </button>

        <button
          type="button"
          onClick={handleLoadSamples}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 border border-emerald-300 text-emerald-800 hover:bg-emerald-100 font-semibold text-xs rounded-xl transition"
        >
          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
          <span>Quick: Add 3 Sample Nigerian Products</span>
        </button>
      </div>

      {/* Manual Add Product Form Card */}
      {isOpen && (
        <form onSubmit={handleAdd} className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4 text-xs animate-fadeIn">
          <h4 className="font-bold text-slate-900 text-sm">Add New Product Details</h4>

          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Product Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Blue Sneakers"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Price in NGN (₦) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                placeholder="15000"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Stock Quantity <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                placeholder="5"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Image URL (optional)
              </label>
              <input
                type="url"
                placeholder="https://example.com/image.jpg"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Description (optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Sizes 40-44, pure leather, comfortable everyday fit"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 shadow-2xs"
            >
              Save Product
            </button>
          </div>
        </form>
      )}

      {/* Added Products Count Indicator */}
      <div className="flex items-center justify-between text-xs text-slate-600">
        <span>Current Catalog: <strong>{products.length} product(s)</strong></span>
        <span className={products.length >= 3 ? 'text-emerald-700 font-semibold' : 'text-amber-700'}>
          {products.length >= 3 ? '✓ Minimum requirement met' : `${3 - products.length} more required (minimum 3)`}
        </span>
      </div>

      {/* Products Mini Cards List */}
      {products.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {products.map((p, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-xl text-xs hover:border-emerald-300 transition"
            >
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[10px]">
                  #{idx + 1}
                </span>
                <div>
                  <span className="font-bold text-slate-900 block">{p.name}</span>
                  <span className="text-[11px] text-slate-500">
                    ₦{p.price.toLocaleString()} • {p.stock} units in stock
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onRemoveProduct(idx)}
                className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition"
                title="Remove product"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
