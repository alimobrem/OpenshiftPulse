import { useNavigate } from 'react-router-dom';
import ResourceListPage, { type ColumnDef } from '@/components/ResourceListPage';
import ResourceActions from '@/components/ResourceActions';
import { useK8sResource, ageFromTimestamp, type K8sMeta } from '@/hooks/useK8sResource';

interface Build {
  name: string;
  namespace: string;
  buildConfig: string;
  status: string;
  duration: string;
  started: string;
}

interface RawBuild extends K8sMeta {
  spec: {
    source?: { type: string };
  };
  status: {
    phase: string;
    duration?: number;
    startTimestamp?: string;
  };
}

function formatDuration(seconds: number | undefined): string {
  if (!seconds) return '-';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

const columns: ColumnDef<Build>[] = [
  { title: 'Name', key: 'name' },
  { title: 'Namespace', key: 'namespace' },
  { title: 'Build Config', key: 'buildConfig' },
  { title: 'Status', key: 'status' },
  { title: 'Duration', key: 'duration' },
  { title: 'Started', key: 'started' },
  { title: '', key: 'actions', render: (r) => <ResourceActions name={r.name} namespace={r.namespace} apiBase="/apis/build.openshift.io/v1" resourceType="builds" kind="Build" detailPath={`/builds/builds/${r.namespace}/${r.name}`} />, sortable: false },
];

export default function Builds() {
  const navigate = useNavigate();
  const { data, loading } = useK8sResource<RawBuild, Build>(
    '/apis/build.openshift.io/v1/builds',
    (item) => ({
      name: item.metadata.name,
      namespace: item.metadata.namespace ?? '',
      buildConfig: item.metadata.labels?.['buildconfig'] ?? item.metadata.name.replace(/-\d+$/, ''),
      status: item.status.phase,
      duration: formatDuration(item.status.duration),
      started: ageFromTimestamp(item.status.startTimestamp),
    }),
  );

  return (
    <ResourceListPage
      title="Builds"
      description="View and manage build runs"
      columns={columns}
      data={data}
      loading={loading}
      getRowKey={(b) => `${b.namespace}-${b.name}`}
      statusField="status"
      nameField="name"
      onRowClick={(item) => navigate(`/builds/builds/${item.namespace}/${item.name}`)}
    />
  );
}
