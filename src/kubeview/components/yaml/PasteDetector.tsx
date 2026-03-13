import React, { useEffect, useRef, useCallback } from 'react';
import { FileText, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PasteDetectorProps {
  onDetected: (detection: PasteDetection) => void;
}

export interface PasteDetection {
  kind: string;
  apiVersion: string;
  name: string;
  namespace?: string;
  raw: string;
  isMultiDoc: boolean;
  docCount: number;
}

/**
 * Detect if pasted text contains valid Kubernetes resources
 */
function detectK8sResource(text: string): PasteDetection | null {
  const trimmed = text.trim();

  // Check for apiVersion and kind (minimum requirements)
  const apiVersionMatch = trimmed.match(/^apiVersion:\s*(.+)$/m);
  const kindMatch = trimmed.match(/^kind:\s*(.+)$/m);

  if (!apiVersionMatch || !kindMatch) {
    return null;
  }

  const apiVersion = apiVersionMatch[1].trim();
  const kind = kindMatch[1].trim();

  // Check for metadata.name
  const nameMatch = trimmed.match(/^metadata:\s*\n\s+name:\s*(.+)$/m);
  if (!nameMatch) {
    return null;
  }

  const name = nameMatch[1].trim();

  // Check for metadata.namespace (optional)
  const namespaceMatch = trimmed.match(/^metadata:\s*\n(?:.*\n)*?\s+namespace:\s*(.+)$/m);
  const namespace = namespaceMatch?.[1].trim();

  // Check if it's a multi-document YAML
  const isMultiDoc = /^---$/m.test(trimmed);
  const docCount = isMultiDoc ? trimmed.split(/^---$/m).filter(doc => doc.trim()).length : 1;

  return {
    kind,
    apiVersion,
    name,
    namespace,
    raw: trimmed,
    isMultiDoc,
    docCount,
  };
}

export default function PasteDetector({ onDetected }: PasteDetectorProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const text = e.clipboardData?.getData('text');
    if (!text) return;

    const detection = detectK8sResource(text);
    if (detection) {
      onDetected(detection);
    }
  }, [onDetected]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('paste', handlePaste);
    return () => {
      container.removeEventListener('paste', handlePaste);
    };
  }, [handlePaste]);

  return <div ref={containerRef} className="contents" />;
}

/**
 * Hook version of PasteDetector
 */
export function usePasteDetector(editorRef: React.RefObject<HTMLElement>): PasteDetection | null {
  const [detection, setDetection] = React.useState<PasteDetection | null>(null);

  useEffect(() => {
    const element = editorRef.current;
    if (!element) return;

    const handlePaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text');
      if (!text) return;

      const detected = detectK8sResource(text);
      if (detected) {
        setDetection(detected);
      }
    };

    element.addEventListener('paste', handlePaste);
    return () => {
      element.removeEventListener('paste', handlePaste);
    };
  }, [editorRef]);

  return detection;
}

/**
 * Action Dialog component to show after detection
 */
export function PasteActionDialog({
  detection,
  onCreateResource,
  onDismiss,
}: {
  detection: PasteDetection;
  onCreateResource: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-2">
      <div className="bg-slate-800 rounded-lg shadow-xl border border-slate-700 p-4 max-w-md">
        <div className="flex items-start gap-3">
          <FileText className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-white mb-1">
              {detection.isMultiDoc
                ? `${detection.docCount} Resources Detected`
                : 'Resource Detected'}
            </h4>
            <p className="text-xs text-slate-400 mb-3">
              {detection.isMultiDoc ? (
                `Pasted YAML contains ${detection.docCount} resources`
              ) : (
                <>
                  <span className="font-mono text-emerald-400">{detection.kind}</span>
                  <span className="text-slate-500"> / </span>
                  <span className="font-mono">{detection.name}</span>
                </>
              )}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={onCreateResource}
                className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded transition-colors"
              >
                Create {detection.isMultiDoc ? 'Resources' : 'Resource'}
              </button>
              <button
                onClick={onDismiss}
                className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
