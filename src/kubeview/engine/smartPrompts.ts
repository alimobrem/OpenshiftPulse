/**
 * Smart Prompt Engine — generates context-aware AI prompts
 * based on current cluster state and user's current view.
 *
 * Consumed by: PulseView, AgentView, DockAgentPanel, CommandPalette, InlineAgent
 */

import type { ResourceContext } from './agentClient';

export interface SmartPrompt {
  text: string;
  category: 'diagnosis' | 'security' | 'capacity' | 'change' | 'general';
  priority: number; // higher = more urgent, shown first
  context?: ResourceContext;
}

interface SmartPromptInput {
  /** Pods in unhealthy state (CrashLoopBackOff, Error, Failed, ImagePullBackOff) */
  failedPods?: Array<{ name: string; namespace: string; status: string }>;
  /** Cluster operators in degraded/unavailable state */
  degradedOperators?: Array<{ name: string; reason?: string }>;
  /** Currently firing Prometheus alerts */
  firingAlerts?: Array<{ alertname: string; severity?: string; namespace?: string }>;
  /** TLS certs expiring within 30 days */
  certsExpiringSoon?: Array<{ name: string; namespace: string; daysUntilExpiry: number }>;
  /** Current route path (e.g., '/workloads', '/compute', '/pulse') */
  currentView?: string;
  /** Active namespace filter */
  selectedNamespace?: string;
  /** Resource context for detail pages */
  resourceKind?: string;
  resourceName?: string;
  resourceNamespace?: string;
}

export function generateSmartPrompts(input: SmartPromptInput): SmartPrompt[] {
  const prompts: SmartPrompt[] = [];

  // --- Critical: Failed pods ---
  if (input.failedPods?.length) {
    const first = input.failedPods[0];
    prompts.push({
      text: `Why is pod ${first.name} ${first.status} in ${first.namespace}?`,
      category: 'diagnosis',
      priority: 100,
      context: { kind: 'Pod', name: first.name, namespace: first.namespace },
    });
    if (input.failedPods.length > 1) {
      prompts.push({
        text: `Diagnose all ${input.failedPods.length} failing pods`,
        category: 'diagnosis',
        priority: 95,
      });
    }
  }

  // --- Critical: Degraded operators ---
  if (input.degradedOperators?.length) {
    const first = input.degradedOperators[0];
    prompts.push({
      text: `Why is operator ${first.name} degraded?`,
      category: 'diagnosis',
      priority: 90,
      context: { kind: 'ClusterOperator', name: first.name },
    });
  }

  // --- High: Firing alerts ---
  if (input.firingAlerts?.length) {
    const critical = input.firingAlerts.filter((a) => a.severity === 'critical');
    if (critical.length > 0) {
      prompts.push({
        text: `Investigate critical alert ${critical[0].alertname}`,
        category: 'diagnosis',
        priority: 85,
      });
    }
    if (input.firingAlerts.length > 1) {
      prompts.push({
        text: `Triage all ${input.firingAlerts.length} firing alerts`,
        category: 'diagnosis',
        priority: 80,
      });
    }
  }

  // --- Medium: Expiring certs ---
  if (input.certsExpiringSoon?.length) {
    const urgent = input.certsExpiringSoon.filter((c) => c.daysUntilExpiry <= 7);
    if (urgent.length > 0) {
      prompts.push({
        text: `Certificate ${urgent[0].name} expires in ${urgent[0].daysUntilExpiry} days — how to renew?`,
        category: 'security',
        priority: 70,
      });
    }
  }

  // --- Resource-specific (detail pages) ---
  if (input.resourceKind && input.resourceName) {
    const ctx: ResourceContext = {
      kind: input.resourceKind,
      name: input.resourceName,
      namespace: input.resourceNamespace,
    };
    prompts.push({
      text: `What changed recently for this ${input.resourceKind.toLowerCase()}?`,
      category: 'change',
      priority: 60,
      context: ctx,
    });
    prompts.push({
      text: `How can I optimize this ${input.resourceKind.toLowerCase()}?`,
      category: 'capacity',
      priority: 50,
      context: ctx,
    });
  }

  // --- View-specific fallbacks ---
  const view = input.currentView ?? '';
  const ns = input.selectedNamespace;

  if (view.includes('workload') || view === '/') {
    prompts.push({
      text: ns ? `Show unhealthy workloads in ${ns}` : 'Which deployments have unhealthy replicas?',
      category: 'diagnosis',
      priority: 40,
    });
  }
  if (view.includes('compute') || view.includes('node')) {
    prompts.push({
      text: 'Are any nodes under memory or CPU pressure?',
      category: 'capacity',
      priority: 40,
    });
  }
  if (view.includes('storage')) {
    prompts.push({
      text: 'Which PVCs are close to capacity?',
      category: 'capacity',
      priority: 40,
    });
  }
  if (view.includes('security')) {
    prompts.push({
      text: 'Run a security scan of my cluster',
      category: 'security',
      priority: 40,
    });
  }
  if (view.includes('network')) {
    prompts.push({
      text: 'Which namespaces lack network policies?',
      category: 'security',
      priority: 40,
    });
  }

  // --- Generic always-available prompts ---
  prompts.push(
    {
      text: 'Check overall cluster health',
      category: 'general',
      priority: 20,
    },
    {
      text: 'Show recent changes across the cluster',
      category: 'change',
      priority: 15,
    },
    {
      text: ns ? `What is happening in namespace ${ns}?` : 'Show warning events',
      category: 'general',
      priority: 10,
    },
  );

  // Sort by priority (highest first) and deduplicate
  return prompts
    .sort((a, b) => b.priority - a.priority)
    .filter((p, i, arr) => arr.findIndex((q) => q.text === p.text) === i);
}
