# KubeView Metrics Components

This directory contains all metrics and monitoring components for KubeView.

## Components

### MetricsChart.tsx
Interactive SVG chart component for time-series metrics visualization.

**Features:**
- Pure SVG rendering (no external chart libraries)
- Multiple series support (line and area charts)
- Threshold lines (e.g., resource requests/limits)
- Hover tooltips with cross-chart synchronization
- Time range brush selection
- Responsive width, configurable height

**Usage:**
```tsx
import { MetricsChart } from '@/kubeview/components/metrics';

<MetricsChart
  series={[
    {
      id: 'cpu',
      label: 'CPU Usage',
      color: '#3b82f6',
      data: [
        { timestamp: 1704067200, value: 0.5 },
        { timestamp: 1704067260, value: 0.8 },
      ],
    },
  ]}
  height={200}
  yAxisLabel="CPU Cores"
  yAxisFormat={(v) => formatCores(v)}
  thresholds={[
    { value: 1.0, label: 'Limit', color: '#ef4444' },
  ]}
  onHover={(timestamp) => console.log('Hover:', timestamp)}
/>
```

### PromQLEditor.tsx
PromQL query editor with autocomplete and history.

**Features:**
- Monospace code editor styling
- Metric name autocomplete from Prometheus API
- Query history dropdown
- Execute on Enter key
- Loading state support

**Usage:**
```tsx
import { PromQLEditor } from '@/kubeview/components/metrics';

const [query, setQuery] = useState('');
const [history, setHistory] = useState<string[]>([]);

<PromQLEditor
  value={query}
  onChange={setQuery}
  onExecute={(q) => {
    // Execute query
    setHistory([q, ...history]);
  }}
  history={history}
  loading={false}
/>
```

### CorrelatedTimeline.tsx
Synchronized time ruler for correlation views.

**Features:**
- Horizontal time axis with configurable range
- Event markers (events, alerts, changes)
- Drag-to-select time range
- Hover synchronization
- Event tooltips

**Usage:**
```tsx
import { CorrelatedTimeline } from '@/kubeview/components/metrics';

<CorrelatedTimeline
  timeRange={[startTimestamp, endTimestamp]}
  onTimeRangeChange={([start, end]) => {
    // Update charts to new time range
  }}
  onHoverTime={(timestamp) => {
    // Sync hover across charts
  }}
  hoverTime={null}
  events={[
    { timestamp: 1704067200, label: 'Pod Created', type: 'event', color: '#10b981' },
    { timestamp: 1704067260, label: 'CPU Alert', type: 'alert', color: '#ef4444' },
  ]}
/>
```

### AutoMetrics.ts
Mapping from Kubernetes resource types to Prometheus queries.

**Features:**
- Predefined metrics for Pods, Deployments, Nodes, StatefulSets, DaemonSets
- Template variable resolution (${namespace}, ${name}, etc.)
- Format helpers for bytes, cores, percent, rate, duration

**Usage:**
```tsx
import {
  getMetricsForResource,
  resolveQuery,
  formatBytes,
  formatCores,
} from '@/kubeview/components/metrics';

// Get metrics for a resource
const queries = getMetricsForResource('v1/pods', {
  metadata: { name: 'nginx-abc123', namespace: 'default' },
});

// Resolve template variables
const query = resolveQuery(queries[0].query, {
  name: 'nginx-abc123',
  namespace: 'default',
});

// Format values
console.log(formatBytes(1536 * 1024 * 1024)); // "1.50 GiB"
console.log(formatCores(0.25));                 // "250m"
```

**Supported Resource Types:**
- `v1/pods`: CPU, Memory, Network I/O, Restarts
- `apps/v1/deployments`: CPU, Memory, Replicas
- `v1/nodes`: CPU, Memory, Disk, Pod Count
- `apps/v1/statefulsets`: CPU, Memory, Replicas
- `apps/v1/daemonsets`: CPU, Memory, Desired Pods

### Narrative.ts
Rule-based incident story builder.

**Features:**
- Analyzes K8s events, alerts, and metric anomalies
- Identifies root cause using pattern matching rules
- Generates human-readable narrative
- Groups events by time windows
- No AI/LLM required

**Usage:**
```tsx
import { buildNarrative, groupEvents } from '@/kubeview/components/metrics';

const result = buildNarrative({
  events: k8sEvents,
  alerts: prometheusAlerts,
  metricAnomalies: [
    { timestamp: 1704067200, metric: 'cpu_usage', value: 0.95, threshold: 0.8, direction: 'above' },
  ],
});

console.log(result.summary);
console.log(result.rootCause);

const groups = groupEvents(result.events);
// Display grouped events in timeline
```

**Narrative Rules:**
1. Image change + error burst → "Image update caused errors"
2. Scale event + CPU spike → "Scaling caused resource contention"
3. OOMKilled + memory ramp → "Memory leak or insufficient limits"
4. Node NotReady + pod rescheduling → "Node failure caused pod disruption"
5. Certificate alert → "TLS certificate issue"
6. Rollout + temporary errors → "Rollout caused temporary errors"

## Testing

Tests are located in `__tests__/metrics.test.tsx` covering:
- Component rendering
- User interactions (hover, click, keyboard)
- Data formatting functions
- Narrative rule matching
- Event grouping

Run tests with:
```bash
npm test -- src/kubeview/components/metrics
```

## Integration

All components use:
- React 19 with TypeScript
- Tailwind CSS for styling
- `cn()` utility from `@/lib/utils`
- lucide-react for icons
- Prometheus/Thanos at `/api/prometheus`
- K8s API at `/api/kubernetes`

## Color Palette

Default chart series colors:
- Blue: `#3b82f6`
- Emerald: `#10b981`
- Amber: `#f59e0b`
- Red: `#ef4444`
- Violet: `#8b5cf6`
- Pink: `#ec4899`

Threshold colors:
- Request: `#f59e0b` (amber)
- Limit: `#ef4444` (red)

## Dependencies

No external chart libraries required. All SVG rendering is done manually for:
- Full control over appearance
- Minimal bundle size
- No version conflicts
- Perfect Tailwind integration
