import { useNavigate } from 'react-router-dom';
import ResourceListPage, { type ColumnDef } from '@/components/ResourceListPage';
import ResourceActions from '@/components/ResourceActions';
import { useK8sResource, ageFromTimestamp, type K8sMeta } from '@/hooks/useK8sResource';

interface ResourceQuota {
  name: string;
  namespace: string;
  cpuUsed: string;
  cpuLimit: string;
  memUsed: string;
  memLimit: string;
  podsUsed: string;
  podsLimit: string;
  age: string;
}

interface RawResourceQuota extends K8sMeta {
  status?: {
    hard?: Record<string, string>;
    used?: Record<string, string>;
  };
}

const columns: ColumnDef<ResourceQuota>[] = [
  { title: 'Name', key: 'name' },
  { title: 'Namespace', key: 'namespace' },
  { title: 'CPU (used/limit)', key: 'cpu', render: (rq) => `${rq.cpuUsed} / ${rq.cpuLimit}`, sortable: false },
  { title: 'Memory (used/limit)', key: 'mem', render: (rq) => `${rq.memUsed} / ${rq.memLimit}`, sortable: false },
  { title: 'Pods (used/limit)', key: 'pods', render: (rq) => `${rq.podsUsed} / ${rq.podsLimit}`, sortable: false },
  { title: 'Age', key: 'age' },
  { title: '', key: 'actions', render: (r) => <ResourceActions name={r.name} namespace={r.namespace} apiBase="/api/v1" resourceType="resourcequotas" kind="ResourceQuota" detailPath={`/administration/resourcequotas/${r.namespace}/${r.name}`} />, sortable: false },
];

export default function ResourceQuotas() {
  const navigate = useNavigate();
  const { data, loading } = useK8sResource<RawResourceQuota, ResourceQuota>(
    '/api/v1/resourcequotas',
    (item) => ({
      name: item.metadata.name,
      namespace: item.metadata.namespace ?? '',
      cpuUsed: item.status?.used?.['cpu'] ?? '-',
      cpuLimit: item.status?.hard?.['cpu'] ?? '-',
      memUsed: item.status?.used?.['memory'] ?? '-',
      memLimit: item.status?.hard?.['memory'] ?? '-',
      podsUsed: item.status?.used?.['pods'] ?? '-',
      podsLimit: item.status?.hard?.['pods'] ?? '-',
      age: ageFromTimestamp(item.metadata.creationTimestamp),
    }),
  );

  return (
    <ResourceListPage
      title="Resource Quotas"
      description="Manage resource consumption limits per namespace"
      columns={columns}
      data={data}
      loading={loading}
      getRowKey={(rq) => `${rq.namespace}-${rq.name}`}
      nameField="name"
      onRowClick={(item) => navigate(`/administration/resourcequotas/${item.namespace}/${item.name}`)}
    />
  );
}
