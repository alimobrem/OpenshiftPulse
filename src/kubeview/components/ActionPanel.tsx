import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useUIStore } from '../store/uiStore';
import { cn } from '@/lib/utils';

export function ActionPanel() {
  const closeActionPanel = useUIStore((s) => s.closeActionPanel);
  const actionPanelResource = useUIStore((s) => s.actionPanelResource);
  const panelRef = useRef<HTMLDivElement>(null);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        closeActionPanel();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [closeActionPanel]);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30" />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed right-0 top-0 z-50 h-full w-96 border-l border-slate-700 bg-slate-800 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700 p-4">
          <h2 className="text-lg font-semibold text-slate-100">Actions</h2>
          <button
            onClick={closeActionPanel}
            className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {actionPanelResource ? (
            <div className="space-y-4">
              <div className="text-sm text-slate-300">
                Resource actions will appear here
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-slate-500">
              Select a resource to see available actions
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-slate-700 p-3 text-xs text-slate-500">
          Press <kbd className="rounded bg-slate-700 px-1.5 py-0.5">⌘.</kbd> to close
        </div>
      </div>
    </>
  );
}
