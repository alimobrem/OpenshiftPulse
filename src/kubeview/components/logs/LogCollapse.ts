/**
 * LogCollapse - Utility to collapse repeated similar log lines
 */

import type { ParsedLogLine } from './LogParser';

export interface CollapsedGroup {
  representative: ParsedLogLine;
  count: number;
  firstIndex: number;
  lastIndex: number;
  collapsed: boolean;
}

/**
 * Check if two messages are similar (differ only in numbers, UUIDs, timestamps, IPs)
 */
export function areSimilar(a: string, b: string): boolean {
  const normalized1 = normalizeMessage(a);
  const normalized2 = normalizeMessage(b);
  return normalized1 === normalized2;
}

/**
 * Normalize a message by replacing variable parts with placeholders
 */
function normalizeMessage(message: string): string {
  return message
    // Replace UUIDs (8-4-4-4-12 hex pattern)
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<UUID>')
    // Replace timestamps (various formats)
    .replace(/\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(\.\d+)?Z?/g, '<TIMESTAMP>')
    .replace(/\d{2}\/\d{2}\/\d{4}\s\d{2}:\d{2}:\d{2}/g, '<TIMESTAMP>')
    // Replace IP addresses (IPv4)
    .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '<IP>')
    // Replace hex values (0x followed by hex digits)
    .replace(/\b0x[0-9a-f]+\b/gi, '<HEX>')
    // Replace numbers (including those followed by units like "123ms", "456MB")
    .replace(/\d+/g, '<NUM>')
    // Replace quoted strings with variable content
    .replace(/"[^"]*"/g, '<STR>')
    .replace(/'[^']*'/g, '<STR>');
}

/**
 * Collapse repeated similar log lines into groups
 *
 * @param lines - Array of parsed log lines
 * @param threshold - Minimum number of consecutive similar lines to collapse (default: 3)
 * @returns Array of log lines and collapsed groups
 */
export function collapseRepeatedLines(
  lines: ParsedLogLine[],
  threshold: number = 3
): (ParsedLogLine | CollapsedGroup)[] {
  if (lines.length === 0) return [];

  const result: (ParsedLogLine | CollapsedGroup)[] = [];
  let i = 0;

  while (i < lines.length) {
    const currentLine = lines[i];
    let groupSize = 1;

    // Find consecutive similar lines with same level
    while (
      i + groupSize < lines.length &&
      currentLine.level === lines[i + groupSize].level &&
      areSimilar(currentLine.message, lines[i + groupSize].message)
    ) {
      groupSize++;
    }

    // If we have enough similar lines, create a collapsed group
    if (groupSize >= threshold) {
      result.push({
        representative: currentLine,
        count: groupSize,
        firstIndex: i,
        lastIndex: i + groupSize - 1,
        collapsed: true,
      });
      i += groupSize;
    } else {
      // Add individual lines
      for (let j = 0; j < groupSize; j++) {
        result.push(lines[i + j]);
      }
      i += groupSize;
    }
  }

  return result;
}

/**
 * Expand a collapsed group back into individual lines
 */
export function expandGroup(group: CollapsedGroup, allLines: ParsedLogLine[]): ParsedLogLine[] {
  return allLines.slice(group.firstIndex, group.lastIndex + 1);
}

/**
 * Toggle a group's collapsed state
 */
export function toggleGroupCollapse(
  items: (ParsedLogLine | CollapsedGroup)[],
  groupIndex: number,
  allLines: ParsedLogLine[]
): (ParsedLogLine | CollapsedGroup)[] {
  const result = [...items];
  const item = result[groupIndex];

  if ('collapsed' in item) {
    if (item.collapsed) {
      // Expand: replace group with individual lines
      const expanded = expandGroup(item, allLines);
      result.splice(groupIndex, 1, ...expanded);
    } else {
      // This shouldn't happen as we only create collapsed groups
      // But handle it anyway
      result[groupIndex] = { ...item, collapsed: true };
    }
  }

  return result;
}

/**
 * Check if an item is a collapsed group
 */
export function isCollapsedGroup(item: ParsedLogLine | CollapsedGroup): item is CollapsedGroup {
  return 'collapsed' in item && 'count' in item;
}
