import { Suspense, lazy } from 'react';
import { DrawerShell } from '../../components/primitives/DrawerShell';

const MemoryView = lazy(() => import('../MemoryView'));

export function MemoryDrawer({ onClose }: { onClose: () => void }) {
  return (
    <DrawerShell title="Agent Memory" onClose={onClose}>
      <Suspense fallback={<div className="text-sm text-slate-500">Loading memory...</div>}>
        <MemoryView />
      </Suspense>
    </DrawerShell>
  );
}
