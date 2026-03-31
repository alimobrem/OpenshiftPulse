import React from 'react';
import { Lightbulb, ArrowRight, Shield, Zap, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CostTrendSparkline } from './CostTrendSparkline';

interface Insight {
  id: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}

const insights: Insight[] = [
  {
    id: 'ins-1',
    icon: <Shield className="h-4 w-4 text-violet-400" />,
    title: 'Security posture',
    body: 'No new critical CVEs detected. 2 medium findings from last scan — review recommended.',
  },
  {
    id: 'ins-2',
    icon: <Zap className="h-4 w-4 text-amber-400" />,
    title: 'Resource efficiency',
    body: '3 deployments in staging have < 5% CPU utilization over 24h. Consider scaling down.',
  },
  {
    id: 'ins-3',
    icon: <BarChart3 className="h-4 w-4 text-blue-400" />,
    title: 'Capacity forecast',
    body: 'At current growth, worker node memory will reach 85% in ~12 days.',
  },
];

interface QuickAction {
  label: string;
  route: string;
  title: string;
}

const quickActions: QuickAction[] = [
  { label: 'View incidents', route: '/incidents', title: 'Incidents' },
  { label: 'Check readiness', route: '/onboarding', title: 'Onboarding' },
  { label: 'Review alerts', route: '/alerts', title: 'Alerts' },
];

export function InsightsRail({ className, onNavigate }: { className?: string; onNavigate?: (route: string, title: string) => void }) {
  return (
    <aside className={cn('space-y-4', className)}>
      {/* Cost trend card */}
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h3 className="text-sm font-semibold text-slate-100 mb-3">7-day Cost Trend</h3>
        <CostTrendSparkline />
      </div>

      {/* Insight cards */}
      {insights.map((ins) => (
        <div
          key={ins.id}
          className="rounded-lg border border-slate-800 bg-slate-900 p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            {ins.icon}
            <h4 className="text-sm font-medium text-slate-100">{ins.title}</h4>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">{ins.body}</p>
        </div>
      ))}

      {/* Quick action pills */}
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="h-4 w-4 text-yellow-400" />
          <h4 className="text-sm font-medium text-slate-100">Quick Actions</h4>
        </div>
        <div className="flex flex-wrap gap-2">
          {quickActions.map((qa) => (
            <button
              key={qa.route}
              onClick={() => onNavigate?.(qa.route, qa.title)}
              className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:border-violet-500/50 hover:text-slate-100 transition-colors"
            >
              {qa.label}
              <ArrowRight className="h-3 w-3" />
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
