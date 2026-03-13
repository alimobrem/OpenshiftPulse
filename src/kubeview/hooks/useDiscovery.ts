import { useEffect } from 'react';
import { useClusterStore } from '../store/clusterStore';

export function useDiscovery() {
  const { resourceRegistry, apiGroups, discoveryLoading, discoveryError, runDiscovery } =
    useClusterStore();

  useEffect(() => {
    if (!resourceRegistry) {
      runDiscovery();
    }
  }, [resourceRegistry, runDiscovery]);

  return {
    resourceRegistry,
    apiGroups,
    isLoading: discoveryLoading,
    error: discoveryError,
    refresh: runDiscovery,
  };
}
