import { DrawerShell } from '../../components/primitives/DrawerShell';
import type { AgentEvalStatus } from '../../engine/evalStatus';

interface EvalDrawerProps {
  evalStatus: AgentEvalStatus | null | undefined;
  onClose: () => void;
}

const SUITES = ['release', 'safety', 'integration', 'view_designer'] as const;

export function EvalDrawer({ evalStatus, onClose }: EvalDrawerProps) {
  return (
    <DrawerShell title="Quality Gate Details" onClose={onClose}>
      <div className="space-y-4 text-sm text-slate-300">
        {evalStatus ? (
          <>
            {SUITES.map((suite) => {
              const s = evalStatus[suite];
              if (!s) return null;
              return (
                <div key={suite} className="bg-slate-900 rounded-lg border border-slate-800 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-slate-200 capitalize">{suite.replace(/_/g, ' ')}</h3>
                    <span className={s.gate_passed ? 'text-emerald-400' : 'text-red-400'}>
                      {s.gate_passed ? 'PASS' : 'FAIL'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400">
                    {s.scenario_count} scenarios &middot; avg {Math.round((s.average_overall || 0) * 100)}%
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          <div className="text-slate-500">Loading eval data...</div>
        )}
      </div>
    </DrawerShell>
  );
}
