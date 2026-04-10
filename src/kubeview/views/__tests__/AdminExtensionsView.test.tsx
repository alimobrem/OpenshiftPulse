// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

const mockFetch = vi.fn();
global.fetch = mockFetch;

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('AdminExtensionsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve([]) });
  });

  it('renders the page heading', async () => {
    const AdminExtensionsView = (await import('../AdminExtensionsView')).default;
    renderWithProviders(<AdminExtensionsView />);
    // Use heading role to avoid matching tab text
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.textContent).toContain('Extensions');
  });

  it('renders tab buttons', async () => {
    const AdminExtensionsView = (await import('../AdminExtensionsView')).default;
    renderWithProviders(<AdminExtensionsView />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBeGreaterThanOrEqual(4);
  });

  it('renders skills content by default', async () => {
    const AdminExtensionsView = (await import('../AdminExtensionsView')).default;
    renderWithProviders(<AdminExtensionsView />);
    // Skills tab shows "skills loaded" text
    expect(screen.getAllByText(/skills loaded/).length).toBeGreaterThanOrEqual(1);
  });
});
