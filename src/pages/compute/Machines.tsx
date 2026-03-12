import { useNavigate } from 'react-router-dom';
import ResourceListPage, { type ColumnDef } from '@/components/ResourceListPage';
import ResourceActions from '@/components/ResourceActions';
import { useK8sResource, ageFromTimestamp, type K8sMeta } from '@/hooks/useK8sResource';
import StatusIndicator from '@/components/StatusIndicator';

interface Machine {
  name: string;
  namespace: string;
  phase: string;
  type: string;
  region: string;
  zone: string;
  age: string;
}

interface RawMachine extends K8sMeta {
  spec: {
    providerSpec?: {
      value?: {
        instanceType?: string;
        placement?: {
          region?: string;
          availabilityZone?: string;
        };
      };
    };
  };
  status?: {
    phase?: string;
  };
}

const columns: ColumnDef<Machine>[] = [
  { title: 'Name', key: 'name' },
  { title: 'Namespace', key: 'namespace' },
  { title: 'Phase', key: 'phase', render: (m) => <StatusIndicator status={m.phase} /> },
  { title: 'Type', key: 'type' },
  { title: 'Region', key: 'region' },
  { title: 'Zone', key: 'zone' },
  { title: 'Age', key: 'age' },
  { title: '', key: 'actions', render: (r) => <ResourceActions name={r.name} namespace={r.namespace} apiBase="/apis/machine.openshift.io/v1beta1" resourceType="machines" kind="Machine" detailPath={`/compute/machines/${r.namespace}/${r.name}`} />, sortable: false },
];

export default function Machines() {
  const navigate = useNavigate();
  const { data, loading } = useK8sResource<RawMachine, Machine>(
    '/apis/machine.openshift.io/v1beta1/machines',
    (item) => ({
      name: item.metadata.name,
      namespace: item.metadata.namespace ?? '',
      phase: item.status?.phase ?? 'Unknown',
      type: item.spec.providerSpec?.value?.instanceType ?? '-',
      region: item.spec.providerSpec?.value?.placement?.region ?? '-',
      zone: item.spec.providerSpec?.value?.placement?.availabilityZone ?? '-',
      age: ageFromTimestamp(item.metadata.creationTimestamp),
    }),
  );

  return (
    <ResourceListPage
      title="Machines"
      description="View and manage machine resources"
      columns={columns}
      data={data}
      loading={loading}
      getRowKey={(m) => m.name}
      nameField="name"
      onRowClick={(item) => navigate(`/compute/machines/${item.namespace}/${item.name}`)}
    />
  );
}
