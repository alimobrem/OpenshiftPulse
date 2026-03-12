import { useNavigate } from 'react-router-dom';
import ResourceListPage, { type ColumnDef } from '@/components/ResourceListPage';
import ResourceActions from '@/components/ResourceActions';
import { useK8sResource, ageFromTimestamp, type K8sMeta } from '@/hooks/useK8sResource';
import { Label } from '@patternfly/react-core';

interface ImageStream {
  name: string;
  namespace: string;
  tags: number;
  dockerRepo: string;
  updated: string;
  age: string;
}

interface RawImageStream extends K8sMeta {
  status?: {
    tags?: { tag: string }[];
    dockerImageRepository?: string;
  };
}

const columns: ColumnDef<ImageStream>[] = [
  { title: 'Name', key: 'name' },
  { title: 'Namespace', key: 'namespace' },
  { title: 'Tags', key: 'tags', render: (is) => <Label color="blue">{is.tags}</Label> },
  { title: 'Docker Repository', key: 'dockerRepo', render: (is) => (
    <code className="os-imagestreams__repo">{is.dockerRepo}</code>
  )},
  { title: 'Updated', key: 'updated' },
  { title: 'Age', key: 'age' },
  { title: '', key: 'actions', render: (r) => <ResourceActions name={r.name} namespace={r.namespace} apiBase="/apis/image.openshift.io/v1" resourceType="imagestreams" kind="ImageStream" detailPath={`/builds/imagestreams/${r.namespace}/${r.name}`} />, sortable: false },
];

export default function ImageStreams() {
  const navigate = useNavigate();
  const { data, loading } = useK8sResource<RawImageStream, ImageStream>(
    '/apis/image.openshift.io/v1/imagestreams',
    (item) => ({
      name: item.metadata.name,
      namespace: item.metadata.namespace ?? '',
      tags: item.status?.tags?.length ?? 0,
      dockerRepo: item.status?.dockerImageRepository ?? '-',
      updated: ageFromTimestamp(item.metadata.creationTimestamp),
      age: ageFromTimestamp(item.metadata.creationTimestamp),
    }),
  );

  return (
    <ResourceListPage
      title="Image Streams"
      description="Manage image streams and container image references"
      columns={columns}
      data={data}
      loading={loading}
      getRowKey={(is) => `${is.namespace}-${is.name}`}
      createLabel="Create Image Stream"
      nameField="name"
      onRowClick={(item) => navigate(`/builds/imagestreams/${item.namespace}/${item.name}`)}
    />
  );
}
