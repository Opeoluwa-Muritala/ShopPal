'use client';

import React, { useState, useRef } from 'react';

export interface ProductItem {
  name: string;
  price: number;
  stock: number;
  image_url: string;
  description?: string;
}

interface CSVUploadZoneProps {
  onProductsLoaded: (products: ProductItem[]) => void;
  currentCount: number;
}

export default function CSVUploadZone({ onProductsLoaded }: CSVUploadZoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadSampleCSV = () => {
    const csvContent =
      'Product Name,Price,Stock,Image URL,Description\n' +
      'Blue Sneaker,15000,5,https://images.unsplash.com/photo-1542291026-7eec264c27ff,Comfortable casual shoe\n' +
      'Red Kicks,12000,3,https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77,Stylish red sneakers\n' +
      'Ankara Classic Dress,18500,8,https://images.unsplash.com/photo-1572804013309-59a88b7e92f1,Authentic Nigerian Ankara dress\n' +
      'Black Chelsea Boots,24000,4,https://images.unsplash.com/photo-1638247025967-b4e38f787b76,Handcrafted leather boots\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    if (typeof window !== 'undefined' && typeof window.URL?.createObjectURL === 'function') {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'sample_products.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const parseCSV = (text: string) => {
    setError(null);
    setSuccessMsg(null);

    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      setError('CSV is empty or missing headers.');
      return;
    }

    const header = lines[0].toLowerCase().split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));
    const nameIdx = header.findIndex((h) => h.includes('name') || h.includes('title') || h.includes('product'));
    const priceIdx = header.findIndex((h) => h.includes('price') || h.includes('amount') || h.includes('cost'));
    const stockIdx = header.findIndex((h) => h.includes('stock') || h.includes('qty') || h.includes('quantity'));
    const imgIdx = header.findIndex((h) => h.includes('image') || h.includes('photo') || h.includes('url') || h.includes('img'));
    const descIdx = header.findIndex((h) => h.includes('desc') || h.includes('detail') || h.includes('info'));

    if (nameIdx === -1 || priceIdx === -1) {
      setError('Invalid CSV headers. Required columns: Product Name, Price.');
      return;
    }

    const parsed: ProductItem[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const cols = line.split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
      if (cols.length < 2) continue;

      const name = cols[nameIdx];
      const rawPrice = cols[priceIdx]?.replace(/[₦,\s]/g, '') || '0';
      const price = parseFloat(rawPrice) || 0;
      const stock = stockIdx !== -1 ? parseInt(cols[stockIdx], 10) || 0 : 1;
      const image_url =
        imgIdx !== -1 && cols[imgIdx]
          ? cols[imgIdx]
          : 'https://images.unsplash.com/photo-1523275335684-37898b6baf30';
      const description = descIdx !== -1 ? cols[descIdx] : '';

      if (name && price > 0) {
        parsed.push({ name, price, stock, image_url, description });
      }
    }

    if (parsed.length === 0) {
      setError('Could not extract valid product rows. Check file formatting.');
      return;
    }

    onProductsLoaded(parsed);
    setSuccessMsg(`Successfully imported ${parsed.length} products from CSV.`);
  };

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setError('Please upload a valid CSV file (.csv).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('File size exceeds 5MB limit.');
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) parseCSV(content);
    };
    reader.onerror = () => {
      setError('Failed to read file. Please try again.');
    };
    reader.readAsText(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const clearFile = () => {
    setFileName(null);
    setError(null);
    setSuccessMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-4">
      {/* Template Download Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded text-xs">
        <div>
          <span className="font-semibold text-slate-900 block">Need a spreadsheet template?</span>
          <span className="text-slate-600">Columns: Product Name, Price, Stock, Image URL, Description</span>
        </div>
        <button
          type="button"
          onClick={downloadSampleCSV}
          className="px-3 py-1.5 bg-white border border-slate-300 text-slate-800 font-semibold rounded hover:bg-slate-50 transition"
        >
          Download Sample CSV
        </button>
      </div>

      {/* Drag & Drop Upload Zone */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded p-6 sm:p-8 text-center cursor-pointer transition ${
          dragActive
            ? 'border-slate-900 bg-slate-50'
            : 'border-slate-300 hover:border-slate-600 bg-white'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleInputChange}
          className="hidden"
          data-testid="csv-file-input"
        />

        <p className="text-sm font-semibold text-slate-900 mb-1">
          {fileName ? fileName : 'Click to select CSV file or drag & drop here'}
        </p>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          CSV files only (maximum 5MB).
        </p>

        {fileName && (
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-slate-100 border border-slate-200 rounded text-xs text-slate-800">
            <span>{fileName}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                clearFile();
              }}
              className="text-slate-500 hover:text-red-700 ml-1 font-bold"
            >
              Remove
            </button>
          </div>
        )}
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700 font-medium" role="alert">
          {error}
        </div>
      )}

      {/* Success toast */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 font-medium">
          {successMsg}
        </div>
      )}
    </div>
  );
}
