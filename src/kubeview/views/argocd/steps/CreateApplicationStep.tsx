import React, { useState, useMemo } from 'react';
import { Loader2, Code2, FileCode, ToggleLeft, ToggleRight } from 'lucide-react';
import { useGitOpsConfig } from '../../../hooks/useGitOpsConfig';
import { useArgoCDStore } from '../../../store/argoCDStore';
import { useGitOpsSetupStore } from '../../../store/gitopsSetupStore';
import { k8sCreate } from '../../../engine/query';
import { showErrorToast } from '../../../engine/errorToast';
import { cn } from '@/lib/utils';

interface Props {
  onComplete: () => void;
}

const NAME_REGEX = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

function buildApplicationYAML(opts: {
  name: string;
  namespace: string;
  repoURL: string;
  path: string;
  targetRevision: string;
  destNamespace: string;
  autoSync: boolean;
  createNamespace: boolean;
}): object {
  const spec: Record<string, unknown> = {
    project: 'default',
    source: {
      repoURL: opts.repoURL,
      path: opts.path,
      targetRevision: opts.targetRevision,
    },
    destination: {
      server: 'https://kubernetes.default.svc',
      namespace: opts.destNamespace,
    },
  };

  if (opts.autoSync) {
    spec.syncPolicy = {
      automated: {
        prune: true,
        selfHeal: true,
      },
      syncOptions: opts.createNamespace ? ['CreateNamespace=true'] : [],
    };
  } else if (opts.createNamespace) {
    spec.syncPolicy = {
      syncOptions: ['CreateNamespace=true'],
    };
  }

  return {
    apiVersion: 'argoproj.io/v1alpha1',
    kind: 'Application',
    metadata: {
      name: opts.name,
      namespace: opts.namespace,
    },
    spec,
  };
}

function toYAMLString(obj: unknown, indent = 0): string {
  const pad = '  '.repeat(indent);
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj === 'string') return obj.includes(':') || obj.includes('#') ? `"${obj}"` : obj;
  if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    return obj.map((item) => {
      if (typeof item === 'string') return `${pad}- ${toYAMLString(item)}`;
      const inner = toYAMLString(item, indent + 1);
      return `${pad}- ${inner.trimStart()}`;
    }).join('\n');
  }
  if (typeof obj === 'object') {
    const entries = Object.entries(obj as Record<string, unknown>);
    if (entries.length === 0) return '{}';
    return entries
      .map(([key, val]) => {
        if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
          return `${pad}${key}:\n${toYAMLString(val, indent + 1)}`;
        }
        if (Array.isArray(val)) {
          return `${pad}${key}:\n${toYAMLString(val, indent + 1)}`;
        }
        return `${pad}${key}: ${toYAMLString(val)}`;
      })
      .join('\n');
  }
  return String(obj);
}

export function CreateApplicationStep({ onComplete }: Props) {
  const { config } = useGitOpsConfig();
  const argoNamespace = useArgoCDStore((s) => s.namespace) || 'openshift-gitops';
  const markComplete = useGitOpsSetupStore((s) => s.markStepComplete);

  const [name, setName] = useState('my-app');
  const [repoURL, setRepoURL] = useState(config?.repoUrl || '');
  const [path, setPath] = useState('manifests');
  const [targetRevision, setTargetRevision] = useState('HEAD');
  const [destNamespace, setDestNamespace] = useState('default');
  const [autoSync, setAutoSync] = useState(true);
  const [createNamespace, setCreateNamespace] = useState(true);
  const [showYAML, setShowYAML] = useState(false);
  const [creating, setCreating] = useState(false);

  // Pre-fill repo URL when config loads
  React.useEffect(() => {
    if (config?.repoUrl && !repoURL) {
      setRepoURL(config.repoUrl);
    }
  }, [config]);

  const nameValid = NAME_REGEX.test(name);
  const formValid = nameValid && repoURL.length > 0 && path.length > 0 && targetRevision.length > 0 && destNamespace.length > 0;

  const applicationObj = useMemo(
    () =>
      buildApplicationYAML({
        name,
        namespace: argoNamespace,
        repoURL,
        path,
        targetRevision,
        destNamespace,
        autoSync,
        createNamespace,
      }),
    [name, argoNamespace, repoURL, path, targetRevision, destNamespace, autoSync, createNamespace],
  );

  const yamlPreview = useMemo(() => toYAMLString(applicationObj), [applicationObj]);

  const handleCreate = async () => {
    if (!formValid) return;
    setCreating(true);
    try {
      await k8sCreate(
        `/apis/argoproj.io/v1alpha1/namespaces/${argoNamespace}/applications`,
        applicationObj,
      );
      // Reload applications in the ArgoCD store
      await useArgoCDStore.getState().loadApplications();
      markComplete('first-app');
      onComplete();
    } catch (err) {
      showErrorToast(err, 'Failed to create application');
    }
    setCreating(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-slate-100">Create ArgoCD Application</h3>
        <p className="text-sm text-slate-400 mt-1">
          Define an Application that ArgoCD will sync from your Git repository to the cluster.
        </p>
      </div>

      <div className="space-y-4">
        {/* Application Name */}
        <div>
          <label className="text-xs text-slate-400 block mb-1">Application Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.toLowerCase())}
            placeholder="my-app"
            className={cn(
              'w-full px-3 py-2 text-sm bg-slate-800 border rounded text-slate-200 placeholder-slate-600 focus:border-violet-500 outline-none',
              name && !nameValid ? 'border-red-500' : 'border-slate-700',
            )}
          />
          {name && !nameValid && (
            <p className="text-xs text-red-400 mt-1">Must be lowercase alphanumeric with hyphens only</p>
          )}
        </div>

        {/* Git Repository URL */}
        <div>
          <label className="text-xs text-slate-400 block mb-1">Git Repository URL</label>
          <input
            type="text"
            value={repoURL}
            onChange={(e) => setRepoURL(e.target.value)}
            placeholder="https://github.com/org/repo"
            className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded text-slate-200 placeholder-slate-600 focus:border-violet-500 outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Path */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">Path</label>
            <input
              type="text"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="manifests"
              className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded text-slate-200 placeholder-slate-600 focus:border-violet-500 outline-none"
            />
          </div>
          {/* Target Revision */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">Target Revision</label>
            <input
              type="text"
              value={targetRevision}
              onChange={(e) => setTargetRevision(e.target.value)}
              placeholder="HEAD"
              className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded text-slate-200 placeholder-slate-600 focus:border-violet-500 outline-none"
            />
          </div>
        </div>

        {/* Destination Namespace */}
        <div>
          <label className="text-xs text-slate-400 block mb-1">Destination Namespace</label>
          <input
            type="text"
            value={destNamespace}
            onChange={(e) => setDestNamespace(e.target.value)}
            placeholder="default"
            className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded text-slate-200 placeholder-slate-600 focus:border-violet-500 outline-none"
          />
        </div>

        {/* Sync Policy */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-200">Auto Sync</p>
            <p className="text-xs text-slate-500">Automatically prune and self-heal resources</p>
          </div>
          <button onClick={() => setAutoSync(!autoSync)} className="text-slate-300 hover:text-slate-100">
            {autoSync ? (
              <ToggleRight className="w-8 h-8 text-violet-400" />
            ) : (
              <ToggleLeft className="w-8 h-8 text-slate-500" />
            )}
          </button>
        </div>

        {/* Create Namespace */}
        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={createNamespace}
            onChange={(e) => setCreateNamespace(e.target.checked)}
            className="rounded border-slate-600 bg-slate-800 text-violet-600 focus:ring-violet-500"
          />
          Create namespace if it doesn't exist
        </label>
      </div>

      {/* YAML Preview Toggle */}
      <div className="border border-slate-700 rounded-lg overflow-hidden">
        <button
          onClick={() => setShowYAML(!showYAML)}
          className="w-full flex items-center justify-between p-3 text-sm text-slate-300 hover:bg-slate-800/50 transition-colors"
        >
          <span className="flex items-center gap-2">
            <FileCode className="w-4 h-4" />
            Preview YAML
          </span>
          <Code2 className={cn('w-4 h-4 transition-transform', showYAML && 'text-violet-400')} />
        </button>
        {showYAML && (
          <div className="border-t border-slate-700 bg-slate-950 p-4">
            <pre className="text-xs text-slate-300 font-mono whitespace-pre overflow-x-auto leading-relaxed">
              {yamlPreview}
            </pre>
          </div>
        )}
      </div>

      <button
        onClick={handleCreate}
        disabled={creating || !formValid}
        className="px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
      >
        {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        Create Application
      </button>
    </div>
  );
}
