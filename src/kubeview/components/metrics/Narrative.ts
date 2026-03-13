/**
 * Narrative - Rule-based incident story builder
 *
 * Analyzes correlated events, alerts, and metrics to build a human-readable
 * narrative of what happened during an incident. All rule-based, no AI.
 */

export interface NarrativeEvent {
  timestamp: number;
  description: string;
  type: 'action' | 'symptom' | 'resolution';
  source: 'event' | 'metric' | 'log' | 'alert';
  detail?: string;
}

export interface NarrativeResult {
  events: NarrativeEvent[];
  rootCause?: string;
  summary: string;
}

interface K8sEvent {
  timestamp: string;
  reason: string;
  message: string;
  involvedObject: { kind: string; name: string };
  source?: { component: string };
}

interface Alert {
  startsAt: string;
  endsAt?: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
}

interface MetricAnomaly {
  timestamp: number;
  metric: string;
  value: number;
  threshold: number;
  direction: 'above' | 'below';
}

/**
 * Build a narrative from correlated data
 */
export function buildNarrative(inputs: {
  events: K8sEvent[];
  alerts?: Alert[];
  metricAnomalies?: MetricAnomaly[];
}): NarrativeResult {
  const narrativeEvents: NarrativeEvent[] = [];
  const { events, alerts = [], metricAnomalies = [] } = inputs;

  // Sort all events chronologically
  const sortedEvents = [...events].sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Convert K8s events to narrative events
  for (const event of sortedEvents) {
    const timestamp = new Date(event.timestamp).getTime() / 1000;

    narrativeEvents.push({
      timestamp,
      description: formatEventDescription(event),
      type: classifyEventType(event.reason),
      source: 'event',
      detail: event.message,
    });
  }

  // Convert alerts to narrative events
  for (const alert of alerts) {
    const timestamp = new Date(alert.startsAt).getTime() / 1000;

    narrativeEvents.push({
      timestamp,
      description: formatAlertDescription(alert),
      type: 'symptom',
      source: 'alert',
      detail: alert.annotations.description || alert.annotations.summary,
    });
  }

  // Convert metric anomalies to narrative events
  for (const anomaly of metricAnomalies) {
    narrativeEvents.push({
      timestamp: anomaly.timestamp,
      description: formatAnomalyDescription(anomaly),
      type: 'symptom',
      source: 'metric',
      detail: `${anomaly.metric} ${anomaly.direction} threshold (${anomaly.value} vs ${anomaly.threshold})`,
    });
  }

  // Sort all narrative events chronologically
  narrativeEvents.sort((a, b) => a.timestamp - b.timestamp);

  // Apply narrative rules to identify patterns
  const rootCause = identifyRootCause(narrativeEvents, sortedEvents);
  const summary = generateSummary(narrativeEvents, rootCause);

  return {
    events: narrativeEvents,
    rootCause,
    summary,
  };
}

/**
 * Format K8s event as human-readable description
 */
function formatEventDescription(event: K8sEvent): string {
  const obj = event.involvedObject;
  const objName = `${obj.kind} ${obj.name}`;

  // Special formatting for common event reasons
  switch (event.reason) {
    case 'Pulling':
      return `Started pulling container image for ${objName}`;
    case 'Pulled':
      return `Successfully pulled container image for ${objName}`;
    case 'Created':
      return `Created ${objName}`;
    case 'Started':
      return `Started ${objName}`;
    case 'Killing':
      return `Terminating ${objName}`;
    case 'FailedScheduling':
      return `Failed to schedule ${objName}`;
    case 'BackOff':
      return `${objName} in CrashLoopBackOff`;
    case 'Unhealthy':
      return `${objName} failed health check`;
    case 'Scaled':
      return `Scaled ${objName}`;
    case 'SuccessfulCreate':
      return `Successfully created ${objName}`;
    case 'SuccessfulDelete':
      return `Successfully deleted ${objName}`;
    default:
      return `${event.reason}: ${objName}`;
  }
}

/**
 * Format alert as human-readable description
 */
function formatAlertDescription(alert: Alert): string {
  const alertName = alert.labels.alertname || 'Alert';
  const severity = alert.labels.severity || 'unknown';

  return `${severity.toUpperCase()} alert: ${alertName}`;
}

/**
 * Format metric anomaly as human-readable description
 */
function formatAnomalyDescription(anomaly: MetricAnomaly): string {
  const direction = anomaly.direction === 'above' ? 'exceeded' : 'fell below';
  return `${anomaly.metric} ${direction} threshold`;
}

/**
 * Classify event type based on reason
 */
function classifyEventType(reason: string): 'action' | 'symptom' | 'resolution' {
  const actionReasons = [
    'Pulling', 'Pulled', 'Created', 'Started', 'Killing',
    'Scaled', 'SuccessfulCreate', 'SuccessfulDelete',
  ];

  const symptomReasons = [
    'BackOff', 'FailedScheduling', 'Unhealthy', 'FailedMount',
    'FailedAttachVolume', 'FailedSync',
  ];

  if (actionReasons.includes(reason)) return 'action';
  if (symptomReasons.includes(reason)) return 'symptom';
  return 'symptom';
}

/**
 * Identify probable root cause from event patterns
 */
function identifyRootCause(narrativeEvents: NarrativeEvent[], k8sEvents: K8sEvent[]): string | undefined {
  if (narrativeEvents.length === 0) return undefined;

  // Rule 1: Image change followed by error burst
  const imageChange = findEventByReason(k8sEvents, ['Pulled', 'Pulling']);
  if (imageChange) {
    const imageTime = new Date(imageChange.timestamp).getTime() / 1000;
    const errorsAfter = narrativeEvents.filter(
      (e) => e.type === 'symptom' && e.timestamp > imageTime && e.timestamp < imageTime + 120
    );
    if (errorsAfter.length > 2) {
      return 'Container image update triggered errors';
    }
  }

  // Rule 2: Scale event followed by CPU spike
  const scaleEvent = findEventByReason(k8sEvents, ['Scaled']);
  if (scaleEvent) {
    const scaleTime = new Date(scaleEvent.timestamp).getTime() / 1000;
    const cpuSpike = narrativeEvents.find(
      (e) => e.source === 'metric' &&
             e.description.includes('CPU') &&
             e.timestamp > scaleTime &&
             e.timestamp < scaleTime + 300
    );
    if (cpuSpike) {
      return 'Scaling operation caused resource contention';
    }
  }

  // Rule 3: OOMKilled after memory ramp
  const oomEvent = findEventByReason(k8sEvents, ['OOMKilled']);
  if (oomEvent) {
    const oomTime = new Date(oomEvent.timestamp).getTime() / 1000;
    const memoryRamp = narrativeEvents.filter(
      (e) => e.source === 'metric' &&
             e.description.includes('Memory') &&
             e.timestamp < oomTime &&
             e.timestamp > oomTime - 600
    );
    if (memoryRamp.length > 0) {
      return 'Memory leak or insufficient memory limits';
    }
  }

  // Rule 4: Node NotReady followed by pod rescheduling
  const nodeNotReady = k8sEvents.find((e) =>
    e.involvedObject.kind === 'Node' && e.reason.includes('NotReady')
  );
  if (nodeNotReady) {
    const nodeTime = new Date(nodeNotReady.timestamp).getTime() / 1000;
    const podsRescheduled = k8sEvents.filter(
      (e) => e.reason === 'SuccessfulCreate' &&
             new Date(e.timestamp).getTime() / 1000 > nodeTime &&
             new Date(e.timestamp).getTime() / 1000 < nodeTime + 300
    );
    if (podsRescheduled.length > 0) {
      return 'Node failure caused pod disruption';
    }
  }

  // Rule 5: Certificate expiry alert
  const certAlert = narrativeEvents.find((e) =>
    e.source === 'alert' && e.description.toLowerCase().includes('certificate')
  );
  if (certAlert) {
    return 'TLS certificate approaching expiry or expired';
  }

  // Rule 6: Deployment rollout with temporary errors
  const rolloutStart = findEventByReason(k8sEvents, ['Created']);
  if (rolloutStart) {
    const rolloutTime = new Date(rolloutStart.timestamp).getTime() / 1000;
    const errorsAround = narrativeEvents.filter(
      (e) => e.type === 'symptom' &&
             e.timestamp > rolloutTime &&
             e.timestamp < rolloutTime + 300
    );
    const resolution = narrativeEvents.find(
      (e) => e.type === 'resolution' &&
             e.timestamp > rolloutTime + 60 &&
             e.timestamp < rolloutTime + 600
    );
    if (errorsAround.length > 0 && resolution) {
      return 'Deployment rollout caused temporary errors during transition';
    }
  }

  // Default: Look for the first action event before symptoms
  const firstSymptom = narrativeEvents.find((e) => e.type === 'symptom');
  if (firstSymptom) {
    const priorAction = narrativeEvents
      .filter((e) => e.type === 'action' && e.timestamp < firstSymptom.timestamp)
      .pop();

    if (priorAction) {
      return `${priorAction.description} may have triggered the issue`;
    }
  }

  return 'Root cause could not be determined from available data';
}

/**
 * Find event by reason(s)
 */
function findEventByReason(events: K8sEvent[], reasons: string[]): K8sEvent | undefined {
  return events.find((e) => reasons.includes(e.reason));
}

/**
 * Generate summary of the incident
 */
function generateSummary(events: NarrativeEvent[], rootCause?: string): string {
  if (events.length === 0) {
    return 'No events recorded during this time period.';
  }

  const symptoms = events.filter((e) => e.type === 'symptom');
  const actions = events.filter((e) => e.type === 'action');
  const resolutions = events.filter((e) => e.type === 'resolution');

  const parts: string[] = [];

  // Summary sentence
  if (symptoms.length > 0) {
    parts.push(`Detected ${symptoms.length} symptom${symptoms.length === 1 ? '' : 's'}`);
  }
  if (actions.length > 0) {
    parts.push(`${actions.length} action${actions.length === 1 ? '' : 's'} taken`);
  }
  if (resolutions.length > 0) {
    parts.push(`${resolutions.length} resolution${resolutions.length === 1 ? '' : 's'} observed`);
  }

  let summary = parts.join(', ') + '.';

  // Add root cause if identified
  if (rootCause) {
    summary += ` ${rootCause}.`;
  }

  // Add time span
  const startTime = new Date(events[0].timestamp * 1000);
  const endTime = new Date(events[events.length - 1].timestamp * 1000);
  const duration = Math.round((endTime.getTime() - startTime.getTime()) / 1000 / 60);

  if (duration > 0) {
    summary += ` Incident duration: ${duration} minute${duration === 1 ? '' : 's'}.`;
  }

  return summary;
}

/**
 * Group related events together
 */
export function groupEvents(events: NarrativeEvent[]): Array<{
  title: string;
  events: NarrativeEvent[];
}> {
  const groups: Array<{ title: string; events: NarrativeEvent[] }> = [];

  // Group by time windows (5 minutes)
  const windowSize = 300; // 5 minutes in seconds
  let currentGroup: NarrativeEvent[] = [];
  let currentWindowStart = 0;

  for (const event of events) {
    if (currentGroup.length === 0) {
      currentWindowStart = event.timestamp;
      currentGroup.push(event);
    } else if (event.timestamp - currentWindowStart < windowSize) {
      currentGroup.push(event);
    } else {
      // Start new group
      if (currentGroup.length > 0) {
        const startDate = new Date(currentWindowStart * 1000);
        groups.push({
          title: startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          events: [...currentGroup],
        });
      }
      currentWindowStart = event.timestamp;
      currentGroup = [event];
    }
  }

  // Add final group
  if (currentGroup.length > 0) {
    const startDate = new Date(currentWindowStart * 1000);
    groups.push({
      title: startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      events: currentGroup,
    });
  }

  return groups;
}
