/**
 * Canonical Incident Model — normalizes findings, alerts, errors, timeline
 * entries, and fleet alerts into a single IncidentItem shape for unified
 * display and correlation.
 */

import type { Finding, ResourceRef } from '../monitorClient';
import type { TimelineEntry } from './timeline';
import type { TrackedError } from '../../store/errorStore';

export type Freshness = 'new' | 'recent' | 'stale';

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

export function computeFreshness(timestampMs: number, now = Date.now()): Freshness {
  const age = now - timestampMs;
  if (age < FIVE_MINUTES_MS) return 'new';
  if (age < ONE_HOUR_MS) return 'recent';
  return 'stale';
}

export type IncidentSeverity = 'critical' | 'warning' | 'info';

function normalizeSeverity(raw: string): IncidentSeverity {
  const lower = raw.toLowerCase();
  if (lower === 'critical') return 'critical';
  if (lower === 'warning') return 'warning';
  return 'info';
}

/** Maps TimelineSeverity "normal" to IncidentSeverity "info". */
const TIMELINE_SEVERITY_MAP: Record<string, IncidentSeverity> = {
  critical: 'critical',
  warning: 'warning',
  info: 'info',
  normal: 'info',
};

export type IncidentSource =
  | 'finding'
  | 'prometheus-alert'
  | 'tracked-error'
  | 'timeline-entry'
  | 'fleet-alert';

export interface IncidentItem {
  id: string;
  source: IncidentSource;
  severity: IncidentSeverity;
  title: string;
  detail: string;
  timestamp: number;
  freshness: Freshness;
  namespace?: string;
  resources: ResourceRef[];
  category: string;
  /** Original object for drill-down / detail views. */
  raw: unknown;
}

export interface PrometheusAlert {
  labels: Record<string, string>;
  annotations: Record<string, string>;
  state: 'firing' | 'pending' | 'inactive';
  activeAt?: string;
}

export interface FleetAlert {
  clusterId: string;
  clusterName: string;
  alertName: string;
  severity: string;
  namespace: string;
  state: string;
  activeAt: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
}

export function findingToIncident(f: Finding, now = Date.now()): IncidentItem {
  return {
    id: f.id,
    source: 'finding',
    severity: f.severity,
    title: f.title,
    detail: f.summary,
    timestamp: f.timestamp,
    freshness: computeFreshness(f.timestamp, now),
    namespace: f.resources[0]?.namespace,
    resources: f.resources,
    category: f.category,
    raw: f,
  };
}

export function prometheusAlertToIncident(
  alert: PrometheusAlert,
  now = Date.now(),
): IncidentItem {
  const ts = alert.activeAt ? new Date(alert.activeAt).getTime() : now;
  const severity = normalizeSeverity(alert.labels.severity ?? 'info');
  const namespace = alert.labels.namespace;
  const resources: ResourceRef[] = [];
  if (alert.labels.pod) {
    resources.push({ kind: 'Pod', name: alert.labels.pod, namespace });
  }

  return {
    id: `prom-${alert.labels.alertname ?? 'unknown'}-${ts}`,
    source: 'prometheus-alert',
    severity,
    title: alert.labels.alertname ?? 'Prometheus Alert',
    detail: alert.annotations.description ?? alert.annotations.summary ?? '',
    timestamp: ts,
    freshness: computeFreshness(ts, now),
    namespace,
    resources,
    category: alert.labels.alertname ?? 'prometheus',
    raw: alert,
  };
}

export function trackedErrorToIncident(
  err: TrackedError,
  now = Date.now(),
): IncidentItem {
  const resources: ResourceRef[] = [];
  if (err.resourceKind && err.resourceName) {
    resources.push({
      kind: err.resourceKind,
      name: err.resourceName,
      namespace: err.namespace,
    });
  }

  return {
    id: err.id,
    source: 'tracked-error',
    severity: err.statusCode >= 500 ? 'critical' : 'warning',
    title: err.userMessage,
    detail: err.message,
    timestamp: err.timestamp,
    freshness: computeFreshness(err.timestamp, now),
    namespace: err.namespace,
    resources,
    category: err.category,
    raw: err,
  };
}

export function timelineEntryToIncident(
  entry: TimelineEntry,
  now = Date.now(),
): IncidentItem {
  const ts = new Date(entry.timestamp).getTime();
  return {
    id: entry.id,
    source: 'timeline-entry',
    severity: TIMELINE_SEVERITY_MAP[entry.severity] ?? 'info',
    title: entry.title,
    detail: entry.detail,
    timestamp: ts,
    freshness: computeFreshness(ts, now),
    namespace: entry.namespace ?? entry.resource?.namespace,
    resources: entry.resource
      ? [{ kind: entry.resource.kind, name: entry.resource.name, namespace: entry.resource.namespace }]
      : [],
    category: entry.category,
    raw: entry,
  };
}

export function fleetAlertToIncident(
  alert: FleetAlert,
  now = Date.now(),
): IncidentItem {
  const ts = new Date(alert.activeAt).getTime();
  const severity = normalizeSeverity(alert.severity);

  return {
    id: `fleet-${alert.clusterId}-${alert.alertName}-${ts}`,
    source: 'fleet-alert',
    severity,
    title: `[${alert.clusterName}] ${alert.alertName}`,
    detail: alert.annotations.description ?? alert.annotations.summary ?? '',
    timestamp: ts,
    freshness: computeFreshness(ts, now),
    namespace: alert.namespace,
    resources: [],
    category: alert.alertName,
    raw: alert,
  };
}
