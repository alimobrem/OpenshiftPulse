/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

import {
  getMetricsForResource,
  resolveQuery,
  formatBytes,
  formatCores,
  formatPercent,
  formatRate,
  formatDuration,
  formatYAxisValue,
} from '../AutoMetrics';
import { buildNarrative } from '../Narrative';

// Mock ResizeObserver for jsdom
beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

describe('AutoMetrics', () => {
  describe('getMetricsForResource', () => {
    it('returns queries for pods', () => {
      const queries = getMetricsForResource('v1/pods', {
        metadata: { name: 'test-pod', namespace: 'default' },
      });
      expect(queries.length).toBeGreaterThan(0);
    });

    it('returns queries for deployments', () => {
      const queries = getMetricsForResource('apps/v1/deployments', {
        metadata: { name: 'nginx', namespace: 'default' },
      });
      expect(queries.length).toBeGreaterThan(0);
    });

    it('returns queries for nodes', () => {
      const queries = getMetricsForResource('v1/nodes', {
        metadata: { name: 'node-1' },
      });
      expect(queries.length).toBeGreaterThan(0);
    });

    it('returns empty array for unknown resource type', () => {
      const queries = getMetricsForResource('v1/unknown');
      expect(queries).toEqual([]);
    });
  });

  describe('resolveQuery', () => {
    it('replaces template variables', () => {
      const query = 'rate(container_cpu{pod="${name}",namespace="${namespace}"}[5m])';
      const resolved = resolveQuery(query, { name: 'test-pod', namespace: 'default' });
      expect(resolved).toBe('rate(container_cpu{pod="test-pod",namespace="default"}[5m])');
    });

    it('handles multiple occurrences', () => {
      expect(resolveQuery('${name}-${name}', { name: 'test' })).toBe('test-test');
    });
  });

  describe('format functions', () => {
    it('formatBytes formats byte values', () => {
      expect(formatBytes(0)).toContain('0');
      expect(formatBytes(1024)).toContain('KiB');
      expect(formatBytes(1024 * 1024)).toContain('MiB');
      expect(formatBytes(1024 * 1024 * 1024)).toContain('GiB');
    });

    it('formatCores formats CPU core values', () => {
      expect(formatCores(0)).toBe('0');
      expect(formatCores(0.25)).toContain('250m');
      expect(formatCores(1)).toContain('1');
    });

    it('formatPercent formats percentage values', () => {
      expect(formatPercent(0.5)).toContain('50');
      expect(formatPercent(1.0)).toContain('100');
    });

    it('formatRate formats rate values', () => {
      expect(formatRate(0)).toContain('0');
      expect(formatRate(1024)).toContain('KiB');
    });

    it('formatDuration formats duration values', () => {
      expect(formatDuration(0)).toBe('0s');
      expect(formatDuration(0.5)).toContain('ms');
      expect(formatDuration(60)).toContain('m');
    });

    it('formatYAxisValue delegates to correct formatter', () => {
      expect(formatYAxisValue(1024, 'bytes')).toContain('KiB');
      expect(formatYAxisValue(0.5, 'cores')).toContain('500m');
      expect(formatYAxisValue(42, 'count')).toBe('42');
    });
  });
});

describe('Narrative', () => {
  it('builds narrative from events', () => {
    const result = buildNarrative({
      events: [
        { timestamp: '2024-01-01T10:00:00Z', reason: 'Created', message: 'Pod created', involvedObject: { kind: 'Pod', name: 'test' } },
        { timestamp: '2024-01-01T10:01:00Z', reason: 'Started', message: 'Pod started', involvedObject: { kind: 'Pod', name: 'test' } },
      ],
    });
    expect(result.events.length).toBe(2);
    expect(result.summary).toBeTruthy();
  });

  it('identifies root cause from image pull + crash', () => {
    const result = buildNarrative({
      events: [
        { timestamp: '2024-01-01T10:00:00Z', reason: 'Pulled', message: 'Image pulled', involvedObject: { kind: 'Pod', name: 'test' } },
        { timestamp: '2024-01-01T10:01:00Z', reason: 'BackOff', message: 'Crash loop', involvedObject: { kind: 'Pod', name: 'test' } },
      ],
    });
    expect(result.rootCause).toBeTruthy();
  });

  it('includes alerts in narrative', () => {
    const result = buildNarrative({
      events: [{ timestamp: '2024-01-01T10:00:00Z', reason: 'Created', message: '', involvedObject: { kind: 'Pod', name: 'test' } }],
      alerts: [{ startsAt: '2024-01-01T10:01:00Z', labels: { alertname: 'HighCPU' }, annotations: { summary: 'CPU high' } }],
    });
    expect(result.events.some((e) => e.source === 'alert')).toBe(true);
  });

  it('includes metric anomalies', () => {
    const result = buildNarrative({
      events: [],
      metricAnomalies: [{ timestamp: 1704103260, metric: 'cpu', value: 0.95, threshold: 0.8, direction: 'above' as const }],
    });
    expect(result.events.some((e) => e.source === 'metric')).toBe(true);
  });
});
