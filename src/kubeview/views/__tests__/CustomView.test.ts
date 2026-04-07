import { describe, it, expect } from 'vitest';
import { idealHeight, positionsToLayout } from '../CustomView';
import type { ComponentSpec } from '../../engine/agentComponents';

describe('idealHeight', () => {
  it('returns correct height for grid with 4 metric cards in 4 columns', () => {
    const spec: ComponentSpec = {
      kind: 'grid',
      columns: 4,
      items: [
        { kind: 'metric_card', title: 'A', value: '1' },
        { kind: 'metric_card', title: 'B', value: '2' },
        { kind: 'metric_card', title: 'C', value: '3' },
        { kind: 'metric_card', title: 'D', value: '4' },
      ],
    };
    // 4 items / 4 cols = 1 row → 2 + 1*3 = 5
    expect(idealHeight(spec)).toBe(5);
  });

  it('returns correct height for grid with 4 cards in 2 columns', () => {
    const spec: ComponentSpec = {
      kind: 'grid',
      columns: 2,
      items: [
        { kind: 'metric_card', title: 'A', value: '1' },
        { kind: 'metric_card', title: 'B', value: '2' },
        { kind: 'metric_card', title: 'C', value: '3' },
        { kind: 'metric_card', title: 'D', value: '4' },
      ],
    };
    // 4 items / 2 cols = 2 rows → 2 + 2*3 = 8
    expect(idealHeight(spec)).toBe(8);
  });

  it('returns correct height for chart', () => {
    const spec: ComponentSpec = {
      kind: 'chart',
      series: [{ label: 'test', data: [[1, 2]] }],
    };
    expect(idealHeight(spec)).toBe(10);
  });

  it('returns correct height for data_table with few rows', () => {
    const spec: ComponentSpec = {
      kind: 'data_table',
      columns: [{ id: 'name', header: 'Name' }],
      rows: [{ name: 'a' }, { name: 'b' }],
    };
    // 3 + 2 = 5
    expect(idealHeight(spec)).toBe(5);
  });

  it('caps data_table height at 14', () => {
    const spec: ComponentSpec = {
      kind: 'data_table',
      columns: [{ id: 'name', header: 'Name' }],
      rows: Array.from({ length: 50 }, (_, i) => ({ name: `row-${i}` })),
    };
    expect(idealHeight(spec)).toBe(14);
  });

  it('returns correct height for metric_card', () => {
    const spec: ComponentSpec = { kind: 'metric_card', title: 'CPU', value: '42%' };
    expect(idealHeight(spec)).toBe(3);
  });

  it('returns correct height for bar_list', () => {
    const spec: ComponentSpec = {
      kind: 'bar_list',
      items: [{ label: 'a', value: 1 }],
    };
    expect(idealHeight(spec)).toBe(6);
  });

  it('returns correct height for progress_list', () => {
    const spec: ComponentSpec = {
      kind: 'progress_list',
      items: [{ label: 'a', value: 50, max: 100 }],
    };
    expect(idealHeight(spec)).toBe(6);
  });

  it('returns correct height for stat_card', () => {
    const spec: ComponentSpec = { kind: 'stat_card', title: 'Uptime', value: '99.9%' };
    expect(idealHeight(spec)).toBe(3);
  });
});

describe('positionsToLayout', () => {
  it('ignores saved h and uses idealHeight', () => {
    const specs: ComponentSpec[] = [
      {
        kind: 'grid',
        columns: 4,
        items: [
          { kind: 'metric_card', title: 'A', value: '1' },
          { kind: 'metric_card', title: 'B', value: '2' },
          { kind: 'metric_card', title: 'C', value: '3' },
          { kind: 'metric_card', title: 'D', value: '4' },
        ],
      },
    ];
    // Backend saved h=12, but idealHeight should be 5
    const positions = { '0': { x: 0, y: 0, w: 4, h: 12 } };
    const layout = positionsToLayout(positions, specs);
    expect(layout[0].h).toBe(5); // idealHeight, NOT saved h=12
  });

  it('preserves x, y, w from saved positions', () => {
    const specs: ComponentSpec[] = [
      { kind: 'chart', series: [{ label: 'test', data: [[1, 2]] }] },
    ];
    const positions = { '0': { x: 2, y: 5, w: 2, h: 999 } };
    const layout = positionsToLayout(positions, specs);
    expect(layout[0].x).toBe(2);
    expect(layout[0].y).toBe(5);
    expect(layout[0].w).toBe(2);
    expect(layout[0].h).toBe(10); // idealHeight for chart, NOT 999
  });

  it('handles numeric keys from positions', () => {
    const specs: ComponentSpec[] = [
      { kind: 'metric_card', title: 'CPU', value: '42%' },
    ];
    const positions = { 0: { x: 0, y: 0, w: 1, h: 50 } };
    const layout = positionsToLayout(positions as any, specs);
    expect(layout[0].h).toBe(3); // idealHeight for metric_card
  });

  it('falls back to default layout when no positions exist for index', () => {
    const specs: ComponentSpec[] = [
      { kind: 'chart', series: [{ label: 'test', data: [[1, 2]] }] },
    ];
    const positions = {}; // empty
    const layout = positionsToLayout(positions, specs);
    expect(layout[0].x).toBe(0);
    expect(layout[0].w).toBe(4);
    expect(layout[0].h).toBe(10); // idealHeight for chart
  });
});
