import { useState, useEffect } from 'react';
import {
  Card,
  CardBody,
  Grid,
  GridItem,
  DescriptionList,
  DescriptionListGroup,
  DescriptionListTerm,
  DescriptionListDescription,
  Label,
  Title,
} from '@patternfly/react-core';
import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';
import { useParams } from 'react-router-dom';
import ResourceDetailPage from '@/components/ResourceDetailPage';
import StatusIndicator from '@/components/StatusIndicator';
import LogViewer from '@/components/LogViewer';
import '@/openshift-components.css';

const BASE = '/api/kubernetes';

interface PodData {
  name: string;
  namespace: string;
  status: string;
  podIP: string;
  nodeName: string;
  created: string;
  labels: Record<string, string>;
  containers: { name: string; image: string; ready: boolean; restartCount: number; state: string; stateReason: string; stateMessage: string; isInit: boolean }[];
  conditions: { type: string; status: string; lastTransition: string; message: string }[];
}

export default function PodDetail() {
  const { namespace, name } = useParams();
  const [pod, setPod] = useState<PodData | null>(null);
  const [rawResource, setRawResource] = useState<Record<string, unknown> | null>(null);
  const [yaml, setYaml] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${BASE}/api/v1/namespaces/${namespace}/pods/${name}`);
        if (res.ok) {
          const raw = await res.json() as Record<string, unknown>;
          const meta = raw['metadata'] as Record<string, unknown>;
          const spec = raw['spec'] as Record<string, unknown>;
          const status = raw['status'] as Record<string, unknown>;
          function parseContainerStatus(c: Record<string, unknown>, cs: Record<string, unknown> | undefined, isInit: boolean) {
            const stateObj = cs?.['state'] as Record<string, unknown> | undefined;
            const stateKey = stateObj ? Object.keys(stateObj)[0] ?? 'unknown' : 'unknown';
            const stateDetail = stateObj ? stateObj[stateKey] as Record<string, unknown> | undefined : undefined;
            return {
              name: String(c['name'] ?? ''),
              image: String(c['image'] ?? ''),
              ready: Boolean(cs?.['ready']),
              restartCount: Number(cs?.['restartCount'] ?? 0),
              state: stateKey.charAt(0).toUpperCase() + stateKey.slice(1),
              stateReason: String(stateDetail?.['reason'] ?? ''),
              stateMessage: String(stateDetail?.['message'] ?? ''),
              isInit,
            };
          }

          const initContainerStatuses = (status?.['initContainerStatuses'] ?? []) as Record<string, unknown>[];
          const initContainers = ((spec?.['initContainers'] ?? []) as Record<string, unknown>[]).map((c, i) =>
            parseContainerStatus(c, initContainerStatuses[i], true)
          );

          const containerStatuses = (status?.['containerStatuses'] ?? []) as Record<string, unknown>[];
          const containers = ((spec?.['containers'] ?? []) as Record<string, unknown>[]).map((c, i) =>
            parseContainerStatus(c, containerStatuses[i], false)
          );

          const allContainers = [...initContainers, ...containers];

          const conditions = ((status?.['conditions'] ?? []) as Record<string, unknown>[]).map((c) => ({
            type: String(c['type'] ?? ''),
            status: String(c['status'] ?? ''),
            lastTransition: String(c['lastTransitionTime'] ?? '-'),
            message: String(c['message'] ?? ''),
          }));
          setPod({
            name: String(meta?.['name'] ?? name ?? ''),
            namespace: String(meta?.['namespace'] ?? namespace ?? ''),
            status: String(status?.['phase'] ?? 'Unknown'),
            podIP: String(status?.['podIP'] ?? '-'),
            nodeName: String(spec?.['nodeName'] ?? '-'),
            created: String(meta?.['creationTimestamp'] ?? '-'),
            labels: (meta?.['labels'] ?? {}) as Record<string, string>,
            containers: allContainers,
            conditions,
          });
          setRawResource(raw);
          setYaml(JSON.stringify(raw, null, 2));
        }
      } catch {
        // API may not be available
      }
      setLoading(false);
    }
    load();
  }, [namespace, name]);

  if (loading) return <div className="os-text-muted" role="status">Loading...</div>;
  if (!pod) return <div className="os-text-muted">Pod not found</div>;

  const detailsTab = (
    <Grid hasGutter>
      <GridItem md={6}>
        <Card>
          <CardBody>
            <Title headingLevel="h3" size="lg" className="os-detail__section-title">Pod Details</Title>
            <DescriptionList>
              <DescriptionListGroup><DescriptionListTerm>Name</DescriptionListTerm><DescriptionListDescription><strong>{pod.name}</strong></DescriptionListDescription></DescriptionListGroup>
              <DescriptionListGroup><DescriptionListTerm>Namespace</DescriptionListTerm><DescriptionListDescription>{pod.namespace}</DescriptionListDescription></DescriptionListGroup>
              <DescriptionListGroup><DescriptionListTerm>Status</DescriptionListTerm><DescriptionListDescription><StatusIndicator status={pod.status} /></DescriptionListDescription></DescriptionListGroup>
              <DescriptionListGroup><DescriptionListTerm>Pod IP</DescriptionListTerm><DescriptionListDescription><code>{pod.podIP}</code></DescriptionListDescription></DescriptionListGroup>
              <DescriptionListGroup><DescriptionListTerm>Node</DescriptionListTerm><DescriptionListDescription>{pod.nodeName}</DescriptionListDescription></DescriptionListGroup>
              <DescriptionListGroup><DescriptionListTerm>Created</DescriptionListTerm><DescriptionListDescription>{pod.created}</DescriptionListDescription></DescriptionListGroup>
            </DescriptionList>
          </CardBody>
        </Card>
        <Card className="os-detail__card--spaced">
          <CardBody>
            <Title headingLevel="h3" size="lg" className="os-detail__section-title">Labels</Title>
            <div className="os-detail__labels-wrap">
              {Object.entries(pod.labels).map(([key, value]) => (
                <Label key={key} color="blue"><code className="os-detail__label-code">{key}={value}</code></Label>
              ))}
            </div>
          </CardBody>
        </Card>
      </GridItem>
      <GridItem md={6}>
        <Card>
          <CardBody>
            <Title headingLevel="h3" size="lg" className="os-detail__section-title">Containers</Title>
            {pod.containers.filter((c) => c.isInit).length > 0 && (
              <>
                <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: 'var(--os-text-secondary, #6a6e73)', marginBottom: 8 }}>Init Containers</div>
                {pod.containers.filter((c) => c.isInit).map((c) => (
                  <DescriptionList key={c.name} style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--modern-border, #e0e0e0)' }}>
                    <DescriptionListGroup><DescriptionListTerm>Name</DescriptionListTerm><DescriptionListDescription><strong>{c.name}</strong> <Label color="purple" isCompact>init</Label></DescriptionListDescription></DescriptionListGroup>
                    <DescriptionListGroup><DescriptionListTerm>Image</DescriptionListTerm><DescriptionListDescription><code style={{ fontSize: 12, wordBreak: 'break-all' }}>{c.image}</code></DescriptionListDescription></DescriptionListGroup>
                    <DescriptionListGroup>
                      <DescriptionListTerm>State</DescriptionListTerm>
                      <DescriptionListDescription>
                        <StatusIndicator status={c.state} />
                        {c.stateReason && <Label color={c.stateReason.includes('Error') ? 'red' : 'orange'} isCompact style={{ marginLeft: 6 }}>{c.stateReason}</Label>}
                      </DescriptionListDescription>
                    </DescriptionListGroup>
                    {c.stateMessage && (
                      <DescriptionListGroup><DescriptionListTerm>Message</DescriptionListTerm><DescriptionListDescription style={{ color: '#c9190b', fontSize: 13 }}>{c.stateMessage}</DescriptionListDescription></DescriptionListGroup>
                    )}
                    <DescriptionListGroup><DescriptionListTerm>Restart Count</DescriptionListTerm><DescriptionListDescription>{c.restartCount}</DescriptionListDescription></DescriptionListGroup>
                  </DescriptionList>
                ))}
                <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: 'var(--os-text-secondary, #6a6e73)', marginTop: 16, marginBottom: 8 }}>Containers</div>
              </>
            )}
            {pod.containers.filter((c) => !c.isInit).map((c) => (
              <DescriptionList key={c.name} style={{ marginBottom: 12 }}>
                <DescriptionListGroup><DescriptionListTerm>Name</DescriptionListTerm><DescriptionListDescription><strong>{c.name}</strong></DescriptionListDescription></DescriptionListGroup>
                <DescriptionListGroup><DescriptionListTerm>Image</DescriptionListTerm><DescriptionListDescription><code style={{ fontSize: 12, wordBreak: 'break-all' }}>{c.image}</code></DescriptionListDescription></DescriptionListGroup>
                <DescriptionListGroup>
                  <DescriptionListTerm>State</DescriptionListTerm>
                  <DescriptionListDescription>
                    <StatusIndicator status={c.state} />
                    {c.stateReason && <Label color={c.stateReason.includes('Error') ? 'red' : 'orange'} isCompact style={{ marginLeft: 6 }}>{c.stateReason}</Label>}
                  </DescriptionListDescription>
                </DescriptionListGroup>
                {c.stateMessage && (
                  <DescriptionListGroup><DescriptionListTerm>Message</DescriptionListTerm><DescriptionListDescription style={{ color: '#c9190b', fontSize: 13 }}>{c.stateMessage}</DescriptionListDescription></DescriptionListGroup>
                )}
                <DescriptionListGroup><DescriptionListTerm>Restart Count</DescriptionListTerm><DescriptionListDescription>{c.restartCount}</DescriptionListDescription></DescriptionListGroup>
              </DescriptionList>
            ))}
          </CardBody>
        </Card>
        <Card className="os-detail__card--spaced">
          <CardBody>
            <Title headingLevel="h3" size="lg" className="os-detail__section-title">Conditions</Title>
            <Table aria-label="Conditions table" variant="compact">
              <Thead><Tr><Th>Type</Th><Th>Status</Th><Th>Message</Th><Th>Last Transition</Th></Tr></Thead>
              <Tbody>
                {pod.conditions.map((c) => (
                  <Tr key={c.type}>
                    <Td>{c.type}</Td>
                    <Td><StatusIndicator status={c.status} /></Td>
                    <Td style={{ fontSize: 12, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.message || '-'}</Td>
                    <Td>{c.lastTransition}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </CardBody>
        </Card>
      </GridItem>
    </Grid>
  );

  const logsTab = (
    <LogViewer podName={pod.name} namespace={pod.namespace} containers={pod.containers.map((c) => c.name)} />
  );

  return (
    <ResourceDetailPage
      kind="Pod"
      name={pod.name}
      namespace={pod.namespace}
      status={pod.status}
      backPath="/workloads/pods"
      backLabel="Pods"
      yaml={yaml}
      apiUrl={`${BASE}/api/v1/namespaces/${namespace}/pods/${name}`}
      onYamlSaved={(newYaml) => setYaml(newYaml)}
      rawResource={rawResource ?? undefined}
      tabs={[
        { title: 'Details', content: detailsTab },
        { title: 'Logs', content: logsTab },
      ]}
    />
  );
}
