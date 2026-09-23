export type SettingsTabId =
  | 'account'
  | 'payment'
  | 'bot'
  | 'notifications'
  | 'billing'
  | 'danger';

export interface PersonalInfo {
  fullName: string;
  phone: string;
  whatsappNumber: string;
  businessName: string;
  email: string;
}

export interface AccountStatusInfo {
  status: 'Active' | 'Inactive' | 'Suspended';
  accountCreated: string;
  vendorId: string;
  botWhatsAppNumber: string;
}

export interface PaystackConfig {
  key: string;
  isConnected: boolean;
  maskedKey: string;
}

export interface BankAccountInfo {
  bankName: string;
  accountNumber: string;
  accountName: string;
  isVerified: boolean;
}

export interface WithdrawalSettings {
  minWithdrawal: number;
  nextPayoutDate: string;
  lastPayout: string;
}

export interface TimeRange {
  from: string;
  to: string;
}

export interface OperatingHours {
  enabled: boolean;
  monFri: TimeRange;
  saturday: TimeRange;
  sunday: TimeRange;
  closedMessage: string;
  timezone: string;
}

export interface BotCustomizationData {
  greetingMessage: string;
  language: string;
  operatingHours: OperatingHours;
  status: 'active' | 'paused';
}

export interface NotificationSettingsData {
  emailOnOrder: boolean;
  pushOnOrder: boolean;
  lowStockAlert: boolean;
  lowStockThreshold: number;
  lowStockFrequency: 'Immediate' | 'Daily' | 'Weekly';
  lowStockChannels: {
    email: boolean;
    push: boolean;
  };
  chatCustomerMessage: boolean;
  chatOrderUpdate: boolean;
  marketingRecommendations: boolean;
  marketingPromoEmails: boolean;
}

export interface BillingUsageData {
  planName: string;
  planStatus: string;
  price: string;
  apiCalls: number;
  apiCallsLimit: string;
  storageMb: number;
  storageLimit: string;
  activeProducts: number;
  activeProductsLimit: string;
  ordersProcessed: number;
}

export interface VendorSettings {
  id: string;
  personalInfo: PersonalInfo;
  accountStatus: AccountStatusInfo;
  paystack: PaystackConfig;
  bankAccount: BankAccountInfo;
  withdrawal: WithdrawalSettings;
  bot: BotCustomizationData;
  notifications: NotificationSettingsData;
  billing: BillingUsageData;
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}
