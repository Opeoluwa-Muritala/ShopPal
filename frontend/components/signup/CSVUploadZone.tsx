'use client';

import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, Download, CheckCircle2, AlertCircle, X } from 'lucide-react';

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
      setError('❌ CSV is empty or missing headers.');
      return;
    }

    // Parse header row
    const headers = lines[0]
      .split(',')
      .map((h) => h.trim().toLowerCase().replace(/^["']|["']$/g, ''));

    const nameIdx = headers.findIndex((h) => h === 'product name' || h === 'name' || h === 'title');
    const priceIdx = headers.findIndex((h) => h === 'price' || h === 'price in ngn' || h === 'amount');
    const stockIdx = headers.findIndex((h) => h === 'stock' || h === 'quantity' || h === 'qty');
    const imageIdx = headers.findIndex((h) => h === 'image url' || h === 'image_url' || h === 'image');
    const descIdx = headers.findIndex((h) => h === 'description' || h === 'desc');

    if (nameIdx === -1 || priceIdx === -1 || stockIdx === -1) {
      setError('❌ CSV headers invalid. Check the template.');
      return;
    }

    const parsedProducts: ProductItem[] = [];

    for (let i = 1; i < lines.length; i++) {
      // Split taking basic commas into account
      const rawCols = lines[i].split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
      if (rawCols.length < 3) continue;

      const name = rawCols[nameIdx] || '';
      const price = parseFloat(rawCols[priceIdx]);
      const stock = parseInt(rawCols[stockIdx], 10);
      const image_url = imageIdx !== -1 && rawCols[imageIdx] ? rawCols[imageIdx] : 'https://images.unsplash.com/photo-1542291026-7eec264c27ff';
      const description = descIdx !== -1 && rawCols[descIdx] ? rawCols[descIdx] : '';

      if (name && !isNaN(price) && price > 0 && !isNaN(stock) && stock >= 0) {
        parsedProducts.push({
          name,
          price,
          stock,
          image_url,
          description,
        });
      }
    }

    if (parsedProducts.length < 3) {
      setError('❌ Minimum 3 products required');
      return;
    }

    onProductsLoaded(parsedProducts);
    setSuccessMsg(`✅ CSV processed! ${parsedProducts.length} products added`);
  };

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setError('❌ Please upload a valid .csv file only');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('❌ File size exceeds 5MB limit');
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        parseCSV(content);
      }
    };
    reader.onerror = () => {
      setError('❌ Failed to read CSV file');
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-xs">
        <div>
          <span className="font-bold text-emerald-900 block">Need a quick spreadsheet template?</span>
          <span className="text-emerald-700">Headers: Product Name, Price, Stock, Image URL, Description</span>
        </div>
        <button
          type="button"
          onClick={downloadSampleCSV}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-emerald-300 text-emerald-800 font-semibold rounded-lg hover:bg-emerald-100/60 transition shadow-2xs self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download Sample CSV</span>
        </button>
      </div>

      {/* Drag & Drop Upload Zone */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all duration-200 ${
          dragActive
            ? 'border-emerald-500 bg-emerald-50/60 scale-[1.01]'
            : 'border-slate-300 hover:border-emerald-500 bg-slate-50/50 hover:bg-emerald-50/20'
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

        <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center mb-3 shadow-2xs">
          <UploadCloud className="w-6 h-6" />
        </div>

        <h4 className="text-sm font-bold text-slate-900 mb-1">
          {fileName ? fileName : 'Click to upload or drag & drop CSV here'}
        </h4>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          CSV files only (max 5MB). At least 3 products required to launch your WhatsApp bot.
        </p>

        {fileName && (
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 shadow-2xs">
            <FileText className="w-3.5 h-3.5 text-emerald-600" />
            <span>{fileName}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                clearFile();
              }}
              className="text-slate-400 hover:text-red-500 transition ml-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2 animate-fadeIn" role="alert">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Success toast */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
    </div>
  );
}
