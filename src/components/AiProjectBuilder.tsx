import React, {useMemo, useState} from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  Code2,
  Eye,
  FileCode2,
  Loader2,
  Send,
  Sparkles,
} from 'lucide-react';
import {ProjectCategory, ProjectFileRecord} from '../data/projects';
import {bundleProjectHtml} from '../lib/projectRunner';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  fileCount?: number;
}

interface AiProjectBuilderProps {
  projectName?: string;
  category?: Exclude<ProjectCategory, 'All'> | string;
  ownerUid?: string;
  currentFiles: ProjectFileRecord[];
  mode?: 'create' | 'iterate';
  onApplyGenerated: (payload: {
    files: ProjectFileRecord[];
    suggestedName?: string;
    suggestedTagline?: string;
    suggestedDescription?: string;
  }) => void;
}

const QUICK_IDEAS = [
  'Interactive SaaS pricing & ROI calculator with dark/light toggle',
  'On-chain portfolio & risk analyzer with live sliders',
  'Browser arcade reaction trainer with scoreboard',
  'Markdown & JSON API workbench with live formatting',
];

export const AiProjectBuilder: React.FC<AiProjectBuilderProps> = ({
  projectName,
  category = 'AI',
  ownerUid,
  currentFiles,
  mode = 'create',
  onApplyGenerated,
}) => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLivePreview, setShowLivePreview] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        mode === 'iterate'
          ? 'Describe changes or new features to add to your live project files.'
          : 'Describe what you want to build. Klyro AI generates real, runnable HTML/CSS/JS files ready to test and publish.',
    },
  ]);

  const runnableDoc = useMemo(
    () => bundleProjectHtml(currentFiles, projectName || 'Klyro AI Build'),
    [currentFiles, projectName]
  );

  const handleGenerate = async (customPrompt?: string) => {
    const text = (customPrompt ?? prompt).trim();
    if (!text || loading) return;

    setError(null);
    setLoading(true);
    setMessages((prev) => [
      ...prev,
      {id: `u-${Date.now()}`, role: 'user', content: text},
    ]);
    if (!customPrompt) setPrompt('');

    try {
      const res = await fetch('/api/ai/build-project', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          prompt: text,
          projectName,
          category,
          ownerUid,
          currentFiles: currentFiles.map((f) => ({
            name: f.name,
            mimeType: f.mimeType,
            previewText: f.previewText,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'AI generation failed.');
      }

      const generatedFiles: ProjectFileRecord[] = Array.isArray(data.files) ? data.files : [];
      if (generatedFiles.length === 0) {
        throw new Error('AI returned zero files.');
      }

      onApplyGenerated({
        files: generatedFiles,
        suggestedName: data.suggestedName,
        suggestedTagline: data.suggestedTagline,
        suggestedDescription: data.suggestedDescription,
      });

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: data.reply || 'Built runnable project files and attached them to your project.',
          fileCount: generatedFiles.length,
        },
      ]);
      setShowLivePreview(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to generate files.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/70 p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="h-7 w-7 rounded-lg bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 inline-flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5" />
          </span>
          <div>
            <div className="text-xs font-semibold text-zinc-950 dark:text-zinc-50">
              Klyro AI Project Builder
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {mode === 'iterate'
                ? 'Iterate on existing code with live sandbox preview'
                : 'Generates working HTML/JS app files to satisfy the build gate'}
            </div>
          </div>
        </div>
        {runnableDoc && (
          <button
            type="button"
            onClick={() => setShowLivePreview((p) => !p)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
          >
            {showLivePreview ? <Code2 className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            {showLivePreview ? 'Hide Live App' : 'Preview Live App'}
          </button>
        )}
      </div>

      {/* Conversation log */}
      <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`text-xs rounded-xl px-3.5 py-2.5 leading-relaxed ${
              msg.role === 'user'
                ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 ml-8'
                : 'bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 mr-4'
            }`}
          >
            <p>{msg.content}</p>
            {msg.fileCount !== undefined && (
              <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                <FileCode2 className="w-3 h-3" />
                {msg.fileCount} runnable file{msg.fileCount === 1 ? '' : 's'} attached
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 px-2 py-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Synthesizing runnable application files...
          </div>
        )}
      </div>

      {/* Quick prompt chips */}
      <div className="flex flex-wrap gap-1.5">
        {QUICK_IDEAS.map((idea) => (
          <button
            key={idea}
            type="button"
            disabled={loading}
            onClick={() => handleGenerate(idea)}
            className="px-2.5 py-1 rounded-full text-[11px] border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-300 hover:border-zinc-900 dark:hover:border-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-colors disabled:opacity-50 inline-flex items-center gap-1"
          >
            {idea}
            <ArrowUpRight className="w-2.5 h-2.5" />
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-xs text-zinc-800 dark:text-zinc-200">
          <AlertCircle className="w-4 h-4 shrink-0 text-zinc-900 dark:text-zinc-100 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Prompt input */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={prompt}
          disabled={loading}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handleGenerate();
            }
          }}
          placeholder={
            mode === 'iterate'
              ? 'e.g. Add a dark/light toggle and export button...'
              : 'Describe your app (e.g. "Build an interactive Solana fee & slippage calculator")'
          }
          className="flex-1 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-400"
        />
        <button
          type="button"
          disabled={loading || prompt.trim().length < 3}
          onClick={() => void handleGenerate()}
          className="px-4 py-2.5 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 inline-flex items-center gap-1.5 shrink-0"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          {currentFiles.length > 0 ? 'Update' : 'Generate'}
        </button>
      </div>

      {/* Inline sandbox runner */}
      {showLivePreview && runnableDoc && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-950 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800 text-[10px] font-medium text-zinc-400">
            <span>Live Sandbox Runner</span>
            <span>{currentFiles.map((f) => f.name).join(' · ')}</span>
          </div>
          <iframe
            title="Klyro AI Live App Preview"
            sandbox="allow-scripts"
            srcDoc={runnableDoc}
            className="w-full h-64 bg-zinc-950"
          />
        </div>
      )}
    </div>
  );
};
