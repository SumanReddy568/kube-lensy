import { useState, useEffect } from 'react';
import { Terminal, RefreshCw, Trash2 } from 'lucide-react';
import { FilterState } from '@/types/logs';
import { ConnectionStatus } from './ConnectionStatus';
import { cn } from '@/lib/utils';

interface HeaderProps {
  filters: FilterState;
  onRefresh: () => void;
  onClear: () => void;
  isLive: boolean;
  connected: boolean;
  loading: boolean;
  error: string | null;
  onRetryConnection: () => void;
  lastUpdate?: number;
}

export function Header({
  filters,
  onRefresh,
  onClear,
  isLive,
  connected,
  loading,
  error,
  onRetryConnection,
  lastUpdate
}: HeaderProps) {
  const [pulseLive, setPulseLive] = useState(false);

  useEffect(() => {
    if (lastUpdate && lastUpdate > 0) {
      setPulseLive(true);
      const timer = setTimeout(() => setPulseLive(false), 500);
      return () => clearTimeout(timer);
    }
  }, [lastUpdate]);
  const activeFilters = [
    filters.cluster,
    filters.namespace,
    filters.pod,
    filters.container,
  ].filter(Boolean);

  return (
    <header className="bg-card border-b border-border px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/20 rounded-lg">
              <Terminal className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">KubeLensy</h1>
            </div>
          </div>

          <ConnectionStatus
            connected={connected}
            loading={loading}
            error={error}
            onRetry={onRetryConnection}
            lastUpdate={lastUpdate}
          />

          {isLive && connected && (
            <div className={cn(
              "flex items-center gap-2 px-3 py-1 bg-success/15 rounded-full border border-success/30 transition-all duration-300",
              pulseLive && "scale-105 bg-success/30 border-success/50"
            )}>
              <span className={cn(
                "w-1.5 h-1.5 bg-success rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)]",
                pulseLive ? "animate-ping" : "animate-pulse"
              )} />
              <span className="text-[10px] uppercase tracking-wider font-bold text-success">Live Source</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
            title="Refresh logs"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={onClear}
            className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
            title="Clear logs"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
