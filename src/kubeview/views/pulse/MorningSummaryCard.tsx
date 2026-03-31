import React from 'react';
import { Sparkles, Bot, DollarSign, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getMorningSummary } from '../../engine/mockData/pulseMocks';

export function MorningSummaryCard({ className }: { className?: string }) {
  const summary = getMorningSummary();

  return (
    <div
      className={cn(
        'relative rounded-lg border border-violet-500/30 bg-slate-900 p-5 overflow-hidden',
        className,
      )}
    >
      <div className="pointer-events-none absolute -inset-px rounded-lg bg-violet-500/5" />

      <div className="relative flex items-center gap-2 mb-4">
        <Sparkles className="h-5 w-5 text-violet-400" />
        <h2 className="text-lg font-semibold text-slate-100">
          {summary.greeting}
        </h2>
        <span className="text-sm text-slate-400 ml-auto">AI Briefing</span>
      </div>

      <div className="relative grid grid-cols-3 gap-4 mb-4">
        <StatItem
          icon={<Bot className="h-4 w-4 text-blue-400" />}
          label="Agent actions"
          value={String(summary.agentsCompleted)}
        />
        <StatItem
          icon={<DollarSign className="h-4 w-4 text-emerald-400" />}
          label="Cost delta"
          value={`${summary.costDelta > 0 ? '+' : ''}${summary.costDelta}%`}
          valueClass={summary.costDelta <= 0 ? 'text-emerald-400' : 'text-amber-400'}
        />
        <StatItem
          icon={<ClipboardList className="h-4 w-4 text-amber-400" />}
          label="Pending reviews"
          value={String(summary.pendingReviews)}
          valueClass={summary.pendingReviews > 0 ? 'text-amber-400' : undefined}
        />
      </div>

      <ul className="relative space-y-2">
        {summary.highlights.map((h, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
            {h}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatItem({
  icon,
  label,
  value,
  valueClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <div>
        <div className={cn('text-base font-semibold text-slate-100', valueClass)}>
          {value}
        </div>
        <div className="text-xs text-slate-500">{label}</div>
      </div>
    </div>
  );
}
