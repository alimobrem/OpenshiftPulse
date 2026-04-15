import { useUIStore } from '../store/uiStore';

/**
 * Check for session expiry on any API response.
 * Triggers the session expired modal when a 401 is detected.
 */
export function checkAuth(response: Response): Response {
  if (response.status === 401) {
    useUIStore.getState().addDegradedReason('session_expired');
  }
  return response;
}

/**
 * Fetch wrapper that checks for 401 on agent API calls.
 * Use instead of raw fetch() for /api/agent/ endpoints.
 */
export async function agentFetch(url: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, init);
  checkAuth(res);
  return res;
}

/**
 * Safe query wrapper — returns null for 404 (resource doesn't exist),
 * throws for 500/network errors so React Query shows error banners.
 */
export async function safeQuery<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (e) {
    // 404 = resource legitimately doesn't exist
    if (e instanceof Response && e.status === 404) return null;
    // Check for fetch Response-like objects
    if (typeof e === 'object' && e !== null && 'status' in e) {
      const status = (e as { status: number }).status;
      if (status === 404) return null;
      if (status === 401) {
        useUIStore.getState().addDegradedReason('session_expired');
      }
    }
    throw e; // Let React Query handle the error
  }
}
