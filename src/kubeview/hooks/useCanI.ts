/**
 * useCanI — RBAC permission check hook.
 *
 * Uses the SelfSubjectAccessReview API to check if the current user
 * can perform a specific action on a resource. Caches results for 5 minutes.
 */

import { useQuery } from '@tanstack/react-query';
import { K8S_BASE as BASE } from '../engine/gvr';

interface AccessReviewSpec {
  verb: string;       // "get", "list", "create", "update", "delete", "patch"
  group: string;      // "" for core, "apps" etc
  resource: string;   // "pods", "deployments" etc
  namespace?: string; // optional — omit for cluster-scoped check
}

async function checkAccess(spec: AccessReviewSpec): Promise<boolean> {
  try {
    const body = {
      apiVersion: 'authorization.k8s.io/v1',
      kind: 'SelfSubjectAccessReview',
      spec: {
        resourceAttributes: {
          verb: spec.verb,
          group: spec.group,
          resource: spec.resource,
          ...(spec.namespace ? { namespace: spec.namespace } : {}),
        },
      },
    };

    const res = await fetch(`${BASE}/apis/authorization.k8s.io/v1/selfsubjectaccessreviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) return true; // Fail open — don't hide features if check fails
    const data = await res.json();
    return data.status?.allowed === true;
  } catch {
    return true; // Fail open
  }
}

/**
 * Check if the current user can perform an action.
 * Returns { allowed, isLoading }.
 * Fails open (returns allowed=true) if the API call fails.
 */
export function useCanI(verb: string, group: string, resource: string, namespace?: string) {
  const { data: allowed = true, isLoading } = useQuery({
    queryKey: ['rbac', 'can-i', verb, group, resource, namespace],
    queryFn: () => checkAccess({ verb, group, resource, namespace }),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000,
  });

  return { allowed, isLoading };
}

/**
 * Check multiple permissions at once.
 * Returns a map of "verb:group:resource" => boolean.
 */
export function useCanIBatch(checks: Array<{ verb: string; group: string; resource: string; namespace?: string }>) {
  const results = checks.map((check) => {
    const key = `${check.verb}:${check.group}:${check.resource}`;
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { allowed } = useCanI(check.verb, check.group, check.resource, check.namespace);
    return [key, allowed] as const;
  });

  return Object.fromEntries(results);
}

/**
 * Common permission checks
 */
export function useCanDelete(group: string, resource: string, namespace?: string) {
  return useCanI('delete', group, resource, namespace);
}

export function useCanCreate(group: string, resource: string, namespace?: string) {
  return useCanI('create', group, resource, namespace);
}

export function useCanUpdate(group: string, resource: string, namespace?: string) {
  return useCanI('update', group, resource, namespace);
}
