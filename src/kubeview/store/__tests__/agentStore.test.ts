// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock AgentClient as a class
let lastMockClient: any = null;
vi.mock('../../engine/agentClient', () => {
  return {
    AgentClient: class MockAgentClient {
      mode: string;
      connected = false;
      private handlers = new Set<(e: any) => void>();

      constructor(mode: string) {
        this.mode = mode;
        lastMockClient = this;
      }

      on(handler: (e: any) => void) {
        this.handlers.add(handler);
        return () => this.handlers.delete(handler);
      }

      connect() {
        this.connected = true;
        this.emit({ type: 'connected' });
      }

      disconnect() {
        this.connected = false;
      }

      send() {}
      confirm() {}
      clear() {}

      switchMode(mode: string) {
        this.mode = mode;
      }

      private emit(event: any) {
        for (const h of this.handlers) h(event);
      }

      _simulateEvent(event: any) {
        this.emit(event);
      }
    },
  };
});

import { useAgentStore } from '../agentStore';
import { useUIStore } from '../uiStore';

describe('agentStore', () => {
  beforeEach(() => {
    // Reset store state between tests
    const { disconnect } = useAgentStore.getState();
    disconnect();
    useAgentStore.setState({
      mode: 'sre',
      messages: [],
      streaming: false,
      streamingText: '',
      thinkingText: '',
      activeTools: [],
      pendingConfirm: null,
      error: null,
    });
    useUIStore.getState().removeDegradedReason('session_expired');
    lastMockClient = null;
  });

  it('initializes with default state', () => {
    const state = useAgentStore.getState();
    expect(state.mode).toBe('sre');
    expect(state.messages).toEqual([]);
    expect(state.streaming).toBe(false);
    expect(state.connected).toBe(false);
  });

  it('sendMessage adds user message and sets streaming', () => {
    const store = useAgentStore.getState();
    store.connect();
    store.sendMessage('Check health');

    const state = useAgentStore.getState();
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0].role).toBe('user');
    expect(state.messages[0].content).toBe('Check health');
    expect(state.streaming).toBe(true);
  });

  it('sendMessage with context includes resource context', () => {
    const store = useAgentStore.getState();
    store.connect();
    store.sendMessage('Diagnose', { kind: 'Pod', name: 'nginx', namespace: 'default' });

    const state = useAgentStore.getState();
    expect(state.messages[0].context).toEqual({ kind: 'Pod', name: 'nginx', namespace: 'default' });
  });

  it('switchMode updates mode and clears messages', () => {
    const store = useAgentStore.getState();
    store.connect();
    store.sendMessage('test');
    store.switchMode('security');

    const state = useAgentStore.getState();
    expect(state.mode).toBe('security');
    expect(state.messages).toEqual([]);
  });

  it('clearChat resets messages', () => {
    const store = useAgentStore.getState();
    store.connect();
    store.sendMessage('test');
    store.clearChat();

    const state = useAgentStore.getState();
    expect(state.messages).toEqual([]);
    expect(state.error).toBeNull();
  });

  it('triggers session_expired on 4001 auth error', () => {
    const store = useAgentStore.getState();
    store.connect();
    expect(useUIStore.getState().degradedReasons.has('session_expired')).toBe(false);

    lastMockClient._simulateEvent({
      type: 'error',
      message: 'Agent authentication failed (code 4001). The WebSocket token may not be configured correctly.',
    });

    expect(useUIStore.getState().degradedReasons.has('session_expired')).toBe(true);
    expect(useAgentStore.getState().error).toContain('4001');
  });

  it('does not trigger session_expired on non-auth errors', () => {
    const store = useAgentStore.getState();
    store.connect();

    lastMockClient._simulateEvent({
      type: 'error',
      message: 'Tool execution failed: timeout after 30s',
    });

    expect(useUIStore.getState().degradedReasons.has('session_expired')).toBe(false);
    expect(useAgentStore.getState().error).toContain('timeout');
  });
});
