// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InboxLifecycleBadge, InboxLifecycleStepper } from '../InboxLifecycle';

describe('InboxLifecycleBadge', () => {
  it('renders finding lifecycle stages', () => {
    render(<InboxLifecycleBadge itemType="finding" status="acknowledged" />);
    expect(screen.getAllByText('New').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('AI Review').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Ack').length).toBeGreaterThanOrEqual(1);
  });

  it('renders task lifecycle stages', () => {
    render(<InboxLifecycleBadge itemType="task" status="new" />);
    expect(screen.getAllByText('New').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('In Progress').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Done').length).toBeGreaterThanOrEqual(1);
  });

  it('renders assessment lifecycle stages', () => {
    render(<InboxLifecycleBadge itemType="assessment" status="acknowledged" />);
    expect(screen.getAllByText('Escalated').length).toBeGreaterThanOrEqual(1);
  });

  it('renders alert lifecycle stages', () => {
    render(<InboxLifecycleBadge itemType="alert" status="new" />);
    expect(screen.getAllByText('Resolved').length).toBeGreaterThanOrEqual(1);
  });

  it('highlights current status with pulse for agent_reviewing', () => {
    const { container } = render(<InboxLifecycleBadge itemType="finding" status="agent_reviewing" />);
    const pulsingEl = container.querySelector('.animate-pulse');
    expect(pulsingEl).not.toBeNull();
  });

  it('does not pulse for non-agent_reviewing status', () => {
    const { container } = render(<InboxLifecycleBadge itemType="finding" status="acknowledged" />);
    const pulsingEl = container.querySelector('.animate-pulse');
    expect(pulsingEl).toBeNull();
  });
});

describe('InboxLifecycleStepper', () => {
  it('renders finding stepper with all stages', () => {
    render(<InboxLifecycleStepper itemType="finding" status="investigating" />);
    expect(screen.getAllByText('New').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Investigating').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Resolved').length).toBeGreaterThanOrEqual(1);
  });

  it('renders task stepper', () => {
    render(<InboxLifecycleStepper itemType="task" status="in_progress" />);
    expect(screen.getAllByText('In Progress').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Done').length).toBeGreaterThanOrEqual(1);
  });
});
