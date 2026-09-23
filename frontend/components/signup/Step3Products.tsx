'use client';

import React, { useState } from 'react';
import { Upload, Edit3, ArrowLeft, Loader2, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react';
import CSVUploadZone, { ProductItem } from './CSVUploadZone';
import ProductManualEntry from './ProductManualEntry';

interface Step3Props {
  products: ProductItem[];
  onChange: (products: ProductItem[]) => void;
  onSubmit: () => void;
  onBack: () => void;
  isSubmitting: boolean;
  submitError: string | null;
}

export default function Step3Products({
  products,
  onChange,
  onSubmit,
  onBack,
  isSubmitting,
  submitError,
}: Step3Props) {
  const [tab, setTab] = useState<'csv' | 'manual'>('csv');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleAddProduct = (newProduct: ProductItem) => {
    onChange([...products, newProduct]);
    setValidationError(null);
  };

  const handleRemoveProduct = (index: number) => {
    onChange(products.filter((_, i) => i !== index));
  };

  const handleBatchProducts = (newProducts: ProductItem[]) => {
    onChange([...products, ...newProducts]);
    setValidationError(null);
  };

  const handleCSVLoaded = (csvProducts: ProductItem[]) => {
    onChange(csvProducts);
    setValidationError(null);
  };

  const validateAndSubmit = () => {
    setValidationError(null);

    if (products.length < 3) {
      setValidationError('❌ Minimum 3 products required to launch your WhatsApp bot catalog.');
      return;
    }

    const invalidPrice = products.some((p) => p.price <= 0 || isNaN(p.price));
    if (invalidPrice) {
      setValidationError('❌ All products must have a valid price greater than 0.');
      return;
    }

    const hasInStock = products.some((p) => p.stock > 0);
    if (!hasInStock) {
      setValidationError('❌ At least one product must have stock greater than 0.');
      return;
    }

    onSubmit();
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">Upload Product Catalog</h2>
          <span className="text-xs font-semibold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-full">
            {products.length} / 3 min products
          </span>
        </div>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Add the products your WhatsApp AI bot will sell to shoppers. You can upload a CSV spreadsheet or enter items manually.
        </p>
      </div>

      {/* Tabs Switcher: CSV vs Manual */}
      <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
        <button
          type="button"
          onClick={() => setTab('csv')}
          className={`flex-1 py-2.5 rounded-lg flex items-center justify-center gap-2 transition ${
            tab === 'csv'
              ? 'bg-white text-emerald-700 shadow-xs'
              : 'hover:text-slate-900 text-slate-600'
          }`}
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Upload CSV Spreadsheet</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('manual')}
          className={`flex-1 py-2.5 rounded-lg flex items-center justify-center gap-2 transition ${
            tab === 'manual'
              ? 'bg-white text-emerald-700 shadow-xs'
              : 'hover:text-slate-900 text-slate-600'
          }`}
        >
          <Edit3 className="w-3.5 h-3.5" />
          <span>Manual Entry Form</span>
        </button>
      </div>

      {/* Tab Contents */}
      {tab === 'csv' ? (
        <div className="space-y-4">
          <CSVUploadZone onProductsLoaded={handleCSVLoaded} currentCount={products.length} />

          {/* If products exist, show summary preview */}
          {products.length > 0 && (
            <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">
                  Ready to Launch: {products.length} Products Loaded
                </span>
                <span className="text-emerald-600 flex items-center gap-1 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Synchronized
                </span>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {products.map((p, i) => (
                  <div key={i} className="flex justify-between items-center py-1.5 border-b border-slate-100 last:border-0">
                    <span className="font-medium text-slate-800 truncate max-w-[200px]">{p.name}</span>
                    <span className="font-bold text-slate-900">₦{p.price.toLocaleString()} ({p.stock} units)</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <ProductManualEntry
          products={products}
          onAddProduct={handleAddProduct}
          onRemoveProduct={handleRemoveProduct}
          onAddBatch={handleBatchProducts}
        />
      )}

      {/* Validation or API Errors */}
      {validationError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2" role="alert">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {submitError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2" role="alert">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-3 pt-4">
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className="px-5 h-12 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 font-semibold text-sm transition flex items-center justify-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <button
          type="button"
          onClick={validateAndSubmit}
          disabled={isSubmitting}
          className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-bold text-sm sm:text-base rounded-xl shadow-md transition flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Launching Your Storefront...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              <span>Submit &amp; Launch Bot 🚀</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
