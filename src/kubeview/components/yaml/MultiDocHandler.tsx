import React, { useMemo } from 'react';
import { FileText, Loader2, Check, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MultiDocHandlerProps {
  yaml: string;
  onCreateAll: (resources: ParsedDocument[]) => void;
  onCreateOne: (resource: ParsedDocument) => void;
  onClose: () => void;
}

export interface ParsedDocument {
  raw: string;
  parsed: Record<string, unknown>;
  kind: string;
  name: string;
  namespace?: string;
}

/**
 * Parse multi-document YAML into separate resources
 * Uses regex-based parsing since we don't have a full YAML parser
 */
function parseMultiDocYaml(yaml: string): ParsedDocument[] {
  // Split by YAML document separator
  const documents = yaml.split(/^---$/m).filter(doc => doc.trim());

  const parsed: ParsedDocument[] = [];

  for (const doc of documents) {
    const trimmed = doc.trim();
    if (!trimmed) continue;

    // Extract kind using regex
    const kindMatch = trimmed.match(/^kind:\s*(.+)$/m);
    if (!kindMatch) continue;

    const kind = kindMatch[1].trim();

    // Extract apiVersion
    const apiVersionMatch = trimmed.match(/^apiVersion:\s*(.+)$/m);
    const apiVersion = apiVersionMatch?.[1].trim();

    // Extract metadata.name
    const nameMatch = trimmed.match(/^metadata:\s*\n\s+name:\s*(.+)$/m);
    const name = nameMatch?.[1].trim() || 'unknown';

    // Extract metadata.namespace
    const namespaceMatch = trimmed.match(/^metadata:\s*\n(?:.*\n)*?\s+namespace:\s*(.+)$/m);
    const namespace = namespaceMatch?.[1].trim();

    // Create a pseudo-parsed object (we don't have a real YAML parser)
    const pseudoParsed: Record<string, unknown> = {
      apiVersion,
      kind,
      metadata: {
        name,
        ...(namespace ? { namespace } : {}),
      },
    };

    parsed.push({
      raw: trimmed,
      parsed: pseudoParsed,
      kind,
      name,
      namespace,
    });
  }

  return parsed;
}

export default function MultiDocHandler({
  yaml,
  onCreateAll,
  onCreateOne,
  onClose,
}: MultiDocHandlerProps) {
  const resources = useMemo(() => parseMultiDocYaml(yaml), [yaml]);

  if (resources.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-slate-800 rounded-lg shadow-xl max-w-md w-full mx-4 border border-slate-700">
          <div className="p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">No Resources Detected</h3>
                <p className="text-sm text-slate-400">
                  Could not find any valid Kubernetes resources in the provided YAML.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-white bg-slate-700 hover:bg-slate-600 rounded transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 border border-slate-700 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white">
            {resources.length} Resource{resources.length !== 1 ? 's' : ''} Detected
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            Choose how to create these resources
          </p>
        </div>

        {/* Resource List */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-2">
            {resources.map((resource, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 bg-slate-900/50 rounded border border-slate-700"
              >
                <FileText className="w-5 h-5 text-slate-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-white">
                      {resource.kind}
                    </span>
                    <span className="text-slate-500">/</span>
                    <span className="font-mono text-sm text-emerald-400 truncate">
                      {resource.name}
                    </span>
                  </div>
                  {resource.namespace && (
                    <div className="text-xs text-slate-500 mt-0.5">
                      Namespace: {resource.namespace}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => onCreateOne(resource)}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-slate-700 hover:bg-slate-600 rounded transition-colors"
                >
                  Create
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onCreateAll(resources)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded transition-colors"
          >
            <Check className="w-4 h-4" />
            Create All ({resources.length})
          </button>
        </div>
      </div>
    </div>
  );
}
