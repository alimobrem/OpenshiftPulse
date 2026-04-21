import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../engine/inboxApi', () => ({
  fetchInbox: vi.fn().mockResolvedValue({ items: [], groups: [], stats: { new: 2, total: 5 }, total: 5 }),
  fetchInboxStats: vi.fn().mockResolvedValue({ new: 2, total: 5 }),
  acknowledgeInboxItem: vi.fn().mockResolvedValue(undefined),
  claimInboxItem: vi.fn().mockResolvedValue(undefined),
  unclaimInboxItem: vi.fn().mockResolvedValue(undefined),
  snoozeInboxItem: vi.fn().mockResolvedValue(undefined),
  dismissInboxItem: vi.fn().mockResolvedValue(undefined),
  resolveInboxItem: vi.fn().mockResolvedValue(undefined),
  pinInboxItem: vi.fn().mockResolvedValue(undefined),
  createInboxTask: vi.fn().mockResolvedValue({ id: 'inb-test' }),
  restoreInboxItem: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../engine/auth', () => ({
  handleAuthError: vi.fn(),
}));

vi.mock('../uiStore', () => ({
  useUIStore: { getState: () => ({ addToast: vi.fn() }) },
}));

describe('inboxStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with needs_attention preset', async () => {
    const { useInboxStore } = await import('../inboxStore');
    const state = useInboxStore.getState();
    expect(state.activePreset).toBe('needs_attention');
    expect(state.items).toEqual([]);
    expect(state.loading).toBe(false);
  });

  it('setPreset updates activePreset and filters', async () => {
    const { useInboxStore } = await import('../inboxStore');
    useInboxStore.getState().setPreset('agent_cleared');
    expect(useInboxStore.getState().activePreset).toBe('agent_cleared');
  });

  it('setPreset null clears preset', async () => {
    const { useInboxStore } = await import('../inboxStore');
    useInboxStore.getState().setPreset('agent_cleared');
    useInboxStore.getState().setPreset(null);
    expect(useInboxStore.getState().activePreset).toBeNull();
  });

  it('setFilters clears activePreset', async () => {
    const { useInboxStore } = await import('../inboxStore');
    useInboxStore.getState().setPreset('agent_cleared');
    useInboxStore.getState().setFilters({ type: 'finding' });
    expect(useInboxStore.getState().activePreset).toBeNull();
    expect(useInboxStore.getState().filters.type).toBe('finding');
  });

  it('setGroupBy updates groupBy', async () => {
    const { useInboxStore } = await import('../inboxStore');
    useInboxStore.getState().setGroupBy('correlation');
    expect(useInboxStore.getState().groupBy).toBe('correlation');
  });

  it('setSelectedItem updates selectedItemId', async () => {
    const { useInboxStore } = await import('../inboxStore');
    useInboxStore.getState().setSelectedItem('inb-123');
    expect(useInboxStore.getState().selectedItemId).toBe('inb-123');
  });

  it('refresh fetches inbox data', async () => {
    const { useInboxStore } = await import('../inboxStore');
    const { fetchInbox } = await import('../../engine/inboxApi');
    await useInboxStore.getState().refresh();
    expect(fetchInbox).toHaveBeenCalled();
    expect(useInboxStore.getState().total).toBe(5);
  });

  it('acknowledge calls API and refreshes', async () => {
    const { useInboxStore } = await import('../inboxStore');
    const { acknowledgeInboxItem } = await import('../../engine/inboxApi');
    const result = await useInboxStore.getState().acknowledge('inb-1');
    expect(result).toBe(true);
    expect(acknowledgeInboxItem).toHaveBeenCalledWith('inb-1');
  });

  it('claim calls API and refreshes', async () => {
    const { useInboxStore } = await import('../inboxStore');
    const { claimInboxItem } = await import('../../engine/inboxApi');
    const result = await useInboxStore.getState().claim('inb-2');
    expect(result).toBe(true);
    expect(claimInboxItem).toHaveBeenCalledWith('inb-2');
  });

  it('dismiss calls API and refreshes', async () => {
    const { useInboxStore } = await import('../inboxStore');
    const { dismissInboxItem } = await import('../../engine/inboxApi');
    const result = await useInboxStore.getState().dismiss('inb-3');
    expect(result).toBe(true);
    expect(dismissInboxItem).toHaveBeenCalledWith('inb-3');
  });

  it('restore calls API and refreshes', async () => {
    const { useInboxStore } = await import('../inboxStore');
    const { restoreInboxItem } = await import('../../engine/inboxApi');
    const result = await useInboxStore.getState().restore('inb-4');
    expect(result).toBe(true);
    expect(restoreInboxItem).toHaveBeenCalledWith('inb-4');
  });

  it('createTask calls API and refreshes', async () => {
    const { useInboxStore } = await import('../inboxStore');
    const { createInboxTask } = await import('../../engine/inboxApi');
    const result = await useInboxStore.getState().createTask({ title: 'Test task' });
    expect(result).toBe(true);
    expect(createInboxTask).toHaveBeenCalledWith({ title: 'Test task' });
  });
});
