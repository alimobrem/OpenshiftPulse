# Quick Start Guide

## Installation

All dependencies are already installed. Just import and use:

```tsx
import { YamlEditor } from '@/kubeview/components/yaml';
```

## Common Use Cases

### 1. Simple Read-Only Viewer

```tsx
import { YamlEditor } from '@/kubeview/components/yaml';

<YamlEditor
  value={resourceYaml}
  readOnly={true}
  height="400px"
/>
```

### 2. Editable with Save

```tsx
import { YamlEditor } from '@/kubeview/components/yaml';
import { useState } from 'react';

function MyEditor() {
  const [yaml, setYaml] = useState(initialYaml);

  const handleSave = async (value: string) => {
    await fetch('/api/kubernetes/...', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/yaml' },
      body: value,
    });
  };

  return (
    <YamlEditor
      value={yaml}
      onChange={setYaml}
      onSave={handleSave}
    />
  );
}
```

### 3. With Diff Preview Before Save

```tsx
import { YamlEditor } from '@/kubeview/components/yaml';
import { useState } from 'react';

function EditorWithDiff() {
  const [yaml, setYaml] = useState(currentYaml);
  const [original] = useState(originalYaml); // Keep original for comparison

  return (
    <YamlEditor
      value={yaml}
      onChange={setYaml}
      originalValue={original}
      onSave={handleSave}
      showDiff={true}  // Shows diff preview before save
    />
  );
}
```

### 4. Resource Creation from Paste

```tsx
import { YamlEditor, PasteDetector, PasteActionDialog } from '@/kubeview/components/yaml';
import { useState } from 'react';

function CreateResource() {
  const [yaml, setYaml] = useState('');
  const [detection, setDetection] = useState(null);

  return (
    <>
      <PasteDetector onDetected={setDetection} />

      <YamlEditor
        value={yaml}
        onChange={setYaml}
        onSave={createResource}
      />

      {detection && (
        <PasteActionDialog
          detection={detection}
          onCreateResource={() => {
            setYaml(detection.raw);
            setDetection(null);
          }}
          onDismiss={() => setDetection(null)}
        />
      )}
    </>
  );
}
```

### 5. Multi-Document YAML

```tsx
import { MultiDocHandler } from '@/kubeview/components/yaml';

<MultiDocHandler
  yaml={multiDocYaml}
  onCreateAll={async (resources) => {
    for (const r of resources) {
      await createResource(r.raw);
    }
  }}
  onCreateOne={createResource}
  onClose={() => setShowDialog(false)}
/>
```

### 6. Insert Snippets

```tsx
import { snippets, resolveSnippet } from '@/kubeview/components/yaml';

// Get all snippets
const allSnippets = snippets;

// Search for specific snippet
const deploySnippet = snippets.find(s => s.prefix === 'deploy');

// Resolve placeholder values
const yaml = resolveSnippet(deploySnippet);
// Returns: "apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: my-app\n..."

// Insert into editor
setYaml(yaml);
```

### 7. Complete Editor with Schema Panel

```tsx
import { YamlEditor, SchemaPanel } from '@/kubeview/components/yaml';
import { useState } from 'react';

function CompleteEditor() {
  const [yaml, setYaml] = useState(initialYaml);
  const [cursorPath, setCursorPath] = useState('');

  return (
    <div className="flex h-screen">
      <div className="flex-1">
        <YamlEditor
          value={yaml}
          onChange={setYaml}
          onSave={handleSave}
          showDiff={true}
          resourceGvk={{ group: 'apps', version: 'v1', kind: 'Deployment' }}
        />
      </div>

      <div className="w-96">
        <SchemaPanel
          gvk={{ group: 'apps', version: 'v1', kind: 'Deployment' }}
          currentPath={cursorPath}
          onNavigate={(path) => {
            console.log('Jump to:', path);
            setCursorPath(path);
          }}
        />
      </div>
    </div>
  );
}
```

## Available Snippets

Use these prefixes to get YAML templates:

| Prefix | Resource | Description |
|--------|----------|-------------|
| `deploy` | Deployment | Standard deployment with container |
| `svc` | Service | ClusterIP service |
| `ing` | Ingress | Ingress with host/path rules |
| `pvc` | PersistentVolumeClaim | Storage claim |
| `cm` | ConfigMap | Configuration data |
| `secret` | Secret | Opaque secret |
| `rb` | RoleBinding | RBAC role binding |
| `cj` | CronJob | Scheduled job |
| `hpa` | HorizontalPodAutoscaler | Pod autoscaler |
| `ns` | Namespace | New namespace |
| `sa` | ServiceAccount | Service account |
| `np` | NetworkPolicy | Network policy rules |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+S` / `Ctrl+S` | Save (triggers onSave callback) |
| `Cmd+F` / `Ctrl+F` | Search (opens CodeMirror search) |
| `Esc` | Cancel edit / close dialogs |

## Props Reference

### YamlEditor

```tsx
interface YamlEditorProps {
  value: string;                    // Current YAML content
  onChange?: (value: string) => void; // Change handler
  readOnly?: boolean;               // Read-only mode (default: false)
  height?: string;                  // CSS height (default: "100%")
  onSave?: (value: string) => void; // Save handler (Cmd+S)
  showDiff?: boolean;               // Show diff preview (default: false)
  originalValue?: string;           // Original for diff comparison
  resourceGvk?: {                   // For schema features
    group: string;
    version: string;
    kind: string;
  };
}
```

### DiffPreview

```tsx
interface DiffPreviewProps {
  original: string;                 // Original YAML
  modified: string;                 // Modified YAML
  onApply: () => void;             // Apply changes
  onDiscard: () => void;           // Discard changes
  loading?: boolean;               // Show loading state
}
```

### SchemaPanel

```tsx
interface SchemaPanelProps {
  gvk: {                           // Resource type
    group: string;
    version: string;
    kind: string;
  };
  currentPath?: string;            // Current cursor path
  onNavigate?: (path: string) => void; // Navigate callback
}
```

## Styling

All components use Tailwind CSS with dark theme:

- **Background colors:** `slate-950`, `slate-900`, `slate-800`
- **Border color:** `slate-700`
- **Text colors:** `white`, `slate-300`, `slate-400`
- **Accent color:** `emerald-600` / `emerald-500`
- **Error color:** `red-400` / `red-950`
- **Success color:** `emerald-400` / `emerald-950`

## Code Splitting

Reduce initial bundle size by lazy loading:

```tsx
import { lazy, Suspense } from 'react';

const YamlEditor = lazy(() => import('@/kubeview/components/yaml/YamlEditor'));

function App() {
  return (
    <Suspense fallback={<div className="text-white">Loading editor...</div>}>
      <YamlEditor value={yaml} onChange={setYaml} />
    </Suspense>
  );
}
```

## Testing

The components are tested with Vitest:

```tsx
import { render, screen } from '@testing-library/react';
import { YamlEditor } from '@/kubeview/components/yaml';

test('renders editor', () => {
  render(<YamlEditor value="apiVersion: v1\nkind: Pod" />);
  // Add assertions...
});
```

Run tests:
```bash
pnpm test -- yaml
```

## Common Issues

### Editor not showing
- Check that height is set (default is "100%", parent must have height)
- Ensure CodeMirror CSS is loaded (should be automatic)

### Save not triggering
- Ensure `onSave` prop is provided
- Check that `readOnly` is not `true`
- Verify there are changes between `value` and `originalValue`

### Diff not showing
- Set `showDiff={true}`
- Provide `originalValue` prop
- Ensure `value` differs from `originalValue`

### Paste detection not working
- Wrap editor with `<PasteDetector>`
- Ensure `onDetected` callback is provided
- Check that pasted text has `apiVersion`, `kind`, and `metadata.name`

## Next Steps

See `examples/CompleteExample.tsx` for a full integration example with all features.

See `README.md` for detailed API documentation.

See `IMPLEMENTATION.md` for implementation details and architecture.
