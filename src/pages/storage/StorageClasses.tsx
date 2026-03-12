import { useNavigate } from 'react-router-dom';
import ResourceListPage, { type ColumnDef } from '@/components/ResourceListPage';
import ResourceActions from '@/components/ResourceActions';
import { Label } from '@patternfly/react-core';
import { useK8sResource, ageFromTimestamp, type K8sMeta } from '@/hooks/useK8sResource';

interface StorageClass {
  name: string;
  provisioner: string;
  reclaimPolicy: string;
  volumeBindingMode: string;
  allowExpansion: boolean;
  isDefault: boolean;
  age: string;
}

interface RawStorageClass extends K8sMeta {
  provisioner: string;
  reclaimPolicy?: string;
  volumeBindingMode?: string;
  allowVolumeExpansion?: boolean;
}

const columns: ColumnDef<StorageClass>[] = [
  { title: 'Name', key: 'name', render: (sc) => (
    <span>
      <strong>{sc.name}</strong>
      {sc.isDefault && <Label color="blue" className="os-storageclasses__default-label">Default</Label>}
    </span>
  )},
  { title: 'Provisioner', key: 'provisioner' },
  { title: 'Reclaim Policy', key: 'reclaimPolicy' },
  { title: 'Volume Binding', key: 'volumeBindingMode' },
  { title: 'Allow Expansion', key: 'allowExpansion', render: (sc) => (
    <Label color={sc.allowExpansion ? 'green' : 'grey'}>{sc.allowExpansion ? 'Yes' : 'No'}</Label>
  ), sortable: false },
  { title: 'Age', key: 'age' },
  { title: '', key: 'actions', render: (r) => <ResourceActions name={r.name} apiBase="/apis/storage.k8s.io/v1" resourceType="storageclasses" kind="StorageClass" detailPath={`/storage/storageclasses/${r.name}`} />, sortable: false },
];

export default function StorageClasses() {
  const navigate = useNavigate();
  const { data, loading } = useK8sResource<RawStorageClass, StorageClass>(
    '/apis/storage.k8s.io/v1/storageclasses',
    (item) => ({
      name: item.metadata.name,
      provisioner: item.provisioner,
      reclaimPolicy: item.reclaimPolicy ?? 'Delete',
      volumeBindingMode: item.volumeBindingMode ?? 'Immediate',
      allowExpansion: item.allowVolumeExpansion ?? false,
      isDefault: item.metadata.annotations?.['storageclass.kubernetes.io/is-default-class'] === 'true',
      age: ageFromTimestamp(item.metadata.creationTimestamp),
    }),
  );

  return (
    <ResourceListPage
      title="Storage Classes"
      description="Manage storage classes for dynamic provisioning"
      columns={columns}
      data={data}
      loading={loading}
      getRowKey={(sc) => sc.name}
      createLabel="Create Storage Class"
      nameField="name"
      onRowClick={(item) => navigate(`/storage/storageclasses/${item.name}`)}
    />
  );
}
