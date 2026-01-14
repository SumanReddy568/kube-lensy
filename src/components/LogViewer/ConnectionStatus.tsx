import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConnectionStatusProps {
  connected: boolean;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

export function ConnectionStatus({ connected, loading, error, onRetry }: ConnectionStatusProps) {
  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-mono",
      connected 
        ? "bg-log-info/10 text-log-info border border-log-info/20" 
        : "bg-log-error/10 text-log-error border border-log-error/20"
    )}>
      {loading ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Connecting...</span>
        </>
      ) : connected ? (
        <>
          <Wifi className="w-3.5 h-3.5" />
          <span>Live</span>
        </>
      ) : (
        <>
          <WifiOff className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Mock Data</span>
          <button
            onClick={onRetry}
            className="ml-1 underline hover:no-underline"
          >
            Retry
          </button>
        </>
      )}
    </div>
  );
}

export function ConnectionBanner({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="bg-log-warn/10 border-b border-log-warn/20 px-4 py-2 text-xs font-mono text-log-warn">
      <div className="flex items-center justify-between max-w-screen-xl mx-auto">
        <div className="flex items-center gap-2">
          <WifiOff className="w-4 h-4" />
          <span>
            <strong>Not connected to Kubernetes.</strong> Run{' '}
            <code className="bg-card px-1.5 py-0.5 rounded">
              kubectl proxy --port=8001
            </code>{' '}
            to see real logs.
          </span>
        </div>
        <button
          onClick={onRetry}
          className="px-2 py-1 bg-log-warn/20 hover:bg-log-warn/30 rounded transition-colors"
        >
          Retry Connection
        </button>
      </div>
    </div>
  );
}
