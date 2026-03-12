import { useNavigate } from 'react-router-dom';
import ResourceListPage, { type ColumnDef } from '@/components/ResourceListPage';
import ResourceActions from '@/components/ResourceActions';
import { useK8sResource, ageFromTimestamp, type K8sMeta } from '@/hooks/useK8sResource';

interface PV {
  name: string;
  capacity: string;
  accessModes: string;
  reclaimPolicy: string;
  status: string;
  claim: string;
  storageClass: string;
  age: string;
}

interface RawPV extends K8sMeta {
  spec: {
    capacity?: { storage?: string };
    storageClassName?: string;
    accessModes?: string[];
    persistentVolumeReclaimPolicy?: string;
    claimRef?: { namespace?: string; name?: string };
  };
  status: { phase?: string };
}

const columns: ColumnDef<PV>[] = [
  { title: 'Name', key: 'name' },
  { title: 'Capacity', key: 'capacity' },
  { title: 'Access Modes', key: 'accessModes' },
  { title: 'Reclaim Policy', key: 'reclaimPolicy' },
  { title: 'Status', key: 'status' },
  { title: 'Claim', key: 'claim' },
  { title: 'Storage Class', key: 'storageClass' },
  { title: 'Age', key: 'age' },
  { title: '', key: 'actions', render: (r) => <ResourceActions name={r.name} apiBase="/api/v1" resourceType="persistentvolumes" kind="PersistentVolume" detailPath={`/storage/persistentvolumes/${r.name}`} />, sortable: false },
];

const accessModeShort: Record<string, string> = {
  ReadWriteOnce: 'RWO',
  ReadOnlyMany: 'ROX',
  ReadWriteMany: 'RWX',
  ReadWriteOncePod: 'RWOP',
};

export default function PersistentVolumes() {
  const navigate = useNavigate();
  const { data, loading } = useK8sResource<RawPV, PV>(
    '/api/v1/persistentvolumes',
    (item) => {
      const claim = item.spec.claimRef
        ? `${item.spec.claimRef.namespace ?? ''}/${item.spec.claimRef.name ?? ''}`
        : '-';
      return {
        name: item.metadata.name,
        capacity: item.spec.capacity?.storage ?? '-',
        accessModes: (item.spec.accessModes ?? []).map((m) => accessModeShort[m] ?? m).join(', '),
        reclaimPolicy: item.spec.persistentVolumeReclaimPolicy ?? '-',
        status: item.status.phase ?? '-',
        claim,
        storageClass: item.spec.storageClassName ?? '-',
        age: ageFromTimestamp(item.metadata.creationTimestamp),
      };
    },
  );

  return (
    <ResourceListPage
      title="Persistent Volumes"
      description="Manage persistent storage volumes in the cluster"
      columns={columns}
      data={data}
      loading={loading}
      getRowKey={(pv) => pv.name}
      createLabel="Create Persistent Volume"
      statusField="status"
      nameField="name"
      onRowClick={(item) => navigate(`/storage/persistentvolumes/${item.name}`)}
    />
  );
}
