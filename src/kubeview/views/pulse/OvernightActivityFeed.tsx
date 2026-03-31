import React, { useState } from 'react';
import { Moon, CheckCircle, XCircle, SkipForward, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getOvernightActivity, type OvernightAction } from '../../engine/mockData/pulseMocks';
import { Badge } from '../../components/primitives/Badge';

const INITIAL_VISIBLE = 3;

const resultConfig: Record<OvernightAction['result'], { icon: React.ReactNode; variant: 'success' | 'error' | 'warning' }> = {
  success: { icon: <CheckCircle className="h-4 w-4 text-emerald-400" />, variant: 'success' },
  failed: { icon: <XCircle className="h-4 w-4 text-red-400" />, variant: 'error' },
  skipped: { icon: <SkipForward className="h-4 w-4 text-amber-400" />, variant: 'warning' },
};

export function OvernightActivityFeed({ className }: { className?: string }) {
  const [expanded, setExpanded] = useState(false);
  const items = getOvernightActivity();
  const visible = expanded ? items : items.slice(0, INITIAL_VISIBLE);
  const hasMore = items.length > INITIAL_VISIBLE;

  return (
    <div className={cn('rounded-lg border border-slate-800 bg-slate-900 p-4', className)}>
      <div className="flex items-center gap-2 mb-4">
        <Moon className="h-4 w-4 text-indigo-400" />
        <h3 className="text-sm font-semibold text-slate-100">Overnight Activity</h3>
        <span className="ml-auto text-xs text-slate-500">{items.length} actions</span>
      </div>

      <div className="relative ml-2 border-l border-slate-700 pl-4 space-y-4">
        {visible.map((item) => {
          const cfg = resultConfig[item.result];
          return (
            <div key={item.id} className="relative">
              <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-slate-900 bg-slate-500" />
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm text-slate-200 truncate">{item.action}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {item.agent} &middot; {item.time}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={cfg.variant} size="sm">{item.result}</Badge>
                  {cfg.icon}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" /> Show less
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" /> Show {items.length - INITIAL_VISIBLE} more
            </>
          )}
        </button>
      )}
    </div>
  );
}
