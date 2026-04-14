import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Network, Loader2, Filter, RefreshCw, Maximize2,
  Box, Server, Globe, Database, Shield, Lock, Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '../components/primitives/Card';
import { EmptyState } from '../components/primitives/EmptyState';

interface TopoNode {
  id: string;
  kind: string;
  name: string;
  namespace: string;
}

interface TopoEdge {
  source: string;
  target: string;
  relationship: string;
}

interface TopologyData {
  nodes: TopoNode[];
  edges: TopoEdge[];
  summary: {
    nodes: number;
    edges: number;
    kinds: Record<string, number>;
    last_refresh: number;
  };
}

async function fetchTopology(namespace?: string): Promise<TopologyData> {
  const params = namespace ? `?namespace=${encodeURIComponent(namespace)}` : '';
  const res = await fetch(`/api/agent/topology${params}`);
  if (!res.ok) return { nodes: [], edges: [], summary: { nodes: 0, edges: 0, kinds: {}, last_refresh: 0 } };
  return res.json();
}

const KIND_COLORS: Record<string, string> = {
  Deployment: '#3b82f6',
  ReplicaSet: '#60a5fa',
  StatefulSet: '#2563eb',
  DaemonSet: '#1d4ed8',
  Pod: '#22c55e',
  Service: '#06b6d4',
  ConfigMap: '#eab308',
  Secret: '#ef4444',
  PVC: '#f97316',
  Node: '#64748b',
  Ingress: '#8b5cf6',
  Route: '#a78bfa',
};

const KIND_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Pod: Box,
  Deployment: Layers,
  Service: Globe,
  Node: Server,
  PVC: Database,
  Secret: Lock,
  ConfigMap: Shield,
};

function getColor(kind: string): string {
  return KIND_COLORS[kind] ?? '#64748b';
}

interface LayoutNode extends TopoNode {
  x: number;
  y: number;
}

function layoutNodes(nodes: TopoNode[], edges: TopoEdge[]): LayoutNode[] {
  if (nodes.length === 0) return [];

  // Group by kind for horizontal layers
  const kindOrder = ['Node', 'Deployment', 'StatefulSet', 'DaemonSet', 'ReplicaSet', 'Pod', 'Service', 'ConfigMap', 'Secret', 'PVC', 'Ingress', 'Route'];
  const byKind = new Map<string, TopoNode[]>();
  for (const n of nodes) {
    const group = byKind.get(n.kind) ?? [];
    group.push(n);
    byKind.set(n.kind, group);
  }

  const result: LayoutNode[] = [];
  const colWidth = 200;
  const rowHeight = 52;
  const paddingX = 60;
  const paddingY = 60;

  // Sort kinds in predefined order, fallback for unknown kinds
  const sortedKinds = [...byKind.keys()].sort((a, b) => {
    const ia = kindOrder.indexOf(a);
    const ib = kindOrder.indexOf(b);
    return (ia === -1 ? 100 : ia) - (ib === -1 ? 100 : ib);
  });

  sortedKinds.forEach((kind, col) => {
    const group = byKind.get(kind) ?? [];
    group.forEach((node, row) => {
      result.push({
        ...node,
        x: paddingX + col * colWidth,
        y: paddingY + row * rowHeight,
      });
    });
  });

  return result;
}

export default function TopologyView() {
  const [selectedNamespace, setSelectedNamespace] = useState<string>('');
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['topology', selectedNamespace],
    queryFn: () => fetchTopology(selectedNamespace || undefined),
    refetchInterval: 120_000,
  });

  const topology = data ?? { nodes: [], edges: [], summary: { nodes: 0, edges: 0, kinds: {}, last_refresh: 0 } };
  const layout = useMemo(() => layoutNodes(topology.nodes, topology.edges), [topology.nodes, topology.edges]);

  const namespaces = useMemo(() => {
    const ns = new Set<string>();
    for (const n of topology.nodes) {
      if (n.namespace) ns.add(n.namespace);
    }
    return [...ns].sort();
  }, [topology.nodes]);

  const nodeMap = useMemo(() => {
    const map = new Map<string, LayoutNode>();
    for (const n of layout) map.set(n.id, n);
    return map;
  }, [layout]);

  // Compute connected nodes for hover highlight
  const connectedToHovered = useMemo(() => {
    if (!hoveredNode) return new Set<string>();
    const ids = new Set<string>([hoveredNode]);
    for (const e of topology.edges) {
      if (e.source === hoveredNode) ids.add(e.target);
      if (e.target === hoveredNode) ids.add(e.source);
    }
    return ids;
  }, [hoveredNode, topology.edges]);

  // Compute blast radius for selected node
  const blastRadius = useMemo(() => {
    if (!selectedNode) return new Set<string>();
    const visited = new Set<string>([selectedNode]);
    const queue = [selectedNode];
    const adj = new Map<string, string[]>();
    for (const e of topology.edges) {
      if (!adj.has(e.source)) adj.set(e.source, []);
      adj.get(e.source)!.push(e.target);
    }
    while (queue.length > 0) {
      const curr = queue.shift()!;
      for (const next of adj.get(curr) ?? []) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }
    return visited;
  }, [selectedNode, topology.edges]);

  const svgWidth = useMemo(() => {
    if (layout.length === 0) return 800;
    return Math.max(800, Math.max(...layout.map(n => n.x)) + 240);
  }, [layout]);

  const svgHeight = useMemo(() => {
    if (layout.length === 0) return 400;
    return Math.max(400, Math.max(...layout.map(n => n.y)) + 100);
  }, [layout]);

  if (isLoading) {
    return (
      <div className="h-full overflow-auto bg-slate-950 p-6 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-slate-950 p-6">
      <div className="max-w-[1400px] mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
              <Network className="w-6 h-6 text-cyan-400" />
              Impact Analysis
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Live dependency graph showing resource relationships and blast radius
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedNamespace}
              onChange={(e) => setSelectedNamespace(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded text-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              <option value="">All namespaces</option>
              {namespaces.map((ns) => (
                <option key={ns} value={ns}>{ns}</option>
              ))}
            </select>
            <button
              onClick={() => refetch()}
              className="p-2 rounded-lg border border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200 transition-colors"
              title="Refresh graph"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-3">
          <Card className="p-3">
            <div className="text-xs text-slate-500 mb-1">Resources</div>
            <div className="text-xl font-bold text-slate-100">{topology.summary.nodes}</div>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-slate-500 mb-1">Relationships</div>
            <div className="text-xl font-bold text-slate-100">{topology.summary.edges}</div>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-slate-500 mb-1">Resource Types</div>
            <div className="text-xl font-bold text-slate-100">{Object.keys(topology.summary.kinds).length}</div>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-slate-500 mb-1">
              {selectedNode ? 'Blast Radius' : 'Click a node'}
            </div>
            <div className="text-xl font-bold text-slate-100">
              {selectedNode ? blastRadius.size - 1 : '-'}
            </div>
          </Card>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3">
          {Object.entries(topology.summary.kinds).map(([kind, count]) => (
            <div key={kind} className="flex items-center gap-1.5 text-xs text-slate-400">
              <span
                className="w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: getColor(kind) }}
              />
              {kind} ({count})
            </div>
          ))}
        </div>

        {/* Graph */}
        {topology.nodes.length === 0 ? (
          <EmptyState
            icon={<Network className="w-8 h-8 text-slate-500" />}
            title="No topology data"
            description="The dependency graph is built during scan cycles. It will populate as the monitor scans your cluster."
          />
        ) : (
          <Card className="overflow-auto">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full"
              style={{ minHeight: Math.min(svgHeight, 600) }}
            >
              {/* Edges */}
              {topology.edges.map((edge, i) => {
                const from = nodeMap.get(edge.source);
                const to = nodeMap.get(edge.target);
                if (!from || !to) return null;

                const isHighlighted = hoveredNode
                  ? connectedToHovered.has(edge.source) && connectedToHovered.has(edge.target)
                  : selectedNode
                    ? blastRadius.has(edge.source) && blastRadius.has(edge.target)
                    : false;

                const opacity = hoveredNode || selectedNode
                  ? isHighlighted ? 0.7 : 0.08
                  : 0.25;

                return (
                  <line
                    key={i}
                    x1={from.x + 80}
                    y1={from.y + 18}
                    x2={to.x + 80}
                    y2={to.y + 18}
                    stroke={isHighlighted ? '#06b6d4' : '#334155'}
                    strokeWidth={isHighlighted ? 2 : 1}
                    opacity={opacity}
                  />
                );
              })}

              {/* Nodes */}
              {layout.map((node) => {
                const isHovered = hoveredNode === node.id;
                const isConnected = connectedToHovered.has(node.id);
                const isInBlast = blastRadius.has(node.id);
                const isSelected = selectedNode === node.id;
                const dimmed = (hoveredNode && !isConnected) || (selectedNode && !isInBlast);

                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x}, ${node.y})`}
                    onMouseEnter={() => setHoveredNode(node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                    onClick={() => setSelectedNode(selectedNode === node.id ? null : node.id)}
                    className="cursor-pointer"
                    opacity={dimmed ? 0.15 : 1}
                  >
                    <rect
                      x={0}
                      y={0}
                      width={160}
                      height={36}
                      rx={6}
                      fill={isSelected ? getColor(node.kind) + '33' : '#0f172a'}
                      stroke={isSelected ? getColor(node.kind) : isHovered ? '#94a3b8' : '#334155'}
                      strokeWidth={isSelected ? 2 : 1}
                    />
                    <rect
                      x={0}
                      y={0}
                      width={4}
                      height={36}
                      rx={2}
                      fill={getColor(node.kind)}
                    />
                    <text
                      x={14}
                      y={14}
                      fill={getColor(node.kind)}
                      fontSize={9}
                      fontWeight={600}
                    >
                      {node.kind}
                    </text>
                    <text
                      x={14}
                      y={27}
                      fill="#cbd5e1"
                      fontSize={10}
                      fontFamily="monospace"
                    >
                      {node.name.length > 18 ? node.name.slice(0, 17) + '...' : node.name}
                    </text>
                  </g>
                );
              })}
            </svg>
          </Card>
        )}

        {/* Selected node detail */}
        {selectedNode && (() => {
          const node = nodeMap.get(selectedNode);
          if (!node) return null;
          const upstream = topology.edges.filter(e => e.target === selectedNode).map(e => nodeMap.get(e.source)).filter(Boolean);
          const downstream = topology.edges.filter(e => e.source === selectedNode).map(e => nodeMap.get(e.target)).filter(Boolean);
          return (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: getColor(node.kind) }} />
                <span className="text-sm font-semibold text-slate-200">{node.kind}/{node.name}</span>
                {node.namespace && (
                  <span className="text-xs px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded">{node.namespace}</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Upstream (depends on)</h4>
                  {upstream.length === 0 ? (
                    <span className="text-xs text-slate-600">None</span>
                  ) : (
                    <div className="space-y-1">
                      {upstream.map((n) => n && (
                        <div key={n.id} className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: getColor(n.kind) }} />
                          {n.kind}/{n.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Downstream (blast radius)</h4>
                  {downstream.length === 0 ? (
                    <span className="text-xs text-slate-600">None</span>
                  ) : (
                    <div className="space-y-1">
                      {downstream.map((n) => n && (
                        <div key={n.id} className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: getColor(n.kind) }} />
                          {n.kind}/{n.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })()}
      </div>
    </div>
  );
}
