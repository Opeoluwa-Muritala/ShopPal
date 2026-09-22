import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import RootLayout from '../app/layout';

describe('RootLayout', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <RootLayout>
        <div data-testid="test-child">Naija Marketplace Placeholder</div>
      </RootLayout>
    );
    expect(container).toBeDefined();
  });
});
