/**
 * LogSearch - Advanced log search with regex support
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Search, ChevronUp, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ParsedLogLine } from './LogParser';

interface LogSearchProps {
  lines: ParsedLogLine[];
  onMatchesChange: (matchIndices: number[]) => void;
  onActiveMatchChange: (index: number) => void;
}

export default function LogSearch({
  lines,
  onMatchesChange,
  onActiveMatchChange,
}: LogSearchProps) {
  const [query, setQuery] = useState('');
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const [isRegex, setIsRegex] = useState(false);

  // Detect if query looks like regex
  useEffect(() => {
    const regexChars = /[.*+?^${}()|[\]\\]/;
    setIsRegex(regexChars.test(query));
  }, [query]);

  // Find matching line indices
  const matches = useMemo(() => {
    if (!query) return [];

    const matchIndices: number[] = [];
    const isNegative = query.startsWith('-');
    const searchQuery = isNegative ? query.slice(1) : query;

    if (!searchQuery) return [];

    try {
      let matcher: (line: ParsedLogLine) => boolean;

      if (isRegex && !isNegative) {
        // Regex mode
        const regex = new RegExp(searchQuery, 'i');
        matcher = (line) => regex.test(line.message);
      } else {
        // Simple string search
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
      // Invalid regex, fall back to plain text search
      const lowerQuery = searchQuery.toLowerCase();
      lines.forEach((line, index) => {
        const matches = line.message.toLowerCase().includes(lowerQuery);
        if (isNegative ? !matches : matches) {
          matchIndices.push(index);
        }
      });
    }

    return matchIndices;
  }, [lines, query, isRegex]);

  // Notify parent of matches
  useEffect(() => {
    onMatchesChange(matches);
  }, [matches, onMatchesChange]);

  // Notify parent of active match
  useEffect(() => {
    if (matches.length > 0) {
      onActiveMatchChange(matches[activeMatchIndex]);
    }
  }, [matches, activeMatchIndex, onActiveMatchChange]);

  // Navigate to next match
  const handleNext = () => {
    if (matches.length === 0) return;
    const nextIndex = (activeMatchIndex + 1) % matches.length;
    setActiveMatchIndex(nextIndex);
  };

  // Navigate to previous match
  const handlePrevious = () => {
    if (matches.length === 0) return;
    const prevIndex = activeMatchIndex === 0 ? matches.length - 1 : activeMatchIndex - 1;
    setActiveMatchIndex(prevIndex);
  };

  // Clear search
  const handleClear = () => {
    setQuery('');
    setActiveMatchIndex(0);
  };

  // Keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        handlePrevious();
      } else {
        handleNext();
      }
    } else if (e.key === 'Escape') {
      handleClear();
    }
  };

  const matchCount = matches.length;
  const hasMatches = matchCount > 0;
  const isNegativeFilter = query.startsWith('-');

  return (
    <div className="flex items-center gap-2 bg-slate-900 border-b border-slate-700 px-3 py-2">
      {/* Search input */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search logs... (use - to exclude, supports regex)"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveMatchIndex(0);
          }}
          onKeyDown={handleKeyDown}
          className={cn(
            'w-full pl-8 pr-8 py-1.5 text-sm rounded transition-colors',
            'bg-slate-800 border text-slate-200 placeholder-slate-500',
            'focus:outline-none focus:ring-2',
            hasMatches
              ? 'border-slate-600 focus:ring-green-500'
              : query
              ? 'border-amber-600 focus:ring-amber-500'
              : 'border-slate-600 focus:ring-blue-500'
          )}
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Match count and navigation */}
      {query && (
        <>
          <div className="text-xs text-slate-400 whitespace-nowrap">
            {isNegativeFilter ? (
              <span>
                {matchCount} of {lines.length} lines {hasMatches ? 'shown' : 'excluded'}
              </span>
            ) : hasMatches ? (
              <span>
                {activeMatchIndex + 1} of {matchCount} match{matchCount !== 1 ? 'es' : ''}
              </span>
            ) : (
              <span className="text-amber-400">No matches</span>
            )}
          </div>

          {!isNegativeFilter && hasMatches && (
            <div className="flex items-center gap-0.5">
              <button
                onClick={handlePrevious}
                className="p-1 hover:bg-slate-700 rounded text-slate-300 transition-colors"
                title="Previous match (Shift+Enter)"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <button
                onClick={handleNext}
                className="p-1 hover:bg-slate-700 rounded text-slate-300 transition-colors"
                title="Next match (Enter)"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          )}

          {isRegex && (
            <div className="text-xs text-blue-400 font-mono px-2 py-0.5 bg-blue-900/30 rounded">
              regex
            </div>
          )}
        </>
      )}
    </div>
  );
}
