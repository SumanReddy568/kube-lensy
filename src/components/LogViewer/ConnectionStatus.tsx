import { useRef, useEffect, useState } from 'react';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConnectionStatusProps {
  connected: boolean;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  lastUpdate?: number;
}

export function ConnectionStatus({ connected, loading, error, onRetry, lastUpdate }: ConnectionStatusProps) {
  const [isPulsing, setIsPulsing] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (lastUpdate && lastUpdate > 0) {
      setIsPulsing(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setIsPulsing(false), 500);
    }
  }, [lastUpdate]);

  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-mono transition-all duration-300",
      connected
        ? cn(
          "bg-log-info/10 text-log-info border border-log-info/20",
          isPulsing && "bg-log-info/30 border-log-info/50 scale-105 shadow-[0_0_10px_rgba(var(--log-info),0.3)]"
        )
        : "bg-log-error/10 text-log-error border border-log-error/20"
    )}>
      {loading ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Connecting...</span>
        </>
      ) : connected ? (
        <>
          <div className="relative">
            <Wifi className="w-3.5 h-3.5" />
            {isPulsing && (
              <span className="absolute inset-0 rounded-full bg-log-info/40 animate-ping" />
            )}
          </div>
          <span className={cn(isPulsing && "font-bold")}>Live</span>
        </>
      ) : (
        <>
          <WifiOff className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Disconnected</span>
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
            <strong>Not connected to backend.</strong> Run{' '}
            <code className="bg-card px-1.5 py-0.5 rounded">
              npm run server
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
