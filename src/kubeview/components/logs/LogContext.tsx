/**
 * LogContext - Context panel shown when clicking a log line
 */

import React, { useMemo } from 'react';
import { X, Copy, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ParsedLogLine } from './LogParser';
import { areSimilar } from './LogCollapse';

interface LogContextProps {
  line: ParsedLogLine;
  lineIndex: number;
  allLines: ParsedLogLine[];
  onClose: () => void;
}

const CONTEXT_LINES = 5;

export default function LogContext({
  line,
  lineIndex,
  allLines,
  onClose,
}: LogContextProps) {
  // Get surrounding context lines
  const contextLines = useMemo(() => {
    const start = Math.max(0, lineIndex - CONTEXT_LINES);
    const end = Math.min(allLines.length, lineIndex + CONTEXT_LINES + 1);
    return allLines.slice(start, end).map((l, i) => ({
      line: l,
      index: start + i,
      isSelected: start + i === lineIndex,
    }));
  }, [allLines, lineIndex]);

  // Find similar error lines
  const similarLines = useMemo(() => {
    if (!line.level || !['error', 'fatal', 'warn'].includes(line.level)) {
      return null;
    }

    const similar = allLines
      .map((l, i) => ({ line: l, index: i }))
      .filter(
        ({ line: l, index: i }) =>
          i !== lineIndex &&
          l.level === line.level &&
          areSimilar(l.message, line.message)
      );

    if (similar.length === 0) return null;

    // Get time range
    const timestamps = similar
      .map(({ line: l }) => l.timestamp)
      .filter((t): t is Date => t !== undefined);

    if (timestamps.length === 0) return { count: similar.length };

    const firstTime = new Date(Math.min(...timestamps.map((t) => t.getTime())));
    const lastTime = new Date(Math.max(...timestamps.map((t) => t.getTime())));
    const duration = lastTime.getTime() - firstTime.getTime();

    return {
      count: similar.length,
      firstTime,
      lastTime,
      duration,
      indices: similar.map(({ index }) => index),
    };
  }, [allLines, line, lineIndex]);

  // Format duration in human-readable form
  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
    return `${Math.round(ms / 3600000)}h`;
  };

  // Copy line to clipboard
  const handleCopyLine = () => {
    const text = formatLogLine(line);
    navigator.clipboard.writeText(text);
  };

  // Copy line with context
  const handleCopyContext = () => {
    const text = contextLines.map(({ line: l }) => formatLogLine(l)).join('\n');
    navigator.clipboard.writeText(text);
  };

  // Format log line as text
  const formatLogLine = (l: ParsedLogLine): string => {
    const ts = l.timestamp ? l.timestamp.toISOString() + ' ' : '';
    const level = l.level && l.level !== 'unknown' ? `[${l.level.toUpperCase()}] ` : '';
    return `${ts}${level}${l.message}`;
  };

  // Get level color
  const getLevelColor = (level?: ParsedLogLine['level']) => {
    switch (level) {
      case 'debug':
        return 'text-slate-400';
      case 'info':
        return 'text-slate-200';
      case 'warn':
        return 'text-amber-400';
      case 'error':
        return 'text-red-400';
      case 'fatal':
        return 'text-red-500';
      default:
        return 'text-slate-300';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-slate-400" />
            <div>
              <h3 className="font-semibold text-slate-200">Log Line Context</h3>
              <p className="text-xs text-slate-400">Line {lineIndex + 1}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Context lines */}
          <div>
            <h4 className="text-sm font-semibold text-slate-300 mb-2">
              Context ({CONTEXT_LINES} lines before & after)
            </h4>
            <div className="bg-slate-950 rounded border border-slate-700 font-mono text-xs overflow-auto">
              {contextLines.map(({ line: l, index, isSelected }) => (
                <div
                  key={index}
                  className={cn(
                    'flex px-3 py-1 border-b border-slate-800 last:border-b-0',
                    isSelected ? 'bg-blue-900/30 border-l-4 border-l-blue-500' : '',
                    getLevelColor(l.level)
                  )}
                >
                  <div className="w-14 flex-shrink-0 text-right pr-3 text-slate-500">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    {l.timestamp && (
                      <span className="text-slate-500 mr-2">
                        {l.timestamp.toISOString().replace('T', ' ').slice(0, 23)}
                      </span>
                    )}
                    {l.level && l.level !== 'unknown' && (
                      <span className="font-semibold mr-2">[{l.level.toUpperCase()}]</span>
                    )}
                    <span className="break-all">{l.message}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Structured fields (if any) */}
          {line.fields && Object.keys(line.fields).length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-300 mb-2">Structured Fields</h4>
              <div className="bg-slate-950 rounded border border-slate-700 p-3 space-y-1">
                {Object.entries(line.fields).map(([key, value]) => (
                  <div key={key} className="flex gap-2 text-xs">
                    <span className="text-slate-400 font-mono">{key}:</span>
                    <span className="text-slate-200 font-mono break-all">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Similar errors */}
          {similarLines && (
            <div>
              <h4 className="text-sm font-semibold text-slate-300 mb-2">Similar Occurrences</h4>
              <div className="bg-slate-950 rounded border border-slate-700 p-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-slate-400">Total occurrences:</span>
                    <span className="ml-2 text-slate-200 font-semibold">
                      {similarLines.count + 1}
                    </span>
                  </div>
                  {similarLines.firstTime && similarLines.lastTime && (
                    <>
                      <div>
                        <span className="text-slate-400">Time range:</span>
                        <span className="ml-2 text-slate-200 font-mono text-xs">
                          {similarLines.firstTime.toISOString().slice(11, 23)} →{' '}
                          {similarLines.lastTime.toISOString().slice(11, 23)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">Duration:</span>
                        <span className="ml-2 text-slate-200 font-semibold">
                          {formatDuration(similarLines.duration)}
                        </span>
                      </div>
                    </>
                  )}
                  <div>
                    <span className="text-slate-400">Level:</span>
                    <span className={cn('ml-2 font-semibold', getLevelColor(line.level))}>
                      {line.level?.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Raw line */}
          <div>
            <h4 className="text-sm font-semibold text-slate-300 mb-2">Raw Log Line</h4>
            <div className="bg-slate-950 rounded border border-slate-700 p-3 font-mono text-xs text-slate-200 break-all">
              {line.raw}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-700">
          <button
            onClick={handleCopyLine}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors"
          >
            <Copy className="w-4 h-4" />
            Copy Line
          </button>
          <button
            onClick={handleCopyContext}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
          >
            <Copy className="w-4 h-4" />
            Copy with Context
          </button>
        </div>
      </div>
    </div>
  );
}
