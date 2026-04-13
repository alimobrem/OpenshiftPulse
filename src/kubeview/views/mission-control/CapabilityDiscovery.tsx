import { useState, useCallback } from 'react';
import { Lightbulb, X, Radar, MessageSquare } from 'lucide-react';
import { Card } from '../../components/primitives/Card';
import type { Recommendation } from '../../engine/analyticsApi';

const DISMISSED_KEY = 'openshiftpulse-dismissed-recommendations';

interface CapabilityDiscoveryProps {
  recommendations: Recommendation[];
}

export function CapabilityDiscovery({ recommendations }: CapabilityDiscoveryProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(DISMISSED_KEY);
      return new Set(stored ? JSON.parse(stored) : []);
    } catch {
      return new Set();
    }
  });

  const dismiss = useCallback((title: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(title);
      localStorage.setItem(DISMISSED_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  const visible = recommendations.filter((r) => !dismissed.has(r.title));

  if (visible.length === 0) return null;

  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
        <Lightbulb className="w-4 h-4 text-amber-400" />
        You could also be using...
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {visible.slice(0, 4).map((rec) => (
          <Card key={rec.title}>
            <div className="p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {rec.type === 'scanner' ? (
                    <Radar className="w-4 h-4 text-blue-400 shrink-0" />
                  ) : (
                    <MessageSquare className="w-4 h-4 text-violet-400 shrink-0" />
                  )}
                  <h3 className="text-sm font-medium text-slate-200">{rec.title}</h3>
                </div>
                <button
                  onClick={() => dismiss(rec.title)}
                  className="text-slate-600 hover:text-slate-400 p-0.5"
                  aria-label="Dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">{rec.description}</p>
              {rec.action.kind === 'enable_scanner' && (
                <button disabled className="text-xs text-blue-400/50 font-medium cursor-not-allowed" aria-label="Enable scanner (coming soon)">
                  Enable scanner &rarr;
                </button>
              )}
              {rec.action.kind === 'chat_prompt' && (
                <button disabled className="text-xs text-violet-400/50 font-medium cursor-not-allowed" aria-label="Try in chat (coming soon)">
                  Try in chat &rarr;
                </button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
