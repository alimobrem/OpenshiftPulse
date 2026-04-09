export interface EvalSuiteSummary {
  gate_passed: boolean;
  scenario_count: number;
  average_overall: number;
  passed_count?: number;
  dimension_averages?: Record<string, number>;
  blocker_counts?: Record<string, number>;
}

export interface PromptAuditSection {
  name: string;
  chars: number;
  pct: number;
}

export interface PromptAudit {
  mode: string;
  sections: PromptAuditSection[];
  total_chars: number;
  estimated_tokens: number;
}

export interface AgentEvalStatus {
  quality_gate_passed: boolean;
  generated_at_ms?: number;
  release?: EvalSuiteSummary;
  safety?: EvalSuiteSummary;
  integration?: EvalSuiteSummary;
  view_designer?: EvalSuiteSummary;
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
  prompt_audit?: Record<string, PromptAudit>;
}

export async function fetchAgentEvalStatus(): Promise<AgentEvalStatus | null> {
  const res = await fetch('/api/agent/eval/status');
  if (!res.ok) return null;
  const data = await res.json();
  // Validate response shape before returning
  if (
    typeof data !== 'object' ||
    data === null ||
    typeof data.quality_gate_passed !== 'boolean'
  ) {
    return null;
  }
  return data as AgentEvalStatus;
}
