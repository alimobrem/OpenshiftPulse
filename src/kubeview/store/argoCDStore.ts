/**
 * ArgoCD Store — detects ArgoCD availability and maintains a resource lookup cache.
 * All ArgoCD features are gated behind `available === true`.
 */

import { create } from 'zustand';
import { k8sList } from '../engine/query';
import type { K8sResource } from '../engine/renderers';
import type { ArgoApplication, ArgoSyncInfo, ArgoSyncStatus, ArgoHealthStatus } from '../engine/types';

interface ArgoCDState {
  // Detection
  available: boolean;
  detecting: boolean;
  detectionError: string | null;
  namespace: string | null; // namespace where ArgoCD apps live (e.g., 'openshift-gitops')

  // Applications
  applications: ArgoApplication[];
  applicationsLoading: boolean;

  // Resource lookup cache: "Kind/namespace/name" -> ArgoSyncInfo
  resourceCache: Map<string, ArgoSyncInfo>;

  // Actions
  detect: () => Promise<void>;
  loadApplications: () => Promise<void>;
  lookupResource: (kind: string, namespace: string | undefined, name: string) => ArgoSyncInfo | undefined;
}

function buildResourceKey(kind: string, namespace: string | undefined, name: string): string {
  return `${kind}/${namespace || '_'}/${name}`;
}

function buildResourceCache(apps: ArgoApplication[]): Map<string, ArgoSyncInfo> {
  const cache = new Map<string, ArgoSyncInfo>();

  for (const app of apps) {
    const resources = app.status?.resources || [];
    const source = app.spec?.source || app.spec?.sources?.[0];

    for (const r of resources) {
      const key = buildResourceKey(r.kind, r.namespace, r.name);
      cache.set(key, {
        appName: app.metadata.name,
        appNamespace: app.metadata.namespace || '',
        syncStatus: r.status || 'Unknown',
        healthStatus: r.health?.status as ArgoHealthStatus | undefined,
        revision: app.status?.sync?.revision,
        repoURL: source?.repoURL,
        path: source?.path,
      });
    }
  }

  return cache;
}

export const useArgoCDStore = create<ArgoCDState>((set, get) => ({
  available: false,
  detecting: false,
  detectionError: null,
  namespace: null,
  applications: [],
  applicationsLoading: false,
  resourceCache: new Map(),

  detect: async () => {
    set({ detecting: true, detectionError: null });
    try {
      // Check if argoproj.io API group exists
      const res = await fetch('/api/kubernetes/apis/argoproj.io/v1alpha1');
      if (!res.ok) {
        set({ available: false, detecting: false });
        return;
      }

      // API group exists — try to find Applications
      // Check openshift-gitops first (OpenShift GitOps operator default), then argocd
      for (const ns of ['openshift-gitops', 'argocd']) {
        try {
          const apps = await k8sList<K8sResource>(
            `/apis/argoproj.io/v1alpha1/namespaces/${ns}/applications`
          );
          if (apps.length >= 0) {
            // Namespace is valid (even if 0 apps, the API responded)
            set({
              available: true,
              detecting: false,
              namespace: ns,
            });
            // Load applications fully
            get().loadApplications();
            return;
          }
        } catch {
          // Namespace doesn't exist or no access, try next
        }
      }

      // Try cluster-wide list as fallback
      try {
        const apps = await k8sList<K8sResource>(
          '/apis/argoproj.io/v1alpha1/applications'
        );
        if (apps.length > 0) {
          const firstNs = apps[0].metadata.namespace || 'openshift-gitops';
          set({
            available: true,
            detecting: false,
            namespace: firstNs,
          });
          get().loadApplications();
          return;
        }
      } catch {
        // No access to cluster-wide list
      }

      // API group exists but no apps found or accessible
      set({ available: true, detecting: false, namespace: null });
    } catch {
      set({
        available: false,
        detecting: false,
        detectionError: 'Failed to detect ArgoCD',
      });
    }
  },

  loadApplications: async () => {
    const { namespace } = get();
    set({ applicationsLoading: true });

    try {
      const path = namespace
        ? `/apis/argoproj.io/v1alpha1/namespaces/${namespace}/applications`
        : '/apis/argoproj.io/v1alpha1/applications';

      const apps = await k8sList<K8sResource>(path);
      const typed = apps as unknown as ArgoApplication[];

      set({
        applications: typed,
        applicationsLoading: false,
        resourceCache: buildResourceCache(typed),
      });
    } catch {
      set({ applicationsLoading: false });
    }
  },

  lookupResource: (kind, namespace, name) => {
    const key = buildResourceKey(kind, namespace, name);
    return get().resourceCache.get(key);
  },
}));
