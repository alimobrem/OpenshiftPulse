export interface MorningSummary {
  greeting: string;
  agentsCompleted: number;
  costDelta: number;
  pendingReviews: number;
  highlights: string[];
}

export interface OvernightAction {
  id: string;
  agent: string;
  action: string;
  time: string;
  result: 'success' | 'failed' | 'skipped';
  riskLevel: 'low' | 'medium' | 'high';
}

export interface CostTrend {
  dataPoints: number[];
  changePercent: number;
  direction: 'up' | 'down' | 'flat';
}

export function getMorningSummary(): MorningSummary {
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return {
    greeting,
    agentsCompleted: 7,
    costDelta: -3.2,
    pendingReviews: 2,
    highlights: [
      'Control plane healthy — all 3 masters responding within SLA.',
      'Agent patched 2 CrashLoopBackOff pods overnight (frontend-web, metrics-proxy).',
      'Cluster CPU averaged 62% — consider scaling down idle workloads in staging.',
    ],
  };
}

export function getOvernightActivity(): OvernightAction[] {
  return [
    {
      id: 'oa-1',
      agent: 'SRE Agent',
      action: 'Restarted pod frontend-web-6f8b4 (CrashLoopBackOff)',
      time: '03:12',
      result: 'success',
      riskLevel: 'low',
    },
    {
      id: 'oa-2',
      agent: 'SRE Agent',
      action: 'Restarted pod metrics-proxy-9c1a2 (CrashLoopBackOff)',
      time: '03:14',
      result: 'success',
      riskLevel: 'low',
    },
    {
      id: 'oa-3',
      agent: 'Security Agent',
      action: 'Scanned 142 images — no new CVEs above threshold',
      time: '04:00',
      result: 'success',
      riskLevel: 'low',
    },
    {
      id: 'oa-4',
      agent: 'SRE Agent',
      action: 'Attempted certificate rotation for ingress-controller',
      time: '04:45',
      result: 'failed',
      riskLevel: 'medium',
    },
    {
      id: 'oa-5',
      agent: 'SRE Agent',
      action: 'Scaled down staging-idle deployment (0 traffic for 6h)',
      time: '05:30',
      result: 'skipped',
      riskLevel: 'high',
    },
  ];
}

export function getCostTrend(): CostTrend {
  return {
    dataPoints: [142, 148, 145, 151, 147, 139, 137],
    changePercent: -3.2,
    direction: 'down',
  };
}
