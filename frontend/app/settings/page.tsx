import React from 'react';
import SettingsPage from '../../components/settings/SettingsPage';

export const metadata = {
  title: 'Settings & Integrations — ShopPal',
  description: 'Manage account info, Paystack payment credentials, WhatsApp bot customization, and notifications.',
};

export default function Page() {
  return <SettingsPage />;
}
