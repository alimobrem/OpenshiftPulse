import { cn } from '@/lib/utils';
import type { ConfidenceBadgeSpec } from '../../engine/agentComponents';

export function AgentConfidenceBadge({ spec }: { spec: ConfidenceBadgeSpec }) {
  const pct = Math.round(spec.score * 100);
  const color =
    spec.score > 0.8
      ? 'bg-emerald-900/40 text-emerald-400 border-emerald-800'
      : spec.score >= 0.5
        ? 'bg-amber-900/40 text-amber-400 border-amber-800'
        : 'bg-red-900/40 text-red-400 border-red-800';

  return (
    <span
      className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border', color)}
      role="status"
      aria-label={`Confidence: ${pct}%`}
    >
      {spec.label && <span className="text-slate-400 mr-0.5">{spec.label}:</span>}
      {pct}%
    </span>
  );
}
