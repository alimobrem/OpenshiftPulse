import { create } from 'zustand';

// These types will be imported from ../engine/discovery once that file is created
export interface ResourceType {
  group: string;
  version: string;
  kind: string;
  namespaced: boolean;
  verbs: string[];
  singularName: string;
  name: string; // plural name
  shortNames?: string[];
  categories?: string[];
}

export interface APIGroup {
  name: string;
  versions: string[];
  preferredVersion: string;
}

interface ClusterState {
  // Discovery
  resourceRegistry: Map<string, ResourceType> | null;
  apiGroups: APIGroup[];
  discoveryLoading: boolean;
  discoveryError: string | null;

  // Cluster info
  clusterVersion: string | null;
  kubernetesVersion: string | null;
  platform: string | null;

  // Actions
  runDiscovery: () => Promise<void>;
  setClusterInfo: (info: {
    version?: string;
    kubernetesVersion?: string;
    platform?: string;
  }) => void;
}

// Placeholder discovery functions that will be replaced when ../engine/discovery is created
async function discoverResources(): Promise<Map<string, ResourceType>> {
  // TODO: This will be imported from ../engine/discovery
  // For now, return empty map
  const response = await fetch('/api/kubernetes/apis');
  if (!response.ok) {
    throw new Error(`Discovery failed: ${response.statusText}`);
  }

  const data = await response.json();
  const registry = new Map<string, ResourceType>();

  // Basic discovery implementation - will be replaced by actual implementation
  // This is a simplified version just to get the store working
  if (data.groups) {
    for (const group of data.groups) {
      const groupName = group.name;
      const preferredVersion = group.preferredVersion?.version || group.versions?.[0]?.version;

      if (preferredVersion) {
        try {
          const groupResponse = await fetch(`/api/kubernetes/apis/${groupName}/${preferredVersion}`);
          if (groupResponse.ok) {
            const groupData = await groupResponse.json();
            if (groupData.resources) {
              for (const resource of groupData.resources) {
                if (!resource.name.includes('/')) {
                  // Skip subresources
                  const key = `${groupName}/${preferredVersion}/${resource.name}`;
                  registry.set(key, {
                    group: groupName,
                    version: preferredVersion,
                    kind: resource.kind,
                    namespaced: resource.namespaced,
                    verbs: resource.verbs || [],
                    singularName: resource.singularName,
                    name: resource.name,
                    shortNames: resource.shortNames,
                    categories: resource.categories,
                  });
                }
              }
            }
          }
        } catch (error) {
          console.warn(`Failed to discover resources for ${groupName}/${preferredVersion}:`, error);
        }
      }
    }
  }

  // Also discover core resources (v1)
  try {
    const coreResponse = await fetch('/api/kubernetes/api/v1');
    if (coreResponse.ok) {
      const coreData = await coreResponse.json();
      if (coreData.resources) {
        for (const resource of coreData.resources) {
          if (!resource.name.includes('/')) {
            const key = `v1/${resource.name}`;
            registry.set(key, {
              group: '',
              version: 'v1',
              kind: resource.kind,
              namespaced: resource.namespaced,
              verbs: resource.verbs || [],
              singularName: resource.singularName,
              name: resource.name,
              shortNames: resource.shortNames,
              categories: resource.categories,
            });
          }
        }
      }
    }
  } catch (error) {
    console.warn('Failed to discover core resources:', error);
  }

  return registry;
}

function groupResources(registry: Map<string, ResourceType>): APIGroup[] {
  // TODO: This will be imported from ../engine/discovery
  const groups = new Map<string, Set<string>>();

  for (const [, resource] of registry) {
    const groupName = resource.group || 'core';
    if (!groups.has(groupName)) {
      groups.set(groupName, new Set());
    }
    groups.get(groupName)!.add(resource.version);
  }

  const apiGroups: APIGroup[] = [];
  for (const [name, versions] of groups) {
    const versionArray = Array.from(versions).sort();
    apiGroups.push({
      name: name === 'core' ? '' : name,
      versions: versionArray,
      preferredVersion: versionArray[versionArray.length - 1], // Latest version
    });
  }

  return apiGroups.sort((a, b) => a.name.localeCompare(b.name));
}

export const useClusterStore = create<ClusterState>((set, get) => ({
  // Discovery
  resourceRegistry: null,
  apiGroups: [],
  discoveryLoading: false,
  discoveryError: null,

  // Cluster info
  clusterVersion: null,
  kubernetesVersion: null,
  platform: null,

  // Actions
  runDiscovery: async () => {
    set({ discoveryLoading: true, discoveryError: null });
    try {
      const registry = await discoverResources();
      const groups = groupResources(registry);
      set({
        resourceRegistry: registry,
        apiGroups: groups,
        discoveryLoading: false,
      });
    } catch (error) {
      set({
        discoveryError: error instanceof Error ? error.message : 'Discovery failed',
        discoveryLoading: false,
      });
    }
  },

  setClusterInfo: (info) => {
    set({
      clusterVersion: info.version ?? get().clusterVersion,
      kubernetesVersion: info.kubernetesVersion ?? get().kubernetesVersion,
      platform: info.platform ?? get().platform,
    });
  },
}));
