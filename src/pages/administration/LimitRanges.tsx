import { useNavigate } from 'react-router-dom';
import ResourceListPage, { type ColumnDef } from '@/components/ResourceListPage';
import ResourceActions from '@/components/ResourceActions';
import { useK8sResource, ageFromTimestamp, type K8sMeta } from '@/hooks/useK8sResource';

interface LimitRange {
  name: string;
  namespace: string;
  type: string;
  defaultCPU: string;
  defaultMemory: string;
  maxCPU: string;
  maxMemory: string;
  age: string;
}

interface RawLimitRange extends K8sMeta {
  spec: {
    limits: {
      type: string;
      default?: { cpu?: string; memory?: string };
      max?: { cpu?: string; memory?: string };
    }[];
  };
}

const columns: ColumnDef<LimitRange>[] = [
  { title: 'Name', key: 'name' },
  { title: 'Namespace', key: 'namespace' },
  { title: 'Type', key: 'type' },
  { title: 'Default CPU', key: 'defaultCPU' },
  { title: 'Default Memory', key: 'defaultMemory' },
  { title: 'Max CPU', key: 'maxCPU' },
  { title: 'Max Memory', key: 'maxMemory' },
  { title: 'Age', key: 'age' },
  { title: '', key: 'actions', render: (r) => <ResourceActions name={r.name} namespace={r.namespace} apiBase="/api/v1" resourceType="limitranges" kind="LimitRange" detailPath={`/administration/limitranges/${r.namespace}/${r.name}`} />, sortable: false },
];

export default function LimitRanges() {
  const navigate = useNavigate();
  const { data, loading } = useK8sResource<RawLimitRange, LimitRange>(
    '/api/v1/limitranges',
    (item) => {
      const limit = item.spec.limits[0];
      return {
        name: item.metadata.name,
        namespace: item.metadata.namespace ?? '',
        type: limit?.type ?? '-',
        defaultCPU: limit?.default?.cpu ?? '-',
        defaultMemory: limit?.default?.memory ?? '-',
        maxCPU: limit?.max?.cpu ?? '-',
        maxMemory: limit?.max?.memory ?? '-',
        age: ageFromTimestamp(item.metadata.creationTimestamp),
      };
    },
  );

  return (
    <ResourceListPage
      title="Limit Ranges"
      description="Manage default resource limits and constraints for containers and pods"
      columns={columns}
      data={data}
      loading={loading}
      getRowKey={(lr) => `${lr.namespace}-${lr.name}`}
      nameField="name"
      onRowClick={(item) => navigate(`/administration/limitranges/${item.namespace}/${item.name}`)}
    />
  );
}
