import { Terminal, RefreshCw, Trash2, Download, Settings } from 'lucide-react';
import { FilterState } from '@/types/logs';
import { ConnectionStatus } from './ConnectionStatus';

interface HeaderProps {
  filters: FilterState;
  onRefresh: () => void;
  onClear: () => void;
  isLive: boolean;
  connected: boolean;
  loading: boolean;
  error: string | null;
  onRetryConnection: () => void;
}

export function Header({
  filters,
  onRefresh,
  onClear,
  isLive,
  connected,
  loading,
  error,
  onRetryConnection
}: HeaderProps) {
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
          />

          {isLive && connected && (
            <div className="flex items-center gap-2 px-3 py-1 bg-success/15 rounded-full border border-success/30">
              <span className="w-1.5 h-1.5 bg-success rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
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
          <button
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
            title="Export logs"
          >
            <Download className="w-5 h-5" />
          </button>
          <button
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
