import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ArrowLeft, Plus } from 'lucide-react';
import { useUIStore } from '../store/uiStore';
import { useClusterStore } from '../store/clusterStore';
import { buildApiPath } from '../hooks/useResourceUrl';
import YamlEditor from '../components/yaml/YamlEditor';
import { getSnippetSuggestions, resolveSnippet } from '../components/yaml/SnippetEngine';

interface CreateViewProps {
  gvrKey: string;
}

export default function CreateView({ gvrKey }: CreateViewProps) {
  const navigate = useNavigate();
  const addToast = useUIStore((s) => s.addToast);
  const selectedNamespace = useUIStore((s) => s.selectedNamespace);
  const registry = useClusterStore((s) => s.resourceRegistry);

  const gvrParts = gvrKey.split('/');
  const resourcePlural = gvrParts[gvrParts.length - 1];
  const resourceType = registry?.get(gvrKey);
  const kind = resourceType?.kind || resourcePlural.slice(0, -1).charAt(0).toUpperCase() + resourcePlural.slice(0, -1).slice(1);

  // Get a starter snippet for this resource type
  const initialYaml = useMemo(() => {
    const shortName = resourcePlural.replace(/s$/, '').toLowerCase();
    const snippets = getSnippetSuggestions(shortName);
    if (snippets.length > 0) {
      return resolveSnippet(snippets[0]);
    }
    // Generic starter
    const group = gvrParts.length === 3 ? gvrParts[0] : '';
    const version = gvrParts.length === 3 ? gvrParts[1] : gvrParts[0];
    const apiVersion = group ? `${group}/${version}` : version;
    return [
      `apiVersion: ${apiVersion}`,
      `kind: ${kind}`,
      'metadata:',
      `  name: my-${shortName}`,
      resourceType?.namespaced ? `  namespace: ${selectedNamespace !== '*' && selectedNamespace !== 'all' ? selectedNamespace : 'default'}` : null,
      'spec: {}',
    ].filter(Boolean).join('\n');
  }, [gvrKey, kind, selectedNamespace, resourceType]);

  const [yaml, setYaml] = useState(initialYaml);
  const [creating, setCreating] = useState(false);
  const [mode, setMode] = useState<'form' | 'yaml'>('yaml');

  const handleCreate = useCallback(async () => {
    if (creating) return;
    setCreating(true);
    try {
      // Determine namespace from YAML content
      const nsMatch = yaml.match(/namespace:\s*(\S+)/);
      const ns = nsMatch?.[1] || (resourceType?.namespaced ? (selectedNamespace !== '*' ? selectedNamespace : 'default') : undefined);
      const apiPath = buildApiPath(gvrKey, ns);

      const res = await fetch(`/api/kubernetes${apiPath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/yaml' },
        body: yaml,
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`${res.status}: ${body}`);
      }

      const created = await res.json();
      const createdName = created.metadata?.name || 'resource';
      const createdNs = created.metadata?.namespace;

      addToast({ type: 'success', title: `${kind} ${createdName} created` });

      // Navigate to the new resource
      const gvrUrl = gvrKey.replace(/\//g, '~');
      const detailPath = createdNs
        ? `/r/${gvrUrl}/${createdNs}/${createdName}`
        : `/r/${gvrUrl}/_/${createdName}`;
      navigate(detailPath);
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Failed to create resource',
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setCreating(false);
    }
  }, [yaml, gvrKey, kind, creating, selectedNamespace, resourceType, addToast, navigate]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200"
          >
            <ArrowLeft size={16} />
          </button>
          <span className="text-sm font-medium">Create {kind}</span>
          {resourceType && (
            <span className="text-xs text-slate-500">
              {resourceType.group ? `${resourceType.group}/${resourceType.version}` : resourceType.version}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-800 rounded text-xs">
            <button
              onClick={() => setMode('yaml')}
              className={cn(
                'px-3 py-1.5 rounded',
                mode === 'yaml' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              )}
            >
              YAML
            </button>
          </div>
          <button
            onClick={handleCreate}
            disabled={creating || !yaml.trim()}
            className={cn(
              'flex items-center gap-1 px-4 py-1.5 text-xs rounded font-medium',
              creating || !yaml.trim()
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            )}
          >
            <Plus size={12} />
            {creating ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <YamlEditor
          value={yaml}
          onChange={setYaml}
          onSave={handleCreate}
          height="100%"
        />
      </div>
    </div>
  );
}
