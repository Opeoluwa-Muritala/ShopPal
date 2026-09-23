import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SignupForm from '../components/signup/SignupForm';
import Step1Business from '../components/signup/Step1Business';
import Step2Payment from '../components/signup/Step2Payment';
import Step3Products from '../components/signup/Step3Products';
import Step4Success from '../components/signup/Step4Success';
import CSVUploadZone from '../components/signup/CSVUploadZone';
import ProductManualEntry from '../components/signup/ProductManualEntry';

describe('Signup Flow Components', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Step 1: Business Information', () => {
    it('renders Step 1 form fields with auto-formatting', () => {
      const mockChange = () => {};
      const mockNext = () => {};

      render(
        <Step1Business
          data={{
            name: '',
            phone: '',
            whatsapp_number: '',
            business_name: '',
            category: 'Clothing',
          }}
          onChange={mockChange}
          onNext={mockNext}
        />
      );

      expect(screen.getByRole('heading', { name: 'Create Vendor Account' })).toBeDefined();
      expect(screen.getByLabelText(/Full Name/i)).toBeDefined();
      expect(screen.getByLabelText(/Phone Number/i)).toBeDefined();
      expect(screen.getByLabelText(/WhatsApp Number/i)).toBeDefined();
    });

    it('shows validation error when submitting empty required fields', () => {
      let nextCalled = false;
      render(
        <Step1Business
          data={{
            name: '',
            phone: '',
            whatsapp_number: '',
            business_name: '',
            category: 'Clothing',
          }}
          onChange={() => {}}
          onNext={() => {
            nextCalled = true;
          }}
        />
      );

      const submitBtn = screen.getByRole('button', { name: /Continue to Payment Setup/i });
      fireEvent.click(submitBtn);

      expect(nextCalled).toBe(false);
      expect(screen.getByText(/Full name is required/i)).toBeDefined();
    });

    it('handles phone input formatting and valid submission', () => {
      let updatedData: any = {};
      let nextCalled = false;
      render(
        <Step1Business
          data={{
            name: 'Tunde Alabi',
            phone: '0803 123 4567',
            whatsapp_number: '0803 123 4567',
            business_name: 'Tunde Stores',
            category: 'Clothing',
          }}
          onChange={(fields) => {
            updatedData = { ...updatedData, ...fields };
          }}
          onNext={() => {
            nextCalled = true;
          }}
        />
      );

      const phoneInput = screen.getByLabelText(/Phone Number/i);
      fireEvent.change(phoneInput, { target: { value: '08012345678' } });

      const waInput = screen.getByLabelText(/WhatsApp Number/i);
      fireEvent.change(waInput, { target: { value: '08098765432' } });

      const submitBtn = screen.getByRole('button', { name: /Continue to Payment Setup/i });
      fireEvent.click(submitBtn);

      expect(nextCalled).toBe(true);
    });
  });

  describe('Step 2: Payment Setup', () => {
    it('renders payment fields and allows skipping', () => {
      let nextCalled = false;
      let backCalled = false;

      render(
        <Step2Payment
          data={{
            paystack_key: '',
            bank_account: '',
            bank_name: '',
            account_name: '',
          }}
          onChange={() => {}}
          onNext={() => {
            nextCalled = true;
          }}
          onBack={() => {
            backCalled = true;
          }}
        />
      );

      expect(screen.getByText('Payment & Payout Setup')).toBeDefined();
      expect(screen.getByText(/Skip for now/i)).toBeDefined();

      const backBtn = screen.getByRole('button', { name: /Back/i });
      fireEvent.click(backBtn);
      expect(backCalled).toBe(true);

      const nextBtn = screen.getByRole('button', { name: /Continue to Product Upload/i });
      fireEvent.click(nextBtn);
      expect(nextCalled).toBe(true);
    });
  });

  describe('Step 3: Product Upload & CSV Validation', () => {
    it('renders CSV upload and manual entry options', () => {
      render(
        <Step3Products
          products={[]}
          onChange={() => {}}
          onSubmit={() => {}}
          onBack={() => {}}
          isSubmitting={false}
          submitError={null}
        />
      );

      expect(screen.getByText('Upload Product Catalog')).toBeDefined();
      expect(screen.getByText('Upload CSV Spreadsheet')).toBeDefined();
      expect(screen.getByText('Manual Entry Form')).toBeDefined();
    });

    it('shows error if submitting with fewer than 3 products', () => {
      let submitCalled = false;
      render(
        <Step3Products
          products={[{ name: 'Item 1', price: 1000, stock: 2, image_url: 'http://img.jpg' }]}
          onChange={() => {}}
          onSubmit={() => {
            submitCalled = true;
          }}
          onBack={() => {}}
          isSubmitting={false}
          submitError={null}
        />
      );

      const submitBtn = screen.getByRole('button', { name: /Submit & Launch Bot/i });
      fireEvent.click(submitBtn);

      expect(submitCalled).toBe(false);
      expect(screen.getByText(/Minimum 3 products required/i)).toBeDefined();
    });

    it('handles prefill sample products in manual entry', () => {
      let addedBatch: any[] = [];
      render(
        <ProductManualEntry
          products={[]}
          onAddProduct={() => {}}
          onRemoveProduct={() => {}}
          onAddBatch={(batch) => {
            addedBatch = batch;
          }}
        />
      );

      const sampleBtn = screen.getByRole('button', { name: /Quick: Add 3 Sample Nigerian Products/i });
      fireEvent.click(sampleBtn);

      expect(addedBatch.length).toBe(3);
    });

    it('submits manual product form when valid', () => {
      let added: any = null;
      render(
        <ProductManualEntry
          products={[]}
          onAddProduct={(p) => {
            added = p;
          }}
          onRemoveProduct={() => {}}
          onAddBatch={() => {}}
        />
      );

      const openBtn = screen.getByRole('button', { name: /\+ Add Single Product/i });
      fireEvent.click(openBtn);

      fireEvent.change(screen.getByPlaceholderText(/e\.g\. Blue Sneakers/i), { target: { value: 'Sneakers' } });
      fireEvent.change(screen.getByPlaceholderText('15000'), { target: { value: '18000' } });
      fireEvent.change(screen.getByPlaceholderText('5'), { target: { value: '10' } });

      fireEvent.click(screen.getByRole('button', { name: /Save Product/i }));
      expect(added).not.toBeNull();
      expect(added.name).toBe('Sneakers');
    });

    it('handles sample CSV download and file input', () => {
      render(<CSVUploadZone onProductsLoaded={() => {}} currentCount={0} />);

      const downloadBtn = screen.getByRole('button', { name: /Download Sample CSV/i });
      fireEvent.click(downloadBtn);

      const input = screen.getByTestId('csv-file-input');
      const csvContent =
        'Product Name,Price,Stock,Image URL,Description\n' +
        'P1,1000,5,https://img.jpg,desc\n' +
        'P2,2000,3,https://img.jpg,desc\n' +
        'P3,3000,2,https://img.jpg,desc\n';
      const file = new File([csvContent], 'products.csv', { type: 'text/csv' });
      fireEvent.change(input, { target: { files: [file] } });
    });
  });

  describe('Step 4: Success Screen', () => {
    it('renders celebratory live bot credentials and next steps', () => {
      render(
        <Step4Success
          vendorName="Tunde Alabi"
          businessName="Ilorin Fashion Hub"
          products={[
            { name: 'Shoe 1', price: 15000, stock: 5, image_url: 'http://img.jpg' },
            { name: 'Shoe 2', price: 18000, stock: 4, image_url: 'http://img.jpg' },
            { name: 'Shoe 3', price: 22000, stock: 2, image_url: 'http://img.jpg' },
          ]}
          successData={{
            vendor_id: 'v_1234',
            bot_number: '+1 415 523 8886',
            test_link: 'https://wa.me/14155238886',
            sandbox_code: 'quick-lion',
          }}
        />
      );

      expect(screen.getByText(/You're Live!/i)).toBeDefined();
      expect(screen.getAllByText('+1 415 523 8886').length).toBeGreaterThan(0);
      expect(screen.getAllByText(/join quick-lion/i).length).toBeGreaterThan(0);
      expect(screen.getByRole('link', { name: /Go to Dashboard/i })).toBeDefined();
    });

    it('allows copying the sandbox code', () => {
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn(),
        },
      });
      render(
        <Step4Success
          vendorName="Tunde"
          businessName="Shop"
          products={[{ name: 'A', price: 1000, stock: 1, image_url: '' }]}
          successData={{
            bot_number: '+1 415 523 8886',
            test_link: 'http://link',
            sandbox_code: 'quick-lion',
          }}
        />
      );

      const copyBtn = screen.getByTitle(/Copy sandbox code/i);
      fireEvent.click(copyBtn);
    });
  });

  describe('Full Multi-Step SignupForm Container', () => {
    it('renders initial step with progress indicator and navigates steps', () => {
      render(<SignupForm />);
      expect(screen.getByText(/Step 1 of 4/i)).toBeDefined();
      expect(screen.getByRole('heading', { name: 'Create Vendor Account' })).toBeDefined();

      // Advance from Step 1 to Step 2
      fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Tunde Alabi' } });
      fireEvent.change(screen.getByLabelText(/Phone Number/i), { target: { value: '0803 123 4567' } });
      fireEvent.click(screen.getByRole('button', { name: /Continue to Payment Setup/i }));

      // Now at Step 2
      expect(screen.getByText('Payment & Payout Setup')).toBeDefined();
      fireEvent.click(screen.getByRole('button', { name: /Continue to Product Upload/i }));

      // Now at Step 3
      expect(screen.getByText('Upload Product Catalog')).toBeDefined();
    });
  });
});
