import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import LogStream from '../components/logs/LogStream';
import MultiContainerLogs from '../components/logs/MultiContainerLogs';

interface LogsViewProps {
  namespace: string;
  podName: string;
}

interface ContainerInfo {
  name: string;
  type: 'container' | 'init' | 'ephemeral';
  state: 'running' | 'waiting' | 'terminated';
}

export default function LogsView({ namespace, podName }: LogsViewProps) {
  const { data: pod, isLoading, error } = useQuery({
    queryKey: ['pod', namespace, podName],
    queryFn: async () => {
      const res = await fetch(`/api/kubernetes/api/v1/namespaces/${namespace}/pods/${podName}`);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return res.json();
    },
  });

  const containers: ContainerInfo[] = [];

  if (pod) {
    // Regular containers
    const specs = (pod.spec?.containers || []) as Array<{ name: string }>;
    const statuses = (pod.status?.containerStatuses || []) as Array<{
      name: string;
      state?: { running?: unknown; waiting?: unknown; terminated?: unknown };
    }>;

    for (const spec of specs) {
      const status = statuses.find((s) => s.name === spec.name);
      let state: 'running' | 'waiting' | 'terminated' = 'waiting';
      if (status?.state?.running) state = 'running';
      else if (status?.state?.terminated) state = 'terminated';
      containers.push({ name: spec.name, type: 'container', state });
    }

    // Init containers
    const initSpecs = (pod.spec?.initContainers || []) as Array<{ name: string }>;
    const initStatuses = (pod.status?.initContainerStatuses || []) as Array<{
      name: string;
      state?: { running?: unknown; waiting?: unknown; terminated?: unknown };
    }>;

    for (const spec of initSpecs) {
      const status = initStatuses.find((s) => s.name === spec.name);
      let state: 'running' | 'waiting' | 'terminated' = 'waiting';
      if (status?.state?.running) state = 'running';
      else if (status?.state?.terminated) state = 'terminated';
      containers.push({ name: spec.name, type: 'init', state });
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="kv-skeleton w-12 h-12 rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-400">
        Failed to load pod: {error instanceof Error ? error.message : String(error)}
      </div>
    );
  }

  if (containers.length <= 1) {
    return (
      <div className="h-full flex flex-col">
        <div className="px-4 py-2 border-b border-slate-700 flex items-center gap-2">
          <span className="text-sm text-slate-400">Logs</span>
          <span className="text-sm font-medium">{podName}</span>
          <span className="text-xs px-2 py-0.5 bg-slate-700 rounded text-slate-300">{namespace}</span>
        </div>
        <div className="flex-1 overflow-hidden">
          <LogStream
            namespace={namespace}
            podName={podName}
            containerName={containers[0]?.name}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full">
      <MultiContainerLogs
        namespace={namespace}
        podName={podName}
        containers={containers}
      />
    </div>
  );
}
