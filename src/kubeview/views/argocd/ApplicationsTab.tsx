import React from 'react';
import {
  CheckCircle, XCircle, AlertTriangle, RefreshCw, Loader2,
  ExternalLink, ArrowRight, HelpCircle, Pause,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ArgoApplication, ArgoSyncStatus, ArgoHealthStatus } from '../../engine/types';
import { Card } from '../../components/primitives/Card';

interface ApplicationsTabProps {
  applications: ArgoApplication[];
  syncing: string | null;
  onSync: (name: string, namespace: string) => void;
  go: (path: string, title: string) => void;
}

const HEALTH_ICONS: Record<string, { icon: React.ElementType; color: string }> = {
  Healthy: { icon: CheckCircle, color: 'text-emerald-400' },
  Degraded: { icon: XCircle, color: 'text-red-400' },
  Progressing: { icon: RefreshCw, color: 'text-blue-400' },
  Suspended: { icon: Pause, color: 'text-amber-400' },
  Missing: { icon: AlertTriangle, color: 'text-red-400' },
  Unknown: { icon: HelpCircle, color: 'text-slate-400' },
};

const SYNC_COLORS: Record<ArgoSyncStatus, string> = {
  Synced: 'bg-emerald-900/50 text-emerald-300',
  OutOfSync: 'bg-amber-900/50 text-amber-300',
  Unknown: 'bg-slate-800 text-slate-400',
};

export function ApplicationsTab({ applications, syncing, onSync, go }: ApplicationsTabProps) {
  if (applications.length === 0) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-center">
          <HelpCircle className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <p className="text-slate-400 text-sm">No ArgoCD Applications found</p>
          <p className="text-slate-500 text-xs mt-1">Create an Application in ArgoCD to manage resources via GitOps</p>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <div className="divide-y divide-slate-800">
        {applications.map((app) => {
          const sync = app.status?.sync;
          const health = app.status?.health;
          const source = app.spec?.source || app.spec?.sources?.[0];
          const resourceCount = app.status?.resources?.length || 0;
          const HealthIcon = HEALTH_ICONS[health?.status || 'Unknown']?.icon || HelpCircle;
          const healthColor = HEALTH_ICONS[health?.status || 'Unknown']?.color || 'text-slate-400';
          const shortSha = sync?.revision?.slice(0, 7);
          const repoName = source?.repoURL?.replace(/^https?:\/\//, '').replace(/\.git$/, '').split('/').slice(-2).join('/') || '';
          const isSyncing = syncing === app.metadata.name;
          const automated = app.spec?.syncPolicy?.automated;

          return (
            <div
              key={app.metadata.uid || app.metadata.name}
              className="flex items-center justify-between px-4 py-3 hover:bg-slate-800/30 transition-colors cursor-pointer"
              onClick={() => go(`/r/argoproj.io~v1alpha1~applications/${app.metadata.namespace}/${app.metadata.name}`, app.metadata.name)}
            >
              <div className="flex items-center gap-3 min-w-0">
                <HealthIcon className={cn('w-5 h-5 shrink-0', healthColor)} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-200">{app.metadata.name}</span>
                    <span className={cn('text-xs px-1.5 py-0.5 rounded', SYNC_COLORS[sync?.status || 'Unknown'])}>
                      {sync?.status || 'Unknown'}
                    </span>
                    {automated && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-violet-900/50 text-violet-300">Auto</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {repoName && <span className="text-xs text-slate-500 font-mono">{repoName}</span>}
                    {source?.path && <span className="text-xs text-slate-600">/{source.path}</span>}
                    {shortSha && <span className="text-xs text-slate-600 font-mono">{shortSha}</span>}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-slate-500">{resourceCount} resources</span>
                <span className="text-xs text-slate-600">{app.spec?.destination?.namespace || '—'}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSync(app.metadata.name, app.metadata.namespace || '');
                  }}
                  disabled={isSyncing}
                  className="px-2 py-1 text-xs text-slate-400 rounded hover:bg-blue-900/50 hover:text-blue-300 transition-colors disabled:opacity-50"
                  title="Trigger sync"
                >
                  {isSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                </button>
                <ArrowRight className="w-3 h-3 text-slate-600" />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
