/**
 * LogCollapse tests
 */

import { describe, it, expect } from 'vitest';
import { areSimilar, collapseRepeatedLines, isCollapsedGroup } from './LogCollapse';
import type { ParsedLogLine } from './LogParser';

describe('LogCollapse', () => {
  describe('areSimilar', () => {
    it('recognizes similar messages with different numbers', () => {
      const msg1 = 'Request processed in 123ms';
      const msg2 = 'Request processed in 456ms';
      expect(areSimilar(msg1, msg2)).toBe(true);
    });

    it('recognizes similar messages with different UUIDs', () => {
      const msg1 = 'User abc12345-6789-abcd-ef01-123456789012 logged in';
      const msg2 = 'User def98765-4321-dcba-fe98-987654321098 logged in';
      expect(areSimilar(msg1, msg2)).toBe(true);
    });

    it('recognizes similar messages with different timestamps', () => {
      const msg1 = 'Event at 2024-01-15T10:00:00Z processed';
      const msg2 = 'Event at 2024-01-15T11:30:45Z processed';
      expect(areSimilar(msg1, msg2)).toBe(true);
    });

    it('recognizes similar messages with different IPs', () => {
      const msg1 = 'Connection from 192.168.1.100';
      const msg2 = 'Connection from 10.0.0.50';
      expect(areSimilar(msg1, msg2)).toBe(true);
    });

    it('recognizes different messages as not similar', () => {
      const msg1 = 'User logged in';
      const msg2 = 'User logged out';
      expect(areSimilar(msg1, msg2)).toBe(false);
    });

    it('recognizes similar messages with different quoted strings', () => {
      const msg1 = 'Error: "file not found"';
      const msg2 = 'Error: "access denied"';
      expect(areSimilar(msg1, msg2)).toBe(true);
    });
  });

  describe('collapseRepeatedLines', () => {
    const createLogLine = (message: string, level: ParsedLogLine['level'] = 'info'): ParsedLogLine => ({
      raw: message,
      message,
      level,
      format: 'plain',
    });

    it('collapses consecutive similar lines', () => {
      const lines = [
        createLogLine('Request processed in 100ms'),
        createLogLine('Request processed in 200ms'),
        createLogLine('Request processed in 300ms'),
        createLogLine('Different message'),
      ];

      const result = collapseRepeatedLines(lines, 3);

      expect(result).toHaveLength(2);
      expect(isCollapsedGroup(result[0])).toBe(true);
      if (isCollapsedGroup(result[0])) {
        expect(result[0].count).toBe(3);
        expect(result[0].firstIndex).toBe(0);
        expect(result[0].lastIndex).toBe(2);
      }
      expect(result[1]).toEqual(lines[3]);
    });

    it('does not collapse if below threshold', () => {
      const lines = [
        createLogLine('Request processed in 100ms'),
        createLogLine('Request processed in 200ms'),
        createLogLine('Different message'),
      ];

      const result = collapseRepeatedLines(lines, 3);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual(lines[0]);
      expect(result[1]).toEqual(lines[1]);
      expect(result[2]).toEqual(lines[2]);
    });

    it('only collapses lines with same level', () => {
      const lines = [
        createLogLine('Error processing request', 'error'),
        createLogLine('Error processing request', 'warn'),
        createLogLine('Error processing request', 'error'),
      ];

      const result = collapseRepeatedLines(lines, 2);

      // Should not collapse because levels differ
      expect(result).toHaveLength(3);
    });

    it('handles multiple collapsed groups', () => {
      const lines = [
        createLogLine('Request 1'),
        createLogLine('Request 2'),
        createLogLine('Request 3'),
        createLogLine('Different message'),
        createLogLine('Error 1', 'error'),
        createLogLine('Error 2', 'error'),
        createLogLine('Error 3', 'error'),
      ];

      const result = collapseRepeatedLines(lines, 3);

      expect(result).toHaveLength(3);
      expect(isCollapsedGroup(result[0])).toBe(true);
      expect(result[1]).toEqual(lines[3]);
      expect(isCollapsedGroup(result[2])).toBe(true);
    });

    it('handles empty array', () => {
      const result = collapseRepeatedLines([]);
      expect(result).toHaveLength(0);
    });

    it('respects custom threshold', () => {
      const lines = [
        createLogLine('Message 1'),
        createLogLine('Message 2'),
      ];

      const result = collapseRepeatedLines(lines, 2);

      expect(result).toHaveLength(1);
      expect(isCollapsedGroup(result[0])).toBe(true);
    });
  });

  describe('isCollapsedGroup', () => {
    it('identifies collapsed groups', () => {
      const group = {
        representative: {
          raw: 'test',
          message: 'test',
          format: 'plain' as const,
        },
        count: 5,
        firstIndex: 0,
        lastIndex: 4,
        collapsed: true,
      };

      expect(isCollapsedGroup(group)).toBe(true);
    });

    it('identifies regular log lines', () => {
      const line: ParsedLogLine = {
        raw: 'test',
        message: 'test',
        format: 'plain',
      };

      expect(isCollapsedGroup(line)).toBe(false);
    });
  });
});
