import React from 'react';
import SettingsPage from '../../../components/settings/SettingsPage';

export const metadata = {
  title: 'Settings — ShopPal Dashboard',
  description: 'Manage account info, Blaaiz payment settings, WhatsApp bot customization, and notifications.',
};

export default function Page() {
  return <SettingsPage />;
}
