import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bot, Shield, Send, Trash2, Loader2, Wrench, Brain, AlertTriangle, CheckCircle, XCircle, Wifi, WifiOff } from 'lucide-react';
import { useAgentStore } from '../store/agentStore';
import type { AgentMode, AgentMessage, ResourceContext } from '../engine/agentClient';
import { Panel } from '../components/primitives/Panel';
import { cn } from '@/lib/utils';

const MODE_CONFIG: Record<AgentMode, { label: string; icon: typeof Bot; color: string; description: string }> = {
  sre: {
    label: 'SRE Agent',
    icon: Bot,
    color: 'blue',
    description: 'Diagnose issues, check health, scale workloads, and triage incidents',
  },
  security: {
    label: 'Security Scanner',
    icon: Shield,
    color: 'red',
    description: 'Scan pods, RBAC, network policies, SCCs, images, and secrets',
  },
};

const QUICK_PROMPTS: Record<AgentMode, string[]> = {
  sre: [
    'Check cluster health',
    'Show warning events across all namespaces',
    'List pods not in Running state',
    'Show nodes with issues',
    'Check resource quotas',
  ],
  security: [
    'Run a full security audit',
    'Scan for privileged pods',
    'Check RBAC risks',
    'Find namespaces without network policies',
    'Audit SCC usage',
  ],
};

export default function AgentView() {
  const {
    connected, mode, messages, streaming, streamingText, thinkingText,
    activeTools, pendingConfirm, error,
    connect, disconnect, sendMessage, switchMode, clearChat, confirmAction,
  } = useAgentStore();

  const [input, setInput] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const initialPromptSent = useRef(false);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    connect();
    return () => disconnect();
  }, []);

  // Handle URL params for context-aware invocation (e.g., "Ask Agent" from detail page)
  useEffect(() => {
    if (!connected || initialPromptSent.current) return;
    const prompt = searchParams.get('prompt');
    const contextParam = searchParams.get('context');
    if (prompt) {
      initialPromptSent.current = true;
      let context: ResourceContext | undefined;
      if (contextParam) {
        try { context = JSON.parse(contextParam); } catch { /* ignore */ }
      }
      sendMessage(decodeURIComponent(prompt), context);
      setSearchParams({}, { replace: true });
    }
  }, [connected]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText, thinkingText]);

  // Focus input after streaming completes
  useEffect(() => {
    if (!streaming) inputRef.current?.focus();
  }, [streaming]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || streaming || !connected) return;
    sendMessage(text);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const cfg = MODE_CONFIG[mode];
  const Icon = cfg.icon;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon className={cn('h-6 w-6', mode === 'sre' ? 'text-blue-400' : 'text-red-400')} />
            <div>
              <h1 className="text-lg font-semibold">{cfg.label}</h1>
              <p className="text-xs text-slate-400">{cfg.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Connection status */}
            <div className={cn('flex items-center gap-1.5 text-xs', connected ? 'text-green-400' : 'text-red-400')}>
              {connected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
              {connected ? 'Connected' : 'Disconnected'}
            </div>

            {/* Mode toggle */}
            <div className="flex rounded-lg border border-slate-700 overflow-hidden">
              {(['sre', 'security'] as AgentMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => switchMode(m)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium transition-colors',
                    mode === m
                      ? m === 'sre' ? 'bg-blue-600 text-white' : 'bg-red-600 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700',
                  )}
                >
                  {MODE_CONFIG[m].label}
                </button>
              ))}
            </div>

            <button
              onClick={clearChat}
              className="p-1.5 text-slate-400 hover:text-white rounded transition-colors"
              title="Clear chat"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-auto px-6 py-4 space-y-4">
        {messages.length === 0 && !streaming && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Icon className={cn('h-16 w-16 mb-4 opacity-20', mode === 'sre' ? 'text-blue-400' : 'text-red-400')} />
            <h2 className="text-lg font-medium text-slate-300 mb-2">Start a conversation</h2>
            <p className="text-sm text-slate-500 mb-6 max-w-md">
              Ask the {cfg.label.toLowerCase()} about your cluster. It has direct access to your Kubernetes API.
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {QUICK_PROMPTS[mode].map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => { sendMessage(prompt); }}
                  disabled={!connected}
                  className="px-3 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded-full text-slate-300 hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} mode={mode} />
        ))}

        {/* Streaming indicator */}
        {streaming && (
          <div className="space-y-2">
            {/* Thinking */}
            {thinkingText && (
              <div className="flex gap-3 items-start">
                <Brain className="h-4 w-4 text-purple-400 mt-1 shrink-0" />
                <div className="text-xs text-purple-300/70 italic max-w-2xl whitespace-pre-wrap">
                  {thinkingText.slice(-500)}
                </div>
              </div>
            )}

            {/* Active tools */}
            {activeTools.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-cyan-400">
                <Wrench className="h-3.5 w-3.5 animate-spin" />
                {activeTools[activeTools.length - 1]}
              </div>
            )}

            {/* Streaming text */}
            {streamingText && (
              <div className="flex gap-3 items-start">
                <Icon className={cn('h-5 w-5 mt-0.5 shrink-0', mode === 'sre' ? 'text-blue-400' : 'text-red-400')} />
                <div className="prose prose-invert prose-sm max-w-none">
                  <pre className="whitespace-pre-wrap text-sm text-slate-200">{streamingText}</pre>
                </div>
              </div>
            )}

            {!streamingText && !thinkingText && activeTools.length === 0 && (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Thinking...
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-400 bg-red-950/30 border border-red-900 rounded-lg px-4 py-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Confirmation dialog */}
        {pendingConfirm && (
          <Panel className="border-amber-700 bg-amber-950/30">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
              <div className="flex-1">
                <h3 className="text-sm font-medium text-amber-200 mb-1">Confirm write operation</h3>
                <p className="text-xs text-slate-300 mb-2">
                  The agent wants to execute <span className="font-mono text-amber-300">{pendingConfirm.tool}</span>
                </p>
                <pre className="text-xs text-slate-400 bg-slate-900 rounded p-2 mb-3 overflow-auto max-h-32">
                  {JSON.stringify(pendingConfirm.input, null, 2)}
                </pre>
                <div className="flex gap-2">
                  <button
                    onClick={() => confirmAction(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-700 hover:bg-green-600 text-white rounded transition-colors"
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    Approve
                  </button>
                  <button
                    onClick={() => confirmAction(false)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-700 hover:bg-red-600 text-white rounded transition-colors"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Deny
                  </button>
                </div>
              </div>
            </div>
          </Panel>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-slate-700 px-6 py-3">
        <div className="flex items-center gap-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={connected ? `Ask the ${cfg.label.toLowerCase()}...` : 'Connecting to agent...'}
            disabled={streaming || !connected}
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || streaming || !connected}
            className={cn(
              'p-2.5 rounded-lg transition-colors',
              input.trim() && !streaming && connected
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed',
            )}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message, mode }: { message: AgentMessage; mode: AgentMode }) {
  const isUser = message.role === 'user';
  const Icon = isUser ? undefined : MODE_CONFIG[mode].icon;

  return (
    <div className={cn('flex gap-3 items-start', isUser && 'flex-row-reverse')}>
      {isUser ? (
        <div className="h-7 w-7 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
          <span className="text-xs font-medium">You</span>
        </div>
      ) : (
        Icon && <Icon className={cn('h-5 w-5 mt-0.5 shrink-0', mode === 'sre' ? 'text-blue-400' : 'text-red-400')} />
      )}
      <div className={cn(
        'max-w-3xl rounded-lg px-4 py-2.5 text-sm',
        isUser
          ? 'bg-blue-600/20 border border-blue-500/30 text-slate-100'
          : 'bg-slate-800 border border-slate-700 text-slate-200',
      )}>
        {message.context && (
          <div className="text-xs text-slate-500 mb-1">
            Context: {message.context.kind} {message.context.namespace}/{message.context.name}
          </div>
        )}
        <pre className="whitespace-pre-wrap font-sans">{message.content}</pre>
      </div>
    </div>
  );
}
