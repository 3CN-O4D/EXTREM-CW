import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';

export function PageLoading({ label = 'Loading your data…' }: { label?: string }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-sm font-medium text-slate-500 dark:text-slate-400">
        <Loader2 size={18} className="animate-spin text-brand-500" />
        {label}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl border border-slate-200/80 bg-white dark:border-white/10 dark:bg-slate-900/60" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="h-72 animate-pulse rounded-2xl border border-slate-200/80 bg-white dark:border-white/10 dark:bg-slate-900/60" />
        ))}
      </div>
    </div>
  );
}

export function PageError({
  title = 'We could not load your data',
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center rounded-3xl border border-amber-200 bg-amber-50/70 px-6 py-12 text-center dark:border-amber-400/20 dark:bg-amber-400/5">
      <span className="rounded-2xl bg-amber-100 p-3 text-amber-600 dark:bg-amber-400/10 dark:text-amber-300">
        <AlertTriangle size={24} />
      </span>
      <h2 className="mt-4 text-xl font-black tracking-tight text-slate-900 dark:text-white">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        {message || 'The server did not respond. Check your connection, then try again.'}
      </p>
      {onRetry && (
        <button onClick={onRetry} className="btn-primary mt-6">
          <RefreshCw size={16} /> Try again
        </button>
      )}
    </div>
  );
}

export function InlineError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/5 dark:text-amber-200 sm:flex-row sm:items-center sm:justify-between">
      <span className="flex items-center gap-2">
        <AlertTriangle size={16} /> {message}
      </span>
      {onRetry && (
        <button onClick={onRetry} className="inline-flex items-center gap-1.5 self-start rounded-lg border border-amber-300 px-2.5 py-1.5 text-xs font-bold transition hover:bg-amber-100 dark:border-amber-400/30 dark:hover:bg-amber-400/10 sm:self-auto">
          <RefreshCw size={13} /> Retry
        </button>
      )}
    </div>
  );
}
