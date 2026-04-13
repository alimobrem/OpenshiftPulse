import { cn } from '@/lib/utils';
import { DrawerShell } from '../../components/primitives/DrawerShell';
import type { ScannerCoverage } from '../../engine/analyticsApi';

interface ScannerDrawerProps {
  coverage: ScannerCoverage | null;
  onClose: () => void;
}

export function ScannerDrawer({ coverage, onClose }: ScannerDrawerProps) {
  return (
    <DrawerShell title="Scanner Coverage" onClose={onClose}>
      <div className="space-y-4">
        {(coverage?.per_scanner || []).map((scanner) => (
          <div key={scanner.name} className="flex items-center justify-between py-2 border-b border-slate-800">
            <div>
              <div className="text-sm text-slate-200">{scanner.name.replace(/^scan_/, '').replace(/_/g, ' ')}</div>
              {scanner.finding_count > 0 && (
                <div className="text-xs text-slate-500">
                  Found {scanner.finding_count} issues ({scanner.actionable_count} actionable)
                  {scanner.noise_pct > 0 && ` \u00B7 ${scanner.noise_pct}% noise`}
                </div>
              )}
              {scanner.finding_count === 0 && (
                <div className="text-xs text-slate-600">No findings yet</div>
              )}
            </div>
            <div className={cn('w-2 h-2 rounded-full', scanner.enabled ? 'bg-emerald-400' : 'bg-slate-600')} />
          </div>
        ))}
        {(!coverage?.per_scanner || coverage.per_scanner.length === 0) && (
          <div className="text-sm text-slate-500">No scanner data available</div>
        )}
      </div>
    </DrawerShell>
  );
}
