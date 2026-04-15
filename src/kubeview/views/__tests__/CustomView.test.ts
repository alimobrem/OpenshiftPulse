import { describe, it, expect } from 'vitest';
import { positionsToLayout } from '../CustomView';
import type { ComponentSpec } from '../../engine/agentComponents';

describe('positionsToLayout', () => {
  it('uses backend positions verbatim', () => {
    const positions = {
      0: { x: 0, y: 0, w: 2, h: 10 },
      1: { x: 2, y: 0, w: 2, h: 10 },
    };
    const specs: ComponentSpec[] = [
      { kind: 'chart', title: 'A' },
      { kind: 'chart', title: 'B' },
    ];
    const layout = positionsToLayout(positions, specs);
    expect(layout[0].x).toBe(0);
    expect(layout[0].w).toBe(2);
    expect(layout[0].h).toBe(10);
    expect(layout[1].x).toBe(2);
    expect(layout[1].w).toBe(2);
  });

  it('falls back to full-width stacking for missing positions', () => {
    const specs: ComponentSpec[] = [
      { kind: 'chart', title: 'A' },
      { kind: 'data_table', title: 'B' },
    ];
    const layout = positionsToLayout({}, specs);
    expect(layout[0].x).toBe(0);
    expect(layout[0].w).toBe(4);
    expect(layout[0].h).toBe(8);
    expect(layout[1].y).toBe(8);
  });

  it('appends missing widgets below existing ones', () => {
    const positions = {
      0: { x: 0, y: 0, w: 4, h: 12 },
    };
    const specs: ComponentSpec[] = [
      { kind: 'chart', title: 'A' },
      { kind: 'chart', title: 'B' },
    ];
    const layout = positionsToLayout(positions, specs);
    expect(layout[0].y).toBe(0);
    expect(layout[0].h).toBe(12);
    expect(layout[1].y).toBe(12);
    expect(layout[1].w).toBe(4);
  });

  it('handles string keys in positions', () => {
    const positions = {
      '0': { x: 0, y: 0, w: 4, h: 6 },
    };
    const specs: ComponentSpec[] = [{ kind: 'status_list', title: 'A' }];
    const layout = positionsToLayout(positions, specs);
    expect(layout[0].h).toBe(6);
  });
});
