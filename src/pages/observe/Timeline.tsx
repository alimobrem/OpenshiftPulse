import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageSection, Title, Card, CardBody, Label, Button, ToggleGroup, ToggleGroupItem } from '@patternfly/react-core';

const BASE = '/api/kubernetes';

interface TimelineEvent {
  id: string;
  timestamp: Date;
  kind: string;
  name: string;
  namespace: string;
  action: string;
  reason: string;
  message: string;
  severity: 'normal' | 'warning' | 'change';
  href?: string;
}

type TimeRange = '1h' | '6h' | '24h';

function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(d: Date): string {
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function getHref(kind: string, name: string, namespace: string): string | undefined {
  const map: Record<string, string> = {
    Pod: `/workloads/pods/${namespace}/${name}`,
    Deployment: `/workloads/deployments/${namespace}/${name}`,
    ReplicaSet: `/workloads/replicasets/${namespace}/${name}`,
    Service: `/networking/services/${namespace}/${name}`,
    Node: `/compute/nodes/${name}`,
    ConfigMap: `/workloads/configmaps/${namespace}/${name}`,
    Secret: `/workloads/secrets/${namespace}/${name}`,
  };
  return map[kind];
}

function getSeverity(type: string, reason: string): 'normal' | 'warning' | 'change' {
  if (type === 'Warning') return 'warning';
  const changeReasons = ['ScalingReplicaSet', 'SuccessfulCreate', 'SuccessfulDelete', 'Scheduled', 'Pulling', 'Pulled', 'Created', 'Started', 'Killing'];
  if (changeReasons.includes(reason)) return 'change';
  return 'normal';
}

const severityColor: Record<string, string> = {
  normal: '#3e8635',
  warning: '#f0ab00',
  change: '#0066cc',
};

const severityLabel: Record<string, string> = {
  normal: 'Normal',
  warning: 'Warning',
  change: 'Change',
};

export default function Timeline() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<TimeRange>('1h');
  const [filter, setFilter] = useState<'all' | 'warning' | 'change'>('all');

  useEffect(() => {
    async function load() {
      setLoading(true);
      const cutoff = new Date();
      if (range === '1h') cutoff.setHours(cutoff.getHours() - 1);
      else if (range === '6h') cutoff.setHours(cutoff.getHours() - 6);
      else cutoff.setHours(cutoff.getHours() - 24);

      const allEvents: TimelineEvent[] = [];

      // Fetch K8s events
      try {
        const res = await fetch(`${BASE}/api/v1/events?limit=200`);
        if (res.ok) {
          const data = await res.json() as { items: {
            metadata: { name: string; namespace: string; creationTimestamp: string; uid: string };
            type: string; reason: string; message: string;
            involvedObject: { kind: string; name: string; namespace: string };
            lastTimestamp?: string; eventTime?: string;
            count?: number;
          }[] };

          for (const evt of data.items) {
            const ts = new Date(evt.lastTimestamp ?? evt.eventTime ?? evt.metadata.creationTimestamp);
            if (ts < cutoff) continue;

            const ns = evt.involvedObject.namespace || evt.metadata.namespace;
            allEvents.push({
              id: evt.metadata.uid,
              timestamp: ts,
              kind: evt.involvedObject.kind,
              name: evt.involvedObject.name,
              namespace: ns,
              action: evt.reason,
              reason: evt.reason,
              message: evt.message,
              severity: getSeverity(evt.type, evt.reason),
              href: getHref(evt.involvedObject.kind, evt.involvedObject.name, ns),
            });
          }
        }
      } catch { /* ignore */ }

      // Sort newest first
      allEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      // Deduplicate by kind+name+reason (keep latest)
      const seen = new Set<string>();
      const deduped: TimelineEvent[] = [];
      for (const evt of allEvents) {
        const key = `${evt.namespace}/${evt.kind}/${evt.name}/${evt.reason}`;
        if (!seen.has(key)) {
          seen.add(key);
          deduped.push(evt);
        }
      }

      setEvents(deduped);
      setLoading(false);
    }
    load();
  }, [range]);

  const filtered = filter === 'all' ? events : events.filter((e) => e.severity === filter);

  // Group by date
  const groups = new Map<string, TimelineEvent[]>();
  for (const evt of filtered) {
    const key = formatDate(evt.timestamp);
    const list = groups.get(key) ?? [];
    list.push(evt);
    groups.set(key, list);
  }

  const warningCount = events.filter((e) => e.severity === 'warning').length;
  const changeCount = events.filter((e) => e.severity === 'change').length;

  return (
    <>
      <PageSection variant="default">
        <Title headingLevel="h1" size="2xl">Cluster Timeline</Title>
        <p className="os-text-muted">What changed in your cluster — deployments, scaling, restarts, warnings</p>
      </PageSection>

      <PageSection>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <ToggleGroup aria-label="Time range">
              <ToggleGroupItem text="1 hour" isSelected={range === '1h'} onChange={() => setRange('1h')} />
              <ToggleGroupItem text="6 hours" isSelected={range === '6h'} onChange={() => setRange('6h')} />
              <ToggleGroupItem text="24 hours" isSelected={range === '24h'} onChange={() => setRange('24h')} />
            </ToggleGroup>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant={filter === 'all' ? 'primary' : 'secondary'} size="sm" onClick={() => setFilter('all')}>
              All ({events.length})
            </Button>
            <Button variant={filter === 'warning' ? 'primary' : 'secondary'} size="sm" onClick={() => setFilter('warning')}>
              Warnings ({warningCount})
            </Button>
            <Button variant={filter === 'change' ? 'primary' : 'secondary'} size="sm" onClick={() => setFilter('change')}>
              Changes ({changeCount})
            </Button>
          </div>
        </div>

        {loading ? (
          <Card><CardBody><p className="os-text-muted">Loading timeline...</p></CardBody></Card>
        ) : filtered.length === 0 ? (
          <Card><CardBody><p className="os-text-muted">No events in the last {range === '1h' ? 'hour' : range === '6h' ? '6 hours' : '24 hours'}.</p></CardBody></Card>
        ) : (
          Array.from(groups.entries()).map(([date, evts]) => (
            <div key={date} style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--os-text-secondary, #6a6e73)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {date}
              </div>
              <Card>
                <CardBody style={{ padding: 0 }}>
                  {evts.map((evt, i) => (
                    <div
                      key={evt.id + i}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 16px',
                        borderBottom: i < evts.length - 1 ? '1px solid var(--glass-border)' : 'none',
                        cursor: evt.href ? 'pointer' : 'default',
                      }}
                      onClick={() => evt.href && navigate(evt.href)}
                    >
                      {/* Timeline dot */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4, minWidth: 12 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: severityColor[evt.severity], flexShrink: 0 }} />
                        {i < evts.length - 1 && <div style={{ width: 1, flex: 1, background: 'var(--glass-border)', marginTop: 4, minHeight: 20 }} />}
                      </div>

                      {/* Time */}
                      <div style={{ minWidth: 50, fontSize: 12, color: 'var(--os-text-muted, #8a8d90)', paddingTop: 1, flexShrink: 0 }}>
                        {formatTime(evt.timestamp)}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <Label color={evt.severity === 'warning' ? 'orange' : evt.severity === 'change' ? 'blue' : 'green'} style={{ fontSize: 10 }}>
                            {severityLabel[evt.severity]}
                          </Label>
                          <Label color="grey" style={{ fontSize: 10 }}>{evt.kind}</Label>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{evt.name}</span>
                          <span style={{ fontSize: 11, color: 'var(--os-text-muted, #8a8d90)' }}>{evt.namespace}</span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--os-text-secondary, #6a6e73)', marginTop: 3 }}>
                          <strong>{evt.action}</strong>: {evt.message.slice(0, 150)}{evt.message.length > 150 ? '…' : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </CardBody>
              </Card>
            </div>
          ))
        )}
      </PageSection>
    </>
  );
}
