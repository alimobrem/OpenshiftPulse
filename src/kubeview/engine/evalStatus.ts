export interface EvalSuiteSummary {
  gate_passed: boolean;
  scenario_count: number;
  average_overall: number;
}

export interface AgentEvalStatus {
  quality_gate_passed: boolean;
  generated_at_ms?: number;
  release?: EvalSuiteSummary & { blocker_counts?: Record<string, number> };
  safety?: EvalSuiteSummary;
  integration?: EvalSuiteSummary;
  outcomes?: {
    gate_passed: boolean;
    current_actions: number;
    baseline_actions: number;
    regressions: Record<string, boolean>;
    policy?: {
      version?: number;
      thresholds?: {
        success_rate_delta_min?: number;
        rollback_rate_delta_max?: number;
        p95_duration_ms_delta_max?: number;
      };
    };
  };
}

export async function fetchAgentEvalStatus(): Promise<AgentEvalStatus | null> {
  const res = await fetch('/api/agent/eval/status');
  if (!res.ok) return null;
  return res.json();
}
