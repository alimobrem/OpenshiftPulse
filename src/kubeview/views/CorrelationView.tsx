import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ArrowLeft, Clock } from 'lucide-react';
import { MetricsChart } from '../components/metrics/MetricsChart';
import { getMetricsForResource, resolveQuery, formatYAxisValue } from '../components/metrics/AutoMetrics';
import { buildNarrative } from '../components/metrics/Narrative';
import { buildApiPath } from '../hooks/useResourceUrl';

interface CorrelationViewProps {
  gvrKey: string;
  namespace?: string;
  name: string;
}

type TimeRange = '1h' | '6h' | '24h';

const TIME_RANGES: Record<TimeRange, number> = {
  '1h': 3600,
  '6h': 21600,
  '24h': 86400,
};

export default function CorrelationView({ gvrKey, namespace, name }: CorrelationViewProps) {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState<TimeRange>('1h');
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  const rangeSeconds = TIME_RANGES[timeRange];
  const end = Math.floor(Date.now() / 1000);
  const start = end - rangeSeconds;
  const step = Math.max(15, Math.floor(rangeSeconds / 200));

  const vars = useMemo(() => ({
    name,
    namespace: namespace || 'default',
    pod: name,
    node: name,
  }), [name, namespace]);

  // Fetch events
  const { data: events = [] } = useQuery({
    queryKey: ['events', namespace, name, timeRange],
    queryFn: async () => {
      const fieldSelector = `involvedObject.name=${name}`;
      const ns = namespace || '';
      const url = ns
        ? `/api/kubernetes/api/v1/namespaces/${ns}/events?fieldSelector=${encodeURIComponent(fieldSelector)}&limit=100`
        : `/api/kubernetes/api/v1/events?fieldSelector=${encodeURIComponent(fieldSelector)}&limit=100`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const json = await res.json();
      return (json.items || []) as Array<{
        metadata: { creationTimestamp: string };
        reason: string;
        message: string;
        type: string;
        lastTimestamp?: string;
        involvedObject: { kind: string; name: string };
        source?: { component: string };
      }>;
    },
  });

  // Fetch metrics
  const metricQueries = useMemo(() => {
    return getMetricsForResource(gvrKey, { metadata: { name, namespace } }).slice(0, 2); // Show top 2 metrics in correlation view
  }, [gvrKey, name, namespace]);

  // Build narrative
  const narrative = useMemo(() => {
    const eventData = events.map((e) => ({
      timestamp: e.lastTimestamp || e.metadata.creationTimestamp,
      reason: e.reason,
      message: e.message,
      involvedObject: e.involvedObject,
      source: e.source,
    }));
    return buildNarrative({ events: eventData });
  }, [events]);

  // Filter events to time range
  const filteredEvents = useMemo(() => {
    const startMs = start * 1000;
    return events.filter((e) => {
      const ts = new Date(e.lastTimestamp || e.metadata.creationTimestamp).getTime();
      return ts >= startMs;
    }).sort((a, b) => {
      const tsA = new Date(a.lastTimestamp || a.metadata.creationTimestamp).getTime();
      const tsB = new Date(b.lastTimestamp || b.metadata.creationTimestamp).getTime();
      return tsA - tsB;
    });
  }, [events, start]);

  const backPath = namespace
    ? `/r/${gvrKey.replace(/\//g, '~')}/${namespace}/${name}`
    : `/r/${gvrKey.replace(/\//g, '~')}/_/${name}`;

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(backPath)}
            className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200"
          >
            <ArrowLeft size={16} />
          </button>
          <span className="text-sm text-slate-400">Investigate</span>
          <span className="text-sm font-medium">{name}</span>
          {namespace && (
            <span className="text-xs px-2 py-0.5 bg-slate-700 rounded text-slate-300">{namespace}</span>
          )}
        </div>
        <div className="flex bg-slate-800 rounded text-xs">
          {(Object.keys(TIME_RANGES) as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={cn(
                'px-3 py-1.5 rounded transition-colors',
                timeRange === range ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              )}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 p-4 space-y-4 overflow-auto">
        {/* Metrics panels */}
        {metricQueries.map((mq) => {
          const resolved = resolveQuery(mq.query, vars);
          return (
            <CorrelationMetricPanel
              key={mq.id}
              title={mq.title}
              query={resolved}
              start={start}
              end={end}
              step={step}
              yAxisFormat={mq.yAxisFormat}
              hoverTime={hoverTime}
              onHover={setHoverTime}
            />
          );
        })}

        {/* Events timeline */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <h3 className="text-sm font-medium text-slate-200 mb-3">Events</h3>
          {filteredEvents.length === 0 ? (
            <p className="text-sm text-slate-500">No events in this time range</p>
          ) : (
            <div className="space-y-1.5">
              {filteredEvents.map((event, i) => {
                const ts = new Date(event.lastTimestamp || event.metadata.creationTimestamp);
                const timeStr = ts.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
                return (
                  <div key={i} className="flex items-start gap-3 text-sm">
                    <span className="text-slate-500 font-mono text-xs mt-0.5 shrink-0 w-12">{timeStr}</span>
                    <span className={cn(
                      'shrink-0 mt-1 w-1.5 h-1.5 rounded-full',
                      event.type === 'Warning' ? 'bg-amber-500' : 'bg-blue-400'
                    )} />
                    <div className="min-w-0">
                      <span className="text-slate-300">{event.reason}</span>
                      <span className="text-slate-500 ml-2">{event.message}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Narrative */}
        {narrative.events.length > 0 && (
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <h3 className="text-sm font-medium text-slate-200 mb-3">Narrative</h3>
            <div className="space-y-2">
              {narrative.events.map((event, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <Clock size={14} className={cn(
                    'mt-0.5 shrink-0',
                    event.type === 'action' ? 'text-blue-400' :
                    event.type === 'symptom' ? 'text-amber-400' :
                    'text-emerald-400'
                  )} />
                  <span className="text-slate-300">{event.description}</span>
                </div>
              ))}
              {narrative.rootCause && (
                <div className="mt-3 p-3 bg-slate-900 rounded border border-slate-600">
                  <p className="text-sm font-medium text-slate-200">Root cause</p>
                  <p className="text-sm text-slate-400 mt-1">{narrative.rootCause}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CorrelationMetricPanel({
  title, query, start, end, step, yAxisFormat, hoverTime, onHover
}: {
  title: string;
  query: string;
  start: number;
  end: number;
  step: number;
  yAxisFormat: string;
  hoverTime: number | null;
  onHover: (t: number | null) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['prometheus', query, start, end, step],
    queryFn: async () => {
      const params = new URLSearchParams({ query, start: String(start), end: String(end), step: String(step) });
      const res = await fetch(`/api/prometheus/api/v1/query_range?${params}`);
      if (!res.ok) return null;
      const json = await res.json();
      if (json.status !== 'success') return null;
      return json.data?.result || [];
    },
  });

  const series = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    return data.map((result: { metric: Record<string, string>; values: [number, string][] }, idx: number) => ({
      id: `s-${idx}`,
      label: title,
      data: (result.values || []).map(([ts, val]: [number, string]) => ({ timestamp: ts, value: parseFloat(val) })),
      color: '#3b82f6',
      type: 'area' as const,
    }));
  }, [data, title]);

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <h3 className="text-sm font-medium text-slate-200 mb-3">{title}</h3>
      {isLoading ? (
        <div className="h-32 kv-skeleton rounded" />
      ) : series.length === 0 ? (
        <div className="h-32 flex items-center justify-center text-slate-500 text-sm">No data</div>
      ) : (
        <MetricsChart
          series={series}
          height={150}
          timeRange={[start, end]}
          yAxisFormat={(v) => formatYAxisValue(v, yAxisFormat)}
          hoverTimestamp={hoverTime}
          onHover={onHover}
        />
      )}
    </div>
  );
}
