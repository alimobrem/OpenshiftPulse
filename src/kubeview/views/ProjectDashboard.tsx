import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Package, Server, Globe, Shield, Clock, AlertTriangle, CheckCircle, XCircle,
  Activity, Layers, FileText, ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '../components/primitives/Card';
import { MetricGrid } from '../components/primitives/MetricGrid';
import { MetricCard } from '../components/metrics/Sparkline';
import { useK8sListWatch } from '../hooks/useK8sListWatch';
import { useNavigateTab } from '../hooks/useNavigateTab';
import { CHART_COLORS } from '../engine/colors';
import { formatRelativeTime } from '../engine/formatters';
import { sanitizePromQL } from '../engine/query';
import type { Pod, Deployment, StatefulSet, DaemonSet, Service } from '../engine/types';
import type { K8sResource } from '../engine/renderers';
import { getPodStatus } from '../engine/renderers/statusUtils';

export default function ProjectDashboard() {
  const { namespace } = useParams<{ namespace: string }>();
  const navigate = useNavigate();
  const go = useNavigateTab();
  const ns = namespace || 'default';
  const safeNs = sanitizePromQL(ns);

  // Fetch all namespaces for the dropdown
  const { data: allNamespaces = [] } = useK8sListWatch<K8sResource>({ apiPath: '/api/v1/namespaces' });

  const { data: pods = [] } = useK8sListWatch<Pod>({ apiPath: '/api/v1/pods', namespace: ns });
  const { data: deployments = [] } = useK8sListWatch<Deployment>({ apiPath: '/apis/apps/v1/deployments', namespace: ns });
  const { data: statefulsets = [] } = useK8sListWatch<StatefulSet>({ apiPath: '/apis/apps/v1/statefulsets', namespace: ns });
  const { data: daemonsets = [] } = useK8sListWatch<DaemonSet>({ apiPath: '/apis/apps/v1/daemonsets', namespace: ns });
  const { data: services = [] } = useK8sListWatch<K8sResource>({ apiPath: '/api/v1/services', namespace: ns });
  const { data: configmaps = [] } = useK8sListWatch<K8sResource>({ apiPath: '/api/v1/configmaps', namespace: ns });
  const { data: events = [] } = useK8sListWatch<K8sResource>({ apiPath: '/api/v1/events', namespace: ns });

  const podStats = useMemo(() => {
    const s = { running: 0, pending: 0, failed: 0, total: pods.length };
    for (const p of pods) {
      const status = getPodStatus(p);
      const phase = typeof status === 'string' ? status : status?.phase || '';
      if (phase === 'Running') s.running++;
      else if (phase === 'Pending') s.pending++;
      else if (phase === 'Failed' || phase === 'CrashLoop' || phase === 'Error') s.failed++;
    }
    return s;
  }, [pods]);

  const warningEvents = useMemo(
    () => events.filter((e: any) => e.type === 'Warning').slice(0, 10),
    [events],
  );

  return (
    <div className="h-full overflow-auto bg-slate-950 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header with namespace selector */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
              <Layers className="w-6 h-6 text-blue-500" />
              {ns}
            </h1>
            <p className="text-sm text-slate-400 mt-1">Project overview — all resources at a glance</p>
          </div>
          <div className="relative">
            <select
              value={ns}
              onChange={(e) => navigate(`/project/${e.target.value}`)}
              className="appearance-none bg-slate-900 border border-slate-700 rounded-lg pl-3 pr-8 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              {allNamespaces
                .map((n: any) => n.metadata?.name)
                .filter(Boolean)
                .sort()
                .map((name: string) => (
                  <option key={name} value={name}>{name}</option>
                ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <SummaryCard label="Pods" count={pods.length} icon={<Server className="w-4 h-4" />}
            color={podStats.failed > 0 ? 'text-red-400' : 'text-emerald-400'} />
          <SummaryCard label="Deployments" count={deployments.length} icon={<Package className="w-4 h-4" />} color="text-blue-400" />
          <SummaryCard label="StatefulSets" count={statefulsets.length} icon={<Layers className="w-4 h-4" />} color="text-violet-400" />
          <SummaryCard label="DaemonSets" count={daemonsets.length} icon={<Shield className="w-4 h-4" />} color="text-amber-400" />
          <SummaryCard label="Services" count={services.length} icon={<Globe className="w-4 h-4" />} color="text-cyan-400" />
          <SummaryCard label="ConfigMaps" count={configmaps.length} icon={<FileText className="w-4 h-4" />} color="text-slate-400" />
          <SummaryCard label="Events" count={warningEvents.length} icon={<AlertTriangle className="w-4 h-4" />}
            color={warningEvents.length > 0 ? 'text-amber-400' : 'text-slate-400'} />
        </div>

        {/* Metrics */}
        <MetricGrid>
          <MetricCard
            title="Pod CPU Usage"
            query={`sum(rate(container_cpu_usage_seconds_total{namespace="${safeNs}",container!=""}[5m])) / sum(kube_pod_container_resource_requests{namespace="${safeNs}",resource="cpu"}) * 100`}
            unit="%"
            color={CHART_COLORS.blue}
            thresholds={{ warning: 70, critical: 90 }}
          />
          <MetricCard
            title="Pod Memory Usage"
            query={`sum(container_memory_working_set_bytes{namespace="${safeNs}",container!=""}) / sum(kube_pod_container_resource_requests{namespace="${safeNs}",resource="memory"}) * 100`}
            unit="%"
            color={CHART_COLORS.violet}
            thresholds={{ warning: 75, critical: 90 }}
          />
          <MetricCard
            title="Container Restarts"
            query={`sum(rate(kube_pod_container_status_restarts_total{namespace="${safeNs}"}[1h])) * 3600`}
            unit="/h"
            color={CHART_COLORS.amber}
            thresholds={{ warning: 5, critical: 20 }}
          />
        </MetricGrid>

        {/* Pods */}
        <Card>
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Server className="w-4 h-4 text-blue-400" />
              Pods ({pods.length})
            </h2>
            <div className="flex gap-2 text-xs">
              <span className="text-emerald-400">{podStats.running} running</span>
              {podStats.pending > 0 && <span className="text-amber-400">{podStats.pending} pending</span>}
              {podStats.failed > 0 && <span className="text-red-400">{podStats.failed} failing</span>}
            </div>
          </div>
          <div className="divide-y divide-slate-800 max-h-64 overflow-auto">
            {pods.map((pod) => {
              const rawStatus = getPodStatus(pod);
              const status = typeof rawStatus === 'string' ? rawStatus : rawStatus?.phase || 'Unknown';
              return (
                <button
                  key={pod.metadata.uid}
                  onClick={() => go(`/r/v1~pods/${ns}/${pod.metadata.name}`, pod.metadata.name)}
                  className="w-full px-4 py-2 flex items-center gap-3 text-left hover:bg-slate-800/50 transition-colors"
                >
                  {status === 'Running' ? (
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  ) : status === 'Pending' ? (
                    <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                  )}
                  <span className="text-xs font-mono text-slate-300 truncate flex-1">{pod.metadata.name}</span>
                  <span className={cn('text-xs', status === 'Running' ? 'text-slate-500' : 'text-amber-400')}>{status}</span>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Deployments */}
        {deployments.length > 0 && (
          <Card>
            <div className="px-4 py-3 border-b border-slate-800">
              <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-400" />
                Deployments ({deployments.length})
              </h2>
            </div>
            <div className="divide-y divide-slate-800">
              {deployments.map((dep) => {
                const ready = dep.status?.readyReplicas ?? 0;
                const desired = dep.spec?.replicas ?? 0;
                const healthy = ready === desired;
                return (
                  <button
                    key={dep.metadata.uid}
                    onClick={() => go(`/r/apps~v1~deployments/${ns}/${dep.metadata.name}`, dep.metadata.name)}
                    className="w-full px-4 py-2 flex items-center gap-3 text-left hover:bg-slate-800/50 transition-colors"
                  >
                    {healthy ? (
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    )}
                    <span className="text-xs font-mono text-slate-300 truncate flex-1">{dep.metadata.name}</span>
                    <span className={cn('text-xs', healthy ? 'text-slate-500' : 'text-amber-400')}>
                      {ready}/{desired} ready
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>
        )}

        {/* Warning Events */}
        {warningEvents.length > 0 && (
          <Card>
            <div className="px-4 py-3 border-b border-slate-800">
              <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Recent Warning Events ({warningEvents.length})
              </h2>
            </div>
            <div className="divide-y divide-slate-800 max-h-48 overflow-auto">
              {warningEvents.map((event: any, i: number) => (
                <div key={i} className="px-4 py-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-amber-400 font-medium">{event.reason}</span>
                    <span className="text-slate-500">{event.involvedObject?.kind}/{event.involvedObject?.name}</span>
                    <span className="ml-auto text-slate-600">{event.lastTimestamp ? formatRelativeTime(new Date(event.lastTimestamp).getTime()) : ''}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{event.message}</p>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, count, icon, color }: { label: string; count: number; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 p-3 text-center">
      <div className={cn('flex items-center justify-center gap-1.5 mb-1', color)}>
        {icon}
        <span className="text-xl font-bold">{count}</span>
      </div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
