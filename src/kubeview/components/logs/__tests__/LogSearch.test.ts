import { describe, it, expect } from 'vitest';
import type { ParsedLogLine } from '../LogParser';

// Test the search logic directly (extracted from LogSearch component's useMemo)
function searchLogs(lines: ParsedLogLine[], query: string): number[] {
  if (!query) return [];

  const matchIndices: number[] = [];
  const isNegative = query.startsWith('-');
  const searchQuery = isNegative ? query.slice(1) : query;

  if (!searchQuery) return [];

  const regexChars = /[.*+?^${}()|[\]\\]/;
  const isRegex = regexChars.test(searchQuery);

  try {
    let matcher: (line: ParsedLogLine) => boolean;

    if (isRegex && !isNegative) {
      const regex = new RegExp(searchQuery, 'i');
      matcher = (line) => regex.test(line.message);
    } else {
      const lowerQuery = searchQuery.toLowerCase();
      matcher = (line) => line.message.toLowerCase().includes(lowerQuery);
    }

    lines.forEach((line, index) => {
      const matches = matcher(line);
      if (isNegative ? !matches : matches) {
        matchIndices.push(index);
      }
    });
  } catch {
    const lowerQuery = searchQuery.toLowerCase();
    lines.forEach((line, index) => {
      const matches = line.message.toLowerCase().includes(lowerQuery);
      if (isNegative ? !matches : matches) {
        matchIndices.push(index);
      }
    });
  }

  return matchIndices;
}

function makeLine(message: string): ParsedLogLine {
  return {
    raw: message,
    message,
    timestamp: undefined,
    level: undefined,
    fields: {},
    format: 'plain',
  };
}

const testLines: ParsedLogLine[] = [
  makeLine('Starting server on port 8080'),
  makeLine('Connected to database'),
  makeLine('ERROR: Failed to authenticate user'),
  makeLine('Request received: GET /api/health'),
  makeLine('ERROR: Connection timeout after 30s'),
  makeLine('Request completed in 45ms'),
  makeLine('Warning: memory usage at 85%'),
];

describe('LogSearch logic', () => {
  it('returns empty for empty query', () => {
    expect(searchLogs(testLines, '')).toEqual([]);
  });

  it('finds matching lines by substring', () => {
    const matches = searchLogs(testLines, 'error');
    expect(matches).toEqual([2, 4]);
  });

  it('is case-insensitive', () => {
    const matches = searchLogs(testLines, 'ERROR');
    expect(matches).toEqual([2, 4]);
  });

  it('finds single match', () => {
    const matches = searchLogs(testLines, 'database');
    expect(matches).toEqual([1]);
  });

  it('returns empty for no matches', () => {
    const matches = searchLogs(testLines, 'nonexistent');
    expect(matches).toEqual([]);
  });

  it('supports negative filter with - prefix', () => {
    const matches = searchLogs(testLines, '-error');
    // All lines except those containing "error"
    expect(matches).toEqual([0, 1, 3, 5, 6]);
  });

  it('returns empty for just - prefix', () => {
    expect(searchLogs(testLines, '-')).toEqual([]);
  });

  it('supports regex patterns', () => {
    const matches = searchLogs(testLines, 'GET|POST');
    expect(matches).toEqual([3]);
  });

  it('supports regex with dots', () => {
    const matches = searchLogs(testLines, 'port \\d+');
    expect(matches).toEqual([0]);
  });

  it('falls back to plain text on invalid regex', () => {
    // Unclosed bracket is invalid regex
    const matches = searchLogs(testLines, '[unclosed');
    // Should not throw, falls back to plain text
    expect(matches).toEqual([]);
  });

  it('handles empty lines array', () => {
    expect(searchLogs([], 'test')).toEqual([]);
  });

  it('finds lines with special characters', () => {
    const lines = [makeLine('response: 200 OK'), makeLine('path: /api/v1')];
    const matches = searchLogs(lines, '/api');
    expect(matches).toEqual([1]);
  });
});
