import React, { useState, useEffect } from 'react';
import { FileText, AlertCircle, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SchemaPanelProps {
  gvk: { group: string; version: string; kind: string };
  currentPath?: string;  // YAML path where cursor is, e.g., "spec.replicas"
  onNavigate?: (path: string) => void;
}

interface FieldSchema {
  name: string;
  path: string;
  type: string;
  required?: boolean;
  description?: string;
  default?: string;
  enum?: string[];
  minimum?: number;
  maximum?: number;
  children?: FieldSchema[];
}

// Mock schema data - in a real implementation, this would fetch from K8s API server
function getMockSchema(gvk: { group: string; version: string; kind: string }): FieldSchema {
  if (gvk.kind === 'Deployment') {
    return {
      name: 'Deployment',
      path: '',
      type: 'object',
      children: [
        {
          name: 'apiVersion',
          path: 'apiVersion',
          type: 'string',
          required: true,
          description: 'APIVersion defines the versioned schema of this representation of an object.',
        },
        {
          name: 'kind',
          path: 'kind',
          type: 'string',
          required: true,
          description: 'Kind is a string value representing the REST resource this object represents.',
        },
        {
          name: 'metadata',
          path: 'metadata',
          type: 'ObjectMeta',
          required: true,
          description: 'Standard object metadata.',
          children: [
            {
              name: 'name',
              path: 'metadata.name',
              type: 'string',
              required: true,
              description: 'Name must be unique within a namespace.',
            },
            {
              name: 'namespace',
              path: 'metadata.namespace',
              type: 'string',
              description: 'Namespace defines the space within which each name must be unique.',
            },
          ],
        },
        {
          name: 'spec',
          path: 'spec',
          type: 'DeploymentSpec',
          required: true,
          description: 'Specification of the desired behavior of the Deployment.',
          children: [
            {
              name: 'replicas',
              path: 'spec.replicas',
              type: 'integer',
              description: 'Number of desired pods. Defaults to 1.',
              default: '1',
              minimum: 0,
            },
            {
              name: 'selector',
              path: 'spec.selector',
              type: 'LabelSelector',
              required: true,
              description: 'Label selector for pods. Must match template labels.',
            },
            {
              name: 'template',
              path: 'spec.template',
              type: 'PodTemplateSpec',
              required: true,
              description: 'Template describes the pods that will be created.',
            },
          ],
        },
      ],
    };
  }

  return {
    name: gvk.kind,
    path: '',
    type: 'object',
    description: `Schema for ${gvk.kind} ${gvk.version}`,
    children: [],
  };
}

function FieldTree({
  field,
  currentPath,
  onNavigate,
  level = 0,
}: {
  field: FieldSchema;
  currentPath?: string;
  onNavigate?: (path: string) => void;
  level?: number;
}) {
  const [isExpanded, setIsExpanded] = useState(level < 2);
  const hasChildren = field.children && field.children.length > 0;
  const isActive = currentPath === field.path;

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-slate-700/50 transition-colors rounded',
          isActive && 'bg-slate-700 text-white'
        )}
        style={{ paddingLeft: `${level * 12 + 12}px` }}
        onClick={() => {
          if (hasChildren) {
            setIsExpanded(!isExpanded);
          }
          if (onNavigate && field.path) {
            onNavigate(field.path);
          }
        }}
      >
        {hasChildren ? (
          isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
          )
        ) : (
          <span className="w-3.5" />
        )}
        <span className={cn('font-mono', isActive ? 'text-white' : 'text-slate-300')}>
          {field.name}
        </span>
        <span className="text-xs text-slate-500 ml-auto">{field.type}</span>
        {field.required && (
          <span className="text-[10px] text-red-400 font-semibold">*</span>
        )}
      </div>

      {hasChildren && isExpanded && (
        <div>
          {field.children?.map((child) => (
            <FieldTree
              key={child.path}
              field={child}
              currentPath={currentPath}
              onNavigate={onNavigate}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function SchemaPanel({ gvk, currentPath, onNavigate }: SchemaPanelProps) {
  const [schema, setSchema] = useState<FieldSchema | null>(null);
  const [selectedField, setSelectedField] = useState<FieldSchema | null>(null);

  useEffect(() => {
    // In a real implementation, fetch schema from K8s API server
    // For now, use mock data
    const mockSchema = getMockSchema(gvk);
    setSchema(mockSchema);
  }, [gvk]);

  useEffect(() => {
    if (!currentPath || !schema) {
      setSelectedField(null);
      return;
    }

    // Find the field matching currentPath
    function findField(field: FieldSchema, path: string): FieldSchema | null {
      if (field.path === path) return field;
      if (field.children) {
        for (const child of field.children) {
          const found = findField(child, path);
          if (found) return found;
        }
      }
      return null;
    }

    setSelectedField(findField(schema, currentPath));
  }, [currentPath, schema]);

  if (!schema) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500 text-sm">
        Loading schema...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-800 border-l border-slate-700">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700">
        <h3 className="text-sm font-semibold text-white">Schema</h3>
        <p className="text-xs text-slate-400 mt-0.5">
          {gvk.kind} {gvk.version}
        </p>
      </div>

      {/* Field Tree */}
      <div className="flex-1 overflow-y-auto py-2">
        {schema.children?.map((field) => (
          <FieldTree
            key={field.path}
            field={field}
            currentPath={currentPath}
            onNavigate={onNavigate}
          />
        ))}
      </div>

      {/* Field Documentation */}
      {selectedField ? (
        <div className="border-t border-slate-700 p-4 bg-slate-900/50">
          <div className="flex items-start gap-2 mb-2">
            <FileText className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-sm text-white truncate">
                  {selectedField.name}
                </span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">
                  {selectedField.type}
                </span>
                {selectedField.required && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-red-900/30 text-red-400">
                    Required
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                {selectedField.description || 'No description available'}
              </p>

              {selectedField.default && (
                <div className="mt-2 text-xs">
                  <span className="text-slate-500">Default: </span>
                  <code className="text-emerald-400">{selectedField.default}</code>
                </div>
              )}

              {selectedField.enum && (
                <div className="mt-2">
                  <span className="text-xs text-slate-500 block mb-1">Allowed values:</span>
                  <div className="flex flex-wrap gap-1">
                    {selectedField.enum.map((val) => (
                      <code
                        key={val}
                        className="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-300"
                      >
                        {val}
                      </code>
                    ))}
                  </div>
                </div>
              )}

              {(selectedField.minimum !== undefined || selectedField.maximum !== undefined) && (
                <div className="mt-2 text-xs">
                  <span className="text-slate-500">Range: </span>
                  <code className="text-emerald-400">
                    {selectedField.minimum ?? '∞'} - {selectedField.maximum ?? '∞'}
                  </code>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="border-t border-slate-700 p-4 bg-slate-900/50">
          <div className="flex items-start gap-2 text-slate-500 text-xs">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>Select a field to see documentation</span>
          </div>
        </div>
      )}
    </div>
  );
}
