'use client';

import React, { useState } from 'react';
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
      setValidationError('Minimum 3 products required to test WhatsApp catalog browsing effectively.');
      return;
    }


    const invalidPrice = products.some((p) => p.price <= 0 || isNaN(p.price));
    if (invalidPrice) {
      setValidationError('All products must have a valid price greater than 0.');
      return;
    }

    const hasInStock = products.some((p) => p.stock > 0);
    if (!hasInStock) {
      setValidationError('At least one product must have stock greater than 0.');
      return;
    }

    onSubmit();
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Upload Product Catalog</h2>
          <span className="text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
            {products.length} products loaded
          </span>
        </div>
        <p className="text-xs text-slate-600 mt-1">
          Add the products your WhatsApp storefront will sell. You can upload a CSV spreadsheet or enter items manually.
        </p>
      </div>

      {/* Tabs Switcher: CSV vs Manual */}
      <div className="flex border border-slate-200 rounded text-xs font-semibold bg-slate-50 p-1">
        <button
          type="button"
          onClick={() => setTab('csv')}
          className={`flex-1 py-2 text-center rounded transition ${
            tab === 'csv'
              ? 'bg-white text-slate-900 border border-slate-200 font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Upload CSV Spreadsheet
        </button>
        <button
          type="button"
          onClick={() => setTab('manual')}
          className={`flex-1 py-2 text-center rounded transition ${
            tab === 'manual'
              ? 'bg-white text-slate-900 border border-slate-200 font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Manual Entry Form
        </button>
      </div>

      {/* Tab Contents */}
      {tab === 'csv' ? (
        <div className="space-y-4">
          <CSVUploadZone onProductsLoaded={handleCSVLoaded} currentCount={products.length} />

          {/* If products exist, show summary preview */}
          {products.length > 0 && (
            <div className="p-4 bg-white border border-slate-200 rounded text-xs space-y-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-bold text-slate-900">
                  Ready to Launch: {products.length} Products Loaded
                </span>
                <span className="text-slate-600 font-medium">Ready</span>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {products.map((p, i) => (
                  <div key={i} className="flex justify-between items-center py-1 border-b border-slate-100 last:border-0">
                    <span className="font-medium text-slate-800 truncate max-w-[200px]">{p.name}</span>
                    <span className="font-bold text-slate-900 font-mono">₦{p.price.toLocaleString()} ({p.stock} units)</span>
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
        <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700 font-medium" role="alert">
          {validationError}
        </div>
      )}

      {submitError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700 font-medium" role="alert">
          {submitError}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-3 pt-4 border-t border-slate-200">
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className="py-2.5 px-5 border border-slate-300 rounded text-slate-800 hover:bg-slate-50 font-medium text-sm transition"
        >
          Back
        </button>

        <button
          type="button"
          onClick={validateAndSubmit}
          disabled={isSubmitting}
          className="flex-1 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-semibold text-sm rounded transition"
        >
          {isSubmitting ? 'Launching Bot...' : 'Submit & Launch Bot'}
        </button>

      </div>
    </div>
  );
}
