import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Puzzle, Server, Layers, RefreshCw, CheckCircle2, XCircle,
  AlertTriangle, BarChart3, ArrowRight, Play, X, FileText, ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type ExtTab = 'skills' | 'mcp' | 'components' | 'analytics';

export default function AdminExtensionsView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<ExtTab>((searchParams.get('tab') as ExtTab) || 'skills');

  const changeTab = (tab: ExtTab) => {
    setActiveTab(tab);
    const next = new URLSearchParams(searchParams);
    if (tab === 'skills') next.delete('tab'); else next.set('tab', tab);
    setSearchParams(next, { replace: true });
  };

  const tabs: Array<{ id: ExtTab; label: string; icon: React.ReactNode }> = [
    { id: 'skills', label: 'Skills', icon: <Puzzle className="w-3.5 h-3.5 text-violet-400" /> },
    { id: 'mcp', label: 'MCP Servers', icon: <Server className="w-3.5 h-3.5 text-cyan-400" /> },
    { id: 'components', label: 'Components', icon: <Layers className="w-3.5 h-3.5 text-emerald-400" /> },
    { id: 'analytics', label: 'Skill Analytics', icon: <BarChart3 className="w-3.5 h-3.5 text-amber-400" /> },
  ];

  return (
    <div className="h-full overflow-auto bg-slate-950 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Puzzle className="w-6 h-6 text-violet-400" />
            Extensions
          </h1>
          <p className="text-sm text-slate-400 mt-1">Manage skills, MCP servers, and components</p>
        </div>

        <div className="flex gap-1 bg-slate-900 rounded-lg border border-slate-800 p-1" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={activeTab === t.id}
              onClick={() => changeTab(t.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors',
                activeTab === t.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200',
              )}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {activeTab === 'skills' && <SkillsTab />}
        {activeTab === 'mcp' && <MCPTab />}
        {activeTab === 'components' && <ComponentsTab />}
        {activeTab === 'analytics' && <AnalyticsTab />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Skills Tab                                                          */
/* ------------------------------------------------------------------ */

function SkillsTab() {
  const queryClient = useQueryClient();
  const [testQuery, setTestQuery] = useState('');
  const [testResult, setTestResult] = useState<{ skill: string; description: string; degraded: boolean } | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);

  const { data: skills = [], isLoading } = useQuery({
    queryKey: ['admin', 'skills'],
    queryFn: async () => {
      const res = await fetch('/api/agent/skills');
      if (!res.ok) return [];
      return res.json();
    },
  });

  const reloadMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/agent/admin/skills/reload', { method: 'POST' });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'skills'] }),
  });

  const testRouting = async () => {
    if (!testQuery.trim()) return;
    try {
      const res = await fetch('/api/agent/admin/skills/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: testQuery }),
      });
      if (res.ok) {
        const data = await res.json();
        setTestResult({ skill: data.skill, description: data.description, degraded: data.degraded });
      } else {
        setTestResult(null);
      }
    } catch {
      setTestResult(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-400">{skills.length} skills loaded</span>
        <button
          onClick={() => reloadMutation.mutate()}
          disabled={reloadMutation.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-violet-600 hover:bg-violet-700 text-white rounded-md disabled:opacity-50"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', reloadMutation.isPending && 'animate-spin')} />
          Reload Skills
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="kv-skeleton w-8 h-8 rounded-full" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {skills.map((skill: Record<string, unknown>) => (
            <button
              key={String(skill.name)}
              onClick={() => setSelectedSkill(String(skill.name))}
              className={cn(
                'bg-slate-900 border rounded-lg p-4 space-y-2 text-left transition-colors hover:border-blue-700/50 hover:bg-slate-900/80 cursor-pointer',
                skill.degraded ? 'border-amber-800/50' : 'border-slate-800',
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {skill.degraded
                    ? <AlertTriangle className="w-4 h-4 text-amber-400" />
                    : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  <span className="text-sm font-medium text-slate-100">{String(skill.name)}</span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-slate-800 rounded text-slate-500">v{Number(skill.version)}</span>
                </div>
                {Boolean(skill.write_tools) && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-amber-900/30 text-amber-400 rounded border border-amber-800/30">write</span>
                )}
              </div>
              <p className="text-xs text-slate-400">{String(skill.description)}</p>
              <div className="flex items-center gap-3 text-[10px] text-slate-500">
                <span>{(skill.keywords as string[])?.length || 0} keywords</span>
                <span>{(skill.categories as string[])?.length || 0} categories</span>
                <span>{Number(skill.prompt_length)} chars</span>
              </div>
              {Boolean(skill.degraded) && (
                <div className="text-[10px] text-amber-400">{String(skill.degraded_reason)}</div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Routing tester */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        <h3 className="text-xs font-medium text-slate-300 mb-2 flex items-center gap-1.5">
          <Play className="w-3.5 h-3.5 text-blue-400" />
          Test Routing
        </h3>
        <div className="flex gap-2">
          <input
            value={testQuery}
            onChange={(e) => setTestQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && testRouting()}
            placeholder="Type a query to see which skill handles it..."
            className="flex-1 px-3 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded-md text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button onClick={testRouting} className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-md">Test</button>
        </div>
        {testResult && (
          <div className="flex items-center gap-2 mt-2 text-xs">
            <ArrowRight className="w-3 h-3 text-blue-400" />
            <span className={cn('font-medium', testResult.degraded ? 'text-amber-400' : 'text-emerald-400')}>
              {testResult.skill}
            </span>
            <span className="text-slate-500">{testResult.description}</span>
          </div>
        )}
      </div>

      {/* Skill detail drawer */}
      {selectedSkill && (
        <SkillDetailDrawer name={selectedSkill} onClose={() => setSelectedSkill(null)} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Skill Detail Drawer                                                 */
/* ------------------------------------------------------------------ */

type SkillFile = 'raw_content' | 'evals_content' | 'mcp_content' | 'layouts_content' | 'components_content';

const SKILL_FILES: Array<{ key: SkillFile; label: string; filename: string }> = [
  { key: 'raw_content', label: 'skill.md', filename: 'skill.md' },
  { key: 'evals_content', label: 'evals.yaml', filename: 'evals.yaml' },
  { key: 'mcp_content', label: 'mcp.yaml', filename: 'mcp.yaml' },
  { key: 'layouts_content', label: 'layouts.yaml', filename: 'layouts.yaml' },
  { key: 'components_content', label: 'components.yaml', filename: 'components.yaml' },
];

function SkillDetailDrawer({ name, onClose }: { name: string; onClose: () => void }) {
  const [activeFile, setActiveFile] = useState<SkillFile>('raw_content');

  const { data: detail, isLoading } = useQuery({
    queryKey: ['admin', 'skill-detail', name],
    queryFn: async () => {
      const res = await fetch(`/api/agent/skills/${name}`);
      if (!res.ok) return null;
      return res.json();
    },
  });

  const availableFiles = SKILL_FILES.filter((f) => detail?.[f.key]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative w-full max-w-2xl bg-slate-950 border-l border-slate-800 h-full overflow-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-slate-950 border-b border-slate-800 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Puzzle className="w-5 h-5 text-violet-400" />
            <div>
              <h2 className="text-base font-semibold text-slate-100">{name}</h2>
              {detail && (
                <p className="text-xs text-slate-500">v{detail.version} &middot; {detail.description}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><div className="kv-skeleton w-8 h-8 rounded-full" /></div>
        ) : detail ? (
          <div className="p-5 space-y-4">
            {/* Metadata */}
            <div className="grid grid-cols-2 gap-3">
              <MetaCard label="Keywords" value={detail.keywords?.length ?? 0} />
              <MetaCard label="Categories" value={detail.categories?.join(', ') || 'none'} />
              <MetaCard label="Priority" value={detail.priority} />
              <MetaCard label="Write Tools" value={detail.write_tools ? 'Yes' : 'No'} />
            </div>

            {detail.degraded && (
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-950/30 border border-amber-800/30 rounded-md text-xs text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                {detail.degraded_reason}
              </div>
            )}

            {/* Handoff rules */}
            {detail.handoff_to && Object.keys(detail.handoff_to).length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                <h3 className="text-xs font-medium text-slate-300 mb-2">Handoff Rules</h3>
                <div className="space-y-1">
                  {Object.entries(detail.handoff_to).map(([target, keywords]) => (
                    <div key={target} className="flex items-center gap-2 text-xs">
                      <ArrowRight className="w-3 h-3 text-blue-400" />
                      <span className="text-slate-200 font-medium">{target}</span>
                      <span className="text-slate-500">when: {(keywords as string[]).join(', ')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Required tools */}
            {detail.requires_tools?.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                <h3 className="text-xs font-medium text-slate-300 mb-2">Required Tools</h3>
                <div className="flex flex-wrap gap-1">
                  {detail.requires_tools.map((t: string) => (
                    <span key={t} className="text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded font-mono">{t}</span>
                  ))}
                </div>
              </div>
            )}

            {/* File tabs */}
            {availableFiles.length > 0 && (
              <div>
                <div className="flex gap-1 mb-2 overflow-x-auto">
                  {availableFiles.map((f) => (
                    <button
                      key={f.key}
                      onClick={() => setActiveFile(f.key)}
                      className={cn(
                        'flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-md whitespace-nowrap transition-colors',
                        activeFile === f.key ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200 bg-slate-900',
                      )}
                    >
                      <FileText className="w-3 h-3" />
                      {f.label}
                    </button>
                  ))}
                </div>
                <textarea
                  readOnly
                  value={detail[activeFile] || ''}
                  className="w-full h-96 px-3 py-2 text-xs font-mono bg-slate-900 border border-slate-800 rounded-lg text-slate-300 resize-y focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}

            {/* Configurable fields */}
            {detail.configurable?.length > 0 && (
              <SkillConfigSection configurable={detail.configurable} />
            )}
          </div>
        ) : (
          <div className="flex justify-center py-12 text-sm text-slate-500">Skill not found</div>
        )}
      </div>
    </div>
  );
}

function MetaCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-md px-3 py-2">
      <div className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</div>
      <div className="text-sm text-slate-200 mt-0.5">{value}</div>
    </div>
  );
}

function SkillConfigSection({ configurable }: { configurable: Array<Record<string, unknown>> }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 text-xs font-medium text-slate-300 w-full">
        <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', open && 'rotate-180')} />
        Configurable Fields ({configurable.length})
      </button>
      {open && (
        <div className="mt-2 space-y-1.5">
          {configurable.map((cfg) => {
            const [fieldName, fieldDef] = Object.entries(cfg)[0] || [];
            if (!fieldName) return null;
            const def = fieldDef as Record<string, unknown> | undefined;
            return (
              <div key={fieldName} className="flex items-center justify-between text-xs border-t border-slate-800 pt-1.5">
                <span className="text-slate-200 font-mono">{fieldName}</span>
                <div className="flex items-center gap-2 text-slate-500">
                  <span>{String(def?.type || 'string')}</span>
                  {def?.default !== undefined && <span>default: {String(def.default)}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* MCP Tab                                                             */
/* ------------------------------------------------------------------ */

function MCPTab() {
  const { data: connections = [], isLoading } = useQuery({
    queryKey: ['admin', 'mcp'],
    queryFn: async () => {
      const res = await fetch('/api/agent/admin/mcp');
      if (!res.ok) return [];
      return res.json();
    },
  });

  return (
    <div className="space-y-4">
      <div className="text-sm text-slate-400">{connections.length} MCP servers configured</div>

      {connections.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-8 text-center">
          <Server className="w-8 h-8 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-400 mb-2">No MCP servers connected</p>
          <p className="text-xs text-slate-500">MCP servers are configured per-skill via mcp.yaml files.</p>
          <p className="text-xs text-slate-500 mt-1">See the Skill Developer Guide for details.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {connections.map((conn: Record<string, unknown>, i: number) => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <div className="flex items-center gap-2">
                {conn.connected ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
                <span className="text-sm font-medium text-slate-100">{String(conn.name)}</span>
                <span className="text-[10px] text-slate-500">{String(conn.transport)}</span>
              </div>
              <div className="text-xs text-slate-400 mt-1">{String(conn.url)}</div>
              {Boolean(conn.tools) && <div className="text-[10px] text-slate-500 mt-1">{(conn.tools as string[]).length} tools</div>}
              {Boolean(conn.error) && <div className="text-[10px] text-red-400 mt-1">{String(conn.error)}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Components Tab                                                      */
/* ------------------------------------------------------------------ */

function ComponentsTab() {
  const { data: components, isLoading } = useQuery({
    queryKey: ['admin', 'components'],
    queryFn: async () => {
      const res = await fetch('/api/agent/components');
      if (!res.ok) return null;
      return res.json() as Promise<Record<string, { description: string; category: string; supports_mutations: string[]; is_container: boolean }>>;
    },
  });

  if (isLoading || !components) {
    return <div className="flex justify-center py-12"><div className="kv-skeleton w-8 h-8 rounded-full" /></div>;
  }

  const categories = [...new Set(Object.values(components).map((c) => c.category))].sort();

  return (
    <div className="space-y-4">
      <div className="text-sm text-slate-400">{Object.keys(components).length} component kinds registered</div>

      {categories.map((cat) => (
        <div key={cat}>
          <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">{cat}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {Object.entries(components)
              .filter(([, c]) => c.category === cat)
              .map(([name, comp]) => (
                <div key={name} className="bg-slate-900/50 border border-slate-800/50 rounded-md px-3 py-2 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-mono text-slate-200">{name}</span>
                    {comp.is_container && <span className="text-[10px] px-1 py-0.5 bg-blue-900/30 text-blue-400 rounded">container</span>}
                  </div>
                  <p className="text-[11px] text-slate-500">{comp.description}</p>
                  {comp.supports_mutations.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {comp.supports_mutations.map((m) => (
                        <span key={m} className="text-[9px] px-1 py-0.5 bg-slate-800 text-slate-500 rounded">{m}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Analytics Tab                                                       */
/* ------------------------------------------------------------------ */

function AnalyticsTab() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin', 'skill-usage'],
    queryFn: async () => {
      const res = await fetch('/api/agent/skills/usage?days=30');
      if (!res.ok) return null;
      return res.json();
    },
    refetchInterval: 30_000,
  });

  if (isLoading || !stats) {
    return <div className="flex justify-center py-12"><div className="kv-skeleton w-8 h-8 rounded-full" /></div>;
  }

  const skills = stats.skills || [];
  const handoffs = stats.handoffs || [];

  return (
    <div className="space-y-6">
      {skills.length === 0 ? (
        <div className="text-center py-12 text-sm text-slate-500">No skill usage data yet</div>
      ) : (
        <>
          {/* Per-skill cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {skills.map((skill: Record<string, unknown>) => (
              <div key={String(skill.name)} className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-100">{String(skill.name)}</span>
                  <span className="text-lg font-bold text-slate-100">{Number(skill.invocations)}</span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-slate-500">
                  <span>avg {Number(skill.avg_tools)} tools</span>
                  <span>{Number(skill.avg_duration_ms)}ms avg</span>
                  <span className="text-emerald-400">{Number(skill.feedback_positive)} positive</span>
                  {(skill.feedback_negative as number) > 0 && (
                    <span className="text-red-400">{Number(skill.feedback_negative)} negative</span>
                  )}
                </div>
                {(skill.top_tools as Array<{ name: string; count: number }>)?.length > 0 && (
                  <div className="text-[10px] text-slate-600">
                    Top: {(skill.top_tools as Array<{ name: string; count: number }>).map((t) => t.name).join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Handoff flow */}
          {handoffs.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <h3 className="text-xs font-medium text-slate-300 mb-3">Skill Handoffs</h3>
              <div className="space-y-1.5">
                {handoffs.map((h: { from: string; to: string; count: number }, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="text-slate-300">{h.from}</span>
                    <ArrowRight className="w-3 h-3 text-slate-600" />
                    <span className="text-slate-300">{h.to}</span>
                    <span className="text-slate-500 ml-auto">{h.count}x</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
