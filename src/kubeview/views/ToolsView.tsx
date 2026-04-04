import { Wrench } from 'lucide-react';

export default function ToolsView() {
  return (
    <div className="h-full overflow-auto bg-slate-950 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Wrench className="w-6 h-6 text-fuchsia-400" />
            Tools & Agents
          </h1>
          <p className="text-sm text-slate-400 mt-1">Tool catalog, usage analytics, and agent modes</p>
        </div>
      </div>
    </div>
  );
}
