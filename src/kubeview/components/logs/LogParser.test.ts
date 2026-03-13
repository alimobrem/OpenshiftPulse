/**
 * LogParser tests
 */

import { describe, it, expect } from 'vitest';
import { parseLogLine, detectLogFormat, type ParsedLogLine } from './LogParser';

describe('LogParser', () => {
  describe('detectLogFormat', () => {
    it('detects JSON format', () => {
      const lines = [
        '{"level":"info","msg":"test message","ts":"2024-01-15T10:00:00Z"}',
        '{"level":"error","msg":"another message"}',
      ];
      expect(detectLogFormat(lines)).toBe('json');
    });

    it('detects logfmt format', () => {
      const lines = [
        'level=info msg="test message" ts=2024-01-15T10:00:00Z',
        'level=error msg="another message"',
      ];
      expect(detectLogFormat(lines)).toBe('logfmt');
    });

    it('detects plain text format', () => {
      const lines = [
        '[INFO] This is a plain log message',
        'ERROR: Something went wrong',
      ];
      expect(detectLogFormat(lines)).toBe('plain');
    });

    it('returns plain for empty array', () => {
      expect(detectLogFormat([])).toBe('plain');
    });
  });

  describe('parseLogLine', () => {
    it('parses K8s timestamp prefix', () => {
      const line = '2024-01-15T10:04:23.441234567Z {"level":"info","msg":"test"}';
      const result = parseLogLine(line);

      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.timestamp?.toISOString()).toBe('2024-01-15T10:04:23.441Z');
    });

    it('parses JSON log line', () => {
      const line = '{"level":"error","msg":"test message","user":"john"}';
      const result = parseLogLine(line);

      expect(result.level).toBe('error');
      expect(result.message).toBe('test message');
      expect(result.format).toBe('json');
      expect(result.fields).toEqual({ user: 'john' });
    });

    it('parses logfmt log line', () => {
      const line = 'level=warn msg="test warning" user=john count=5';
      const result = parseLogLine(line);

      expect(result.level).toBe('warn');
      expect(result.message).toBe('test warning');
      expect(result.format).toBe('logfmt');
      expect(result.fields?.user).toBe('john');
      expect(result.fields?.count).toBe('5');
    });

    it('parses plain text with level detection', () => {
      const line = '[ERROR] Something went wrong';
      const result = parseLogLine(line);

      expect(result.level).toBe('error');
      expect(result.message).toBe('[ERROR] Something went wrong');
      expect(result.format).toBe('plain');
    });

    it('detects K8s single-char level indicators', () => {
      const testCases = [
        { line: 'I0315 10:00:00.123456 main.go:42] Info message', expected: 'info' as const },
        { line: 'W0315 10:00:00.123456 main.go:42] Warning message', expected: 'warn' as const },
        { line: 'E0315 10:00:00.123456 main.go:42] Error message', expected: 'error' as const },
        { line: 'F0315 10:00:00.123456 main.go:42] Fatal message', expected: 'fatal' as const },
      ];

      testCases.forEach(({ line, expected }) => {
        const result = parseLogLine(line);
        expect(result.level).toBe(expected);
      });
    });

    it('handles JSON with various timestamp field names', () => {
      const testCases = [
        { field: 'ts', value: '2024-01-15T10:00:00Z' },
        { field: 'time', value: '2024-01-15T10:00:00Z' },
        { field: 'timestamp', value: '2024-01-15T10:00:00Z' },
        { field: '@timestamp', value: '2024-01-15T10:00:00Z' },
      ];

      testCases.forEach(({ field, value }) => {
        const line = `{"${field}":"${value}","msg":"test"}`;
        const result = parseLogLine(line);
        expect(result.timestamp).toBeInstanceOf(Date);
      });
    });

    it('handles JSON with various level field names', () => {
      const testCases = [
        { field: 'level', value: 'error' },
        { field: 'severity', value: 'ERROR' },
        { field: 'lvl', value: 'err' },
      ];

      testCases.forEach(({ field, value }) => {
        const line = `{"${field}":"${value}","msg":"test"}`;
        const result = parseLogLine(line);
        expect(result.level).toBe('error');
      });
    });

    it('normalizes level strings', () => {
      const testCases = [
        { input: 'FATAL', expected: 'fatal' as const },
        { input: 'crit', expected: 'fatal' as const },
        { input: 'ERROR', expected: 'error' as const },
        { input: 'err', expected: 'error' as const },
        { input: 'WARN', expected: 'warn' as const },
        { input: 'warning', expected: 'warn' as const },
        { input: 'DEBUG', expected: 'debug' as const },
        { input: 'trace', expected: 'debug' as const },
        { input: 'INFO', expected: 'info' as const },
      ];

      testCases.forEach(({ input, expected }) => {
        const line = `{"level":"${input}","msg":"test"}`;
        const result = parseLogLine(line);
        expect(result.level).toBe(expected);
      });
    });

    it('preserves raw line', () => {
      const line = '2024-01-15T10:00:00Z [INFO] Test message';
      const result = parseLogLine(line);
      expect(result.raw).toBe(line);
    });
  });
});
