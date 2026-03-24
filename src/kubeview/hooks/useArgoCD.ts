/**
 * useArgoCD — hook for accessing ArgoCD state in components.
 * Triggers detection on first use. All ArgoCD features gate on `available`.
 */

import { useEffect } from 'react';
import { useArgoCDStore } from '../store/argoCDStore';
import type { ArgoSyncInfo, ArgoApplication } from '../engine/types';

/** Check if ArgoCD is available and get applications */
export function useArgoCD() {
  const available = useArgoCDStore((s) => s.available);
  const detecting = useArgoCDStore((s) => s.detecting);
  const applications = useArgoCDStore((s) => s.applications);
  const applicationsLoading = useArgoCDStore((s) => s.applicationsLoading);
  const namespace = useArgoCDStore((s) => s.namespace);
  const detect = useArgoCDStore((s) => s.detect);

  // Trigger detection once
  useEffect(() => {
    if (!available && !detecting) {
      detect();
    }
  }, [available, detecting, detect]);

  return { available, detecting, applications, applicationsLoading, namespace };
}

/** Lookup sync info for a specific resource */
export function useArgoSyncInfo(kind: string, namespace: string | undefined, name: string): ArgoSyncInfo | undefined {
  const available = useArgoCDStore((s) => s.available);
  const lookupResource = useArgoCDStore((s) => s.lookupResource);

  if (!available) return undefined;
  return lookupResource(kind, namespace, name);
}

/** Get all out-of-sync resources */
export function useArgoDrift(): ArgoApplication[] {
  const applications = useArgoCDStore((s) => s.applications);
  return applications.filter(
    (app) => app.status?.sync?.status === 'OutOfSync'
  );
}

/** Refresh ArgoCD data (re-fetch applications and rebuild cache) */
export function useArgoCDRefresh() {
  const loadApplications = useArgoCDStore((s) => s.loadApplications);
  return loadApplications;
}
