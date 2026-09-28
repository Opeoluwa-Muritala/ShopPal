'use client';

import React, { useState, useRef } from 'react';
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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sampleProducts: ProductItem[] = [
    {
      name: 'Leather Boots',
      price: 24000,
      stock: 6,
      image_url: 'https://images.unsplash.com/photo-1638247025967-b4e38f787b76',
      description: 'Handcrafted leather boots size 40-45',
    },
    {
      name: 'Cotton Dress',
      price: 18500,
      stock: 8,
      image_url: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1',
      description: 'Cotton print dress',
    },
    {
      name: 'Two-Piece Suit',
      price: 35000,
      stock: 4,
      image_url: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35',
      description: 'Formal attire',
    },
  ];

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (JPG, PNG, WEBP, etc.)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    setImageFile(file);
    setError(null);
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Product name is required.');
      return;
    }

    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice <= 0) {
      setError('Price must be greater than 0.');
      return;
    }

    const numStock = parseInt(stock, 10);
    if (isNaN(numStock) || numStock < 0) {
      setError('Stock cannot be negative.');
      return;
    }

    onAddProduct({
      name: name.trim(),
      price: numPrice,
      stock: numStock,
      image_url:
        imagePreview || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30',
      description: description.trim(),
    });

    setName('');
    setPrice('');
    setStock('5');
    setImageFile(null);
    setImagePreview('');
    setDescription('');
    setIsOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded transition"
        >
          + Add Single Product
        </button>

        {products.length === 0 && (
          <button
            type="button"
            onClick={() => onAddBatch(sampleProducts)}
            className="py-1.5 px-3 border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-medium rounded transition"
          >
            Quick: Add 3 Sample Nigerian Products
          </button>
        )}

      </div>

      {isOpen && (
        <form onSubmit={handleAdd} className="p-4 bg-white border border-slate-300 rounded text-xs space-y-3" noValidate>
          <div className="flex justify-between items-center border-b border-slate-200 pb-2">
            <span className="font-bold text-slate-900 text-sm">Add Catalog Item</span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-500 hover:text-slate-900 font-bold"
            >
              Cancel
            </button>
          </div>

          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700 font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-900 mb-1">
                Product Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Blue Sneakers"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-900 mb-1">
                Price (₦) <span className="text-red-600">*</span>
              </label>
              <input
                type="number"
                placeholder="15000"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-900 mb-1">
                Stock Quantity <span className="text-red-600">*</span>
              </label>
              <input
                type="number"
                placeholder="5"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-900 mb-1">
                Product Image (optional)
              </label>
              <div
                className="relative flex flex-col items-center justify-center gap-1 w-full border-2 border-dashed border-slate-300 rounded cursor-pointer hover:border-slate-500 hover:bg-slate-50 transition-colors"
                style={{ minHeight: '72px' }}
                onClick={() => fileInputRef.current?.click()}
              >
                {imagePreview ? (
                  <div className="flex items-center gap-3 px-3 py-2 w-full">
                    <img
                      src={imagePreview}
                      alt="preview"
                      className="w-12 h-12 object-cover rounded border border-slate-200 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-800 truncate">{imageFile?.name}</p>
                      <p className="text-[11px] text-slate-500">
                        {imageFile ? (imageFile.size / 1024).toFixed(0) : 0} KB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setImageFile(null);
                        setImagePreview('');
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="text-slate-400 hover:text-red-600 font-bold text-lg leading-none flex-shrink-0"
                      aria-label="Remove image"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-3 px-2 text-center pointer-events-none select-none">
                    <svg className="w-6 h-6 text-slate-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    <span className="text-[11px] text-slate-500">
                      <span className="font-semibold text-slate-700">Click to upload</span> or drag an image
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5">JPG, PNG, WEBP · max 5 MB</span>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleImageChange}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-900 mb-1">
              Description (optional)
            </label>
            <input
              type="text"
              placeholder="Product details, sizes, colors"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1.5 border border-slate-300 rounded text-slate-700 hover:bg-slate-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-slate-900 text-white font-semibold rounded hover:bg-slate-800"
            >
              Save Product
            </button>
          </div>
        </form>
      )}

      {/* Added Products Count Indicator */}
      <div className="flex items-center justify-between text-xs text-slate-700">
        <span>Current Catalog: <strong>{products.length} product(s)</strong></span>
      </div>

      {/* Products Mini Cards List */}
      {products.length > 0 && (
        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
          {products.map((p, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2 bg-white border border-slate-200 rounded text-xs"
            >
              <div>
                <span className="font-semibold text-slate-900 block">{p.name}</span>
                <span className="text-[11px] text-slate-500 font-mono">
                  ₦{p.price.toLocaleString()} · {p.stock} units
                </span>
              </div>
              <button
                type="button"
                onClick={() => onRemoveProduct(idx)}
                className="text-slate-500 hover:text-red-700 font-semibold px-2 py-1"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
