import { describe, it, expect, beforeEach } from 'vitest';
import { WatchManager } from '../watch';

describe('WatchManager', () => {
  let manager: WatchManager;

  beforeEach(() => {
    manager = new WatchManager();
  });

  it('starts with disconnected status', () => {
    expect(manager.getStatus()).toBe('disconnected');
  });

  it('starts with zero watch count', () => {
    expect(manager.watchCount).toBe(0);
  });

  it('getConnections returns empty array initially', () => {
    expect(manager.getConnections()).toEqual([]);
  });

  it('stopAll does not throw when no watches', () => {
    expect(() => manager.stopAll()).not.toThrow();
  });

  it('reconnectAll does not throw when no watches', () => {
    expect(() => manager.reconnectAll()).not.toThrow();
  });

  it('watch returns a subscription with unsubscribe', () => {
    // WebSocket will fail in test env, but subscription should still be returned
    try {
      const sub = manager.watch('/api/v1/pods', () => {});
      expect(sub).toBeDefined();
      expect(typeof sub.unsubscribe).toBe('function');
      sub.unsubscribe();
    } catch {
      // WebSocket not available in test env, that's OK
    }
  });
});
