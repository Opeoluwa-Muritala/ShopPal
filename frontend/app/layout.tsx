import React from 'react';

export const metadata = {
  title: 'Naija Marketplace Vendor Portal',
  description: 'Merchant portal for WhatsApp e-commerce bot',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
