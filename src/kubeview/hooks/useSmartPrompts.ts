/**
 * useSmartPrompts — reads live cluster state and generates context-aware
 * AI prompt suggestions. Uses useK8sListWatch (shared TanStack Query cache)
 * and useClusterStore.
 *
 * Consumed by: CommandPalette (? mode), DockAgentPanel, EmptyState
 */

import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useK8sListWatch } from './useK8sListWatch';
import { useClusterStore } from '../store/clusterStore';
import { useUIStore } from '../store/uiStore';
import { generateSmartPrompts, type SmartPrompt } from '../engine/smartPrompts';
import type { K8sResource } from '../engine/renderers';

export interface SmartPromptItem {
  prompt: string;
  context: string;
  priority: number;
}

/**
 * Detect pods in CrashLoopBackOff, ImagePullBackOff, Error, or Failed state.
 */
function detectFailedPods(pods: K8sResource[]): Array<{ name: string; namespace: string; status: string }> {
  const failed: Array<{ name: string; namespace: string; status: string }> = [];
  for (const pod of pods) {
    const status = (pod.status ?? {}) as { phase?: string; containerStatuses?: Array<{
      state?: { waiting?: { reason?: string } };
    }> };
    const phase = status.phase;
    const containerStatuses = status.containerStatuses;

    // Check container waiting reasons
    const waitingReason = containerStatuses?.find(
      (cs) => cs.state?.waiting?.reason === 'CrashLoopBackOff' ||
              cs.state?.waiting?.reason === 'ImagePullBackOff' ||
              cs.state?.waiting?.reason === 'ErrImagePull',
    )?.state?.waiting?.reason;

    if (waitingReason) {
      failed.push({
        name: pod.metadata.name,
        namespace: pod.metadata.namespace ?? 'default',
        status: waitingReason,
      });
    } else if (phase === 'Failed') {
      failed.push({
        name: pod.metadata.name,
        namespace: pod.metadata.namespace ?? 'default',
        status: 'Failed',
      });
    }
  }
  return failed;
}

/**
 * Detect pods stuck in Pending state.
 */
function detectPendingPods(pods: K8sResource[]): Array<{ name: string; namespace: string }> {
  return pods
    .filter((pod) => ((pod.status as { phase?: string } | undefined)?.phase === 'Pending'))
    .map((pod) => ({
      name: pod.metadata.name,
      namespace: pod.metadata.namespace ?? 'default',
    }));
}

/**
 * Detect PVCs stuck in Pending state.
 */
function detectPendingPVCs(pvcs: K8sResource[]): Array<{ name: string; namespace: string }> {
  return pvcs
    .filter((pvc) => ((pvc.status as { phase?: string } | undefined)?.phase === 'Pending'))
    .map((pvc) => ({
      name: pvc.metadata.name,
      namespace: pvc.metadata.namespace ?? 'default',
    }));
}

/**
 * Detect deployments with unavailable replicas.
 */
function detectUnhealthyDeployments(deployments: K8sResource[]): Array<{ name: string; namespace: string; ready: number; desired: number }> {
  const unhealthy: Array<{ name: string; namespace: string; ready: number; desired: number }> = [];
  for (const dep of deployments) {
    const spec = (dep.spec ?? {}) as { replicas?: number };
    const status = (dep.status ?? {}) as { readyReplicas?: number };
    const desired = spec.replicas ?? 0;
    const ready = status.readyReplicas ?? 0;
    if (desired > 0 && ready < desired) {
      unhealthy.push({
        name: dep.metadata.name,
        namespace: dep.metadata.namespace ?? 'default',
        ready,
        desired,
      });
    }
  }
  return unhealthy;
}

/**
 * Detect warning events (recent, within last 30 min).
 */
function countWarningEvents(events: K8sResource[]): number {
  const thirtyMinAgo = Date.now() - 30 * 60 * 1000;
  return events.filter((ev) => {
    if ((ev as Record<string, unknown>).type !== 'Warning') return false;
    const ts = ((ev as Record<string, unknown>).lastTimestamp || ev.metadata.creationTimestamp) as string | undefined;
    return ts ? new Date(ts).getTime() > thirtyMinAgo : false;
  }).length;
}

export function useSmartPrompts(): SmartPromptItem[] {
  const { data: pods = [], isLoading } = useK8sListWatch({ apiPath: '/api/v1/pods' });
  const { data: deployments = [] } = useK8sListWatch({ apiPath: '/apis/apps/v1/deployments' });
  const { data: events = [] } = useK8sListWatch({ apiPath: '/api/v1/events' });
  const { data: pvcs = [] } = useK8sListWatch({ apiPath: '/api/v1/persistentvolumeclaims' });
  const clusterVersion = useClusterStore((s) => s.clusterVersion);
  const selectedNamespace = useUIStore((s) => s.selectedNamespace);
  const location = useLocation();

  return useMemo(() => {
    // Don't generate prompts while data is still loading
    if (isLoading) return [];

    const failedPods = detectFailedPods(pods);
    const pendingPods = detectPendingPods(pods);
    const pendingPVCs = detectPendingPVCs(pvcs);
    const unhealthyDeps = detectUnhealthyDeployments(deployments);
    const warningEventCount = countWarningEvents(events);

    const items: SmartPromptItem[] = [];

    // --- Critical: Crash-looping / errored pods ---
    if (failedPods.length > 0) {
      const crashLooping = failedPods.filter((p) => p.status === 'CrashLoopBackOff');
      const imgPull = failedPods.filter((p) => p.status === 'ImagePullBackOff' || p.status === 'ErrImagePull');

      if (crashLooping.length > 0) {
        const namespaces = [...new Set(crashLooping.map((p) => p.namespace))];
        const nsText = namespaces.length === 1 ? `in namespace ${namespaces[0]}` : `across ${namespaces.length} namespaces`;
        items.push({
          prompt: `${crashLooping.length} pod${crashLooping.length > 1 ? 's' : ''} crash-looping ${nsText} \u2014 diagnose?`,
          context: `CrashLoopBackOff: ${crashLooping.map((p) => `${p.namespace}/${p.name}`).slice(0, 5).join(', ')}`,
          priority: 100,
        });
      }

      if (imgPull.length > 0) {
        items.push({
          prompt: `${imgPull.length} pod${imgPull.length > 1 ? 's' : ''} failing image pull \u2014 fix?`,
          context: `ImagePullBackOff: ${imgPull.map((p) => `${p.namespace}/${p.name}`).slice(0, 5).join(', ')}`,
          priority: 95,
        });
      }

      const otherFailed = failedPods.filter((p) => p.status === 'Failed');
      if (otherFailed.length > 0) {
        items.push({
          prompt: `${otherFailed.length} pod${otherFailed.length > 1 ? 's' : ''} in Failed state \u2014 investigate?`,
          context: `Failed: ${otherFailed.map((p) => `${p.namespace}/${p.name}`).slice(0, 5).join(', ')}`,
          priority: 90,
        });
      }
    }

    // --- High: Pending pods ---
    if (pendingPods.length > 0) {
      const namespaces = [...new Set(pendingPods.map((p) => p.namespace))];
      const nsText = namespaces.length === 1 ? `in ${namespaces[0]}` : `across ${namespaces.length} namespaces`;
      items.push({
        prompt: `${pendingPods.length} pod${pendingPods.length > 1 ? 's' : ''} stuck pending ${nsText} \u2014 troubleshoot?`,
        context: `Pending pods: ${pendingPods.map((p) => `${p.namespace}/${p.name}`).slice(0, 5).join(', ')}`,
        priority: 85,
      });
    }

    // --- High: Unhealthy deployments ---
    if (unhealthyDeps.length > 0) {
      const first = unhealthyDeps[0];
      if (unhealthyDeps.length === 1) {
        items.push({
          prompt: `${first.name} has ${first.ready}/${first.desired} replicas ready \u2014 investigate?`,
          context: `Deployment ${first.namespace}/${first.name}: ${first.ready}/${first.desired} ready`,
          priority: 80,
        });
      } else {
        items.push({
          prompt: `${unhealthyDeps.length} deployments have unavailable replicas \u2014 diagnose?`,
          context: `Unhealthy: ${unhealthyDeps.map((d) => `${d.namespace}/${d.name} (${d.ready}/${d.desired})`).slice(0, 5).join(', ')}`,
          priority: 80,
        });
      }
    }

    // --- Medium: Pending PVCs ---
    if (pendingPVCs.length > 0) {
      const namespaces = [...new Set(pendingPVCs.map((p) => p.namespace))];
      const nsText = namespaces.length === 1 ? `in ${namespaces[0]} namespace` : `across ${namespaces.length} namespaces`;
      items.push({
        prompt: `PVC${pendingPVCs.length > 1 ? 's' : ''} stuck pending ${nsText} \u2014 troubleshoot?`,
        context: `Pending PVCs: ${pendingPVCs.map((p) => `${p.namespace}/${p.name}`).slice(0, 5).join(', ')}`,
        priority: 70,
      });
    }

    // --- Medium: Warning events ---
    if (warningEventCount > 5) {
      items.push({
        prompt: `${warningEventCount} warning events in the last 30 min \u2014 summarize?`,
        context: 'Recent warning events from cluster event stream',
        priority: 60,
      });
    }

    // --- Also feed into the existing smartPrompts engine for view-specific prompts ---
    const enginePrompts = generateSmartPrompts({
      currentView: location.pathname,
      selectedNamespace: selectedNamespace === '*' ? undefined : selectedNamespace,
      failedPods: failedPods.length > 0 ? failedPods : undefined,
    });

    // Add view-specific prompts from the engine that we haven't already covered
    const seenContexts = new Set(items.map((item) => item.context));
    for (const sp of enginePrompts) {
      const context = `${sp.category} suggestion for ${location.pathname}`;
      const isDuplicate = seenContexts.has(context) || items.some((item) =>
        item.prompt.toLowerCase().includes(sp.text.toLowerCase().slice(0, 20)),
      );
      if (!isDuplicate && sp.priority <= 60) {
        seenContexts.add(context);
        items.push({ prompt: sp.text, context, priority: sp.priority });
      }
    }

    // --- Healthy cluster: encouraging prompts ---
    if (items.length === 0) {
      items.push(
        {
          prompt: 'Create a dashboard for this namespace',
          context: 'No issues detected. Suggesting view creation.',
          priority: 30,
        },
        {
          prompt: 'Review security posture',
          context: 'No issues detected. Suggesting proactive security review.',
          priority: 25,
        },
        {
          prompt: 'Build an investigation plan for this cluster',
          context: 'No issues detected. Suggesting proactive planning.',
          priority: 20,
        },
      );
    }

    // --- Always include self-discovery prompt ---
    items.push({
      prompt: 'What skills do you have?',
      context: 'Self-description: lists skills, tools, and capabilities',
      priority: 10,
    });

    // Sort by priority descending
    return items.sort((a, b) => b.priority - a.priority);
  }, [pods, pvcs, deployments, events, isLoading, location.pathname, selectedNamespace]);
}
