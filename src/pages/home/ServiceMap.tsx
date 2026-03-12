import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageSection, Title, Card, CardBody, Label, Button, Select, SelectOption, MenuToggle } from '@patternfly/react-core';

const BASE = '/api/kubernetes';

interface ServiceNode {
  id: string;
  kind: 'Service' | 'Pod' | 'Deployment';
  name: string;
  namespace: string;
  status: string;
  x: number;
  y: number;
}

interface ServiceEdge {
  from: string;
  to: string;
  label?: string;
}

interface RawEndpoint {
  metadata: { name: string; namespace: string };
  subsets?: { addresses?: { targetRef?: { name: string; kind: string } }[]; ports?: { port: number; protocol: string }[] }[];
}

export default function ServiceMap() {
  const navigate = useNavigate();
  const [nodes, setNodes] = useState<ServiceNode[]>([]);
  const [edges, setEdges] = useState<ServiceEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNs, setSelectedNs] = useState('all');
  const [nsOpen, setNsOpen] = useState(false);
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<ServiceNode | null>(null);

  // Fetch namespaces
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${BASE}/api/v1/namespaces`);
        if (!res.ok) return;
        const data = await res.json() as { items: { metadata: { name: string } }[] };
        setNamespaces(['all', ...data.items.map((n) => n.metadata.name).filter((n) => !n.startsWith('openshift-') && !n.startsWith('kube-'))]);
      } catch { /* ignore */ }
    }
    load();
  }, []);

  // Build the service map
  useEffect(() => {
    async function buildMap() {
      setLoading(true);
      const svcPath = selectedNs === 'all' ? '/api/v1/services' : `/api/v1/namespaces/${selectedNs}/services`;
      const epPath = selectedNs === 'all' ? '/api/v1/endpoints' : `/api/v1/namespaces/${selectedNs}/endpoints`;
      const deployPath = selectedNs === 'all' ? '/apis/apps/v1/deployments' : `/apis/apps/v1/namespaces/${selectedNs}/deployments`;

      const mapNodes: ServiceNode[] = [];
      const mapEdges: ServiceEdge[] = [];
      const nodeIds = new Set<string>();

      // Fetch services
      try {
        const res = await fetch(`${BASE}${svcPath}`);
        if (res.ok) {
          const data = await res.json() as { items: { metadata: { name: string; namespace: string }; spec: { type: string; selector?: Record<string, string>; ports?: { port: number }[] } }[] };
          for (const svc of data.items) {
            const ns = svc.metadata.namespace;
            if (ns.startsWith('openshift-') || ns.startsWith('kube-')) continue;
            const id = `svc:${ns}/${svc.metadata.name}`;
            if (!nodeIds.has(id)) {
              mapNodes.push({ id, kind: 'Service', name: svc.metadata.name, namespace: ns, status: svc.spec.type, x: 0, y: 0 });
              nodeIds.add(id);
            }
          }
        }
      } catch { /* ignore */ }

      // Fetch endpoints to find service→pod connections
      try {
        const res = await fetch(`${BASE}${epPath}`);
        if (res.ok) {
          const data = await res.json() as { items: RawEndpoint[] };
          for (const ep of data.items) {
            const ns = ep.metadata.namespace;
            if (ns.startsWith('openshift-') || ns.startsWith('kube-')) continue;
            const svcId = `svc:${ns}/${ep.metadata.name}`;
            for (const subset of ep.subsets ?? []) {
              const port = subset.ports?.[0]?.port;
              for (const addr of subset.addresses ?? []) {
                if (addr.targetRef?.kind === 'Pod' && addr.targetRef.name) {
                  const podId = `pod:${ns}/${addr.targetRef.name}`;
                  if (!nodeIds.has(podId)) {
                    mapNodes.push({ id: podId, kind: 'Pod', name: addr.targetRef.name, namespace: ns, status: 'Running', x: 0, y: 0 });
                    nodeIds.add(podId);
                  }
                  mapEdges.push({ from: svcId, to: podId, label: port ? `:${port}` : undefined });
                }
              }
            }
          }
        }
      } catch { /* ignore */ }

      // Fetch deployments and link to pods by label
      try {
        const res = await fetch(`${BASE}${deployPath}`);
        if (res.ok) {
          const data = await res.json() as { items: { metadata: { name: string; namespace: string }; spec: { replicas: number; selector: { matchLabels?: Record<string, string> } }; status: { readyReplicas?: number } }[] };
          for (const dep of data.items) {
            const ns = dep.metadata.namespace;
            if (ns.startsWith('openshift-') || ns.startsWith('kube-')) continue;
            const depId = `deploy:${ns}/${dep.metadata.name}`;
            if (!nodeIds.has(depId)) {
              const ready = dep.status.readyReplicas ?? 0;
              mapNodes.push({ id: depId, kind: 'Deployment', name: dep.metadata.name, namespace: ns, status: `${ready}/${dep.spec.replicas}`, x: 0, y: 0 });
              nodeIds.add(depId);
            }
            // Link deployment to its pods
            for (const node of mapNodes) {
              if (node.kind === 'Pod' && node.namespace === ns && node.name.startsWith(dep.metadata.name + '-')) {
                mapEdges.push({ from: depId, to: node.id });
              }
            }
          }
        }
      } catch { /* ignore */ }

      // Layout: arrange in columns by kind
      const deploys = mapNodes.filter((n) => n.kind === 'Deployment');
      const services = mapNodes.filter((n) => n.kind === 'Service');
      const pods = mapNodes.filter((n) => n.kind === 'Pod');

      const colX = { Deployment: 100, Service: 400, Pod: 700 };
      const spacing = 70;

      deploys.forEach((n, i) => { n.x = colX.Deployment; n.y = 60 + i * spacing; });
      services.forEach((n, i) => { n.x = colX.Service; n.y = 60 + i * spacing; });
      pods.forEach((n, i) => { n.x = colX.Pod; n.y = 60 + i * spacing; });

      setNodes(mapNodes);
      setEdges(mapEdges);
      setLoading(false);
    }
    buildMap();
  }, [selectedNs]);

  const svgHeight = Math.max(400, (nodes.length * 35) + 100);

  const kindColor = useCallback((kind: string) => {
    switch (kind) {
      case 'Deployment': return 'var(--theme-color-1, #0066cc)';
      case 'Service': return '#009596';
      case 'Pod': return '#3e8635';
      default: return '#6a6e73';
    }
  }, []);

  const handleNodeClick = useCallback((node: ServiceNode) => {
    setSelectedNode(node);
    if (node.kind === 'Pod') navigate(`/workloads/pods/${node.namespace}/${node.name}`);
    else if (node.kind === 'Deployment') navigate(`/workloads/deployments/${node.namespace}/${node.name}`);
    else if (node.kind === 'Service') navigate(`/networking/services/${node.namespace}/${node.name}`);
  }, [navigate]);

  const connectedEdges = useMemo(() => {
    if (!hoveredNode) return new Set<string>();
    const ids = new Set<string>();
    edges.forEach((e) => {
      if (e.from === hoveredNode || e.to === hoveredNode) {
        ids.add(e.from); ids.add(e.to);
      }
    });
    return ids;
  }, [hoveredNode, edges]);

  return (
    <>
      <PageSection variant="default">
        <Title headingLevel="h1" size="2xl">Service Map</Title>
        <p className="os-text-muted">Live view of how services, deployments, and pods connect</p>
      </PageSection>

      <PageSection>
        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>Namespace:</span>
          <Select isOpen={nsOpen} selected={selectedNs} onSelect={(_e, val) => { setSelectedNs(val as string); setNsOpen(false); }} onOpenChange={setNsOpen}
            toggle={(ref) => <MenuToggle ref={ref} onClick={() => setNsOpen(!nsOpen)} style={{ minWidth: 200 }}>{selectedNs}</MenuToggle>}>
            {namespaces.map((ns) => <SelectOption key={ns} value={ns}>{ns}</SelectOption>)}
          </Select>
          <div style={{ display: 'flex', gap: 12, marginLeft: 'auto' }}>
            <Label color="blue">■ Deployment</Label>
            <Label color="cyan">■ Service</Label>
            <Label color="green">■ Pod</Label>
          </div>
        </div>

        <Card>
          <CardBody style={{ padding: 0, overflow: 'auto' }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center' }} className="os-text-muted">Loading service map...</div>
            ) : nodes.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center' }} className="os-text-muted">No services found in {selectedNs === 'all' ? 'user namespaces' : selectedNs}.</div>
            ) : (
              <svg width="100%" height={svgHeight} viewBox={`0 0 900 ${svgHeight}`} style={{ minHeight: 400 }}>
                {/* Edges */}
                {edges.map((e, i) => {
                  const from = nodes.find((n) => n.id === e.from);
                  const to = nodes.find((n) => n.id === e.to);
                  if (!from || !to) return null;
                  const highlighted = hoveredNode && (connectedEdges.has(e.from) && connectedEdges.has(e.to));
                  const dimmed = hoveredNode && !highlighted;
                  return (
                    <g key={i}>
                      <line x1={from.x + 60} y1={from.y + 16} x2={to.x - 10} y2={to.y + 16}
                        stroke={dimmed ? '#e0e0e0' : '#999'} strokeWidth={highlighted ? 2 : 1} strokeDasharray={highlighted ? '' : '4,4'} />
                      {e.label && !dimmed && (
                        <text x={(from.x + 60 + to.x - 10) / 2} y={(from.y + to.y) / 2 + 12} textAnchor="middle" fontSize={10} fill="#999">{e.label}</text>
                      )}
                    </g>
                  );
                })}
                {/* Column headers */}
                <text x={100} y={30} fontSize={12} fontWeight={600} fill="var(--os-text-secondary, #6a6e73)">DEPLOYMENTS</text>
                <text x={400} y={30} fontSize={12} fontWeight={600} fill="var(--os-text-secondary, #6a6e73)">SERVICES</text>
                <text x={700} y={30} fontSize={12} fontWeight={600} fill="var(--os-text-secondary, #6a6e73)">PODS</text>
                {/* Nodes */}
                {nodes.map((node) => {
                  const dimmed = hoveredNode && hoveredNode !== node.id && !connectedEdges.has(node.id);
                  return (
                    <g key={node.id} style={{ cursor: 'pointer', opacity: dimmed ? 0.3 : 1 }}
                      onMouseEnter={() => setHoveredNode(node.id)} onMouseLeave={() => setHoveredNode(null)}
                      onClick={() => handleNodeClick(node)}>
                      <rect x={node.x - 10} y={node.y} width={130} height={32} rx={6} fill={kindColor(node.kind)} opacity={0.12} stroke={kindColor(node.kind)} strokeWidth={1} />
                      <circle cx={node.x + 2} cy={node.y + 16} r={5} fill={kindColor(node.kind)} />
                      <text x={node.x + 12} y={node.y + 14} fontSize={11} fontWeight={500} fill="var(--os-text-primary, #151515)">
                        {node.name.length > 16 ? node.name.slice(0, 15) + '…' : node.name}
                      </text>
                      <text x={node.x + 12} y={node.y + 26} fontSize={9} fill="var(--os-text-muted, #8a8d90)">{node.namespace}</text>
                    </g>
                  );
                })}
              </svg>
            )}
          </CardBody>
        </Card>
      </PageSection>
    </>
  );
}
