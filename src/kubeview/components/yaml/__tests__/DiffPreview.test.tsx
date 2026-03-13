/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DiffPreview from '../DiffPreview';

describe('DiffPreview', () => {
  const original = `apiVersion: v1
kind: Pod
metadata:
  name: test-pod
spec:
  replicas: 1`;

  const modified = `apiVersion: v1
kind: Pod
metadata:
  name: test-pod
spec:
  replicas: 3`;

  it('renders Apply and Discard buttons', () => {
    render(
      <DiffPreview original={original} modified={modified} onApply={vi.fn()} onDiscard={vi.fn()} />
    );
    expect(screen.getByText('Apply')).toBeDefined();
    expect(screen.getByText('Discard')).toBeDefined();
  });

  it('calls onApply when Apply clicked', () => {
    const onApply = vi.fn();
    const { container } = render(
      <DiffPreview original={original} modified={modified} onApply={onApply} onDiscard={vi.fn()} />
    );
    const applyButtons = container.querySelectorAll('button');
    const applyBtn = Array.from(applyButtons).find((b) => b.textContent?.includes('Apply'));
    if (applyBtn) fireEvent.click(applyBtn);
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it('calls onDiscard when Discard clicked', () => {
    const onDiscard = vi.fn();
    const { container } = render(
      <DiffPreview original={original} modified={modified} onApply={vi.fn()} onDiscard={onDiscard} />
    );
    const buttons = container.querySelectorAll('button');
    const discardBtn = Array.from(buttons).find((b) => b.textContent?.includes('Discard'));
    if (discardBtn) fireEvent.click(discardBtn);
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it('shows Applying... when loading', () => {
    render(
      <DiffPreview original={original} modified={modified} onApply={vi.fn()} onDiscard={vi.fn()} loading={true} />
    );
    expect(screen.getByText('Applying...')).toBeDefined();
  });
});
