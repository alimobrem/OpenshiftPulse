import { ShieldCheck, X } from 'lucide-react';
import { useTrustStore, TRUST_LABELS, type TrustLevel } from '../../store/trustStore';
import { useUIStore } from '../../store/uiStore';
import { useState } from 'react';

/**
 * TrustUpgradeNudge — shown inline in agent panels when the user
 * has enough consecutive approvals to upgrade their trust level.
 */
export function TrustUpgradeNudge() {
  // Select only primitives to avoid re-render loops from new object references
  const trustLevel = useTrustStore((s) => s.trustLevel);
  const historyLength = useTrustStore((s) => s.history.length);
  const setTrustLevel = useTrustStore((s) => s.setTrustLevel);

  // Only compute eligibility when there's enough history
  const eligible = useTrustStore((s) => {
    if (s.trustLevel >= 3 || s.history.length < 10) return false;
    let count = 0;
    for (let i = s.history.length - 1; i >= 0; i--) {
      if (s.history[i].approved) count++;
      else break;
    }
    return count >= 10;
  });

  const consecutiveApprovals = historyLength; // approximate for display
  const nextLevel = Math.min(trustLevel + 1, 3) as TrustLevel;
  const currentLevel = trustLevel;
  const addToast = useUIStore((s) => s.addToast);
  const [dismissed, setDismissed] = useState(false);

  if (!eligible || dismissed) return null;

  const handleUpgrade = () => {
    setTrustLevel(nextLevel);
    addToast({
      type: 'success',
      title: `Trust upgraded to ${TRUST_LABELS[nextLevel]}`,
      detail: `Level ${nextLevel}: ${getLevelShortDescription(nextLevel)}`,
      duration: 5000,
    });
    setDismissed(true);
  };

  return (
    <div className="flex items-start gap-3 rounded-lg border border-blue-800 bg-blue-950/30 px-4 py-3 text-sm">
      <ShieldCheck className="h-5 w-5 text-blue-400 mt-0.5 shrink-0" />
      <div className="flex-1">
        <p className="text-blue-200 mb-2">
          You&apos;ve approved {consecutiveApprovals} consecutive actions successfully.
          Upgrade to <strong>{TRUST_LABELS[nextLevel]}</strong> (Level {nextLevel})?
        </p>
        <p className="text-xs text-blue-300/70 mb-3">
          {getLevelShortDescription(nextLevel)}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={handleUpgrade}
            className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
          >
            Upgrade
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="px-3 py-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            Not now
          </button>
        </div>
      </div>
      <button onClick={() => setDismissed(true)} className="text-slate-500 hover:text-slate-300 shrink-0">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function getLevelShortDescription(level: TrustLevel): string {
  switch (level) {
    case 2: return 'Low-risk actions (scale up, uncordon) will be auto-approved.';
    case 3: return 'Low and medium-risk actions auto-approved. Only high-risk (drain, apply YAML, rollback) will ask.';
    default: return '';
  }
}
