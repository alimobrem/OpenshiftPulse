import { useEffect, useState } from 'react';
import { useUIStore } from '../store/uiStore';
import { cn } from '@/lib/utils';

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

export function StatusBar() {
  const connectionStatus = useUIStore((s) => s.connectionStatus);
  const lastSyncTime = useUIStore((s) => s.lastSyncTime);
  const activeWatches = useUIStore((s) => s.activeWatches);
  const selectedNamespace = useUIStore((s) => s.selectedNamespace);
  const activeOperation = useUIStore((s) => s.activeOperation);

  const [relativeTime, setRelativeTime] = useState(formatRelativeTime(lastSyncTime));

  // Update relative time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setRelativeTime(formatRelativeTime(lastSyncTime));
    }, 1000);

    return () => clearInterval(interval);
  }, [lastSyncTime]);

  return (
    <div className="flex h-6 items-center justify-between border-t border-slate-700 bg-slate-800 px-4 text-xs text-slate-400">
      {/* Left side */}
      <div className="flex items-center gap-4">
        {/* Connection status */}
        <div className="flex items-center gap-1.5">
          <div
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              connectionStatus === 'connected' && 'bg-emerald-500',
              connectionStatus === 'reconnecting' && 'bg-yellow-500',
              connectionStatus === 'disconnected' && 'bg-red-500'
            )}
          />
          <span className="capitalize">{connectionStatus}</span>
        </div>

        {/* Watch count */}
        {activeWatches > 0 && (
          <div>
            watching {activeWatches} resource{activeWatches !== 1 ? 's' : ''}
          </div>
        )}

        {/* Last sync */}
        <div>last sync {relativeTime}</div>

        {/* Active operation */}
        {activeOperation && (
          <div className="text-emerald-400">{activeOperation}</div>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* Namespace */}
        <div>
          {selectedNamespace === '*' ? 'all namespaces' : selectedNamespace}
        </div>

        {/* User */}
        <div>admin</div>
      </div>
    </div>
  );
}
