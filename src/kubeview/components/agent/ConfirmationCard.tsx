import { useEffect } from 'react';
import { AlertTriangle, CheckCircle, XCircle, ShieldAlert, ShieldCheck, Shield } from 'lucide-react';
import type { ConfirmRequest } from '../../engine/agentClient';
import { describeToolAction, riskLevel } from './MessageBubble';
import { cn } from '@/lib/utils';

/** Tools that can be easily rolled back */
const ROLLBACK_INFO: Record<string, string> = {
  scale_deployment: 'Scale back to the original replica count',
  cordon_node: 'Uncordon the node to restore scheduling',
  uncordon_node: 'Cordon the node again',
  restart_deployment: 'No rollback needed — pods restart with the same image',
  rollback_deployment: 'Roll forward to the version you just rolled back from',
};

/** Estimate what will happen for each tool */
function impactDescription(tool: string, input: Record<string, unknown>): string | null {
  switch (tool) {
    case 'scale_deployment':
      return `${Number(input.replicas) > 0 ? `${input.replicas} pod(s) will be scheduled` : 'All pods will be terminated'}`;
    case 'delete_pod':
      return 'The pod will be terminated. If managed by a controller, a replacement will be created.';
    case 'drain_node':
      return 'All pods on this node will be evicted, respecting PodDisruptionBudgets.';
    case 'cordon_node':
      return 'No new pods will be scheduled on this node. Existing pods are unaffected.';
    case 'apply_yaml':
      return input.dry_run ? 'Dry-run only — no changes will be applied.' : 'The resource will be created or updated in the cluster.';
    case 'create_network_policy':
      return `A ${input.policy_type} NetworkPolicy will control traffic in ${input.namespace}.`;
    case 'rollback_deployment':
      return `The deployment will revert to revision ${input.revision || 'previous'}, triggering a rolling update.`;
    case 'restart_deployment':
      return 'A rolling restart will cycle all pods with the current spec.';
    default:
      return null;
  }
}

interface ConfirmationCardProps {
  confirm: ConfirmRequest;
  onConfirm: (approved: boolean) => void;
}

export function ConfirmationCard({ confirm, onConfirm }: ConfirmationCardProps) {
  const risk = riskLevel(confirm.tool, confirm.input);
  const description = describeToolAction(confirm.tool, confirm.input);
  const impact = impactDescription(confirm.tool, confirm.input);
  const rollback = ROLLBACK_INFO[confirm.tool];

  const RiskIcon = risk.level === 'HIGH' ? ShieldAlert : risk.level === 'MEDIUM' ? Shield : ShieldCheck;
  const riskBg = risk.level === 'HIGH' ? 'bg-red-950/40' : risk.level === 'MEDIUM' ? 'bg-amber-950/30' : 'bg-slate-800';
  const riskBorder = risk.level === 'HIGH' ? 'border-red-700' : risk.level === 'MEDIUM' ? 'border-amber-700' : 'border-slate-700';

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'y' || e.key === 'Y') { e.preventDefault(); onConfirm(true); }
      if (e.key === 'n' || e.key === 'N' || e.key === 'Escape') { e.preventDefault(); onConfirm(false); }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onConfirm]);

  return (
    <div className={cn('rounded-lg border p-4', riskBorder, riskBg, risk.level === 'HIGH' && 'animate-pulse-subtle')}>
      <div className="flex items-start gap-3" role="alertdialog" aria-modal="true" aria-label="Confirm write operation">
        <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" aria-hidden="true" />
        <div className="flex-1 space-y-3">
          {/* Title + description */}
          <div>
            <h3 className="text-sm font-medium text-amber-200 mb-1">Confirm write operation</h3>
            <p className="text-sm text-slate-200">{description}</p>
          </div>

          {/* Risk badge */}
          <div className="flex items-center gap-2">
            <span className={cn(
              'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium',
              risk.level === 'HIGH' && 'bg-red-900/50 text-red-300',
              risk.level === 'MEDIUM' && 'bg-amber-900/50 text-amber-300',
              risk.level === 'LOW' && 'bg-green-900/50 text-green-300',
            )}>
              <RiskIcon className="h-3 w-3" aria-hidden="true" />
              {risk.level} RISK
            </span>
          </div>

          {/* What will happen */}
          {impact && (
            <div className="rounded bg-slate-900/50 border border-slate-700 px-3 py-2">
              <h4 className="text-xs font-medium text-slate-400 mb-1">What will happen</h4>
              <p className="text-xs text-slate-300">{impact}</p>
            </div>
          )}

          {/* Rollback info */}
          {rollback && (
            <div className="rounded bg-slate-900/50 border border-slate-700 px-3 py-2">
              <h4 className="text-xs font-medium text-slate-400 mb-1">Rollback</h4>
              <p className="text-xs text-slate-300">{rollback}</p>
            </div>
          )}

          {/* Raw parameters */}
          <details>
            <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-300">Show raw parameters</summary>
            <pre className="text-xs text-slate-400 bg-slate-900 rounded p-2 mt-1 overflow-auto max-h-32">
              {JSON.stringify(confirm.input, null, 2)}
            </pre>
          </details>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-700 hover:bg-green-600 text-white rounded transition-colors"
              aria-label="Approve operation (Y)"
            >
              <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
              Approve <kbd className="ml-1 text-[10px] opacity-60 bg-green-900 px-1 rounded">Y</kbd>
            </button>
            <button
              onClick={() => onConfirm(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-700 hover:bg-red-600 text-white rounded transition-colors"
              aria-label="Deny operation (N)"
            >
              <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
              Deny <kbd className="ml-1 text-[10px] opacity-60 bg-red-900 px-1 rounded">N</kbd>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
