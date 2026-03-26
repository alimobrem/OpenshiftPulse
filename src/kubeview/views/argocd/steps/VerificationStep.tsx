import React from 'react';
import { CheckCircle2, ArrowRight, Plus, X } from 'lucide-react';
import { useArgoCDStore } from '../../../store/argoCDStore';
import { useGitOpsConfig } from '../../../hooks/useGitOpsConfig';
import { useGitOpsSetupStore } from '../../../store/gitopsSetupStore';
import { useNavigateTab } from '../../../hooks/useNavigateTab';
import { cn } from '@/lib/utils';

interface Props {
  onClose: () => void;
}

export function VerificationStep({ onClose }: Props) {
  const go = useNavigateTab();
  const argoAvailable = useArgoCDStore((s) => s.available);
  const applications = useArgoCDStore((s) => s.applications);
  const { config } = useGitOpsConfig();
  const setStep = useGitOpsSetupStore((s) => s.setStep);

  const latestApp = applications.length > 0 ? applications[applications.length - 1] : null;

  return (
    <div className="space-y-6">
      <div className="text-center py-4">
        <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-slate-100">GitOps Setup Complete</h3>
        <p className="text-sm text-slate-400 mt-2">Your cluster is ready for GitOps workflows.</p>
      </div>

      {/* Summary */}
      <div className="bg-slate-900 border border-slate-700 rounded-lg divide-y divide-slate-800">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-slate-400">Operator</span>
          <span className={cn('text-sm', argoAvailable ? 'text-emerald-400' : 'text-slate-500')}>
            {argoAvailable ? 'OpenShift GitOps installed' : 'Not detected'}
          </span>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-slate-400">Git Repository</span>
          <span className="text-sm text-slate-200 font-mono truncate max-w-[280px]">
            {config?.repoUrl || 'Not configured'}
          </span>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-slate-400">Application</span>
          <span className="text-sm text-slate-200">
            {latestApp?.metadata.name || 'None created'}
          </span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-2">
        <button
          onClick={() => {
            onClose();
            go('/gitops', 'GitOps');
          }}
          className="w-full px-4 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          Go to GitOps Dashboard
          <ArrowRight className="w-4 h-4" />
        </button>
        <button
          onClick={() => setStep('first-app')}
          className="w-full px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Another Application
        </button>
        <button
          onClick={onClose}
          className="w-full px-4 py-3 text-slate-400 hover:text-slate-200 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
        >
          <X className="w-4 h-4" />
          Close
        </button>
      </div>
    </div>
  );
}
