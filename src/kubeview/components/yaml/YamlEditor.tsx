import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { yaml } from '@codemirror/lang-yaml';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { foldGutter, bracketMatching } from '@codemirror/language';
import { highlightActiveLine } from '@codemirror/view';
import { Save, FileDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import DiffPreview from './DiffPreview';

export interface YamlEditorProps {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  height?: string;         // CSS height, default "100%"
  onSave?: (value: string) => void;  // Cmd+S handler
  showDiff?: boolean;      // Show diff preview before save
  originalValue?: string;  // Original YAML for diff comparison
  resourceGvk?: { group: string; version: string; kind: string };  // For schema-aware features
}

export default function YamlEditor({
  value,
  onChange,
  readOnly = false,
  height = '100%',
  onSave,
  showDiff = false,
  originalValue,
  resourceGvk,
}: YamlEditorProps) {
  const editorRef = useRef<ReactCodeMirrorRef>(null);
  const [internalValue, setInternalValue] = useState(value);
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const [errorCount, setErrorCount] = useState(0);
  const [showDiffPreview, setShowDiffPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Update internal value when prop changes
  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  const hasChanges = useMemo(() => {
    return originalValue !== undefined && internalValue !== originalValue;
  }, [internalValue, originalValue]);

  // Handle value change
  const handleChange = useCallback((newValue: string) => {
    setInternalValue(newValue);
    onChange?.(newValue);
  }, [onChange]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!onSave || readOnly) return;
    setIsSaving(true);
    try {
      await onSave(internalValue);
      setShowDiffPreview(false);
    } finally {
      setIsSaving(false);
    }
  }, [onSave, internalValue, readOnly]);

  // Handle discard changes
  const handleDiscard = useCallback(() => {
    if (originalValue !== undefined) {
      setInternalValue(originalValue);
      onChange?.(originalValue);
    }
    setShowDiffPreview(false);
  }, [originalValue, onChange]);

  // Keyboard shortcuts
  const saveKeymap = useMemo(() => keymap.of([
    {
      key: 'Mod-s',
      run: () => {
        if (!readOnly && hasChanges) {
          if (showDiff) {
            setShowDiffPreview(true);
          } else {
            handleSave();
          }
        }
        return true;
      },
    },
  ]), [readOnly, hasChanges, showDiff, handleSave]);

  // Update cursor position
  const handleCursorActivity = useCallback((view: EditorView) => {
    const pos = view.state.selection.main.head;
    const line = view.state.doc.lineAt(pos);
    setCursorPosition({
      line: line.number,
      column: pos - line.from + 1,
    });
  }, []);

  const extensions = useMemo(() => [
    yaml(),
    lineNumbers(),
    foldGutter(),
    bracketMatching(),
    highlightActiveLine(),
    saveKeymap,
    EditorView.updateListener.of((update) => {
      if (update.selectionSet) {
        handleCursorActivity(update.view);
      }
    }),
  ], [saveKeymap, handleCursorActivity]);

  return (
    <div className="flex flex-col" style={{ height }}>
      {/* Editor */}
      <div className="flex-1 relative">
        <CodeMirror
          ref={editorRef}
          value={internalValue}
          onChange={handleChange}
          extensions={extensions}
          theme={oneDark}
          editable={!readOnly}
          basicSetup={false}
          className={cn(
            'h-full font-mono text-[13px]',
            'bg-slate-950 border border-slate-800 rounded-lg',
            'overflow-hidden'
          )}
        />
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-t border-slate-800 text-xs text-slate-400">
        <div className="flex items-center gap-4">
          <span>Ln {cursorPosition.line}, Col {cursorPosition.column}</span>
          <span>YAML</span>
          {errorCount > 0 && (
            <span className="text-red-400">{errorCount} error{errorCount !== 1 ? 's' : ''}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!readOnly && hasChanges && (
            <button
              onClick={() => setShowDiffPreview(true)}
              className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-slate-800 transition-colors"
              title="Show diff"
            >
              <FileDown className="w-3 h-3" />
              <span>Review changes</span>
            </button>
          )}
          {!readOnly && onSave && (
            <button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className={cn(
                'flex items-center gap-1 px-2 py-0.5 rounded transition-colors',
                hasChanges ? 'hover:bg-slate-800 text-emerald-400' : 'opacity-50 cursor-not-allowed'
              )}
              title="Save (Cmd+S)"
            >
              <Save className="w-3 h-3" />
              <span>{isSaving ? 'Saving...' : 'Save'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Diff Preview */}
      {showDiff && showDiffPreview && originalValue && (
        <DiffPreview
          original={originalValue}
          modified={internalValue}
          onApply={handleSave}
          onDiscard={handleDiscard}
          loading={isSaving}
        />
      )}
    </div>
  );
}
