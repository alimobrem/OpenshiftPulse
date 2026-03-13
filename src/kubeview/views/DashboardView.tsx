import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  CheckCircle,
  XCircle,
  AlertCircle,
  Activity,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { k8sList } from '../engine/query';
import type { K8sResource } from '../engine/renderers';
import { getDeploymentStatus, getPodStatus } from '../engine/renderers/statusUtils';

export default function DashboardView() {
  const navigate = useNavigate();

  // Fetch deployments
  const { data: deployments = [], isLoading: deploymentsLoading } = useQuery<K8sResource[]>({
    queryKey: ['dashboard', 'deployments'],
    queryFn: () => k8sList<K8sResource>('/apis/apps/v1/deployments'),
    refetchInterval: 30000,
  });

  // Fetch pods
  const { data: pods = [], isLoading: podsLoading } = useQuery<K8sResource[]>({
    queryKey: ['dashboard', 'pods'],
    queryFn: () => k8sList<K8sResource>('/api/v1/pods'),
    refetchInterval: 30000,
  });

  // Fetch events
  const { data: events = [] } = useQuery<K8sResource[]>({
    queryKey: ['dashboard', 'events'],
    queryFn: () => k8sList<K8sResource>('/api/v1/events?limit=100'),
    refetchInterval: 30000,
  });

  // Compute pod status summary
  const podStatusSummary = React.useMemo(() => {
    const summary = {
      running: 0,
      pending: 0,
      failed: 0,
      succeeded: 0,
    };

    for (const pod of pods) {
      const status = getPodStatus(pod);
      const phase = status.phase.toLowerCase();

      if (phase === 'running') {
        summary.running++;
      } else if (phase === 'pending') {
        summary.pending++;
      } else if (phase === 'failed') {
        summary.failed++;
      } else if (phase === 'succeeded') {
        summary.succeeded++;
      }
    }

    return summary;
  }, [pods]);

  // Get recent warning events
  const recentWarnings = React.useMemo(() => {
    const warnings = events
      .filter((e) => (e as any).type === 'Warning')
      .sort((a, b) => {
        const aTime = (a as any).lastTimestamp || (a as any).firstTimestamp || '';
        const bTime = (b as any).lastTimestamp || (b as any).firstTimestamp || '';
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      })
      .slice(0, 10);

    return warnings;
  }, [events]);

  const isLoading = deploymentsLoading || podsLoading;

  return (
    <div className="h-full overflow-auto bg-slate-950">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <LayoutDashboard className="w-6 h-6 text-blue-500" />
            Production Overview
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time cluster dashboard
          </p>
        </div>

        {/* Dashboard Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Panel 1: Deployments Status */}
          <div className="bg-slate-900 rounded-lg border border-slate-800">
            <div className="px-4 py-3 border-b border-slate-800">
              <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-500" />
                Deployments ({deployments.length})
              </h2>
            </div>
            <div className="p-4">
              {isLoading ? (
                <div className="text-center py-8 text-slate-500 text-sm">Loading...</div>
              ) : deployments.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">
                  No deployments found
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-auto">
                  {deployments.slice(0, 10).map((deployment) => {
                    const status = getDeploymentStatus(deployment);
                    const name = deployment.metadata.name;
                    const namespace = deployment.metadata.namespace;

                    return (
                      <div
                        key={deployment.metadata.uid}
                        className="flex items-center justify-between p-2 rounded hover:bg-slate-800/50 cursor-pointer transition-colors"
                        onClick={() => navigate(`/k8s/ns/${namespace}/deployment/${name}`)}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {status.available ? (
                            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                          ) : status.progressing ? (
                            <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-slate-200 font-medium truncate">
                              {name}
                            </div>
                            {namespace && (
                              <div className="text-xs text-slate-500">{namespace}</div>
                            )}
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          <span
                            className={cn(
                              'font-mono text-sm font-semibold',
                              status.available
                                ? 'text-green-500'
                                : status.ready > 0
                                ? 'text-yellow-500'
                                : 'text-red-500'
                            )}
                          >
                            {status.ready}/{status.desired}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {deployments.length > 10 && (
                    <div className="text-center pt-2">
                      <button
                        onClick={() => navigate('/k8s/deployments')}
                        className="text-xs text-blue-400 hover:text-blue-300"
                      >
                        View all {deployments.length} deployments
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Panel 2: Pod Status Summary */}
          <div className="bg-slate-900 rounded-lg border border-slate-800">
            <div className="px-4 py-3 border-b border-slate-800">
              <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-500" />
                Pod Status
              </h2>
            </div>
            <div className="p-4">
              {isLoading ? (
                <div className="text-center py-8 text-slate-500 text-sm">Loading...</div>
              ) : (
                <div className="space-y-4">
                  {/* Status bars */}
                  <div className="space-y-3">
                    <StatusBar
                      label="Running"
                      count={podStatusSummary.running}
                      total={pods.length}
                      color="green"
                    />
                    <StatusBar
                      label="Pending"
                      count={podStatusSummary.pending}
                      total={pods.length}
                      color="yellow"
                    />
                    <StatusBar
                      label="Failed"
                      count={podStatusSummary.failed}
                      total={pods.length}
                      color="red"
                    />
                    <StatusBar
                      label="Succeeded"
                      count={podStatusSummary.succeeded}
                      total={pods.length}
                      color="blue"
                    />
                  </div>

                  {/* Total */}
                  <div className="pt-3 border-t border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">Total Pods</span>
                      <span className="text-2xl font-bold text-slate-100">{pods.length}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Panel 3: Recent Warnings */}
          <div className="bg-slate-900 rounded-lg border border-slate-800">
            <div className="px-4 py-3 border-b border-slate-800">
              <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-500" />
                Recent Warnings ({recentWarnings.length})
              </h2>
            </div>
            <div className="p-4">
              {recentWarnings.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">No warnings</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-auto">
                  {recentWarnings.map((event, idx) => {
                    const eventAny = event as any;
                    const reason = eventAny.reason || '';
                    const message = eventAny.message || '';
                    const involvedObject = eventAny.involvedObject || {};
                    const objectName = involvedObject.name || '';
                    const objectKind = involvedObject.kind || '';

                    return (
                      <div
                        key={idx}
                        className="p-2 rounded bg-slate-800/50 border border-slate-700"
                      >
                        <div className="flex items-start gap-2 mb-1">
                          <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-slate-400 mb-1">
                              {objectKind} {objectName}
                            </div>
                            <div className="text-sm font-medium text-slate-200 mb-1">
                              {reason}
                            </div>
                            <div className="text-xs text-slate-400 line-clamp-2">
                              {message}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Panel 4: Resource Usage (Placeholder) */}
          <div className="bg-slate-900 rounded-lg border border-slate-800">
            <div className="px-4 py-3 border-b border-slate-800">
              <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-500" />
                Resource Usage
              </h2>
            </div>
            <div className="p-4">
              <div className="text-center py-8">
                <Activity className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Metrics not available</p>
                <p className="text-xs text-slate-500 mt-1">
                  Prometheus integration required
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper component: Status bar
function StatusBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: 'green' | 'yellow' | 'red' | 'blue';
}) {
  const percentage = total > 0 ? (count / total) * 100 : 0;

  const colorMap = {
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
    blue: 'bg-blue-500',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-slate-300">{label}</span>
        <span className="text-sm text-slate-400 font-mono">{count}</span>
      </div>
      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={cn('h-full transition-all duration-300', colorMap[color])}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
