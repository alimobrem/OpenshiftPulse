// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import { DynamicComponent } from '../DynamicComponent';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

// Mock the registry fetch
vi.mock('../../../engine/componentRegistry', () => ({
  fetchComponentRegistry: () => Promise.resolve({
    test_gauge: {
      description: 'Test gauge',
      category: 'metrics',
      required_fields: ['value'],
      optional_fields: [],
      supports_mutations: [],
      example: { kind: 'test_gauge', value: 42 },
      is_container: false,
      layout: {
        type: 'stat_card',
        label: '{{title}}',
        value: '{{value}}',
        status: 'healthy',
      },
    },
  }),
}));

function renderComponent(spec: Record<string, unknown>) {
  return render(
    <MemoryRouter>
      <DynamicComponent spec={spec} />
    </MemoryRouter>
  );
}

describe('DynamicComponent', () => {
  it('renders unknown kind with raw JSON', async () => {
    renderComponent({ kind: 'totally_unknown', data: 'test' });
    await vi.waitFor(() => {
      expect(screen.getByText('totally_unknown')).toBeDefined();
    });
  });

  it('renders known dynamic kind with layout template', async () => {
    renderComponent({ kind: 'test_gauge', title: 'CPU Usage', value: '75%' });
    await vi.waitFor(() => {
      expect(screen.getByText('75%')).toBeDefined();
      expect(screen.getByText('CPU Usage')).toBeDefined();
    });
  });
});
