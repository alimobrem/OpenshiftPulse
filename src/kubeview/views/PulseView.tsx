import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Activity, AlertCircle, XCircle, CheckCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { k8sList } from '../engine/query';
import type { K8sResource } from '../engine/renderers';
import { detectResourceStatus, getPodStatus, getNodeStatus } from '../engine/renderers/statusUtils';
import { findNeedsAttention, type NeedsAttentionItem } from '../engine/diagnosis';

interface HealthSummary {
  nodes: { total: number; ready: number };
  pods: { total: number; running: number };
  alerts: number;
  apiLatency: number;
}

export default function PulseView() {
  const navigate = useNavigate();

  // Fetch cluster resources
  const { data: nodes, isLoading: nodesLoading } = useQuery<K8sResource[]>({
    queryKey: ['pulse', 'nodes'],
    queryFn: () => k8sList<K8sResource>('/api/v1/nodes'),
    refetchInterval: 30000,
  });

  const { data: pods, isLoading: podsLoading } = useQuery<K8sResource[]>({
    queryKey: ['pulse', 'pods'],
    queryFn: async () => {
      const start = Date.now();
      const result = await k8sList<K8sResource>('/api/v1/pods');
      setApiLatency(Date.now() - start);
      return result;
    },
    refetchInterval: 30000,
  });

  const { data: events } = useQuery<K8sResource[]>({
    queryKey: ['pulse', 'events'],
    queryFn: () => k8sList<K8sResource>('/api/v1/events?limit=50'),
    refetchInterval: 30000,
  });

  const { data: pvcs } = useQuery<K8sResource[]>({
    queryKey: ['pulse', 'pvcs'],
    queryFn: () => k8sList<K8sResource>('/api/v1/persistentvolumeclaims'),
    refetchInterval: 30000,
  });

  const [apiLatency, setApiLatency] = React.useState(0);
  const [activityFilter, setActivityFilter] = React.useState<'all' | 'warnings' | 'changes'>('all');

  // Compute health summary
  const healthSummary = React.useMemo<HealthSummary>(() => {
    const summary: HealthSummary = {
      nodes: { total: 0, ready: 0 },
      pods: { total: 0, running: 0 },
      alerts: 0,
      apiLatency,
    };

    if (nodes) {
      summary.nodes.total = nodes.length;
      summary.nodes.ready = nodes.filter((node) => {
        const status = getNodeStatus(node);
        return status.ready;
      }).length;
    }

    if (pods) {
      summary.pods.total = pods.length;
      summary.pods.running = pods.filter((pod) => {
        const status = getPodStatus(pod);
        return status.phase === 'Running' && status.ready;
      }).length;
    }

    if (events) {
      summary.alerts = events.filter(
        (e) => (e as any).type === 'Warning'
      ).length;
    }

    return summary;
  }, [nodes, pods, events, apiLatency]);

  // Find resources that need attention
  const needsAttention = React.useMemo<NeedsAttentionItem[]>(() => {
    const items: NeedsAttentionItem[] = [];
    const allResources: K8sResource[] = [...(pods || []), ...(pvcs || []), ...(nodes || [])];

    return findNeedsAttention(allResources);
  }, [pods, pvcs, nodes]);

  // Filter and sort events for activity stream
  const activityEvents = React.useMemo(() => {
    if (!events) return [];

    let filtered = events;

    if (activityFilter === 'warnings') {
      filtered = events.filter((e) => (e as any).type === 'Warning');
    } else if (activityFilter === 'changes') {
      filtered = events.filter((e) => {
        const reason = (e as any).reason || '';
        return reason.includes('Scaled') || reason.includes('Created') || reason.includes('Deleted');
      });
    }

    // Sort by timestamp descending
    return filtered.sort((a, b) => {
      const aTime = (a as any).lastTimestamp || (a as any).firstTimestamp || '';
      const bTime = (b as any).lastTimestamp || (b as any).firstTimestamp || '';
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
  }, [events, activityFilter]);

  const handleNavigateToResource = (item: NeedsAttentionItem) => {
    const ns = item.resource.metadata.namespace;
    const name = item.resource.metadata.name;
    const kind = item.resource.kind.toLowerCase();

    if (ns) {
      navigate(`/k8s/ns/${ns}/${kind}/${name}`);
    } else {
      navigate(`/k8s/${kind}/${name}`);
    }
  };

  const isLoading = nodesLoading || podsLoading;

  return (
    <div className="h-full overflow-auto bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-500" />
            Cluster Pulse
          </h1>
          <p className="text-sm text-slate-400 mt-1">Real-time cluster health overview</p>
        </div>

        {/* Health Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Nodes */}
          <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">Nodes</span>
              {isLoading ? (
                <div className="w-2 h-2 rounded-full bg-slate-600 animate-pulse" />
              ) : healthSummary.nodes.ready === healthSummary.nodes.total ? (
                <div className="w-2 h-2 rounded-full bg-green-500" />
              ) : (
                <div className="w-2 h-2 rounded-full bg-yellow-500" />
              )}
            </div>
            <div className="text-2xl font-bold text-slate-100">
              {healthSummary.nodes.ready}/{healthSummary.nodes.total}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {healthSummary.nodes.total - healthSummary.nodes.ready > 0
                ? `${healthSummary.nodes.total - healthSummary.nodes.ready} not ready`
                : 'All ready'}
            </p>
          </div>

          {/* Pods */}
          <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">Pods</span>
              {isLoading ? (
                <div className="w-2 h-2 rounded-full bg-slate-600 animate-pulse" />
              ) : healthSummary.pods.running === healthSummary.pods.total ? (
                <div className="w-2 h-2 rounded-full bg-green-500" />
              ) : healthSummary.pods.running > 0 ? (
                <div className="w-2 h-2 rounded-full bg-yellow-500" />
              ) : (
                <div className="w-2 h-2 rounded-full bg-red-500" />
              )}
            </div>
            <div className="text-2xl font-bold text-slate-100">
              {healthSummary.pods.running}/{healthSummary.pods.total}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {healthSummary.pods.total - healthSummary.pods.running > 0
                ? `${healthSummary.pods.total - healthSummary.pods.running} not running`
                : 'All running'}
            </p>
          </div>

          {/* Alerts */}
          <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">Alerts</span>
              {healthSummary.alerts > 0 ? (
                <div className="w-2 h-2 rounded-full bg-yellow-500" />
              ) : (
                <div className="w-2 h-2 rounded-full bg-green-500" />
              )}
            </div>
            <div className="text-2xl font-bold text-slate-100">{healthSummary.alerts}</div>
            <p className="text-xs text-slate-500 mt-1">Warning events</p>
          </div>

          {/* API */}
          <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">API</span>
              <div className="w-2 h-2 rounded-full bg-green-500" />
            </div>
            <div className="text-2xl font-bold text-slate-100">OK</div>
            <p className="text-xs text-slate-500 mt-1">{apiLatency}ms latency</p>
          </div>
        </div>

        {/* Needs Attention */}
        {needsAttention.length > 0 && (
          <div className="bg-slate-900 rounded-lg border border-slate-800">
            <div className="px-4 py-3 border-b border-slate-800">
              <h2 className="text-sm font-semibold text-slate-100 uppercase tracking-wide">
                Needs Attention ({needsAttention.length})
              </h2>
            </div>
            <div className="divide-y divide-slate-800">
              {needsAttention.slice(0, 10).map((item, idx) => (
                <div
                  key={idx}
                  className="px-4 py-3 hover:bg-slate-800/50 cursor-pointer transition-colors"
                  onClick={() => handleNavigateToResource(item)}
                >
                  <div className="flex items-start gap-3">
                    {item.severity === 'critical' ? (
                      <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-slate-100">
                          {item.resource.kind}
                        </span>
                        <span className="text-sm text-blue-400">{item.resource.metadata.name}</span>
                        {item.resource.metadata.namespace && (
                          <span className="text-xs text-slate-500">
                            in {item.resource.metadata.namespace}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-300">{item.title}</p>
                      <p className="text-xs text-slate-500 mt-1">{item.detail}</p>
                    </div>
                    {item.timestamp && (
                      <span className="text-xs text-slate-500 flex-shrink-0">
                        {formatTimeAgo(item.timestamp)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Activity Stream */}
        <div className="bg-slate-900 rounded-lg border border-slate-800">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100 uppercase tracking-wide">
              Activity Stream
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setActivityFilter('all')}
                className={cn(
                  'px-3 py-1 text-xs rounded',
                  activityFilter === 'all'
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                )}
              >
                All
              </button>
              <button
                onClick={() => setActivityFilter('warnings')}
                className={cn(
                  'px-3 py-1 text-xs rounded',
                  activityFilter === 'warnings'
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                )}
              >
                Warnings
              </button>
              <button
                onClick={() => setActivityFilter('changes')}
                className={cn(
                  'px-3 py-1 text-xs rounded',
                  activityFilter === 'changes'
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                )}
              >
                Changes
              </button>
            </div>
          </div>
          <div className="divide-y divide-slate-800 max-h-96 overflow-auto">
            {activityEvents.slice(0, 20).map((event, idx) => {
              const eventAny = event as any;
              const timestamp = eventAny.lastTimestamp || eventAny.firstTimestamp || '';
              const time = timestamp ? new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';
              const message = formatEventMessage(event);
              const actor = eventAny.source?.component || eventAny.reportingComponent || 'System';

              return (
                <div key={idx} className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <Clock className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-slate-500">{time}</span>
                        <span className="text-xs text-slate-600">•</span>
                        <span className="text-xs text-slate-400">{actor}</span>
                      </div>
                      <p className="text-sm text-slate-200">{message}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            {activityEvents.length === 0 && (
              <div className="px-4 py-8 text-center text-slate-500 text-sm">
                No events to display
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper: Format time ago
function formatTimeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}d`;
  const hours = Math.floor(diff / 3600000);
  if (hours > 0) return `${hours}h`;
  const mins = Math.floor(diff / 60000);
  return `${mins}m`;
}

// Helper: Format event message into human-readable description
function formatEventMessage(event: K8sResource): string {
  const eventAny = event as any;
  const reason = eventAny.reason || '';
  const obj = eventAny.involvedObject || {};
  const name = obj.name || '';
  const kind = obj.kind || '';
  const message = eventAny.message || '';

  // Format based on reason
  if (reason === 'Scheduled') {
    return `Pod ${name} scheduled to node`;
  }
  if (reason === 'Pulling') {
    return `Pulling image for ${kind} ${name}`;
  }
  if (reason === 'Pulled') {
    return `Successfully pulled image for ${kind} ${name}`;
  }
  if (reason === 'Created') {
    return `Created ${kind} ${name}`;
  }
  if (reason === 'Started') {
    return `Started container in ${kind} ${name}`;
  }
  if (reason === 'Killing') {
    return `Stopping ${kind} ${name}`;
  }
  if (reason === 'SuccessfulCreate') {
    return `Successfully created ${kind} ${name}`;
  }
  if (reason === 'FailedCreate') {
    return `Failed to create ${kind} ${name}`;
  }
  if (reason.includes('Scaled')) {
    const match = message.match(/Scaled.*from (\d+) to (\d+)/);
    if (match) {
      return `${kind} ${name} scaled ${match[1]}→${match[2]}`;
    }
  }

  // Fallback to raw message
  return `${kind} ${name}: ${message}`;
}
