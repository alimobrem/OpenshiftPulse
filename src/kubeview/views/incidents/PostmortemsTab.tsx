import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FileText, ChevronDown, ChevronUp, AlertTriangle, CheckCircle,
  Target, Clock, Shield, Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '../../components/primitives/Card';
import { EmptyState } from '../../components/primitives/EmptyState';
import { formatRelativeTime } from '../../engine/formatters';

interface Postmortem {
  id: string;
  incident_type: string;
  plan_id: string;
  timeline: string;
  root_cause: string;
  contributing_factors: string[];
  blast_radius: string[];
  actions_taken: string[];
  prevention: string[];
  metrics_impact: string;
  confidence: number;
  generated_at: number;
}

async function fetchPostmortems(): Promise<{ postmortems: Postmortem[]; total: number }> {
  const res = await fetch('/api/agent/postmortems');
  if (!res.ok) return { postmortems: [], total: 0 };
  return res.json();
}

const INCIDENT_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  crashloop: AlertTriangle,
  oom: Activity,
  security: Shield,
  node: Target,
};

export function PostmortemsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['postmortems'],
    queryFn: fetchPostmortems,
    refetchInterval: 60_000,
  });

  const postmortems = data?.postmortems ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <span className="text-slate-500 text-sm">Loading postmortems...</span>
      </div>
    );
  }

  if (postmortems.length === 0) {
    return (
      <EmptyState
        icon={<FileText className="w-8 h-8 text-slate-500" />}
        title="No postmortems yet"
        description="Postmortems are auto-generated after investigation plans complete. They will appear here as the agent resolves incidents."
      />
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Auto-generated after each investigation. Includes timeline, root cause analysis, and prevention recommendations.
      </p>
      {postmortems.map((pm) => (
        <PostmortemCard key={pm.id} postmortem={pm} />
      ))}
    </div>
  );
}

function PostmortemCard({ postmortem }: { postmortem: Postmortem }) {
  const [expanded, setExpanded] = useState(false);
  const IconComponent = INCIDENT_TYPE_ICONS[postmortem.incident_type] || FileText;

  return (
    <Card>
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full px-4 py-3 flex items-start gap-3 hover:bg-slate-800/30 transition-colors text-left"
      >
        <IconComponent className="w-5 h-5 text-violet-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-medium text-slate-200">
              {postmortem.incident_type.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
            </span>
            <span className="text-xs px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded">
              {postmortem.plan_id}
            </span>
            {postmortem.confidence >= 0.8 && (
              <span className="text-xs px-1.5 py-0.5 bg-emerald-900/50 text-emerald-300 rounded flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                High confidence
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 line-clamp-2">
            {postmortem.root_cause || 'Root cause analysis pending...'}
          </p>
          <span className="text-xs text-slate-600 mt-1 inline-block">
            <Clock className="w-3 h-3 inline mr-1" />
            {formatRelativeTime(postmortem.generated_at)}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
        )}
      </button>
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-800 pt-3 space-y-4">
          {/* Timeline */}
          {postmortem.timeline && (
            <Section title="Timeline" icon={Clock}>
              <p className="text-xs text-slate-300 whitespace-pre-wrap">{postmortem.timeline}</p>
            </Section>
          )}

          {/* Root Cause */}
          {postmortem.root_cause && (
            <Section title="Root Cause" icon={Target}>
              <p className="text-xs text-slate-300 whitespace-pre-wrap">{postmortem.root_cause}</p>
            </Section>
          )}

          {/* Contributing Factors */}
          {postmortem.contributing_factors.length > 0 && (
            <Section title="Contributing Factors" icon={AlertTriangle}>
              <ul className="space-y-1">
                {postmortem.contributing_factors.map((f, i) => (
                  <li key={i} className="text-xs text-slate-400 flex items-start gap-1.5">
                    <span className="text-amber-500 mt-0.5">-</span>
                    {f}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Blast Radius */}
          {postmortem.blast_radius.length > 0 && (
            <Section title="Impact / Blast Radius" icon={Activity}>
              <div className="flex flex-wrap gap-1">
                {postmortem.blast_radius.map((r, i) => (
                  <span key={i} className="text-xs font-mono px-1.5 py-0.5 bg-red-900/30 text-red-300 rounded border border-red-800/30">
                    {r}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* Actions Taken */}
          {postmortem.actions_taken.length > 0 && (
            <Section title="Actions Taken" icon={CheckCircle}>
              <ul className="space-y-1">
                {postmortem.actions_taken.map((a, i) => (
                  <li key={i} className="text-xs text-emerald-300 flex items-start gap-1.5">
                    <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                    {a}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Prevention */}
          {postmortem.prevention.length > 0 && (
            <Section title="Prevention Recommendations" icon={Shield}>
              <ul className="space-y-1">
                {postmortem.prevention.map((p, i) => (
                  <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5">
                    <span className="text-violet-400 mt-0.5">-</span>
                    {p}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Metrics Impact */}
          {postmortem.metrics_impact && (
            <Section title="Metrics Impact" icon={Activity}>
              <p className="text-xs text-slate-400">{postmortem.metrics_impact}</p>
            </Section>
          )}
        </div>
      )}
    </Card>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
        <Icon className="w-3 h-3" />
        {title}
      </h3>
      {children}
    </div>
  );
}
