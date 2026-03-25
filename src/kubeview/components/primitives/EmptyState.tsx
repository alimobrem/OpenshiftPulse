import { cn } from '@/lib/utils';
import { PromptPill } from '../agent/AIBranding';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  /** AI prompt suggestions shown below the description */
  aiPrompts?: Array<{ label: string; onAsk: () => void }>;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  aiPrompts,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center p-12', className)}>
      {icon && (
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-800 text-slate-400">
          {icon}
        </div>
      )}
      <h3 className="mb-2 text-lg font-semibold text-slate-100">{title}</h3>
      {description && (
        <p className="mb-6 max-w-md text-center text-sm text-slate-400">
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600"
        >
          {action.label}
        </button>
      )}
      {aiPrompts && aiPrompts.length > 0 && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {aiPrompts.map((prompt) => (
            <PromptPill key={prompt.label} onClick={prompt.onAsk}>
              {prompt.label}
            </PromptPill>
          ))}
        </div>
      )}
    </div>
  );
}
