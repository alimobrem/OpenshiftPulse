import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useUIStore } from '../store/uiStore';
import { buildApiPath } from '../hooks/useResourceUrl';
import YamlEditor from '../components/yaml/YamlEditor';
import DiffPreview from '../components/yaml/DiffPreview';
import { ArrowLeft, Save, RotateCcw } from 'lucide-react';

interface YamlEditorViewProps {
  gvrKey: string;
  namespace?: string;
  name: string;
}

export default function YamlEditorView({ gvrKey, namespace, name }: YamlEditorViewProps) {
  const navigate = useNavigate();
  const addToast = useUIStore((s) => s.addToast);
  const queryClient = useQueryClient();

  const apiPath = `/api/kubernetes${buildApiPath(gvrKey, namespace, name)}`;

  const { data: resource, isLoading, error } = useQuery({
    queryKey: ['resource', gvrKey, namespace, name],
    queryFn: async () => {
      const res = await fetch(apiPath);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return res.json();
    },
  });

  const [originalYaml, setOriginalYaml] = useState('');
  const [currentYaml, setCurrentYaml] = useState('');
  const [saving, setSaving] = useState(false);
  const hasChanges = currentYaml !== originalYaml;

  useEffect(() => {
    if (resource) {
      // Remove managedFields for cleaner YAML
      const cleaned = { ...resource };
      if (cleaned.metadata) {
        delete cleaned.metadata.managedFields;
      }
      const yaml = jsonToYaml(cleaned);
      setOriginalYaml(yaml);
      setCurrentYaml(yaml);
    }
  }, [resource]);

  const handleSave = useCallback(async () => {
    if (!hasChanges || saving) return;
    setSaving(true);
    try {
      const res = await fetch(apiPath, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: currentYaml.startsWith('{') ? currentYaml : JSON.stringify(yamlToJson(currentYaml)),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`${res.status}: ${body}`);
      }
      const updated = await res.json();
      const cleaned = { ...updated };
      if (cleaned.metadata) delete cleaned.metadata.managedFields;
      const newYaml = jsonToYaml(cleaned);
      setOriginalYaml(newYaml);
      setCurrentYaml(newYaml);
      addToast({ type: 'success', title: `${name} updated successfully` });
      queryClient.invalidateQueries({ queryKey: ['resource', gvrKey, namespace, name] });
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Failed to save',
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSaving(false);
    }
  }, [apiPath, currentYaml, hasChanges, saving, name, gvrKey, namespace, addToast, queryClient]);

  const handleDiscard = useCallback(() => {
    setCurrentYaml(originalYaml);
  }, [originalYaml]);

  const gvrParts = gvrKey.split('/');
  const kind = gvrParts[gvrParts.length - 1];
  const backPath = namespace
    ? `/r/${gvrKey.replace(/\//g, '~')}/${namespace}/${name}`
    : `/r/${gvrKey.replace(/\//g, '~')}/_/${name}`;

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
        Failed to load resource: {error instanceof Error ? error.message : String(error)}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(backPath)}
            className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200"
          >
            <ArrowLeft size={16} />
          </button>
          <span className="text-sm text-slate-400">{kind}/</span>
          <span className="text-sm font-medium">{name}</span>
          {namespace && (
            <span className="text-xs px-2 py-0.5 bg-slate-700 rounded text-slate-300">
              {namespace}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <button
              onClick={handleDiscard}
              className="flex items-center gap-1 px-3 py-1.5 text-xs rounded bg-slate-700 hover:bg-slate-600 text-slate-300"
            >
              <RotateCcw size={12} />
              Discard
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className={cn(
              'flex items-center gap-1 px-3 py-1.5 text-xs rounded font-medium',
              hasChanges
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
            )}
          >
            <Save size={12} />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <YamlEditor
          value={currentYaml}
          onChange={setCurrentYaml}
          onSave={handleSave}
          height="100%"
        />
      </div>

      {/* Diff Preview */}
      {hasChanges && (
        <DiffPreview
          original={originalYaml}
          modified={currentYaml}
          onApply={handleSave}
          onDiscard={handleDiscard}
          loading={saving}
        />
      )}
    </div>
  );
}

// Simple JSON-to-YAML converter (handles common K8s structures)
function jsonToYaml(obj: unknown, indent = 0): string {
  const pad = '  '.repeat(indent);
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj === 'string') {
    if (obj.includes('\n') || obj.includes(':') || obj.includes('#') || obj.includes('"') || obj === '') {
      return JSON.stringify(obj);
    }
    return obj;
  }
  if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    return obj
      .map((item) => {
        const val = jsonToYaml(item, indent + 1);
        if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
          const lines = val.split('\n');
          return `${pad}- ${lines[0].trimStart()}\n${lines.slice(1).map((l) => `${pad}  ${l.trimStart() ? l : ''}`).join('\n')}`.trimEnd();
        }
        return `${pad}- ${val}`;
      })
      .join('\n');
  }
  if (typeof obj === 'object') {
    const entries = Object.entries(obj as Record<string, unknown>);
    if (entries.length === 0) return '{}';
    return entries
      .map(([key, val]) => {
        if (val === null || val === undefined) return `${pad}${key}: null`;
        if (typeof val === 'object' && !Array.isArray(val) && Object.keys(val as object).length > 0) {
          return `${pad}${key}:\n${jsonToYaml(val, indent + 1)}`;
        }
        if (Array.isArray(val) && val.length > 0) {
          return `${pad}${key}:\n${jsonToYaml(val, indent + 1)}`;
        }
        return `${pad}${key}: ${jsonToYaml(val, indent)}`;
      })
      .join('\n');
  }
  return String(obj);
}

// Simple YAML-to-JSON parser (handles common K8s YAML)
function yamlToJson(yaml: string): unknown {
  // For now, if the YAML is actually JSON, parse directly
  const trimmed = yaml.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return JSON.parse(trimmed);
  }
  // Very basic YAML parser - handles key: value, indentation, arrays
  // For production, we'd use a proper YAML library
  // This is a best-effort parser for simple K8s resources
  const lines = yaml.split('\n');
  return parseYamlLines(lines, 0, 0).value;
}

function parseYamlLines(lines: string[], startIdx: number, baseIndent: number): { value: unknown; nextIdx: number } {
  const result: Record<string, unknown> = {};
  let i = startIdx;

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '' || line.trim().startsWith('#')) { i++; continue; }

    const indent = line.search(/\S/);
    if (indent < baseIndent) break;
    if (indent > baseIndent && i > startIdx) break;

    const trimmed = line.trim();

    // Array item
    if (trimmed.startsWith('- ')) {
      const arr: unknown[] = [];
      while (i < lines.length) {
        const aLine = lines[i];
        if (aLine.trim() === '' || aLine.trim().startsWith('#')) { i++; continue; }
        const aIndent = aLine.search(/\S/);
        if (aIndent < baseIndent) break;
        if (!aLine.trim().startsWith('- ') && aIndent === baseIndent) break;
        if (aLine.trim().startsWith('- ')) {
          const val = aLine.trim().slice(2).trim();
          if (val.includes(':')) {
            // Object in array
            const objLines = [' '.repeat(baseIndent + 2) + val];
            let j = i + 1;
            while (j < lines.length) {
              const nLine = lines[j];
              if (nLine.trim() === '') { j++; continue; }
              const nIndent = nLine.search(/\S/);
              if (nIndent <= baseIndent) break;
              if (nLine.trim().startsWith('- ') && nIndent === baseIndent) break;
              objLines.push(nLine);
              j++;
            }
            const { value } = parseYamlLines(objLines, 0, baseIndent + 2);
            arr.push(value);
            i = j;
          } else {
            arr.push(parseYamlValue(val));
            i++;
          }
        } else {
          i++;
        }
      }
      return { value: arr, nextIdx: i };
    }

    // Key: value
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) { i++; continue; }

    const key = trimmed.slice(0, colonIdx).trim();
    const rawVal = trimmed.slice(colonIdx + 1).trim();

    if (rawVal === '' || rawVal === '|' || rawVal === '>') {
      // Nested object or block scalar
      const nextLine = i + 1 < lines.length ? lines[i + 1] : '';
      const nextIndent = nextLine.search(/\S/);
      if (nextIndent > indent && nextLine.trim().startsWith('- ')) {
        const { value, nextIdx } = parseYamlLines(lines, i + 1, nextIndent);
        result[key] = value;
        i = nextIdx;
      } else if (nextIndent > indent) {
        const { value, nextIdx } = parseYamlLines(lines, i + 1, nextIndent);
        result[key] = value;
        i = nextIdx;
      } else {
        result[key] = null;
        i++;
      }
    } else {
      result[key] = parseYamlValue(rawVal);
      i++;
    }
  }

  return { value: result, nextIdx: i };
}

function parseYamlValue(val: string): unknown {
  if (val === 'null' || val === '~') return null;
  if (val === 'true') return true;
  if (val === 'false') return false;
  if (val.startsWith('"') && val.endsWith('"')) return val.slice(1, -1);
  if (val.startsWith("'") && val.endsWith("'")) return val.slice(1, -1);
  if (val === '[]') return [];
  if (val === '{}') return {};
  const num = Number(val);
  if (!isNaN(num) && val !== '') return num;
  return val;
}
