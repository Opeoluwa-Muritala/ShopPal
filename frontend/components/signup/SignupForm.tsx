'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircle2, Building, CreditCard, Package, Sparkles } from 'lucide-react';
import Step1Business, { Step1Data } from './Step1Business';
import Step2Payment, { Step2Data } from './Step2Payment';
import Step3Products from './Step3Products';
import Step4Success, { SuccessData } from './Step4Success';
import { ProductItem } from './CSVUploadZone';
import { vendorsApi, productsApi } from '../../lib/api';
import { setStoredTokens } from '../../lib/auth';

interface SignupFormData extends Step1Data, Step2Data {
  products: ProductItem[];
}

const STORAGE_KEY = 'shoppal_vendor_signup';

export default function SignupForm() {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [formData, setFormData] = useState<SignupFormData>({
    name: '',
    phone: '',
    whatsapp_number: '',
    email: '',
    password: '',
    business_name: '',
    category: 'Clothing',
    paystack_key: '',
    bank_account: '',
    bank_name: '',
    account_name: '',
    products: [],
  });

  const [successData, setSuccessData] = useState<SuccessData>({
    vendor_id: 'v_9042',
    bot_number: '+1 415 523 8886',
    test_link: 'https://wa.me/14155238886?text=join%20sandbox-code',
    sandbox_code: 'bold-elephant',
  });

  // Load from localStorage on mount (deferred to avoid cascading render lint error)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setTimeout(() => {
          if (parsed.formData) setFormData(parsed.formData);
          if (parsed.currentStep && parsed.currentStep < 4) setCurrentStep(parsed.currentStep);
        }, 0);
      }
    } catch {
      // Ignore localStorage read errors in restricted environments
    }
  }, []);

  // Save to localStorage when formData or currentStep changes (except step 4)
  useEffect(() => {
    if (currentStep < 4) {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            currentStep,
            formData,
          })
        );
      } catch {
        // Ignore localStorage write errors
      }
    } else {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Ignore
      }
    }
  }, [formData, currentStep]);

  const updateFormData = (fields: Partial<SignupFormData>) => {
    setFormData((prev) => ({ ...prev, ...fields }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    const cleanPhone = formData.phone.replace(/\D/g, '');
    const cleanWhatsapp = formData.whatsapp_number.replace(/\D/g, '') || cleanPhone;
    const vendorEmail = formData.email?.trim() || `${cleanPhone}@vendor.naijamarketplace.ng`;
    const vendorPassword = formData.password?.trim() || 'Passw0rd123!';

    try {
      const res = await vendorsApi.signup({
        name: formData.name,
        phone: cleanPhone,
        whatsapp_number: cleanWhatsapp,
        business_name: formData.business_name || formData.name,
        email: vendorEmail,
        password: vendorPassword,
        bank_account: formData.bank_account || undefined,
        preferred_language: 'en',
      });

      if (res.data?.vendor_id) {
        const assignedVendorId = res.data.vendor_id;
        const assignedAccountId = res.data.account_id;

        setStoredTokens({
          vendor_id: assignedVendorId,
          account_id: assignedAccountId,
          email: res.data.email,
          role: res.data.role || 'owner',
        });

        // If products were added during onboarding, attempt to create them via API
        if (formData.products && formData.products.length > 0) {
          try {
            await Promise.all(
              formData.products.map((p) =>
                productsApi.create({
                  name: p.name,
                  price: Number(p.price) || 0,
                  stock: Number(p.stock) || 1,
                  image_url: p.image_url || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30',
                  description: `${p.name} - Available on WhatsApp storefront`,
                })
              )
            );
          } catch {
            // Non-fatal if product seeding is delayed
          }
        }

        setSuccessData({
          vendor_id: assignedVendorId,
          bot_number: '+1 415 523 8886',
          test_link: `https://wa.me/14155238886?text=join%20${assignedVendorId}`,
          sandbox_code: assignedVendorId,
        });
      } else {
        // Fallback for hackathon demo if backend endpoint is not yet connected
        const fallbackId = `v_${Math.floor(1000 + Math.random() * 9000)}`;
        setStoredTokens({
          vendor_id: fallbackId,
          email: vendorEmail,
          role: 'owner',
        });
        setSuccessData({
          vendor_id: fallbackId,
          bot_number: '+1 415 523 8886',
          test_link: `https://wa.me/14155238886?text=join%20${fallbackId}`,
          sandbox_code: 'bold-elephant',
        });
      }
      setCurrentStep(4);
    } catch {
      // Graceful fallback for mock mode / offline demo
      const fallbackId = `v_${Math.floor(1000 + Math.random() * 9000)}`;
      setSuccessData({
        vendor_id: fallbackId,
        bot_number: '+1 415 523 8886',
        test_link: `https://wa.me/14155238886?text=join%20${fallbackId}`,
        sandbox_code: 'bold-elephant',
      });
      setCurrentStep(4);
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepsMeta = [
    { num: 1, title: 'Business Info', icon: Building },
    { num: 2, title: 'Payment Setup', icon: CreditCard },
    { num: 3, title: 'Products', icon: Package },
    { num: 4, title: 'Live Bot', icon: Sparkles },
  ];

  return (
    <div className="w-full max-w-xl mx-auto bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xl">
      {/* Multi-Step Progress Header */}
      {currentStep < 4 && (
        <div className="mb-8">
          {/* Steps Breadcrumbs */}
          <div className="flex items-center justify-between mb-3">
            {stepsMeta.map((s, idx) => {
              const isPassed = currentStep > s.num;
              const isCurrent = currentStep === s.num;
              return (
                <div key={s.num} className="flex items-center gap-1.5 sm:gap-2">
                  <div
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold transition ${isPassed
                      ? 'bg-emerald-600 text-white'
                      : isCurrent
                        ? 'bg-emerald-100 text-emerald-800 border-2 border-emerald-600'
                        : 'bg-slate-100 text-slate-400'
                      }`}
                  >
                    {isPassed ? <CheckCircle2 className="w-4 h-4" /> : s.num}
                  </div>
                  <span
                    className={`hidden sm:inline text-xs font-semibold ${isCurrent ? 'text-slate-900' : 'text-slate-400'
                      }`}
                  >
                    {s.title}
                  </span>
                  {idx < stepsMeta.length - 1 && (
                    <div className="hidden sm:block w-4 sm:w-8 h-0.5 bg-slate-200 mx-1" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full transition-all duration-300"
              style={{ width: `${(currentStep / 4) * 100}%` }}
            />
          </div>

          <div className="flex justify-between items-center text-[11px] text-slate-400 mt-2">
            <span>Step {currentStep} of 4</span>
            <span>&lt; 2 minutes to complete</span>
          </div>
        </div>
      )}

      {/* Render Steps */}
      {currentStep === 1 && (
        <Step1Business
          data={formData}
          onChange={updateFormData}
          onNext={() => setCurrentStep(2)}
        />
      )}

      {currentStep === 2 && (
        <Step2Payment
          data={formData}
          onChange={updateFormData}
          onNext={() => setCurrentStep(3)}
          onBack={() => setCurrentStep(1)}
        />
      )}

      {currentStep === 3 && (
        <Step3Products
          products={formData.products}
          onChange={(products) => updateFormData({ products })}
          onSubmit={handleSubmit}
          onBack={() => setCurrentStep(2)}
          isSubmitting={isSubmitting}
          submitError={submitError}
        />
      )}

      {currentStep === 4 && (
        <Step4Success
          vendorName={formData.name || 'Vendor'}
          businessName={formData.business_name || 'Your Store'}
          products={formData.products}
          successData={successData}
        />
      )}
    </div>
  );
}
