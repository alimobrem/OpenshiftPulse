/**
 * PromQLEditor - PromQL query editor with autocomplete
 *
 * Features:
 * - Code editor style input
 * - Metric name autocomplete from Prometheus
 * - Query history dropdown
 * - Execute on Enter
 */

import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { PlayIcon, ClockIcon } from 'lucide-react';

const PROM_BASE = '/api/prometheus';

export interface PromQLEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExecute: (query: string) => void;  // Enter to execute
  history?: string[];                   // recent queries
  loading?: boolean;
}

export function PromQLEditor({
  value,
  onChange,
  onExecute,
  history = [],
  loading = false,
}: PromQLEditorProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch metric names for autocomplete
  useEffect(() => {
    const fetchMetricNames = async () => {
      try {
        const res = await fetch(`${PROM_BASE}/api/v1/label/__name__/values`);
        if (!res.ok) return;
        const json = await res.json();
        if (json.status === 'success' && Array.isArray(json.data)) {
          setSuggestions(json.data.sort());
        }
      } catch {
        // Ignore errors
      }
    };

    fetchMetricNames();
  }, []);

  // Filter suggestions based on current input
  const filteredSuggestions = suggestions.filter((s) =>
    s.toLowerCase().includes(value.toLowerCase())
  ).slice(0, 10);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (showSuggestions && filteredSuggestions.length > 0) {
        onChange(filteredSuggestions[selectedIndex]);
        setShowSuggestions(false);
      } else {
        onExecute(value);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (showSuggestions) {
        setSelectedIndex((prev) => (prev + 1) % filteredSuggestions.length);
      } else if (showHistory) {
        setSelectedIndex((prev) => (prev + 1) % history.length);
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (showSuggestions) {
        setSelectedIndex((prev) => (prev - 1 + filteredSuggestions.length) % filteredSuggestions.length);
      } else if (showHistory) {
        setSelectedIndex((prev) => (prev - 1 + history.length) % history.length);
      }
      return;
    }

    if (e.key === 'Escape') {
      setShowSuggestions(false);
      setShowHistory(false);
      return;
    }
  };

  const handleChange = (newValue: string) => {
    onChange(newValue);
    setShowSuggestions(newValue.length > 0 && filteredSuggestions.length > 0);
    setSelectedIndex(0);
  };

  const handleExecute = () => {
    onExecute(value);
    setShowSuggestions(false);
    setShowHistory(false);
  };

  const handleSelectSuggestion = (suggestion: string) => {
    onChange(suggestion);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleSelectHistory = (query: string) => {
    onChange(query);
    setShowHistory(false);
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (value.length > 0 && filteredSuggestions.length > 0) {
              setShowSuggestions(true);
            }
          }}
          placeholder="Enter PromQL query..."
          className={cn(
            'flex-1 bg-transparent px-3 py-2 text-sm font-mono text-slate-200',
            'placeholder:text-slate-500 outline-none'
          )}
          disabled={loading}
        />

        {/* History button */}
        {history.length > 0 && (
          <button
            onClick={() => {
              setShowHistory(!showHistory);
              setShowSuggestions(false);
            }}
            className="px-2 py-1 text-slate-400 hover:text-slate-200 transition-colors"
            title="Query history"
          >
            <ClockIcon size={16} />
          </button>
        )}

        {/* Execute button */}
        <button
          onClick={handleExecute}
          disabled={loading || !value}
          className={cn(
            'px-3 py-2 flex items-center gap-1.5 text-sm font-medium rounded-r',
            'bg-blue-600 text-white hover:bg-blue-700 transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <PlayIcon size={16} />
          )}
          Run
        </button>
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded shadow-lg z-10 max-h-60 overflow-y-auto">
          {filteredSuggestions.map((suggestion, i) => (
            <button
              key={suggestion}
              onClick={() => handleSelectSuggestion(suggestion)}
              className={cn(
                'w-full px-3 py-2 text-left text-sm font-mono hover:bg-slate-700 transition-colors',
                i === selectedIndex ? 'bg-slate-700' : ''
              )}
            >
              <span className="text-slate-200">{suggestion}</span>
            </button>
          ))}
        </div>
      )}

      {/* History dropdown */}
      {showHistory && history.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded shadow-lg z-10 max-h-60 overflow-y-auto">
          <div className="px-3 py-2 text-xs text-slate-400 border-b border-slate-700">
            Recent Queries
          </div>
          {history.map((query, i) => (
            <button
              key={i}
              onClick={() => handleSelectHistory(query)}
              className={cn(
                'w-full px-3 py-2 text-left text-sm font-mono hover:bg-slate-700 transition-colors',
                'truncate',
                i === selectedIndex ? 'bg-slate-700' : ''
              )}
            >
              <span className="text-slate-200">{query}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
