import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@patternfly/react-core';
import ResourceListPage, { type ColumnDef } from '@/components/ResourceListPage';
import StatusIndicator from '@/components/StatusIndicator';
import { useUIStore } from '@/store/useUIStore';
import '@/openshift-components.css';

const PROM_BASE = '/api/prometheus';
const AM_BASE = '/api/alertmanager';

interface Alert {
  name: string;
  severity: string;
  state: string;
  message: string;
  namespace: string;
  activeSince: string;
  labels: Record<string, string>;
}

interface RawPromAlert {
  labels: Record<string, string>;
  annotations?: Record<string, string>;
  state: string;
  activeAt?: string;
}

function formatSince(ts: string | undefined): string {
  if (!ts) return '-';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function AlertActions({ alert, onSilenced }: { alert: Alert; onSilenced: () => void }) {
  const addToast = useUIStore((s) => s.addToast);
  const [loading, setLoading] = useState(false);

  const handleSilence = async () => {
    setLoading(true);
    const now = new Date();
    const endsAt = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours

    // Build matchers from alert labels
    const matchers = Object.entries(alert.labels).map(([name, value]) => ({
      name,
      value,
      isRegex: false,
      isEqual: true,
    }));

    try {
      const res = await fetch(`${AM_BASE}/api/v2/silences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchers,
          startsAt: now.toISOString(),
          endsAt: endsAt.toISOString(),
          createdBy: 'openshift-console',
          comment: `Silenced from console at ${now.toISOString()}`,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      addToast({
        type: 'success',
        title: 'Silence created',
        description: `${alert.name} silenced for 2 hours`,
      });
      onSilenced();
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Failed to create silence',
        description: err instanceof Error ? err.message : String(err),
      });
    }
    setLoading(false);
  };

  return (
    <span className="os-alerts__actions" onClick={(e) => e.stopPropagation()}>
      <Button
        variant="secondary"
        size="sm"
        isLoading={loading}
        onClick={handleSilence}
      >
        Silence
      </Button>
    </span>
  );
}

export default function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch(`${PROM_BASE}/api/v1/alerts`);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const json = await res.json() as { data?: { alerts?: RawPromAlert[] } };
      const rawAlerts = json.data?.alerts ?? [];
      const parsed: Alert[] = rawAlerts.map((a) => ({
        name: a.labels['alertname'] ?? 'Unknown',
        severity: a.labels['severity'] ?? 'none',
        state: a.state,
        message: a.annotations?.summary ?? a.annotations?.description ?? a.annotations?.message ?? '-',
        namespace: a.labels['namespace'] ?? '-',
        activeSince: formatSince(a.activeAt),
        labels: a.labels,
      }));
      // Sort: firing first, then pending, then by severity
      const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2, none: 3 };
      const stateOrder: Record<string, number> = { firing: 0, pending: 1, inactive: 2 };
      parsed.sort((a, b) =>
        (stateOrder[a.state] ?? 9) - (stateOrder[b.state] ?? 9) ||
        (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9)
      );
      setAlerts(parsed);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  const columns: ColumnDef<Alert>[] = [
    { title: 'Alert', key: 'name' },
    { title: 'Severity', key: 'severity', render: (a) => <StatusIndicator status={a.severity} /> },
    { title: 'State', key: 'state', render: (a) => <StatusIndicator status={a.state} /> },
    { title: 'Namespace', key: 'namespace' },
    { title: 'Message', key: 'message' },
    { title: 'Active Since', key: 'activeSince' },
    { title: 'Actions', key: 'actions', render: (a) => <AlertActions alert={a} onSilenced={fetchAlerts} />, sortable: false },
  ];

  return (
    <ResourceListPage
      title="Alerts"
      description={error ? `Error loading alerts: ${error}` : 'View and manage cluster alerts'}
      columns={columns}
      data={alerts}
      getRowKey={(a) => `${a.name}-${a.namespace}-${a.state}`}
      nameField="name"
      loading={loading}
    />
  );
}
