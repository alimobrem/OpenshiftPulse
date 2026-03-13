import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PageSection, Title, Card, CardBody, Label, Button,
  ToggleGroup, ToggleGroupItem, SearchInput,
  Toolbar, ToolbarContent, ToolbarItem, Pagination,
} from '@patternfly/react-core';
import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';
import { useClusterStore } from '@/store/useClusterStore';

const BASE = '/api/kubernetes';

interface ActivityEntry {
  id: string;
  manager: string;
  kind: string;
  name: string;
  namespace: string;
  operation: string;
  timestamp: Date;
  fields?: string[];
  href?: string;
}

type TimeRange = '1h' | '24h' | '7d';

function formatTimestamp(d: Date): string {
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  if (isToday) return time;
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday ${time}`;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`;
}

function getHref(kind: string, name: string, namespace: string): string | undefined {
  const map: Record<string, string> = {
    Pod: `/workloads/pods/${namespace}/${name}`,
    Deployment: `/workloads/deployments/${namespace}/${name}`,
    ReplicaSet: `/workloads/replicasets/${namespace}/${name}`,
    StatefulSet: `/workloads/statefulsets/${namespace}/${name}`,
    DaemonSet: `/workloads/daemonsets/${namespace}/${name}`,
    Service: `/networking/services/${namespace}/${name}`,
    ConfigMap: `/workloads/configmaps/${namespace}/${name}`,
    Secret: `/workloads/secrets/${namespace}/${name}`,
    Job: `/workloads/jobs/${namespace}/${name}`,
    CronJob: `/workloads/cronjobs/${namespace}/${name}`,
    Ingress: `/networking/ingress/${namespace}/${name}`,
    Route: `/networking/routes/${namespace}/${name}`,
  };
  return map[kind];
}

const resourceApis: { kind: string; path: string }[] = [
  { kind: 'Deployment', path: '/apis/apps/v1/{ns}deployments' },
  { kind: 'StatefulSet', path: '/apis/apps/v1/{ns}statefulsets' },
  { kind: 'DaemonSet', path: '/apis/apps/v1/{ns}daemonsets' },
  { kind: 'Service', path: '/api/v1/{ns}services' },
  { kind: 'ConfigMap', path: '/api/v1/{ns}configmaps' },
  { kind: 'Secret', path: '/api/v1/{ns}secrets' },
  { kind: 'Job', path: '/apis/batch/v1/{ns}jobs' },
  { kind: 'CronJob', path: '/apis/batch/v1/{ns}cronjobs' },
  { kind: 'Ingress', path: '/apis/networking.k8s.io/v1/{ns}ingresses' },
];

const managerColor = (m: string): 'blue' | 'purple' | 'teal' | 'orange' | 'green' | 'grey' => {
  if (/helm/i.test(m)) return 'blue';
  if (/argo/i.test(m)) return 'purple';
  if (/kubectl/i.test(m)) return 'orange';
  if (/mozilla|chrome|safari/i.test(m)) return 'green';
  if (/event/i.test(m)) return 'teal';
  return 'grey';
};

const operationColor = (op: string): 'blue' | 'orange' | 'green' | 'red' | 'grey' => {
  if (op === 'Apply') return 'blue';
  if (op === 'Update') return 'orange';
  if (/create/i.test(op)) return 'green';
  if (/delete|kill/i.test(op)) return 'red';
  return 'grey';
};

export default function UserActivity() {
  const navigate = useNavigate();
  const selectedNamespace = useClusterStore((s) => s.selectedNamespace);
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<TimeRange>('24h');
  const [search, setSearch] = useState('');
  const [selectedManager, setSelectedManager] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [sortIndex, setSortIndex] = useState<number | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    let cancelled = false;

    async function loadActivity() {
      setLoading(true);
      const cutoff = new Date();
      if (range === '1h') cutoff.setHours(cutoff.getHours() - 1);
      else if (range === '24h') cutoff.setHours(cutoff.getHours() - 24);
      else cutoff.setDate(cutoff.getDate() - 7);

      const allEntries: ActivityEntry[] = [];

      const nsPrefix = selectedNamespace !== 'all'
        ? `namespaces/${encodeURIComponent(selectedNamespace)}/`
        : '';

      for (const api of resourceApis) {
        const path = api.path.replace('{ns}', nsPrefix);
        try {
          const res = await fetch(`${BASE}${path}`);
          if (!res.ok) continue;
          const data = await res.json() as { items: Record<string, unknown>[] };

          for (const item of data.items ?? []) {
            const metadata = (item['metadata'] ?? {}) as Record<string, unknown>;
            const resourceName = String(metadata['name'] ?? '');
            const resourceNs = String(metadata['namespace'] ?? '');
            const managedFields = (metadata['managedFields'] ?? []) as {
              manager?: string;
              operation?: string;
              time?: string;
              fieldsV1?: Record<string, unknown>;
            }[];

            for (const field of managedFields) {
              if (!field.time) continue;
              const ts = new Date(field.time);
              if (ts < cutoff) continue;

              const manager = field.manager ?? 'unknown';
              const changedFields: string[] = [];
              if (field.fieldsV1) {
                for (const key of Object.keys(field.fieldsV1)) {
                  if (key.startsWith('f:')) changedFields.push(key.slice(2));
                }
              }

              allEntries.push({
                id: `${resourceNs}/${api.kind}/${resourceName}/${manager}/${field.time}`,
                manager,
                kind: api.kind,
                name: resourceName,
                namespace: resourceNs,
                operation: field.operation ?? 'Update',
                timestamp: ts,
                fields: changedFields.length > 0 ? changedFields : undefined,
                href: getHref(api.kind, resourceName, resourceNs),
              });
            }
          }
        } catch { /* ignore */ }
      }

      try {
        const evtPath = selectedNamespace !== 'all'
          ? `/api/v1/namespaces/${encodeURIComponent(selectedNamespace)}/events?limit=200`
          : '/api/v1/events?limit=200';
        const res = await fetch(`${BASE}${evtPath}`);
        if (res.ok) {
          const data = await res.json() as { items: Record<string, unknown>[] };
          for (const evt of data.items ?? []) {
            const ts = new Date(String((evt as Record<string, unknown>)['lastTimestamp'] ?? (evt as Record<string, unknown>)['eventTime'] ?? ((evt as Record<string, unknown>)['metadata'] as Record<string, unknown>)?.['creationTimestamp'] ?? ''));
            if (ts < cutoff || isNaN(ts.getTime())) continue;

            const reason = String((evt as Record<string, unknown>)['reason'] ?? '');
            const actionReasons = ['ScalingReplicaSet', 'SuccessfulCreate', 'SuccessfulDelete', 'Killing', 'Created', 'Started'];
            if (!actionReasons.includes(reason)) continue;

            const involved = ((evt as Record<string, unknown>)['involvedObject'] ?? {}) as Record<string, unknown>;
            const objKind = String(involved['kind'] ?? '');
            const objName = String(involved['name'] ?? '');
            const objNs = String(involved['namespace'] ?? '');

            allEntries.push({
              id: `evt-${objNs}/${objKind}/${objName}/${reason}/${ts.getTime()}`,
              manager: 'K8s Event',
              kind: objKind,
              name: objName,
              namespace: objNs,
              operation: reason,
              timestamp: ts,
              href: getHref(objKind, objName, objNs),
            });
          }
        }
      } catch { /* ignore */ }

      if (!cancelled) {
        allEntries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        setEntries(allEntries);
        setLoading(false);
      }
    }

    loadActivity();
    return () => { cancelled = true; };
  }, [range, selectedNamespace]);

  // Filter
  let filtered = entries;
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter((e) =>
      e.manager.toLowerCase().includes(q) ||
      e.name.toLowerCase().includes(q) ||
      e.kind.toLowerCase().includes(q) ||
      e.namespace.toLowerCase().includes(q) ||
      e.operation.toLowerCase().includes(q) ||
      (e.fields ?? []).some((f) => f.toLowerCase().includes(q))
    );
  }
  if (selectedManager) {
    filtered = filtered.filter((e) => e.manager === selectedManager);
  }

  // Sort
  const sortKeys = ['timestamp', 'manager', 'operation', 'kind', 'name', 'namespace', 'fields'];
  let sorted = filtered;
  if (sortIndex !== null && sortKeys[sortIndex]) {
    const key = sortKeys[sortIndex];
    sorted = [...filtered].sort((a, b) => {
      let aVal: string, bVal: string;
      if (key === 'timestamp') {
        aVal = String(a.timestamp.getTime());
        bVal = String(b.timestamp.getTime());
      } else if (key === 'fields') {
        aVal = (a.fields ?? []).join(',');
        bVal = (b.fields ?? []).join(',');
      } else {
        aVal = String((a as Record<string, unknown>)[key] ?? '');
        bVal = String((b as Record<string, unknown>)[key] ?? '');
      }
      const cmp = aVal.localeCompare(bVal, undefined, { numeric: true });
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }

  // Paginate
  const paginated = sorted.slice((page - 1) * perPage, page * perPage);

  // Unique managers for filter buttons
  const managers = [...new Set(entries.map((e) => e.manager))].sort();

  const onSort = (_event: React.MouseEvent, index: number, direction: 'asc' | 'desc') => {
    setSortIndex(index);
    setSortDirection(direction);
  };

  // Summary counts
  const managerCounts = new Map<string, number>();
  for (const e of entries) {
    managerCounts.set(e.manager, (managerCounts.get(e.manager) ?? 0) + 1);
  }

  return (
    <>
      <PageSection variant="default">
        <Title headingLevel="h1" size="2xl">User Activity</Title>
        <p className="os-text-muted">Audit trail — what changed, when, by which tool. The "Who" column shows the client tool (kubectl, argocd, helm), not the authenticated user. For user login history, see Access History.</p>
      </PageSection>

      <PageSection>
        {/* Summary cards */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
          <Card style={{ flex: 1, minWidth: 120 }}>
            <CardBody style={{ textAlign: 'center', padding: '12px 16px' }}>
              <Title headingLevel="h3" size="2xl">{entries.length}</Title>
              <div className="os-text-muted" style={{ fontSize: 12 }}>Total Changes</div>
            </CardBody>
          </Card>
          <Card style={{ flex: 1, minWidth: 120 }}>
            <CardBody style={{ textAlign: 'center', padding: '12px 16px' }}>
              <Title headingLevel="h3" size="2xl">{managers.length}</Title>
              <div className="os-text-muted" style={{ fontSize: 12 }}>Actors</div>
            </CardBody>
          </Card>
          <Card style={{ flex: 1, minWidth: 120 }}>
            <CardBody style={{ textAlign: 'center', padding: '12px 16px' }}>
              <Title headingLevel="h3" size="2xl">{new Set(entries.map((e) => e.kind)).size}</Title>
              <div className="os-text-muted" style={{ fontSize: 12 }}>Resource Types</div>
            </CardBody>
          </Card>
          <Card style={{ flex: 1, minWidth: 120 }}>
            <CardBody style={{ textAlign: 'center', padding: '12px 16px' }}>
              <Title headingLevel="h3" size="2xl">{new Set(entries.map((e) => `${e.namespace}/${e.name}`)).size}</Title>
              <div className="os-text-muted" style={{ fontSize: 12 }}>Resources Touched</div>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardBody>
            <Toolbar>
              <ToolbarContent>
                <ToolbarItem>
                  <ToggleGroup aria-label="Time range">
                    <ToggleGroupItem text="1 hour" isSelected={range === '1h'} onChange={() => { setRange('1h'); setPage(1); }} />
                    <ToggleGroupItem text="24 hours" isSelected={range === '24h'} onChange={() => { setRange('24h'); setPage(1); }} />
                    <ToggleGroupItem text="7 days" isSelected={range === '7d'} onChange={() => { setRange('7d'); setPage(1); }} />
                  </ToggleGroup>
                </ToolbarItem>
                <ToolbarItem>
                  <SearchInput
                    placeholder="Search by actor, resource, kind, namespace..."
                    value={search}
                    onChange={(_e, val) => { setSearch(val); setPage(1); }}
                    onClear={() => { setSearch(''); setPage(1); }}
                    style={{ minWidth: 280 }}
                  />
                </ToolbarItem>
                <ToolbarItem variant="pagination" align={{ default: 'alignEnd' }}>
                  <Pagination
                    itemCount={filtered.length}
                    perPage={perPage}
                    page={page}
                    onSetPage={(_e, p) => setPage(p)}
                    onPerPageSelect={(_e, pp) => { setPerPage(pp); setPage(1); }}
                    isCompact
                  />
                </ToolbarItem>
              </ToolbarContent>
            </Toolbar>

            {/* Manager filter chips */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
              <Button
                variant={selectedManager === null ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => { setSelectedManager(null); setPage(1); }}
              >
                All
              </Button>
              {managers.map((m) => (
                <Button
                  key={m}
                  variant={selectedManager === m ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => { setSelectedManager(selectedManager === m ? null : m); setPage(1); }}
                >
                  {m} ({managerCounts.get(m) ?? 0})
                </Button>
              ))}
            </div>

            <Table aria-label="User activity table" variant="compact">
              <Thead>
                <Tr>
                  {['When', 'Who', 'Action', 'Kind', 'Resource', 'Namespace', 'Fields Changed'].map((title, i) => (
                    <Th key={title} sort={{ sortBy: sortIndex !== null ? { index: sortIndex, direction: sortDirection } : { direction: sortDirection }, onSort, columnIndex: i }}>
                      {title}
                    </Th>
                  ))}
                </Tr>
              </Thead>
              <Tbody>
                {loading ? (
                  <Tr><Td colSpan={7}><span className="os-text-muted">Scanning resources for activity...</span></Td></Tr>
                ) : paginated.length === 0 ? (
                  <Tr><Td colSpan={7}><span className="os-text-muted">No activity found.</span></Td></Tr>
                ) : (
                  paginated.map((entry, i) => (
                    <Tr
                      key={entry.id + i}
                      isClickable={!!entry.href}
                      onRowClick={entry.href ? () => navigate(entry.href!) : undefined}
                      className={entry.href ? 'os-list__row--clickable' : ''}
                    >
                      <Td dataLabel="When" style={{ whiteSpace: 'nowrap', fontSize: 13 }}>
                        {formatTimestamp(entry.timestamp)}
                      </Td>
                      <Td dataLabel="Who">
                        <Label color={managerColor(entry.manager)} isCompact>{entry.manager}</Label>
                      </Td>
                      <Td dataLabel="Action">
                        <Label color={operationColor(entry.operation)} isCompact>{entry.operation}</Label>
                      </Td>
                      <Td dataLabel="Kind" style={{ fontSize: 13 }}>{entry.kind}</Td>
                      <Td dataLabel="Resource"><strong style={{ fontSize: 13 }}>{entry.name}</strong></Td>
                      <Td dataLabel="Namespace" style={{ fontSize: 13, color: 'var(--os-text-muted, #8a8d90)' }}>{entry.namespace}</Td>
                      <Td dataLabel="Fields Changed" style={{ fontSize: 12, color: 'var(--os-text-secondary, #6a6e73)' }}>
                        {entry.fields && entry.fields.length > 0
                          ? entry.fields.slice(0, 3).join(', ') + (entry.fields.length > 3 ? ` +${entry.fields.length - 3}` : '')
                          : '-'}
                      </Td>
                    </Tr>
                  ))
                )}
              </Tbody>
            </Table>
          </CardBody>
        </Card>
      </PageSection>
    </>
  );
}
